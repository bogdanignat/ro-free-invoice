import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { inspectArchive } from "./postgres-backup-archive.ts"
import { inspectBackup } from "./postgres-backup.ts"
import { validateSource } from "./postgres-backup-source.ts"
import { defaultArchiveLimits } from "./postgres-backup-tar.ts"
import { assertWithinLimits } from "./postgres-backup-verify.ts"
import { writeArchive } from "./postgres-backup-writer.ts"

/** The manifest bound, at every place that reads or writes a member, with small limits. */

void test("the per-member bound stays within the ustar size field", () => {
  assert.ok(defaultArchiveLimits.maxMemberBytes <= 0o77777777777)
})

void test("a manifest over its own bound is refused by the writer, the reader and the directory walk", async () => {
  const root = mkdtempSync(join(tmpdir(), "qwbe-manifest-bound-"))
  try {
    writeFileSync(join(root, "manifest.json"), "x".repeat(600))
    writeFileSync(join(root, "database.sql"), "x".repeat(600))
    const limits = { ...defaultArchiveLimits, maxManifestBytes: 512 }
    const files = [
      { path: "manifest.json", sha256: "0".repeat(64), byteLength: 600 },
      { path: "database.sql", sha256: "0".repeat(64), byteLength: 600 },
    ]
    assert.throws(() => { assertWithinLimits(files, limits) }, /manifest\.json is 600 bytes, over the per-member bound of 512/)
    assertWithinLimits(files, { ...limits, maxManifestBytes: 600 })

    await assert.rejects(() => validateSource(root, limits), /input entry exceeds the size bound: manifest\.json/)

    const archive = join(root, "big-manifest.tar.gz")
    await writeArchive(root, ["manifest.json", "database.sql"], archive)
    await assert.rejects(() => inspectArchive(archive, limits), /member exceeds the size bound: manifest\.json/)
    await assert.rejects(() => inspectBackup(archive, limits), /member exceeds the size bound: manifest\.json/)
    assert.equal((await inspectArchive(archive, { ...limits, maxManifestBytes: 600 })).length, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
