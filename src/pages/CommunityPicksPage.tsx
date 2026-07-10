import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { format, isPast } from 'date-fns'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────

interface CommunityPick {
  player_name:   string
  home_score:    number
  away_score:    number
  points_earned: number | null
}

interface FixtureOption {
  id:          string
  home_team:   string
  away_team:   string
  kickoff_at:  string
  status:      string
  actual_home: number | null
  actual_away: number | null
  home_flag:   string | null
  away_flag:   string | null
}

// ─── Data fetching ────────────────────────────────────────────

async function fetchFixturesWithPicks(): Promise<FixtureOption[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(`
      id, kickoff_at, status,
      actual_home_score, actual_away_score,
      home_team:teams!fixtures_home_team_id_fkey(name, flag_url),
      away_team:teams!fixtures_away_team_id_fkey(name, flag_url)
    `)
    .order('kickoff_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((f: any) => ({
    id:          f.id,
    home_team:   f.home_team.name,
    away_team:   f.away_team.name,
    kickoff_at:  f.kickoff_at,
    status:      f.status,
    actual_home: f.actual_home_score,
    actual_away: f.actual_away_score,
    home_flag:   f.home_team.flag_url,
    away_flag:   f.away_team.flag_url,
  }))
}

async function fetchPicksForFixture(fixtureId: string): Promise<CommunityPick[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select(`
      home_score, away_score, points_earned,
      profile:profiles!predictions_user_id_fkey(display_name)
    `)
    .eq('match_id', fixtureId)
    .order('points_earned', { ascending: false, nullsFirst: false })

  if (error) throw error

  return (data ?? []).map((p: any) => ({
    player_name:   p.profile?.display_name ?? 'Unknown',
    home_score:    p.home_score,
    away_score:    p.away_score,
    points_earned: p.points_earned,
  }))
}

// ─── Points badge ─────────────────────────────────────────────

function PointsBadge({ pts }: { pts: number | null }) {
  if (pts === null) return (
    <span className="text-[10px] text-slate-500 font-body">Pending</span>
  )
  // Exact score: 5pts standard, 10pts doubled (QF/SF/3rd/Final)
  if (pts >= 5) return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold font-medium">
      ⚡ +{pts}
    </span>
  )
  // Correct result: 3pts standard, 6pts doubled
  if (pts >= 3) return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/20 border border-green-700/30 text-green-400 font-medium">
      ✓ +{pts}
    </span>
  )
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-500 font-medium">
      ✗ +0
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function CommunityPicksPage() {
  const { user } = useAuth()
  const { profile } = useProfile(user?.id)
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: fixtures, isLoading: loadingFixtures } = useQuery({
    queryKey: ['fixtures-community'],
    queryFn:  fetchFixturesWithPicks,
    staleTime: 60_000,
  })

  // Default to live → soonest upcoming → most recently completed
  const defaultFixtureId = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return null
    const now = new Date()
    const live = fixtures.find(f => f.status === 'live')
    if (live) return live.id
    const upcoming = fixtures
      .filter(f => f.status === 'upcoming' && new Date(f.kickoff_at) >= now)
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    if (upcoming.length > 0) return upcoming[0].id
    const completed = fixtures
      .filter(f => f.status === 'completed')
      .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
    if (completed.length > 0) return completed[0].id
    return fixtures[0].id
  }, [fixtures])

  const activeId = selectedFixtureId ?? defaultFixtureId

  const { data: picks, isLoading: loadingPicks } = useQuery({
    queryKey: ['community-picks', activeId],
    queryFn:  () => fetchPicksForFixture(activeId!),
    enabled:  !!activeId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const activeFixture = useMemo(
    () => fixtures?.find(f => f.id === activeId),
    [fixtures, activeId]
  )

  // Kickoff has passed = picks are revealed
  const kickoffPassed = activeFixture
    ? isPast(new Date(activeFixture.kickoff_at)) || activeFixture.status !== 'upcoming'
    : true

  const myDisplayName = profile?.display_name ?? null

  // Separate my pick from others
  const myPick = useMemo(
    () => picks?.find(p => p.player_name === myDisplayName) ?? null,
    [picks, myDisplayName]
  )

  // For revealed matches: all picks. For hidden: only my own (shown separately)
  const visiblePicks = useMemo(() => {
    if (!picks) return []
    if (kickoffPassed) {
      // All picks, filtered by search
      if (!search.trim()) return picks
      return picks.filter(p =>
        p.player_name.toLowerCase().includes(search.toLowerCase())
      )
    }
    // Pre-kickoff: only show other players anonymously (we show myPick separately)
    return []
  }, [picks, kickoffPassed, search])

  const isCompleted  = activeFixture?.status === 'completed'
  const totalPickers = picks?.length ?? 0

  // Sort chips: live first, soonest upcoming, most recent completed
  const sortedFixtures = useMemo(() => {
    if (!fixtures) return []
    const now = new Date()
    const live      = fixtures.filter(f => f.status === 'live')
    const upcoming  = fixtures
      .filter(f => f.status === 'upcoming' && new Date(f.kickoff_at) >= now)
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    const completed = fixtures
      .filter(f => f.status === 'completed')
      .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
    return [...live, ...upcoming, ...completed]
  }, [fixtures])

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-3xl tracking-[2px] text-cream">COMMUNITY</h1>
        <p className="text-[10px] text-slate-500 tracking-widest uppercase font-body mt-0.5">
          Everyone's picks · all matches
        </p>
      </div>

      {/* Fixture selector chips */}
      {loadingFixtures ? (
        <div className="h-12 bg-slate-800 rounded-xl animate-pulse mb-4" />
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
          {sortedFixtures.map(f => (
            <button
              key={f.id}
              onClick={() => { setSelectedFixtureId(f.id); setSearch('') }}
              className={clsx(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left',
                f.id === activeId
                  ? 'bg-gold/10 border-gold text-cream'
                  : 'bg-slate-800 border-white/8 text-slate-400 hover:border-gold/30'
              )}
            >
              <div className="flex items-center gap-1.5">
                {f.home_flag && <img src={f.home_flag} className="w-4 h-4 rounded-full object-cover" alt="" />}
                <span className="text-xs font-medium whitespace-nowrap">{f.home_team}</span>
              </div>
              <span className="text-slate-600 text-xs">vs</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium whitespace-nowrap">{f.away_team}</span>
                {f.away_flag && <img src={f.away_flag} className="w-4 h-4 rounded-full object-cover" alt="" />}
              </div>
              {f.status === 'completed' && f.actual_home !== null && (
                <span className="text-[10px] text-slate-500 ml-1 whitespace-nowrap">
                  {f.actual_home}–{f.actual_away}
                </span>
              )}
              {f.status === 'live' && (
                <span className="text-[10px] text-maroon ml-1 whitespace-nowrap animate-pulse">●</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active match header */}
      {activeFixture && (
        <div className="bg-slate-800 border border-white/8 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={clsx(
              'text-[10px] tracking-widest uppercase font-medium px-2 py-0.5 rounded-full',
              isCompleted
                ? 'bg-green-900/20 text-green-400 border border-green-800/30'
                : activeFixture.status === 'live'
                ? 'bg-maroon/20 text-red-400 border border-maroon/30 animate-pulse'
                : 'bg-slate-700 text-slate-400 border border-white/6'
            )}>
              {isCompleted ? 'Full Time' : activeFixture.status === 'live' ? '● Live' : 'Upcoming'}
            </span>
            <span className="text-[11px] text-slate-500 font-body">
              {format(new Date(activeFixture.kickoff_at), 'EEE d MMM · HH:mm')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {activeFixture.home_flag && (
                <img src={activeFixture.home_flag} className="w-7 h-7 rounded-full object-cover" alt="" />
              )}
              <span className="font-heading text-base text-cream">{activeFixture.home_team}</span>
            </div>
            {isCompleted && activeFixture.actual_home !== null ? (
              <div className="font-display text-2xl text-slate-300 tracking-[6px] px-3">
                {activeFixture.actual_home} : {activeFixture.actual_away}
              </div>
            ) : (
              <div className="font-display text-2xl text-slate-700 tracking-[6px] px-3">vs</div>
            )}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="font-heading text-base text-cream">{activeFixture.away_team}</span>
              {activeFixture.away_flag && (
                <img src={activeFixture.away_flag} className="w-7 h-7 rounded-full object-cover" alt="" />
              )}
            </div>
          </div>

          {/* Stats — only shown post-kickoff */}
          {kickoffPassed && totalPickers > 0 && isCompleted && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-white/6">
              <div className="text-center">
                <p className="font-display text-lg text-cream">{totalPickers}</p>
                <p className="text-[10px] text-slate-500 font-body">Predicted</p>
              </div>
              <div className="text-center">
                <p className="font-display text-lg text-gold">
                  {picks?.filter(p => p.points_earned !== null && p.points_earned >= 5).length}
                </p>
                <p className="text-[10px] text-slate-500 font-body">Exact ⚡</p>
              </div>
              <div className="text-center">
                <p className="font-display text-lg text-green-400">
                  {picks?.filter(p => p.points_earned !== null && p.points_earned >= 3 && p.points_earned < 5).length}
                </p>
                <p className="text-[10px] text-slate-500 font-body">Correct ✓</p>
              </div>
              <div className="text-center">
                <p className="font-display text-lg text-slate-400">
                  {picks?.filter(p => p.points_earned === 0).length}
                </p>
                <p className="text-[10px] text-slate-500 font-body">Wrong ✗</p>
              </div>
            </div>
          )}
          {kickoffPassed && totalPickers > 0 && !isCompleted && (
            <div className="mt-3 pt-3 border-t border-white/6">
              <p className="text-xs text-slate-500 font-body text-center">
                {totalPickers} player{totalPickers !== 1 ? 's' : ''} predicted this match
              </p>
            </div>
          )}
          {/* Pre-kickoff: show count only */}
          {!kickoffPassed && totalPickers > 0 && (
            <div className="mt-3 pt-3 border-t border-white/6 text-center">
              <p className="text-xs text-slate-500 font-body">
                {totalPickers} player{totalPickers !== 1 ? 's' : ''} have picked · picks revealed at kickoff
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pre-kickoff: show my own pick + lock message */}
      {!kickoffPassed && !loadingPicks && (
        <div className="space-y-3 mb-4">
          {/* My pick */}
          {myPick ? (
            <div className="bg-slate-800 border border-gold/20 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-heading text-gold">
                      {myDisplayName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-body text-sm text-cream">
                    {myDisplayName} <span className="text-gold text-xs">(you)</span>
                  </span>
                </div>
                <span className="font-display text-base text-gold tracking-widest">
                  {myPick.home_score} – {myPick.away_score}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-white/7 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-500 font-body">You haven't predicted this match yet</p>
            </div>
          )}

          {/* Lock banner */}
          <div className="bg-slate-900 border border-white/6 rounded-xl px-4 py-4 text-center">
            <p className="text-2xl mb-1">🔒</p>
            <p className="text-sm text-slate-400 font-heading tracking-wide">Picks hidden until kickoff</p>
            <p className="text-[11px] text-slate-600 font-body mt-1">
              Revealed {format(new Date(activeFixture?.kickoff_at ?? ''), 'EEE d MMM · HH:mm')}
            </p>
          </div>
        </div>
      )}

      {/* Post-kickoff: search + full picks table */}
      {kickoffPassed && (
        <>
          {(picks?.length ?? 0) > 5 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search player…"
              className="w-full bg-slate-800 border border-white/8 rounded-xl px-4 py-2.5
                         text-sm text-cream placeholder-slate-600 outline-none
                         focus:border-gold/40 transition-all mb-3 font-body"
            />
          )}

          {loadingPicks ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visiblePicks.length === 0 ? (
            <div className="text-center py-12">
              <div className="font-display text-3xl text-slate-700 mb-2">NO PICKS YET</div>
              <p className="text-sm text-slate-500 font-body">
                {totalPickers === 0
                  ? 'No one has predicted this match yet.'
                  : 'No players match your search.'}
              </p>
            </div>
          ) : (
            <div className="bg-slate-800 border border-white/8 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-white/6">
                <span className="text-[10px] text-slate-500 tracking-widest uppercase font-medium">Player</span>
                <span className="text-[10px] text-slate-500 tracking-widest uppercase font-medium text-center w-16">Pick</span>
                <span className="text-[10px] text-slate-500 tracking-widest uppercase font-medium text-right w-14">Pts</span>
              </div>

              {visiblePicks.map((pick, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    'grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center',
                    'border-b border-white/4 last:border-0',
                    pick.player_name === myDisplayName && 'bg-gold/4',
                    pick.points_earned !== null && pick.points_earned >= 5 && pick.player_name !== myDisplayName && 'bg-gold/4',
                    pick.points_earned !== null && pick.points_earned >= 3 && pick.points_earned < 5 && pick.player_name !== myDisplayName && 'bg-green-900/6',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-slate-700 border border-white/8
                                    flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-heading text-slate-400">
                        {pick.player_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-body text-sm text-cream truncate">
                      {pick.player_name}
                      {pick.player_name === myDisplayName && (
                        <span className="text-gold text-xs ml-1">(you)</span>
                      )}
                    </span>
                  </div>

                  <div className="w-16 text-center">
                    <span className={clsx(
                      'font-display text-base tracking-widest',
                      pick.points_earned !== null && pick.points_earned >= 5 ? 'text-gold'
                      : pick.points_earned !== null && pick.points_earned >= 3 && pick.points_earned < 5 ? 'text-green-400'
                      : pick.points_earned === 0 ? 'text-slate-500'
                      : 'text-slate-300'
                    )}>
                      {pick.home_score} – {pick.away_score}
                    </span>
                  </div>

                  <div className="w-14 flex justify-end">
                    <PointsBadge pts={pick.points_earned} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-center text-slate-700 text-xs mt-5 font-body pb-4">
        {totalPickers} player{totalPickers !== 1 ? 's' : ''} predicted this match
      </p>
    </div>
  )
}
