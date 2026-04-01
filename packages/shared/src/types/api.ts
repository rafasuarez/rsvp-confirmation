export interface ApiResponse<T = undefined> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function fail(error: string): ApiResponse<never> {
  return { success: false, error }
}
