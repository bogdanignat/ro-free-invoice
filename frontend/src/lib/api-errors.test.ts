import assert from "node:assert/strict"
import test from "node:test"

import { ApiFailure, INVALID_INPUT_MESSAGE, isTransientFailure, parseApiFailure } from "./api-errors.ts"

void test("preserves the established session error messages", () => {
  assert.equal(parseApiFailure({ error: "invalid_credentials" }, 401).message, "Tokenul API este incorect.")
  assert.equal(parseApiFailure({ error: "origin_not_allowed" }, 403).message, "Originea cererii de autentificare nu este permisă.")
  assert.equal(parseApiFailure({ error: "csrf_validation_failed" }, 403).message,
    "Sesiunea nu a putut valida cererea. Reîncarcă pagina și încearcă din nou.")
  assert.equal(parseApiFailure({ error: "upstream_unavailable" }, 502).message, "Serviciul API nu este disponibil momentan.")
  assert.equal(parseApiFailure({ error: "not_ready" }, 503).message, "Serviciul API nu este pregătit momentan.")
  assert.match(parseApiFailure({ error: "invalid_session_cookie" }, 400).message, /Șterge cookie-ul de sesiune/)
})

// The fiscal API answers a missing document with the bare tag; an unlocalized
// map leaks `ResourceNotFound` onto the screen, which is what it used to do.
void test("a missing document reads as a sentence, not as the backend tag", () => {
  const failure = parseApiFailure({ error: "ResourceNotFound" }, 404)
  assert.equal(failure.message, "Documentul cerut nu există sau nu mai este disponibil.")
  assert.equal(failure.status, 404)
  assert.equal(failure.message.includes("ResourceNotFound"), false)
  assert.equal(parseApiFailure({ error: "DocumentNotFound" }, 404).message,
    "Documentul cerut nu există sau nu mai este disponibil.")
})

void test("the document failures reachable from these screens are all localized", () => {
  for (const [tag, status] of [
    ["PermissionDenied", 403], ["DocumentsPermissionDenied", 403], ["ArtifactConflict", 409],
    ["DocumentRenderingFailure", 500], ["DocumentPersistenceFailure", 500], ["PersistenceFailure", 500],
    ["internal_failure", 500],
  ] as ReadonlyArray<readonly [string, number]>) {
    assert.equal(parseApiFailure({ error: tag }, status).message.includes(tag), false, tag)
  }
})

void test("a transport failure with no status still carries its own message", () => {
  assert.equal(parseApiFailure(undefined, 502).message, "Cererea a eșuat (502).")
})

void test("only a failure a repeat could answer differently is offered a retry", () => {
  assert.equal(isTransientFailure(new ApiFailure({ message: "offline" })), true)
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 429 })), true)
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 500 })), true)
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 503 })), true)
  assert.equal(isTransientFailure(parseApiFailure({ error: "ResourceNotFound" }, 404)), false)
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 403 })), false)
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 409 })), false)
  // A 401 is the session controller's business, not a button's.
  assert.equal(isTransientFailure(new ApiFailure({ message: "x", status: 401 })), false)
  assert.equal(isTransientFailure(new Error("decoder refused the payload")), false)
})

void test("a domain conflict is read as Romanian, not as the bare `DomainConflict` tag", () => {
  // The 409 body is `{ error: 'DomainConflict', code }` with no `message`
  // (kernel/api/schema-errors-session.ts:25).
  const conflicts = [
    "idempotency_key_reused", "draft_creation_result_deleted",
    "invoice_already_issued", "derived_draft_cannot_be_deleted",
    // The conversion answer carries an English `message` as well, so this one
    // also proves the code wins over it (cubes/invoicing/issuance/application/
    // proforma-conversion-context.ts:13).
    "proforma_already_converted",
    // Every conflict the master-data writes can answer with: the business one
    // on a customer delete, and the store conflicts behind the six writes
    // (kernel/storage/sqlite-customers.ts, sqlite-catalog.ts, sqlite-rows.ts).
    "customer_has_open_drafts", "customer_not_found", "customer_id_taken",
    "product_preset_id_taken", "persistence_conflict",
    // A reversal of a payment another session already reversed.
    "payment_already_reversed",
    // A second full storno: the answer carries an English `message` the code must win over.
    "invoice_already_corrected",
  ]
  for (const code of conflicts) {
    const failure = parseApiFailure({ error: "DomainConflict", code }, 409)
    assert.equal(failure.code, code, code)
    assert.equal(failure.status, 409, code)
    assert.equal(failure.message.includes("DomainConflict"), false, code)
    assert.equal(failure.message.includes(code), false, code)
    assert.ok(failure.message.length > 20, code)
  }
})

void test("a spent idempotency key names the registry as the next step", () => {
  const failure = parseApiFailure({ error: "DomainConflict", code: "idempotency_key_reused" }, 409)
  assert.match(failure.message, /registrul de facturi/)
})

// The only conflict a user can reach by ordinary use of the customer registry:
// deleting a party an unsent draft still refers to. It names the draft as the
// thing to deal with, since no repeat of the delete can succeed on its own.
void test("a customer held by an open draft says what blocks the deletion", () => {
  const failure = parseApiFailure({ error: "DomainConflict", code: "customer_has_open_drafts" }, 409)
  assert.match(failure.message, /draft/)
  assert.equal(isTransientFailure(failure), false)
})

void test("a second storno reads as a conflict with the existing storno", () => {
  const failure = parseApiFailure({
    error: "DomainConflict", code: "invoice_already_corrected", message: "An invoice can have only one full correction document",
  }, 409)
  assert.equal(failure.message, "Factura are deja un document storno integral.")
})

void test("a taken article code shows the server's sentence, which names the code", () => {
  const failure = parseApiFailure({ error: "DomainConflict", code: "product_preset_code_taken", message: "Codul SRB-M6 e deja folosit." }, 409)
  assert.equal(failure.message, "Codul SRB-M6 e deja folosit.")
  assert.equal(failure.code, "product_preset_code_taken")
})

void test("a coded validation issue reads in Romanian with its field label and parameters", () => {
  const failure = parseApiFailure({ error: "ValidationFailure", issues: ["description must be at most 100 characters"],
    details: [{ code: "too_long", field: "description", params: { maximum: 100 } }] }, 400)
  assert.equal(failure.message, "Câmpul „descrierea” este prea lung (maxim 100, în caractere).")
  assert.deepEqual(failure.issues, ["description must be at most 100 characters"])
  const unknownField = parseApiFailure({ error: "ValidationFailure", issues: ["x"], details: [{ code: "required", field: "address.unknown" }] }, 400)
  assert.equal(unknownField.message, "Câmpul „address.unknown” este obligatoriu.")
})

void test("a payment amount, a storno reason and a future issue date read in Romanian", () => {
  const read = (code: string, field?: string) => parseApiFailure({ error: "ValidationFailure", issues: ["x"], details: [{ code, field }] }, 400).message
  assert.equal(read("amount_invalid", "amount"), "Câmpul „suma” trebuie să fie o sumă pozitivă cu cel mult două zecimale.")
  assert.equal(read("required", "reason"), "Câmpul „motivul” este obligatoriu.")
  assert.equal(read("empty_when_provided", "note"), "Câmpul „nota” nu poate fi gol când este trimis.")
  assert.equal(read("issue_date_future", "issueDate"), "Data emiterii nu poate fi în viitor.")
})

void test("a supply after the issue and a VAT regime missing on the supply date read in Romanian", () => {
  const read = (details: unknown) => parseApiFailure({ error: "ValidationFailure", issues: ["x"], details }, 400).message
  assert.equal(read([{ code: "supply_date_after_issue", field: "supplyDate" }]), "Data livrării nu poate fi după data emiterii.")
  assert.equal(read([{ code: "date_invalid", field: "supplyDate" }]).includes("data livrării"), true)
  assert.match(read([{ code: "vat_registration_missing", params: { date: "2025-07-20" } }]), /2025-07-20.*Setări/u)
})

void test("the failure keeps the field of the detail its message was read from", () => {
  const read = (details: unknown) => parseApiFailure({ error: "ValidationFailure", issues: ["x"], details }, 400).field
  assert.equal(read([{ code: "not_a_code", field: "notes" }, { code: "supply_date_after_issue", field: "supplyDate" }]), "supplyDate")
  assert.equal(read([{ code: "vat_registration_missing", params: { date: "2025-07-20" } }]), undefined)
  assert.equal(read([{ code: "not_a_code", field: "supplyDate" }]), undefined)
  assert.equal(parseApiFailure({ error: "DomainConflict", code: "x", message: "m", details: [{ code: "required", field: "supplyDate" }] }, 409).field, undefined)
})

void test("the first known code wins, and a refusal with none known reads the generic Romanian text, never the English", () => {
  const issues = ["first", "second"]
  assert.equal(parseApiFailure({ error: "ValidationFailure", issues, details: [{ code: "not_a_code" }, { code: "quantity_zero", field: "quantity" }] }, 400).message,
    "Cantitatea trebuie să fie mai mare decât zero.")
  assert.equal(parseApiFailure({ error: "ValidationFailure", issues, details: [{ code: "not_a_code" }, { code: "not_a_code" }] }, 400).message, INVALID_INPUT_MESSAGE)
  assert.equal(parseApiFailure({ error: "ValidationFailure", issues }, 400).message, INVALID_INPUT_MESSAGE)
  // A decoding refusal at the root names no field, so it reads the generic text too.
  assert.equal(parseApiFailure({ error: "ValidationFailure", issues, details: [{ code: "invalid_input" }] }, 400).message, INVALID_INPUT_MESSAGE)
})

void test("the codes of the parties, the issuer, company lookup and e-Factura read in Romanian", () => {
  const read = (details: unknown) => parseApiFailure({ error: "ValidationFailure", issues: ["x"], details }, 400).message
  assert.equal(read([{ code: "too_long", field: "name", params: { maximum: 200 } }]), "Câmpul „denumirea” este prea lung (maxim 200, în caractere).")
  assert.equal(read([{ code: "company_cui_required", field: "fiscalIdentifier" }]), "CUI-ul este obligatoriu pentru o firmă.")
  assert.equal(read([{ code: "iban_checksum", field: "iban" }]), "IBAN-ul nu este valid: cifrele de control nu se potrivesc.")
  assert.match(read([{ code: "vat_catalogue_not_covered", field: "vatChange.effectiveFrom", params: { date: "2020-01-01" } }]), /cotele de TVA de la data 2020-01-01/u)
  assert.match(read([{ code: "cui_too_short", field: "cui", params: { minimum: 4 } }]), /cel puțin 4 cifre/u)
  assert.equal(read([{ code: "invalid_input", field: "address.city" }]), "Câmpul „localitatea” nu are o valoare validă.")
  assert.equal(read([{ code: "efactura_rule", params: { rule: "BR-RO-010", text: "id must contain at least one digit" } }]),
    "Factura nu respectă regula e-Factura BR-RO-010. Verifică datele facturii și ale părților.")
  assert.equal(read([{ code: "efactura_contract", params: { text: "UBL root is missing" } }]),
    "Factura nu poate fi generată pentru e-Factura: datele nu respectă specificația CIUS-RO.")
  assert.equal(read([{ code: "currency_not_ron", field: "defaultCurrency" }]), "Câmpul „moneda implicită” trebuie să fie RON.")
  assert.equal(read([{ code: "invalid_input", field: "uploadIndex" }]), "Câmpul „indexul de încărcare” nu are o valoare validă.")
})

void test("a decoding refusal on a path the forms do not name reads the generic Romanian text, not the raw path", () => {
  const issues = ["lines.0.quantity: Expected string"]
  for (const field of ["lines.0.quantity", "constructor"]) {
    const failure = parseApiFailure({ error: "ValidationFailure", issues, details: [{ code: "invalid_input", field }] }, 400)
    assert.deepEqual([failure.message, failure.field], [INVALID_INPUT_MESSAGE, undefined], field)
  }
})

void test("a malformed details is ignored: the generic Romanian text shows, never the English issue", () => {
  const issues = ["english"]
  for (const details of ["too_long", 7, null, {}, [null], [7], [{}], [{ code: 3 }], [{ code: "constructor" }], [{ code: "__proto__" }],
    [{ code: "too_long", field: "description" }], [{ code: "too_long", field: "description", params: { maximum: {} } }],
    [{ code: "too_long", field: 4, params: { maximum: 1 } }], [{ code: "too_long", params: "x" }]]) {
    assert.equal(parseApiFailure({ error: "ValidationFailure", issues, details }, 400).message, INVALID_INPUT_MESSAGE, JSON.stringify(details))
  }
})
