import { Button } from '../../../../components/ui/button'
import { goalCopy } from '../../../../lib/goalConstants'

export function PopularRoleChips({ selectedRole, onSelect }: { selectedRole: string; onSelect: (role: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{goalCopy.popularLabel}</span>
      {goalCopy.popularRoles.map((role) => <Button key={role} type="button" variant="secondary"
        aria-pressed={selectedRole.trim().toLowerCase() === role.toLowerCase()} onClick={() => onSelect(role)}
        className="h-auto min-h-7 rounded-full px-2 py-1 text-sm font-normal leading-4 text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground">
        {role}
      </Button>)}
    </div>
  )
}
