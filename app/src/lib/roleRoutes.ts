import { useLocation } from 'react-router-dom'

export type Experience = 'admin' | 'member'

export function useExperience(): Experience {
  const { pathname } = useLocation()
  return pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' : 'member'
}

export function groupsPath(experience: Experience): string {
  return `/${experience}/groups`
}

export function groupPath(experience: Experience, groupId: string, section = 'members'): string {
  return `${groupsPath(experience)}/${groupId}/${section}`
}

export function settingsPath(experience: Experience): string {
  return `/${experience}/settings`
}
