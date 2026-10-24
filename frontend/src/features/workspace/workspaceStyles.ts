/** Shared styles for equivalent workspace UI roles; canvas and hero content have their own hierarchy. */
export const workspaceStyles = {
  pageTitle: 'mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl xl:text-[28px]',
  pageContext: 'text-xs font-semibold uppercase tracking-[0.12em] text-primary',
  pageDescription: 'mt-2 text-sm leading-6 text-muted-foreground sm:text-base',
  sectionTitle: 'text-base font-bold leading-6 text-foreground',
  filter: 'min-h-10 min-w-0 max-w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
  primaryAction: 'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  outlineAction: 'inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  statePanel: 'mx-auto w-full max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8',
  stateDescription: 'mt-3 text-sm leading-6 text-muted-foreground',
  loading: 'p-6 text-sm leading-6 text-muted-foreground',
}
