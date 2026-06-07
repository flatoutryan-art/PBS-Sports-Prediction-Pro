import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LeaderboardEntry } from '@/lib/types'

async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('rank', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export function useLeaderboard(limit = 50) {
  const queryClient = useQueryClient()

  // Real-time subscription: fires on any profile INSERT or UPDATE
  // Covers: new player registers + points awarded after match
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'is_registered=eq.true',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  // Polling fallback — catches anything realtime misses
  // (Edge Functions using service_role may bypass realtime)
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: () => fetchLeaderboard(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}
