import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/authStore'

// ── Types ────────────────────────────────────────────────────────────────────
// RFC 7807 Problem Details for HTTP APIs
// https://datatracker.ietf.org/doc/html/rfc7807
export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  /** The human-readable explanation specific to this occurrence. */
  detail?: string
  instance?: string
  /** RFC 7807 extension — validation errors keyed by field name. */
  errors?: Record<string, string[]>
}

// Generic API response wrapper used by our NestJS backend
export interface ApiResponse<T> {
  data: T
  message?: string
  meta?: {
    page: number
    limit: number
    total: number
  }
}

// ── Axios instance ──────────────────────────────────────────────────────────
const BASE_URL: string = import.meta.env.VITE_API_URL

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // httpOnly refresh token cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── 401 refresh state (module-level — shared across all requests) ───────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    }
  })
  failedQueue = []
}

// ── Request interceptor — attach Bearer token ───────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: unknown) => Promise.reject(error)
)

// ── Response interceptor — 401 refresh, retry, RFC 7807 toast ───────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    const axiosError = error as AxiosError<ProblemDetail>
    const originalRequest = axiosError.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // ── 401 handling ──────────────────────────────────────────────────────
    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't try to refresh on the refresh endpoint itself (avoids infinite loop)
      if (originalRequest.url === '/auth/refresh') {
        useAuthStore.getState().clearAuth()
        // Dynamic import to avoid circular dependency at module load time
        void import('@/router').then(({ router }) => {
          router.navigate('/login', { replace: true })
        })
        return Promise.reject(axiosError)
      }

      if (isRefreshing) {
        // Another request already triggered a refresh — queue this one.
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`
              }
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // POST /auth/refresh — the httpOnly refresh cookie is sent automatically
        // via withCredentials: true. The response body contains the new access token.
        const { data } = await api.post<{ accessToken: string; expiresAt: string }>('/auth/refresh')

        useAuthStore.getState().setAccessToken(data.accessToken, data.expiresAt)

        // Retry all queued requests with the new token
        processQueue(null, data.accessToken)

        // Retry the original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed — clear auth state and redirect
        processQueue(refreshError, null)
        useAuthStore.getState().clearAuth()

        void import('@/router').then(({ router }) => {
          router.navigate('/login', { replace: true })
        })

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // ── Non-401 error → RFC 7807 toast ───────────────────────────────────
    // Skip toasts for 401 — those are handled above (or the refresh itself failed)
    if (axiosError.response?.status !== 401) {
      const problem = axiosError.response?.data as ProblemDetail | undefined
      const detail = problem?.detail ?? axiosError.message ?? 'An unexpected error occurred'

      // Map known HTTP statuses to sonner toast severity
      const status = axiosError.response?.status ?? 0
      if (status >= 500) {
        toast.error(detail)
      } else {
        toast.warning(detail)
      }
    }

    return Promise.reject(axiosError)
  }
)

// ── Typed generic helpers — unwrap { data } envelope ─────────────────────────
/**
 * Typed GET request.
 * Usage: const user = await apiClient.get<User>('/users/1')
 */
async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url, config)
  return response.data.data
}

/**
 * Typed POST request.
 */
async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.post<ApiResponse<T>>(url, data, config)
  return response.data.data
}

/**
 * Typed PATCH request.
 */
async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.patch<ApiResponse<T>>(url, data, config)
  return response.data.data
}

/**
 * Typed DELETE request.
 */
async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, config)
  return response.data.data
}

// ── Exports ──────────────────────────────────────────────────────────────────
// apiClient is the primary export — use it for all HTTP calls.
// The raw `api` instance is also exported for edge cases (e.g., file uploads).
export const apiClient = { get, post, patch, delete: del }

export default api
