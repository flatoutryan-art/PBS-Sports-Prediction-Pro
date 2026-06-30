import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '@/lib/types'

// Re-export so existing `import { Profile } from '@/hooks/useProfile'` usages still work
export type { Profile }

export function useProfile(userId?: string) {
  const { user } = useAuth()
  const effectiveId = userId ?? user?.id
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!effectiveId) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', effectiveId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfile(data as Profile)
        setLoading(false)
      })
  }, [effectiveId])

  return { profile, loading, error }
}

export function useIsAdmin(userId?: string): boolean {
  const { profile, loading } = useProfile(userId)
  if (!userId) return false
  return !loading && (profile as any)?.role === 'admin'
}
