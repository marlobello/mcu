import { apiBase } from '../api'
import type { AuthState } from '../types'

export function LoginScreen({ authState, error, retry }: {
  authState: AuthState
  error: string
  retry: () => void
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">Munch Classics Universe</span>
        <h1>Build the family movie canon.</h1>
        <p>Collect the classics you watch together and see which movies the community has watched most.</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        {authState === 'checking' ? (
          <div className="session-status" role="status">Checking your session…</div>
        ) : authState === 'error' ? (
          <button className="primary-button retry" onClick={retry}>Retry</button>
        ) : (
          <a className="primary-button discord" href={`${apiBase}/auth/login`}>Continue with Discord</a>
        )}
        <small>Access is limited to members of the configured Discord community.</small>
      </section>
    </main>
  )
}
