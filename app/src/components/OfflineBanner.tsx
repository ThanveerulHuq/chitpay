import { useEffect, useState } from 'react'
import { WifiSlash } from '@phosphor-icons/react'
import { useT } from '@/i18n'

export default function OfflineBanner() {
  const t = useT()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-sunken px-4 py-2 text-xs font-medium text-muted"
    >
      <WifiSlash size={14} />
      {t('offline.banner')}
    </div>
  )
}
