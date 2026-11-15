#!/usr/bin/env node
import { runtimeConfig } from "../kernel/config.ts"
import { CliInputError, failureExitCode, parseCommand, print, type Command } from "../kernel/ops/cli.ts"
import { runArtifacts } from "../kernel/ops/cli-artifacts.ts"
import { runBackup, runBackupInspect, runRestore } from "../kernel/ops/cli-backup.ts"
import { runDoctor } from "../kernel/ops/cli-doctor.ts"
import { helpText } from "../kernel/ops/cli-help.ts"
import { runMigrate } from "../kernel/ops/cli-migrate.ts"
import { cliRedactor, failureMessage } from "../kernel/ops/cli-redaction.ts"
import { runServe, ServeAborted } from "../kernel/ops/cli-serve.ts"

/**
 * The CLI: it parses the arguments and hands the command to its module in
 * `kernel/ops/cli-*.ts`. Two rules it exists to hold:
 *
 * 1. `serve` NEVER migrates. It takes the maintenance barrier SHARED, listens
 *    regardless, and answers 503 until the barrier, the schema and the artifact
 *    directory all agree.
 * 2. Every command that is not `serve` ends its pool in a `finally`. `serve`
 *    does not: the pool outlives the command and dies with the signal handler.
 */

let command: Command | undefined
try {
  command = parseCommand(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof CliInputError ? error.message : "invalid command input")
  process.exitCode = 2
}

if (command?.name === "backup-inspect") {
  await runBackupInspect(command)
} else if (command !== undefined) {
  // Declared outside the `try` so the final `catch` can use it: a configuration
  // failure happens before the secret is known, and then the pattern redactor
  // alone is what is available.
  let redact = cliRedactor("")
  try {
    const config = runtimeConfig()
    // Every diagnostic this process prints goes through here: the pattern
    // redactor plus the literal secret that was read from the file.
    redact = cliRedactor(config.pgSettings.password)
    const reportPoolError = (message: string) => { console.error(`database pool: ${redact(message)}`) }
    const context = { config, redact, settings: { ...config.pgSettings, onPoolError: reportPoolError } }

    if (command.name === "help") print(helpText, false)
    if (command.name === "serve") await runServe(context)
    if (command.name === "doctor") await runDoctor(command, context)
    if (command.name === "migrate") await runMigrate(command, context)
    if (command.name === "artifacts") await runArtifacts(command, context)
    if (command.name === "backup") await runBackup(command, context)
    if (command.name === "restore") await runRestore(command, context)
  } catch (error) {
    // Redacted, cause chain included: a `pg` error carries the connection
    // configuration, password included, and a wrapper hides it one level down.
    if (!(error instanceof ServeAborted)) console.error(failureMessage(redact, error))
    process.exitCode = failureExitCode(error)
  }
}
