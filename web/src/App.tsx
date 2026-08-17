import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

interface User {
  userId: string
  username: string
  avatar: string | null
}

interface Movie {
  imdbId: string
  title: string
  year: string
  rating: string
  studio: string
  posterUrl: string | null
  imdbUrl: string
  addedByUsername: string
}

interface Ranking {
  userId: string
  username: string
  orderedMovieIds: string[]
}

interface Aggregate {
  imdbId: string
  score: number
  rankCount: number
}

interface SearchResult {
  tmdbId: number
  imdbId: string
  title: string
  year: string
  posterUrl: string | null
  alreadyAdded: boolean
}

const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:7071/api').replace(/\/$/, '')

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('mcu-token'))
  const [user, setUser] = useState<User | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [aggregate, setAggregate] = useState<Aggregate[]>([])
  const [tab, setTab] = useState<'catalog' | 'ranking' | 'community'>('catalog')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
    const body = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(body.error ?? `Request failed with ${response.status}`)
    return body
  }, [token])

  const loadData = useCallback(async () => {
    if (!token) return
    const [me, movieData, rankingData] = await Promise.all([
      request<{ user: User }>('/auth/me'),
      request<{ movies: Movie[]; watchedMovieIds: string[] }>('/movies'),
      request<{ rankings: Ranking[]; aggregate: Aggregate[] }>('/rankings'),
    ])
    setUser(me.user)
    setMovies(movieData.movies)
    setWatched(new Set(movieData.watchedMovieIds))
    setRankings(rankingData.rankings)
    setAggregate(rankingData.aggregate)
  }, [request, token])

  useEffect(() => {
    const exchange = async () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get('code')
      if (!code) return
      window.history.replaceState(null, '', window.location.pathname)
      const response = await fetch(`${apiBase}/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const body = await response.json() as { token?: string; error?: string }
      if (!response.ok || !body.token) throw new Error(body.error ?? 'Sign-in failed')
      localStorage.setItem('mcu-token', body.token)
      setToken(body.token)
    }

    exchange().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Sign-in failed'))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    loadData()
      .catch((reason: unknown) => {
        localStorage.removeItem('mcu-token')
        setToken(null)
        setUser(null)
        setError(reason instanceof Error ? reason.message : 'Unable to load MCU')
      })
      .finally(() => setLoading(false))
  }, [loadData])

  const logout = () => {
    localStorage.removeItem('mcu-token')
    setToken(null)
    setUser(null)
  }

  if (!token || !user) {
    return <LoginScreen loading={loading} error={error} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">MCU</span>
          <div><strong>Munch Classics Universe</strong><span>Movie nights become family lore.</span></div>
        </div>
        <div className="user-menu">
          <span>Hi, {user.username}</span>
          <button className="quiet-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main navigation">
        {(['catalog', 'ranking', 'community'] as const).map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            {name === 'catalog' ? 'Movie shelf' : name === 'ranking' ? 'My ranking' : 'Community'}
          </button>
        ))}
      </nav>

      <main>
        {error && <div className="notice error" role="alert">{error}</div>}
        {tab === 'catalog' && (
          <Catalog movies={movies} watched={watched} request={request} reload={loadData} setError={setError} />
        )}
        {tab === 'ranking' && (
          <MyRanking movies={movies} user={user} rankings={rankings} request={request} reload={loadData} setError={setError} />
        )}
        {tab === 'community' && <Community movies={movies} rankings={rankings} aggregate={aggregate} />}
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

function LoginScreen({ loading, error }: { loading: boolean; error: string }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">Munch Classics Universe</span>
        <h1>Build the family movie canon.</h1>
        <p>Collect the classics you watch together, compare every ranking, and settle the question of what deserves the top spot.</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        <a className="primary-button discord" href={`${apiBase}/auth/login`}>
          {loading ? 'Checking your session…' : 'Continue with Discord'}
        </a>
        <small>Access is limited to members of the configured Discord community.</small>
      </section>
    </main>
  )
}

function Catalog({ movies, watched, request, reload, setError }: {
  movies: Movie[]
  watched: Set<string>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  reload: () => Promise<void>
  setError: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('')
  const [studio, setStudio] = useState('')
  const [year, setYear] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => movies.filter((movie) => {
    const text = `${movie.title} ${movie.studio}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase()))
      && (!rating || movie.rating === rating)
      && (!studio || movie.studio === studio)
      && (!year || movie.year.startsWith(year))
  }), [movies, query, rating, studio, year])

  const ratings = [...new Set(movies.map((movie) => movie.rating))].sort()
  const studios = [...new Set(movies.map((movie) => movie.studio))].sort()

  const toggleWatched = async (movie: Movie) => {
    try {
      await request(`/movies/${movie.imdbId}/watched`, { method: watched.has(movie.imdbId) ? 'DELETE' : 'PUT' })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update watched status')
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Shared collection</span><h1>The movie shelf</h1><p>{movies.length} classics and counting.</p></div>
        <button className="primary-button" onClick={() => setAdding(true)}>Add a movie</button>
      </div>
      <div className="filters">
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or studio" /></label>
        <label><span>Rating</span><select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">All ratings</option>{ratings.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Studio</span><select value={studio} onChange={(event) => setStudio(event.target.value)}><option value="">All studios</option>{studios.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Year</span><input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="e.g. 1985" /></label>
      </div>
      {filtered.length === 0 ? <EmptyState title="No movies found" detail="Adjust the filters or add the first matching classic." /> : (
        <div className="movie-grid">
          {filtered.map((movie) => (
            <article className="movie-card" key={movie.imdbId}>
              <Poster movie={movie} />
              <div className="movie-copy">
                <div className="movie-title"><div><h2>{movie.title}</h2><p>{movie.year} · {movie.rating}</p></div><span className="pill">{movie.studio}</span></div>
                <p className="added-by">Added by {movie.addedByUsername}</p>
                <div className="card-actions">
                  <button className={watched.has(movie.imdbId) ? 'watched' : ''} onClick={() => toggleWatched(movie)}>
                    {watched.has(movie.imdbId) ? '✓ Watched with the kids' : 'Mark as watched'}
                  </button>
                  <a href={movie.imdbUrl} target="_blank" rel="noreferrer">IMDb ↗</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {adding && <AddMovieDialog request={request} reload={reload} close={() => setAdding(false)} setError={setError} />}
    </section>
  )
}

function AddMovieDialog({ request, reload, close, setError }: {
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  reload: () => Promise<void>
  close: () => void
  setError: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    setSearching(true)
    try {
      const data = await request<{ external: SearchResult[] }>(`/movies/search?q=${encodeURIComponent(query)}`)
      setResults(data.external)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Movie search failed')
    } finally {
      setSearching(false)
    }
  }

  const add = async (tmdbId: number) => {
    try {
      await request('/movies', { method: 'POST', body: JSON.stringify({ tmdbId }) })
      await reload()
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Movie could not be added')
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={close} aria-label="Close">×</button>
        <span className="eyebrow">Grow the universe</span><h1 id="add-title">Add a movie</h1>
        <form className="search-form" onSubmit={search}>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={100} placeholder="Try “The Princess Bride”" />
          <button className="primary-button" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        <div className="search-results">
          {results.map((result) => (
            <article key={result.imdbId}>
              <Poster movie={result} compact />
              <div><strong>{result.title}</strong><span>{result.year}</span></div>
              <button disabled={result.alreadyAdded} onClick={() => add(result.tmdbId)}>{result.alreadyAdded ? 'Already added' : 'Add'}</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function MyRanking({ movies, user, rankings, request, reload, setError }: {
  movies: Movie[]
  user: User
  rankings: Ranking[]
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  reload: () => Promise<void>
  setError: (message: string) => void
}) {
  const saved = useMemo(
    () => rankings.find((ranking) => ranking.userId === user.userId)?.orderedMovieIds ?? [],
    [rankings, user.userId],
  )
  const [ordered, setOrdered] = useState<string[]>(saved)
  useEffect(() => setOrdered(saved), [saved])
  const byId = new Map(movies.map((movie) => [movie.imdbId, movie]))
  const available = movies.filter((movie) => !ordered.includes(movie.imdbId))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    setOrdered((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    try {
      await request('/rankings', { method: 'PUT', body: JSON.stringify({ orderedMovieIds: ordered }) })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ranking could not be saved')
    }
  }

  return (
    <section className="ranking-page">
      <div className="section-heading"><div><span className="eyebrow">Your ballot</span><h1>Rank your classics</h1><p>Only movies in this list contribute to your ranking.</p></div><button className="primary-button" onClick={save}>Save ranking</button></div>
      <div className="ranking-layout">
        <div className="rank-list">
          {ordered.length === 0 && <EmptyState title="Your ranking is empty" detail="Add movies from the unranked list to get started." />}
          {ordered.map((id, index) => {
            const movie = byId.get(id)
            if (!movie) return null
            return <article key={id}><span className="rank-number">{index + 1}</span><Poster movie={movie} compact /><div><strong>{movie.title}</strong><span>{movie.year}</span></div><div className="rank-actions"><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${movie.title} up`}>↑</button><button onClick={() => move(index, 1)} disabled={index === ordered.length - 1} aria-label={`Move ${movie.title} down`}>↓</button><button onClick={() => setOrdered((items) => items.filter((item) => item !== id))} aria-label={`Remove ${movie.title} from ranking`}>×</button></div></article>
          })}
        </div>
        <aside className="unranked"><h2>Unranked movies</h2><p>Add only the movies you want to judge.</p>{available.map((movie) => <button key={movie.imdbId} onClick={() => setOrdered((items) => [...items, movie.imdbId])}><span>＋</span><div><strong>{movie.title}</strong><small>{movie.year}</small></div></button>)}</aside>
      </div>
    </section>
  )
}

function Community({ movies, rankings, aggregate }: { movies: Movie[]; rankings: Ranking[]; aggregate: Aggregate[] }) {
  const byId = new Map(movies.map((movie) => [movie.imdbId, movie]))
  return (
    <section>
      <div className="section-heading"><div><span className="eyebrow">The collective verdict</span><h1>Community rankings</h1><p>Scores normalize each person's partial list before averaging.</p></div></div>
      <div className="community-layout">
        <div className="leaderboard">
          <h2>MCU aggregate</h2>
          {aggregate.length === 0 ? <EmptyState title="No votes yet" detail="Save a personal ranking to create the leaderboard." /> : aggregate.map((entry, index) => {
            const movie = byId.get(entry.imdbId)
            if (!movie) return null
            return <article key={entry.imdbId}><span className="rank-number">{index + 1}</span><Poster movie={movie} compact /><div><strong>{movie.title}</strong><span>{entry.rankCount} {entry.rankCount === 1 ? 'ranking' : 'rankings'}</span></div><b>{entry.score.toFixed(1)}</b></article>
          })}
        </div>
        <div className="people-rankings">
          <h2>Everyone's lists</h2>
          {rankings.map((ranking) => <article key={ranking.userId}><h3>{ranking.username}</h3><ol>{ranking.orderedMovieIds.map((id) => <li key={id}>{byId.get(id)?.title ?? id}</li>)}</ol></article>)}
        </div>
      </div>
    </section>
  )
}

function Poster({ movie, compact = false }: { movie: { title: string; posterUrl: string | null }; compact?: boolean }) {
  return movie.posterUrl
    ? <img className={compact ? 'poster compact' : 'poster'} src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
    : <div className={compact ? 'poster compact placeholder' : 'poster placeholder'} aria-label={`No poster for ${movie.title}`}>MCU</div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{detail}</p></div>
}

export default App
