import { Effect } from "effect"

import { documentsPermissions } from "../../cubes/invoicing/documents/index.ts"
import { reconcileArtifacts } from "../documents/artifact-reconciliation.ts"
import { createKernelArtifactService } from "../documents/artifact-runtime.ts"
import { createQueryRuntime } from "../storage/postgres-pool.ts"
import { confirmedApply, print, type CommandContext, type CommandOf } from "./cli.ts"
import { assertDataDirectory } from "./postgres-backup-destinations.ts"

export const runArtifacts = async (command: CommandOf<"artifacts">, { config, settings }: CommandContext) => {
  if (config.organizationId === undefined || config.organizationId.trim().length === 0) {
    console.error("artifacts requires ORGANIZATION_ID")
    process.exitCode = 2
    return
  }
  if (!confirmedApply("artifacts", command, config)) return
  // The same guard as backup/restore: a missing or misspelled DATA_DIR is
  // refused, never created — otherwise `--apply` would render the PDFs onto
  // whatever filesystem that path happens to land on.
  await assertDataDirectory(config.dataDirectory)
  const runtime = createQueryRuntime(settings)
  try {
    const service = createKernelArtifactService(config.dataDirectory, runtime.pool, Effect.succeed({
      identity: {
        id: "kernel-operator",
        permissions: [documentsPermissions.read, documentsPermissions.render],
      },
      organization: { id: config.organizationId },
    }))
    const report = await reconcileArtifacts(service, command.limit, command.apply)
    print(report, command.json)
    if (report.failed > 0) process.exitCode = 1
  } finally {
    await runtime.close()
  }
}
