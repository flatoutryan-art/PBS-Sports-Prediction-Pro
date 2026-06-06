import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Profile } from '@/hooks/useProfile'
import { signOut } from '@/hooks/useAuth'

interface SidebarProps {
  profile: Profile | null
  currentUserId?: string
  showAdmin: boolean
}

const NAV = [
  { to: '/dashboard',   label: 'Matches',     icon: '⚽' },
  { to: '/picks',       label: 'My Picks',    icon: '🎯' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/settings',    label: 'Settings',    icon: '⚙️' },
]

export default function Sidebar({ profile, showAdmin }: SidebarProps) {
  const navigate = useNavigate()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-slate-900 border-r border-white/7 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/7">
        <div className="w-9 h-10 bg-shield-gradient flex items-center justify-center"
             style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }}>
          <span className="font-display text-sm text-gold pb-0.5">PBS</span>
        </div>
        <div>
          <p className="font-display text-lg tracking-[2px] text-cream leading-tight">PICKS PRO</p>
          <p className="text-[9px] text-slate-600 tracking-widest uppercase">World Cup 2026</p>
        </div>
      </div>

      {/* Profile */}
      {profile && (
        <div className="px-5 py-4 border-b border-white/7">
          <p className="font-medium text-cream text-sm">{profile.display_name ?? profile.username}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-display text-2xl text-gold tracking-wider">{profile.total_points}</span>
            <span className="text-[10px] text-slate-500 tracking-widest uppercase">pts</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-slate-800 text-cream border border-white/8'
                : 'text-slate-400 hover:text-cream hover:bg-slate-800/50'
            )}>
            <span>{item.icon}</span>
            <span className="font-heading tracking-wide">{item.label}</span>
          </NavLink>
        ))}
        {showAdmin && (
          <NavLink to="/admin"
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-maroon/20 text-red-300 border border-maroon/30'
                : 'text-slate-500 hover:text-red-300 hover:bg-maroon/10'
            )}>
            <span>🔑</span>
            <span className="font-heading tracking-wide">Admin</span>
          </NavLink>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4">
        <button onClick={() => signOut().then(() => navigate('/login'))}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     text-slate-500 hover:text-cream hover:bg-slate-800/50 transition-all font-medium">
          <span>→</span>
          <span className="font-heading tracking-wide">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
