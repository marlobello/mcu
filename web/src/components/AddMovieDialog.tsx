import { useRef, useState } from 'react'
import { errorMessage } from '../api'
import type { RequestFn, SearchResult } from '../types'
import { Poster } from './Poster'
import { useFocusTrap } from './useFocusTrap'

export function AddMovieDialog({ request, onAdded, close }: {
  request: RequestFn
  onAdded: () => Promise<void>
  close: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingTmdbIds, setAddingTmdbIds] = useState<Set<number>>(new Set())
  const [addedTmdbIds, setAddedTmdbIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const dialog = useRef<HTMLElement>(null)

  useFocusTrap(dialog, close)

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    setSearching(true)
    setError('')
    try {
      const data = await request<{ external: SearchResult[] }>(`/movies/search?q=${encodeURIComponent(query)}`)
      setResults(data.external)
    } catch (reason) {
      setError(errorMessage(reason, 'Movie search failed'))
    } finally {
      setSearching(false)
    }
  }

  const add = async (tmdbId: number) => {
    setError('')
    setAddingTmdbIds((current) => new Set(current).add(tmdbId))
    try {
      await request('/movies', { method: 'POST', body: JSON.stringify({ tmdbId }) })
      setAddedTmdbIds((current) => new Set(current).add(tmdbId))
      try {
        await onAdded()
      } catch (reason) {
        setError(errorMessage(reason, 'Movie added, but the catalog could not be refreshed'))
      }
    } catch (reason) {
      setError(errorMessage(reason, 'Movie could not be added'))
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
      <section
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" onClick={close} aria-label="Close">×</button>
        <span className="eyebrow">Grow the universe</span><h1 id="add-title">Add a movie</h1>
        {error && <div className="notice error" role="alert">{error}</div>}
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
