import type { ComponentPropsWithRef } from "react"

import { FOCUS_RING } from "./control.ts"
import { cx } from "./cx.ts"

export type ButtonVariant = "primary" | "secondary" | "danger"
export type ButtonSize = "md" | "sm"

interface ButtonLook {
  readonly variant?: ButtonVariant | undefined
  readonly size?: ButtonSize | undefined
  readonly fullWidth?: boolean | undefined
}

// Colours live only in the variants: two utilities for one property in the same list would be decided by Tailwind's order, not ours.
const BASE = "border rounded-invoice-control cursor-pointer font-invoice-label no-underline"
  + " disabled:cursor-not-allowed disabled:opacity-45 " + FOCUS_RING

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "text-invoice-on-primary bg-invoice-primary border-transparent hover:bg-invoice-primary-hover",
  secondary: "text-invoice-ink bg-invoice-secondary-surface border-invoice-secondary-border hover:bg-invoice-primary-soft",
  danger: "text-invoice-danger-text bg-invoice-danger-soft border-invoice-danger hover:bg-invoice-storno-surface",
}

const SIZES: Readonly<Record<ButtonSize, string>> = {
  md: "min-h-[2.55rem] px-4 py-[.65rem]",
  sm: "min-h-[2.1rem] px-[.7rem] py-[.35rem] text-[.82rem]",
}

/** The button look, for a link that leads somewhere but reads as an action. */
export const buttonClass = ({ variant = "primary", size = "md", fullWidth = false }: ButtonLook = {}): string =>
  cx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full")

type ButtonProps = ComponentPropsWithRef<"button"> & ButtonLook

/** `className` is for the layout around the button, never for its look. */
export const Button = ({ variant, size, fullWidth, className, type = "button", ...props }: ButtonProps) =>
  <button {...props} className={cx(buttonClass({ variant, size, fullWidth }), className)} type={type} />
