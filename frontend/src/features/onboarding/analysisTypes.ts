import type { analysisCopy } from '../../lib/analysisConstants'

export type AnalysisTask = typeof analysisCopy.steps[number]['id']
export type AnalysisStatus = 'pending' | 'loading' | 'done' | 'error'
export type AnalysisStep = { id: AnalysisTask; status: AnalysisStatus }
export type AnalysisProgress = (task: AnalysisTask, status: AnalysisStatus) => void
