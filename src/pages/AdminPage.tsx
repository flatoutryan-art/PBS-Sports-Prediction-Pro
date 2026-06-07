import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useProfile'
import { normalisePhone } from '@/hooks/useAuth'
import LeagueSettingsPanel from '@/components/LeagueSettingsPanel'
import type { FixtureWithTeams } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { clsx } from 'clsx'

// ─────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────

type Tab = 'settlement' | 'players' | 'fixtures'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'settlement', label: 'Settle',  icon: '⚽' },
  { id: 'players',    label: 'Players', icon: '👥' },
  { id: 'fixtures',   label: 'Fixtures',icon: '📅' },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-lg text-cream tracking-wide">{title}</h2>
      {subtitle && <p className="text-slate-500 text-xs font-body mt-0.5">{subtitle}</p>}
    </div>
  )
}

function FeedbackMsg({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <p className={clsx(
      'text-xs text-center font-body mt-3 rounded-lg py-2 px-3 border',
      msg.ok
        ? 'bg-green-900/20 text-green-400 border-green-900/30'
        : 'bg-red-900/20 text-red-400 border-red-900/30'
    )}>
      {msg.text}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 1: SETTLEMENT
// ─────────────────────────────────────────────────────────────

async function fetchSettlableFixtures(): Promise<FixtureWithTeams[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(`*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)`)
    .order('kickoff_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FixtureWithTeams[]
}

async function settleMatch(payload: {
  matchId: string; homeScore: number; awayScore: number; adminUid: string
}) {
  const { data, error } = await supabase.rpc('admin_settle_match', {
    p_match_id: payload.matchId,
    p_home_score: payload.homeScore,
    p_away_score: payload.awayScore,
    p_admin_uid: payload.adminUid,
  })
  if (error) throw error
  const result = data?.[0]
  if (!result?.success) throw new Error(result?.error_code ?? 'Settlement failed')
  return result
}

function SettlementRow({ fixture, adminUid }: { fixture: FixtureWithTeams; adminUid: string }) {
  const queryClient = useQueryClient()
  const [home, setHome] = useState(fixture.actual_home_score?.toString() ?? '')
  const [away, setAway] = useState(fixture.actual_away_score?.toString() ?? '')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: settleMatch,
    onSuccess: (data) => {
      setMsg({ text: `✓ Settled — ${data.predictions_settled} predictions scored`, ok: true })
      queryClient.invalidateQueries({ queryKey: ['admin-fixtures'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-full'] })
    },
    onError: (err: Error) => setMsg({ text: `⚠ ${err.message}`, ok: false }),
  })

  const isSettled = fixture.status === 'completed' && fixture.actual_home_score !== null

  return (
    <div className={clsx(
      'bg-slate-800 border rounded-xl p-4',
      isSettled ? 'border-green-700/20' : 'border-white/8'
    )}>
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[11px] text-slate-500 tracking-widest uppercase font-medium">
          {fixture.group_name ?? fixture.stage.toUpperCase()} · {format(parseISO(fixture.kickoff_at), 'EEE d MMM')}
        </span>
        <span className={clsx(
          'text-[11px] px-2 py-0.5 rounded-full font-medium',
          fixture.status === 'live'      ? 'bg-maroon/20 text-red-400 animate-pulse' :
          fixture.status === 'completed' ? 'bg-green-900/30 text-green-400' :
          'bg-slate-700 text-slate-400'
        )}>
          {fixture.status === 'live' ? '● Live' : fixture.status === 'completed' ? '✓ Done' : 'Upcoming'}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
        <p className="font-heading text-sm text-cream">{fixture.home_team.name}</p>
        <span className="font-display text-slate-700 text-lg px-1">vs</span>
        <p className="font-heading text-sm text-cream text-right">{fixture.away_team.name}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number" min={0} max={20} value={home}
          onChange={e => setHome(e.target.value)} placeholder="0"
          className="w-16 bg-slate-950 border border-slate-600 rounded-xl text-center py-2.5
                     font-display text-2xl tracking-widest text-cream outline-none
                     focus:border-gold transition-all"
        />
        <span className="font-display text-slate-600 text-xl flex-1 text-center">–</span>
        <input
          type="number" min={0} max={20} value={away}
          onChange={e => setAway(e.target.value)} placeholder="0"
          className="w-16 bg-slate-950 border border-slate-600 rounded-xl text-center py-2.5
                     font-display text-2xl tracking-widest text-cream outline-none
                     focus:border-gold transition-all"
        />
        <button
          onClick={() => {
            const h = parseInt(home), a = parseInt(away)
            if (!isNaN(h) && !isNaN(a)) mutate({ matchId: fixture.id, homeScore: h, awayScore: a, adminUid })
          }}
          disabled={isPending || home === '' || away === ''}
          className={clsx(
            'px-4 py-2.5 rounded-xl font-heading text-xs tracking-widest uppercase transition-all active:scale-95 ml-2',
            isSettled
              ? 'bg-slate-700 border border-slate-600 text-slate-300 hover:text-cream'
              : 'bg-shield-gradient border border-maroon/60 text-red-200 hover:border-maroon',
            (isPending || home === '' || away === '') && 'opacity-40 cursor-not-allowed'
          )}
        >
          {isPending ? '…' : isSettled ? 'Update' : 'Settle'}
        </button>
      </div>
      <FeedbackMsg msg={msg} />
    </div>
  )
}


// ─────────────────────────────────────────────────────────────
// TRIAL RESET PANEL (admin only — settlement tab footer)
// ─────────────────────────────────────────────────────────────

function ResetTrialPanel({ adminUid }: { adminUid: string }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'idle' | 'confirm1' | 'confirm2' | 'done'>('idle')
  const [passphrase, setPassphrase] = useState('')
  const [result, setResult] = useState<{ deleted: number; reset: number } | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleReset() {
    if (passphrase !== 'RESET_TRIAL_RUN') {
      setError('Incorrect passphrase.')
      return
    }
    setIsLoading(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('admin_reset_all_predictions', {
      p_admin_uid: adminUid,
      p_confirmation: passphrase,
    })

    setIsLoading(false)

    if (rpcError || !data?.[0]?.success) {
      const code = data?.[0]?.error_code
      const msgs: Record<string, string> = {
        UNAUTHORIZED: 'You are not authorised to do this.',
        WRONG_PASSPHRASE: 'Incorrect passphrase.',
        TOURNAMENT_IN_PROGRESS: 'Cannot reset — completed fixtures exist. The real tournament has started.',
      }
      setError(msgs[code ?? ''] ?? rpcError?.message ?? 'Reset failed.')
      return
    }

    setResult({ deleted: data[0].predictions_deleted, reset: data[0].points_reset })
    setStep('done')
    queryClient.invalidateQueries()
  }

  return (
    <div className="mt-8 border-t border-red-900/30 pt-6">
      <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500 text-sm">⚠</span>
          <p className="font-heading text-sm text-red-400 tracking-wide uppercase">Danger Zone</p>
        </div>
        <p className="text-xs text-slate-500 font-body leading-relaxed mb-3">
          Reset all predictions and player points to zero. Use this before the real tournament
          to clear trial-run data. <span className="text-red-400 font-medium">Irreversible.</span>
          {' '}Blocked automatically once any match has been settled.
        </p>

        {step === 'idle' && (
          <button onClick={() => setStep('confirm1')}
            className="text-xs text-red-500 border border-red-900/50 hover:border-red-700 hover:text-red-400 px-4 py-2 rounded-lg transition-all font-body">
            Reset Trial Run Data…
          </button>
        )}

        {step === 'confirm1' && (
          <div className="space-y-3">
            <p className="text-xs text-red-300 font-body">
              This will permanently delete <strong>all predictions</strong> and reset every player's score to 0.
              Are you sure?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep('idle')} className="flex-1 btn-ghost py-2 text-xs">Cancel</button>
              <button onClick={() => setStep('confirm2')}
                className="flex-1 bg-red-900/40 border border-red-700/60 text-red-300 text-xs font-heading tracking-widest uppercase py-2 rounded-xl hover:bg-red-900/60 transition-all">
                Yes, I'm Sure →
              </button>
            </div>
          </div>
        )}

        {step === 'confirm2' && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 tracking-widest uppercase font-medium block mb-1.5">
                Type <span className="text-red-400 font-mono">RESET_TRIAL_RUN</span> to confirm
              </label>
              <input
                type="text"
                value={passphrase}
                onChange={e => { setPassphrase(e.target.value); setError('') }}
                placeholder="RESET_TRIAL_RUN"
                autoCapitalize="characters"
                className="w-full bg-slate-950 border border-red-900/50 rounded-xl px-3 py-2.5
                           font-mono text-sm text-red-300 placeholder-slate-700 outline-none
                           focus:border-red-700 tracking-widest"
              />
              {error && <p className="text-red-400 text-xs mt-1 font-body">{error}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStep('idle'); setPassphrase(''); setError('') }}
                className="flex-1 btn-ghost py-2 text-xs">Cancel</button>
              <button
                onClick={handleReset}
                disabled={isLoading || passphrase !== 'RESET_TRIAL_RUN'}
                className="flex-1 bg-red-900 border border-red-700 text-red-100 text-xs font-heading tracking-widest uppercase py-2 rounded-xl hover:bg-red-800 transition-all disabled:opacity-40">
                {isLoading ? 'Resetting…' : '🗑 Reset Everything'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2.5 text-xs font-body text-green-400">
            ✓ Reset complete — {result.deleted} predictions deleted, {result.reset} player scores zeroed.
          </div>
        )}
      </div>
    </div>
  )
}

function SettlementTab({ adminUid }: { adminUid: string }) {
  const [filter, setFilter] = useState<'pending' | 'settled' | 'all'>('pending')

  const { data: fixtures, isLoading } = useQuery({
    queryKey: ['admin-fixtures'],
    queryFn: fetchSettlableFixtures,
    refetchInterval: 30_000,
  })

  const filtered = (fixtures ?? []).filter(f => {
    if (filter === 'pending') return f.status !== 'completed' || f.actual_home_score === null
    if (filter === 'settled') return f.status === 'completed' && f.actual_home_score !== null
    return true
  })

  const pendingCount = (fixtures ?? []).filter(f => f.status !== 'completed').length

  return (
    <div>
      <SectionHeader
        title="Result Settlement"
        subtitle="Enter final scores to score predictions and update the leaderboard."
      />

      {fixtures && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total',   value: fixtures.length },
            { label: 'Pending', value: pendingCount, highlight: pendingCount > 0 },
            { label: 'Settled', value: fixtures.length - pendingCount },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-white/6 rounded-xl p-3 text-center">
              <p className={clsx('font-display text-2xl', s.highlight ? 'text-gold' : 'text-cream')}>{s.value}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-0.5 font-body">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['pending', 'settled', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full border transition-all capitalize font-medium',
              filter === f ? 'bg-gold/12 border-gold text-gold' : 'bg-slate-800 border-white/8 text-slate-400'
            )}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-36 bg-slate-800 rounded-xl animate-pulse" />)}</div>}

      <div className="space-y-3">
        {filtered.map(f => <SettlementRow key={f.id} fixture={f} adminUid={adminUid} />)}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-10 text-slate-600 font-body">
            {filter === 'pending' ? 'All fixtures settled ✓' : 'Nothing here.'}
          </div>
        )}

      <ResetTrialPanel adminUid={adminUid} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 2: PLAYERS — Bulk Import + PIN Reset
// ─────────────────────────────────────────────────────────────

interface BulkResult {
  phone: string
  display_name: string
  status: 'inserted' | 'duplicate' | 'invalid'
  message: string
}

interface ParsedPlayer {
  display_name: string
  phone: string
  username: string
  valid: boolean
  error?: string
}

function parsePastedList(raw: string): ParsedPlayer[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Accept: "Ryan van Es, +27716858624" or "Ryan van Es +27716858624" or tab-separated
      const parts = line.split(/[,\t]+/).map(p => p.trim())
      if (parts.length < 2) {
        return { display_name: line, phone: '', username: '', valid: false, error: 'Could not parse — use "Name, Phone" format' }
      }
      const display_name = parts[0]
      const rawPhone = parts[1]
      const phone = normalisePhone(rawPhone)
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 11) {
        return { display_name, phone, username: '', valid: false, error: 'Invalid phone number' }
      }
      const username = display_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      return { display_name, phone, username, valid: true }
    })
}

function BulkImportSection({ adminUid }: { adminUid: string }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<ParsedPlayer[] | null>(null)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [step, setStep] = useState<'input' | 'validate' | 'done'>('input')

  function handleValidate() {
    const players = parsePastedList(raw)
    setParsed(players)
    setStep('validate')
  }

  async function handleImport() {
    if (!parsed) return
    const valid = parsed.filter(p => p.valid)
    if (!valid.length) return
    setIsImporting(true)

    const { data, error } = await supabase.rpc('admin_bulk_import_players', {
      p_players: valid.map(({ display_name, phone, username }) => ({ display_name, phone, username })),
      p_admin_uid: adminUid,
    })

    setIsImporting(false)
    if (error) { setResults([{ phone: '', display_name: '', status: 'invalid', message: error.message }]); return }
    setResults(data)
    setStep('done')
  }

  const statusIcon = { inserted: '✓', duplicate: '⚠', invalid: '✗' }
  const statusColor = {
    inserted:  'text-green-400',
    duplicate: 'text-yellow-400',
    invalid:   'text-red-400',
  }

  return (
    <div className="bg-slate-800 border border-white/8 rounded-xl p-4 mb-5">
      <p className="font-heading text-sm text-cream tracking-wide mb-1">Bulk Import Players</p>
      <p className="text-xs text-slate-500 font-body mb-3 leading-relaxed">
        Paste one player per line: <span className="text-slate-400 font-mono text-[11px]">Display Name, +27XXXXXXXXX</span>
      </p>

      {step === 'input' && (
        <>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={6}
            placeholder={"Ryan van Es, +27716858624\nTariq Booley, +27831234567\nSipho Mkhize, 0821234567"}
            className="w-full bg-slate-950 border border-slate-600 rounded-xl px-4 py-3
                       text-cream text-sm placeholder-slate-700 outline-none
                       focus:border-gold font-mono resize-none transition-all"
          />
          <button
            onClick={handleValidate}
            disabled={!raw.trim()}
            className="w-full mt-3 btn-primary py-3 disabled:opacity-40"
          >
            Validate List →
          </button>
        </>
      )}

      {step === 'validate' && parsed && (
        <>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto scrollbar-hide">
            {parsed.map((p, i) => (
              <div key={i} className={clsx(
                'flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm',
                p.valid
                  ? 'bg-slate-900 border-white/6'
                  : 'bg-red-900/10 border-red-900/30'
              )}>
                <span className={p.valid ? 'text-green-400' : 'text-red-400'}>{p.valid ? '✓' : '✗'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-cream text-sm truncate">{p.display_name || '—'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{p.phone || '—'}</p>
                  {p.error && <p className="text-[11px] text-red-400 mt-0.5">{p.error}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 text-xs text-slate-500 mb-3 font-body">
            <span className="text-green-400">{parsed.filter(p => p.valid).length} valid</span>
            <span>·</span>
            <span className="text-red-400">{parsed.filter(p => !p.valid).length} invalid</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setParsed(null); setStep('input') }}
              className="flex-1 btn-ghost py-2.5 text-xs">
              ← Edit
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || parsed.filter(p => p.valid).length === 0}
              className="flex-1 btn-primary py-2.5 text-xs disabled:opacity-40"
            >
              {isImporting ? 'Importing…' : `Import ${parsed.filter(p => p.valid).length} Players`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && results && (
        <>
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide mb-3">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900 border border-white/6 text-sm">
                <span className={statusColor[r.status]}>{statusIcon[r.status]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-sm truncate">{r.display_name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{r.phone}</p>
                </div>
                <span className={clsx('text-[10px] font-medium capitalize', statusColor[r.status])}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => { setRaw(''); setParsed(null); setResults(null); setStep('input') }}
            className="w-full btn-ghost py-2.5 text-xs">
            Import More
          </button>
        </>
      )}
    </div>
  )
}

interface PlayerRow {
  id: string
  display_name: string | null
  username: string
  phone: string
  is_registered: boolean
  total_points: number
  login_attempts: number
  locked_until: string | null
  last_login_at: string | null
}

async function fetchAllPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, phone, is_registered, total_points, login_attempts, locked_until, last_login_at')
    .order('is_registered', { ascending: false })
  if (error) throw error
  return data ?? []
}

function PinResetRow({ player, adminUid }: { player: PlayerRow; adminUid: string }) {
  const [tempPin, setTempPin] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [confirm, setConfirm] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_reset_pin', {
        p_profile_phone: player.phone,
        p_temp_pin: tempPin,
        p_admin_uid: adminUid,
      })
      if (error) throw error
      if (!data?.[0]?.success) throw new Error(data?.[0]?.error_code ?? 'Reset failed')
      return data[0]
    },
    onSuccess: () => {
      setMsg({ text: `✓ Temporary PIN set. Player must change on next login.`, ok: true })
      setConfirm(false)
      setTempPin('')
    },
    onError: (err: Error) => setMsg({ text: `⚠ ${err.message}`, ok: false }),
  })

  const isLocked = player.locked_until && new Date(player.locked_until) > new Date()

  return (
    <div className={clsx(
      'bg-slate-800 border rounded-xl p-4 transition-all',
      isLocked ? 'border-red-800/30' : player.is_registered ? 'border-white/7' : 'border-dashed border-slate-700'
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-cream text-sm">{player.display_name ?? player.username}</p>
            <span className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              player.is_registered
                ? 'bg-green-900/30 text-green-400'
                : 'bg-slate-700 text-slate-500'
            )}>
              {player.is_registered ? 'Registered' : 'Pending'}
            </span>
            {isLocked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 font-medium animate-pulse">
                Locked
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{player.phone}</p>
          {player.last_login_at && (
            <p className="text-[10px] text-slate-600 font-body mt-0.5">
              Last login: {format(parseISO(player.last_login_at), 'dd MMM yyyy HH:mm')}
            </p>
          )}
          {player.login_attempts > 0 && !isLocked && (
            <p className="text-[10px] text-yellow-600 font-body mt-0.5">
              {player.login_attempts} failed attempt{player.login_attempts > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-display text-xl text-gold">{player.total_points}</p>
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-body">pts</p>
        </div>
      </div>

      {player.is_registered && (
        <>
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors font-body border border-white/8 hover:border-red-800/40 px-3 py-1.5 rounded-lg mt-1"
            >
              🔑 Reset PIN
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 tracking-widest uppercase font-medium block mb-1">
                  Temporary PIN (6 digits)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempPin}
                    onChange={e => setTempPin(e.target.value.slice(0, 6))}
                    placeholder="123456"
                    className="flex-1 bg-slate-950 border border-slate-600 rounded-xl px-3 py-2
                               font-mono text-lg text-cream outline-none focus:border-gold tracking-widest text-center"
                  />
                  <button
                    onClick={() => mutate()}
                    disabled={isPending || tempPin.length !== 6}
                    className="bg-shield-gradient border border-maroon/60 text-red-200 text-xs
                               font-heading tracking-widest uppercase px-4 rounded-xl
                               hover:border-maroon transition-all disabled:opacity-40"
                  >
                    {isPending ? '…' : 'Set Temp PIN'}
                  </button>
                  <button onClick={() => { setConfirm(false); setTempPin('') }}
                    className="text-slate-600 hover:text-slate-400 transition-colors px-2 text-sm">
                    ✕
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1 font-body">
                  Player will be forced to create a new PIN on their next login.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      <FeedbackMsg msg={msg} />
    </div>
  )
}

function PlayersTab({ adminUid }: { adminUid: string }) {
  const [search, setSearch] = useState('')

  const { data: players, isLoading } = useQuery({
    queryKey: ['admin-players'],
    queryFn: fetchAllPlayers,
    refetchInterval: 60_000,
  })

  const filtered = (players ?? []).filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.phone.includes(q)
    )
  })

  return (
    <div>
      <SectionHeader
        title="Player Management"
        subtitle="Import new players and manage PINs for existing members."
      />

      <LeagueSettingsPanel adminUid={adminUid} />

      <BulkImportSection adminUid={adminUid} />

      <div className="flex items-center gap-2 mb-3">
        <p className="font-heading text-sm text-cream tracking-wide flex-1">
          Registered Players
          {players && (
            <span className="text-slate-500 text-xs ml-2 font-body">
              {players.filter(p => p.is_registered).length}/{players.length} active
            </span>
          )}
        </p>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5
                     text-sm text-cream placeholder-slate-600 outline-none w-32
                     focus:border-gold transition-all font-body"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(p => (
          <PinResetRow key={p.id} player={p} adminUid={adminUid} />
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-slate-600 py-8 font-body text-sm">
            {search ? 'No players match your search.' : 'No players yet — use Bulk Import above.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB 3: FIXTURES — Manage + Sync with API
// ─────────────────────────────────────────────────────────────

interface EditableFixture extends FixtureWithTeams {
  editing?: boolean
}

async function updateFixtureKickoff(id: string, kickoff_at: string, status: string) {
  const { error } = await supabase
    .from('fixtures')
    .update({ kickoff_at, status })
    .eq('id', id)
  if (error) throw error
}

// Fetch from a public World Cup 2026 API / Kaggle-sourced JSON endpoint.
// In production replace this URL with your actual data source.
const FIXTURES_API_URL = import.meta.env.VITE_FIXTURES_API_URL as string | undefined

async function syncFixturesFromAPI(adminUid: string): Promise<{
  synced: number; errors: number; details: string[]
}> {
  if (!FIXTURES_API_URL) throw new Error('VITE_FIXTURES_API_URL not set in .env')

  const res = await fetch(FIXTURES_API_URL)
  if (!res.ok) throw new Error(`API returned ${res.status}`)

  // Expected shape: Array of fixture objects with these fields
  // (adapt the mapping below to match your actual API response)
  const apiData = await res.json() as Array<{
    id: string
    home_team_id: string
    away_team_id: string
    kickoff_utc: string
    stage: string
    group: string | null
    venue: string | null
    round: number
  }>

  let synced = 0; let errors = 0
  const details: string[] = []

  for (const match of apiData) {
    const { data, error } = await supabase.rpc('admin_upsert_fixture', {
      p_external_id:   match.id,
      p_home_team_id:  match.home_team_id,
      p_away_team_id:  match.away_team_id,
      p_kickoff_at:    match.kickoff_utc,
      p_stage:         match.stage,
      p_group_name:    match.group ?? null,
      p_venue:         match.venue ?? null,
      p_round_number:  match.round,
      p_admin_uid:     adminUid,
    })
    if (error || !data?.[0]?.success) {
      errors++
      details.push(`✗ ${match.id}: ${error?.message ?? data?.[0]?.error_code}`)
    } else {
      synced++
      details.push(`✓ ${data[0].action}: ${match.id}`)
    }
  }

  return { synced, errors, details }
}

function FixturesTab({ adminUid }: { adminUid: string }) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKickoff, setEditKickoff] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [syncLog, setSyncLog] = useState<string[] | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const { data: fixtures, isLoading } = useQuery({
    queryKey: ['admin-fixtures'],
    queryFn: fetchSettlableFixtures,
  })

  function startEdit(f: FixtureWithTeams) {
    setEditingId(f.id)
    // datetime-local input expects format: "2026-06-15T18:00"
    setEditKickoff(f.kickoff_at.slice(0, 16))
    setEditStatus(f.status)
  }

  async function saveEdit(id: string) {
    setSavingId(id)
    try {
      await updateFixtureKickoff(id, new Date(editKickoff).toISOString(), editStatus)
      queryClient.invalidateQueries({ queryKey: ['admin-fixtures'] })
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
      setEditingId(null)
    } catch (e) {
      alert('Save failed: ' + (e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    setSyncLog(null)
    setSyncMsg(null)
    try {
      const result = await syncFixturesFromAPI(adminUid)
      setSyncLog(result.details)
      setSyncMsg({
        text: `Sync complete: ${result.synced} updated, ${result.errors} errors`,
        ok: result.errors === 0,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-fixtures'] })
      queryClient.invalidateQueries({ queryKey: ['fixtures'] })
    } catch (err) {
      setSyncMsg({ text: `⚠ Sync failed: ${(err as Error).message}`, ok: false })
    } finally {
      setIsSyncing(false)
    }
  }

  const statusOptions: FixtureWithTeams['status'][] = ['upcoming', 'live', 'completed']

  return (
    <div>
      <SectionHeader
        title="Fixture Management"
        subtitle="Edit kickoff times or sync the latest schedule from your data source."
      />

      {/* Sync panel */}
      <div className="bg-slate-800 border border-white/8 rounded-xl p-4 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-sm text-cream tracking-wide">Sync with API</p>
            <p className="text-xs text-slate-500 font-body mt-0.5 leading-relaxed">
              Pulls the latest kickoff times from <span className="text-slate-400 font-mono text-[11px]">VITE_FIXTURES_API_URL</span>.
              Safe to run multiple times — uses upsert on external_id.
            </p>
            {!FIXTURES_API_URL && (
              <p className="text-[11px] text-yellow-500 mt-1 font-body">
                ⚠ Set VITE_FIXTURES_API_URL in your .env to enable sync.
              </p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing || !FIXTURES_API_URL}
            className={clsx(
              'flex-shrink-0 bg-gold/10 border border-gold/30 text-gold text-xs font-heading',
              'tracking-widest uppercase px-4 py-2.5 rounded-xl transition-all active:scale-95',
              'hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-gold/30 border-t-gold rounded-full animate-spin" />
                Syncing…
              </span>
            ) : '↻ Sync'}
          </button>
        </div>
        <FeedbackMsg msg={syncMsg} />
        {syncLog && (
          <div className="mt-3 bg-slate-950 rounded-xl p-3 max-h-32 overflow-y-auto scrollbar-hide">
            {syncLog.map((line, i) => (
              <p key={i} className={clsx(
                'text-[11px] font-mono leading-relaxed',
                line.startsWith('✓') ? 'text-green-500' : 'text-red-400'
              )}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {/* Fixture list */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-2.5">
        {(fixtures ?? []).map(f => (
          <div key={f.id} className={clsx(
            'bg-slate-800 border rounded-xl p-4 transition-all',
            editingId === f.id ? 'border-gold/30' : 'border-white/7'
          )}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex-1 min-w-0">
                <p className="font-heading text-sm text-cream">
                  {f.home_team.name} <span className="text-slate-600">vs</span> {f.away_team.name}
                </p>
                <p className="text-[11px] text-slate-500 font-body mt-0.5">
                  {f.group_name ?? f.stage.toUpperCase()} ·{' '}
                  {f.external_id && <span className="font-mono text-slate-600">id:{f.external_id.slice(0,8)}…</span>}
                </p>
              </div>
              {editingId !== f.id && (
                <button
                  onClick={() => startEdit(f)}
                  className="text-[11px] text-slate-500 hover:text-gold border border-white/8 hover:border-gold/30 px-2.5 py-1 rounded-lg transition-all font-body flex-shrink-0"
                >
                  Edit
                </button>
              )}
            </div>

            {editingId === f.id ? (
              <div className="space-y-2 mt-2">
                <div>
                  <label className="text-[10px] text-slate-500 tracking-widest uppercase font-medium block mb-1">Kickoff (Local UTC)</label>
                  <input
                    type="datetime-local"
                    value={editKickoff}
                    onChange={e => setEditKickoff(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-600 rounded-xl px-3 py-2
                               text-cream text-sm outline-none focus:border-gold font-body"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 tracking-widest uppercase font-medium block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-600 rounded-xl px-3 py-2
                               text-cream text-sm outline-none focus:border-gold font-body"
                  >
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingId(null)} className="flex-1 btn-ghost py-2 text-xs">Cancel</button>
                  <button
                    onClick={() => saveEdit(f.id)}
                    disabled={savingId === f.id}
                    className="flex-1 btn-primary py-2 text-xs disabled:opacity-40"
                  >
                    {savingId === f.id ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-xs text-slate-400 font-body mt-1">
                <span>⏰ {format(parseISO(f.kickoff_at), 'dd MMM yyyy · HH:mm')} UTC</span>
                <span className={clsx(
                  'px-2 py-0.5 rounded-full font-medium',
                  f.status === 'live'      ? 'bg-maroon/15 text-red-400' :
                  f.status === 'completed' ? 'bg-green-900/20 text-green-500' :
                  'bg-slate-700 text-slate-400'
                )}>
                  {f.status}
                </span>
                {f.last_synced_at && (
                  <span className="text-slate-600">
                    synced {format(parseISO(f.last_synced_at), 'dd MMM HH:mm')}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin(user?.id)
  const [tab, setTab] = useState<Tab>('settlement')

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-500 font-body">Admin access only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl tracking-[2px] text-cream">ADMIN</h1>
          <p className="text-[10px] text-slate-600 tracking-widest uppercase font-body">PBS Picks Pro</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-maroon animate-pulse ml-1" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-900 border border-white/7 rounded-2xl p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-heading tracking-widest uppercase transition-all',
              tab === t.id
                ? 'bg-slate-700 text-cream border border-white/8 shadow-card'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'settlement' && <SettlementTab adminUid={user!.id} />}
      {tab === 'players'    && <PlayersTab    adminUid={user!.id} />}
      {tab === 'fixtures'   && <FixturesTab   adminUid={user!.id} />}
    </div>
  )
}
