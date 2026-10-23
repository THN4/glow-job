import { useSyncExternalStore } from 'react'

// Keep this query aligned with the sidebar-expanded variant in index.css.
const query = '(min-width: 80rem), (min-width: 48rem) and (min-height: 30rem) and (orientation: landscape)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useExpandedSidebar() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
