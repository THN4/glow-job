import type { JobFilters } from './type'

export function readJobFilters(params: URLSearchParams): JobFilters {
  const skill = params.get('skillId') ?? ''
  const validSkill = /^\d+$/.test(skill) && Number.isSafeInteger(Number(skill)) && Number(skill) > 0
  const text = (key: string, max: number) => {
    const value = (params.get(key) ?? '').trim()
    return value.length <= max ? value : ''
  }
  return {
    sort: params.get('sort') === 'recent' ? 'recent' : 'coverage',
    location: text('location', 300),
    employmentType: text('employmentType', 100),
    skillId: validSkill ? String(Number(skill)) : '',
  }
}

export function jobFilterParams(filters: JobFilters, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const key of ['sort', 'location', 'employmentType', 'skillId']) params.delete(key)
  if (filters.sort !== 'coverage') params.set('sort', filters.sort)
  if (filters.location) params.set('location', filters.location)
  if (filters.employmentType) params.set('employmentType', filters.employmentType)
  if (filters.skillId) params.set('skillId', filters.skillId)
  return params
}
