import { useState } from 'react'
import { useAuth, signOut } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'

export default function SettingsPage() {
  const { user } = useAuth()
  const { profile } = useProfile(user?.id)
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login')
  }

  return (
    <div className="animate-fade-in max-w-md">
      <h1 className="font-display text-3xl tracking-[2px] text-cream mb-1">SETTINGS</h1>
      <p className="text-xs text-slate-600 tracking-widest uppercase font-body mb-5">Account</p>

      {profile && (
        <div className="bg-slate-800 border border-white/8 rounded-xl p-5 mb-4">
          <p className="text-[10px] text-slate-500 tracking-widest uppercase font-medium mb-3">Your Profile</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-body">Name</span>
              <span className="text-cream font-medium">{profile.display_name ?? profile.username}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-body">Phone</span>
              <span className="text-cream font-mono text-xs">{profile.phone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-body">Points</span>
              <span className="font-display text-xl text-gold">{profile.total_points}</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className={clsx(
          'w-full py-3 rounded-xl font-heading tracking-widest uppercase text-xs transition-all',
          'bg-slate-800 border border-white/8 text-slate-400 hover:text-red-400 hover:border-red-800/40',
          signingOut && 'opacity-50 cursor-not-allowed'
        )}
      >
        {signingOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  )
}
