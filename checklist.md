# PBS Picks Pro — Go-Live Checklist

*Last updated: Stage 3 complete*
*Legend: ✅ Done · ⬜ Pending · 🔧 In Progress · ⚠️ Blocker*

---

## 🔐 Auth Strategy — PIVOTED in Stage 3

> **Previous approach (Stages 1–2):** Supabase Magic Link / OTP email flow.
> **Current approach (Stage 3+):** Mobile Number + Permanent 6-digit PIN.

**How it works:**
1. Admin pre-populates `profiles` table with `phone` + `display_name` (invite list)
2. First login: user enters phone → app detects `is_registered = false` → prompts PIN setup
3. Registration calls Edge Function `register-user` (service role) which:
   - Creates `auth.users` entry with synthetic email `<digits>@pbspicks.internal` + PIN as password
   - Calls `register_pin()` RPC to store bcrypt hash + link `auth_user_id`
4. Subsequent logins: phone + PIN → `verify_pin_and_get_session()` RPC → `signInWithPassword()` → live session
5. Brute-force protection: 5 failed attempts → 15-minute lockout (stored in `profiles.locked_until`)

---

## 🗄️ Database & Supabase

- ⬜ Run `supabase/schema.sql` (base schema) in Supabase SQL Editor
- ⬜ Run `supabase/migration_stage3.sql` (PIN auth migration) after base schema
- ⬜ Verify all tables exist: `teams`, `fixtures`, `profiles`, `predictions`, `notification_log`
- ⬜ Verify new columns on `profiles`: `pin_hash`, `auth_user_id`, `is_registered`, `login_attempts`, `locked_until`, `last_login_at`
- ⬜ Verify `pgcrypto` extension is enabled (required for bcrypt hashing):
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
  ```
- ⬜ Verify all 4 RPC functions exist:
  ```sql
  SELECT proname FROM pg_proc WHERE proname IN (
    'lookup_profile_by_phone', 'verify_pin_and_get_session',
    'register_pin', 'admin_settle_match'
  );
  ```
- ⬜ **Verify RLS Policies on Production:**
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  SELECT policyname, tablename, cmd, roles FROM pg_policies WHERE schemaname = 'public';
  ```
  Expected: `predictions_read_own`, `predictions_insert_own`, `predictions_update_own` (NOT "all")
  Expected: `profiles_read_own`, `profiles_update_own` (NOT "all")
- ⬜ Confirm `leaderboard` view returns only `is_registered = true` players
- ⬜ Seed `teams` table with all World Cup 2026 squads
- ⬜ Seed `fixtures` table with full schedule (kickoff times in UTC)
- ⬜ **Pre-populate `profiles` with all invited players** (phone in E.164 format):
  ```sql
  INSERT INTO profiles (username, display_name, phone) VALUES
    ('ryan_v',  'Ryan van Es',  '+27716858624'),
    ('player2', 'Player Name',  '+2782XXXXXXX');
  -- Do NOT set pin_hash or is_registered — those are set during registration
  ```

---

## 🔐 Authentication (PIN Flow)

- ⬜ Test full registration flow: enter phone → "Set PIN" screen → 6-digit pad → confirm → auto-login
- ⬜ Test login flow: enter phone → "Enter PIN" screen → correct PIN → dashboard redirect
- ⬜ Test "not invited" rejection: unregistered number shows lock screen, no further steps accessible
- ⬜ Test brute-force lockout: 5 wrong PINs → locked screen with unlock time shown
- ⬜ Test lockout auto-clears after 15 minutes (check `locked_until` in DB)
- ⬜ Test "already registered" guard: trying to re-register an existing number returns correct error
- ⬜ Verify `pin_hash` is NEVER returned in any client-side query (RLS + SECURITY DEFINER functions only return safe fields)
- ⬜ Confirm session persists across app reload (Supabase `persistSession: true`)
- ⬜ Confirm sign-out clears session and redirects to `/login`

---

## 🌐 Hosting & Domain

- ⬜ **Connect Custom Domain** — recommended: Vercel, Netlify, or Cloudflare Pages
  - Build: `npm run build` | Output: `dist` | Root: `/`
- ⬜ Set all `VITE_*` env vars in hosting platform dashboard
- ⬜ Confirm `https://yourdomain.com` resolves with valid SSL
- ⬜ Add production domain to Supabase → Auth → URL Configuration → Site URL
- ⬜ Add production domain to Supabase → API → CORS Allowed Origins
- ⬜ **Remove** `/auth/callback` redirect from Supabase allowed redirect URLs (no longer needed)

---

## 📲 Twilio WhatsApp

- ⬜ Upgrade from Sandbox to **Production** WhatsApp sender
- ⬜ All 12 players opted in to receive messages
- ⬜ Player phones match `profiles.phone` exactly (E.164 format)
- ⬜ Test admin debug panel: Settings → send test match alert → confirm WhatsApp received
- ⬜ Verify `notification_log` records all sends

---

## ⚙️ Supabase Edge Functions

- ⬜ Deploy: `supabase functions deploy register-user`
- ⬜ Deploy: `supabase functions deploy notifications`
- ⬜ Set Edge Function secrets (Dashboard → Edge Functions → Secrets):
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_FROM`
- ⬜ Test `register-user` function via curl or Postman before first user signup:
  ```bash
  curl -X POST https://<project>.supabase.co/functions/v1/register-user \
    -H "apikey: <ANON_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"phone":"+27716858624","pin":"123456"}'
  ```
- ⬜ Set up Supabase Cron Jobs:
  - Match alerts:    `0 * * * *`   → `POST /notifications?type=match_alert`
  - Leaderboard:     `0 16 * * 0`  → `POST /notifications?type=leaderboard` (Sun 18:00 SAST)

---

## 📱 Mobile / PWA

- ⬜ Generate PWA icons (192×192 + 512×512) from PBS shield logo → `public/icons/`
- ⬜ Generate `public/favicon.svg`
- ⬜ Test PIN pad on iOS Safari (tap targets ≥ 44pt minimum)
- ⬜ Test "Add to Home Screen" on iOS and Android
- ⬜ Verify iOS safe-area padding renders correctly (home indicator clearance)
- ⬜ Test full prediction edit flow on mobile: tap score inputs, keyboard doesn't cover submit button

---

## 🧪 Pre-Launch QA

- ⬜ Sign in as 3 different test users and submit predictions for the same fixture
- ⬜ Verify Player A cannot read Player B's predictions (test with different auth sessions)
- ⬜ Verify Player A cannot update Player B's predictions (attempt via browser DevTools)
- ⬜ Run `settle_predictions('<fixture_id>')` via Admin panel → verify points awarded correctly
- ⬜ Confirm leaderboard re-ranks after settlement
- ⬜ Confirm a user with no phone number doesn't break notifications
- ⬜ Test admin route `/admin` is inaccessible to non-admin users (returns lock screen)
- ⬜ Verify `VITE_ADMIN_USER_ID` is set to your Supabase `auth.users.id` (find in Dashboard → Auth → Users)

---

## 🚀 Stage Completion Status

| Stage | Description | Status |
|-------|-------------|--------|
| Stage 1 | Project scaffold, DB schema, MatchDashboard, Twilio service | ✅ Complete |
| Stage 2 | App shell, Mobile nav, Top5 leaderboard, Settings + debug panel | ✅ Complete |
| Stage 3 | PIN auth pivot, My Picks, Full Leaderboard, Admin Settlement, RLS hardening | ✅ Complete |
| Stage 4 | Admin bulk user import UI, fixture management, PIN reset flow | ⬜ Pending |
| Stage 5 | PWA polish, performance audit, final deployment | ⬜ Pending |

---

## 🚀 Git & Vercel Deployment

### Step-by-step: Initialize Git + Push to GitHub

Run these commands inside your `pbs-picks-pro` project folder:

```bash
# 1. Initialize a new Git repo
git init

# 2. Stage every file (respects .gitignore — .env will NOT be committed)
git add .

# 3. First commit
git commit -m "feat: initial PBS Picks Pro scaffold (Stages 1–4)"

# 4. Create the remote repo on GitHub:
#    Go to https://github.com/new → name it "pbs-picks-pro" → DO NOT add README/gitignore
#    Copy the repo URL (e.g. https://github.com/ryanvanes/pbs-picks-pro.git)

# 5. Point your local repo at GitHub
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pbs-picks-pro.git

# 6. Rename default branch to main (best practice)
git branch -M main

# 7. Push
git push -u origin main
```

### Step-by-step: Deploy to Vercel

```bash
# Option A: Via Vercel CLI (fastest)
npm install -g vercel
vercel login
vercel

# Follow the prompts:
#   - Link to existing project? No → create new
#   - Project name: pbs-picks-pro
#   - Framework: Vite
#   - Build command: npm run build (auto-detected)
#   - Output dir: dist (auto-detected)

# For production deployment:
vercel --prod
```

**Option B: Via Vercel Dashboard (no CLI needed)**
1. Go to https://vercel.com/new
2. Click "Import Git Repository" → select `pbs-picks-pro`
3. Framework preset: **Vite** (auto-detected)
4. Add all environment variables (see below)
5. Click **Deploy**

### Environment Variables to set in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables. Add:

| Variable | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API |
| `VITE_ADMIN_USER_ID` | `uuid-from-auth-users` | Your auth.users UUID |
| `VITE_FIXTURES_API_URL` | `https://...` | Your fixtures data endpoint (optional) |

⚠ **NEVER add Twilio keys or `SUPABASE_SERVICE_ROLE_KEY` as `VITE_` vars** — those go in Supabase Edge Function secrets only.

### Connecting a Custom Domain

1. Vercel Dashboard → your project → Settings → Domains
2. Add `pbspickspro.com` (or your domain)
3. Copy the CNAME value Vercel gives you
4. In your DNS provider, add: `CNAME @ <vercel-cname-value>`
5. SSL auto-provisions within ~60 seconds
6. Update Supabase → Auth → URL Configuration:
   - Site URL: `https://pbspickspro.com`
   - Add to Redirect URLs: `https://pbspickspro.com/**`

### Continuous Deployment (automatic)

After the initial setup, every `git push origin main` automatically triggers a Vercel production deploy. No manual steps needed.

```bash
# Normal workflow going forward:
git add .
git commit -m "feat: stage 5 polish"
git push origin main
# → Vercel auto-deploys in ~45 seconds
```

---

## 🚀 Stage Completion Status (Updated)

| Stage | Description | Status |
|-------|-------------|--------|
| Stage 1 | Project scaffold, DB schema, MatchDashboard, Twilio service | ✅ Complete |
| Stage 2 | App shell, Mobile nav, Top5 leaderboard, Settings + debug panel | ✅ Complete |
| Stage 3 | PIN auth pivot, My Picks, Full Leaderboard, Admin Settlement, RLS hardening | ✅ Complete |
| Stage 4 | Bulk import + validation, PIN reset, Fixture management + API sync, Git/Vercel deployment | ✅ Complete |
| Stage 5 | PWA icons, performance audit, final pre-launch QA sweep | ⬜ Pending |
