import { applicationReady, startServer } from "../http/http.ts"
import { cachedReadiness, readinessIntervalMs } from "../http/readiness.ts"
import { runShutdown } from "../http/shutdown.ts"
import { ANAF_NOT_CONFIGURED } from "../efactura/anaf/connection-host.ts"
import { startEFacturaRuntime } from "../efactura/efactura-runtime.ts"
import { startMaintenanceSession } from "../storage/postgres-maintenance-session.ts"
import { createPostgresRuntime } from "../storage/postgres-pool.ts"
import type { CommandContext } from "./cli.ts"
import { failureMessage } from "./cli-redaction.ts"

/**
 * `serve` already reported its own failure and released everything it held. The
 * outer catch must not print a second, less specific message on top of it.
 */
export class ServeAborted extends Error {
  override readonly name = "ServeAborted"
}

/**
 * `serve` NEVER migrates. It takes the maintenance barrier SHARED, listens
 * regardless, and answers 503 until the barrier, the schema and the artifact
 * directory all agree. Its pools outlive the command and end with the signal handler.
 */
export const runServe = async ({ config, settings, redact }: CommandContext) => {
  // Two pools: queries, and the dedicated connection the shared barrier
  // lives on. Neither is closed here on success — the signal handler is.
  const runtime = createPostgresRuntime(settings)
  // HTTP comes up even if the database does not. `startMaintenanceSession`
  // is documented not to reject, and the `catch` is belt and braces: the
  // port must open and `/health/live` must answer 200 regardless, with
  // `/health/ready` and `/api*` answering 503 until the barrier is held.
  const barrier = await startMaintenanceSession(runtime.maintenance, {
    onLost: (reason) => { console.error(`maintenance barrier: ${reason}`) },
    onAcquired: () => { console.log("maintenance barrier: held") },
  }).catch((error: unknown) => {
    console.error(`maintenance barrier: ${failureMessage(redact, error)}`)
    return { held: () => false, state: () => "acquiring" as const, release: async () => {} }
  })
  let acceptingTraffic = true
  const ready = cachedReadiness(
    applicationReady(config, runtime.pool, barrier.held, (reason) => {
      console.error(`readiness: ${reason} (barrier ${barrier.state()})`)
    }),
    readinessIntervalMs,
  )
  // A failed `listen` (EADDRINUSE, EACCES) must not leave a hung process
  // holding the SHARED barrier: `migrate`/`backup`/`restore` would refuse
  // until it was SIGKILLed, and `restart: unless-stopped` never fires for a
  // process that merely hangs. `startServer` has already disposed the API
  // handler by the time it rejects; the barrier and both pools are ours.
  let running: Awaited<ReturnType<typeof startServer>>
  let environmentChecked = () => false
  try {
    // Traffic also waits for the e-Factura environment guard below: no submit may write before it passed.
    running = await startServer(config, runtime.pool, async () => acceptingTraffic && environmentChecked() && await ready())
  } catch (error) {
    acceptingTraffic = false
    // The failure code is set before anything is awaited. The abandon timer
    // below is `unref`'d, so if the loop drains while the release and the
    // close are still pending, Node exits on its own — with 0 if the code was
    // not set yet, which would report a failed boot as success to anything
    // keyed on exit status.
    process.exitCode = 1
    console.error(`serve could not listen: ${failureMessage(redact, error)}`)
    // Bounded: if the release or the drain cannot finish, the process still
    // exits instead of waiting on a socket that will never close.
    const abandon = setTimeout(() => { process.exit(1) }, 10_000)
    abandon.unref()
    await barrier.release().catch(() => undefined)
    await runtime.close().catch(() => undefined)
    clearTimeout(abandon)
    throw new ServeAborted()
  }
  // Set when the e-Factura environment guard refuses: the shutdown then ends with 1 whatever its steps answer.
  let refused = false
  // Once the database is ready: `ANAF_ENVIRONMENT` is checked against the stored submissions whatever `RFI_PLUGINS`
  // says, before any traffic; the dispatcher runs only with e-Factura on.
  const efactura = startEFacturaRuntime({
    pool: runtime.pool, settings, anaf: config.anaf ?? ANAF_NOT_CONFIGURED, pluginOn: config.plugins.efactura,
    ready: async () => acceptingTraffic && await ready(), barrierHeld: barrier.held,
    report: (message) => { console.error(redact(message)) },
    onRefused: (message) => {
      console.error(`serve refused to start: ${message}`)
      refused = true
      close()
    },
  })
  environmentChecked = efactura.environmentChecked
  const close = () => {
    if (!acceptingTraffic) return
    acceptingTraffic = false
    // Symmetric with the failed-boot path above, and for the same reason: the
    // old chain skipped the release and the pool close whenever the drain
    // rejected, and its deadline only cut the connections — the maintenance
    // client keeps the event loop alive, so the process hung until Docker's
    // SIGKILL (137). `runShutdown` keeps the order (drain, then the query
    // pool, then the barrier, then the rest), attempts every step anyway and
    // answers with the exit code. `closeQueries` is what earns the release:
    // destroying a socket does not end the request behind it, and only the
    // query pool's `end()` waits for the writes and then refuses the next
    // client.
    //
    // The failure code is set before anything is awaited, exactly as at the
    // failed-boot path: the deadline timer is `unref`'d, so a loop that
    // drains while a step is still pending exits on its own — with 0 if the
    // code was not set yet, reporting an unfinished shutdown as success.
    // A completed sequence overwrites it with its own answer.
    process.exitCode = 1
    void runShutdown({
      // The dispatcher first: it stops taking work and aborts its ANAF call while the barrier is still held.
      stopWorkers: () => efactura.stop(),
      drain: () => running.close(),
      destroyConnections: () => { running.server.closeAllConnections() },
      endQueries: () => runtime.closeQueries(),
      releaseBarrier: () => barrier.release(),
      closePools: () => runtime.close(),
      report: (step, error) => { console.error(`shutdown ${step}: ${failureMessage(redact, error)}`) },
      abandon: () => { process.exit(1) },
      // A request still running at 5 s has its socket cut; the write behind
      // it is still awaited by `endQueries` before the barrier goes.
      escalateMs: 5_000,
      deadlineMs: 10_000,
    }).then((code) => { process.exitCode = refused ? 1 : code })
  }
  process.once("SIGINT", close)
  process.once("SIGTERM", close)
}
