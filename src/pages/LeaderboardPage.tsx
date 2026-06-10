import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'

interface LeaderRow { id: string; auth_user_id: string | null; display_name: string | null; username: string; total_points: number; is_registered: boolean }

export default function LeaderboardPage() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard-full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, auth_user_id, display_name, username, total_points, is_registered')
        .eq('is_registered', true)
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
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-2">
        {data?.map((row, i) => (
          <div key={row.id} className={clsx(
            'flex items-center gap-3 bg-slate-800 border rounded-xl px-4 py-3',
            row.auth_user_id === user?.id ? 'border-gold/30 bg-gold/5' : 'border-white/7'
          )}>
            <span className={clsx('font-display text-xl w-8 text-center',
              i === 0 ? 'text-gold' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'
            )}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-cream text-sm truncate">
                {row.display_name ?? row.username}
                {row.auth_user_id === user?.id && <span className="text-gold text-xs ml-2">(you)</span>}
              </p>
            </div>
            <span className="font-display text-2xl text-gold tracking-wider">{row.total_points}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
