import { useState, useEffect } from 'react'
import { lookupPhone, loginWithPin, registerWithPin, normalisePhone, setNewPinAfterReset } from '@/hooks/useAuth'
import { clsx } from 'clsx'
import { format } from 'date-fns'

// ─── PIN Dot Display ─────────────────────────────────────────

function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex gap-4 justify-center my-6">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'w-4 h-4 rounded-full border-2 transition-all duration-150',
            i < filled
              ? 'bg-gold border-gold scale-110'
              : 'bg-transparent border-slate-600'
          )}
        />
      ))}
    </div>
  )
}

// ─── PIN Numpad ───────────────────────────────────────────────

const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

interface PinPadProps {
  onKey: (k: string) => void
  disabled?: boolean
}

function PinPad({ onKey, disabled }: PinPadProps) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {PAD_KEYS.map((key, i) => {
        if (key === '') return <div key={i} />
        const isBackspace = key === '⌫'
        return (
          <button
            key={i}
            onClick={() => !disabled && onKey(key)}
            disabled={disabled}
            className={clsx(
              'h-16 rounded-2xl text-xl font-heading tracking-wide transition-all',
              'active:scale-95 select-none',
              isBackspace
                ? 'bg-slate-700 border border-white/8 text-slate-400 hover:text-cream hover:bg-slate-600'
                : 'bg-slate-800 border border-white/8 text-cream hover:bg-slate-700 hover:border-gold/30',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}

// ─── Phone Entry Step ─────────────────────────────────────────

interface PhoneStepProps {
  onNext: (phone: string) => void
}

function PhoneStep({ onNext }: PhoneStepProps) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setIsLoading(true)
    setError('')
    // Validate before passing up
    const digits = value.replace(/\D/g, '')
    if (digits.length < 9) {
      setError('Enter a valid SA mobile number.')
      setIsLoading(false)
      return
    }
    onNext(value.trim())
    setIsLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-heading text-xl text-cream tracking-wide mb-1">Welcome</h2>
      <p className="text-slate-400 text-sm font-body mb-7 leading-relaxed">
        Enter your registered WhatsApp number to get started.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 tracking-widest uppercase mb-2 font-medium">
            Mobile Number
          </label>
          <div className="flex gap-2">
            <div className="bg-slate-700 border border-slate-600 rounded-xl px-3 flex items-center text-slate-300 text-sm font-body flex-shrink-0">
              🇿🇦 +27
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="71 234 5678"
              autoFocus
              className="flex-1 bg-slate-950 border border-slate-600 rounded-xl px-4 py-3.5
                         text-cream text-lg placeholder-slate-600 outline-none tracking-wider
                         focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all font-body"
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-2 font-body">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="w-full bg-shield-gradient border border-maroon/60 text-red-100
                     font-heading tracking-[2px] uppercase text-sm py-4 rounded-xl
                     transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
              Checking…
            </span>
          ) : 'Continue →'}
        </button>
      </form>
    </div>
  )
}

// ─── PIN Step (Set or Enter) ──────────────────────────────────

interface PinStepProps {
  mode: 'set_pin' | 'enter_pin' | 'force_reset'
  displayName: string
  phone: string
  onSuccess: () => void
  onBack: () => void
  onForceReset?: () => void
}

function PinStep({ mode, displayName, phone, onSuccess, onBack, onForceReset }: PinStepProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isSet = mode === 'set_pin' || mode === 'force_reset'
  const isForceReset = mode === 'force_reset'
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
      if (next.length === 6) handleConfirmComplete(next)
    } else {
      setPin(next)
      if (next.length === 6) {
        if (isSet) {
          // Move to confirm stage
          setTimeout(() => setStage('confirm'), 100)
        } else {
          handleLoginComplete(next)
        }
      }
    }
  }

  async function handleConfirmComplete(confirmedPin: string) {
    if (confirmedPin !== pin) {
      setError('PINs don\'t match. Try again.')
      setConfirmPin('')
      setPin('')
      setStage('enter')
      return
    }
    setIsLoading(true)
    // force_reset uses set_new_pin_after_reset; normal registration uses registerWithPin
    const result = isForceReset
      ? await setNewPinAfterReset(phone, pin)
      : await registerWithPin(phone, pin)
    setIsLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Failed to set PIN.')
      setConfirmPin('')
      setPin('')
      setStage('enter')
      return
    }
    onSuccess()
  }

  async function handleLoginComplete(enteredPin: string) {
    setIsLoading(true)
    const result = await loginWithPin(phone, enteredPin)
    setIsLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Incorrect PIN.')
      setPin('')
      return
    }
    // Admin triggered a PIN reset — force them to set a new one
    if (result.requiresPinReset) {
      setPin('')
      setStage('enter')
      setError('')
      // Signal parent to switch to force-reset mode
      onForceReset?.()
      return
    }
    onSuccess()
  }

  const displayedPin = stage === 'confirm' ? confirmPin : pin

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-500 text-sm mb-6 hover:text-slate-300 transition-colors font-body"
      >
        ← {normalisePhone(phone)}
      </button>

      {isForceReset && (
        <div className="mb-5 bg-maroon/8 border border-maroon/20 rounded-xl p-3 text-center">
          <p className="text-red-400 text-sm font-medium font-body">🔑 New PIN Required</p>
          <p className="text-slate-400 text-xs mt-0.5 font-body">
            Your PIN was reset by the admin. Please create a new one.
          </p>
        </div>
      )}
      {isSet && !isForceReset && (
        <div className="mb-5 bg-gold/8 border border-gold/20 rounded-xl p-3 text-center">
          <p className="text-gold text-sm font-medium font-body">
            👋 Welcome, {displayName}!
          </p>
          <p className="text-slate-400 text-xs mt-0.5 font-body">
            {stage === 'enter' ? 'Create a 6-digit PIN to secure your account.' : 'Confirm your PIN.'}
          </p>
        </div>
      )}

      <h2 className="font-heading text-xl text-cream tracking-wide text-center">
        {isSet
          ? stage === 'enter' ? 'Set Your PIN' : 'Confirm PIN'
          : `Welcome back, ${displayName.split(' ')[0]}!`}
      </h2>

      {!isSet && (
        <p className="text-slate-500 text-sm text-center mt-1 font-body">Enter your 6-digit PIN</p>
      )}

      <PinDots length={6} filled={displayedPin.length} />

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
        {isSet
          ? 'You\'ll use this PIN every time you sign in.'
          : '5 incorrect attempts will lock your account for 15 minutes.'}
      </p>
    </div>
  )
}

// ─── Not Invited ──────────────────────────────────────────────

function NotInvited({ phone, onBack }: { phone: string; onBack: () => void }) {
  return (
    <div className="animate-fade-in text-center">
      <div className="w-14 h-14 rounded-full bg-maroon/10 border border-maroon/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔒</span>
      </div>
      <h2 className="font-heading text-xl text-cream mb-2 tracking-wide">Not on the list</h2>
      <p className="text-slate-400 text-sm font-body leading-relaxed mb-2">
        <span className="text-red-400">{normalisePhone(phone)}</span> isn't registered.
      </p>
      <p className="text-slate-500 text-sm font-body mb-6">
        PBS Picks Pro is invite-only. Contact the league admin to get added.
      </p>
      <button
        onClick={onBack}
        className="w-full bg-slate-700 border border-white/8 text-slate-300
                   font-heading tracking-widest uppercase text-sm py-3.5 rounded-xl
                   transition-all active:scale-[0.98]"
      >
        Try Another Number
      </button>
    </div>
  )
}

// ─── Locked ───────────────────────────────────────────────────

function LockedScreen({ lockedUntil, onBack }: { lockedUntil: string; onBack: () => void }) {
  const unlockTime = format(new Date(lockedUntil), 'HH:mm')
  return (
    <div className="animate-fade-in text-center">
      <div className="text-4xl mb-4">🔐</div>
      <h2 className="font-heading text-xl text-cream mb-2">Account Locked</h2>
      <p className="text-slate-400 text-sm font-body mb-1">Too many incorrect PIN attempts.</p>
      <p className="text-slate-500 text-sm font-body mb-6">
        Try again after <span className="text-gold">{unlockTime}</span>.
      </p>
      <button onClick={onBack} className="text-slate-500 text-sm underline font-body">
        Use a different number
      </button>
    </div>
  )
}

// ─── Main Login Page ──────────────────────────────────────────

type LoginStep = 'phone' | 'set_pin' | 'enter_pin' | 'force_reset' | 'not_invited' | 'locked'

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('phone')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [lockedUntil, setLockedUntil] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  async function handlePhoneSubmit(rawPhone: string) {
    setIsChecking(true)
    setPhone(rawPhone)
    const result = await lookupPhone(rawPhone)
    setIsChecking(false)

    if (result.status === 'not_invited') { setStep('not_invited'); return }
    if (result.status === 'locked')      { setLockedUntil(result.lockedUntil); setStep('locked'); return }
    setDisplayName(result.displayName)
    setStep(result.status)
  }

  function handleAuthSuccess() {
    // useAuth listener in App.tsx will detect the new session and redirect
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="h-1 bg-gold-gradient" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 relative">
            <div
              className="absolute inset-0 bg-shield-gradient"
              style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }}
            />
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
        <div className="w-full max-w-sm bg-slate-800 border border-white/8 rounded-2xl p-6">
          {isChecking && (
            <div className="flex justify-center py-10">
              <span className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          )}

          {!isChecking && step === 'phone' && (
            <PhoneStep onNext={handlePhoneSubmit} />
          )}
          {!isChecking && (step === 'set_pin' || step === 'enter_pin' || step === 'force_reset') && (
            <PinStep
              mode={step}
              displayName={displayName}
              phone={phone}
              onSuccess={handleAuthSuccess}
              onBack={() => { setStep('phone'); setPhone('') }}
              onForceReset={() => setStep('force_reset')}
            />
          )}
          {!isChecking && step === 'not_invited' && (
            <NotInvited phone={phone} onBack={() => setStep('phone')} />
          )}
          {!isChecking && step === 'locked' && (
            <LockedScreen lockedUntil={lockedUntil} onBack={() => setStep('phone')} />
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
