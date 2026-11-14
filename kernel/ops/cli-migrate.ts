import { applyMigrations, planMigrations, schemaDrift } from "../storage/migrations.ts"
import { createQueryRuntime } from "../storage/postgres-pool.ts"
import { confirmedApply, print, type CommandContext, type CommandOf } from "./cli.ts"

export const runMigrate = async (command: CommandOf<"migrate">, { config, settings }: CommandContext) => {
  if (!confirmedApply("migrate", command, config)) return
  const runtime = createQueryRuntime(settings)
  try {
    // A schema the recorded history does not explain (an object changed by
    // hand, a ledger row removed) cannot be migrated forward, so migrate
    // refuses before writing. The check repeats after apply, so a migration
    // that leaves drift behind is refused too. `applyMigrations` takes the barrier EXCLUSIVE with a
    // bounded try: a running application makes it refuse, not hang.
    const before = await schemaDrift(runtime.pool)
    const applying = command.apply && before.length === 0
    const report = applying
      ? await applyMigrations(runtime.pool)
      : await planMigrations(runtime.pool)
    const drifted = applying ? await schemaDrift(runtime.pool) : before
    print({ ...report, schemaDrift: drifted }, command.json)
    if (drifted.length > 0) {
      console.error(
        `schema does not match the migration contract (${drifted.join(", ")}): the schema is not the one `
        + "its migration history explains; inspect the named objects, or restore a backup",
      )
      process.exitCode = 1
    }
  } finally {
    await runtime.close()
  }
}
