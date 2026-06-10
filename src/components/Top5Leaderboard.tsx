import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clsx } from 'clsx'

interface Props {
  currentUserId?: string
  variant: 'strip' | 'card'
}

interface LeaderRow { id: string; auth_user_id: string | null; display_name: string | null; username: string; total_points: number }

async function fetchTop10(): Promise<LeaderRow[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, auth_user_id, display_name, username, total_points')
    .eq('is_registered', true)
    .order('total_points', { ascending: false })
    .limit(10)
  return data ?? []
}

export default function Top5Leaderboard({ currentUserId, variant }: Props) {
  const { data } = useQuery({ queryKey: ['top10'], queryFn: fetchTop10, staleTime: 60_000 })

  if (!data?.length) return null

  return (
    <div className={clsx(variant === 'strip' ? 'flex gap-2 overflow-x-auto scrollbar-hide' : 'space-y-2')}>
      {data.map((row, i) => (
        <div key={row.id} className={clsx(
          'flex items-center gap-2 rounded-xl px-3 py-2',
          variant === 'strip' ? 'bg-slate-800 border border-white/7 flex-shrink-0' : 'bg-slate-900 border border-white/6',
          row.auth_user_id === currentUserId && 'border-gold/30'
        )}>
          <span className="font-display text-sm text-slate-600 w-4">{i + 1}</span>
          <span className="font-medium text-cream text-xs truncate max-w-[80px]">
            {row.display_name ?? row.username}
          </span>
          <span className="font-display text-gold text-sm ml-auto">{row.total_points}</span>
        </div>
      ))}
    </div>
  )
}
