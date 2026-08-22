import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { WhatsappLogo } from '@phosphor-icons/react'
import { requestOtp, signInWithPassword, verifyOtp } from '@/lib/auth'
import { resendInMs, userMessage } from '@shared'
import { Button, ErrorNote, Field, Input, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'
import LanguageToggle from '@/components/LanguageToggle'

type Mode = 'otp' | 'password'
type Step = 'phone' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<Mode>('otp')
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [lastSentAt, setLastSentAt] = useState<number | null>(null)

  useEffect(() => {
    if (step !== 'code') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  const cooldown = resendInMs(lastSentAt, now)
  const fullPhone = `+91${phone}`

  async function handleSendOtp(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestOtp(fullPhone)
      setStep('code')
      setLastSentAt(Date.now())
      setNow(Date.now())
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyOtp(fullPhone, code)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInWithPassword(fullPhone, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-start px-6 pb-10 pt-6 sm:pt-[10dvh]">
      <div className="flex justify-end mb-4 sm:mb-8">
        <LanguageToggle />
      </div>
      <div className="mx-auto w-full max-w-sm">
        <img
          src="/brand/chitpay-login-artwork.png"
          alt=""
          className="mx-auto mb-6 h-40 w-40 object-contain"
        />
        <h1 className="text-center text-3xl font-bold tracking-tight">{t('brand.name')}</h1>
        <p className="mt-1 text-center text-muted">{t('brand.tagline')}</p>

        <div className="mt-10">
          {error && <ErrorNote>{error}</ErrorNote>}

          {mode === 'otp' && step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <Field label={t('login.mobileNumber')}>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                />
              </Field>
              <Button type="submit" disabled={busy || phone.length !== 10} className="w-full">
                {busy ? t('common.sending') : t('common.continue')}
              </Button>
              <p className="text-center text-xs text-faint">
                {t('login.whatsappNotice')}
              </p>
            </form>
          )}

          {mode === 'otp' && step === 'code' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <Field label={t('login.codeSentTo', { phone })}>
                <DigitBoxes
                  name="otp"
                  ariaLabel={t('login.sixDigitAria')}
                  autoComplete="one-time-code"
                  length={6}
                  value={code}
                  onChange={setCode}
                  className="mx-auto mt-2 max-w-72"
                />
              </Field>
              <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
                {busy ? t('common.verifying') : t('login.verifyAndSignIn')}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  {t('login.changeNumber')}
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || busy}
                  onClick={() => handleSendOtp()}
                  className="text-accent-strong underline-offset-2 hover:underline disabled:opacity-40 dark:text-accent"
                >
                  {cooldown > 0
                    ? t('login.resendIn', { seconds: Math.ceil(cooldown / 1000) })
                    : t('login.resendCode')}
                </button>
              </div>
            </form>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <Field label={t('login.mobileNumber')}>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                />
              </Field>
              <Field
                label={t('login.password')}
                hint={t('login.passwordHint')}
              >
                <Input
                  type="text"
                  autoComplete="current-password"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={formatPassword(password)}
                  onChange={(e) => setPassword(unformatPassword(e.target.value))}
                  placeholder="••••-••••"
                  className="text-center text-2xl tracking-[0.3em] uppercase"
                />
              </Field>
              <Button type="submit" disabled={busy || phone.length !== 10} className="w-full">
                {busy ? t('common.signingIn') : t('login.signIn')}
              </Button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'otp' ? 'password' : 'otp')
            setStep('phone')
            setError(null)
          }}
          className="mx-auto mt-8 flex items-center gap-1.5 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <WhatsappLogo size={16} />
          {mode === 'otp' ? t('login.usePasswordInstead') : t('login.useWhatsappInstead')}
        </button>
      </div>
    </div>
  )
}

function DigitBoxes({
  name,
  ariaLabel,
  autoComplete,
  length,
  value,
  onChange,
  className = '',
}: {
  name: string
  ariaLabel: string
  autoComplete: string
  length: number
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const layout = length === 10 ? 'grid-cols-10 gap-1' : 'grid-cols-6 gap-2'
  const boxHeight = length === 10 ? 'h-12' : 'h-14'

  return (
    <div className={`relative grid ${layout} ${className}`}>
      <input
        type="text"
        name={name}
        aria-label={ariaLabel}
        inputMode="numeric"
        pattern={`[0-9]{${length}}`}
        autoComplete={autoComplete}
        minLength={length}
        maxLength={length}
        required
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
        className="peer absolute inset-0 z-10 h-full w-full cursor-text rounded-xl text-base opacity-0"
      />
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`flex ${boxHeight} min-w-0 items-center justify-center rounded-lg border border-line bg-surface text-lg font-semibold text-ink transition-colors peer-focus:border-accent peer-focus:ring-1 peer-focus:ring-accent`}
        >
          {value[index] ?? ''}
        </span>
      ))}
    </div>
  )
}

/** Formats as XXXX-XXXX while typing; raw value kept in state. */
function formatPassword(raw: string): string {
  const chars = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars
}

function unformatPassword(display: string): string {
  return display.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
}

function errMessage(err: unknown, lang: 'en' | 'ta' = 'en'): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'functions/already-exists':
    case 'auth/invalid-credential':
      return lang === 'ta' ? 'தவறான எண் அல்லது கடவுச்சொல்.' : 'Wrong number or password.'
    case 'functions/resource-exhausted':
      return userMessage('rate_limited', lang)
    case 'functions/invalid-argument':
      return userMessage('invalid_argument', lang)
    case 'functions/unavailable':
      return lang === 'ta'
        ? 'சேவையகத்தை இணைக்க முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.'
        : "Can't reach the server. Check your connection."
    default:
      return userMessage('internal', lang)
  }
}

