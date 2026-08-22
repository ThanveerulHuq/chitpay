import type { MessageTemplate } from '@chitapp/shared'

/**
 * Provider-agnostic WhatsApp sender. A BSP adapter (Meta Cloud API format)
 * replaces the console implementation once an account is chosen.
 */
export interface MessagingService {
  sendTemplate(
    toPhone: string,
    template: MessageTemplate,
    params: Record<string, string>,
  ): Promise<{ providerMessageId: string | null }>
}

class ConsoleMessagingService implements MessagingService {
  async sendTemplate(
    toPhone: string,
    template: MessageTemplate,
    params: Record<string, string>,
  ) {
    console.info(`[messaging:stub] to=${toPhone} template=${template}`, params)
    return { providerMessageId: null }
  }
}

export const messaging: MessagingService = new ConsoleMessagingService()
