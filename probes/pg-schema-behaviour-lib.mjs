/**
 * The rest of the behaviour matrix: the writes that must be accepted, the UPDATE OF
 * lists the triggers must carry, and the constraint invariants the triggers do not
 * cover. The trigger cases are in pg-schema-trigger-cases.mjs.
 */
import { invoiceWith } from "./pg-schema-rows.mjs"

// The shape CHECKs of a series, an idempotency fingerprint and the issuer branding, by value.
const insertSeries = "INSERT INTO document_series VALUES('org-1','invoice',$1)"
const insertFingerprint = `INSERT INTO idempotency_records(organization_id,idempotency_key,operation,fingerprint,
  result_kind,result_id,created_at) VALUES('org-1','vec','create_draft',$1,'invoice','invoice-1','t')`
const insertPaymentFingerprint = `INSERT INTO payment_idempotency_records(organization_id,idempotency_key,operation,
  fingerprint,result_id,created_at) VALUES('org-1','vec','record_payment',$1,'pay-1','t')`
const insertBranding = `INSERT INTO issuers(organization_id,legal_name,tax_identifier,country_code,city,street,county,
  default_currency,default_payment_term_days,branding,legal_form,trade_registry_number,iban,bank_name,social_capital)
  VALUES('org-json','X','1','RO','X','Y','RO-IS','RON',15,$1,'srl','J','I','B',100)`
const hex = "0123456789abcdef".repeat(4)
const shapes = [
  ["series", insertSeries, ["A1", "INV_2026", "A-1", "A", "1A", "A_"],
    ["a1", "_A1", "A/1", "A 1", "", "A".repeat(21), "Ă1"]],
  ...[["fingerprint", insertFingerprint], ["payment fingerprint", insertPaymentFingerprint]].map(([label, sql]) =>
    [label, sql, [`sha256:${hex}`],
      [`sha256:${hex.toUpperCase()}`, `sha256:${hex.slice(0, -1)}`, `sha256:${hex.slice(0, -1)}g`, `md5:${hex}`, hex, ""]]),
  ["branding JSON", insertBranding,
    ["{}", "{\"a\":1}", "{\"a\":{\"b\":[1,2,3]}}", "{\"a\":1,\"a\":2}", "[]", "[1,2,3]", "1", "-1.5e3", "\"a\"", "true",
      "null", "{\"a\":\"ăîșț\"}", "{\"a\":\"\\u0000\"}"],
    ["01", "", " ", "{a:1}", "{'a':1}", "[1,2,", "[1,2,]", "NaN", "{\"a\":1} x", "\uFEFF{\"a\":1}"]],
]
const shapeAccepted = shapes.flatMap(([label, sql, accepted]) =>
  accepted.map((value) => [`${label} ${JSON.stringify(value)}`, sql, [value]]))
const shapeRejected = shapes.flatMap(([label, sql, , rejected]) =>
  rejected.map((value) => [`${label} ${JSON.stringify(value)} is refused`, "23514", sql, [value]]))

/** Writes that must be accepted: the mutations the domain really performs, and the valid shapes. */
export const acceptedWrites = [
  ["issued invoice e-Factura status", "UPDATE issued_invoices SET e_factura_status='queued' WHERE id='invoice-1'"],
  ["correction e-Factura status", "UPDATE correction_documents SET e_factura_status='queued' WHERE id='corr-1'"],
  ["draft notes cleared", "UPDATE invoice_drafts SET notes=NULL WHERE id='draft-2'"],
  ["open draft moved to another invoice series", "UPDATE invoice_drafts SET series='ALT' WHERE id='draft-2'"],
  ["open draft supplied before its issue date", "UPDATE invoice_drafts SET supply_date='2026-08-15' WHERE id='draft-2'"],
  ["series archived", "UPDATE document_series SET archived=1 WHERE organization_id='org-1' AND series='INV'"],
  ["customer soft delete", "UPDATE customers SET deleted_at='2026-09-10' WHERE id='customer-1'"],
  ["sequence advance", "UPDATE invoice_sequences SET last_number=4 WHERE organization_id='org-1'"],
  ["e-Factura submission progress", "UPDATE efactura_submissions SET polls=1,updated_at='t' WHERE id='sub-3'"],
  ["received-invoice fetch progress", "UPDATE efactura_received_fetches SET downloaded=1,updated_at='t' WHERE id='fetch-1'"],
  ["session expiry refresh", "UPDATE browser_sessions SET expires_at=1759007200000 WHERE session_hash='s1'"],
  ...shapeAccepted,
]

/**
 * Triggers with an UPDATE OF list. A content guard covers every column of its table
 * except the ones named, so a column dropped from the list or a new unguarded column
 * shows up; the others guard exactly the columns named.
 */
export const updateOf = {
  allBut: {
    issued_invoices_no_update: ["actor_id", "e_factura_status", "sealed", "source_app", "source_kind", "source_id",
      "direct_source_proforma_id"],
    correction_documents_no_update: ["actor_id", "e_factura_status", "sealed"],
    proformas_no_content_update: ["actor_id", "sealed", "source_app", "source_kind", "source_id"],
  },
  only: {
    correction_documents_actor_no_update: ["actor_id"],
    issued_invoices_actor_no_update: ["actor_id"],
    proformas_actor_no_update: ["actor_id"],
    issued_invoices_seal_only: ["sealed"],
    correction_documents_seal_only: ["sealed"],
    proformas_seal_only: ["sealed"],
    issued_invoices_source_no_update: ["source_app", "source_kind", "source_id"],
    proformas_source_no_update: ["source_app", "source_kind", "source_id"],
    invoice_drafts_source_update: ["source_app", "source_kind", "source_id"],
    invoice_drafts_series_update: ["organization_id", "series"],
    invoice_drafts_bucharest_sector_update: ["customer_county", "customer_sector"],
    efactura_submissions_content_no_update: ["organization_id", "environment", "document_kind", "document_id", "standard",
      "cif", "buyer_is_individual", "xml", "xml_sha256", "xml_size", "created_by", "created_at"],
  },
}

/** Trigger rows ({ name, table, columns }) and the table columns -> every mismatch with `updateOf`, as text. */
export const updateOfDifferences = (rows, columnsOf) => {
  const sorted = (list) => [...list].sort()
  const expected = Object.fromEntries([
    ...Object.entries(updateOf.only).map(([name, columns]) => [name, sorted(columns)]),
    ...Object.entries(updateOf.allBut).map(([name, except]) => {
      const table = rows.find((row) => row.name === name)?.table
      return [name, sorted((columnsOf[table] ?? []).filter((column) => !except.includes(column)))]
    }),
  ])
  const live = Object.fromEntries(rows.filter((row) => row.columns.length > 0).map((row) => [row.name, sorted(row.columns)]))
  return [...new Set([...Object.keys(expected), ...Object.keys(live)])]
    .filter((name) => JSON.stringify(expected[name]) !== JSON.stringify(live[name]))
    .map((name) => `${name}: expected ${JSON.stringify(expected[name])}, live ${JSON.stringify(live[name])}`)
}

/**
 * Constraint invariants the triggers do not cover, with the SQLSTATE expected and,
 * where the case needs one, the bound parameters.
 */
export const constraintCases = [
  ["generated column is not writable", "428C9",
    "UPDATE issued_invoices SET direct_source_proforma_id='x' WHERE id='invoice-1'"],
  ["foreign key to an absent invoice", "23503",
    `INSERT INTO invoice_payments(id,invoice_id,organization_id,amount,currency,payment_date,method,actor_id,
     created_at) VALUES('pay-x','absent','org-1',100,'RON','2026-09-04','bank','operator','t')`],
  ["unique organization series number", "23505",
    `INSERT INTO document_series VALUES('org-1','invoice','INV')`],
  ["not null issuer legal name", "23502",
    `INSERT INTO customers(id,organization_id,legal_name,tax_identifier,country_code,city,street,county,
     party_type,vat_registered) VALUES('c-x','org-1',NULL,'1','RO','X','Y','RO-IS','company',0)`],
  ["check: individual cannot be VAT registered", "23514",
    `INSERT INTO customers(id,organization_id,legal_name,tax_identifier,country_code,city,street,county,
     party_type,vat_registered) VALUES('c-y','org-1','Ion','1','RO','X','Y','RO-IS','individual',1)`],
  ["check: sector outside Bucharest", "23514",
    `INSERT INTO customers(id,organization_id,legal_name,tax_identifier,country_code,city,street,county,
     sector,party_type,vat_registered) VALUES('c-z','org-1','X','1','RO','X','Y','RO-IS',1,'company',0)`],
  ["check: tax matrix rejects a mismatched rate", "23514",
    `INSERT INTO draft_lines(id,draft_id,line_position,description,quantity,unit_price,tax_code,tax_category,
     tax_rate,vat_exemption_reason,total_excluding_tax,tax_amount,total_including_tax,unit_code,unit_name)
     VALUES('dl-bad','draft-2',9,'Servicii','1.00',10000,'RO_STANDARD','S','5.00',NULL,10000,500,
     10500,'C62','unitate')`],
  // T-2679: the supply date is never after the issue date (2026-09-01 here).
  ["check: draft supply date after its issue date", "23514",
    "UPDATE invoice_drafts SET supply_date='2026-09-02' WHERE id='draft-2'"],
  ["check: issued supply date after its issue date", "23514",
    invoiceWith("inv-late-supply", 6, { supplyDate: "'2026-09-02'" })],
  ["check: a series is archived or not", "23514",
    "UPDATE document_series SET archived=2 WHERE organization_id='org-1' AND series='ALT'"],
  ["check: product unit price is non-negative", "23514",
    `INSERT INTO product_presets(id,organization_id,code,kind,description,unit_price,unit_code,unit_name)
     VALUES('preset-neg','org-1','NEG','goods','X',-1,'C62','unitate')`],
  // T-1904: money is BIGINT in bani; a decimal string bound as text never reaches the column.
  ["a decimal unit price bound as text is refused", "22P02",
    `INSERT INTO product_presets(id,organization_id,code,kind,description,unit_price,unit_code,unit_name)
     VALUES('preset-text','org-1','TEXT','goods','X',$1,'C62','unitate')`, ["1.00"]],
  ["check: artifact byte length must be positive", "23514",
    `INSERT INTO invoice_artifacts(invoice_id,organization_id,object_key,sha256,byte_length,media_type,
     template_version,generated_at) VALUES('invoice-3','org-1','k/9','x',0,'application/pdf','v1','t')`],
  ...shapeRejected,
]
