import { env } from '../../config/env.js'

const BASE_URL = `https://graph.facebook.com/${env.WA_API_VERSION}`

interface WaSendResponse {
  messages: Array<{ id: string }>
}

interface WaErrorResponse {
  error: { message: string; code: number }
}

async function postToMessagesEndpoint(
  phoneNumberId: string,
  body: unknown,
): Promise<WaSendResponse> {
  const url = `${BASE_URL}/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = (await response.json()) as WaErrorResponse
    throw new Error(
      errorBody?.error?.message ?? `WhatsApp API error: ${response.status}`,
    )
  }

  return response.json() as Promise<WaSendResponse>
}

export async function sendTextMessage(
  to: string,
  text: string,
  phoneNumberId?: string,
): Promise<{ messageId: string }> {
  const pid = phoneNumberId ?? env.WA_PHONE_NUMBER_ID

  const data = await postToMessagesEndpoint(pid, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  })

  return { messageId: data.messages[0].id }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  params: string[],
  phoneNumberId?: string,
): Promise<{ messageId: string }> {
  const pid = phoneNumberId ?? env.WA_PHONE_NUMBER_ID

  const data = await postToMessagesEndpoint(pid, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: params.map((p) => ({ type: 'text', text: p })),
        },
      ],
    },
  })

  return { messageId: data.messages[0].id }
}
