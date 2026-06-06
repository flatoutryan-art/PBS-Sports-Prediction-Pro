import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

interface MobileNavBarProps { showAdmin: boolean }

const NAV = [
  { to: '/dashboard',   icon: '⚽', label: 'Matches' },
  { to: '/picks',       icon: '🎯', label: 'Picks' },
  { to: '/leaderboard', icon: '🏆', label: 'Board' },
  { to: '/settings',    icon: '⚙️', label: 'Settings' },
]

export default function MobileNavBar({ showAdmin }: MobileNavBarProps) {
  const items = showAdmin ? [...NAV, { to: '/admin', icon: '🔑', label: 'Admin' }] : NAV

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur
                    border-t border-white/7 flex items-center justify-around px-2 pb-safe">
      {items.map(item => (
        <NavLink key={item.to} to={item.to}
          className={({ isActive }) => clsx(
            'flex flex-col items-center gap-0.5 px-3 py-2.5 text-center transition-all',
            isActive ? 'text-gold' : 'text-slate-500'
          )}>
          <span className="text-xl leading-none">{item.icon}</span>
          <span className="text-[10px] tracking-widest uppercase font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
