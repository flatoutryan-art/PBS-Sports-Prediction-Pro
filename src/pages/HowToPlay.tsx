import { clsx } from 'clsx'

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-white/7 rounded-xl p-6 mb-4">
      <h2 className="font-heading text-sm tracking-[3px] uppercase text-gold mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ─── Points badge ─────────────────────────────────────────────
function PointsBadge({
  points, label, detail, color,
}: {
  points: number; label: string; detail: string; color: 'gold' | 'red' | 'grey'
}) {
  return (
    <div className={clsx(
      'flex items-start gap-4 p-4 rounded-lg border',
      color === 'gold' && 'bg-gold/8 border-gold/25',
      color === 'red'  && 'bg-maroon/8 border-maroon/25',
      color === 'grey' && 'bg-slate-700/50 border-white/6',
    )}>
      <div className={clsx(
        'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 font-display text-2xl font-bold',
        color === 'gold' && 'bg-gold/15 text-gold',
        color === 'red'  && 'bg-maroon/15 text-red-300',
        color === 'grey' && 'bg-slate-700 text-slate-400',
      )}>
        {points > 0 ? `+${points}` : points}
      </div>
      <div>
        <div className={clsx(
          'font-heading text-sm font-medium tracking-wide mb-0.5',
          color === 'gold' && 'text-gold',
          color === 'red'  && 'text-red-300',
          color === 'grey' && 'text-slate-400',
        )}>
          {label}
        </div>
        <div className="text-xs text-slate-500 font-body leading-relaxed">{detail}</div>
      </div>
    </div>
  )
}

// ─── Step card ────────────────────────────────────────────────
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0 font-display text-sm text-gold">
        {number}
      </div>
      <div className="pt-0.5">
        <div className="font-heading text-sm font-medium text-cream tracking-wide mb-1">{title}</div>
        <div className="text-xs text-slate-400 font-body leading-relaxed">{description}</div>
      </div>
    </div>
  )
}

// ─── Score Example ────────────────────────────────────────────
function ScoreExample({
  actual, predicted, points, color,
}: {
  actual: string; predicted: string; points: string; color: 'gold' | 'red' | 'grey'
}) {
  return (
    <div className={clsx(
      'flex items-center justify-between p-3 rounded-lg border text-xs',
      color === 'gold' && 'bg-gold/8 border-gold/20',
      color === 'red'  && 'bg-maroon/8 border-maroon/20',
      color === 'grey' && 'bg-slate-700/40 border-white/6',
    )}>
      <div className="flex gap-6">
        <div>
          <span className="text-slate-500 mr-1.5">Actual:</span>
          <span className={clsx(
            'font-display tracking-widest',
            color === 'gold' ? 'text-gold' : color === 'red' ? 'text-red-300' : 'text-slate-400'
          )}>{actual}</span>
        </div>
        <div>
          <span className="text-slate-500 mr-1.5">Your pick:</span>
          <span className="text-cream font-display tracking-widest">{predicted}</span>
        </div>
      </div>
      <div className={clsx(
        'font-heading font-bold text-sm',
        color === 'gold' ? 'text-gold' : color === 'red' ? 'text-red-300' : 'text-slate-500'
      )}>
        {points}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function HowToPlay() {
  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-cream tracking-wide mb-1">How to Play</h1>
        <p className="text-sm text-slate-400 font-body">Everything you need to know to play PBS Picks Pro.</p>
      </div>

      {/* Quick steps */}
      <Section title="Getting Started">
        <div className="space-y-5">
          <Step
            number={1}
            title="Go to Matches"
            description="Open the Matches tab to see all upcoming World Cup 2026 fixtures. Use the filter pills to jump to today's games, group stage, or knockout rounds."
          />
          <Step
            number={2}
            title="Click a Match Card"
            description="Tap any upcoming match to expand the prediction panel. Enter the score you think the game will end at — home score on the left, away score on the right."
          />
          <Step
            number={3}
            title="Lock In Your Prediction"
            description='Hit "Lock In Prediction" to save. You can come back and change your pick as many times as you like right up until kick-off — after that the card locks.'
          />
          <Step
            number={4}
            title="Collect Your Points"
            description="Once the final whistle blows and the result is entered, your points are calculated automatically. Check the Leaderboard to see where you stand."
          />
        </div>
      </Section>

      {/* Points system */}
      <Section title="How Points Work">
        <p className="text-xs text-slate-400 font-body mb-4 leading-relaxed">
          Every match is worth up to 5 points. Points are awarded based on how close your prediction is to the actual result.
        </p>
        <div className="space-y-3 mb-5">
          <PointsBadge
            points={5}
            color="gold"
            label="Exact Score"
            detail="You predicted the precise scoreline — both home and away goals correct. Maximum points."
          />
          <PointsBadge
            points={3}
            color="red"
            label="Correct Winner / Draw"
            detail="You correctly predicted the winner or called a draw, but the exact score was off."
          />
          <PointsBadge
            points={0}
            color="grey"
            label="Incorrect"
            detail="You predicted the wrong winner or failed to predict a draw correctly. No points this time."
          />
        </div>

        {/* Examples */}
        <div>
          <p className="text-[11px] text-slate-500 tracking-widest uppercase font-medium mb-2">Examples</p>
          <div className="space-y-2">
            <ScoreExample actual="2 – 1" predicted="2 – 1" points="+5 pts" color="gold" />
            <ScoreExample actual="2 – 1" predicted="3 – 0" points="+3 pts" color="red" />
            <ScoreExample actual="2 – 1" predicted="1 – 2" points="+0 pts" color="grey" />
            <ScoreExample actual="1 – 1" predicted="1 – 1" points="+5 pts" color="gold" />
            <ScoreExample actual="1 – 1" predicted="2 – 2" points="+3 pts" color="red" />
          </div>
        </div>
      </Section>

      {/* Deadlines */}
      <Section title="Prediction Deadlines">
        <div className="space-y-3 text-sm text-slate-300 font-body leading-relaxed">
          <p>
            Predictions for each match lock automatically at <span className="text-gold font-medium">kick-off time</span>.
            Once the match starts you can no longer submit or edit your pick for that game.
          </p>
          <p>
            You can change your prediction as many times as you like before kick-off — only the last saved version counts.
          </p>
          <p className="text-slate-500 text-xs border-t border-white/6 pt-3">
            All times shown are in your local timezone. Make sure you don't leave it too late for early morning kick-offs!
          </p>
        </div>
      </Section>

      {/* Leaderboard */}
      <Section title="Leaderboard">
        <div className="space-y-3 text-sm text-slate-300 font-body leading-relaxed">
          <p>
            The leaderboard ranks all players by their total accumulated points across every completed match.
            It updates automatically as match results are entered.
          </p>
          <p>
            Ties are broken by the number of <span className="text-gold font-medium">exact scores</span> predicted —
            the player with more 5-point exact scores ranks higher. In a further tie, most 3-point correct results wins.
          </p>
          <p>
            The top 5 players are highlighted in the <span className="text-gold font-medium">Top 5</span> widget
            on the Matches page so you always know where you stand.
          </p>
        </div>
      </Section>

      {/* Tips */}
      <Section title="Tips">
        <ul className="space-y-2 text-xs text-slate-400 font-body leading-relaxed list-none">
          {[
            'Predict every single match — even +2 for getting the result right adds up fast over 104 games.',
            'Exact scores in group stage games are harder to hit, but knockout rounds tend to be tighter — 1–0 and 0–0 are more common late in tournaments.',
            "Check the Today filter each morning so you don't miss same-day kick-offs.",
            'Keep an eye on the Leaderboard mid-tournament — a couple of exact scores can jump you several places.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gold mt-0.5 flex-shrink-0">›</span>
              {tip}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
