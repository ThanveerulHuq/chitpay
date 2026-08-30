import { describe, expect, it } from 'vitest'
import { assertProviderAdminRemovable, rolesWithProviderAdmin, rolesWithoutProviderAdmin } from './provider.js'

describe('provider admin roles', () => {
  it('grants admin and member roles without duplicates', () => {
    expect(rolesWithProviderAdmin(['member'])).toEqual(['member', 'admin'])
    expect(rolesWithProviderAdmin(['admin', 'member'])).toEqual(['admin', 'member'])
  })

  it('revokes only the admin role', () => {
    expect(rolesWithoutProviderAdmin(['admin', 'member'])).toEqual(['member'])
  })

  it('prevents removing the last provider admin', () => {
    expect(() => assertProviderAdminRemovable(1)).toThrow('at least one admin')
    expect(() => assertProviderAdminRemovable(2)).not.toThrow()
  })
})
