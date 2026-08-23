import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { getSessionViewMode, setSessionViewMode, type ViewMode } from './viewMode'

interface ViewModeContextType {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const ViewModeContext = createContext<ViewModeContextType | null>(null)

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  
  const [viewMode, setViewModeState] = useState<ViewMode>(() => getSessionViewMode() ?? 'member')

  useEffect(() => {
    if (!isAdmin && viewMode === 'admin') {
      setViewModeState('member')
    } else if (isAdmin && !getSessionViewMode()) {
      setViewModeState('admin')
    }
  }, [isAdmin, viewMode])

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    setSessionViewMode(mode)
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
