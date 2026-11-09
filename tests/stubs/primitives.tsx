/**
 * Minimal stand-in for `@deepseek-ai/dsh-client-ui-primitives` in component
 * specs.
 *
 * The real barrel pulls the whole markdown stack, whose syntax-highlighter and
 * KaTeX assets are not installed in the source checkout. These specs exercise
 * this plugin's own page logic, so a plain control surface is enough.
 */

import { forwardRef, useId } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

/** Props this plugin passes to {@link Button}. */
interface ButtonProps {
  readonly variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
  readonly size?: 'md' | 'sm'
  readonly disabled?: boolean
  readonly onClick?: () => void
  readonly children?: ReactNode
  readonly className?: string
  readonly 'aria-label'?: string
}

/** A plain button preserving the real props that matter to callers. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={props.className}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
})

/** Props this plugin passes to {@link Input}. */
interface InputProps {
  readonly id?: string
  readonly className?: string
  readonly placeholder?: string
  readonly value?: string
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  readonly disabled?: boolean
}

/** A plain text input preserving the real props that matter to callers. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const generated = useId()
  return (
    <input
      ref={ref}
      type="text"
      id={props.id ?? generated}
      className={props.className}
      placeholder={props.placeholder}
      value={props.value}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  )
})
