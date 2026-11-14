import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath, URL } from "node:url"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { listCube } from "./cube-fixture.test-support.mjs"
import { countCodeLines, inspectSizes, sizeViolations, stripCommentsAndBlankLines } from "./size-gate-lib.mjs"

const fixture = () => mkdtempSync(join(tmpdir(), "rfi-size-gate-"))
const write = (root, path, content) => {
  const target = join(root, path)
  mkdirSync(join(target, ".."), { recursive: true })
  writeFileSync(target, content)
}
const makeUnit = listCube

test("counts code while preserving comment markers inside strings", () => {
  const source = '// removed\nconst url = "https://example.test/a"\n/* removed */\n\nconst value = 1\n'
  assert.equal(stripCommentsAndBlankLines(source), 'const url = "https://example.test/a"\nconst value = 1')
})

test("does not mistake comment markers inside regular expressions for comments", () => {
  const source = "const pattern = /https?:\\/\\/example[.]test/\nconst after = 1\n"
  assert.equal(stripCommentsAndBlankLines(source), source.trim())
})

test("keeps reading a file correctly after a template literal with substitutions", () => {
  // The scanner this used to use lost the grammar here: it read `//` in the
  // tail as a comment and then stopped recognising the real comment below it.
  const source = 'const url = `http://${host}//${path}`\n// removed\nconst after = 1\n'
  assert.equal(stripCommentsAndBlankLines(source), "const url = `http://${host}//${path}`\nconst after = 1")
})

test("counts a nested template literal as the code it is", () => {
  const source = 'const q = `a${`b/* not a comment */c`}d`\n/* removed */\nconst n = 2\n'
  assert.equal(stripCommentsAndBlankLines(source), "const q = `a${`b/* not a comment */c`}d`\nconst n = 2")
})

test("strips a comment that shares its line with the code before it", () => {
  // `getLeadingCommentRanges` only starts collecting at the start of the file
  // or after a line break, so these three were counted as code in full.
  assert.equal(stripCommentsAndBlankLines("const x = 1 // note\nconst y = 2\n"),
    "const x = 1 \nconst y = 2")
  assert.equal(stripCommentsAndBlankLines("const x = /* note */ 1\n"), "const x =  1")
  assert.equal(stripCommentsAndBlankLines("const x = 1 // last line, no newline"), "const x = 1 ")
})

test("strips a doc comment without counting the code it documents twice", () => {
  const source = "/** What it is.\n * Why it is.\n */\nexport const x = 1 // and how\n"
  assert.equal(stripCommentsAndBlankLines(source), "export const x = 1 ")
})

test("counts a shebang as the code it is, slashes included", () => {
  // `#!` is not a comment, and the two slashes in the interpreter path are not
  // one either — but they sit in the first token's trivia span, where every
  // other `//` does start a comment.
  const source = "#!/usr/bin/env node\nconst x = 1\n"
  assert.equal(stripCommentsAndBlankLines(source), source.trim())
  assert.equal(stripCommentsAndBlankLines("#!/usr/bin/env node // note\nconst x = 1\n"),
    "#!/usr/bin/env node // note\nconst x = 1")
})

test("counts code lines: comments and blank lines are not code", () => {
  assert.equal(countCodeLines("/** Doc.\n * More.\n */\nconst x = 1 // note\n\n// only a comment\nconst y = 2\n"), 2)
  assert.equal(countCodeLines("// nothing but a comment\n\n"), 0)
  assert.equal(countCodeLines(""), 0)
})

const caps = { maxCodeLinesPerFile: 200, maxCodeLinesPerUnit: 800, maxFilesPerUnit: 15 }

test("rejects a file over the line cap and a unit over the line or file-count cap", () => {
  const file = { path: "cubes/invoicing/index.ts", lines: 201 }
  const longUnit = { id: "cubes/invoicing", files: 2, lines: 801 }
  const wideUnit = { id: "cubes/invoicing/payments", files: 16, lines: 10 }
  const measurement = {
    files: [file, { path: "cubes/invoicing/payments/index.ts", lines: 200 }],
    units: [longUnit, wideUnit, { id: "cubes/invoicing/catalog", files: 15, lines: 800 }],
  }
  assert.deepEqual(sizeViolations(measurement, caps), { files: [file], units: [longUnit, wideUnit] })
})

test("refuses a missing, misspelled or non-positive cap instead of passing everything", () => {
  const measurement = { files: [{ path: "kernel/a.ts", lines: 9999 }], units: [] }
  const { maxCodeLinesPerFile, ...withoutFileCap } = caps
  assert.equal(maxCodeLinesPerFile, 200)
  for (const invalid of [undefined, withoutFileCap, { ...withoutFileCap, maxCharsPerFile: 6000 },
    { ...caps, maxCodeLinesPerUnit: 0 }, { ...caps, maxFilesPerUnit: "15" }, { ...caps, maxCodeLinesPerFile: 1.5 }]) {
    assert.throws(() => sizeViolations(measurement, invalid), /Invalid size cap/)
  }
})

test("measures nested cubes independently and excludes tests", async () => {
  const root = fixture()
  try {
    makeUnit(root, "cubes/invoicing")
    write(root, "cubes/invoicing/index.ts", "export const parent = 1\n")
    write(root, "cubes/invoicing/index.test.ts", "// tests are not production size\n")
    makeUnit(root, "cubes/invoicing/cubes/reporting")
    write(root, "cubes/invoicing/cubes/reporting/index.ts", "export const child = 2\n")

    const measurement = await inspectSizes(root)
    assert.deepEqual(measurement.units.map(({ id, files }) => ({ id, files })), [
      { id: "cubes/invoicing", files: 1 },
      { id: "cubes/invoicing/cubes/reporting", files: 1 },
    ])
    assert.equal(measurement.files.length, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("measures host and browser sources without treating them as cubes", async () => {
  const root = fixture()
  try {
    makeUnit(root, "cubes/invoicing")
    write(root, "cubes/invoicing/index.ts", "export const cube = 1\n")
    write(root, "kernel/api/new/handler.ts", "export const handler = 'over cap'\nexport const second = 2\n")
    write(root, "web/src/View.tsx", '// a comment is not code\n\nexport const View = () =>\n  <a href="https://example.test">Link</a>\n')
    write(root, "kernel/api/handler.test.ts", "test fixture")
    write(root, "kernel/api/handler.spec.ts", "test fixture")
    write(root, "kernel/api/handler.test-support.ts", "test fixture")
    write(root, "kernel/ui-dist/assets/app.js", "generated bundle")
    write(root, "kernel/ui-dist-source/real.ts", "export const real = 1\n")
    write(root, "web/dist/app.js", "generated bundle")
    write(root, "web/node_modules/library/index.js", "dependency")
    write(root, "web/.cache/generated.js", "generated bundle")
    write(root, "web/src/app.css", "stylesheet")
    symlinkSync(join(root, "kernel/api/new/handler.ts"), join(root, "web/linked.ts"))
    const measurement = await inspectSizes(root, {
      fileRoots: ["kernel", "web", "kernel/api", "cubes", "kernel/ui-dist/assets"],
      excludedDirectories: ["kernel/ui-dist"],
    })
    assert.deepEqual(measurement.files.map(({ path }) => path), [
      "cubes/invoicing/index.ts",
      "kernel/api/new/handler.ts",
      "kernel/ui-dist-source/real.ts",
      "web/src/View.tsx",
    ])
    assert.deepEqual(measurement.units.map(({ id, files }) => ({ id, files })), [
      { id: "cubes/invoicing", files: 1 },
    ])
    const violations = sizeViolations(measurement, { ...caps, maxCodeLinesPerFile: 1 })
    assert.deepEqual(violations.files.map(({ path }) => path), ["kernel/api/new/handler.ts", "web/src/View.tsx"])
    assert.deepEqual(violations.units, [])
    assert.equal(measurement.files.find(({ path }) => path.endsWith("View.tsx")).lines, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("refuses missing, non-directory and symbolic-link file roots", async () => {
  const root = fixture()
  try {
    makeUnit(root, "cubes/invoicing")
    write(root, "web/src/index.ts", "export const value = 1\n")
    symlinkSync(join(root, "web"), join(root, "linked"))
    for (const fileRoot of ["missing", "web/src/index.ts", "linked", "linked/src", "../outside"]) {
      await assert.rejects(inspectSizes(root, { fileRoots: [fileRoot] }), /source root/i)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("leaves out only the generated files named with a reason, and refuses stale or vague exclusions", async () => {
  const root = fixture()
  try {
    makeUnit(root, "cubes/invoicing")
    write(root, "web/src/routeTree.gen.ts", "export const tree = 'generated and long'\n")
    write(root, "web/src/other.gen.ts", "export const other = 'generated and long'\n")
    symlinkSync(join(root, "web/src/other.gen.ts"), join(root, "web/linked.gen.ts"))
    const reason = "written by the router plugin"
    const measurement = await inspectSizes(root, {
      fileRoots: ["web"], generatedFiles: [{ path: "web/src/routeTree.gen.ts", reason }],
    })
    assert.deepEqual(measurement.files.map(({ path }) => path), ["web/src/other.gen.ts"])
    for (const entry of [
      { path: "web/src/routeTree.gen.ts" },
      { path: "web/src/routeTree.gen.ts", reason: " " },
      { path: "web/src/missing.gen.ts", reason },
      { path: "web/src", reason },
      { path: "web/linked.gen.ts", reason },
      { path: "../outside.gen.ts", reason },
    ]) {
      await assert.rejects(inspectSizes(root, { fileRoots: ["web"], generatedFiles: [entry] }), /generated file exclusion|inside the repository/i)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("size gate CLI fails on an oversized file in each measured root, an oversized unit and invalid configuration", () => {
  const root = fixture()
  try {
    for (const name of ["size-gate.mjs", "size-gate-lib.mjs", "source-tree.mjs"]) {
      // Outside the measured roots, so the gate's own sources do not count against the fixture's caps.
      write(root, `gate/${name}`, readFileSync(new URL(name, import.meta.url), "utf8"))
    }
    symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(root, "node_modules"))
    const roots = ["kernel", "cubes", "frontend/src", "probes", "bin"]
    const config = { sizeFileRoots: roots, caps: { ...caps, maxCodeLinesPerFile: 1, maxCodeLinesPerUnit: 3 } }
    write(root, "qwbe.config.json", JSON.stringify(config))
    makeUnit(root, "cubes/invoicing")
    write(root, "cubes/invoicing/index.ts", "export const cube = 1\n")
    const sources = ["kernel/adapter.ts", "cubes/invoicing/domain.ts", "frontend/src/app/page.tsx", "probes/extra.mjs", "bin/tool.ts"]
    for (const path of sources) write(root, path, "// one comment\nexport const first = 1\n\nexport const second = 2\n")
    const run = () => spawnSync(process.execPath, [join(root, "gate/size-gate.mjs")], { encoding: "utf8" })
    const overCap = run()
    assert.equal(overCap.status, 1)
    for (const path of sources) assert.match(overCap.stderr, new RegExp(`File over cap: ${path} has 2 code lines; cap is 1[.]`))
    assert.doesNotMatch(overCap.stderr, /Unit over cap/)
    for (const path of sources) write(root, path, "export const x = 1 // one line\n")
    assert.equal(run().status, 0)
    write(root, "cubes/invoicing/more.ts", "export const a = 1\nexport const b = 2\nexport const c = 3\n")
    const overUnit = run()
    assert.equal(overUnit.status, 1)
    assert.match(overUnit.stderr, /Unit over cap: cubes\/invoicing has 5 code lines and 3 files; caps are 3 and 15[.]/)
    write(root, "cubes/invoicing/more.ts", "export const a = 1\n")
    assert.equal(run().status, 0)
    write(root, "qwbe.config.json", JSON.stringify({ ...config, caps: { maxCharsPerFile: 6000 } }))
    const staleCaps = run()
    assert.notEqual(staleCaps.status, 0)
    assert.match(staleCaps.stderr, /Invalid size cap maxCodeLinesPerFile/)
    const { sizeFileRoots, ...withoutRoots } = config
    assert.deepEqual(sizeFileRoots, roots)
    for (const stale of [withoutRoots, { ...withoutRoots, sizeFileRoot: roots }, { ...config, sizeFileRoots: [] },
      { ...config, sizeFileRoots: "kernel" }]) {
      write(root, "qwbe.config.json", JSON.stringify(stale))
      const refused = run()
      assert.notEqual(refused.status, 0, JSON.stringify(stale))
      assert.match(refused.stderr, /Invalid sizeFileRoots: expected a non-empty list/)
      assert.doesNotMatch(refused.stdout, /Size gate passed/)
    }
    write(root, "qwbe.config.json", JSON.stringify({ ...config, sizeFileRoots: ["missing"] }))
    const invalid = run()
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /Invalid size source root/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
