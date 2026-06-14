/**
 * TeamForm — shows last 3 results for a team
 * Reads from the fixtures table (already settled matches)
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clsx } from 'clsx'

interface TeamFormProps {
  teamId: string
  teamName: string
}

type FormResult = 'W' | 'L' | 'D' | '-'

async function fetchTeamForm(teamId: string): Promise<FormResult[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select('actual_home_score, actual_away_score, home_team_id, away_team_id')
    .eq('status', 'completed')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('kickoff_at', { ascending: false })
    .limit(3)

  if (error || !data?.length) return ['-', '-', '-']

  return data.map(f => {
    const isHome = f.home_team_id === teamId
    const teamScore = isHome ? f.actual_home_score : f.actual_away_score
    const oppScore  = isHome ? f.actual_away_score : f.actual_home_score
    if (teamScore === null || oppScore === null) return '-' as FormResult
    if (teamScore > oppScore)  return 'W' as FormResult
    if (teamScore < oppScore)  return 'L' as FormResult
    return 'D' as FormResult
  }).reverse() // oldest to newest left-to-right
}

const RESULT_STYLE: Record<FormResult, string> = {
  W: 'bg-green-500/80 text-white',
  L: 'bg-red-600/80 text-white',
  D: 'bg-slate-500/60 text-white',
  '-': 'bg-slate-700/40 text-slate-500',
}

export default function TeamForm({ teamId, teamName }: TeamFormProps) {
  const { data: form = ['-', '-', '-'] } = useQuery({
    queryKey: ['team-form', teamId],
    queryFn:  () => fetchTeamForm(teamId),
    staleTime: 5 * 60 * 1000,
    enabled: !!teamId,
  })

  // Don't render if no results yet
  if (form.every(r => r === '-')) return null

  return (
    <div className="flex items-center gap-1 mt-0.5">
      {form.map((result, i) => (
        <span
          key={i}
          className={clsx(
            'w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center',
            RESULT_STYLE[result]
          )}
        >
          {result}
        </span>
      ))}
    </div>
  )
}
