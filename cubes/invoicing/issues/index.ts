const identity = "issues"

export const cube = {
  manifest: {
    name: identity,
    parent: "invoicing",
    summary: "Machine-readable validation issues: a closed code catalogue, its English templates and the constructors the domain uses",
    required: true,
    tables: [],
    requiresAuth: true,
    permissions: [],
  },
  create: () => ({ handlers: {} }),
}

export * from "./domain/document-issues.ts"
export * from "./domain/catalog-issues.ts"
export * from "./domain/field-issues.ts"
export * from "./domain/party-issues.ts"
export * from "./domain/request-issues.ts"
export { renderIssue } from "./domain/issue-detail.ts"
export type { IssueDetail, IssueParams } from "./domain/issue-detail.ts"
export * from "./domain/issue-templates.ts"
