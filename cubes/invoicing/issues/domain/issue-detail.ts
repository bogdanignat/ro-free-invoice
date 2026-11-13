import { issueTemplates, type IssueCode } from "./issue-templates.ts"

export type IssueParams = Readonly<Record<string, string | number>>
export interface IssueDetail {
  readonly code: IssueCode
  readonly field?: string
  readonly params?: IssueParams
}

export const renderIssue = ({ code, field, params }: IssueDetail): string =>
  issueTemplates[code].replace(/\{(\w+)\}/gu, (_, name: string) => String(name === "field" ? field : params?.[name]))

export const issue = (code: IssueCode, field?: string, params?: IssueParams): IssueDetail =>
  ({ code, ...(field === undefined ? {} : { field }), ...(params === undefined ? {} : { params }) })
