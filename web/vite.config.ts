import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const defaultApiUrl = 'http://localhost:7071/api'

function apiOrigin(apiUrl: string): string {
  try {
    return new URL(apiUrl).origin
  } catch {
    return new URL(defaultApiUrl).origin
  }
}

/**
 * Emits the Static Web Apps configuration at build time so the CSP can name the exact API origin
 * for this deployment instead of relying on a wildcard host.
 */
function staticWebAppConfig(apiUrl: string): Plugin {
  return {
    name: 'mcu-staticwebapp-config',
    apply: 'build',
    generateBundle() {
      const origin = apiOrigin(apiUrl)
      const config = {
        navigationFallback: {
          rewrite: '/index.html',
          exclude: ['/assets/*', '/*.{css,js,png,jpg,jpeg,gif,svg,ico,webp}'],
        },
        globalHeaders: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "img-src 'self' https://image.tmdb.org data:",
            "style-src 'self' https://fonts.googleapis.com",
            'font-src https://fonts.gstatic.com',
            `connect-src 'self' ${origin}`,
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      }
      this.emitFile({
        type: 'asset',
        fileName: 'staticwebapp.config.json',
        source: `${JSON.stringify(config, null, 2)}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv resolves .env files the same way import.meta.env does, so the CSP and the bundle
  // always agree on the API origin no matter how VITE_API_URL was supplied.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), staticWebAppConfig(env.VITE_API_URL || defaultApiUrl)],
  }
})
