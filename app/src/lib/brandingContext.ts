import { createContext, useContext } from 'react'

export interface BrandingValue {
  iconSrc: string
  providerName?: string
}

export const BrandingContext = createContext<BrandingValue>({
  iconSrc: '/brand/chitpay-app-icon-hands.png',
})

export function useBranding(): BrandingValue {
  return useContext(BrandingContext)
}
