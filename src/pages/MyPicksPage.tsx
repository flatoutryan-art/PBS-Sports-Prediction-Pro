import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'
import { format, isToday } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────
interface PickRow {
  fixture_id: string
  kickoff_at: string
  stage: string
  group_name: string | null
  status: string
  home_name: string
  home_short: string
  home_flag: string | null
  away_name: string
  away_short: string
  away_flag: string | null
  actual_home: number | null
  actual_away: number | null
  pred_id: string | null
  home_score: number | null
  away_score: number | null
  points_earned: number | null
}

// ─── Data fetching ────────────────────────────────────────────
async function fetchPicks(userId: string): Promise<PickRow[]> {
  // Fetch all fixtures + left-join user's predictions
  const { data: fixtures, error: fErr } = await supabase
    .from('fixtures')
    .select(`
      id, kickoff_at, stage, group_name, status,
      actual_home_score, actual_away_score,
      home_team:teams!fixtures_home_team_id_fkey(name, short_name, flag_url),
      away_team:teams!fixtures_away_team_id_fkey(name, short_name, flag_url)
    `)
    .order('kickoff_at', { ascending: true })

  if (fErr) throw fErr

  const { data: preds, error: pErr } = await supabase
    .from('predictions')
    .select('id, match_id, home_score, away_score, points_earned')
    .eq('user_id', userId)

  if (pErr) throw pErr

  const predMap = new Map((preds ?? []).map(p => [p.match_id, p]))

  return (fixtures ?? []).map((f: any) => {
    const p = predMap.get(f.id) ?? null
    return {
      fixture_id:  f.id,
      kickoff_at:  f.kickoff_at,
      stage:       f.stage,
      group_name:  f.group_name,
      status:      f.status,
      home_name:   f.home_team?.name ?? '?',
      home_short:  f.home_team?.short_name ?? '?',
      home_flag:   f.home_team?.flag_url ?? null,
      away_name:   f.away_team?.name ?? '?',
      away_short:  f.away_team?.short_name ?? '?',
      away_flag:   f.away_team?.flag_url ?? null,
      actual_home: f.actual_home_score ?? null,
      actual_away: f.actual_away_score ?? null,
      pred_id:     p?.id ?? null,
      home_score:  p?.home_score ?? null,
      away_score:  p?.away_score ?? null,
      points_earned: p?.points_earned ?? null,
    }
  })
}

async function savePrediction(payload: {
  user_id: string; match_id: string; home_score: number; away_score: number
}) {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,match_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/80 border border-white/7 rounded-xl p-4 flex flex-col items-center">
      <span className={clsx('font-display text-2xl tracking-wider', color)}>{value}</span>
      <span className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">{label}</span>
    </div>
  )
}

// ─── Pick card ────────────────────────────────────────────────
interface PickCardProps {
  row: PickRow
  userId: string
  onSaved: () => void
}

const PickCard = memo(function PickCard({ row, userId, onSaved }: PickCardProps) {
  const queryClient = useQueryClient()
  const isCompleted = row.status === 'completed'
  const isLive      = row.status === 'live'
  const isLocked    = isCompleted || isLive
  const kickoff     = new Date(row.kickoff_at)
  const hasPick     = row.pred_id !== null

  // Pre-fill inputs from saved prediction
  const [home, setHome] = useState(row.home_score?.toString() ?? '')
  const [away, setAway] = useState(row.away_score?.toString() ?? '')
  const [saved, setSaved] = useState(hasPick)

  // Re-sync when data changes (e.g. after refetch)
  useEffect(() => {
    if (row.home_score !== null && row.away_score !== null) {
      setHome(row.home_score.toString())
      setAway(row.away_score.toString())
      setSaved(true)
    }
  }, [row.pred_id, row.home_score, row.away_score])

  const { mutate, isPending } = useMutation({
    mutationFn: () => savePrediction({
      user_id:    userId,
      match_id:   row.fixture_id,
      home_score: parseInt(home),
      away_score: parseInt(away),
    }),
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['picks', userId] })
      onSaved()
    },
  })

  const handleSave = useCallback(() => {
    if (home === '' || away === '' || isNaN(parseInt(home)) || isNaN(parseInt(away))) return
    mutate()
  }, [home, away, mutate])

  const pointsColor =
    row.points_earned === 5 ? 'text-gold' :
    row.points_earned === 3 ? 'text-red-300' :
    row.points_earned === 0 ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className={clsx(
      'bg-slate-800 border rounded-xl p-4',
      isLive      && 'border-maroon/40',
      isCompleted && hasPick && row.points_earned !== null && 'border-white/10',
      !isLocked && hasPick  && 'border-gold/20',
      !isLocked && !hasPick && 'border-white/7',
    )}>
      {/* Meta */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] text-slate-500 tracking-widest uppercase">
          {row.group_name ?? row.stage}
        </span>
        <span className="text-[10px] text-slate-500">
          {isLive ? (
            <span className="text-maroon animate-pulse font-medium">● Live</span>
          ) : isCompleted ? 'Full Time' : isToday(kickoff)
            ? `Today · ${format(kickoff, 'HH:mm')}`
            : format(kickoff, 'EEE d MMM · HH:mm')}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-2">
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamFlag flag={row.home_flag} name={row.home_name} />
          <span className="font-heading text-sm text-cream truncate">{row.home_name}</span>
        </div>

        {/* Centre: actual score or VS */}
        <div className="flex-shrink-0 text-center px-2">
          {isCompleted || isLive ? (
            <span className="font-display text-lg tracking-widest text-slate-400">
              {row.actual_home ?? '?'} – {row.actual_away ?? '?'}
            </span>
          ) : (
            <span className="text-xs text-slate-600 tracking-widest">VS</span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-heading text-sm text-cream truncate text-right">{row.away_name}</span>
          <TeamFlag flag={row.away_flag} name={row.away_name} />
        </div>
      </div>

      {/* Prediction row */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-500 tracking-widest uppercase flex-shrink-0 w-16">
          Your pick
        </span>

        {isLocked ? (
          // Completed/live: show pick as text
          <div className="flex items-center gap-1.5">
            {hasPick ? (
              <>
                <span className="font-display text-sm tracking-widest text-gold/80">
                  {row.home_score} – {row.away_score}
                </span>
                {row.points_earned !== null && (
                  <span className={clsx('text-xs font-medium ml-2', pointsColor)}>
                    {row.points_earned === 5 ? '⚡ +5 pts' :
                     row.points_earned === 3 ? '✓ +3 pts' : '✗ +0 pts'}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-600 italic">No pick made</span>
            )}
          </div>
        ) : (
          // Upcoming: editable inputs + save button
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number" min={0} max={20}
              value={home}
              onChange={e => { setHome(e.target.value); setSaved(false) }}
              className="w-12 bg-slate-900 border border-slate-700 rounded-lg text-center py-1
                         font-display text-base tracking-widest text-cream outline-none
                         focus:border-gold focus:ring-1 focus:ring-gold/20"
            />
            <span className="text-slate-600 font-display">–</span>
            <input
              type="number" min={0} max={20}
              value={away}
              onChange={e => { setAway(e.target.value); setSaved(false) }}
              className="w-12 bg-slate-900 border border-slate-700 rounded-lg text-center py-1
                         font-display text-base tracking-widest text-cream outline-none
                         focus:border-gold focus:ring-1 focus:ring-gold/20"
            />
            <button
              onClick={handleSave}
              disabled={isPending || home === '' || away === ''}
              className={clsx(
                'ml-auto px-3 py-1 rounded-lg text-xs font-heading tracking-widest uppercase transition-all',
                saved
                  ? 'bg-gold/15 border border-gold/40 text-gold'
                  : 'bg-maroon/80 border border-maroon text-red-200 hover:bg-maroon',
                (isPending || home === '' || away === '') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isPending ? '…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

function TeamFlag({ flag, name }: { flag: string | null; name: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
      {flag
        ? <img src={flag} alt={name} className="w-5 h-5 rounded-full object-cover" loading="lazy" />
        : <span className="text-sm">🏴</span>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
type Filter = 'All' | 'Upcoming' | 'Completed' | 'No Pick'

export default function MyPicksPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('All')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['picks', user?.id],
    queryFn: () => fetchPicks(user!.id),
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
  })

  // ─── Stats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const withPick = rows.filter(r => r.pred_id !== null)
    return {
      points:  withPick.reduce((s, r) => s + (r.points_earned ?? 0), 0),
      exact:   withPick.filter(r => r.points_earned === 5).length,
      correct: withPick.filter(r => r.points_earned === 3).length,
      pending: withPick.filter(r => r.status === 'upcoming' || r.status === 'live').length,
    }
  }, [rows])

  // ─── Filter ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    switch (filter) {
      case 'Upcoming':  return rows.filter(r => r.status === 'upcoming' || r.status === 'live')
      case 'Completed': return rows.filter(r => r.status === 'completed')
      case 'No Pick':   return rows.filter(r => r.pred_id === null && (r.status === 'upcoming' || r.status === 'live'))
      default:          return rows
    }
  }, [rows, filter])

  // Group by status for display
  const live      = filtered.filter(r => r.status === 'live')
  const upcoming  = filtered.filter(r => r.status === 'upcoming')
  const completed = filtered.filter(r => r.status === 'completed')

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['picks', user?.id] })
  }, [queryClient, user?.id])

  const FILTERS: Filter[] = ['All', 'Upcoming', 'Completed', 'No Pick']

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-cream tracking-wide mb-1">My Picks</h1>
      <p className="text-xs text-slate-500 tracking-widest uppercase font-body mb-5">Your prediction history</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Points"  value={stats.points}  color="text-gold" />
        <StatCard label="Exact"   value={stats.exact}   color="text-gold" />
        <StatCard label="Correct" value={stats.correct} color="text-red-300" />
        <StatCard label="Pending" value={stats.pending} color="text-slate-300" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'text-xs px-4 py-[5px] rounded-full transition-all font-medium tracking-wide border',
              filter === f
                ? 'bg-gold/12 border-gold text-gold'
                : 'bg-slate-800 border-white/8 text-slate-400 hover:border-gold/40 hover:text-gold/80'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-5">
          {live.length > 0 && (
            <Section label="Live Now">
              {live.map(r => <PickCard key={r.fixture_id} row={r} userId={user!.id} onSaved={handleSaved} />)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section label="Upcoming">
              {upcoming.map(r => <PickCard key={r.fixture_id} row={r} userId={user!.id} onSaved={handleSaved} />)}
            </Section>
          )}
          {completed.length > 0 && (
            <Section label="Results">
              {completed.map(r => <PickCard key={r.fixture_id} row={r} userId={user!.id} onSaved={handleSaved} />)}
            </Section>
          )}
          {live.length === 0 && upcoming.length === 0 && completed.length === 0 && (
            <p className="text-center text-slate-600 py-10 font-body">
              {filter === 'No Pick' ? 'No upcoming matches without a pick — great job!' : 'No predictions found for this filter.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500 tracking-[3px] uppercase font-medium mb-3">
        {label}
        <div className="flex-1 h-px bg-white/6" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
