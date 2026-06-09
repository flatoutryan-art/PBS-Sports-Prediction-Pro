import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FixtureWithTeams, Prediction } from '@/lib/types'
import { format, isPast, isFuture, isToday } from 'date-fns'
import { clsx } from 'clsx'

// ─── Data Fetching ──────────────────────────────────────────

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
  user_id: string
  match_id: string
  home_score: number
  away_score: number
}): Promise<Prediction> {
  const { data, error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,match_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Sub-components ─────────────────────────────────────────

interface ScoreInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function ScoreInput({ value, onChange, disabled }: ScoreInputProps) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={clsx(
        'w-full bg-slate-950 border rounded-lg text-center py-2',
        'font-display text-2xl tracking-widest text-cream',
        'outline-none transition-all',
        disabled
          ? 'border-slate-700 opacity-50 cursor-not-allowed'
          : 'border-slate-600 focus:border-gold focus:ring-2 focus:ring-gold/10'
      )}
    />
  )
}

// ─── Match Card ──────────────────────────────────────────────

interface MatchCardProps {
  fixture: FixtureWithTeams
  prediction: Prediction | undefined
  userId: string
}

function MatchCard({ fixture, prediction, userId }: MatchCardProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() ?? '')
  const [saved, setSaved] = useState(!!prediction)

  const isLive = fixture.status === 'live'
  const isCompleted = fixture.status === 'completed'
  const isPredictionLocked = isLive || isCompleted
  const kickoff = new Date(fixture.kickoff_at)

  const { mutate, isPending } = useMutation({
    mutationFn: upsertPrediction,
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['predictions', userId] })
    },
  })

  function handleSubmit() {
    const home = parseInt(homeScore)
    const away = parseInt(awayScore)
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
        isLive && 'border-maroon/50',
        !isLive && saved && 'border-gold/25',
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
            {isToday(kickoff) ? `Today · ${format(kickoff, 'HH:mm')}` : format(kickoff, 'EEE d MMM · HH:mm')}
            {fixture.venue && ` · ${fixture.venue}`}
          </span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xl">
            {fixture.home_team.flag_url ? (
              <img src={fixture.home_team.flag_url} alt={fixture.home_team.name} className="w-6 h-6 rounded-full object-cover" />
            ) : '🏴'}
          </div>
          <div>
            <div className="font-heading text-base font-medium text-cream tracking-wide">
              {fixture.home_team.name}
            </div>
            <div className="text-[11px] text-slate-500 tracking-widest">
              {fixture.home_team.short_name}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          {isCompleted || isLive ? (
            <div className={clsx(
              'font-display text-3xl tracking-[6px] leading-none',
              isLive ? 'text-gold' : 'text-slate-400'
            )}>
              {fixture.actual_home_score} : {fixture.actual_away_score}
            </div>
          ) : (
            <div className="font-display text-3xl tracking-[6px] leading-none text-slate-700">
              — : —
            </div>
          )}
          {!isCompleted && !isLive && (
            <div className="text-[11px] text-slate-500 tracking-widest uppercase">vs</div>
          )}
        </div>

        <div className="flex items-center gap-3 justify-end">
          <div className="text-right">
            <div className="font-heading text-base font-medium text-cream tracking-wide">
              {fixture.away_team.name}
            </div>
            <div className="text-[11px] text-slate-500 tracking-widest">
              {fixture.away_team.short_name}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xl">
            {fixture.away_team.flag_url ? (
              <img src={fixture.away_team.flag_url} alt={fixture.away_team.name} className="w-6 h-6 rounded-full object-cover" />
            ) : '🏴'}
          </div>
        </div>
      </div>

      {/* Points earned badge (completed) */}
      {isCompleted && prediction && prediction.points_earned !== null && (
        <div className="mt-3 flex items-center gap-2">
          <div className={clsx(
            'text-xs px-3 py-1 rounded-full font-medium tracking-wide',
            prediction.points_earned === 3
              ? 'bg-gold/15 text-gold border border-gold/30'
              : prediction.points_earned === 1
              ? 'bg-maroon/15 text-red-300 border border-maroon/30'
              : 'bg-slate-700 text-slate-400 border border-slate-600'
          )}>
            {prediction.points_earned === 3
              ? '⚡ Exact Score · +3 pts'
              : prediction.points_earned === 1
              ? '✓ Correct Result · +1 pt'
              : '✗ Wrong Pick · +0 pts'}
          </div>
          <span className="text-xs text-slate-500">
            Your pick: {prediction.home_score} – {prediction.away_score}
          </span>
        </div>
      )}

      {/* Prediction input (expandable) */}
      {expanded && !isCompleted && (
        <div
          className="mt-4 pt-4 border-t border-white/6 animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[11px] text-slate-500 tracking-widest uppercase font-medium mb-2">
            Your Prediction
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <ScoreInput value={homeScore} onChange={v => { setHomeScore(v); setSaved(false) }} disabled={isPredictionLocked} />
            <span className="font-display text-xl text-slate-600 tracking-widest">—</span>
            <ScoreInput value={awayScore} onChange={v => { setAwayScore(v); setSaved(false) }} disabled={isPredictionLocked} />
          </div>
          {!isPredictionLocked && (
            <button
              onClick={handleSubmit}
              disabled={isPending || homeScore === '' || awayScore === ''}
              className={clsx(
                'w-full mt-3 py-2 rounded-lg font-heading text-sm tracking-widest uppercase transition-all',
                saved
                  ? 'bg-gold/15 border border-gold/40 text-gold'
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
}

// ─── Main Dashboard ──────────────────────────────────────────

const STAGE_FILTERS = ['All', 'Today', 'Group', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']

interface MatchDashboardProps {
  userId: string
}

export default function MatchDashboard({ userId }: MatchDashboardProps) {
  const [stageFilter, setStageFilter] = useState('All')

  const { data: fixtures, isLoading: fixturesLoading, error } = useQuery({
    queryKey: ['fixtures'],
    queryFn: fetchFixtures,
    refetchInterval: 30_000, // re-poll every 30s for live score updates
  })

  const { data: predictions } = useQuery({
    queryKey: ['predictions', userId],
    queryFn: () => fetchUserPredictions(userId),
    enabled: !!userId,
  })

  const predictionMap = new Map(predictions?.map(p => [p.match_id, p]))

  const filtered = fixtures?.filter(f => {
    if (stageFilter === 'All') return true
    if (stageFilter === 'Today') return isToday(new Date(f.kickoff_at))
    return f.stage.toLowerCase().includes(stageFilter.toLowerCase().replace(/-/g, ''))
  })

  const liveFixtures = filtered?.filter(f => f.status === 'live') ?? []
  const upcomingFixtures = filtered?.filter(f => f.status === 'upcoming') ?? []
  const completedFixtures = filtered?.filter(f => f.status === 'completed') ?? []

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <p>Failed to load fixtures. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STAGE_FILTERS.map(stage => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={clsx(
              'text-xs px-4 py-[5px] rounded-full transition-all font-medium tracking-wide border',
              stageFilter === stage
                ? 'bg-gold/12 border-gold text-gold'
                : 'bg-slate-800 border-white/8 text-slate-400 hover:border-gold/40 hover:text-gold/80'
            )}
          >
            {stage}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {fixturesLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 border border-white/7 rounded-xl h-[90px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Live */}
      {liveFixtures.length > 0 && (
        <section>
          <SectionLabel>Live Now</SectionLabel>
          {liveFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {/* Upcoming */}
      {upcomingFixtures.length > 0 && (
        <section>
          <SectionLabel>
            {stageFilter === 'Today' ? "Today's Matches" : 'Upcoming'}
          </SectionLabel>
          {upcomingFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {/* Completed */}
      {completedFixtures.length > 0 && (
        <section>
          <SectionLabel>Results</SectionLabel>
          {completedFixtures.map(f => (
            <MatchCard key={f.id} fixture={f} prediction={predictionMap.get(f.id)} userId={userId} />
          ))}
        </section>
      )}

      {!fixturesLoading && filtered?.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="font-display text-4xl mb-2 text-slate-700">NO MATCHES</div>
          <p className="text-sm">No fixtures found for this filter.</p>
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
