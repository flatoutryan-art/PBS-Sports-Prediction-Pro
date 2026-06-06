import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useIsAdmin } from '@/hooks/useProfile'

import LoginPage      from '@/pages/LoginPage'
import MyPicksPage    from '@/pages/MyPicksPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import SettingsPage   from '@/pages/SettingsPage'
import AdminPage      from '@/pages/AdminPage'
import MatchDashboard from '@/components/MatchDashboard'
import Sidebar        from '@/components/Sidebar'
import MobileNavBar   from '@/components/MobileNavBar'
import Top5Leaderboard from '@/components/Top5Leaderboard'
import OfflineBanner from '@/components/OfflineBanner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 15_000),
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
    mutations: { retry: 1 },
  },
})

// ─── Auth guard ───────────────────────────────────────────────

function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, isLoading, navigate])

  // Internal navigation events (from leaderboard "Full Standings" link)
  useEffect(() => {
    const handler = (e: CustomEvent<string>) => navigate(e.detail)
    window.addEventListener('navigate', handler as EventListener)
    return () => window.removeEventListener('navigate', handler as EventListener)
  }, [navigate])

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return null
  return <AppShell />
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0, 150, 300].map(delay => (
          <div key={delay} className="w-2 h-2 rounded-full bg-gold animate-bounce"
               style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  )
}

// ─── App shell ────────────────────────────────────────────────

function AppShell() {
  const { user } = useAuth()
  const { profile } = useProfile(user?.id)
  const isAdmin = useIsAdmin(user?.id)

  return (
    <div className="min-h-screen bg-slate-950 text-cream font-body">
      <Sidebar profile={profile} currentUserId={user?.id} showAdmin={isAdmin} />

      <div className="md:pl-64">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-slate-950/95 backdrop-blur
                           border-b border-white/7 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-9 bg-shield-gradient flex items-center justify-center"
                 style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }}>
              <span className="font-display text-xs text-gold pb-0.5">PBS</span>
            </div>
            <div>
              <p className="font-display text-base tracking-[2px] text-cream leading-tight">PICKS PRO</p>
              <p className="text-[9px] text-slate-600 tracking-widest uppercase leading-tight">World Cup 2026</p>
            </div>
          </div>
          {profile && (
            <div className="flex items-baseline gap-1 bg-slate-800 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="font-display text-xl text-gold tracking-wider">{profile.total_points}</span>
              <span className="text-[10px] text-slate-500 tracking-widest uppercase">pts</span>
            </div>
          )}
        </header>

        <main className="px-4 pt-5 pb-28 md:pb-8 md:px-6 max-w-2xl md:max-w-none mx-auto">
          <Outlet />
        </main>
      </div>

      <MobileNavBar showAdmin={isAdmin} />
      <OfflineBanner />
    </div>
  )
}

// ─── Dashboard with Top5 strip ────────────────────────────────

function DashboardPage() {
  const { user } = useAuth()
  return (
    <div className="md:grid md:grid-cols-[1fr_280px] md:gap-6">
      <div>
        {/* Mobile Top 5 strip */}
        <div className="md:hidden mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] text-slate-600 tracking-[3px] uppercase font-medium">Top 5</span>
            <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          </div>
          <Top5Leaderboard currentUserId={user?.id} variant="strip" />
        </div>
        <MatchDashboard userId={user?.id ?? ''} />
      </div>
      {/* Desktop sidebar Top 5 */}
      <div className="hidden md:block">
        <div className="sticky top-6 bg-slate-800 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500 tracking-[3px] uppercase font-medium">Top 5</span>
            <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          </div>
          <Top5Leaderboard currentUserId={user?.id} variant="card" />
        </div>
      </div>
    </div>
  )
}

// ─── Router ──────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<AuthGuard />}>
            <Route path="/"            element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/picks"       element={<MyPicksPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="/admin"       element={<AdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
