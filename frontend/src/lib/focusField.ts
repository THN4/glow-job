export function focusField(field: HTMLElement | null | undefined, block: ScrollLogicalPosition = 'center') {
  if (!field) return
  field.focus({ preventScroll: true })
  field.scrollIntoView({
    block,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
