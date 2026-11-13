/**
 * Romanian text of the coded validation issues (`cubes/invoicing/issues`), keyed by code. Every code of the
 * cube has one (probes/frontend-cube-parity.test.mjs); `unclassified` has none, so the English `issues[0]` shows.
 */
export const issueMessages: Readonly<Record<string, string>> = {
  invalid_vat_tuple: "Combinația de TVA aleasă nu este validă.",
  date_format: "Câmpul „{field}” trebuie să fie o dată calendaristică în formatul AAAA-LL-ZZ.",
  date_yyyy_mm_dd: "Câmpul „{field}” trebuie să fie o dată în formatul AAAA-LL-ZZ.",
  date_invalid: "Câmpul „{field}” nu este o dată calendaristică validă.",
  document_type_invalid: "Tipul documentului trebuie să fie factură sau proformă.",
  series_invalid: "Seria este invalidă: folosește litere mari, cifre, „_” sau „-”, cel mult 20 de caractere.",
  required: "Câmpul „{field}” este obligatoriu.",
  surrounding_whitespace: "Câmpul „{field}” nu poate începe sau se termina cu spații.",
  too_long: "Câmpul „{field}” este prea lung (maxim {maximum}, în caractere).",
  control_characters: "Câmpul „{field}” conține caractere de control, care nu sunt permise.",
  decimal_syntax: "Câmpul „{field}” trebuie să fie un număr zecimal, zero sau pozitiv.",
  decimal_places: "Câmpul „{field}” poate avea cel mult {scale} zecimale.",
  quantity_zero: "Cantitatea trebuie să fie mai mare decât zero.",
  line_totals_inconsistent: "Totalurile liniei nu sunt consistente.",
  vat_group_inconsistent: "Grupul de TVA {group} conține linii cu cod sau motiv de scutire diferit.",
  document_without_lines: "Documentul trebuie să conțină cel puțin o linie.",
  document_totals_inconsistent: "Totalurile documentului nu sunt consistente.",
  lines_required: "Documentul trebuie să conțină cel puțin o linie.",
  customer_choice: "Alege fie un client salvat, fie datele unui client nou, nu ambele.",
  currency_not_ron: "Moneda documentului trebuie să fie RON.",
  due_date_before_issue: "Data scadenței nu poate fi înainte de data emiterii.",
  due_date_required: "Data scadenței este obligatorie pentru o factură cu sumă de plată pozitivă.",
  issue_date_future: "Data emiterii nu poate fi în viitor.",
  issue_date_before_last: "Data emiterii nu poate fi înainte de {latest}, data ultimului document emis în seria {series}.",
  issue_date_before_original: "Data emiterii nu poate fi înainte de data facturii stornate.",
  vat_registration_missing: "Emitentul nu are înregistrarea de TVA configurată la data {date}.",
  vat_registration_changed: "Înregistrarea de TVA a emitentului s-a schimbat de la emiterea proformei.",
  vat_pair_unsupported: "Cota de TVA {rate} ({code}) nu este acceptată la data {date}.",
  vat_pair_needs_non_vat: "Cota de TVA {rate} ({code}) cere un emitent neplătitor de TVA la data {date}.",
  vat_pair_needs_vat: "Cota de TVA {rate} ({code}) cere un emitent plătitor de TVA la data {date}.",
  range_inverted: "Data de început nu poate fi după data de sfârșit.",
  period_too_long: "Perioada poate acoperi cel mult {maximum} de luni calendaristice.",
  kind_invalid: "Tipul trebuie să fie factură sau storno.",
  spv_invalid: "Filtrul SPV acceptă doar valoarea „nerezolvate”.",
  cursor_invalid: "Cursorul de paginare nu este valid.",
  limit_out_of_range: "Limita trebuie să fie un număr întreg între 1 și {maximum}.",
  amount_invalid: "Câmpul „{field}” trebuie să fie o sumă pozitivă cu cel mult două zecimale.",
  amount_not_positive: "Câmpul „{field}” trebuie să fie mai mare decât zero.",
  currency_invalid: "Moneda trebuie să fie un cod ISO 4217 din trei litere mari.",
  currency_mismatch: "Moneda plății trebuie să fie aceeași cu a facturii.",
  empty_when_provided: "Câmpul „{field}” nu poate fi gol când este trimis.",
  idempotency_key_invalid: "Cheia de idempotență nu este validă.",
  idempotency_fingerprint_invalid: "Amprenta cererii nu este validă.",
}

/** A field the codes above can name; one not listed is shown as the server wrote it. */
export const fieldLabels: Readonly<Record<string, string>> = {
  issueDate: "data emiterii",
  dueDate: "data scadenței",
  paymentDate: "data plății",
  "vatChange.effectiveFrom": "data intrării în vigoare a regimului de TVA",
  description: "descrierea",
  quantity: "cantitatea",
  unitPrice: "prețul unitar",
  vatRate: "cota de TVA",
  money: "suma",
  amount: "suma",
  customerId: "clientul",
  originalInvoiceId: "factura originală",
  invoiceId: "factura",
  paymentId: "plata",
  reason: "motivul",
  method: "metoda de plată",
  externalReference: "referința externă",
  note: "nota",
  name: "denumirea",
  "address.street": "strada și numărul",
  "address.city": "localitatea",
  "address.postalCode": "codul poștal",
  from: "data de început",
  to: "data de sfârșit",
  notes: "observațiile",
  "source.app": "aplicația sursă",
  "source.kind": "tipul sursei",
  "source.id": "identificatorul sursei",
  q: "căutarea",
}

const own = (table: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = Object.hasOwn(table, key) ? table[key] : undefined
  return typeof value === "string" ? value : undefined
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The Romanian sentence of one wire detail, or undefined when its code, field or parameters are not what the table expects. */
const detailMessage = (detail: unknown): string | undefined => {
  if (!isRecord(detail) || typeof detail.code !== "string") return undefined
  const template = own(issueMessages, detail.code)
  if (template === undefined) return undefined
  const params = isRecord(detail.params) ? detail.params : {}
  const missing: Array<string> = []
  const text = template.replace(/\{(\w+)\}/gu, (_, name: string) => {
    const value = name === "field" ? detail.field : Object.hasOwn(params, name) ? params[name] : undefined
    if (typeof value === "number" && name !== "field") return String(value)
    if (typeof value !== "string") { missing.push(name); return "" }
    return name === "field" ? own(fieldLabels, value) ?? value : value
  })
  return missing.length === 0 ? text : undefined
}

/** The first detail the table can say in Romanian; `details` is untrusted input, so anything else is skipped. */
export const localizedIssue = (details: unknown): string | undefined =>
  Array.isArray(details) ? details.map(detailMessage).find((message) => message !== undefined) : undefined
