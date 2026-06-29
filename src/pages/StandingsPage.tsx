/**
 * StandingsPage — Live World Cup group standings + Knockout bracket
 * Groups: fetches from football-data.org via Supabase Edge Function
 * Knockout: fetches directly from our fixtures table (no extra API needed)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { FixtureWithTeams, Prediction } from '@/lib/types'
import { format, isToday } from 'date-fns'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────

interface StandingRow {
  position:       number
  team:           { name: string; shortName: string; crest?: string }
  playedGames:    number
  won:            number
  draw:           number
  lost:           number
  goalsFor:       number
  goalsAgainst:   number
  goalDifference: number
  points:         number
  form:           string | null
}

interface Group {
  stage:  string
  type:   string
  group:  string
  table:  StandingRow[]
}

// ─── Data fetching ────────────────────────────────────────────

async function fetchStandings(): Promise<Group[]> {
  const { data, error } = await supabase.functions.invoke('get-standings')
  if (error) throw error
  return data?.standings ?? []
}

async function fetchKnockoutFixtures(): Promise<FixtureWithTeams[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*)
    `)
    .not('stage', 'eq', 'group')
    .order('kickoff_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as FixtureWithTeams[]
}

async function fetchMyPredictions(): Promise<Prediction[]> {
  const { data, error } = await supabase.rpc('get_my_predictions')
  if (error) throw error
  return data ?? []
}

// ─── Stage config ─────────────────────────────────────────────

const STAGE_ORDER = ['r32', 'r16', 'qf', 'sf', '3rd', 'final']
const STAGE_LABELS: Record<string, string> = {
  r32:   'Round of 32',
  r16:   'Round of 16',
  qf:    'Quarter-Finals',
  sf:    'Semi-Finals',
  '3rd': 'Third Place',
  final: 'THE FINAL',
}

// ─── Points badge ─────────────────────────────────────────────

function PointsBadge({ points }: { points: number | null | undefined }) {
  if (points === null || points === undefined) return null
  const config =
    points === 5 ? { label: '⚡ +5', cls: 'bg-gold/15 border-gold/30 text-gold' }
    : points === 3 ? { label: '✓ +3', cls: 'bg-green-900/30 border-green-700/40 text-green-400' }
    : { label: '✗ +0', cls: 'bg-slate-700/50 border-slate-600 text-slate-500' }
  return (
    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-medium font-body', config.cls)}>
      {config.label}
    </span>
  )
}

// ─── Knockout Match Card ──────────────────────────────────────

function KnockoutCard({ fixture, prediction }: {
  fixture: FixtureWithTeams
  prediction: Prediction | undefined
}) {
  const isCompleted = fixture.status === 'completed'
  const isLive      = fixture.status === 'live'
  const kickoff     = new Date(fixture.kickoff_at)
  const hasPick     = !!prediction

  return (
    <div className={clsx(
      'bg-slate-800 border rounded-xl px-4 py-3.5 mb-3 transition-all',
      isLive      && 'border-maroon/50',
      isCompleted && 'border-white/6 opacity-90',
      !isLive && !isCompleted && hasPick  && 'border-gold/20',
      !isLive && !isCompleted && !hasPick && 'border-white/7',
    )}>
      {/* Kickoff / status line */}
      <div className="flex justify-between items-center mb-2.5">
        {isLive ? (
          <span className="text-[10px] bg-maroon text-red-300 px-2 py-0.5 rounded-full tracking-widest uppercase font-medium animate-pulse">
            ● Live
          </span>
        ) : isCompleted ? (
          <span className="text-[10px] text-slate-500 tracking-widest uppercase font-medium">Full Time</span>
        ) : (
          <span className="text-[10px] text-slate-500 font-body">
            {isToday(kickoff) ? `Today · ${format(kickoff, 'HH:mm')}` : format(kickoff, 'EEE d MMM · HH:mm')}
          </span>
        )}
        {isLive && (
          <span className="text-[10px] text-gold font-display tracking-widest">
            {fixture.actual_home_score} : {fixture.actual_away_score}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Home */}
        <div className="flex items-center gap-2">
          {fixture.home_team?.flag_url
            ? <img src={fixture.home_team.flag_url} className="w-6 h-6 rounded-full flex-shrink-0" alt="" />
            : <span className="text-lg">🏴</span>}
          <span className="font-heading text-sm text-cream truncate">{fixture.home_team?.name}</span>
        </div>

        {/* Score or VS */}
        <div className="text-center flex-shrink-0 px-1">
          {isCompleted ? (
            <span className="font-display text-xl text-slate-300 tracking-widest">
              {fixture.actual_home_score} – {fixture.actual_away_score}
            </span>
          ) : (
            <span className="font-display text-base text-slate-700 tracking-widest">vs</span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 justify-end">
          <span className="font-heading text-sm text-cream truncate text-right">{fixture.away_team?.name}</span>
          {fixture.away_team?.flag_url
            ? <img src={fixture.away_team.flag_url} className="w-6 h-6 rounded-full flex-shrink-0" alt="" />
            : <span className="text-lg">🏴</span>}
        </div>
      </div>

      {/* Your prediction */}
      <div className="mt-2.5 pt-2.5 border-t border-white/6 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-body">Your pick:</span>
        {hasPick ? (
          <div className="flex items-center gap-2">
            <span className="font-display text-base text-slate-300 tracking-widest">
              {prediction.home_score} – {prediction.away_score}
            </span>
            {isCompleted && <PointsBadge points={prediction.points_earned} />}
            {!isCompleted && (
              <span className="text-[10px] text-gold/70 font-body">✓ locked in</span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-600 italic font-body">
            {isCompleted ? 'No prediction' : 'Not picked yet'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Knockout View ────────────────────────────────────────────

function KnockoutView({ userId }: { userId: string }) {
  const { data: fixtures, isLoading: loadingFixtures } = useQuery({
    queryKey: ['knockout-fixtures'],
    queryFn:  fetchKnockoutFixtures,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  })

  const { data: predictions, isLoading: loadingPreds } = useQuery({
    queryKey: ['my-picks', userId],
    queryFn:  fetchMyPredictions,
    enabled:  !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const predMap = new Map(predictions?.map(p => [p.match_id, p]))

  const isLoading = loadingFixtures || loadingPreds

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!fixtures || fixtures.length === 0) return (
    <div className="text-center py-10">
      <div className="font-display text-4xl text-slate-700 mb-2">COMING SOON</div>
      <p className="text-slate-500 text-sm font-body">Knockout bracket appears after the group stage.</p>
    </div>
  )

  // Group fixtures by stage, in tournament order
  const byStage = STAGE_ORDER.reduce((acc, stage) => {
    const matches = fixtures.filter(f => f.stage === stage)
    if (matches.length > 0) acc[stage] = matches
    return acc
  }, {} as Record<string, FixtureWithTeams[]>)

  const activeStages = STAGE_ORDER.filter(s => byStage[s])

  if (activeStages.length === 0) return (
    <div className="text-center py-10">
      <div className="font-display text-4xl text-slate-700 mb-2">COMING SOON</div>
      <p className="text-slate-500 text-sm font-body">Knockout bracket appears after the group stage.</p>
    </div>
  )

  return (
    <div>
      {activeStages.map(stage => (
        <div key={stage} className="mb-6">
          <div className="flex items-center gap-3 text-[11px] text-slate-500 tracking-[3px] uppercase font-medium mb-3">
            {STAGE_LABELS[stage] ?? stage.toUpperCase()}
            <div className="flex-1 h-px bg-white/6" />
            <span className="text-slate-600">{byStage[stage].length} matches</span>
          </div>
          {byStage[stage].map(fixture => (
            <KnockoutCard
              key={fixture.id}
              fixture={fixture}
              prediction={predMap.get(fixture.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Group Table ──────────────────────────────────────────────

function GroupTable({ group }: { group: Group }) {
  const label = group.group?.replace('GROUP_', 'Group ') ?? 'Group'
  return (
    <div className="bg-slate-800 border border-white/7 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-2.5 bg-slate-700/50 border-b border-white/7">
        <span className="font-heading text-sm text-cream tracking-wide">{label}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-white/6">
              <th className="text-left px-3 py-2 font-medium tracking-widest uppercase w-6">#</th>
              <th className="text-left px-3 py-2 font-medium tracking-widest uppercase">Team</th>
              <th className="text-center px-2 py-2 font-medium tracking-widests uppercase">P</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">W</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">D</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">L</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">GD</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase font-bold text-gold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.table.map((row, idx) => {
              const isQualifying = idx < 2
              return (
                <tr key={row.team.name} className={clsx(
                  'border-b border-white/4 last:border-0 transition-colors',
                  isQualifying && 'bg-green-900/8'
                )}>
                  <td className="px-3 py-2.5 text-slate-500 font-medium">{row.position}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.team.crest && (
                        <img src={row.team.crest} alt={row.team.shortName} className="w-4 h-4 object-contain" loading="lazy" />
                      )}
                      <span className={clsx('font-medium truncate max-w-[100px]', isQualifying ? 'text-cream' : 'text-slate-400')}>
                        {row.team.shortName || row.team.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{row.playedGames}</td>
                  <td className="px-2 py-2.5 text-center text-green-400">{row.won}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{row.draw}</td>
                  <td className="px-2 py-2.5 text-center text-red-400">{row.lost}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="px-2 py-2.5 text-center font-display text-base text-gold">{row.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 border-t border-white/6 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-green-900/60 border border-green-700/40" />
        <span className="text-[10px] text-slate-600 font-body">Qualify for Round of 16</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function StandingsPage() {
  const { user } = useAuth()
  const [view, setView] = useState<'groups' | 'knockout'>('knockout')

  const { data: standings, isLoading, error, refetch } = useQuery({
    queryKey: ['wc-standings'],
    queryFn:  fetchStandings,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  const groupStandings = standings?.filter(s => s.type === 'TOTAL' && s.group) ?? []

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl tracking-[2px] text-cream">STANDINGS</h1>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase font-body mt-0.5">
            World Cup 2026 · Live
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-500 hover:text-gold transition-colors font-body border border-white/8 px-3 py-1.5 rounded-lg"
        >
          ↻ Refresh
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-900 border border-white/7 rounded-xl p-1 mb-5">
        {(['groups', 'knockout'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-xs font-heading tracking-widest uppercase transition-all capitalize',
              view === v ? 'bg-slate-700 text-cream border border-white/8' : 'text-slate-500 hover:text-slate-300'
            )}>
            {v === 'groups' ? '🏆 Groups' : '⚔️ Knockout'}
          </button>
        ))}
      </div>

      {/* Group standings */}
      {view === 'groups' && (
        <>
          {isLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          )}
          {error && (
            <div className="text-center py-10">
              <p className="text-slate-500 text-sm font-body">Standings unavailable.</p>
              <button onClick={() => refetch()} className="mt-3 text-xs text-gold border border-gold/30 px-4 py-2 rounded-lg">
                Try again
              </button>
            </div>
          )}
          {!isLoading && !error && groupStandings.length === 0 && (
            <div className="text-center py-10">
              <div className="font-display text-4xl text-slate-700 mb-2">NOT STARTED</div>
              <p className="text-slate-500 text-sm font-body">Group standings will appear once matches begin.</p>
            </div>
          )}
          {!isLoading && !error && groupStandings.map(group => (
            <GroupTable key={group.group} group={group} />
          ))}
        </>
      )}

      {/* Knockout bracket */}
      {view === 'knockout' && (
        <KnockoutView userId={user?.id ?? ''} />
      )}

      <p className="text-center text-slate-700 text-xs mt-4 font-body">
        Updates every 10 minutes · Data via football-data.org
      </p>
    </div>
  )
}
