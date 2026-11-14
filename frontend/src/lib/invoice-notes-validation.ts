/**
 * Mirrors the server-side remark rules so the textarea can explain an invisible paste before submitting.
 * `maxLength` is the server's own limit (`GET /api/reference-data`).
 */
export const documentNotesIssue = (notes: string, maxLength: number): string | null => {
  if (/(?!\n)[\p{Cc}\p{Zl}\p{Zp}]/u.test(notes)) {
    return "Observațiile nu pot conține caractere de control; înlocuiește tab-urile cu spații."
  }
  return notes.trim().length > maxLength
    ? `Observațiile depășesc ${String(maxLength)} de caractere.`
    : null
}
