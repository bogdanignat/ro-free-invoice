import { useState } from "react"

import {
  placeSupplyDateError, trackSupplyDateRefusal, type SuppliedDates, type SupplyDateRefusal,
} from "../lib/supply-date.ts"

/** The screen's failure split between the page alert and the supply date field. */
export const useSupplyDateRefusal = (error: unknown, issue: string | null, dates: SuppliedDates) => {
  const [refusal, setRefusal] = useState<SupplyDateRefusal>({ error, dates })
  const current = trackSupplyDateRefusal(refusal, error, dates)
  // Adjusting state while rendering: a new failure records the dates it arrived with.
  if (current !== refusal) setRefusal(current)
  return placeSupplyDateError(current, issue, dates)
}
