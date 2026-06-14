/**
 * StandingsPage — Live World Cup group standings
 * Fetches from football-data.org via a Supabase Edge Function
 * so the API key stays server-side
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
  group:  string        // "GROUP_A" etc.
  table:  StandingRow[]
}

// ─── Data fetching via Edge Function ─────────────────────────

async function fetchStandings(): Promise<Group[]> {
  const { data, error } = await supabase.functions.invoke('get-standings')
  if (error) throw error
  return data?.standings ?? []
}

// ─── Group Table ──────────────────────────────────────────────

function GroupTable({ group }: { group: Group }) {
  const label = group.group?.replace('GROUP_', 'Group ') ?? 'Group'

  return (
    <div className="bg-slate-800 border border-white/7 rounded-xl overflow-hidden mb-4">
      {/* Group header */}
      <div className="px-4 py-2.5 bg-slate-700/50 border-b border-white/7">
        <span className="font-heading text-sm text-cream tracking-wide">{label}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-white/6">
              <th className="text-left px-3 py-2 font-medium tracking-widest uppercase w-6">#</th>
              <th className="text-left px-3 py-2 font-medium tracking-widest uppercase">Team</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">P</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">W</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">D</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">L</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase">GD</th>
              <th className="text-center px-2 py-2 font-medium tracking-widest uppercase font-bold text-gold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.table.map((row, idx) => {
              const isQualifying = idx < 2  // top 2 qualify automatically
              return (
                <tr
                  key={row.team.name}
                  className={clsx(
                    'border-b border-white/4 last:border-0 transition-colors',
                    isQualifying && 'bg-green-900/8'
                  )}
                >
                  <td className="px-3 py-2.5 text-slate-500 font-medium">{row.position}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.team.crest && (
                        <img
                          src={row.team.crest}
                          alt={row.team.shortName}
                          className="w-4 h-4 object-contain"
                          loading="lazy"
                        />
                      )}
                      <span className={clsx(
                        'font-medium truncate max-w-[100px]',
                        isQualifying ? 'text-cream' : 'text-slate-400'
                      )}>
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
                  <td className="px-2 py-2.5 text-center font-display text-base text-gold">
                    {row.points}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Qualifying indicator */}
      <div className="px-3 py-1.5 border-t border-white/6 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-green-900/60 border border-green-700/40" />
        <span className="text-[10px] text-slate-600 font-body">Qualify for Round of 16</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function StandingsPage() {
  const [view, setView] = useState<'groups' | 'knockout'>('groups')

  const { data: standings, isLoading, error, refetch } = useQuery({
    queryKey: ['wc-standings'],
    queryFn:  fetchStandings,
    staleTime: 5 * 60 * 1000,   // 5 min — standings don't change that fast
    refetchInterval: 10 * 60 * 1000,  // refresh every 10 min
  })

  // Group the standings by group name
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

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-10">
          <p className="text-slate-500 text-sm font-body">
            Standings unavailable. Group stage may not have started yet.
          </p>
          <button onClick={() => refetch()}
            className="mt-3 text-xs text-gold border border-gold/30 px-4 py-2 rounded-lg">
            Try again
          </button>
        </div>
      )}

      {/* Group standings */}
      {!isLoading && !error && view === 'groups' && (
        <>
          {groupStandings.length === 0 ? (
            <div className="text-center py-10">
              <div className="font-display text-4xl text-slate-700 mb-2">NOT STARTED</div>
              <p className="text-slate-500 text-sm font-body">
                Group standings will appear once matches begin.
              </p>
            </div>
          ) : (
            groupStandings.map(group => (
              <GroupTable key={group.group} group={group} />
            ))
          )}
        </>
      )}

      {/* Knockout placeholder */}
      {view === 'knockout' && (
        <div className="text-center py-10">
          <div className="font-display text-4xl text-slate-700 mb-2">COMING SOON</div>
          <p className="text-slate-500 text-sm font-body">
            Knockout bracket appears after the group stage.
          </p>
        </div>
      )}

      <p className="text-center text-slate-700 text-xs mt-4 font-body">
        Updates every 10 minutes · Data via football-data.org
      </p>
    </div>
  )
}
