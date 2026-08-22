import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarBlank } from '@phosphor-icons/react'
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
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className="relative mt-2">
      <input
        {...props}
        type="date"
        className={`${controlCls} date-input relative mt-0 appearance-none pr-11 ${className}`}
      />
      <CalendarBlank
        aria-hidden="true"
        size={20}
        weight="bold"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlCls} ${className}`} />
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
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-sunken ${className}`} />
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}
