import { Fieldset } from "./Fieldset.tsx"

export interface SegmentChoice<Value extends string> {
  readonly value: Value
  readonly label: string
  readonly disabled?: boolean
}

// One choice as a pill; the checked one takes the primary tint.
const PILL = "flex gap-[.4rem] items-center px-[.8rem] py-[.45rem] border border-invoice-control-border rounded-invoice-control"
  + " text-[.85rem] font-semibold cursor-pointer has-checked:border-invoice-primary has-checked:bg-invoice-primary-soft"

/** Mutually exclusive choices as radio pills under a legend; `className` is the layout of the group. */
export const SegmentedControl = <Value extends string>({ legend, name, choices, value, className, onChange }: {
  readonly legend: string
  readonly name: string
  readonly choices: ReadonlyArray<SegmentChoice<Value>>
  readonly value: Value
  readonly className?: string | undefined
  readonly onChange: (value: Value) => void
}) => <Fieldset legend={legend} className={className}>
  <div className="flex flex-wrap gap-[.4rem]">
    {choices.map((choice) => <label key={choice.value} className={PILL}>
      <input className="w-auto min-h-0" type="radio" name={name} value={choice.value} checked={value === choice.value}
        disabled={choice.disabled} onChange={() => { onChange(choice.value) }} />
      <span>{choice.label}</span>
    </label>)}
  </div>
</Fieldset>
