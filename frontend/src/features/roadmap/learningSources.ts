import { z } from 'zod'

export type LearningSource = {
  id: string
  title: string
  url?: string
  summary?: string
  excerpts?: string[]
  headingPath?: string[]
}

export type LearningSourcesResult = {
  status: 'supported' | 'partial' | 'insufficient_evidence' | 'not_reviewed' | 'error'
  sources: LearningSource[]
}

export type LearningSourcesLoader = (skillId: number, signal: AbortSignal) => Promise<LearningSourcesResult>

const contextSchema = z.object({
  skill_id: z.number().int().positive(),
  status: z.enum(['supported', 'partial', 'insufficient_evidence', 'not_reviewed', 'error']),
  retrieved_context: z.array(z.object({
    chunk_id: z.number().int().positive(),
    source_id: z.number().int().positive(),
    title: z.string(),
    source_url: z.string().nullable(),
    heading_path: z.array(z.string()),
    content: z.string(),
  })),
  claims: z.array(z.object({
    citations: z.array(z.object({ chunk_id: z.number().int().positive(), quote: z.string().min(1) })),
  })),
})

export function safeSourceUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

// Accepts the document pipeline's knowledge-context-preview-1 response.
// Only reviewed, cited excerpts are exposed as study materials.
export function adaptLearningSources(payload: unknown, skillId: number): LearningSourcesResult {
  const preview = z.object({
    schema_version: z.literal('knowledge-context-preview-1'),
    skills: z.array(contextSchema),
  }).parse(payload)
  const context = preview.skills.find((skill) => skill.skill_id === skillId)
  if (!context) throw new Error('The response does not contain the requested skill.')
  if (context.status !== 'supported' && context.status !== 'partial') {
    return { status: context.status, sources: [] }
  }
  const sources = context.retrieved_context.flatMap((chunk): LearningSource[] => {
    const excerpts = [...new Set(context.claims.flatMap((claim) => claim.citations)
      .filter((citation) => citation.chunk_id === chunk.chunk_id && chunk.content.includes(citation.quote))
      .map((citation) => citation.quote))]
    if (!excerpts.length) return []
    return [{
      id: `chunk-${chunk.chunk_id}`,
      title: chunk.title,
      url: safeSourceUrl(chunk.source_url),
      excerpts,
      headingPath: chunk.heading_path,
    }]
  })
  return { status: sources.length ? context.status : 'insufficient_evidence', sources }
}

// Supply an implemented backend endpoint when available; no endpoint is assumed.
export function createLearningSourcesLoader(endpoint: string): LearningSourcesLoader {
  return async (skillId, signal) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_ids: [skillId], intent: 'fundamentals' }),
      signal,
    })
    if (!response.ok) throw new Error('Learning materials could not be retrieved.')
    return adaptLearningSources(await response.json(), skillId)
  }
}
