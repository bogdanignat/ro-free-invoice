import assert from "node:assert/strict"
import test from "node:test"

import {
  DomainConflict,
  PermissionDenied,
  validationFailure,
  invoicingPermissions,
} from "./index.ts"
import { required } from "../issues/index.ts"

void test("materializes permission names from the cube identity", () => {
  assert.deepEqual(invoicingPermissions("invoicing"), {
    read: "invoicing:read",
    manageCustomers: "invoicing:customer.manage",
    draftInvoices: "invoicing:invoice.draft",
    issueInvoices: "invoicing:invoice.issue",
    issueProformas: "invoicing:proforma.issue",
    voidInvoices: "invoicing:invoice.void",
    manageSettings: "invoicing:settings.manage",
  })
})

void test("exposes failures as discriminated values", () => {
  const failures = [
    new PermissionDenied({ permission: "invoicing:invoice.issue" }),
    validationFailure([required("customer")]),
    new DomainConflict({ code: "invoice_number_taken", message: "Invoice number is already allocated" }),
  ]

  assert.deepEqual(failures.map((failure) => failure._tag), [
    "PermissionDenied",
    "ValidationFailure",
    "DomainConflict",
  ])
})
