// All types mirrored from the Express backend responses.
// API base is empty in production (same host); override with API_URL in dev via Next.js rewrites.

export type AdminUser = {
  id: string
  email: string
  name: string
}

export type Event = {
  id: string
  name: string
  slug: string
  eventDate: string
  venue: string | null
  description: string | null
  isActive: boolean
  adminUserId: string
  waPhoneNumberId: string | null
  createdAt: string
  updatedAt: string
}

export type Guest = {
  id: string
  eventId: string
  name: string
  phone: string
  email: string | null
  language: string
  isActive: boolean
  importBatch: string | null
  createdAt: string
  updatedAt: string
}

export type GuestRow = {
  name: string
  phone: string
  email: string | null
  language: string
}

export type ImportPreview = {
  valid: GuestRow[]
  invalid: { row: number; rawPhone: string; reason: string }[]
  duplicatePhones: { row: number; phone: string }[]
  importBatch: string
}

export type GuestResponseRow = {
  guestId: string
  name: string
  phone: string
  email: string | null
  conversationState: string
  isAttending: boolean | null
  confirmedPartySize: number | null
  dietaryNotes: string | null
  submittedAt: string | null
}

export type StatsResult = {
  total: number
  attending: number
  declined: number
  pending: number
  optedOut: number
  unreachable: number
  complete: number
}

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }
type PaginatedResponse<T> = {
  success: true
  data: T[]
  meta: { total: number; page: number; limit: number }
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const body: ApiResponse<T> = await res.json()

  if (!body.success) {
    throw new Error((body as { success: false; error: string }).error ?? `HTTP ${res.status}`)
  }

  return (body as { success: true; data: T }).data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<AdminUser>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchApi<undefined>('/api/v1/auth/logout', { method: 'POST' }),

  me: () => fetchApi<AdminUser>('/api/v1/auth/me'),
}

// ── Events ────────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: () => fetchApi<Event[]>('/api/v1/events'),

  get: (eventId: string) => fetchApi<Event>(`/api/v1/events/${eventId}`),

  create: (body: { name: string; eventDate: string; venue?: string; description?: string }) =>
    fetchApi<Event>('/api/v1/events', { method: 'POST', body: JSON.stringify(body) }),

  update: (
    eventId: string,
    body: Partial<{ name: string; eventDate: string; venue: string; description: string }>,
  ) =>
    fetchApi<Event>(`/api/v1/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  launch: (eventId: string) =>
    fetchApi<{ queued: number }>(`/api/v1/events/${eventId}/launch`, { method: 'POST' }),
}

// ── Guests ────────────────────────────────────────────────────────────────────

export const guestsApi = {
  list: (eventId: string) =>
    fetchApi<Guest[]>(`/api/v1/events/${eventId}/guests`),

  previewImport: async (eventId: string, file: File): Promise<ImportPreview> => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/v1/events/${eventId}/guests/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const body: ApiResponse<ImportPreview> = await res.json()
    if (!body.success) throw new Error((body as { success: false; error: string }).error)
    return (body as { success: true; data: ImportPreview }).data
  },

  confirmImport: (eventId: string, importBatch: string, guests: GuestRow[]) =>
    fetchApi<{ imported: number; skipped: number }>(
      `/api/v1/events/${eventId}/guests/import/confirm`,
      { method: 'POST', body: JSON.stringify({ importBatch, guests }) },
    ),
}

// ── RSVP ──────────────────────────────────────────────────────────────────────

export const rsvpApi = {
  stats: (eventId: string) =>
    fetchApi<StatsResult>(`/api/v1/events/${eventId}/responses/stats`),

  list: async (
    eventId: string,
    params: { page?: number; limit?: number; status?: string },
  ): Promise<{ rows: GuestResponseRow[]; total: number; page: number; limit: number }> => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.status) qs.set('status', params.status)

    const res = await fetch(
      `/api/v1/events/${eventId}/responses?${qs.toString()}`,
      { credentials: 'include' },
    )

    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const body: PaginatedResponse<GuestResponseRow> = await res.json()
    return {
      rows: body.data,
      total: body.meta.total,
      page: body.meta.page,
      limit: body.meta.limit,
    }
  },

  exportUrl: (eventId: string) => `/api/v1/events/${eventId}/responses/export`,
}
