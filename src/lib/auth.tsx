import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, SIGNED_OUT_EVENT, type LoginCodeSent, type LoginResult, type Me } from './api'

/**
 * Producer sign-in with the account number UKO staff issued (UKP-123456), in two steps:
 *   sendCode(accountNo, password)        → POST /auth/login/code, e-mails a 6-digit code
 *   login(accountNo, password, code)     → POST /auth/login, starts a 2-hour session
 * A producer with no password yet (or who forgot it) asks for a set-password link and sets it on /set-password.
 */
type AuthCtx = {
  user: Me | null
  ready: boolean
  sendCode: (accountNo: string, password: string) => Promise<LoginCodeSent>
  login: (accountNo: string, password: string, code: string) => Promise<Me>
  requestPasswordLink: (accountNo: string) => Promise<{ sent: boolean; to: string }>
  setPassword: (token: string, password: string) => Promise<{ ok: boolean; account_no: string }>
  logout: () => Promise<void>
  refresh: () => Promise<Me | null>
  setUser: (u: Me) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setReady(true)
      return null
    }
    try {
      const u = await api.get<Me>('/auth/me')
      setUser(u)
      return u
    } catch {
      setToken(null)
      setUser(null)
      return null
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onSignedOut = () => setUser(null)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [refresh])

  const sendCode = useCallback((account_no: string, password: string) => api.post<LoginCodeSent>('/auth/login/code', { account_no, password }), [])
  const login = useCallback(async (account_no: string, password: string, code: string) => {
    const r = await api.post<LoginResult>('/auth/login', { account_no, password, code })
    setToken(r.token)
    setUser(r.user)
    return r.user
  }, [])
  const requestPasswordLink = useCallback((account_no: string) => api.post<{ sent: boolean; to: string }>('/auth/password/link', { account_no }), [])
  const setPassword = useCallback((token: string, password: string) => api.post<{ ok: boolean; account_no: string }>('/auth/password/set', { token, password }), [])
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, sendCode, login, requestPasswordLink, setPassword, logout, refresh, setUser }),
    [user, ready, sendCode, login, requestPasswordLink, setPassword, logout, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
