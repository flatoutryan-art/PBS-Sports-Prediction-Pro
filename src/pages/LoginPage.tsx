import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  joinWithCode,
  loginWithPin,
  registerWithPin,
  setNewPinAfterReset,
  lookupPhone,
  normalisePhone,
  useAuth,
} from '@/hooks/useAuth'
import { clsx } from 'clsx'
import { format } from 'date-fns'

// ─── PIN Dots ─────────────────────────────────────────────────

function PinDots({ filled }: { filled: number }) {
  return (
    <div className="flex gap-4 justify-center my-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={clsx(
          'w-4 h-4 rounded-full border-2 transition-all duration-150',
          i < filled ? 'bg-gold border-gold scale-110' : 'bg-transparent border-slate-600'
        )} />
      ))}
    </div>
  )
}

// ─── PIN Numpad ───────────────────────────────────────────────

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

function PinPad({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {PAD_KEYS.map((key, i) => {
        if (key === '') return <div key={i} />
        const isBack = key === '⌫'
        return (
          <button key={i} onClick={() => !disabled && onKey(key)} disabled={disabled}
            className={clsx(
              'h-16 rounded-2xl text-xl font-heading tracking-wide transition-all active:scale-95 select-none',
              isBack
                ? 'bg-slate-700 border border-white/8 text-slate-400 hover:text-cream hover:bg-slate-600'
                : 'bg-slate-800 border border-white/8 text-cream hover:bg-slate-700 hover:border-gold/30',
              disabled && 'opacity-40 cursor-not-allowed'
            )}>
            {key}
          </button>
        )
      })}
    </div>
  )
}

// ─── Shared PIN Entry Screen ──────────────────────────────────

type PinMode = 'set_pin' | 'enter_pin' | 'confirm_pin' | 'force_reset'

interface PinScreenProps {
  mode: PinMode
  phone: string
  displayName: string
  onSuccess: () => void
  onBack: () => void
  onForceReset?: () => void
}

function PinScreen({ mode, phone, displayName, onSuccess, onBack, onForceReset }: PinScreenProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isSetting = mode === 'set_pin' || mode === 'force_reset'
  const currentPin = stage === 'confirm' ? confirmPin : pin

  function handleKey(key: string) {
    setError('')
    if (key === '⌫') {
      if (stage === 'confirm') setConfirmPin(p => p.slice(0, -1))
      else setPin(p => p.slice(0, -1))
      return
    }
    const next = currentPin + key
    if (next.length > 6) return

    if (stage === 'confirm') {
      setConfirmPin(next)
      if (next.length === 6) finishConfirm(next)
    } else {
      setPin(next)
      if (next.length === 6) {
        if (isSetting) setTimeout(() => setStage('confirm'), 120)
        else finishLogin(next)
      }
    }
  }

  async function finishConfirm(confirmed: string) {
    if (confirmed !== pin) {
      setError("PINs don't match. Try again.")
      setPin(''); setConfirmPin(''); setStage('enter')
      return
    }
    setIsLoading(true)
    const result = mode === 'force_reset'
      ? await setNewPinAfterReset(phone, pin)
      : await registerWithPin(phone, pin)
    setIsLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Failed. Please try again.')
      setPin(''); setConfirmPin(''); setStage('enter')
      return
    }
    onSuccess()
  }

  async function finishLogin(enteredPin: string) {
    setIsLoading(true)
    const result = await loginWithPin(phone, enteredPin)
    setIsLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Incorrect PIN.')
      setPin('')
      return
    }
    if (result.requiresPinReset) { onForceReset?.(); return }
    onSuccess()
  }

  const headings: Record<string, string> = {
    set_pin:     stage === 'confirm' ? 'Confirm your PIN' : 'Create your PIN',
    confirm_pin: 'Confirm your PIN',
    enter_pin:   `Welcome back, ${displayName.split(' ')[0]}!`,
    force_reset: stage === 'confirm' ? 'Confirm new PIN' : 'Create new PIN',
  }

  return (
    <div className="animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-slate-500 text-sm mb-5 hover:text-slate-300 transition-colors font-body">
        ← {normalisePhone(phone)}
      </button>

      {mode === 'force_reset' && (
        <div className="mb-4 bg-maroon/8 border border-maroon/20 rounded-xl p-3 text-center">
          <p className="text-red-400 text-sm font-medium font-body">🔑 New PIN required</p>
          <p className="text-slate-500 text-xs mt-0.5 font-body">Your PIN was reset by the admin.</p>
        </div>
      )}

      {mode === 'set_pin' && stage === 'enter' && (
        <div className="mb-4 bg-gold/8 border border-gold/20 rounded-xl p-3 text-center">
          <p className="text-gold text-sm font-medium font-body">👋 Welcome, {displayName}!</p>
          <p className="text-slate-400 text-xs mt-0.5 font-body">Choose a 6-digit PIN to secure your account.</p>
        </div>
      )}

      <h2 className="font-heading text-xl text-cream tracking-wide text-center mb-1">
        {headings[mode]}
      </h2>
      {mode === 'enter_pin' && (
        <p className="text-slate-500 text-sm text-center font-body">Enter your 6-digit PIN</p>
      )}

      <PinDots filled={stage === 'confirm' ? confirmPin.length : pin.length} />

      {error && (
        <p className="text-red-400 text-sm text-center mb-4 font-body animate-fade-in">{error}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : (
        <PinPad onKey={handleKey} disabled={isLoading} />
      )}

      <p className="text-slate-600 text-xs text-center mt-5 font-body">
        {isSetting
          ? "You'll use this PIN every time you sign in."
          : '5 wrong attempts will lock your account for 15 minutes.'}
      </p>
    </div>
  )
}

// ─── REGISTER TAB ─────────────────────────────────────────────

interface RegisterTabProps {
  onProceedToPin: (phone: string, displayName: string, isNew: boolean) => void
}

function RegisterTab({ onProceedToPin }: RegisterTabProps) {
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !displayName.trim() || !joinCode.trim()) return
    setIsLoading(true)
    setError('')

    const result = await joinWithCode(phone.trim(), displayName.trim(), joinCode.trim())
    setIsLoading(false)

    if (result.status === 'set_pin') {
      onProceedToPin(phone.trim(), displayName.trim(), result.isNew)
      return
    }
    if (result.status === 'enter_pin') {
      // Already registered — redirect to login tab behaviour
      onProceedToPin(phone.trim(), displayName.trim(), false)
      return
    }

    const errorMessages: Record<string, string> = {
      wrong_code:           '❌ Incorrect league code. Check the code and try again.',
      registration_closed:  '🔒 Registration is currently closed. Contact the admin.',
      league_full:          '⚽ The league is full (50 players). Contact the admin.',
      invalid_phone:        '📱 Please enter a valid South African mobile number.',
      invalid_name:         '👤 Please enter your full name (at least 2 characters).',
      error:                'result' in result && 'message' in result
                              ? (result as { message: string }).message
                              : 'Something went wrong. Please try again.',
    }
    setError(errorMessages[result.status] ?? 'Something went wrong.')
  }

  return (
    <div className="animate-fade-in">
      <p className="text-slate-400 text-sm font-body mb-6 leading-relaxed">
        Enter your details and the league join code shared by the admin on WhatsApp.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 tracking-widest uppercase mb-1.5 font-medium">
            Your Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setError('') }}
            placeholder="Ryan van Es"
            autoComplete="name"
            className="w-full bg-slate-950 border border-slate-600 rounded-xl px-4 py-3.5
                       text-cream text-base placeholder-slate-600 outline-none
                       focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all font-body"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 tracking-widest uppercase mb-1.5 font-medium">
            WhatsApp Number
          </label>
          <div className="flex gap-2">
            <div className="bg-slate-700 border border-slate-600 rounded-xl px-3 flex items-center text-slate-300 text-sm font-body flex-shrink-0">
              🇿🇦 +27
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="71 234 5678"
              autoComplete="tel"
              className="flex-1 bg-slate-950 border border-slate-600 rounded-xl px-4 py-3.5
                         text-cream text-base placeholder-slate-600 outline-none tracking-wider
                         focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all font-body"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 tracking-widest uppercase mb-1.5 font-medium">
            League Join Code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
            placeholder="PBS2026"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={12}
            className="w-full bg-slate-950 border border-slate-600 rounded-xl px-4 py-3.5
                       text-cream text-base placeholder-slate-600 outline-none
                       font-mono tracking-[4px] uppercase text-center
                       focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all"
          />
          <p className="text-[11px] text-slate-600 mt-1.5 font-body text-center">
            Ask the league admin for the code if you don't have it.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/30 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm font-body">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !phone.trim() || !displayName.trim() || !joinCode.trim()}
          className="w-full bg-shield-gradient border border-maroon/60 text-red-100
                     font-heading tracking-[2px] uppercase text-sm py-4 rounded-xl
                     transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
              Checking…
            </span>
          ) : 'Join League →'}
        </button>
      </form>
    </div>
  )
}

// ─── LOGIN TAB ────────────────────────────────────────────────

interface LoginTabProps {
  onProceedToPin: (phone: string, displayName: string, isRegistered: boolean) => void
}

function LoginTab({ onProceedToPin }: LoginTabProps) {
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setIsLoading(true)
    setError('')

    const result = await lookupPhone(phone.trim())
    setIsLoading(false)

    if (result.status === 'not_invited') {
      setError("Number not found. If you're new, use the Register tab.")
      return
    }
    if (result.status === 'locked') {
      const t = format(new Date(result.lockedUntil), 'HH:mm')
      setError(`Account locked. Try again after ${t}.`)
      return
    }
    // At this point result.status is 'set_pin' | 'enter_pin' — both have displayName
    const isRegistered = result.status === 'enter_pin'
    onProceedToPin(phone.trim(), result.displayName, isRegistered)
  }

  return (
    <div className="animate-fade-in">
      <p className="text-slate-400 text-sm font-body mb-6 leading-relaxed">
        Already registered? Enter your number to sign in.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 tracking-widest uppercase mb-1.5 font-medium">
            WhatsApp Number
          </label>
          <div className="flex gap-2">
            <div className="bg-slate-700 border border-slate-600 rounded-xl px-3 flex items-center text-slate-300 text-sm font-body flex-shrink-0">
              🇿🇦 +27
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="71 234 5678"
              autoFocus
              autoComplete="tel"
              className="flex-1 bg-slate-950 border border-slate-600 rounded-xl px-4 py-3.5
                         text-cream text-base placeholder-slate-600 outline-none tracking-wider
                         focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all font-body"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/30 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm font-body">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !phone.trim()}
          className="w-full bg-shield-gradient border border-maroon/60 text-red-100
                     font-heading tracking-[2px] uppercase text-sm py-4 rounded-xl
                     transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
              Looking up…
            </span>
          ) : 'Continue →'}
        </button>
      </form>
    </div>
  )
}

// ─── Main Login Page ──────────────────────────────────────────

type Screen = 'tabs' | 'set_pin' | 'enter_pin' | 'force_reset'

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Redirect to dashboard as soon as a session is detected
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register')
  const [screen, setScreen] = useState<Screen>('tabs')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')

  function handleProceedToPin(ph: string, name: string, isRegistered: boolean) {
    setPhone(ph)
    setDisplayName(name)
    setScreen(isRegistered ? 'enter_pin' : 'set_pin')
  }

  function handleAuthSuccess() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="h-1 bg-gold-gradient" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 relative">
            <div className="absolute inset-0 bg-shield-gradient"
                 style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }} />
            <div className="absolute inset-0 flex items-center justify-center pb-1">
              <span className="font-display text-xl text-gold tracking-widest">PBS</span>
            </div>
          </div>
          <h1 className="font-display text-3xl tracking-[3px] text-cream">PICKS PRO</h1>
          <p className="text-slate-600 text-[11px] mt-0.5 tracking-widest uppercase font-body">
            World Cup 2026
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-slate-800 border border-white/8 rounded-2xl overflow-hidden">

          {screen === 'tabs' && (
            <>
              {/* Tab headers */}
              <div className="flex border-b border-white/8">
                {(['register', 'login'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'flex-1 py-3.5 text-sm font-heading tracking-[2px] uppercase transition-all',
                      activeTab === tab
                        ? 'text-gold border-b-2 border-gold bg-gold/5'
                        : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {tab === 'register' ? '🆕 New Player' : '🔑 Sign In'}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'register' ? (
                  <RegisterTab onProceedToPin={handleProceedToPin} />
                ) : (
                  <LoginTab onProceedToPin={handleProceedToPin} />
                )}
              </div>
            </>
          )}

          {(screen === 'set_pin' || screen === 'enter_pin' || screen === 'force_reset') && (
            <div className="p-6">
              <PinScreen
                mode={screen === 'force_reset' ? 'force_reset' : screen}
                phone={phone}
                displayName={displayName}
                onSuccess={handleAuthSuccess}
                onBack={() => setScreen('tabs')}
                onForceReset={() => setScreen('force_reset')}
              />
            </div>
          )}

        </div>
      </div>

      <div className="pb-8 text-center">
        <p className="text-slate-700 text-[11px] tracking-widest uppercase font-body">
          Play · Bet · Sports
        </p>
      </div>
    </div>
  )
}
