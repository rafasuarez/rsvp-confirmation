import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendTextMessage, sendTemplateMessage } from './whatsapp.service.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendTextMessage', () => {
  it('calls the correct URL with phoneNumberId and /messages path', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.abc123' }] }),
    )

    await sendTextMessage('+14155552671', 'Hello!', 'custom_phone_id')

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('custom_phone_id')
    expect(url).toContain('/messages')
  })

  it('uses WA_PHONE_NUMBER_ID from env when phoneNumberId is not provided', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.default' }] }),
    )

    await sendTextMessage('+14155552671', 'Hello!')

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('test_phone_number_id')
  })

  it('sends Authorization Bearer header with the access token', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.abc' }] }),
    )

    await sendTextMessage('+14155552671', 'Hi')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test_access_token')
  })

  it('sends Content-Type application/json header', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.abc' }] }),
    )

    await sendTextMessage('+14155552671', 'Hi')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sends correct body shape with messaging_product, recipient_type, to, type, and text', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.body' }] }),
    )

    await sendTextMessage('+14155552671', 'Test body')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '+14155552671',
      type: 'text',
      text: { body: 'Test body' },
    })
  })

  it('returns the messageId from the first message in the response', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.returned' }] }),
    )

    const result = await sendTextMessage('+14155552671', 'Hi')

    expect(result).toEqual({ messageId: 'wamid.returned' })
  })

  it('throws when the response is not ok (400 error)', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse(
        { error: { message: 'Invalid phone number', code: 100 } },
        false,
        400,
      ),
    )

    await expect(sendTextMessage('+invalid', 'Hi')).rejects.toThrow(
      'Invalid phone number',
    )
  })
})

describe('sendTemplateMessage', () => {
  it('sends correct template payload shape', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.tmpl' }] }),
    )

    await sendTemplateMessage('+14155552671', 'hello_world', ['param1', 'param2'])

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '+14155552671',
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'param1' },
              { type: 'text', text: 'param2' },
            ],
          },
        ],
      },
    })
  })

  it('returns the messageId from the template response', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ messages: [{ id: 'wamid.tmpl.ret' }] }),
    )

    const result = await sendTemplateMessage('+14155552671', 'my_template', [])

    expect(result).toEqual({ messageId: 'wamid.tmpl.ret' })
  })

  it('throws when the response is not ok', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse(
        { error: { message: 'Template not found', code: 132001 } },
        false,
        400,
      ),
    )

    await expect(
      sendTemplateMessage('+14155552671', 'nonexistent', []),
    ).rejects.toThrow('Template not found')
  })
})
