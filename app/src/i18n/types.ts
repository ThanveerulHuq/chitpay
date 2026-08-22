import type { Lang } from '@shared'

export type { Lang }

export type Dictionary = typeof import('./en').en
export type TranslationKey = keyof Dictionary
