export function CurrentStepBorder() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-blue-600">
      <rect
        x="1.5" y="1.5" rx="10"
        style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="7 7" strokeLinecap="round"
        className="roadmap-current-flow"
      />
    </svg>
  )
}
