import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'

export default function MyPicksPage() {
  const { user } = useAuth()

  const { data: predictions, isLoading } = useQuery({
    queryKey: ['my-picks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('predictions')
        .select('*, fixture:fixtures(*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*))')
        .eq('user_id', user!.id)
        .order('submitted_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user,
  })

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl tracking-[2px] text-cream mb-1">MY PICKS</h1>
      <p className="text-xs text-slate-600 tracking-widest uppercase font-body mb-5">Your prediction history</p>

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-3">
        {predictions?.map((p: any) => (
          <div key={p.id} className="bg-slate-800 border border-white/7 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-heading text-sm text-cream">
                  {p.fixture?.home_team?.name} vs {p.fixture?.away_team?.name}
                </p>
                <p className="text-xs text-slate-500 font-body mt-0.5">
                  Your pick: {p.home_score} – {p.away_score}
                </p>
              </div>
              {p.points_earned !== null && (
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  p.points_earned === 3 ? 'bg-gold/15 text-gold' :
                  p.points_earned === 1 ? 'bg-green-900/30 text-green-400' :
                  'bg-slate-700 text-slate-400'
                )}>
                  +{p.points_earned} pts
                </span>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !predictions?.length && (
          <p className="text-center text-slate-600 py-10 font-body">No predictions yet — go make some picks!</p>
        )}
      </div>
    </div>
  )
}
