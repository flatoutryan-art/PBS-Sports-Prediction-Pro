import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { clsx } from 'clsx'

interface LeagueSettingsPanelProps {
  adminUid: string
}

interface Settings {
  join_code: string
  max_players: string
  registration_open: string
}

async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('league_settings')
    .select('key, value')
  if (error) throw error
  return Object.fromEntries(data.map(r => [r.key, r.value])) as Settings
}

export default function LeagueSettingsPanel({ adminUid }: LeagueSettingsPanelProps) {
  const queryClient = useQueryClient()
  const [newCode, setNewCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [toggleMsg, setToggleMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['league-settings'],
    queryFn: fetchSettings,
  })

  const { mutate: updateCode, isPending: updatingCode } = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('admin_update_join_code', {
        p_new_code: code,
        p_admin_uid: adminUid,
      })
      if (error) throw error
      if (!data?.[0]?.success) throw new Error(data?.[0]?.error_code ?? 'Failed')
    },
    onSuccess: () => {
      setCodeMsg({ text: '✓ Join code updated', ok: true })
      setNewCode('')
      queryClient.invalidateQueries({ queryKey: ['league-settings'] })
    },
    onError: (e: Error) => setCodeMsg({ text: `⚠ ${e.message}`, ok: false }),
  })

  const { mutate: toggleReg, isPending: toggling } = useMutation({
    mutationFn: async (open: boolean) => {
      const { data, error } = await supabase.rpc('admin_toggle_registration', {
        p_open: open,
        p_admin_uid: adminUid,
      })
      if (error) throw error
      if (!data?.[0]?.success) throw new Error(data?.[0]?.error_code ?? 'Failed')
    },
    onSuccess: (_, open) => {
      setToggleMsg({ text: `✓ Registration ${open ? 'opened' : 'closed'}`, ok: true })
      queryClient.invalidateQueries({ queryKey: ['league-settings'] })
    },
    onError: (e: Error) => setToggleMsg({ text: `⚠ ${e.message}`, ok: false }),
  })

  if (isLoading) return (
    <div className="h-32 bg-slate-800 rounded-xl animate-pulse mb-5" />
  )

  const isOpen = settings?.registration_open === 'true'

  return (
    <div className="bg-slate-800 border border-white/8 rounded-xl p-4 mb-5 space-y-5">
      <p className="font-heading text-sm text-cream tracking-wide">League Settings</p>

      {/* Current join code display */}
      <div className="bg-slate-900 border border-white/6 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-500 tracking-[3px] uppercase font-medium mb-2">
          Current Join Code
        </p>
        <p className="font-mono text-3xl tracking-[6px] text-gold font-bold">
          {settings?.join_code ?? '—'}
        </p>
        <p className="text-[11px] text-slate-600 mt-2 font-body">
          Share this on WhatsApp. Players need it to register.
        </p>
      </div>

      {/* Change join code */}
      <div>
        <label className="text-[10px] text-slate-500 tracking-widest uppercase font-medium block mb-2">
          Change Join Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCode}
            onChange={e => { setNewCode(e.target.value.toUpperCase()); setCodeMsg(null) }}
            placeholder="NEW CODE"
            maxLength={12}
            autoCapitalize="characters"
            className="flex-1 bg-slate-950 border border-slate-600 rounded-xl px-3 py-2.5
                       font-mono text-base text-gold tracking-[4px] uppercase text-center
                       outline-none focus:border-gold transition-all placeholder-slate-700"
          />
          <button
            onClick={() => newCode.trim() && updateCode(newCode.trim())}
            disabled={updatingCode || newCode.trim().length < 4}
            className="bg-gold/10 border border-gold/30 text-gold text-xs font-heading
                       tracking-widest uppercase px-4 rounded-xl hover:bg-gold/20
                       transition-all disabled:opacity-40"
          >
            {updatingCode ? '…' : 'Update'}
          </button>
        </div>
        {codeMsg && (
          <p className={clsx('text-xs mt-2 font-body', codeMsg.ok ? 'text-green-400' : 'text-red-400')}>
            {codeMsg.text}
          </p>
        )}
        <p className="text-[11px] text-slate-600 mt-1.5 font-body">
          Changing the code immediately blocks anyone using the old one.
        </p>
      </div>

      {/* Registration toggle */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/6">
        <div>
          <p className="text-sm font-medium text-cream font-body">Registration</p>
          <p className="text-xs text-slate-500 font-body mt-0.5">
            {isOpen
              ? 'Open — new players can join with the code'
              : 'Closed — only existing players can sign in'}
          </p>
        </div>
        <button
          onClick={() => toggleReg(!isOpen)}
          disabled={toggling}
          className={clsx(
            'relative w-12 h-6 rounded-full transition-all flex-shrink-0',
            isOpen ? 'bg-gold' : 'bg-slate-600',
            toggling && 'opacity-50'
          )}
        >
          <span className={clsx(
            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
            isOpen ? 'left-6' : 'left-0.5'
          )} />
        </button>
      </div>
      {toggleMsg && (
        <p className={clsx('text-xs font-body -mt-3', toggleMsg.ok ? 'text-green-400' : 'text-red-400')}>
          {toggleMsg.text}
        </p>
      )}

      {/* Player count */}
      <div className="flex items-center justify-between text-sm border-t border-white/6 pt-3">
        <span className="text-slate-500 font-body">Registered players</span>
        <span className="font-display text-xl text-cream">
          {/* Fetched separately in parent */}
          <PlayerCount />
          <span className="text-slate-600 text-sm ml-1">/ {settings?.max_players ?? 50}</span>
        </span>
      </div>
    </div>
  )
}

function PlayerCount() {
  const { data } = useQuery({
    queryKey: ['player-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_registered', true)
      return count ?? 0
    },
    refetchInterval: 30_000,
  })
  return <>{data ?? '—'}</>
}
