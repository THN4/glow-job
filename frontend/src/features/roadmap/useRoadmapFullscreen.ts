import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export function useRoadmapFullscreen() {
  const ref = useRef<HTMLElement>(null)
  const nativeFullscreen = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const [isFullscreen, setFullscreen] = useState(false)

  function closeFullscreen() {
    setFullscreen(false)
    if (nativeFullscreen.current && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
    nativeFullscreen.current = false
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      closeFullscreen()
      return
    }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setFullscreen(true)
    // Fullscreen the document so existing detail-panel dialogs and popovers
    // portalled to body remain usable. The roadmap itself fills the viewport.
    // The same expanded layout works on browsers without the Fullscreen API.
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      nativeFullscreen.current = true
      void document.documentElement.requestFullscreen()
        .then(() => {
          if (!nativeFullscreen.current && document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {})
          }
        })
        .catch(() => { nativeFullscreen.current = false })
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      if (nativeFullscreen.current && !document.fullscreenElement) {
        nativeFullscreen.current = false
        setFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      const ownedFullscreen = nativeFullscreen.current
      nativeFullscreen.current = false
      if (ownedFullscreen && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (!isFullscreen || !ref.current) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Disable only the surrounding workspace, leaving new portal dialogs active.
    const siblings: { element: HTMLElement; inert: boolean }[] = []
    let ancestor: HTMLElement = ref.current
    while (ancestor.parentElement && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement.children) {
        if (sibling !== ancestor && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      ancestor = ancestor.parentElement
    }
    return () => {
      document.body.style.overflow = overflow
      for (const { element, inert } of siblings) element.inert = inert
      returnFocus.current?.focus({ preventScroll: true })
    }
  }, [isFullscreen])

  function onFullscreenKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isFullscreen || event.defaultPrevented) return
    // Nested portal dialogs manage their own focus and Escape key.
    if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeFullscreen()
    }
    if (event.key !== 'Tab') return
    const focusable = [...ref.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    )].filter((element) => element.getClientRects().length && !element.closest('[inert]'))
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return { ref, isFullscreen, toggleFullscreen, onFullscreenKeyDown }
}
