/**
 * MatchDashboard — Stage 5 optimised
 *
 * Performance fixes applied:
 * 1. MatchCard wrapped in React.memo — only re-renders when its own
 *    fixture or prediction prop changes (object equality via stable Map lookup)
 * 2. predictionMap built with useMemo — not rebuilt on every filter/UI state change
 * 3. Filtered arrays (live/upcoming/completed) also memoized
 * 4. ScoreInput wrapped in memo — prevents re-render cascade when sibling input changes
 * 5. staleTime tuned per query type:
 *    - fixtures: 2 min stale (team data rarely changes mid-tournament)
 *    - predictions: 30s stale (user may open two tabs)
 *    - refetchInterval only fires when tab is visible (refetchIntervalInBackground: false)
 * 6. upsertPrediction uses optimistic update to avoid spinner flash
 */
import { useState, useMemo, memo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FixtureWithTeams, Prediction } from '@/lib/types'
import { format, isToday } from 'date-fns'
import { clsx } from 'clsx'

// ─── Query keys (centralised to avoid string typos) ──────────
export const QUERY_KEYS = {
  fixtures:    ['fixtures'] as const,
  predictions: (userId: string) => ['predictions', userId] as const,
}

// ─── Data Fetching ───────────────────────────────────────────
async function fetchFixtures(): Promise<FixtureWithTeams[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*)
    `)
    .order('kickoff_at', { ascending: true })
  if (error) throw error
  return data as FixtureWithTeams[]
}

async function fetchUserPredictions(userId: string): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

async function upsertPrediction(payload: {
  user_id: string; match_id: string; home_score: number; away_score: number
}): Promise<Prediction> {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,match_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── ScoreInput (memoized — only re-renders when value changes) ──
const ScoreInput = memo(function ScoreInput({
  value, onChange, disabled,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <input
      type="number" min={0} max={20}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={clsx(
        'w-full bg-slate-950 border rounded-lg text-center py-2',
        'font-display text-2xl tracking-widest text-cream outline-none transition-all',
        disabled
          ? 'border-slate-700 opacity-50 cursor-not-allowed'
          : 'border-slate-600 focus:border-gold focus:ring-2 focus:ring-gold/10'
      )}
    />
  )
})

// ─── MatchCard (memoized — skips re-render if fixture + prediction unchanged) ──
interface MatchCardProps {
  fixture: FixtureWithTeams
  prediction: Prediction | undefined
  userId: string
}

const MatchCard = memo(function MatchCard({ fixture, prediction, userId }: MatchCardProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() ?? '')
  const [saved, setSaved] = useState(!!prediction)

  // Sync score inputs when prediction data arrives from DB (async fetch
  // completes after component mount, so initial state would be empty)
  useEffect(() => {
    if (prediction) {
      setHomeScore(prediction.home_score.toString())
      setAwayScore(prediction.away_score.toString())
      setSaved(true)
    }
  }, [prediction?.id, prediction?.home_score, prediction?.away_score])

  const isLive      = fixture.status === 'live'
  const isCompleted = fixture.status === 'completed'
  const isLocked    = isLive || isCompleted
  const kickoff     = new Date(fixture.kickoff_at)

  // Stable callbacks — won't recreate on every render
  const handleHomeChange = useCallback((v: string) => { setHomeScore(v); setSaved(false) }, [])
  const handleAwayChange = useCallback((v: string) => { setAwayScore(v); setSaved(false) }, [])

  const { mutate, isPending } = useMutation({
    mutationFn: upsertPrediction,
    // Optimistic update: immediately reflect the saved state before DB confirms
    onMutate: async (newPred) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.predictions(userId) })
      const previous = queryClient.getQueryData<Prediction[]>(QUERY_KEYS.predictions(userId))
      queryClient.setQueryData<Prediction[]>(QUERY_KEYS.predictions(userId), old => {
        if (!old) return old
        const idx = old.findIndex(p => p.match_id === newPred.match_id)
        if (idx === -1) return [...old, { ...newPred, id: 'optimistic', points_earned: null, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }]
        return old.map((p, i) => i === idx ? { ...p, ...newPred } : p)
      })
      return { previous }
    },
    onSuccess: () => setSaved(true),
    onError: (_err, _vars, ctx) => {
      // Roll back on error
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEYS.predictions(userId), ctx.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.predictions(userId) })
    },
  })

  function handleSubmit() {
    const home = parseInt(homeScore), away = parseInt(awayScore)
    if (isNaN(home) || isNaN(away)) return
    mutate({ user_id: userId, match_id: fixture.id, home_score: home, away_score: away })
  }

  return (
    <div
      onClick={() => !isCompleted && setExpanded(v => !v)}
      className={clsx(
        'relative bg-slate-800 border rounded-xl px-5 py-4 mb-3 cursor-pointer',
        'transition-all duration-200 overflow-hidden group',
        'hover:-translate-y-px hover:shadow-card-hover',
        isLive      && 'border-maroon/50',
        !isLive && saved  && 'border-gold/25',
        !isLive && !saved && 'border-white/7',
        isCompleted && 'opacity-70 cursor-default'
      )}
    >
      {/* Left accent bar */}
      <div className={clsx(
        'absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200',
        isLive ? 'bg-maroon' : saved ? 'bg-gold' : 'bg-transparent group-hover:bg-gold/50'
      )} />

      {/* Meta row */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-slate-500 tracking-widest uppercase font-medium">
          {fixture.group_name ?? fixture.stage.toUpperCase()}
        </span>
        {isLive ? (
          <span className="bg-maroon text-red-300 text-[10px] px-2 py-[2px] rounded-full tracking-widest uppercase font-medium animate-pulse">
            ● Live
          </span>
        ) : isCompleted ? (
          <span className="text-xs text-slate-500">Full Time</span>
        ) : (
          <span className="text-xs text-slate-400">
            {isToday(kickoff)
              ? `Today · ${format(kickoff, 'HH:mm')}`
              : format(kickoff, 'EEE d MMM · HH:mm')}
            {fixture.venue && ` · ${fixture.venue}`}
          </span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xl flex-shrink-0">
            {fixture.home_team.flag_url
              ? <img src={fixture.home_team.flag_url} alt={fixture.home_team.name} className="w-6 h-6 rounded-full object-cover" loading="lazy" />
              : '🏴'}
          </div>
          <div>
            <div className="font-heading text-base font-medium text-cream tracking-wide">{fixture.home_team.name}</div>
            <div className="text-[11px] text-slate-500 tracking-widest">{fixture.home_team.short_name}</div>
          </div>
        </div>

        {/* Score / Prediction display */}
        <div className="flex flex-col items-center gap-1">
          {isCompleted || isLive ? (
            <div className={clsx('font-display text-3xl tracking-[6px] leading-none', isLive ? 'text-gold' : 'text-slate-400')}>
              {fixture.actual_home_score} : {fixture.actual_away_score}
            </div>
          ) : prediction ? (
            <>
              <div className="font-display text-2xl tracking-[4px] leading-none text-gold/80">
                {prediction.home_score} : {prediction.away_score}
              </div>
              <div className="text-[10px] text-gold/50 tracking-widest uppercase">your pick</div>
            </>
          ) : (
            <>
              <div className="font-display text-3xl tracking-[6px] leading-none text-slate-700">— : —</div>
              <div className="text-[11px] text-slate-500 tracking-widest uppercase">vs</div>
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-3 justify-end">
          <div className="text-right">
            <div className="font-heading text-base font-medium text-cream tracking-wide">{fixture.away_team.name}</div>
            <div className="text-[11px] text-slate-500 tracking-widest">{fixture.away_team.short_name}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xl flex-shrink-0">
            {fixture.away_team.flag_url
              ? <img src={fixture.away_team.flag_url} alt={fixture.away_team.name} className="w-6 h-6 rounded-full object-cover" loading="lazy" />
              : '🏴'}
          </div>
        </div>
      </div>

      {/* Points badge (completed) */}
      {isCompleted && prediction?.points_earned !== null && prediction?.points_earned !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className={clsx(
            'text-xs px-3 py-1 rounded-full font-medium tracking-wide',
            prediction.points_earned === 5 ? 'bg-gold/15 text-gold border border-gold/30'
            : prediction.points_earned === 3 ? 'bg-maroon/15 text-red-300 border border-maroon/30'
            : 'bg-slate-700 text-slate-400 border border-slate-600'
          )}>
            {prediction.points_earned === 5 ? '⚡ Exact Score · +5 pts'
            : prediction.points_earned === 3 ? '✓ Correct Winner/Draw · +3 pts'
            : '✗ Incorrect · +0 pts'}
          </div>
          <span className="text-xs text-slate-500">
            Your pick: {prediction.home_score} – {prediction.away_score}
          </span>
        </div>
      )}

      {/* Prediction input (expanded) */}
      {expanded && !isCompleted && (
        <div className="mt-4 pt-4 border-t border-white/6 animate-slide-up" onClick={e => e.stopPropagation()}>
          <p className="text-[11px] text-slate-500 tracking-widest uppercase font-medium mb-2">Your Prediction</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <ScoreInput value={homeScore} onChange={handleHomeChange} disabled={isLocked} />
            <span className="font-display text-xl text-slate-600 tracking-widest">—</span>
            <ScoreInput value={awayScore} onChange={handleAwayChange} disabled={isLocked} />
          </div>
          {!isLocked && (
            <button
              onClick={handleSubmit}
              disabled={isPending || homeScore === '' || awayScore === ''}
              className={clsx(
                'w-full mt-3 py-2 rounded-lg font-heading text-sm tracking-widest uppercase transition-all',
                saved ? 'bg-gold/15 border border-gold/40 text-gold'
                : 'bg-shield-gradient border border-maroon/60 text-red-200 hover:text-white hover:border-maroon',
                (isPending || homeScore === '' || awayScore === '') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isPending ? 'Saving…' : saved ? '✓ Prediction Saved' : 'Lock In Prediction'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  // Custom comparison: only re-render if the fixture or prediction actually changed
  return (
    prev.fixture.id             === next.fixture.id &&
    prev.fixture.status         === next.fixture.status &&
    prev.fixture.actual_home_score === next.fixture.actual_home_score &&
    prev.fixture.actual_away_score === next.fixture.actual_away_score &&
    prev.prediction?.id         === next.prediction?.id &&
    prev.prediction?.home_score === next.prediction?.home_score &&
    prev.prediction?.away_score === next.prediction?.away_score &&
    prev.prediction?.points_earned === next.prediction?.points_earned &&
    prev.userId                 === next.userId
  )
})

// ─── Main Dashboard ──────────────────────────────────────────
const STAGE_FILTERS = ['All', 'Today', 'Group', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']

interface MatchDashboardProps {
  userId: string
}

export default function MatchDashboard({ userId }: MatchDashboardProps) {
  const [stageFilter, setStageFilter] = useState('All')

  // Fixtures: stale after 2 minutes; refetch every 30s ONLY when tab is visible
  const { data: fixtures, isLoading: fixturesLoading, error } = useQuery({
    queryKey: QUERY_KEYS.fixtures,
    queryFn: fetchFixtures,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  // Predictions: stale after 30s (user may have two tabs open)
  const { data: predictions } = useQuery({
    queryKey: QUERY_KEYS.predictions(userId),
    queryFn: () => fetchUserPredictions(userId),
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  })

  // Memoized Map — only rebuilt when predictions array reference changes
  const predictionMap = useMemo(
    () => new Map(predictions?.map(p => [p.match_id, p])),
    [predictions]
  )

  // Memoized filtered arrays — only recomputed when fixtures data or filter changes
  const { liveFixtures, upcomingFixtures, completedFixtures } = useMemo(() => {
    const filtered = fixtures?.filter(f => {
      if (stageFilter === 'All')   return true
      if (stageFilter === 'Today') return isToday(new Date(f.kickoff_at))
      return f.stage.toLowerCase().includes(stageFilter.toLowerCase().replace(/[-\s]/g, ''))
    }) ?? []
    return {
      liveFixtures:     filtered.filter(f => f.status === 'live'),
      upcomingFixtures: filtered.filter(f => f.status === 'upcoming'),
      completedFixtures: filtered.filter(f => f.status === 'completed'),
    }
  }, [fixtures, stageFilter])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 flex-col gap-2">
        <span className="text-2xl">⚠️</span>
        <p className="text-sm font-body">Failed to load fixtures. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto scrollbar-hide pb-1">
        {STAGE_FILTERS.map(stage => (
          <button key={stage} onClick={() => setStageFilter(stage)}
            className={clsx(
              'text-xs px-4 py-[5px] rounded-full transition-all font-medium tracking-wide border flex-shrink-0',
              stageFilter === stage
                ? 'bg-gold/12 border-gold text-gold'
                : 'bg-slate-800 border-white/8 text-slate-400 hover:border-gold/40 hover:text-gold/80'
            )}>
            {stage}
          </button>
        ))}
      </div>

      {fixturesLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 border border-white/7 rounded-xl h-[90px] animate-pulse" />
          ))}
        </div>
      )}

      {liveFixtures.length > 0 && (
        <section>
          <SectionLabel>Live Now</SectionLabel>
          {liveFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {upcomingFixtures.length > 0 && (
        <section>
          <SectionLabel>{stageFilter === 'Today' ? "Today's Matches" : 'Upcoming'}</SectionLabel>
          {upcomingFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {completedFixtures.length > 0 && (
        <section>
          <SectionLabel>Results</SectionLabel>
          {completedFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {!fixturesLoading && liveFixtures.length === 0 && upcomingFixtures.length === 0 && completedFixtures.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="font-display text-4xl mb-2 text-slate-700">NO MATCHES</div>
          <p className="text-sm font-body">No fixtures found for this filter.</p>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-500 tracking-[3px] uppercase font-medium mb-3 mt-5">
      {children}
      <div className="flex-1 h-px bg-white/6" />
    </div>
  )
}
