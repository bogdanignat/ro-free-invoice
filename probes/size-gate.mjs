import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { inspectSizes, sizeViolations } from "./size-gate-lib.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const config = JSON.parse(readFileSync(join(root, "qwbe.config.json"), "utf8"))
// A missing, misspelled or empty list would measure only the cube units and pass.
if (!Array.isArray(config.sizeFileRoots) || config.sizeFileRoots.length === 0) {
  throw new Error(`Invalid sizeFileRoots: expected a non-empty list, got ${JSON.stringify(config.sizeFileRoots)}`)
}
const measurement = await inspectSizes(root, {
  fileRoots: config.sizeFileRoots,
  excludedDirectories: config.sizeExcludedDirectories,
  generatedFiles: config.sizeGeneratedFiles,
})
const violations = sizeViolations(measurement, config.caps)

for (const unit of measurement.units) {
  console.log(`${unit.id}: ${unit.lines} code lines across ${unit.files} production files`)
}
console.log(`File-only roots: ${config.sizeFileRoots.join(", ")}; cap ${config.caps.maxCodeLinesPerFile} code lines per production source file.`)
for (const entry of config.sizeGeneratedFiles ?? []) {
  console.log(`Generated, not measured: ${entry.path} (${entry.reason})`)
}
for (const file of violations.files) {
  console.error(`File over cap: ${file.path} has ${file.lines} code lines; cap is ${config.caps.maxCodeLinesPerFile}.`)
}
for (const unit of violations.units) {
  console.error(
    `Unit over cap: ${unit.id} has ${unit.lines} code lines and ${unit.files} files; caps are ${config.caps.maxCodeLinesPerUnit} and ${config.caps.maxFilesPerUnit}.`,
  )
}

if (violations.files.length > 0 || violations.units.length > 0) {
  process.exitCode = 1
} else {
  console.log("Size gate passed.")
}
