export type ViewMode = 'admin' | 'member'

const VIEW_MODE_STORAGE_KEY = 'chitapp_view_mode'

export function getSessionViewMode(): ViewMode | null {
  try {
    const saved = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return saved === 'admin' || saved === 'member' ? saved : null
  } catch {
    return null
  }
}

export function setSessionViewMode(mode: ViewMode): void {
  try {
    sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // The in-memory provider state still works when storage is unavailable.
  }
}

export function resetSessionViewMode(): void {
  try {
    sessionStorage.removeItem(VIEW_MODE_STORAGE_KEY)
  } catch {
    // A fresh provider still selects the role-appropriate default.
  }
}
