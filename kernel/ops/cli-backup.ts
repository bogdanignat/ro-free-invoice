import { createQueryRuntime } from "../storage/postgres-pool.ts"
import { confirmedApply, failureExitCode, print, type CommandContext, type CommandOf } from "./cli.ts"
import { cliRedactor, failureMessage } from "./cli-redaction.ts"
import { executeBackup, executeRestore, inspectBackup, planRestore, restoreTrustWarning } from "./postgres-backup.ts"

/** Runs before `runtimeConfig`: the archive alone is read, so no database setting or secret is required. */
export const runBackupInspect = async (command: CommandOf<"backup-inspect">) => {
  try {
    const report = await inspectBackup(command.input)
    print(report, command.json)
    if (report.refusal !== null) {
      console.error(`backup cannot be restored by this image: ${report.refusal}`)
      process.exitCode = 2
    }
  } catch (error) {
    console.error(failureMessage(cliRedactor(""), error))
    process.exitCode = failureExitCode(error)
  }
}

export const runBackup = async (command: CommandOf<"backup">, { config, settings }: CommandContext) => {
  const runtime = createQueryRuntime(settings)
  try {
    const report = await executeBackup({
      pool: runtime.pool, settings: config.pgSettings, dataDirectory: config.dataDirectory,
      organizationId: config.organizationId,
    }, command.output)
    print(report, command.json)
    if (report.failed > 0) process.exitCode = 1
  } finally {
    await runtime.close()
  }
}

export const runRestore = async (command: CommandOf<"restore">, { config, settings }: CommandContext) => {
  if (!confirmedApply("restore", command, config)) return
  const runtime = createQueryRuntime(settings)
  try {
    const context = {
      pool: runtime.pool, settings: config.pgSettings, dataDirectory: config.dataDirectory,
      organizationId: config.organizationId,
    }
    // `database.sql` is executed by `psql` as the schema owner role (qwbe_owner), NOSUPERUSER, and
    // the manifest digests live inside the same archive as the file they
    // describe: they prove integrity, never authenticity. So the trust boundary
    // is stated before the write, on stderr — `--json` consumers keep a clean
    // stdout, and a dry run says nothing it is not about to do.
    if (command.apply) console.error(restoreTrustWarning)
    // One scan, used for both numbers: two independent scans could
    // disagree and the operator would read an inconsistent plan.
    const report = command.apply
      ? await executeRestore(context, command.input)
      : await (async () => {
        const planned = await planRestore(context, command.input)
        return {
          dataDirectory: config.dataDirectory,
          input: command.input,
          scanned: planned.pending.length,
          restored: 0,
          failed: 0,
          files: planned.pending,
          dryRun: true,
        }
      })()
    print(report, command.json)
    if (report.failed > 0) process.exitCode = 1
  } finally {
    await runtime.close()
  }
}
