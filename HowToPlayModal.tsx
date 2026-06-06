import { clsx } from 'clsx'

interface HowToPlayProps {
  isOpen: boolean
  onClose: () => void
}

const SCORING_RULES = [
  { pts: 3, label: 'Exact Score',    desc: 'You predict 2–1 and the final is 2–1.', icon: '⚡' },
  { pts: 1, label: 'Correct Result', desc: 'You predict a home win and the home team wins (any score).', icon: '✓' },
  { pts: 0, label: 'Wrong Pick',     desc: 'Your predicted outcome doesn\'t match the result.', icon: '✗' },
]

const FAQ = [
  {
    q: 'When can I submit predictions?',
    a: 'Any time before the match kicks off. Once the whistle blows, the prediction is locked. You\'ll see a countdown on upcoming matches.',
  },
  {
    q: 'Can I change my prediction?',
    a: 'Yes — as many times as you like, right up until kickoff. After that it\'s locked in.',
  },
  {
    q: 'When are points awarded?',
    a: 'The admin enters the final score after each match. Points appear on the leaderboard within minutes of the full-time whistle.',
  },
  {
    q: 'What if I forget to predict a match?',
    a: 'You get 0 points for any match with no prediction. The fixture will show "No prediction submitted" on your Picks page.',
  },
  {
    q: 'How do I get WhatsApp alerts?',
    a: 'Go to Settings and enter your mobile number. You\'ll receive a reminder 4 hours before kickoff and a weekly standings update every Sunday at 18:00.',
  },
  {
    q: 'What happens if matches are postponed?',
    a: 'The admin updates the kickoff time. Your prediction stays saved and the lock time moves with the new kickoff.',
  },
]

export default function HowToPlayModal({ isOpen, onClose }: HowToPlayProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 md:rounded-2xl
                      rounded-t-2xl max-h-[92vh] overflow-y-auto scrollbar-hide
                      animate-slide-up shadow-card-hover">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/7
                        px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-9 bg-shield-gradient flex items-center justify-center flex-shrink-0"
                 style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 65%, 50% 100%, 0% 65%, 0% 15%)' }}>
              <span className="font-display text-xs text-gold pb-0.5">PBS</span>
            </div>
            <div>
              <h2 className="font-display text-xl tracking-[2px] text-cream">HOW TO PLAY</h2>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase">PBS Picks Pro · World Cup 2026</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-white/8 flex items-center justify-center text-slate-400 hover:text-cream transition-colors">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">

          {/* Welcome blurb */}
          <div className="bg-gold/6 border border-gold/20 rounded-xl p-4">
            <p className="text-cream text-sm font-body leading-relaxed">
              Welcome to <span className="text-gold font-medium">PBS Picks Pro</span> — the closed-league
              World Cup 2026 prediction game for the PBS crew. Predict the score of every match,
              rack up points, and climb the leaderboard. The person with the most points when the
              final whistle blows wins the glory (and bragging rights until 2030).
            </p>
          </div>

          {/* Scoring */}
          <div>
            <h3 className="font-heading text-base text-cream tracking-wide mb-3 uppercase">
              Scoring System
            </h3>
            <div className="space-y-2">
              {SCORING_RULES.map(rule => (
                <div key={rule.pts}
                  className={clsx(
                    'flex items-start gap-3 rounded-xl border px-4 py-3',
                    rule.pts === 3 ? 'bg-gold/6 border-gold/20'
                    : rule.pts === 1 ? 'bg-green-900/15 border-green-800/30'
                    : 'bg-slate-800 border-white/7'
                  )}>
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-display text-xl',
                    rule.pts === 3 ? 'bg-gold/15 text-gold'
                    : rule.pts === 1 ? 'bg-green-900/30 text-green-400'
                    : 'bg-slate-700 text-slate-500'
                  )}>
                    {rule.pts}
                  </div>
                  <div>
                    <p className={clsx(
                      'font-medium text-sm',
                      rule.pts === 3 ? 'text-gold' : rule.pts === 1 ? 'text-green-400' : 'text-slate-400'
                    )}>
                      {rule.icon} {rule.label}
                    </p>
                    <p className="text-xs text-slate-500 font-body mt-0.5 leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 bg-slate-800 border border-white/7 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 font-body leading-relaxed">
                <span className="text-cream font-medium">Example:</span> Brazil vs Argentina.
                You predict 2–1 Brazil. Final score: 2–0 Brazil.
                You get <span className="text-green-400">+1 pt</span> (correct result — Brazil won —
                but not the exact score).
              </p>
            </div>
          </div>

          {/* Step by step */}
          <div>
            <h3 className="font-heading text-base text-cream tracking-wide mb-3 uppercase">
              How to Submit a Prediction
            </h3>
            <div className="space-y-2">
              {[
                { n: '1', text: 'Open the Fixtures tab and find an upcoming match.' },
                { n: '2', text: 'Tap the match card to expand it.' },
                { n: '3', text: 'Enter your predicted home and away scores.' },
                { n: '4', text: 'Tap "Lock In Prediction" before kickoff.' },
                { n: '5', text: 'The gold border confirms your prediction is saved.' },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-maroon/30 border border-maroon/40
                                  flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-display text-sm text-red-300">{step.n}</span>
                  </div>
                  <p className="text-sm text-slate-400 font-body leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h3 className="font-heading text-base text-cream tracking-wide mb-3 uppercase">
              FAQ
            </h3>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div key={i} className="border-b border-white/6 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-cream font-body mb-1">{item.q}</p>
                  <p className="text-xs text-slate-500 font-body leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pb-2">
            <p className="text-slate-600 text-xs font-body tracking-widest uppercase">
              Play · Bet · Sports · World Cup 2026
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
