import { useEffect, useState } from 'react'
import { DownloadSimple, ShareNetwork, X } from '@phosphor-icons/react'
import { useT } from '@/i18n'
import { Button } from '@/components/ui'

const DISMISSED_AT_KEY = 'chitpay_install_prompt_dismissed_at'
const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  const legacyNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || legacyNavigator.standalone === true
}

function isIos(): boolean {
  const isIpadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || isIpadDesktopMode
}

function dismissalIsActive(): boolean {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY))
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISSAL_DURATION_MS
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
  } catch {
    // Restricted storage should not break the install flow.
  }
}

export default function InstallPrompt() {
  const t = useT()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosInstructions, setShowIosInstructions] = useState(
    () => isIos() && !isStandalone() && !dismissalIsActive(),
  )

  useEffect(() => {
    if (isStandalone()) return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (!dismissalIsActive()) {
        setDeferredPrompt(event as BeforeInstallPromptEvent)
      }
    }

    const handleInstalled = () => {
      setDeferredPrompt(null)
      setShowIosInstructions(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismiss = () => {
    rememberDismissal()
    setDeferredPrompt(null)
    setShowIosInstructions(false)
  }

  const install = async () => {
    if (!deferredPrompt) return

    const prompt = deferredPrompt
    setDeferredPrompt(null)

    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'dismissed') rememberDismissal()
    } catch {
      rememberDismissal()
    }
  }

  if (!deferredPrompt && !showIosInstructions) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 px-4 pb-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-prompt-title"
        aria-describedby="install-prompt-description"
        className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:text-accent">
            {showIosInstructions ? (
              <ShareNetwork aria-hidden="true" size={23} weight="bold" />
            ) : (
              <DownloadSimple aria-hidden="true" size={23} weight="bold" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="install-prompt-title" className="text-lg font-bold tracking-tight">
              {t('install.title')}
            </h2>
            <p id="install-prompt-description" className="mt-1 text-sm leading-6 text-muted">
              {showIosInstructions ? t('install.iosDescription') : t('install.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('common.close')}
            className="-mr-1 -mt-1 rounded-full p-2 text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X aria-hidden="true" size={20} weight="bold" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={dismiss}>
            {t('install.notNow')}
          </Button>
          {showIosInstructions ? (
            <Button type="button" onClick={dismiss}>
              {t('install.gotIt')}
            </Button>
          ) : (
            <Button type="button" onClick={install}>
              <DownloadSimple aria-hidden="true" size={19} weight="bold" />
              {t('install.action')}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
