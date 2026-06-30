import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'

interface LeaderRow {
  id:                string
  display_name:      string | null
  username:          string
  total_points:      number
  rank:              number
  predictions_made:  number
  exact_scores:      number
  correct_results:   number
  wrong_picks:       number
}

export default function LeaderboardPage() {
  const { user } = useAuth()

  // Resolve auth.uid() -> profiles.id once, since the leaderboard view
  // exposes profiles.id (not auth_user_id) and these are different UUIDs
  const { data: myProfileId } = useQuery({
    queryKey: ['my-profile-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user!.id)
        .single()
      return data?.id ?? null
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard-full'],
    queryFn: async () => {
      // Uses the `leaderboard` DB view — exact/correct/wrong counts computed server-side
      const { data } = await supabase
        .from('leaderboard')
        .select('id, display_name, username, total_points, rank, predictions_made, exact_scores, correct_results, wrong_picks')
        .order('total_points', { ascending: false })
      return (data ?? []) as LeaderRow[]
    },
    staleTime: 60_000,
  })

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl tracking-[2px] text-cream mb-1">LEADERBOARD</h1>
      <p className="text-xs text-slate-600 tracking-widest uppercase font-body mb-5">Full standings</p>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-2">
        {data?.map((row, i) => {
          const isCurrentUser = row.id === myProfileId

          return (
            <div key={row.id} className={clsx(
              'bg-slate-800 border rounded-xl px-4 py-3',
              isCurrentUser ? 'border-gold/30 bg-gold/5' : 'border-white/7'
            )}>
              <div className="flex items-center gap-3">
                <span className={clsx('font-display text-xl w-8 text-center flex-shrink-0',
                  i === 0 ? 'text-gold' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-cream text-sm truncate">
                    {row.display_name ?? row.username}
                    {isCurrentUser && <span className="text-gold text-xs ml-2">(you)</span>}
                  </p>
                </div>
                <span className="font-display text-2xl text-gold tracking-wider flex-shrink-0">
                  {row.total_points}
                </span>
              </div>

              {/* Exact / Correct / Wrong breakdown */}
              <div className="flex items-center gap-3 mt-2 pl-11 text-[11px] font-body">
                <span className="text-gold/80">
                  <span className="font-display text-sm">{row.exact_scores}</span> exact
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-green-400/80">
                  <span className="font-display text-sm">{row.correct_results}</span> correct
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">
                  <span className="font-display text-sm">{row.wrong_picks}</span> wrong
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
