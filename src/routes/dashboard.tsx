import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BarChart3, Clapperboard, FileText, LayoutDashboard, UserRound, Wallet } from 'lucide-react'
import { api, type Dashboard } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { DashboardShell, type NavItem } from '#/components/dashboard'
import { Notice, PageLoading } from '#/components/ui'
import { DocumentsPane, EarningsPane, OverviewPane, PayoutsPane, ProfilePane, TitlesPane } from '#/components/panes'

type Tab = 'overview' | 'titles' | 'earnings' | 'documents' | 'payouts' | 'profile'
const TABS: Tab[] = ['overview', 'titles', 'earnings', 'documents', 'payouts', 'profile']

export const Route = createFileRoute('/dashboard')({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined }),
  component: DashboardPage,
})

function DashboardPage() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const { tab = 'overview' } = Route.useSearch()
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (ready && !user) navigate({ to: '/login', search: { next: '/dashboard' } })
  }, [ready, user, navigate])

  const load = () => api.get<Dashboard>('/dashboard').then((d) => { setDash(d); setErr('') }).catch((e) => setErr(e.message))
  useEffect(() => { if (user) load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !user) return <PageLoading />
  const go = (t: string) => navigate({ to: '/dashboard', search: { tab: t as Tab } })
  const nav: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'titles', label: 'Titles', icon: Clapperboard, badge: dash?.pending_claims || undefined },
    { key: 'earnings', label: 'Earnings', icon: BarChart3 },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'payouts', label: 'Payments', icon: Wallet },
    { key: 'profile', label: 'Profile', icon: UserRound },
  ]
  return (
    <DashboardShell
      brand={<div className="flex flex-col"><span className="truncate font-head text-[15px] font-extrabold text-ink">{user.name}</span><span className="font-mono text-xs text-muted">{user.account_no}</span></div>}
      nav={nav} active={tab} onSelect={go}>
      {err && <Notice tone="danger">{err}</Notice>}
      {tab === 'overview' && (dash ? <OverviewPane dash={dash} go={go} /> : !err && <PageLoading />)}
      {tab === 'titles' && <TitlesPane onChanged={load} />}
      {tab === 'earnings' && <EarningsPane />}
      {tab === 'documents' && <DocumentsPane />}
      {tab === 'payouts' && <PayoutsPane onChanged={load} />}
      {tab === 'profile' && <ProfilePane />}
    </DashboardShell>
  )
}
