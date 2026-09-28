import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Eye, EyeOff, KeyRound } from 'lucide-react'
import { ApiError } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { useToast } from '#/lib/toast'
import { Button, Input, Notice } from '#/components/ui'

type Search = { token?: string }

export const Route = createFileRoute('/set-password')({
  validateSearch: (s: Record<string, unknown>): Search => ({ token: typeof s.token === 'string' && s.token ? s.token : undefined }),
  component: SetPasswordPage,
})

/**
 * Opened from the e-mailed link (account created by UKO staff, or a forgotten password): /set-password?token=…
 * Setting a password signs every open session out; the producer then signs in on /login with the account number.
 */
function SetPasswordPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const { setPassword } = useAuth()
  const toast = useToast()
  const [password, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) return setError('This link is missing its token — ask for a new one on the sign-in page.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      const r = await setPassword(token, password)
      toast.success(`Password set for ${r.account_no} — sign in now`)
      navigate({ to: '/login' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set the password. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const eye = (
    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="flex text-muted hover:text-ink">
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )

  return (
    <div className="flex flex-1 items-start justify-center bg-surface px-4 py-8 md:py-12">
      <form onSubmit={submit} className="flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-bg p-5 md:p-[26px]">
        <div className="flex flex-col gap-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-050 text-primary"><KeyRound size={17} /></span>
          <h1 className="text-[22px]">Set your password</h1>
          <p className="m-0 text-xs text-ink-2">For your UKO producers account. You sign in with your account number, this password and a code we e-mail you.</p>
        </div>
        {!token && (
          <Notice tone="warning" icon={<CircleAlert size={14} />}>
            This page needs the link from your e-mail. <Link to="/login" className="font-semibold text-primary-600 hover:underline">Ask for a new link</Link>
          </Notice>
        )}
        <Input label="New password" required type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} hint="At least 8 characters" value={password} onChange={(e) => setPw(e.target.value)} trailing={eye} />
        <Input label="Confirm password" required type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <Notice tone="danger" icon={<CircleAlert size={14} />}><span className="text-danger">{error}</span></Notice>}
        <Button type="submit" size="lg" full loading={busy} disabled={!token}>Set password</Button>
        <p className="m-0 text-center text-xs text-ink-2">
          Link expired? <Link to="/login" className="font-semibold text-primary-600 hover:underline">Ask for a new one on the sign-in page</Link>
        </p>
      </form>
    </div>
  )
}
