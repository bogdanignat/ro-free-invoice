import { useId } from "react"

export interface Choice<Value extends string> {
  readonly value: Value
  readonly label: string
}

interface ChoiceGroupProps<Value extends string> {
  readonly legend: string
  readonly choices: ReadonlyArray<Choice<Value>>
  readonly value: Value
  readonly onChange: (value: Value) => void
}

/**
 * Mutually exclusive filter options as a radio group, not a select: each one is
 * reachable with one key press and the group is announced under its legend.
 */
export const ChoiceGroup = <Value extends string>({ legend, choices, value, onChange }: ChoiceGroupProps<Value>) => {
  const name = useId()
  return <fieldset className="flex flex-wrap gap-x-[.9rem] gap-y-1 items-center m-0 p-0 border-0">
    <legend className="float-left pr-[.6rem] text-invoice-label text-invoice-field font-invoice-label">{legend}</legend>
    {choices.map((choice) => <label key={choice.value} className="flex gap-[.35rem] items-center text-[.88rem] font-invoice-subtle">
      <input className="w-auto min-h-0" type="radio" name={name} value={choice.value} checked={value === choice.value}
        onChange={() => { onChange(choice.value) }} />
      {choice.label}
    </label>)}
  </fieldset>
}
