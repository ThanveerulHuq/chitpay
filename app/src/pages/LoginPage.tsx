import { useEffect, useState, type FormEvent } from 'react'
import { WhatsappLogo } from '@phosphor-icons/react'
import { requestOtp, verifyOtp, devSignIn, signInWithPassword } from '@/lib/auth'
import { OTP_RESEND_COOLDOWN_MS, userMessage } from '@shared'
import { Button, ErrorNote, Field, Input, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'
import LanguageToggle from '@/components/LanguageToggle'
import { useBranding } from '@/lib/brandingContext'

type Mode = 'otp' | 'password'
type Step = 'phone' | 'code'

export default function LoginPage() {
  const { t, lang } = useI18n()
  const { iconSrc, providerName } = useBranding()
  const [mode, setMode] = useState<Mode>('otp')
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fullPhone = `+91${phone}`

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestOtp(fullPhone, lang)
      setCode('')
      setStep('code')
      setResendIn(OTP_RESEND_COOLDOWN_MS / 1000)
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyOtp(fullPhone, code)
      window.location.replace('/')
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0) return
    setError(null)
    setBusy(true)
    try {
      await requestOtp(fullPhone, lang)
      setCode('')
      setResendIn(OTP_RESEND_COOLDOWN_MS / 1000)
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handleDevSignIn() {
    setError(null)
    setBusy(true)
    try {
      await devSignIn()
      window.location.replace('/groups')
    } catch (err) {
      setError(errMessage(err, lang))
      setBusy(false)
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInWithPassword(fullPhone, formatPassword(password))
      window.location.replace('/')
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-start px-6 pb-10 pt-6 sm:pt-[10dvh]">
      <div className="mb-4 flex justify-end sm:mb-8">
        <LanguageToggle />
      </div>
      <div className="mx-auto w-full max-w-sm">
        <img src={iconSrc} alt="" className="mx-auto mb-6 size-40 rounded-[2rem] object-contain" />
        <h1 className="text-center text-3xl font-bold tracking-tight">{t('brand.name')}</h1>
        <p className="mt-1 text-center text-muted">{t('brand.tagline')}</p>
        {providerName && (
          <p className="mt-3 text-center text-sm font-semibold text-ink">
            {t('login.providerName', { name: providerName })}
          </p>
        )}

        <div className="mt-10">
          {error && <ErrorNote>{error}</ErrorNote>}

          {mode === 'otp' && step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <Field label={t('login.mobileNumber')}>
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Button type="submit" disabled={busy || phone.length !== 10} className="w-full">
                <WhatsappLogo size={20} weight="fill" />
                {busy ? t('common.sending') : t('login.sendCode')}
              </Button>
              <p className="text-center text-xs text-faint">{t('login.whatsappNotice')}</p>
            </form>
          )}

          {mode === 'otp' && step === 'code' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
                <WhatsappLogo size={26} weight="fill" />
              </div>
              <p className="text-center text-sm leading-6 text-muted">{t('login.codeSentTo', { phone })}</p>
              <Field label={t('login.otp')}>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  aria-label={t('login.sixDigitAria')}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-[0.3em]"
                />
              </Field>
              <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
                {busy ? t('common.verifying') : t('login.verifyAndSignIn')}
              </Button>
              <button
                type="button"
                onClick={() => void handleResendOtp()}
                disabled={busy || resendIn > 0}
                className="mx-auto block text-sm text-accent-strong underline-offset-2 hover:underline disabled:text-faint disabled:no-underline dark:text-accent"
              >
                {resendIn > 0 ? t('login.resendIn', { seconds: resendIn }) : t('login.resendCode')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setCode('')
                  setResendIn(0)
                  setError(null)
                }}
                className="mx-auto block text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {t('login.changeNumber')}
              </button>
            </form>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <Field label={t('login.mobileNumber')}>
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Field label={t('login.password')} hint={t('login.passwordHint')}>
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
            setCode('')
            setResendIn(0)
            setError(null)
          }}
          className="mx-auto mt-8 flex items-center gap-1.5 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {mode === 'password' && <WhatsappLogo size={16} />}
          {mode === 'otp' ? t('login.usePasswordInstead') : t('login.useWhatsappInstead')}
        </button>

        {import.meta.env.DEV && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void handleDevSignIn()}
            className="mx-auto mt-4 flex w-auto text-xs text-faint"
          >
            {busy ? t('common.signingIn') : t('login.devSignIn')}
          </Button>
        )}
      </div>
    </div>
  )
}

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
    case 'auth/admin-restricted-operation':
      return lang === 'ta'
        ? 'டெவ் உள்நுழைவு கிடைக்கவில்லை: Firebase Auth-இல் Anonymous provider-ஐ இயக்கவும்.'
        : 'Dev sign-in unavailable: enable the Anonymous provider in Firebase Auth.'
    default:
      return userMessage('internal', lang)
  }
}
