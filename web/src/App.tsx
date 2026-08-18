import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { ApiError, apiFetch, clearToken, errorMessage, readToken, sessionNeedsRenewal, storeToken } from './api'
import { LoginScreen } from './components/LoginScreen'
import { MunchMovieShelf } from './components/MunchMovieShelf'
import { MunchWatchedMovies } from './components/MunchWatchedMovies'
import { MyMovieShelf } from './components/MyMovieShelf'
import { MyWatchedMovies } from './components/MyWatchedMovies'
import type { AuthState, Movie, TabName, User, WatchedSummary } from './types'

const tabLabels: Record<TabName, string> = {
  catalog: 'Munch movie shelf',
  shelf: 'My movie shelf',
  mine: 'My watched movies',
  munch: 'Munch watched movies',
}

const tabNames = Object.keys(tabLabels) as TabName[]

function readHash(name: string): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get(name)
}

function withMember(members: Set<string>, value: string, present: boolean): Set<string> {
  const next = new Set(members)
  if (present) next.add(value)
  else next.delete(value)
  return next
}

function App() {
  const [token, setToken] = useState(readToken)
  const [exchangeCode] = useState(() => readHash('code'))
  const [exchangePending, setExchangePending] = useState(Boolean(exchangeCode))
  const [authState, setAuthState] = useState<AuthState>(() => token || exchangeCode ? 'checking' : 'anonymous')
  const [authRetry, setAuthRetry] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [shelf, setShelf] = useState<Set<string>>(new Set())
  const [communityWatched, setCommunityWatched] = useState<WatchedSummary[]>([])
  const [tab, setTab] = useState<TabName>('catalog')
  const [error, setError] = useState(() => readHash('error') ?? '')
  // Set when a token is replaced by silent renewal so the data-loading effect can skip a redundant reload.
  const renewedSilently = useRef(false)
  // Mirrors the shelf so mutation callbacks can read it without depending on its identity.
  const shelfRef = useRef(shelf)
  // StrictMode invokes effects twice in development; exchange codes are single-use server-side.
  const exchangeAttempted = useRef(false)

  useEffect(() => {
    shelfRef.current = shelf
  }, [shelf])

  // The OAuth callback reports failures through the URL fragment; clear it once it has been read.
  useEffect(() => {
    if (readHash('error')) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const signOut = useCallback((message = '') => {
    clearToken()
    setToken(null)
    setUser(null)
    setAuthState('anonymous')
    setError(message)
  }, [])

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    try {
      return await apiFetch<T>(path, init)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        signOut('Your session expired. Continue with Discord to sign in again.')
      }
      throw reason
    }
  }, [signOut])

  const refreshCommunity = useCallback(async () => {
    const data = await request<{ community: WatchedSummary[] }>('/watched')
    setCommunityWatched(data.community)
  }, [request])

  const refreshCatalog = useCallback(async () => {
    const data = await request<{ movies: Movie[]; watchedMovieIds: string[]; shelfMovieIds?: string[] }>('/movies')
    setMovies(data.movies)
    setWatched(new Set(data.watchedMovieIds))
    setShelf(new Set(data.shelfMovieIds ?? data.watchedMovieIds))
  }, [request])

  const loadData = useCallback(async () => {
    const [me] = await Promise.all([
      request<{ user: User }>('/auth/me'),
      refreshCatalog(),
      refreshCommunity(),
    ])
    setUser(me.user)
  }, [refreshCatalog, refreshCommunity, request])

  useEffect(() => {
    // The first invocation owns the redemption; a StrictMode replay must not touch any state,
    // otherwise it would clear the pending flag while the real request is still in flight.
    if (exchangeAttempted.current) return
    exchangeAttempted.current = true

    const exchange = async () => {
      if (!exchangeCode) {
        setExchangePending(false)
        return
      }
      setAuthState('checking')
      window.history.replaceState(null, '', window.location.pathname)
      const body = await apiFetch<{ token: string }>('/auth/exchange', {
        method: 'POST',
        body: JSON.stringify({ code: exchangeCode }),
      })
      if (!body.token) throw new Error('Sign-in failed')
      storeToken(body.token)
      setToken(body.token)
    }

    exchange()
      .catch((reason: unknown) => {
        setError(errorMessage(reason, 'Sign-in failed'))
        if (!readToken()) setAuthState('anonymous')
      })
      .finally(() => setExchangePending(false))
  }, [exchangeCode])

  useEffect(() => {
    if (exchangePending) return
    if (!token) {
      setUser(null)
      setAuthState('anonymous')
      return
    }
    // A silently renewed token represents the same session, so the loaded data stays valid.
    if (renewedSilently.current) {
      renewedSilently.current = false
      return
    }

    let cancelled = false
    setAuthState('checking')
    setError('')
    loadData()
      .then(async () => {
        if (cancelled) return
        setAuthState('authenticated')
        if (!sessionNeedsRenewal(token)) return
        try {
          const renewed = await request<{ token: string }>('/auth/renew', { method: 'POST' })
          if (cancelled) return
          storeToken(renewed.token)
          renewedSilently.current = true
          setToken(renewed.token)
        } catch (reason) {
          if (cancelled || reason instanceof ApiError && reason.status === 401) return
          setError('Your session is active, but automatic renewal failed. It will retry next time.')
        }
      })
      .catch((reason: unknown) => {
        if (cancelled || reason instanceof ApiError && reason.status === 401) return
        setAuthState('error')
        setError(errorMessage(reason, 'Unable to load MCU'))
      })
    return () => {
      cancelled = true
    }
  }, [authRetry, exchangePending, loadData, request, token])

  /**
   * Watched and shelf toggles update local state immediately and only reconcile the community
   * summary afterwards, so a single click no longer refetches the whole catalog.
   */
  const changeWatched = useCallback(async (imdbId: string, isWatched: boolean) => {
    // Marking a movie watched also puts it on the shelf, but only if it was not there already —
    // otherwise a rollback would remove a shelf entry the user had added deliberately.
    const addedToShelf = isWatched && !shelfRef.current.has(imdbId)
    setWatched((current) => withMember(current, imdbId, isWatched))
    if (addedToShelf) setShelf((current) => withMember(current, imdbId, true))
    setError('')
    try {
      await request(`/movies/${imdbId}/watched`, { method: isWatched ? 'PUT' : 'DELETE' })
    } catch (reason) {
      // Roll back only this movie so a concurrent toggle that already succeeded is preserved.
      setWatched((current) => withMember(current, imdbId, !isWatched))
      if (addedToShelf) setShelf((current) => withMember(current, imdbId, false))
      setError(errorMessage(reason, 'Unable to update watched status'))
      return
    }
    // The write is already persisted, so a failed summary refresh must not undo it.
    await refreshCommunity().catch(() => {
      setError('Watched status saved, but the community list could not be refreshed.')
    })
  }, [refreshCommunity, request])

  const changeShelf = useCallback(async (imdbId: string, onShelf: boolean) => {
    setShelf((current) => withMember(current, imdbId, onShelf))
    setError('')
    try {
      await request(`/movies/${imdbId}/shelf`, { method: onShelf ? 'PUT' : 'DELETE' })
    } catch (reason) {
      setShelf((current) => withMember(current, imdbId, !onShelf))
      setError(errorMessage(reason, 'Unable to update your movie shelf'))
    }
  }, [request])

  const retryAuthentication = () => {
    setError('')
    setAuthState('checking')
    setAuthRetry((current) => current + 1)
  }

  if (authState !== 'authenticated' || !user) {
    return <LoginScreen authState={authState} error={error} retry={retryAuthentication} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/mcu-emblem.png" alt="" width="64" height="64" />
          <div><strong>Munch Classics Universe</strong><span>Movie nights become family lore.</span></div>
        </div>
        <div className="user-menu">
          <span>Hi, {user.username}</span>
          <button className="quiet-button" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main navigation">
        {tabNames.map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            {tabLabels[name]}
          </button>
        ))}
      </nav>

      <main>
        {error && <div className="notice error" role="alert">{error}</div>}
        {tab === 'catalog' && (
          <MunchMovieShelf
            movies={movies}
            watched={watched}
            shelf={shelf}
            request={request}
            onCatalogChange={refreshCatalog}
            setWatched={changeWatched}
            setOnShelf={changeShelf}
          />
        )}
        {tab === 'shelf' && (
          <MyMovieShelf
            movies={movies}
            watched={watched}
            shelf={shelf}
            setWatched={changeWatched}
            setOnShelf={changeShelf}
          />
        )}
        {tab === 'mine' && <MyWatchedMovies movies={movies} watched={watched} setWatched={changeWatched} />}
        {tab === 'munch' && <MunchWatchedMovies movies={movies} community={communityWatched} />}
      </main>
      <footer className="credits">
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
          <img src="/tmdb-logo.svg" alt="The Movie Database (TMDB)" />
        </a>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </footer>
    </div>
  )
}

export default App
