import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ─── Session state ───────────────────────────────────────────

export interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setIsLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: !!session,
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// ─── Phone Lookup ─────────────────────────────────────────────

export type PhoneLookupResult =
  | { status: 'not_invited' }
  | { status: 'locked'; lockedUntil: string }
  | { status: 'set_pin'; displayName: string }
  | { status: 'enter_pin'; displayName: string }

export async function lookupPhone(rawPhone: string): Promise<PhoneLookupResult> {
  const phone = normalisePhone(rawPhone)
  const { data, error } = await supabase.rpc('lookup_profile_by_phone', { p_phone: phone })

  if (error || !data?.length) return { status: 'not_invited' }

  const p = data[0]
  if (p.locked_until && new Date(p.locked_until) > new Date()) {
    return { status: 'locked', lockedUntil: p.locked_until }
  }
  const displayName: string = p.display_name ?? 'Player'
  return p.is_registered
    ? { status: 'enter_pin', displayName }
    : { status: 'set_pin', displayName }
}

// ─── Join League With Code ─────────────────────────────────────

export type JoinWithCodeResult =
  | { status: 'set_pin'; isNew: boolean }
  | { status: 'enter_pin' }
  | { status: 'wrong_code' }
  | { status: 'registration_closed' }
  | { status: 'league_full' }
  | { status: 'invalid_phone' }
  | { status: 'invalid_name' }
  | { status: 'error'; message: string }

export async function joinWithCode(
  rawPhone: string,
  displayName: string,
  code: string
): Promise<JoinWithCodeResult> {
  const phone = normalisePhone(rawPhone)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/join-league`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
      body: JSON.stringify({ phone, display_name: displayName, code }),
    })
    const data = await res.json()
    return data as JoinWithCodeResult
  } catch {
    return { status: 'error', message: 'Network error. Please try again.' }
  }
}

// ─── Registration (Edge Function) ────────────────────────────

export async function registerWithPin(
  rawPhone: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  const phone = normalisePhone(rawPhone)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const res = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ phone, pin }),
  })

  const data = await res.json()
  if (!data.success) return { success: false, error: data.error ?? 'Registration failed.' }

  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })

  return { success: true }
}

// ─── Login ────────────────────────────────────────────────────

export async function loginWithPin(
  rawPhone: string,
  pin: string
): Promise<{ success: boolean; error?: string; errorCode?: string; requiresPinReset?: boolean }> {
  const phone = normalisePhone(rawPhone)

  const { data, error } = await supabase.rpc('verify_pin_and_get_session', {
    p_phone: phone,
    p_pin: pin,
  })

  if (error || !data?.length) return { success: false, error: 'Server error. Please try again.' }

  const result = data[0]
  if (!result.success) {
    const messages: Record<string, string> = {
      WRONG_PIN:      'Incorrect PIN. Please try again.',
      LOCKED:         'Too many attempts. Try again in 15 minutes.',
      NOT_REGISTERED: 'PIN not set yet. Please complete registration.',
      NOT_INVITED:    'This number is not on the invite list.',
    }
    return {
      success: false,
      error: messages[result.error_code ?? ''] ?? 'Login failed.',
      errorCode: result.error_code ?? undefined,
    }
  }

  const syntheticEmail = `${phone.replace('+', '')}@pbspicks.internal`
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: pin,
  })

  if (signInError) return { success: false, error: 'Session error. Contact admin.' }
  return { success: true, requiresPinReset: result.requires_pin_reset === true }
}

/** After a PIN reset, player sets their permanent new PIN */
export async function setNewPinAfterReset(
  rawPhone: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const phone = normalisePhone(rawPhone)
  const { data, error } = await supabase.rpc('set_new_pin_after_reset', {
    p_phone: phone,
    p_new_pin: newPin,
  })
  if (error || !data?.[0]?.success) {
    return { success: false, error: error?.message ?? data?.[0]?.error_code ?? 'Failed to set PIN.' }
  }
  return { success: true }
}

// ─── Utility ─────────────────────────────────────────────────

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('27')) return `+${digits}`
  if (digits.startsWith('0'))  return `+27${digits.slice(1)}`
  return `+27${digits}`
}
