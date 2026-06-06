/**
 * AppVersion — shows the deployed git commit hash.
 *
 * Values are injected at build time by vite.config.ts via `define`.
 * On Vercel, the hash reflects the exact commit that was deployed.
 *
 * Usage: <AppVersion /> anywhere in the UI.
 */
export default function AppVersion({ className = '' }: { className?: string }) {
  const version   = import.meta.env.VITE_APP_VERSION as string
  const gitHash   = import.meta.env.VITE_GIT_HASH   as string
  const buildDate = import.meta.env.VITE_BUILD_DATE  as string

  return (
    <p className={`text-slate-700 text-[11px] tracking-widest uppercase font-body select-none ${className}`}>
      v{version} · {gitHash} · {buildDate}
    </p>
  )
}
