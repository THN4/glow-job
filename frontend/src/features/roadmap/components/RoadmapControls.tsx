import { CornerDownRight, Ellipsis, LayoutGrid, RotateCcw, Spline, ZoomIn, ZoomOut } from 'lucide-react'
import { Popover } from 'radix-ui'

export type ConnectionStyle = 'curved' | 'orthogonal'

type RoadmapControlsProps = {
  zoom: number
  minZoom: number
  maxZoom: number
  zoomStep: number
  onZoomChange: (zoom: number) => void
  onFit: () => void
  onResetZoom: () => void
  onResetLayout: () => void
  connectionStyle: ConnectionStyle
  onConnectionStyleChange: (style: ConnectionStyle) => void
}

const toolButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40'
const menuButton = 'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs text-slate-700 transition-colors hover:bg-blue-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary'

export function RoadmapControls({
  zoom, minZoom, maxZoom, zoomStep, onZoomChange, onFit, onResetZoom,
  onResetLayout, connectionStyle, onConnectionStyleChange,
}: RoadmapControlsProps) {
  return (
    <>
      <div role="group" aria-label="Roadmap zoom controls" className="flex items-center gap-0.5">
        <button type="button" onClick={() => onZoomChange(Math.round((zoom - zoomStep) * 100) / 100)}
          disabled={zoom <= minZoom} aria-label="Zoom out" title="Zoom out" className={toolButton}>
          <ZoomOut size={17} aria-hidden="true" />
        </button>
        <span className="w-10 text-center text-xs font-medium tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoomChange(Math.round((zoom + zoomStep) * 100) / 100)}
          disabled={zoom >= maxZoom} aria-label="Zoom in" title="Zoom in" className={toolButton}>
          <ZoomIn size={17} aria-hidden="true" />
        </button>
      </div>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <button type="button" onClick={onFit} aria-label="Fit roadmap to view" title="Fit to view" className={toolButton}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="m7 17 10-10M7 13v4h4m2-10h4v4" />
        </svg>
      </button>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" aria-label="More roadmap tools" title="More tools" className={`${toolButton} data-[state=open]:bg-blue-50 data-[state=open]:text-primary`}>
            <Ellipsis size={18} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={12}
            aria-label="More roadmap tools"
            className="z-50 w-52 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-lg outline-none"
            style={{ maxHeight: 'min(24rem, var(--radix-popover-content-available-height))' }}>
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold text-slate-500">View</p>
            <Popover.Close asChild>
              <button type="button" onClick={onResetZoom} aria-label="Reset zoom" className={menuButton}>
                <RotateCcw size={15} aria-hidden="true" />Reset zoom
              </button>
            </Popover.Close>
            <div className="my-2 border-t border-border" />
            <p className="px-2 pb-2 text-[11px] font-semibold text-slate-500">Connections</p>
            <div role="group" aria-label="Connection style" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-50 p-1">
              {([
                { value: 'curved', label: 'Curve', description: 'Curved connections', icon: Spline },
                { value: 'orthogonal', label: 'Elbow', description: 'Right-angle connections', icon: CornerDownRight },
              ] as const).map(({ value, label, description, icon: Icon }) => (
                <button key={value} type="button" onClick={() => onConnectionStyleChange(value)}
                  aria-label={description} title={description} aria-pressed={connectionStyle === value}
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary ${connectionStyle === value ? 'bg-white font-medium text-primary shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div className="my-2 border-t border-border" />
            <Popover.Close asChild>
              <button type="button" onClick={onResetLayout} aria-label="Reset node layout" className={menuButton}>
                <LayoutGrid size={15} aria-hidden="true" />Reset layout
              </button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
