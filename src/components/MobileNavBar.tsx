import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  {
    path: '/dashboard',
    label: 'Fixtures',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    path: '/picks',
    label: 'My Picks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    path: '/leaderboard',
    label: 'Board',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    path: '/standings',
    label: 'World Cup',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 010 20M12 2a14.5 14.5 0 000 20M2 12h20" />
      </svg>
    ),
  },
  {
    path: '/community',
    label: 'Community',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function MobileNavBar({ showAdmin = false }: { showAdmin?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const items = showAdmin
    ? [...NAV_ITEMS, {
        path: '/admin',
        label: 'Admin',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <line x1="19" y1="8" x2="23" y2="8"/><line x1="19" y1="11" x2="23" y2="11"/>
          </svg>
        ),
      }]
    : NAV_ITEMS

  return (
    /* Safe area padding for iOS home indicator */
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-white/8 md:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch">
        {items.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/dashboard' && location.pathname === '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all active:scale-95',
                isActive ? 'text-gold' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <div className={clsx('transition-transform', isActive && 'scale-110')}>
                {item.icon}
              </div>
              <span className={clsx(
                'text-[10px] tracking-wider uppercase font-medium',
                isActive ? 'text-gold' : 'text-slate-600'
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-gold rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
