/**
 * Fetch wrapper for the UKO producers API (producers/back-end).
 *  - sends the producer session token (localStorage "uko_producer_token")
 *  - on 401 (expired / revoked session) clears the token and fires "uko-producer:signed-out" so the app returns to /login
 *  - throws ApiError with the server's `detail` message
 */
export const API_URL: string = import.meta.env.VITE_PRODUCERS_API_URL || 'http://127.0.0.1:8018'

const TOKEN_KEY = 'uko_producer_token'
export const SIGNED_OUT_EVENT = 'uko-producer:signed-out'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

type Query = Record<string, string | number | boolean | undefined | null>

export function qs(params?: Query): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// A FastAPI 422 body carries `detail` as a list of { loc, msg }: drop pydantic's prefix and name the field.
const PYDANTIC_PREFIX = /^(?:Value error|Assertion failed),\s+/

function validationMessage(d: any): string {
  const msg = String(d?.msg || 'is not valid').replace(PYDANTIC_PREFIX, '')
  const path = (Array.isArray(d?.loc) ? d.loc : []).slice(1)
  const field = path.map((p: unknown) => (typeof p === 'number' ? `[${p + 1}]` : String(p).replace(/_/g, ' '))).join(' ').trim()
  if (!field) return msg
  if (msg.toLowerCase().startsWith(field.split(' [')[0].toLowerCase())) return msg
  return `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${msg}`
}

async function request<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload: BodyInit | undefined
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, `The producers API is not reachable at ${API_URL} — start producers/back-end (run.ps1).`)
  }
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null)
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    }
    const detail = data?.detail
    const msg = Array.isArray(detail) ? detail.map(validationMessage).join('; ') : detail || res.statusText || 'Request failed'
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, params?: Query) => request<T>('GET', path + qs(params)),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ path: string; url: string; name: string }>('POST', '/upload', undefined, form)
  },
}

// ---------------------------------------------------------------- types
export type Me = {
  id: number; account_no: string; name: string; contact_name: string; email: string; phone: string; country: string
  address: string; status: string; since: string | null; last_login_at: string | null
}
export type LoginCodeSent = { sent: boolean; to: string; expires_in: number; resend_in: number; code?: string; simulated?: boolean }
export type LoginResult = { token: string; expires_at: string; expires_in: number; user: Me }

export type Sources = { paid: number; ad: number; ukoshop: number; mixed: number; free: number }
export type ViewStats = {
  views: number; paid_views: number; viewers: number; downloads: number; sources: Sources
  revenue_ksh: number; producer_ksh: number; uko_ksh: number; first_view: string | null; last_view: string | null
}
export type PeriodRow = { period: string; views: number; paid_views: number; revenue_ksh: number; producer_ksh: number; uko_ksh: number; sources: Sources }
export type Totals = {
  earned_ksh: number; paid_ksh: number; pending_payout_ksh: number; balance_ksh: number; views: number; paid_views: number
  revenue_ksh: number; uko_ksh: number; titles: number
}
export type Split = { producer: number; uko: number }
export type Dashboard = {
  producer: Me; split: Split; min_payout: number; totals: Totals; last_30_days: PeriodRow[]
  this_month: { views: number; producer_ksh: number; revenue_ksh: number }; today: { views: number; producer_ksh: number; revenue_ksh: number }
  pending_claims: number; support_email: string
}
export type DocKind = 'ownership' | 'distribution' | 'registration' | 'tax' | 'id' | 'other'
export type Doc = {
  id: number; title_id: number | null; kind: DocKind; name: string; url: string; status: 'pending' | 'approved' | 'rejected'
  note: string; reviewed_at: string | null; created_at: string | null
}
export type Title = {
  id: number; kind: 'movie' | 'tv'; tmdb_id: number; title: string; poster: string; rights_region: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; note: string; submitted_by: string; reviewed_at: string | null
  created_at: string | null; stats: ViewStats | null; documents: Doc[]
}
export type CatalogueItem = { kind: 'movie' | 'tv'; tmdb_id: number; title: string; poster: string; year: string; overview: string; companies: string[]; claimed: '' | 'yours' | 'other' }
export type Earnings = {
  group: 'day' | 'month'; since: string; until: string; split: Split; rows: PeriodRow[]
  titles: (ViewStats & { id: number; title: string; kind: 'movie' | 'tv' })[]
  totals: { views: number; paid_views: number; revenue_ksh: number; producer_ksh: number; uko_ksh: number }
}
export type Bank = {
  bank_name: string; bank_branch: string; bank_account_name: string; bank_account_number: string; swift_code: string
  bank_country: string; currency: string
}
/** A payment request: UKO finance pays it by hand by bank transfer. */
export type Payout = {
  id: number; amount: number; status: 'requested' | 'paid' | 'rejected' | 'cancelled'; reference: string; note: string
  bank: Bank & { summary: string }; requested_at: string | null; paid_at: string | null; decided_at: string | null
}
