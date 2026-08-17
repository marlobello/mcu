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
  tmdbScore: number
  tmdbVoteCount: number
  studio: string
  posterUrl: string | null
  imdbUrl: string
  addedByUsername: string
}

interface WatchedSummary {
  imdbId: string
  watchCount: number
  rank: number
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
const voteCountFormatter = new Intl.NumberFormat('en-US')

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('mcu-token'))
  const [user, setUser] = useState<User | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [shelf, setShelf] = useState<Set<string>>(new Set())
  const [communityWatched, setCommunityWatched] = useState<WatchedSummary[]>([])
  const [tab, setTab] = useState<'catalog' | 'shelf' | 'mine' | 'munch'>('catalog')
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
    const [me, movieData, watchedData] = await Promise.all([
      request<{ user: User }>('/auth/me'),
      request<{ movies: Movie[]; watchedMovieIds: string[]; shelfMovieIds?: string[] }>('/movies'),
      request<{ community: WatchedSummary[] }>('/watched'),
    ])
    setUser(me.user)
    setMovies(movieData.movies)
    setWatched(new Set(movieData.watchedMovieIds))
    setShelf(new Set(movieData.shelfMovieIds ?? movieData.watchedMovieIds))
    setCommunityWatched(watchedData.community)
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
        {(['catalog', 'shelf', 'mine', 'munch'] as const).map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            {name === 'catalog'
              ? 'Munch movie shelf'
              : name === 'shelf'
                ? 'My movie shelf'
                : name === 'mine'
                  ? 'My watched movies'
                  : 'Munch watched movies'}
          </button>
        ))}
      </nav>

      <main>
        {error && <div className="notice error" role="alert">{error}</div>}
        {tab === 'catalog' && (
          <MunchMovieShelf movies={movies} watched={watched} shelf={shelf} request={request} reload={loadData} setError={setError} />
        )}
        {tab === 'shelf' && (
          <MyMovieShelf movies={movies} watched={watched} shelf={shelf} request={request} reload={loadData} setError={setError} />
        )}
        {tab === 'mine' && (
          <MyWatchedMovies movies={movies} watched={watched} request={request} reload={loadData} setError={setError} />
        )}
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

function LoginScreen({ loading, error }: { loading: boolean; error: string }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">Munch Classics Universe</span>
        <h1>Build the family movie canon.</h1>
        <p>Collect the classics you watch together and see which movies the community has watched most.</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        <a className="primary-button discord" href={`${apiBase}/auth/login`}>
          {loading ? 'Checking your session…' : 'Continue with Discord'}
        </a>
        <small>Access is limited to members of the configured Discord community.</small>
      </section>
    </main>
  )
}

function MunchMovieShelf({ movies, watched, shelf, request, reload, setError }: {
  movies: Movie[]
  watched: Set<string>
  shelf: Set<string>
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

  const addToShelf = async (movie: Movie) => {
    try {
      await request(`/movies/${movie.imdbId}/shelf`, { method: 'PUT' })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update your movie shelf')
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Shared collection</span><h1>Munch movie shelf</h1><p>{movies.length} classics and counting.</p></div>
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
                <div className="movie-title"><div><h2>{movie.title}</h2><p>{movie.year} · {movie.rating}</p><TmdbRating movie={movie} /></div><span className="pill">{movie.studio}</span></div>
                <p className="added-by">Added by {movie.addedByUsername}</p>
                <div className="card-actions">
                  <div className="card-action-buttons">
                    <button className={watched.has(movie.imdbId) ? 'watched' : ''} onClick={() => toggleWatched(movie)}>
                      {watched.has(movie.imdbId) ? '✓ Watched with the kids' : 'Mark as watched'}
                    </button>
                    <button
                      className={shelf.has(movie.imdbId) ? 'on-shelf' : ''}
                      disabled={shelf.has(movie.imdbId)}
                      onClick={() => addToShelf(movie)}
                    >
                      {shelf.has(movie.imdbId) ? '✓ On my shelf' : 'Add to my shelf'}
                    </button>
                  </div>
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

function MyMovieShelf({ movies, watched, shelf, request, reload, setError }: {
  movies: Movie[]
  watched: Set<string>
  shelf: Set<string>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  reload: () => Promise<void>
  setError: (message: string) => void
}) {
  const shelfMovies = useMemo(
    () => movies.filter((movie) => shelf.has(movie.imdbId)).sort((a, b) => a.title.localeCompare(b.title)),
    [movies, shelf],
  )

  const removeFromShelf = async (movie: Movie) => {
    try {
      await request(`/movies/${movie.imdbId}/shelf`, { method: 'DELETE' })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update your movie shelf')
    }
  }

  const markWatched = async (movie: Movie) => {
    try {
      await request(`/movies/${movie.imdbId}/watched`, { method: 'PUT' })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update watched status')
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Your watch list</span><h1>My movie shelf</h1><p>{shelfMovies.length} movies saved to watch or already watched.</p></div>
      </div>
      {shelfMovies.length === 0 ? (
        <EmptyState title="Your movie shelf is empty" detail="Add movies from the Munch movie shelf to build your watch list." />
      ) : (
        <div className="movie-grid">
          {shelfMovies.map((movie) => {
            const isWatched = watched.has(movie.imdbId)
            return (
              <article className="movie-card" key={movie.imdbId}>
                <Poster movie={movie} />
                <div className="movie-copy">
                  <div className="movie-title"><div><h2>{movie.title}</h2><p>{movie.year} · {movie.rating}</p><TmdbRating movie={movie} /></div><span className="pill">{movie.studio}</span></div>
                  <p className="added-by">Added by {movie.addedByUsername}</p>
                  <div className="card-actions">
                    <div className="card-action-buttons">
                      {isWatched ? (
                        <button className="watched" disabled>✓ Watched with the kids</button>
                      ) : (
                        <>
                          <button onClick={() => markWatched(movie)}>Mark as watched</button>
                          <button onClick={() => removeFromShelf(movie)}>Remove from my shelf</button>
                        </>
                      )}
                    </div>
                    <a href={movie.imdbUrl} target="_blank" rel="noreferrer">IMDb ↗</a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
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
  const [addingTmdbIds, setAddingTmdbIds] = useState<Set<number>>(new Set())
  const [addedTmdbIds, setAddedTmdbIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close])

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
    setAddingTmdbIds((current) => new Set(current).add(tmdbId))
    try {
      try {
        await request('/movies', { method: 'POST', body: JSON.stringify({ tmdbId }) })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Movie could not be added')
        return
      }
      setAddedTmdbIds((current) => new Set(current).add(tmdbId))
      try {
        await reload()
      } catch (reason) {
        setError(reason instanceof Error ? `Movie added, but catalog refresh failed: ${reason.message}` : 'Movie added, but the catalog could not be refreshed')
      }
    } finally {
      setAddingTmdbIds((current) => {
        const next = new Set(current)
        next.delete(tmdbId)
        return next
      })
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
          {results.map((result) => {
            const adding = addingTmdbIds.has(result.tmdbId)
            const added = addedTmdbIds.has(result.tmdbId)
            return (
              <article key={result.imdbId}>
                <Poster movie={result} compact />
                <div><strong>{result.title}</strong><span>{result.year}</span></div>
                <button
                  className={added ? 'added' : undefined}
                  disabled={result.alreadyAdded || adding || added}
                  onClick={() => add(result.tmdbId)}
                >
                  {added ? 'Added' : result.alreadyAdded ? 'Already added' : adding ? 'Adding…' : 'Add'}
                </button>
              </article>
            )
          })}
        </div>
        <div className="dialog-actions">
          <button className="primary-button" onClick={close}>Done</button>
        </div>
      </section>
    </div>
  )
}

function MyWatchedMovies({ movies, watched, request, reload, setError }: {
  movies: Movie[]
  watched: Set<string>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  reload: () => Promise<void>
  setError: (message: string) => void
}) {
  const watchedMovies = useMemo(
    () => movies.filter((movie) => watched.has(movie.imdbId)).sort((a, b) => a.title.localeCompare(b.title)),
    [movies, watched],
  )

  const markUnwatched = async (movie: Movie) => {
    try {
      await request(`/movies/${movie.imdbId}/watched`, { method: 'DELETE' })
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update watched status')
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Your family movie history</span><h1>My Watched Movies</h1><p>{watchedMovies.length} movies marked as watched with the kids.</p></div>
      </div>
      {watchedMovies.length === 0 ? (
        <EmptyState title="No watched movies yet" detail="Mark movies as watched from the movie shelf to build this list." />
      ) : (
        <div className="watched-list">
          {watchedMovies.map((movie) => (
            <article key={movie.imdbId}>
              <Poster movie={movie} compact />
              <div><strong>{movie.title}</strong><span>{movie.year} · {movie.rating}</span><TmdbRating movie={movie} /></div>
              <button onClick={() => markUnwatched(movie)} aria-label={`Mark ${movie.title} unwatched`}>Unwatch</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function MunchWatchedMovies({ movies, community }: { movies: Movie[]; community: WatchedSummary[] }) {
  const byId = new Map(movies.map((movie) => [movie.imdbId, movie]))
  const entries = community
    .flatMap((entry) => {
      const movie = byId.get(entry.imdbId)
      return movie ? [{ ...entry, movie }] : []
    })
    .sort((a, b) => b.watchCount - a.watchCount || a.movie.title.localeCompare(b.movie.title))

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">The community watchlist</span><h1>Munch Watched Movies</h1><p>Ranked only by how many members have watched each movie.</p></div>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No watched movies yet" detail="The community list appears after someone marks a movie as watched." />
      ) : (
        <div className="watched-leaderboard">
          {entries.map(({ movie, rank, watchCount }) => (
            <article key={movie.imdbId}>
              <span className="rank-number">{rank}</span>
              <Poster movie={movie} compact />
              <div><strong>{movie.title}</strong><span>{movie.year}</span><TmdbRating movie={movie} /></div>
              <b>{watchCount} {watchCount === 1 ? 'watcher' : 'watchers'}</b>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Poster({ movie, compact = false }: { movie: { title: string; posterUrl: string | null }; compact?: boolean }) {
  return movie.posterUrl
    ? <img className={compact ? 'poster compact' : 'poster'} src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
    : <div className={compact ? 'poster compact placeholder' : 'poster placeholder'} aria-label={`No poster for ${movie.title}`}>MCU</div>
}

function TmdbRating({ movie }: { movie: Pick<Movie, 'tmdbScore' | 'tmdbVoteCount'> }) {
  return (
    <span className="tmdb-rating">
      {movie.tmdbVoteCount > 0
        ? `${Math.round(movie.tmdbScore * 10)}% TMDB · ${voteCountFormatter.format(movie.tmdbVoteCount)} votes`
        : 'TMDB rating unavailable'}
    </span>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{detail}</p></div>
}

export default App
