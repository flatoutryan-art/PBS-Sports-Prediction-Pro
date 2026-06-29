import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import type { FixtureWithTeams, Prediction } from '@/lib/types'
import { format, isPast } from 'date-fns'
import { clsx } from 'clsx'

// ─── Data fetching — both use RPCs that resolve auth_user_id correctly ───────

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
  return (data ?? []) as FixtureWithTeams[]
}

async function fetchMyPredictions(): Promise<Prediction[]> {
  // Uses SECURITY DEFINER RPC — resolves auth.uid() → profiles.id correctly
  const { data, error } = await supabase.rpc('get_my_predictions')
  if (error) throw error
  return data ?? []
}

async function savePrediction(payload: {
  match_id: string
  home_score: number
  away_score: number
}): Promise<void> {
  // Uses SECURITY DEFINER RPC — handles ID resolution + kickoff lock
  const { data, error } = await supabase.rpc('upsert_prediction', {
    p_match_id:   payload.match_id,
    p_home_score: payload.home_score,
    p_away_score: payload.away_score,
  })
  if (error) throw error
  const result = data?.[0]
  if (!result?.success) {
    const messages: Record<string, string> = {
      MATCH_LOCKED:      'This match has already kicked off — prediction locked.',
      PROFILE_NOT_FOUND: 'Profile error. Please sign out and back in.',
      FIXTURE_NOT_FOUND: 'Fixture not found.',
    }
    throw new Error(messages[result?.error_code ?? ''] ?? 'Failed to save prediction.')
  }
}

// ─── Points badge ─────────────────────────────────────────────

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return null
  const config =
    points === 5 ? { label: '⚡ Exact · +5', cls: 'bg-gold/15 border-gold/30 text-gold' }
    : points === 3 ? { label: '✓ Correct · +3', cls: 'bg-green-900/30 border-green-700/40 text-green-400' }
    : { label: '✗ Wrong · +0', cls: 'bg-slate-700/50 border-slate-600 text-slate-500' }
  return (
    <span className={clsx('text-[11px] px-2.5 py-1 rounded-full border font-medium font-body tracking-wide', config.cls)}>
      {config.label}
    </span>
  )
}

// ─── Pick Row ─────────────────────────────────────────────────

function PickRow({ fixture, prediction }: {
  fixture: FixtureWithTeams
  prediction: Prediction | undefined
}) {
  const queryClient = useQueryClient()
  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() ?? '')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(!!prediction)
  const [saveError, setSaveError] = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // FIX: sync local state when prediction loads after mount (async query),
  // or re-hydrates from cache after tab switch. Without this, useState
  // initialises once with undefined and never updates when data arrives.
  useEffect(() => {
    if (prediction && !dirty) {
      setHomeScore(prediction.home_score?.toString() ?? '')
      setAwayScore(prediction.away_score?.toString() ?? '')
      setSaved(true)
    }
  }, [prediction?.id, prediction?.home_score, prediction?.away_score, dirty])

  const kickoff = new Date(fixture.kickoff_at)
  const isLocked = isPast(kickoff) || fixture.status !== 'upcoming'
  const isCompleted = fixture.status === 'completed'

  const { mutate, isPending } = useMutation({
    mutationFn: savePrediction,
    onSuccess: () => {
      setSaved(true)
      setDirty(false)
      setSaveError('')
      // Invalidate both queries so Fixtures tab and My Picks stay in sync
      queryClient.invalidateQueries({ queryKey: ['my-picks'] })
      queryClient.invalidateQueries({ queryKey: ['predictions'] })
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  function handleSave() {
    const h = parseInt(homeScore), a = parseInt(awayScore)
    if (isNaN(h) || isNaN(a)) return
    setSaveError('')
    mutate({ match_id: fixture.id, home_score: h, away_score: a })
  }

  return (
    <div className={clsx(
      'bg-slate-800 border rounded-xl px-4 py-3.5 transition-all',
      isCompleted
        ? prediction?.points_earned === 5 ? 'border-gold/25' : 'border-white/6 opacity-80'
        : prediction ? 'border-gold/20' : 'border-white/7'
    )}>
      {/* Match info */}
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[11px] text-slate-500 tracking-widest uppercase font-medium">
          {fixture.group_name ?? fixture.stage?.toUpperCase()}
        </span>
        <span className="text-[11px] text-slate-500 font-body">
          {isCompleted ? 'Full Time' : format(kickoff, 'EEE d MMM · HH:mm')}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">
            {fixture.home_team?.flag_url
              ? <img src={fixture.home_team.flag_url} className="w-6 h-6 rounded-full" alt="" />
              : '🏴'}
          </span>
          <span className="font-heading text-sm text-cream truncate">{fixture.home_team?.name}</span>
        </div>

        {isCompleted && (
          <div className="flex-shrink-0 text-center px-2">
            <span className="font-display text-xl text-slate-400 tracking-widest">
              {fixture.actual_home_score} – {fixture.actual_away_score}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-heading text-sm text-cream truncate text-right">{fixture.away_team?.name}</span>
          <span className="text-xl flex-shrink-0">
            {fixture.away_team?.flag_url
              ? <img src={fixture.away_team.flag_url} className="w-6 h-6 rounded-full" alt="" />
              : '🏴'}
          </span>
        </div>
      </div>

      {/* Prediction row */}
      <div className="mt-3 pt-3 border-t border-white/6">
        {isLocked ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-body">Your pick:</span>
            <div className="flex items-center gap-3">
              {prediction ? (
                <>
                  <span className="font-display text-xl text-slate-300 tracking-widest">
                    {prediction.home_score} – {prediction.away_score}
                  </span>
                  <PointsBadge points={prediction.points_earned ?? null} />
                </>
              ) : (
                <span className="text-xs text-slate-600 italic font-body">No prediction submitted</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-body flex-shrink-0">Your pick:</span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number" min={0} max={20}
                  value={homeScore}
                  onChange={e => {
                    const val = e.target.value
                    setHomeScore(val)
                    setDirty(true)
                    setSaved(false)
                    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
                    autoSaveTimer.current = setTimeout(() => {
                      const h = parseInt(val), a = parseInt(awayScore)
                      if (!isNaN(h) && !isNaN(a) && val !== '' && awayScore !== '') {
                        setSaveError('')
                        mutate({ match_id: fixture.id, home_score: h, away_score: a })
                      }
                    }, 800)
                  }}
                  className="w-14 bg-slate-950 border border-slate-600 rounded-lg text-center py-1.5
                             font-display text-lg text-cream outline-none focus:border-gold transition-all tracking-wider"
                />
                <span className="font-display text-slate-600">–</span>
                <input
                  type="number" min={0} max={20}
                  value={awayScore}
                  onChange={e => {
                    const val = e.target.value
                    setAwayScore(val)
                    setDirty(true)
                    setSaved(false)
                    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
                    autoSaveTimer.current = setTimeout(() => {
                      const h = parseInt(homeScore), a = parseInt(val)
                      if (!isNaN(h) && !isNaN(a) && homeScore !== '' && val !== '') {
                        setSaveError('')
                        mutate({ match_id: fixture.id, home_score: h, away_score: a })
                      }
                    }, 800)
                  }}
                  className="w-14 bg-slate-950 border border-slate-600 rounded-lg text-center py-1.5
                             font-display text-lg text-cream outline-none focus:border-gold transition-all tracking-wider"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isPending || (!dirty && !!prediction) || homeScore === '' || awayScore === ''}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg font-heading tracking-wide uppercase transition-all flex-shrink-0',
                  saved
                    ? 'bg-gold/12 border border-gold/30 text-gold'
                    : 'bg-shield-gradient border border-maroon/50 text-red-200 hover:border-maroon',
                  (isPending || (!dirty && !!prediction)) && 'opacity-40'
                )}
              >
                {isPending ? '…' : saved ? '✓' : prediction ? 'Update' : 'Save'}
              </button>
            </div>
            {saveError && (
              <p className="text-red-400 text-xs font-body">{saveError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary Bar ──────────────────────────────────────────────

function SummaryBar({ predictions, totalPoints }: { predictions: Prediction[]; totalPoints: number }) {
  const exact   = predictions.filter(p => p.points_earned === 5).length
  const correct = predictions.filter(p => p.points_earned === 3).length
  const pending = predictions.filter(p => p.points_earned === null).length

  return (
    <div className="grid grid-cols-4 gap-2 mb-5">
      {[
        { label: 'Points',  value: totalPoints, color: 'text-gold' },
        { label: 'Exact',   value: exact,        color: 'text-gold' },
        { label: 'Correct', value: correct,      color: 'text-green-400' },
        { label: 'Pending', value: pending,      color: 'text-slate-400' },
      ].map(s => (
        <div key={s.label} className="bg-slate-800 border border-white/7 rounded-xl p-3 text-center">
          <p className={clsx('font-display text-2xl tracking-wider', s.color)}>{s.value}</p>
          <p className="text-[10px] text-slate-600 tracking-widest uppercase mt-0.5 font-body">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

const FILTERS = ['All', 'Upcoming', 'Completed', 'No Pick'] as const
type Filter = typeof FILTERS[number]

export default function MyPicksPage() {
  const { user } = useAuth()
  const { profile } = useProfile(user?.id)
  const [filter, setFilter] = useState<Filter>('All')

  const { data: fixtures, isLoading: loadingFixtures } = useQuery({
    queryKey: ['fixtures'],
    queryFn: fetchFixtures,
    staleTime: 5 * 60 * 1000,       // 5 min — shared with MatchDashboard cache
  })

  const { data: predictions, isLoading: loadingPredictions } = useQuery({
    queryKey: ['my-picks', user?.id],
    queryFn: fetchMyPredictions,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,       // FIX: 5 min keeps cache alive across tab switches
    refetchOnWindowFocus: false,     // FIX: was wiping predictions on every tab switch
  })

  const predMap = new Map(predictions?.map(p => [p.match_id, p]))

  const filtered = (fixtures ?? []).filter(f => {
    if (filter === 'Upcoming')  return f.status === 'upcoming'
    if (filter === 'Completed') return f.status === 'completed'
    if (filter === 'No Pick')   return !predMap.has(f.id) && f.status === 'upcoming'
    return true
  })

  const sections = [
    { label: 'Live Now', items: filtered.filter(f => f.status === 'live') },
    { label: 'Upcoming', items: filtered.filter(f => f.status === 'upcoming') },
    { label: 'Results',  items: filtered.filter(f => f.status === 'completed') },
  ].filter(s => s.items.length > 0)

  const isLoading = loadingFixtures || loadingPredictions

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="font-display text-3xl tracking-[2px] text-cream mb-4">MY PICKS</h1>

      {profile && (
        <SummaryBar
          predictions={predictions ?? []}
          totalPoints={profile.total_points}
        />
      )}

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx(
              'text-xs px-4 py-2 rounded-full border transition-all whitespace-nowrap font-medium tracking-wide flex-shrink-0',
              filter === f
                ? 'bg-gold/12 border-gold text-gold'
                : 'bg-slate-800 border-white/8 text-slate-400 hover:border-gold/30 hover:text-gold/80'
            )}>
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && sections.map(section => (
        <div key={section.label} className="mb-5">
          <div className="section-label">{section.label}</div>
          <div className="space-y-3">
            {section.items.map(fixture => (
              <PickRow
                key={fixture.id}
                fixture={fixture}
                prediction={predMap.get(fixture.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="font-display text-4xl text-slate-700 mb-2">NO PICKS</div>
          <p className="text-sm font-body">Nothing here for this filter.</p>
        </div>
      )}
    </div>
  )
}
