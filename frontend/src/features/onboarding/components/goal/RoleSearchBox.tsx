import { useEffect, useId, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { searchRoles } from '../../../../lib/api'
import { goalCopy, ROLE_MAX_LENGTH } from '../../../../lib/goalConstants'
import { cn } from '../../../../lib/utils'
import type { RoleSearchResult } from '../../types'

type RoleSearchBoxProps = { value: string; onChange: (value: string) => void; onSelect: (role: string) => void }
type SearchState = { query: string; results: RoleSearchResult[]; error: boolean }

export function RoleSearchBox({ value, onChange, onSelect }: RoleSearchBoxProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const [search, setSearch] = useState<SearchState>({ query: '', results: [], error: false })
  const query = value.trim()
  const loading = search.query !== query
  const results = loading ? [] : search.results
  const showSuggestions = open && query.length > 0

  useEffect(() => {
    let active = true
    searchRoles(query).then((results) => {
      if (active) setSearch({ query, results, error: false })
    }).catch(() => {
      if (active) setSearch({ query, results: [], error: true })
    })
    return () => { active = false }
  }, [query])

  function choose(role: string) {
    if (!role.trim()) return
    onSelect(role.trim())
    setOpen(false)
    setActiveIndex(-1)
    setAnnouncement(goalCopy.search.selected(role.trim()))
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); choose(value) }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-3 size-5 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />
        <Input value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1) }}
          onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActiveIndex(-1) }}
          role="combobox" aria-label={goalCopy.search.label} aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined} aria-autocomplete="list"
          aria-activedescendant={showSuggestions && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          placeholder={goalCopy.search.placeholder} maxLength={ROLE_MAX_LENGTH} autoComplete="off"
          className="h-11 border-border bg-card pl-13 pr-14 text-base md:text-base"
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActiveIndex(-1) }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              if (results.length) setActiveIndex((index) => index < 0
                ? event.key === 'ArrowDown' ? 0 : results.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              choose(showSuggestions && results[activeIndex] ? results[activeIndex].title : value)
            }
          }} />
        <Button type="submit" size="icon" disabled={!query} aria-label={goalCopy.search.submit}
          className="absolute right-1 top-1 h-9 w-11 rounded-lg">
          <ArrowRight className="size-5" aria-hidden="true" />
        </Button>
        {showSuggestions && <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-border bg-card p-1 shadow-lg">
          <ul id={listId} role="listbox" aria-label={goalCopy.search.suggestions}>
            {results.map((role, index) => <li key={role.id} role="presentation">
              <Button type="button" variant="ghost" role="option" id={`${listId}-${index}`} tabIndex={-1}
                aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(role.title)}
                className={cn('h-10 w-full justify-start px-3 text-base font-normal', activeIndex === index && 'bg-accent text-primary')}>
                {role.title}
              </Button>
            </li>)}
            {!results.length && <li role="presentation"><p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              {loading ? goalCopy.search.loading : search.error ? goalCopy.search.error : goalCopy.search.empty}
            </p></li>}
          </ul>
        </div>}
      </div>
      <span role="status" className="sr-only">{announcement}</span>
    </form>
  )
}
