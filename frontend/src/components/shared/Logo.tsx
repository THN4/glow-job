import logo from '../../assets/glow_job_icon.svg'
import { sharedCopy } from '../../lib/constants'
import { cn } from '../../lib/utils'

export function Logo({ className }: { className?: string }) {
  return <div className={cn('flex w-24 shrink-0 flex-col items-center', className)} aria-label={sharedCopy.brand}>
    <img src={logo} alt="" aria-hidden="true" className="size-14 object-contain" />
    {/* <span aria-hidden="true" className="text-2xl font-bold leading-tight tracking-tight">Glow<span className="text-primary">Job</span></span> */}
  </div>
}
