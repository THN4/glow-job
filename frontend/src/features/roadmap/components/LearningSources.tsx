import { useQuery } from '@tanstack/react-query'
import { safeSourceUrl, type LearningSource, type LearningSourcesLoader } from '../learningSources'

type LearningSourcesProps = {
  topic: string
  skillId?: number
  loadSources?: LearningSourcesLoader
  fallbackSources?: LearningSource[]
}

export function LearningSources({ topic, skillId, loadSources, fallbackSources = [] }: LearningSourcesProps) {
  const retrievalEnabled = Boolean(loadSources && skillId)
  const query = useQuery({
    queryKey: ['roadmap-learning-sources', skillId],
    queryFn: ({ signal }) => loadSources!(skillId!, signal),
    enabled: retrievalEnabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const sources = retrievalEnabled ? query.data?.sources ?? [] : fallbackSources
  const status = query.data?.status

  return (
    <section aria-label={`Learning sources for ${topic}`} aria-busy={retrievalEnabled && query.isPending} className="rounded-lg border border-dashed border-primary/40 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">Sources</h3>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
          {retrievalEnabled ? 'Study materials' : 'Curated materials'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Learning materials to help you study {topic}.</p>
      <div aria-live="polite">
        {retrievalEnabled && query.isPending && <p className="mt-3 text-xs text-muted-foreground">Finding relevant learning materials…</p>}
        {retrievalEnabled && (query.isError || status === 'error') && (
          <div className="mt-3 text-xs">
            <p className="text-muted-foreground">We couldn’t load learning materials for this topic.</p>
            <button type="button" onClick={() => void query.refetch()} className="mt-2 min-h-9 text-primary underline">Try again</button>
          </div>
        )}
        {status === 'partial' && <p className="mt-3 text-xs text-muted-foreground">These materials cover part of this topic.</p>}
        {status === 'not_reviewed' && <p className="mt-3 text-xs text-muted-foreground">Learning materials are awaiting review.</p>}
        {!sources.length && (!retrievalEnabled || (query.isSuccess && status !== 'error' && status !== 'not_reviewed')) && (
          <p className="mt-3 text-xs text-muted-foreground">No relevant learning materials are available for this topic yet.</p>
        )}
      </div>
      {sources.length > 0 && (
        <ul className="mt-3 space-y-4">
          {sources.map((source) => {
            const url = safeSourceUrl(source.url)
            return (
              <li key={source.id} id={`learning-source-${source.id}`} className="scroll-mt-3">
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium leading-5 text-primary underline underline-offset-2 [overflow-wrap:anywhere]">
                    {source.title}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : <p className="text-xs font-medium leading-5 text-foreground">{source.title}</p>}
                {!!source.headingPath?.length && <p className="mt-1 text-xs text-muted-foreground">{source.headingPath.join(' › ')}</p>}
                {source.summary && <p className="mt-2 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-muted-foreground"><span className="font-medium">Summary: </span>{source.summary}</p>}
                {source.excerpts?.map((excerpt) => <blockquote key={excerpt} className="mt-2 whitespace-pre-line border-l-2 border-primary/60 pl-3 text-xs leading-5 text-foreground [overflow-wrap:anywhere]">{excerpt}</blockquote>)}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
