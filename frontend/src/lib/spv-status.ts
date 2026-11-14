import { literal, nullableText, object, text, type JsonObject } from "./model-decoder.ts"

const spvStates = ["not_sent", "in_progress", "accepted", "failed", "unknown"] as const
const spvUrgencies = ["overdue", "imminent", "ok"] as const

export type SpvState = (typeof spvStates)[number]
export type SpvUrgency = (typeof spvUrgencies)[number]

/**
 * A document's SPV standing as the register's API computes it: the group of its
 * current submission, the operational deadline (not the exact legal one) and,
 * only while something is left to resolve, how close that deadline is.
 */
export interface SpvStatus {
  readonly state: SpvState
  readonly deadline: string
  readonly urgency: SpvUrgency | null
}

/** `null` is an installation without the e-Factura plugin. */
export const decodeSpv = (input: unknown): SpvStatus | null => {
  if (input === null) return null
  const value: JsonObject = object(input)
  const urgency = nullableText(value.urgency, "spv.urgency")
  return {
    state: literal(spvStates, value.state, "spv.state"),
    deadline: text(value.deadline, "spv.deadline"),
    urgency: urgency === null ? null : literal(spvUrgencies, urgency, "spv.urgency"),
  }
}

const labels: Readonly<Record<SpvState, string>> = {
  not_sent: "Netrimisă", in_progress: "În curs", accepted: "Acceptată", failed: "Respinsă", unknown: "Neclar",
}

export const spvLabel = (spv: SpvStatus | null): string => spv === null ? "—" : labels[spv.state]

export interface SpvDeadlineNote {
  readonly text: string
  /** `ok` reads quietly; `imminent` and `overdue` need a person. */
  readonly urgency: SpvUrgency
}

const noteText: Readonly<Record<SpvUrgency, string>> = { overdue: "Termen depășit", imminent: "Expiră", ok: "Termen" }

/** The deadline, shown only while the document is still to resolve, with how close it is. */
export const spvDeadlineNote = (spv: SpvStatus | null): SpvDeadlineNote | null => {
  if (spv === null || spv.urgency === null) return null
  return {
    text: `${noteText[spv.urgency]} SPV: ${spv.deadline}`,
    urgency: spv.urgency,
  }
}
