import { useNavigate, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { signOut } from '@/hooks/useAuth'
import type { Profile } from '@/lib/types'
import Top5Leaderboard from './Top5Leaderboard'

interface SidebarProps {
  profile: Profile | null
  currentUserId?: string
  showAdmin?: boolean
}

const NAV_ITEMS = [
  {
    path: '/dashboard',
    label: 'Fixtures',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    path: '/picks',
    label: 'My Picks',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    path: '/leaderboard',
    label: 'Full Standings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    path: '/standings',
    label: 'WC Standings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 010 20M12 2a14.5 14.5 0 000 20M2 12h20" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

export default function Sidebar({ profile, currentUserId, showAdmin = false }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = showAdmin ? [...NAV_ITEMS, {
    path: '/admin',
    label: 'Admin',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  }] : NAV_ITEMS

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-white/7 min-h-screen fixed top-0 left-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/7">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-11 bg-shield-gradient flex items-center justify-center flex-shrink-0"
            style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }}
          >
            <span className="font-display text-sm text-gold tracking-wider pb-1">PBS</span>
          </div>
          <div>
            <p className="font-display text-lg tracking-[2px] text-cream leading-tight">PICKS PRO</p>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase">World Cup 2026</p>
          </div>
        </div>
      </div>

      {/* User profile chip */}
      {profile && (
        <div className="mx-4 mt-4 p-3 bg-slate-800 border border-white/7 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-maroon/30 border border-maroon/40 flex items-center justify-center text-xs font-medium text-red-200 flex-shrink-0">
            {getInitials(profile.display_name ?? profile.username)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cream truncate">
              {profile.display_name ?? profile.username}
            </p>
            <p className="text-xs text-slate-500">
              <span className="text-gold font-display text-base">{profile.total_points}</span>
              <span className="ml-1 tracking-widest uppercase text-[10px]">pts</span>
            </p>
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="px-3 mt-5 space-y-1 flex-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/dashboard' && location.pathname === '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                isActive
                  ? 'bg-gold/8 text-gold border border-gold/15'
                  : 'text-slate-400 hover:text-cream hover:bg-slate-800'
              )}
            >
              <span className={isActive ? 'text-gold' : 'text-slate-500'}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Top 5 leaderboard - always visible */}
      <div className="px-4 pb-4">
        <div className="border-t border-white/7 pt-4 mb-3">
          <p className="text-[10px] text-slate-600 tracking-[3px] uppercase mb-3 font-medium px-1">
            Top 5 — Live
          </p>
          <Top5Leaderboard currentUserId={currentUserId} variant="card" />
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut()}
          className="w-full text-xs text-slate-600 hover:text-slate-400 py-2 transition-colors tracking-widest uppercase font-medium"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
