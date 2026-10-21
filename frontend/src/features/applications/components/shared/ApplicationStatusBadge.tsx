import type { ApplicationStatus } from '../../type'

const statusLabels: Record<ApplicationStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

const statusStyles: Record<ApplicationStatus, string> = {
  wishlist: 'bg-slate-100 text-slate-600',
  applied: 'bg-blue-50 text-blue-700',
  screening: 'bg-blue-50 text-blue-700',
  interview: 'bg-violet-50 text-violet-700',
  offer: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}
