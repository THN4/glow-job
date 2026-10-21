import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { getRoleRecommendations } from '../../../../lib/api'
import { goalCopy } from '../../../../lib/goalConstants'
import type { RoleRecommendation } from '../../types'
import { RoleRecommendationCard } from './RoleRecommendationCard'

type RecommendationState = { status: 'loading' | 'ready' | 'error'; roles: RoleRecommendation[] }

export function RoleRecommendations({ selectedRole, onSelect, labelledBy }: {
  selectedRole: string; onSelect: (role: string) => void; labelledBy: string
}) {
  const [state, setState] = useState<RecommendationState>({ status: 'loading', roles: [] })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getRoleRecommendations().then((roles) => {
      if (active) setState({ status: 'ready', roles })
    }).catch(() => {
      if (active) setState({ status: 'error', roles: [] })
    })
    return () => { active = false }
  }, [attempt])

  if (state.status === 'loading') return <p role="status" className="flex min-h-47 items-center justify-center gap-2 text-muted-foreground">
    <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{goalCopy.recommendations.loading}
  </p>
  if (state.status === 'error') return <div className="flex min-h-47 flex-col items-center justify-center gap-3">
    <p role="alert" className="text-muted-foreground">{goalCopy.recommendations.error}</p>
    <Button type="button" variant="outline" onClick={() => { setState({ status: 'loading', roles: [] }); setAttempt((value) => value + 1) }}>
      {goalCopy.recommendations.retry}
    </Button>
  </div>

  return <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-2 2xl:grid-cols-3">
    {state.roles.map((role) => <RoleRecommendationCard key={role.id} role={role}
      selected={selectedRole.trim().toLowerCase() === role.title.toLowerCase()} onSelect={() => onSelect(role.title)} />)}
  </div>
}
