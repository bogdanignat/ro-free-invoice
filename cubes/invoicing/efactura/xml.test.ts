import assert from "node:assert/strict"
import test from "node:test"

import { EFacturaContractViolation } from "./contracts/failures.ts"
import { element, optional, renderXmlDocument, text, type XmlElement } from "./xml.ts"

const violation = (root: XmlElement): ReadonlyArray<string> => {
  try {
    renderXmlDocument(root)
  } catch (error) {
    assert.ok(error instanceof EFacturaContractViolation)
    return error.issues
  }
  return assert.fail("expected the renderer to refuse the document")
}

void test("renders a declaration, nests children and closes every element", () => {
  const xml = renderXmlDocument(element("Invoice", [
    text("cbc:ID", "RFI 1"),
    element("cac:Party", [text("cbc:Name", "Acme")]),
  ]))
  assert.equal(xml, `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <cbc:ID>RFI 1</cbc:ID>
  <cac:Party>
    <cbc:Name>Acme</cbc:Name>
  </cac:Party>
</Invoice>
`)
})

void test("escapes text and attributes so business content cannot alter the markup", () => {
  const xml = renderXmlDocument(element("Invoice", [
    text("cbc:Note", "Servicii <consultanță> & \"altele\" ]]>"),
    text("cbc:InvoicedQuantity", "1", [["unitCode", "H87"], ["listID", "a\"b<c&d"]]),
  ]))
  assert.match(xml, /<cbc:Note>Servicii &lt;consultanță&gt; &amp; "altele" \]\]&gt;<\/cbc:Note>/u)
  assert.match(xml, /listID="a&quot;b&lt;c&amp;d"/u)
  assert.ok(!xml.includes("]]>"))
})

void test("escapes attribute whitespace, which XML parsers would otherwise normalize to spaces", () => {
  const xml = renderXmlDocument(text("cbc:ID", "x", [["schemeID", "a\tb\nc"]]))
  assert.match(xml, /schemeID="a&#9;b&#10;c"/u)
})

void test("escapes a carriage return in text, which parsing would otherwise turn into a line feed", () => {
  // XML 1.0 line-ending normalization rewrites CR and CRLF to LF before any
  // application sees them, so a literal CR would not be the text we issued.
  const xml = renderXmlDocument(text("cbc:Note", "prima linie\r\na doua"))
  assert.match(xml, /<cbc:Note>prima linie&#13;\na doua<\/cbc:Note>/u)
  assert.ok(!xml.includes("linie\r"))
})

void test("refuses characters XML 1.0 cannot represent instead of dropping them", () => {
  assert.deepEqual(violation(text("cbc:Note", "bad\u0000value")),
    ["/cbc:Note text contains a character that XML 1.0 cannot represent (U+0000)"])
  assert.deepEqual(violation(text("cbc:Note", "bell\u0007")),
    ["/cbc:Note text contains a character that XML 1.0 cannot represent (U+0007)"])
  assert.deepEqual(violation(text("cbc:Note", "lone\ud800surrogate")),
    ["/cbc:Note text contains a character that XML 1.0 cannot represent (U+D800)"])
  assert.equal(violation(text("cbc:Note", "noncharacter￾")).length, 1)
})

void test("keeps the characters Romanian invoices legitimately contain", () => {
  const xml = renderXmlDocument(text("cbc:Note", "Șoseaua Știrbei Vodă — ăâîșț 😀\ttab"))
  assert.match(xml, /Șoseaua Știrbei Vodă — ăâîșț 😀\ttab/u)
})

void test("reports every offending field at once, with its path", () => {
  const issues = violation(element("Invoice", [
    element("cac:Party", [text("cbc:Name", "ab")]),
    text("cbc:ID", "ok", [["bad name", "v"]]),
  ]))
  assert.deepEqual(issues, [
    "/Invoice/cac:Party/cbc:Name text contains a character that XML 1.0 cannot represent (U+0001)",
    "/Invoice/cbc:ID@bad name is not a valid XML attribute name",
  ])
})

void test("rejects element names that are not valid XML names", () => {
  assert.deepEqual(violation(text("1cbc:ID", "x")), ["/1cbc:ID is not a valid XML element name"])
  assert.deepEqual(violation(text("cbc:ID<script>", "x")), ["/cbc:ID<script> is not a valid XML element name"])
})

void test("rejects mixed content, which EN 16931 never uses", () => {
  assert.deepEqual(violation({ name: "cac:Party", text: "stray", children: [text("cbc:Name", "Acme")] }),
    ["/cac:Party has both text and child elements, which EN 16931 never uses"])
})

void test("renders an element with no content as self-closing", () => {
  assert.match(renderXmlDocument(element("cac:Delivery", [])), /<cac:Delivery\/>/u)
})

void test("omits optional elements that carry no value rather than emitting them empty", () => {
  assert.deepEqual(optional("cbc:PostalZone", null), [])
  assert.deepEqual(optional("cbc:PostalZone", undefined), [])
  assert.deepEqual(optional("cbc:PostalZone", "   "), [])
  assert.deepEqual(optional("cbc:PostalZone", "400001"), [{ name: "cbc:PostalZone", text: "400001" }])
  assert.deepEqual(optional("cbc:CompanyID", "RO1", [["schemeID", "9948"]]),
    [{ name: "cbc:CompanyID", text: "RO1", attributes: [["schemeID", "9948"]] }])
})

void test("renders the same bytes for the same document", () => {
  const build = (): XmlElement => element("Invoice", [text("cbc:ID", "RFI 1"), text("cbc:IssueDate", "2026-09-17")])
  assert.equal(renderXmlDocument(build()), renderXmlDocument(build()))
})
