import { useState, type FormEvent } from 'react'
import { WhatsappLogo } from '@phosphor-icons/react'
import { requestLoginLink, signInWithPassword } from '@/lib/auth'
import { userMessage } from '@shared'
import { Button, ErrorNote, Field, Input, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'
import LanguageToggle from '@/components/LanguageToggle'

type Mode = 'link' | 'password'
type Step = 'phone' | 'sent'

export default function LoginPage() {
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<Mode>('link')
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fullPhone = `+91${phone}`

  async function handleSendLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestLoginLink(fullPhone, lang)
      setStep('sent')
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
      window.location.replace('/groups')
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
        <img src="/brand/chitpay-login-artwork.png" alt="" className="mx-auto mb-6 h-40 w-40 object-contain" />
        <h1 className="text-center text-3xl font-bold tracking-tight">{t('brand.name')}</h1>
        <p className="mt-1 text-center text-muted">{t('brand.tagline')}</p>

        <div className="mt-10">
          {error && <ErrorNote>{error}</ErrorNote>}

          {mode === 'link' && step === 'phone' && (
            <form onSubmit={handleSendLink} className="space-y-5">
              <Field label={t('login.mobileNumber')}>
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Button type="submit" disabled={busy || phone.length !== 10} className="w-full">
                {busy ? t('common.sending') : t('login.sendAccessLink')}
              </Button>
              <p className="text-center text-xs text-faint">{t('login.whatsappLinkNotice')}</p>
            </form>
          )}

          {mode === 'link' && step === 'sent' && (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
                <WhatsappLogo size={26} weight="fill" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{t('login.linkSentTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t('login.linkSentTo', { phone })}</p>
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setError(null)
                }}
                className="mt-5 text-sm text-accent-strong underline-offset-2 hover:underline dark:text-accent"
              >
                {t('login.changeNumber')}
              </button>
            </div>
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
            setMode(mode === 'link' ? 'password' : 'link')
            setStep('phone')
            setError(null)
          }}
          className="mx-auto mt-8 flex items-center gap-1.5 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <WhatsappLogo size={16} />
          {mode === 'link' ? t('login.usePasswordInstead') : t('login.useWhatsappInstead')}
        </button>
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
    default:
      return userMessage('internal', lang)
  }
}
