import { useAuth } from '@/lib/useAuth'
import { UserCircle, ShieldStar } from '@phosphor-icons/react'
import { useT } from '@/i18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { useExperience } from '@/lib/roleRoutes'

export default function BottomNav() {
  const { isAdmin } = useAuth()
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const experience = useExperience()

  const selectView = (mode: 'admin' | 'member') => {
    navigate(`/${mode}/groups`)
  }

  if (!isAdmin) return null
  if (location.pathname.startsWith('/login')) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-surface/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 max-w-md mx-auto">
          <button
            onClick={() => selectView('admin')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              experience === 'admin' ? 'text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <ShieldStar size={24} weight={experience === 'admin' ? 'fill' : 'regular'} />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {t('common.admin')}
            </span>
          </button>
          <button
            onClick={() => selectView('member')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              experience === 'member' ? 'text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <UserCircle size={24} weight={experience === 'member' ? 'fill' : 'regular'} />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {t('common.member')}
            </span>
          </button>
        </div>
      </div>
  )
}
