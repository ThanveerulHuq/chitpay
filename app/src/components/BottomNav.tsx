import { useAuth } from '@/lib/useAuth'
import { useViewMode } from '@/lib/useViewMode'
import { UserCircle, ShieldStar } from '@phosphor-icons/react'
import { useT } from '@/i18n'
import { useLocation } from 'react-router-dom'

export default function BottomNav() {
  const { isAdmin } = useAuth()
  const { viewMode, setViewMode } = useViewMode()
  const t = useT()
  const location = useLocation()

  if (!isAdmin) return null
  if (location.pathname === '/login') return null

  return (
    <>
      {/* Spacer so content isn't hidden behind the bottom bar */}
      <div className="h-16" />
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-surface/90 backdrop-blur pb-safe">
        <div className="flex h-16 max-w-md mx-auto">
          <button
            onClick={() => setViewMode('admin')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              viewMode === 'admin' ? 'text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <ShieldStar size={24} weight={viewMode === 'admin' ? 'fill' : 'regular'} />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {t('common.admin')}
            </span>
          </button>
          <button
            onClick={() => setViewMode('member')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              viewMode === 'member' ? 'text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <UserCircle size={24} weight={viewMode === 'member' ? 'fill' : 'regular'} />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              Member
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
