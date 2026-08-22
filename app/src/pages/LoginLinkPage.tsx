import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hasStoredLoginEmail, verifyLoginLink } from '@/lib/auth'
import { Button, ErrorNote, Field, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'

type Status = 'checking' | 'phone' | 'failed'

export default function LoginLinkPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>(() => hasStoredLoginEmail() ? 'checking' : 'phone')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState(false)
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (status !== 'checking' || started.current) return
    started.current = true
    verifyLoginLink(id)
      .then(() => navigate('/groups', { replace: true }))
      .catch(() => setStatus('failed'))
  }, [id, navigate, status])

  async function handlePhoneVerification(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setPhoneError(false)
    try {
      await verifyLoginLink(id, `+91${phone}`)
      navigate('/groups', { replace: true })
    } catch {
      setPhoneError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <img src="/brand/chitpay-login-artwork.png" alt="" className="mx-auto mb-6 h-32 w-32 object-contain" />

        {status === 'checking' && (
          <>
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-line border-t-accent" />
            <h1 className="mt-5 text-2xl font-semibold">{t('login.openingLink')}</h1>
            <p className="mt-2 text-sm text-muted">{t('login.openingLinkHint')}</p>
          </>
        )}

        {status === 'phone' && (
          <>
            <h1 className="text-2xl font-semibold">{t('login.confirmPhoneTitle')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{t('login.confirmPhoneHint')}</p>
            <form onSubmit={handlePhoneVerification} className="mt-6 space-y-5 text-left">
              {phoneError && <ErrorNote>{t('login.confirmPhoneError')}</ErrorNote>}
              <Field label={t('login.mobileNumber')}>
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Button type="submit" disabled={busy || phone.length !== 10} className="w-full">
                {busy ? t('common.verifying') : t('login.verifyAndSignIn')}
              </Button>
            </form>
          </>
        )}

        {status === 'failed' && (
          <>
            <h1 className="text-2xl font-semibold">{t('login.invalidLinkTitle')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{t('login.invalidLinkHint')}</p>
            <Link to="/login" replace className="mt-6 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white">
              {t('login.requestNewLink')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
