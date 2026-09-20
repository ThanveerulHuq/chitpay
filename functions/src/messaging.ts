import type { Lang, MessageTemplate } from '@chitapp/shared'

const DEFAULT_KWIC_PUSH_URL = 'https://app.kwic.in/api/v1/push'
const REQUEST_TIMEOUT_MS = 15_000

/** Provider-agnostic WhatsApp sender backed by Kwic's push API. */
export interface MessagingService {
  sendTemplate(
    toPhone: string,
    template: MessageTemplate,
    params: Record<string, string>,
    language?: Lang,
  ): Promise<{ providerMessageId: string | null }>
}

interface KwicResponse {
  [key: string]: unknown
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function providerMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as KwicResponse
  const data = root.data && typeof root.data === 'object'
    ? root.data as KwicResponse
    : null
  return (
    stringValue(root.message_id) ??
    stringValue(root.messageId) ??
    stringValue(root.id) ??
    stringValue(data?.message_id) ??
    stringValue(data?.messageId) ??
    stringValue(data?.id)
  )
}

function responsePreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** Kwic adapter for the provider-agnostic messaging interface. */
class KwicMessagingService implements MessagingService {
  async sendTemplate(
    toPhone: string,
    template: MessageTemplate,
    params: Record<string, string>,
    language: Lang = 'en',
  ): Promise<{ providerMessageId: string | null }> {
    const apiKey = process.env.KWIC_API_KEY
    if (!apiKey) throw new Error('KWIC_API_KEY is not configured')

    const endpoint = new URL(process.env.KWIC_PUSH_URL ?? DEFAULT_KWIC_PUSH_URL)
    endpoint.searchParams.set('api_key', apiKey)

    const variable = Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    )
    const headerImageUrl = process.env.KWIC_HEADER_IMAGE_URL?.trim()
    const payload = {
      mobile_number: toPhone.replace(/[^0-9]/g, ''),
      variable,
      // The OTP template is a single Kwic template ID shared by both app languages.
      template_id: template === 'login_code' ? 'kwic_app_otp' : `${template}_${language}`,
      ...(headerImageUrl ? { header_image_url: headerImageUrl } : {}),
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    let responseBody = ''
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      responseBody = await response.text()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Kwik request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      }
      throw new Error(`Kwik request failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new Error(
        `Kwik request failed (${response.status}): ${responsePreview(responseBody) || response.statusText}`,
      )
    }

    let parsed: unknown = null
    if (responseBody) {
      try {
        parsed = JSON.parse(responseBody) as unknown
      } catch {
        // Kwic may return an empty or non-JSON success body; the HTTP status is authoritative.
      }
    }

    return { providerMessageId: providerMessageId(parsed) }
  }
}

export const messaging: MessagingService = new KwicMessagingService()
