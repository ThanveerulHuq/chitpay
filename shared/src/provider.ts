import { AppError } from './errors.js'
import type { Role } from './types.js'

export function rolesWithProviderAdmin(roles: Role[]): Role[] {
  return [...new Set([...roles, 'admin' as const, 'member' as const])]
}

export function rolesWithoutProviderAdmin(roles: Role[]): Role[] {
  return roles.filter((role) => role !== 'admin')
}

export function assertProviderAdminRemovable(adminCount: number): void {
  if (!Number.isInteger(adminCount) || adminCount <= 1) {
    throw new AppError('invalid_transition', 'A provider must have at least one admin.')
  }
}
