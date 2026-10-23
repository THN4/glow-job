export function CurrentStepBorder() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden rounded-[inherit] text-blue-600">
      <rect
        x="1.25" y="1.25" rx="10.75"
        style={{ width: 'calc(100% - 2.5px)', height: 'calc(100% - 2.5px)' }}
        fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="9 7" strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="roadmap-current-flow"
      />
    </svg>
  )
}
