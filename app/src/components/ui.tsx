import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarBlank, CaretDown, Check } from '@phosphor-icons/react'
import { formatIsoDate } from '@shared'
import { useT } from '@/i18n'

/* Buttons: 16px radius, tactile press, WCAG-checked label contrast. */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'whatsapp'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition-transform duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-muted hover:text-ink',
  whatsapp: 'bg-[#25D366] text-[#06301b] hover:bg-[#1fb959]',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={`${buttonBase} ${buttonVariants[variant]} ${className}`} />
}

/* Form controls: label above input, visible focus ring, AA contrast. */
const controlCls =
  'mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlCls} ${className}`} />
}

export function PhoneInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mt-2 flex w-full items-center rounded-2xl border border-line bg-surface focus-within:border-accent">
      <span className="flex h-12 items-center border-r border-line px-4 text-sm font-semibold text-ink">
        +91
      </span>
      <div className="relative h-12 min-w-0 flex-1">
        <input
          type="tel"
          name="phone"
          aria-label="Ten-digit mobile number"
          inputMode="numeric"
          pattern="[0-9]{10}"
          autoComplete="tel-national"
          minLength={10}
          maxLength={10}
          required
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
          className="absolute inset-0 z-10 h-full w-full cursor-text text-base opacity-0"
        />
        <div
          aria-hidden="true"
          className="flex h-full items-center justify-between px-4 font-mono text-xl font-medium text-ink"
        >
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} className="w-[1ch] text-center">
              {value[index] ?? ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DateInput({
  className = '',
  onClick,
  value,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const displayValue = typeof value === 'string' ? formatIsoDate(value) : ''

  return (
    <div className="relative mt-2">
      <input
        {...props}
        type="date"
        value={value}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          try {
            event.currentTarget.showPicker()
          } catch {
            // Fall back to the browser's default date-input interaction.
          }
        }}
        className={`${controlCls} date-input relative z-10 mt-0 appearance-none pr-11 text-transparent caret-transparent ${className}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-4 z-20 flex items-center tabular-nums ${displayValue ? 'text-ink' : 'text-faint'}`}
      >
        {displayValue || 'dd-mm-yyyy'}
      </span>
      <CalendarBlank
        aria-hidden="true"
        size={20}
        weight="bold"
        className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

export interface DropdownOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  compact = false,
  className = '',
  containerClassName = '',
}: {
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
  disabled?: boolean
  compact?: boolean
  className?: string
  containerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(options.findIndex((option) => option.value === value), 0))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => listRef.current?.focus())
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  function openMenu() {
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(options))
    setOpen(true)
  }

  function move(direction: 1 | -1) {
    if (!options.length) return
    let next = activeIndex
    for (let attempts = 0; attempts < options.length; attempts++) {
      next = (next + direction + options.length) % options.length
      if (!options[next]?.disabled) { setActiveIndex(next); return }
    }
  }

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    }
  }

  function handleListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveIndex(firstEnabled(options)) }
    else if (event.key === 'End') { event.preventDefault(); setActiveIndex(lastEnabled(options)) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(activeIndex) }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative mt-2 ${containerClassName}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleTriggerKey}
        className={`${controlCls} mt-0 flex items-center justify-between gap-3 text-left disabled:opacity-50 ${compact ? 'px-3 py-2 text-sm' : ''} ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ''}</span>
        <CaretDown size={16} weight="bold" className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${listboxId}-${activeIndex}`}
          onKeyDown={handleListKey}
          className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl outline-none"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onPointerMove={() => !option.disabled && setActiveIndex(index)}
              onClick={() => choose(index)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink ${option.disabled ? 'cursor-not-allowed opacity-40' : ''} ${activeIndex === index ? 'bg-sunken' : ''}`}
            >
              <Check size={16} weight="bold" className={`shrink-0 text-accent-strong dark:text-accent ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function firstEnabled<T extends string>(options: readonly DropdownOption<T>[]): number {
  const index = options.findIndex((option) => !option.disabled)
  return index >= 0 ? index : 0
}

function lastEnabled<T extends string>(options: readonly DropdownOption<T>[]): number {
  for (let index = options.length - 1; index >= 0; index--) if (!options[index]?.disabled) return index
  return 0
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlCls} ${className}`} />
}

/* Status chip: full pill per the shape system. */
export function Chip({ tone, children }: { tone: 'neutral' | 'paid' | 'pending' | 'overdue'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-sunken text-muted',
    paid: 'bg-accent-soft text-accent-strong dark:text-accent',
    pending: 'bg-sunken text-ink',
    overdue: 'bg-danger-soft text-danger',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

/* Page scaffold */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-24 pt-0">{children}</div>
}

export function PageHeader({
  title,
  backTo,
  rightElement,
}: {
  title: string
  backTo?: string
  rightElement?: ReactNode
}) {
  const t = useT()
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-line/50 bg-bg/90 px-4 py-3.5 backdrop-blur pt-[max(0.875rem,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            aria-label={t('common.back')}
            className="shrink-0 rounded-full p-1 text-muted hover:text-ink"
          >
            <ArrowLeft size={20} weight="bold" />
          </Link>
        )}
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </header>
  )
}

/* Skeleton loader matching final layout shape (no spinners). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-sunken motion-reduce:animate-none ${className}`} />
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}
