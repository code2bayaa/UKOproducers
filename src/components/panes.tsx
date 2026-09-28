/** The producer dashboard's panes: overview, titles and claims, earnings, documents, payouts, profile. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banknote, CircleAlert, Clapperboard, ExternalLink, FileText, Info, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { api, type Bank, type CatalogueItem, type Dashboard, type Doc, type DocKind, type Earnings, type Me, type Payout, type Title } from '#/lib/api'
import { useAuth } from '#/lib/auth'
import { useToast } from '#/lib/toast'
import { fmtDate, kes, num } from '#/lib/format'
import { Button, Chip, EmptyState, Input, KeyValue, Notice, PageLoading, Select, StatCard, Tabs, cx } from './ui'
import { DashHeader, Panel } from './dashboard'
import { EarningsBars } from './charts'

const TONE: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning', approved: 'success', verified: 'success', rejected: 'danger', withdrawn: 'neutral',
  requested: 'warning', paid: 'success', cancelled: 'neutral',
}
const STATUS_WORD: Record<string, string> = {
  pending: 'Under review', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn', verified: 'Verified',
  requested: 'Being processed', paid: 'Paid', cancelled: 'Cancelled',
}
export const DOC_LABEL: Record<DocKind, string> = {
  ownership: 'Proof of ownership', distribution: 'Distribution rights (licence / agreement)', registration: 'Company registration',
  tax: 'Tax registration (KRA PIN / TIN)', id: 'ID of the signatory', other: 'Other',
}
const dayLabel = (p: string) => new Date(`${p}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
const monthLabel = (p: string) => new Date(`${p}-01T00:00:00`).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })

function useLoad<T>(path: string, params?: Record<string, string | number | undefined>) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const sig = JSON.stringify(params || {})
  const load = () => api.get<T>(path, params).then((d) => { setData(d); setErr('') }).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [path, sig]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, reload: load }
}

// ------------------------------------------------------------------ overview
export function OverviewPane({ dash, go }: { dash: Dashboard; go: (t: string) => void }) {
  const t = dash.totals
  return (
    <>
      <DashHeader title="Overview" sub={`Your titles on UKO · ${dash.split.producer}% of what every paid view earns is yours, ${dash.split.uko}% is UKO's`} />
      {t.titles === 0 && (
        <Notice tone="info" icon={<Info size={16} />} title="No approved titles yet"
          action={<Button size="sm" onClick={() => go('titles')}>Claim a title</Button>}>
          {dash.pending_claims ? `${dash.pending_claims} claim${dash.pending_claims === 1 ? ' is' : 's are'} with UKO for review. ` : ''}
          Once UKO approves a title against your proof of rights, you earn your share of every view since it was first watched.
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Balance you can request" value={kes(t.balance_ksh)} />
        <StatCard label="Earned, all time" value={kes(t.earned_ksh)} />
        <StatCard label="This month" value={kes(dash.this_month.producer_ksh)} />
        <StatCard label="Today" value={kes(dash.today.producer_ksh)} />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Views, all time" value={num(t.views)} />
        <StatCard label="Paid views" value={num(t.paid_views)} />
        <StatCard label="Revenue from your titles" value={kes(t.revenue_ksh)} />
        <StatCard label="Paid out" value={kes(t.paid_ksh)} />
      </div>
      <Panel title="Your share, last 30 days" sub="Hover a bar for the day's views and share.">
        <EarningsBars rows={dash.last_30_days} label={dayLabel} />
      </Panel>
      <Panel title="How your share is worked out">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-ink-2">
          <li>Viewers pay for each title with UKO credits: credits they bought, or credits earned by watching Google or UKOshop ads.</li>
          <li>Of what each of those views earns, {dash.split.producer}% is yours and {dash.split.uko}% is UKO's. A view on free credits earns nothing, but is still counted.</li>
          <li>A viewer is charged for a title once a day, so one view here is one viewer watching on one day.</li>
          <li>To get paid, send a payment request with your bank details. UKO finance checks it and pays it by bank transfer. The smallest request is {kes(dash.min_payout)}.</li>
        </ul>
        <p className="m-0 mt-3 text-xs text-muted">Questions: {dash.support_email}</p>
      </Panel>
    </>
  )
}

// ------------------------------------------------------------------ titles
export function TitlesPane({ onChanged }: { onChanged: () => void }) {
  const { data, err, reload } = useLoad<{ titles: Title[] }>('/titles')
  const [claiming, setClaiming] = useState(false)
  const toast = useToast()
  const withdraw = async (t: Title) => {
    if (!window.confirm(`Withdraw your claim on ${t.title}?`)) return
    try {
      await api.post(`/titles/${t.id}/withdraw`)
      toast.success('Claim withdrawn')
      reload()
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  return (
    <>
      <DashHeader title="Titles" sub="The movies and series you hold the rights to on UKO." actions={!claiming && <Button icon={<Plus size={15} />} onClick={() => setClaiming(true)}>Claim a title</Button>} />
      {claiming && <ClaimForm onDone={() => { setClaiming(false); reload(); onChanged() }} onCancel={() => setClaiming(false)} />}
      {err ? <Notice tone="danger">{err}</Notice> : !data ? <PageLoading /> : data.titles.length === 0 ? (
        <EmptyState icon={<Clapperboard size={24} />} title="No titles yet" sub="Claim a title UKO shows, with proof that you hold its rights." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.titles.map((t) => (
            <div key={t.id} className="flex gap-4 rounded-lg border border-border bg-bg p-4">
              <Poster src={t.poster} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink">{t.title}</span>
                  <Chip size="sm" tone={TONE[t.status]}>{STATUS_WORD[t.status]}</Chip>
                </div>
                <span className="text-xs text-muted">{t.kind === 'tv' ? 'Series — every episode counts' : 'Movie'}{t.rights_region ? ` · ${t.rights_region}` : ''}</span>
                {t.note && <span className={cx('text-xs', t.status === 'rejected' ? 'text-danger' : 'text-ink-2')}>UKO: {t.note}</span>}
                {t.stats ? (
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <Figure label="Views" value={num(t.stats.views)} />
                    <Figure label="Paid views" value={num(t.stats.paid_views)} />
                    <Figure label="Your share" value={kes(t.stats.producer_ksh)} />
                  </div>
                ) : t.status === 'pending' && <span className="text-xs text-ink-2">UKO checks your documents, then approves the claim. You then earn from the first view.</span>}
                {t.documents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.documents.map((d) => <a key={d.id} href={d.url} target="_blank" rel="noreferrer"><Chip size="sm" tone={TONE[d.status]}><FileText size={11} /> {DOC_LABEL[d.kind].split(' (')[0]}</Chip></a>)}
                  </div>
                )}
                {t.status === 'pending' && <button type="button" onClick={() => withdraw(t)} className="self-start text-xs text-ink-2 hover:text-danger">Withdraw claim</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex flex-col rounded-md bg-surface px-2 py-1.5"><span className="text-[10px] text-muted">{label}</span><span className="font-semibold text-ink">{value}</span></div>
}

function Poster({ src }: { src: string }) {
  return (
    <div className="flex h-[96px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Clapperboard size={20} className="text-border-strong" />}
    </div>
  )
}

type Upload = { kind: DocKind; name: string; path: string; url: string }

function DocUploader({ kinds, onUploaded }: { kinds: DocKind[]; onUploaded: (u: Upload) => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<DocKind>(kinds[0])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const r = await api.upload(file)
      onUploaded({ kind, name: r.name || file.name, path: r.path, url: r.url })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Select label="Document" value={kind} onChange={(e) => setKind(e.target.value as DocKind)} className="flex-1">
        {kinds.map((k) => <option key={k} value={k}>{DOC_LABEL[k]}</option>)}
      </Select>
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button type="button" variant="outline" icon={<Upload size={14} />} loading={busy} onClick={() => input.current?.click()}>Upload PDF or photo</Button>
    </div>
  )
}

function ClaimForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogueItem[]>([])
  const [picked, setPicked] = useState<CatalogueItem | null>(null)
  const [region, setRegion] = useState('Kenya')
  const [docs, setDocs] = useState<Upload[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) return setResults([])
      api.get<{ results: CatalogueItem[] }>('/catalogue', { q }).then((r) => setResults(r.results)).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  const submit = async () => {
    if (!picked) return
    setErr('')
    setBusy(true)
    try {
      await api.post('/titles', { kind: picked.kind, tmdb_id: picked.tmdb_id, rights_region: region, documents: docs.map(({ kind, name, path }) => ({ kind, name, path })) })
      toast.success(`Claim on ${picked.title} sent to UKO for review`)
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  const hasProof = docs.some((d) => d.kind === 'ownership' || d.kind === 'distribution')
  return (
    <Panel title="Claim a title" action={<Button size="sm" variant="ghost" icon={<X size={14} />} onClick={onCancel}>Cancel</Button>}>
      <div className="flex flex-col gap-4">
        {!picked ? (
          <>
            <Input label="Find the movie or series" placeholder="Start typing its title" value={q} onChange={(e) => setQ(e.target.value)} leading={<Search size={14} />} autoFocus />
            {results.length > 0 && (
              <div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
                {results.map((r) => (
                  <button key={`${r.kind}-${r.tmdb_id}`} type="button" disabled={!!r.claimed} onClick={() => setPicked(r)}
                    className="flex items-center gap-3 px-3 py-2 text-left hover:bg-surface disabled:opacity-60">
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-surface-2">{r.poster && <img src={r.poster} alt="" className="h-full w-full object-cover" />}</div>
                    <span className="flex-1 text-[13px] text-ink">{r.title}<span className="block text-xs text-muted">{r.kind === 'tv' ? 'Series' : 'Movie'}{r.year ? ` · ${r.year}` : ''}{r.companies.length ? ` · ${r.companies.slice(0, 2).join(', ')}` : ''}</span></span>
                    {r.claimed === 'yours' && <Chip size="sm">Already yours</Chip>}
                    {r.claimed === 'other' && <Chip size="sm">Assigned to another rights holder</Chip>}
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && results.length === 0 && <p className="m-0 text-xs text-muted">Nothing on UKO matches that title.</p>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-md bg-surface p-3">
              <Poster src={picked.poster} />
              <div className="flex flex-1 flex-col">
                <span className="font-semibold text-ink">{picked.title}</span>
                <span className="text-xs text-muted">{picked.kind === 'tv' ? 'Series' : 'Movie'}{picked.year ? ` · ${picked.year}` : ''}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
            </div>
            <Input label="Territory you hold the rights for" hint="e.g. Kenya, East Africa, Worldwide" value={region} onChange={(e) => setRegion(e.target.value)} />
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">Proof of your rights</span>
              <p className="m-0 text-xs text-ink-2">A copyright registration, the licence or distribution agreement for this territory, or a chain-of-title letter. Add company documents too if UKO has not seen them.</p>
              {docs.map((d, i) => (
                <div key={d.path} className="flex items-center gap-2 text-[13px]">
                  <FileText size={14} className="text-primary" />
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-ink hover:underline">{DOC_LABEL[d.kind]} — {d.name}</a>
                  <button type="button" aria-label="Remove" onClick={() => setDocs(docs.filter((_, j) => j !== i))} className="p-1 text-ink-2 hover:text-danger"><X size={14} /></button>
                </div>
              ))}
              <DocUploader kinds={['ownership', 'distribution', 'registration', 'tax', 'id', 'other']} onUploaded={(u) => setDocs([...docs, u])} />
            </div>
            {err && <Notice tone="danger" icon={<CircleAlert size={14} />}>{err}</Notice>}
            <Button onClick={submit} loading={busy} disabled={!hasProof || region.trim().length < 2}>{hasProof ? 'Send the claim to UKO' : 'Upload proof of ownership or rights first'}</Button>
          </>
        )}
      </div>
    </Panel>
  )
}

// ------------------------------------------------------------------ earnings
export function EarningsPane() {
  const [group, setGroup] = useState<'day' | 'month'>('day')
  const [titleId, setTitleId] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const { data, err } = useLoad<Earnings>('/earnings', { group, title_id: titleId || undefined, since: since || undefined, until: until || undefined })
  const label = group === 'day' ? dayLabel : monthLabel
  return (
    <>
      <DashHeader title="Earnings" sub="Views and your share of the revenue, by day or by month." />
      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={group} onChange={(g) => { setGroup(g); setSince(''); setUntil('') }} tabs={[{ key: 'day', label: 'Daily' }, { key: 'month', label: 'Monthly' }]} />
        <Select label="Title" value={titleId} onChange={(e) => setTitleId(e.target.value)} className="min-w-[200px]">
          <option value="">All approved titles</option>
          {data?.titles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </Select>
        <Input label="From" type="date" value={since || data?.since || ''} onChange={(e) => setSince(e.target.value)} />
        <Input label="To" type="date" value={until || data?.until || ''} onChange={(e) => setUntil(e.target.value)} />
      </div>
      {err ? <Notice tone="danger">{err}</Notice> : !data ? <PageLoading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Views" value={num(data.totals.views)} />
            <StatCard label="Paid views" value={num(data.totals.paid_views)} />
            <StatCard label="Revenue" value={kes(data.totals.revenue_ksh)} />
            <StatCard label={`Your share (${data.split.producer}%)`} value={kes(data.totals.producer_ksh)} />
          </div>
          <Panel title={`Your share per ${group}`}>
            <EarningsBars rows={data.rows} label={label} />
          </Panel>
          <Panel title="Breakdown" padded={false}>
            {data.rows.length === 0 ? <p className="m-0 p-5 text-[13px] text-muted">No views in this period.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead><tr className="border-b border-border text-left text-xs text-ink-2">
                    {[group === 'day' ? 'Day' : 'Month', 'Views', 'Paid', 'Bought credits', 'Ads', 'Free', 'Revenue', `Your share (${data.split.producer}%)`, `UKO (${data.split.uko}%)`].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...data.rows].reverse().map((r) => (
                      <tr key={r.period} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 text-ink">{label(r.period)}</td>
                        <td className="px-4 py-2">{num(r.views)}</td>
                        <td className="px-4 py-2">{num(r.paid_views)}</td>
                        <td className="px-4 py-2 text-ink-2">{num(r.sources.paid)}</td>
                        <td className="px-4 py-2 text-ink-2">{num(r.sources.ad + r.sources.ukoshop + r.sources.mixed)}</td>
                        <td className="px-4 py-2 text-ink-2">{num(r.sources.free)}</td>
                        <td className="whitespace-nowrap px-4 py-2">{kes(r.revenue_ksh)}</td>
                        <td className="whitespace-nowrap px-4 py-2 font-semibold text-ink">{kes(r.producer_ksh)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink-2">{kes(r.uko_ksh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {data.titles.length > 1 && !titleId && (
            <Panel title="By title (this period)" padded={false}>
              <div className="flex flex-col divide-y divide-border">
                {data.titles.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-semibold text-ink">{t.title}</span>
                    <span className="text-ink-2">{num(t.views)} views · <b className="text-ink">{kes(t.producer_ksh)}</b></span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ documents
export function DocumentsPane() {
  const toast = useToast()
  const { data, err, reload } = useLoad<{ documents: Doc[] }>('/documents')
  const add = async (u: Upload) => {
    try {
      await api.post('/documents', { kind: u.kind, name: u.name, path: u.path })
      toast.success('Document sent to UKO for review')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  const remove = async (d: Doc) => {
    try {
      await api.del(`/documents/${d.id}`)
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  return (
    <>
      <DashHeader title="Documents" sub="Proof of your rights and your company's papers. UKO reviews each one." />
      <Panel title="Add a company document" sub="Title-specific proof is added when you claim the title.">
        <DocUploader kinds={['registration', 'tax', 'id', 'ownership', 'distribution', 'other']} onUploaded={add} />
      </Panel>
      {err ? <Notice tone="danger">{err}</Notice> : !data ? <PageLoading /> : data.documents.length === 0 ? (
        <EmptyState icon={<FileText size={24} />} title="No documents yet" />
      ) : (
        <Panel title="On file" padded={false}>
          <div className="flex flex-col divide-y divide-border">
            {data.documents.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                <FileText size={16} className="text-primary" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:underline">{DOC_LABEL[d.kind]} <ExternalLink size={11} className="inline" /></a>
                  <span className="truncate text-xs text-muted">{d.name} · {fmtDate(d.created_at, false)}{d.note ? ` · UKO: ${d.note}` : ''}</span>
                </div>
                <Chip size="sm" tone={TONE[d.status]}>{STATUS_WORD[d.status]}</Chip>
                {d.status === 'pending' && <button type="button" aria-label="Delete" onClick={() => remove(d)} className="p-1 text-ink-2 hover:text-danger"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}

// ------------------------------------------------------------------ payment requests
// No direct withdrawal: the producer requests an amount to a bank account and UKO finance pays it by bank transfer.
const EMPTY_BANK: Bank = { bank_name: '', bank_branch: '', bank_account_name: '', bank_account_number: '', swift_code: '',
  bank_country: 'Kenya', currency: 'KES' }

export function PayoutsPane({ onChanged }: { onChanged: () => void }) {
  const toast = useToast()
  const payouts = useLoad<{ payouts: Payout[]; summary: Dashboard['totals']; min_payout: number; last_bank: Bank | null }>('/payouts')
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState<Bank>(EMPTY_BANK)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const s = payouts.data?.summary
  const open = payouts.data?.payouts.find((p) => p.status === 'requested')
  const lastBank = payouts.data?.last_bank

  // start from the bank account of the last request
  useEffect(() => { if (lastBank) setBank(lastBank) }, [lastBank?.bank_account_number]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Bank) => (e: { target: { value: string } }) => setBank({ ...bank, [k]: e.target.value })
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    setErr('')
    try {
      await fn()
      toast.success(ok)
      payouts.reload()
      onChanged()
      return true
    } catch (e: any) {
      if (key === 'request') setErr(e.message)
      else toast.error(e.message)
      return false
    } finally {
      setBusy('')
    }
  }
  const request = async () => {
    if (!window.confirm(`Request ${kes(Number(amount))} to ${bank.bank_account_name}, ${bank.bank_name} ${bank.bank_account_number}?`)) return
    if (await act('request', () => api.post('/payouts', { amount: Number(amount), ...bank }), 'Payment request sent — UKO finance will pay it by bank transfer')) setAmount('')
  }

  return (
    <>
      <DashHeader title="Payments" sub="Request payment of your balance to your bank account. UKO pays it by bank transfer." />
      {s && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Balance" value={kes(s.balance_ksh)} />
          <StatCard label="Being processed" value={kes(s.pending_payout_ksh)} />
          <StatCard label="Paid out" value={kes(s.paid_ksh)} />
          <StatCard label="Earned, all time" value={kes(s.earned_ksh)} />
        </div>
      )}
      <Panel title="Request a payment">
        {!payouts.data ? <PageLoading /> : open ? (
          <Notice tone="info">Your request of {kes(open.amount)} to {open.bank.summary}, sent {fmtDate(open.requested_at)}, is being processed. You can send another once it is paid.</Notice>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); request() }}>
            <Input label="Amount (KSh)" type="number" required min={payouts.data.min_payout} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              hint={`From ${kes(payouts.data.min_payout)} up to your balance`} className="sm:w-56" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Account name" required hint="Should match your company name" value={bank.bank_account_name} onChange={set('bank_account_name')} />
              <Input label="Account number" required value={bank.bank_account_number} onChange={set('bank_account_number')} />
              <Input label="Bank" required value={bank.bank_name} onChange={set('bank_name')} />
              <Input label="Branch" value={bank.bank_branch} onChange={set('bank_branch')} />
              <Select label="Account currency" value={bank.currency} onChange={set('currency')}>
                {['KES', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Input label="SWIFT / BIC" hint="Needed for a foreign-currency account" value={bank.swift_code} onChange={set('swift_code')} />
              <Input label="Bank country" value={bank.bank_country} onChange={set('bank_country')} />
            </div>
            <p className="m-0 text-xs text-muted">UKO checks the account name against your company before paying. Payments are made by hand, usually within a few working days.</p>
            {err && <Notice tone="danger" icon={<CircleAlert size={14} />}>{err}</Notice>}
            <div className="flex justify-end">
              <Button type="submit" icon={<Banknote size={15} />} loading={busy === 'request'} disabled={!amount || Number(amount) <= 0}>Send payment request</Button>
            </div>
          </form>
        )}
      </Panel>

      <Panel title="Your requests" padded={false}>
        {!payouts.data ? <PageLoading /> : payouts.data.payouts.length === 0 ? <p className="m-0 p-5 text-[13px] text-muted">No payment requests yet.</p> : (
          <div className="flex flex-col divide-y divide-border">
            {payouts.data.payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-ink">{kes(p.amount)} <span className="font-normal text-ink-2">to {p.bank.bank_account_name ? `${p.bank.bank_account_name} · ` : ''}{p.bank.summary}</span></span>
                  <span className="text-xs text-muted">Requested {fmtDate(p.requested_at)}{p.paid_at ? ` · paid ${fmtDate(p.paid_at)}` : p.decided_at ? ` · ${STATUS_WORD[p.status].toLowerCase()} ${fmtDate(p.decided_at)}` : ''}{p.reference ? ` · ref ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
                </div>
                <Chip size="sm" tone={TONE[p.status]}>{STATUS_WORD[p.status]}</Chip>
                {p.status === 'requested' && <Button size="sm" variant="ghost" loading={busy === `c${p.id}`} onClick={() => act(`c${p.id}`, () => api.post(`/payouts/${p.id}/cancel`), 'Payment request cancelled')}>Cancel</Button>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}

// ------------------------------------------------------------------ profile
export function ProfilePane() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ contact_name: user?.contact_name || '', phone: user?.phone || '', country: user?.country || '', address: user?.address || '' })
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const save = async () => {
    setBusy(true)
    try {
      setUser(await api.put<Me>('/me', f))
      toast.success('Profile saved')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <DashHeader title="Profile" />
      <Panel title="Account">
        <div className="flex flex-col gap-1.5">
          <KeyValue label="Company" value={user.name} />
          <KeyValue label="Account number" value={<span className="font-mono">{user.account_no}</span>} />
          <KeyValue label="Sign-in email" value={user.email} />
          <KeyValue label="With UKO since" value={fmtDate(user.since, false) || '—'} />
        </div>
        <p className="m-0 mt-3 text-xs text-muted">To change the company name or the sign-in email, write to producers@uko.co.ke.</p>
      </Panel>
      <Panel title="Contact details">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Contact person" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
            <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <Input label="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
            <Input label="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </div>
          <div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </Panel>
    </>
  )
}
