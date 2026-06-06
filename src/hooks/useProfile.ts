import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfile(data)
        setLoading(false)
      })
  }, [user])

  return { profile, loading, error }
}

// Returns a boolean — matches AdminPage usage: const isAdmin = useIsAdmin(user?.id)
export function useIsAdmin(userId?: string): boolean {
  const { profile, loading } = useProfile()
  if (!userId) return false
  return !loading && profile?.role === 'admin'
}
