import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Inject git commit hash at build time so it's baked into the bundle
function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

function getBuildDate(): string {
  return new Date().toISOString().split('T')[0]
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Accessible in code as: import.meta.env.VITE_APP_VERSION
    //                         import.meta.env.VITE_GIT_HASH
    //                         import.meta.env.VITE_BUILD_DATE
    'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
    'import.meta.env.VITE_GIT_HASH':   JSON.stringify(getGitHash()),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(getBuildDate()),
  },
  build: {
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query':    ['@tanstack/react-query'],
          'vendor-utils':    ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Warn on chunks > 500kb
    chunkSizeWarningLimit: 500,
  },
})
