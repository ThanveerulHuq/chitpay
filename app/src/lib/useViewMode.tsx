import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'

type ViewMode = 'admin' | 'member'

interface ViewModeContextType {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const ViewModeContext = createContext<ViewModeContextType | null>(null)

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('chitapp_view_mode') as ViewMode | null
    return saved || 'member'
  })

  useEffect(() => {
    if (!isAdmin && viewMode === 'admin') {
      setViewModeState('member')
    } else if (isAdmin && !localStorage.getItem('chitapp_view_mode')) {
      setViewModeState('admin')
    }
  }, [isAdmin, viewMode])

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem('chitapp_view_mode', mode)
  }

  return (
    <ViewModeContext.Provider value={{ viewMode: isAdmin ? viewMode : 'member', setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  const context = useContext(ViewModeContext)
  if (!context) throw new Error('useViewMode must be used within ViewModeProvider')
  return context
}
