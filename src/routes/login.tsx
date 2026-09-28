import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, CircleAlert, Eye, EyeOff, KeyRound, MailCheck } from 'lucide-react'
import { ApiError, type LoginCodeSent } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { useToast } from '#/lib/toast'
import { Button, Input, Notice } from '#/components/ui'

type Search = { next?: string }

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): Search => ({ next: typeof s.next === 'string' && s.next.startsWith('/') ? s.next : undefined }),
  component: LoginPage,
})

const BENEFITS = [
  'See how often your titles are watched on UKO, day by day and month by month',
  'Your 60% share of what every paid view earns, from the very first view',
  'Upload proof of your rights and claim more titles',
  'Request payment to your bank account',
]

/**
 * Producer sign-in: the account number UKO gave you + your password, then the 6-digit code e-mailed to you.
 * No password yet, or forgot it → a set-password link to the email UKO has on file.
 */
function LoginPage() {
  const navigate = useNavigate()
  const { next } = Route.useSearch()
  const { sendCode, login, requestPasswordLink, user, ready } = useAuth()
  const toast = useToast()
  const [accountNo, setAccountNo] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [show, setShow] = useState(false)
  const [sent, setSent] = useState<LoginCodeSent | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkSentTo, setLinkSentTo] = useState('')

  useEffect(() => {
    if (ready && user) navigate({ to: (next || '/dashboard') as any })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not sign in. Check your connection and try again.')

  const requestCode = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await sendCode(accountNo.trim(), password)
      setSent(r)
      setCode('')
      setCooldown(r.resend_in)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const signIn = async () => {
    setError('')
    setBusy(true)
    try {
      const u = await login(accountNo.trim(), password, code.trim())
      toast.success(`Welcome, ${u.contact_name?.split(' ')[0] || u.name}`)
      navigate({ to: (next || '/dashboard') as any })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (sent) signIn()
    else requestCode()
  }

  const emailLink = async () => {
    setError('')
    setLinkSentTo('')
    if (!accountNo.trim()) return setError('Enter your account number first, then ask for the link.')
    setLinkBusy(true)
    try {
      const r = await requestPasswordLink(accountNo.trim())
      setLinkSentTo(r.to)
    } catch (err) {
      fail(err)
    } finally {
      setLinkBusy(false)
    }
  }

  return (
    <div className="flex-1 bg-surface px-4 py-6 md:py-10">
      <div className="mx-auto flex max-w-[860px] flex-col gap-6 md:flex-row md:items-stretch md:gap-7">
        <form onSubmit={submit} className="order-1 flex flex-1 flex-col gap-4 rounded-lg border border-border bg-bg p-5 md:order-2 md:p-[26px]">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px]">Producer sign in</h1>
            <p className="m-0 text-xs text-ink-2">Use the account number UKO sent you, e.g. UKP-123456.</p>
          </div>
          <Input label="Account number" required autoComplete="username" placeholder="UKP-123456" value={accountNo} disabled={!!sent}
            onChange={(e) => setAccountNo(e.target.value.toUpperCase())} />
          <Input
            label="Password"
            required
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            disabled={!!sent}
            onChange={(e) => setPassword(e.target.value)}
            trailing={<button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="flex text-muted hover:text-ink">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
          />

          {sent && (
            <>
              <Notice tone="info" icon={<MailCheck size={14} />}>
                {sent.simulated
                  ? <>E-mail is not set up on this server, so no code was sent to <b>{sent.to}</b>.</>
                  : <>We e-mailed a 6-digit code to <b>{sent.to}</b>.</>}{' '}
                It expires in {Math.round(sent.expires_in / 60)} minutes.
              </Notice>
              {sent.simulated && sent.code && (
                <Notice tone="warning" icon={<KeyRound size={14} />} title="Simulation — your code">
                  <span className="font-head text-lg font-extrabold tracking-[0.3em] text-ink">{sent.code}</span>
                </Notice>
              )}
              <Input label="Sign-in code from your e-mail" required autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </>
          )}

          {error && <Notice tone="danger" icon={<CircleAlert size={14} />}><span className="text-danger">{error}</span></Notice>}

          {sent ? (
            <>
              <Button type="submit" size="lg" full loading={busy} disabled={code.length !== 6}>Sign in</Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setSent(null); setCode(''); setError('') }} className="text-ink-2 hover:text-ink">Use a different account</button>
                <button type="button" onClick={requestCode} disabled={busy || cooldown > 0} className="font-semibold text-primary disabled:text-muted">
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <Button type="submit" size="lg" full loading={busy}>Send sign-in code</Button>
              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
                <p className="m-0 text-[12px] text-ink-2">First time here or forgot your password?</p>
                <Button type="button" variant="outline" size="sm" loading={linkBusy} onClick={emailLink} icon={<KeyRound size={14} />}>Email me a set-password link</Button>
                {linkSentTo && (
                  <p className="m-0 text-[11px] leading-relaxed text-ink-2">
                    If that is a UKO producers account, a link to set your password is on its way to {linkSentTo}. It works once and expires in 1 hour.
                  </p>
                )}
              </div>
            </>
          )}
          <p className="m-0 text-center text-xs text-ink-2">Hold the rights to a title on UKO and have no account? Write to producers@uko.co.ke</p>
        </form>
        <aside className="grad-hero order-2 flex w-full flex-col justify-between gap-8 rounded-[20px] p-6 text-white md:order-1 md:min-h-[460px] md:w-[360px] md:shrink-0 md:p-7">
          <div className="flex flex-col gap-3.5">
            <span className="font-head text-xl font-extrabold">UKO producers</span>
            <h2 className="text-[24px] leading-[1.2] text-white md:text-[28px]">Your titles on UKO.<br />Your share of every view.</h2>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {BENEFITS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-white/80">
                <Check size={16} className="mt-0.5 shrink-0 text-secondary" /> {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
