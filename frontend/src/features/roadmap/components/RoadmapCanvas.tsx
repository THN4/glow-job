import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Maximize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { arrowColors, isConnectionDashed } from '../connectionAppearance'
import { getFitZoom, getGraphFrame, getZoomScroll } from '../viewport'
import type {
  RoadmapConnection,
  RoadmapNodeData,
  RoadmapSummary,
} from '../type'
import { RoadmapNode } from './RoadmapNode'
import { RoadmapProgressBadge } from './RoadmapProgressBadge'

type RoadmapCanvasProps = {
  targetRole: string
  nodes: RoadmapNodeData[]
  connections: RoadmapConnection[]
  selectedNodeId: string | null
  onSelectNode: (node: RoadmapNodeData) => void
  detailsOpen?: boolean
  progressSummary?: RoadmapSummary
}

const GRAPH_WIDTH = 1000
const GRAPH_CANVAS_PADDING = 32
const GRID_COLUMNS = 3
const NODE_HEIGHT = 60
const MIN_NODE_WIDTH = 96
const MAX_NODE_WIDTH = 200
const NODE_LAYOUT_STORAGE_PREFIX = 'glow-roadmap-node-layout:v8:'
const INDEPENDENT_ROUTE_ID = '__independent_skill_route'
const MIN_GRAPH_ZOOM = 0.25
const MAX_GRAPH_ZOOM = 1.5
const GRAPH_ZOOM_STEP = 0.1
const DEFAULT_GRAPH_ZOOM = 0.7

type CanvasPoint = { x: number; y: number }
type ConnectionStyle = 'curved' | 'orthogonal'
type DragState = {
  id: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
}
type PanState = {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

type GraphSize = {
  width: number
  height: number
}

function getConnectionPath(
  from: RoadmapNodeData,
  to: RoadmapNodeData,
  positions: Record<string, CanvasPoint>,
  { width, height }: GraphSize,
  nodeWidth: number,
  style: ConnectionStyle,
) {
  const fromPoint = positions[from.id] ?? { x: 0.5, y: 0.5 }
  const toPoint = positions[to.id] ?? { x: 0.5, y: 0.5 }
  const x1 = fromPoint.x * width
  const y1 = fromPoint.y * height
  const x2 = toPoint.x * width
  const y2 = toPoint.y * height
  const dx = x2 - x1
  const dy = y2 - y1
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const startX = horizontal ? x1 + Math.sign(dx || 1) * nodeWidth / 2 : x1
  const startY = horizontal ? y1 : y1 + Math.sign(dy || 1) * NODE_HEIGHT / 2
  const endX = horizontal ? x2 - Math.sign(dx || 1) * nodeWidth / 2 : x2
  const endY = horizontal ? y2 : y2 - Math.sign(dy || 1) * NODE_HEIGHT / 2

  if (style === 'curved') {
    const bend = Math.max(36, Math.min(140, Math.hypot(dx, dy) * 0.42))
    const controlX = horizontal ? bend * Math.sign(dx || 1) : 0
    const controlY = horizontal ? 0 : bend * Math.sign(dy || 1)
    return `M ${startX} ${startY} C ${startX + controlX} ${startY + controlY}, ${endX - controlX} ${endY - controlY}, ${endX} ${endY}`
  }

  if (horizontal) {
    const middleX = (startX + endX) / 2
    return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`
  }
  const middleY = (startY + endY) / 2
  return `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`
}

export function RoadmapCanvas({
  targetRole,
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  detailsOpen = false,
  progressSummary,
}: RoadmapCanvasProps) {
  const arrowId = useId()
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const prerequisiteConnections = connections.filter((connection) => connection.kind === 'prerequisite')
  const independentSkills = nodes.filter((node) => node.kind === 'skill'
    && !prerequisiteConnections.some((connection) => connection.from === node.id || connection.to === node.id))
  const sortedIndependent = [...independentSkills].sort((a, b) =>
    a.position.row - b.position.row || a.position.column - b.position.column)
  const goalNode = nodes.find((node) => node.kind === 'goal')
  const routeHub: RoadmapNodeData | null = independentSkills.length > 0 && goalNode ? {
    id: INDEPENDENT_ROUTE_ID,
    title: 'Independent skills route',
    kind: 'career-activity',
    status: independentSkills.every((node) => node.status === 'completed') ? 'completed' : 'upcoming',
    position: { row: goalNode.position.row, column: goalNode.position.column },
    subtitle: 'Suggested path · not a prerequisite',
    description: 'These skills can be learned independently. This visual join groups their suggested paths toward your target; it does not require completing them in a fixed order.',
    whyItMatters: [],
  } : null
  const canvasNodesById = new Map(nodesById)
  if (routeHub) canvasNodesById.set(routeHub.id, routeHub)
  const rows = [...new Set(nodes.map((node) => node.position.row))]
    .sort((first, second) => first - second)
  const graphRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const positionsRef = useRef<Record<string, CanvasPoint>>({})
  const pendingViewRef = useRef<'center' | { zoom: number; left: number; top: number } | null>(null)
  const suppressNodeClickRef = useRef(false)
  const layoutKey = `${NODE_LAYOUT_STORAGE_PREFIX}${nodes.map((node) => node.id).sort().join('|')}`
  const layoutFingerprint = nodes.map((node) => `${node.id}:${node.position.row}:${node.position.column}`).sort().join('|')
  const [positions, setPositions] = useState<Record<string, CanvasPoint>>({})
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('curved')
  const [manualZoom, setManualZoom] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [graphSize, setGraphSize] = useState<GraphSize>({
    width: GRAPH_WIDTH,
    height: 660,
  })
  const nodeWidth = Math.max(
    detailsOpen ? MIN_NODE_WIDTH : 120,
    Math.min(MAX_NODE_WIDTH, graphSize.width / GRID_COLUMNS - 24),
  )
  const independentIndex = new Map(sortedIndependent.map((node, index) => [node.id, index]))
  const maxRow = Math.max(...nodes.map((node) => node.position.row), 1)
  const minimumGraphHeight = Math.max(
    660,
    Math.ceil((maxRow * (NODE_HEIGHT + 18 + 36)) / 0.88),
    sortedIndependent.length > 1 ? Math.ceil((sortedIndependent.length + 1) * 90 / 0.88) : 0,
  )
  const maxConnectionLabelWidth = Math.max(
    0,
    ...connections.map((connection) => (connection.label?.length ?? 0) * 5.7 + 12),
    routeHub ? 'Suggested'.length * 5.7 + 12 : 0,
  )
  const laneGap = Math.max(48, maxConnectionLabelWidth)
  const minimumGraphWidth = Math.max(
    independentSkills.length > 0 ? 840 : 576,
    independentSkills.length > 0
      ? Math.ceil(nodeWidth * 4 + laneGap * 3)
      : Math.ceil((nodeWidth + Math.max(36, maxConnectionLabelWidth) + 28) / (1 / GRID_COLUMNS)),
  )
  const defaultPosition = (node: RoadmapNodeData): CanvasPoint => {
    const y = Math.min(0.94, Math.max(0.06, 0.06 + ((node.position.row - 0.5) / maxRow) * 0.88))
    const independentPosition = independentIndex.get(node.id)
    if (independentPosition !== undefined) {
      const fraction = (independentPosition + 1) / (sortedIndependent.length + 1)
      return { x: nodeWidth / (2 * minimumGraphWidth), y: 0.06 + fraction * 0.88 }
    }

    // Keep independent skills in a left lane and distribute the remaining roadmap
    // across three lanes to their right. Positions are derived from node width and
    // actual lane gaps, so the graph ends at the outer edge of its rightmost node.
    const lane = Math.max(0, Math.min(GRID_COLUMNS - 1, node.position.column - 1))
    if (independentSkills.length > 0) {
      return {
        x: (nodeWidth / 2 + (nodeWidth + laneGap) * (lane + 1)) / minimumGraphWidth,
        y,
      }
    }
    return { x: (node.position.column - 0.5) / GRID_COLUMNS, y }
  }

  const positionFor = (node: RoadmapNodeData): CanvasPoint => positions[node.id] ?? defaultPosition(node)
  const independentCenters = sortedIndependent.map(positionFor)
  const defaultIndependentY = sortedIndependent.length
    ? sortedIndependent.reduce((sum, node) => sum + defaultPosition(node).y, 0) / sortedIndependent.length
    : 0.5
  const defaultRouteHubPosition = (() => {
    if (!routeHub) return { x: 0.5, y: 0.5 }
    const independentLaneX = nodeWidth / (2 * minimumGraphWidth)
    const firstSkillLaneX = (nodeWidth / 2 + nodeWidth + laneGap) / minimumGraphWidth
    const nearestIndependentRouteX = (independentLaneX + firstSkillLaneX) / 2
    const columns = [nearestIndependentRouteX, nearestIndependentRouteX + 0.2, nearestIndependentRouteX + 0.4]
    const rowCount = Math.max(5, Math.min(13, Math.ceil(minimumGraphHeight / 54)))
    // The join is anchored to the generated layout. Dragging another node must not
    // make this non-draggable group jump to a different slot.
    const occupied = nodes.map((node) => defaultPosition(node))
    const candidates = columns.flatMap((x) => Array.from({ length: rowCount }, (_, index) => ({
      x,
      y: 0.08 + (0.84 * index) / Math.max(1, rowCount - 1),
    })))
    const safe = candidates.filter((candidate) => occupied.every((point) =>
      Math.abs(candidate.x - point.x) * minimumGraphWidth >= nodeWidth + 20
      || Math.abs(candidate.y - point.y) * minimumGraphHeight >= NODE_HEIGHT + 20))
    const pool = safe.length ? safe : candidates
    return pool.sort((a, b) => {
      const score = (point: CanvasPoint) => Math.abs(point.x - nearestIndependentRouteX) + Math.abs(point.y - defaultIndependentY)
      return score(a) - score(b)
    })[0]
  })()
  const routeHubPosition = defaultRouteHubPosition
  const independentRightEdge = independentCenters.length
    ? Math.max(...independentCenters.map((point) => point.x)) + nodeWidth / (2 * graphSize.width)
    : nodeWidth / (2 * graphSize.width)
  const routeHubLeftEdge = routeHubPosition.x - nodeWidth / (2 * graphSize.width)
  const independentTrunkX = Math.min(independentRightEdge + 0.025, routeHubLeftEdge - 0.025)
  const canvasPositions: Record<string, CanvasPoint> = {
    ...positions,
    ...(routeHub ? {
      [routeHub.id]: routeHubPosition,
    } : {}),
  }
  const terminalSkillConnections = goalNode
    ? nodes
      .filter((node) => node.kind === 'skill'
        && !independentSkills.some((independent) => independent.id === node.id)
        && !prerequisiteConnections.some((connection) => connection.from === node.id))
      .map((node) => ({
        from: node.id,
        to: goalNode.id,
        optional: true,
        kind: 'recommended_order',
      } satisfies RoadmapConnection))
    : []
  const canvasConnections: RoadmapConnection[] = [
    ...connections.filter((connection) => !routeHub
      || (connection.to !== routeHub.id && connection.from !== routeHub.id)),
    ...(routeHub ? [{
      from: routeHub.id,
      to: goalNode!.id,
      optional: true,
      kind: 'recommended_order',
      label: 'Suggested',
    } satisfies RoadmapConnection] : []),
    ...terminalSkillConnections,
  ]

  const canvasSize = { width: minimumGraphWidth, height: minimumGraphHeight }
  const fitZoom = getFitZoom(viewportSize, canvasSize, GRAPH_CANVAS_PADDING + 12, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM)
  const defaultZoom = Math.min(DEFAULT_GRAPH_ZOOM, fitZoom)
  const zoom = manualZoom ?? defaultZoom
  const frame = getGraphFrame(viewportSize, canvasSize, zoom, GRAPH_CANVAS_PADDING)

  function changeZoom(nextZoom: number, center = false) {
    const viewport = viewportRef.current
    pendingViewRef.current = center || !viewport ? 'center' : {
      zoom, left: viewport.scrollLeft, top: viewport.scrollTop,
    }
    setManualZoom(Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, nextZoom)))
  }

  function centerViewport() {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ left: (viewport.scrollWidth - viewport.clientWidth) / 2,
      top: (viewport.scrollHeight - viewport.clientHeight) / 2, behavior: 'instant' })
  }

  function fitToView() {
    changeZoom(fitZoom, true)
    // A repeated Fit click must work even when React can skip the state update.
    if (zoom === fitZoom) {
      centerViewport()
      pendingViewRef.current = null
    }
  }

  function resetZoom() {
    pendingViewRef.current = 'center'
    setManualZoom(null)
    if (zoom === defaultZoom) {
      centerViewport()
      pendingViewRef.current = null
    }
  }

  // Update scroll offsets after the existing CSS scale has changed, without a
  // competing animation or modifying any saved node coordinates.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const pending = pendingViewRef.current
    if (pending && pending !== 'center') {
      const scroll = getZoomScroll(
        viewportSize, { width: minimumGraphWidth, height: minimumGraphHeight },
        GRAPH_CANVAS_PADDING, pending, zoom,
      )
      viewport.scrollTo({ ...scroll, behavior: 'instant' })
    } else if (pending === 'center' || manualZoom === null) {
      viewport.scrollTo({
        left: (viewport.scrollWidth - viewport.clientWidth) / 2,
        top: (viewport.scrollHeight - viewport.clientHeight) / 2,
        behavior: 'instant',
      })
    }
    pendingViewRef.current = null
  }, [zoom, manualZoom, viewportSize, minimumGraphWidth, minimumGraphHeight])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const initial = Object.fromEntries(nodes.map((node) => [node.id, defaultPosition(node)])) as Record<string, CanvasPoint>
      try {
        const saved = localStorage.getItem(layoutKey)
        const parsed = saved ? JSON.parse(saved) as Record<string, CanvasPoint> : null
        const restored = parsed && nodes.every((node) => Number.isFinite(parsed[node.id]?.x)
          && Number.isFinite(parsed[node.id]?.y)) ? parsed : initial
        positionsRef.current = restored
        setPositions(restored)
      } catch {
        positionsRef.current = initial
        setPositions(initial)
      }
    })
    return () => window.cancelAnimationFrame(frame)
    // Only restore when the node set or server layout changes. A fresh `nodes` array on render
    // must not reset user dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, layoutFingerprint])

  function moveNode(id: string, clientX: number, clientY: number) {
    const bounds = graphRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return
    const halfWidth = nodeWidth / (2 * graphSize.width)
    const halfHeight = NODE_HEIGHT / (2 * graphSize.height)
    const next = {
      ...positionsRef.current,
      [id]: {
        x: Math.max(halfWidth, Math.min(1 - halfWidth, (clientX - bounds.left) / bounds.width)),
        y: Math.max(halfHeight, Math.min(1 - halfHeight, (clientY - bounds.top) / bounds.height)),
      },
    }
    positionsRef.current = next
    setPositions(next)
  }

  function finishDrag(cancelled = false) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    suppressNodeClickRef.current = true
    if (!drag.moved && !cancelled) {
      const selected = nodesById.get(drag.id)
      if (selected) onSelectNode(selected)
      return
    }
    if (drag.moved) {
      try { localStorage.setItem(layoutKey, JSON.stringify(positionsRef.current)) } catch { /* browser storage may be disabled */ }
    }
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === 'touch' || !event.isPrimary) return
    const target = event.target as HTMLElement
    if (target.closest('[data-roadmap-node], button, a, .roadmap-connection')) return
    const viewport = event.currentTarget
    const bounds = viewport.getBoundingClientRect()
    // Native scrollbar thumbs/tracks must remain draggable.
    if (event.clientX >= bounds.left + viewport.clientLeft + viewport.clientWidth
      || event.clientY >= bounds.top + viewport.clientTop + viewport.clientHeight) return
    viewport.focus({ preventScroll: true })
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    viewport.setPointerCapture(event.pointerId)
    setIsPanning(true)
    event.preventDefault()
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX)
    event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.startY)
  }

  function finishPan(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    const graphElement = graphRef.current
    if (!graphElement) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setGraphSize({ width, height })
    })

    resizeObserver.observe(graphElement)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setViewportSize({ width, height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#DCE8F7] bg-white shadow-sm">
      <div className="shrink-0 border-b border-[#E4ECF8] bg-white px-4 py-3 sm:px-5 [@media(max-height:760px)]:py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="text-sm font-semibold text-slate-800">Your roadmap relationships</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Your path to {targetRole}. Labels distinguish prerequisites from suggested links; completed links are solid, while other links are dashed. Skills without prerequisites can be started anytime. Drag steps to arrange them.
            </p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div role="group" className="hidden items-center gap-1 rounded-lg border border-slate-200 px-1 py-0.5 min-[640px]:flex" aria-label="Roadmap zoom controls">
              <button type="button" onClick={() => changeZoom(Math.round((zoom - GRAPH_ZOOM_STEP) * 100) / 100)}
                disabled={zoom <= MIN_GRAPH_ZOOM} aria-label="Zoom out" title="Zoom out"
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                <ZoomOut size={14} aria-hidden="true" />
              </button>
              <span className="w-9 text-center text-[10px] tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => changeZoom(Math.round((zoom + GRAPH_ZOOM_STEP) * 100) / 100)}
                disabled={zoom >= MAX_GRAPH_ZOOM} aria-label="Zoom in" title="Zoom in"
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                <ZoomIn size={14} aria-hidden="true" />
              </button>
              <button type="button" onClick={resetZoom}
                aria-label="Reset zoom" title="Reset zoom"
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                <RotateCcw size={12} aria-hidden="true" />
              </button>
              <button type="button" onClick={fitToView} aria-label="Fit roadmap to view" title="Fit to view"
                className="inline-flex items-center gap-1 rounded p-1 text-slate-600 hover:bg-[#EAF1FB] focus-visible:outline-2 focus-visible:outline-primary">
                <Maximize size={14} aria-hidden="true" />
                <span className="text-[10px]">Fit to view</span>
              </button>
            </div>
            <div>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-[10px]">
                <button type="button" onClick={() => setConnectionStyle('curved')}
                  aria-pressed={connectionStyle === 'curved'}
                  className={`rounded-md px-2 py-1 ${connectionStyle === 'curved' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  Curved
                </button>
                <button type="button" onClick={() => setConnectionStyle('orthogonal')}
                  aria-pressed={connectionStyle === 'orthogonal'}
                  className={`rounded-md px-2 py-1 ${connectionStyle === 'orthogonal' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  Right angle
                </button>
              </div>
            </div>
            <button type="button" onClick={() => {
              try { localStorage.removeItem(layoutKey) } catch { /* browser storage may be disabled */ }
              const initial = Object.fromEntries(nodes.map((node) => [node.id, defaultPosition(node)])) as Record<string, CanvasPoint>
              positionsRef.current = initial
              setPositions(initial)
            }} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50">
              Reset layout
            </button>
            {progressSummary && (
              <div className="hidden shrink-0 xl:block">
              <RoadmapProgressBadge
                completion={progressSummary.completion}
                statusText={progressSummary.statusText}
              />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-white p-3 sm:p-4">
        <div className="roadmap-scrollbar h-full overflow-y-auto overscroll-contain min-[640px]:hidden" tabIndex={0} role="region" aria-label="Roadmap stages">
          <ol className="mx-auto w-[92%] max-w-xs space-y-3 px-1 py-4">
            {rows.map((row, rowIndex) => {
              const rowNodes = nodes
                .filter((node) => node.position.row === row)
                .sort((first, second) => first.position.column - second.position.column)

              return (
                <li key={row}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Stage {rowIndex + 1}
                    </span>
                    <span className="h-px flex-1 bg-blue-100" aria-hidden="true" />
                  </div>
                  <div className="space-y-4">
                    {rowNodes.map((node) => (
                      <div key={node.id}>
                      <RoadmapNode
                        compact
                        node={node}
                        width="100%"
                        selected={selectedNodeId === node.id}
                        onSelect={onSelectNode}
                      />
                      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                        {connections.filter((edge) => edge.from === node.id).map((edge) => {
                          const target = nodesById.get(edge.to)
                          if (!target) return null
                          return (
                            <button
                              key={edge.to}
                              type="button"
                              onClick={() => onSelectNode(target)}
                              aria-label={`From ${node.title} to ${target.title}${edge.optional ? ', optional prerequisite check' : ', prerequisite'}`}
                              className="inline-flex min-h-9 items-center gap-1 rounded px-1 text-[10px] focus-visible:outline-2 focus-visible:outline-primary"
                              style={{ color: arrowColors[target.status] }}
                            >
                              <svg width="22" height="28" viewBox="0 0 22 28" fill="none" aria-hidden="true">
                              <path d="M11 2 V23" stroke="currentColor" strokeWidth="2" strokeDasharray={isConnectionDashed(edge, node.status, target.status) ? '3 3' : undefined} />
                                <path d="M6 18 L11 23 L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {target.title}
                            </button>
                          )
                        })}
                      </div>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ol>
          {routeHub && <p className="mx-auto mt-3 max-w-xs rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-[10px] leading-relaxed text-amber-900">
            Independent skills can be learned in any order. The suggested route groups them toward your target; it is not a prerequisite.
          </p>}
        </div>

        <div
          ref={viewportRef}
          className={`roadmap-scrollbar hidden h-full min-h-0 select-none overflow-auto overscroll-contain rounded-md focus-visible:outline-2 focus-visible:outline-primary min-[640px]:block ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          tabIndex={0}
          role="region"
          aria-label="Interactive roadmap. Drag empty space or use arrow keys to pan. Tab to explore steps and connections."
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={finishPan}
          onPointerCancel={finishPan}
          onLostPointerCapture={finishPan}
        >
          <div
            className="relative shrink-0 overflow-clip"
            style={{
              width: frame.width,
              height: frame.height,
            }}
          >
          <div
            ref={graphRef}
            className="absolute left-0 top-0"
            style={{
              left: frame.left,
              top: frame.top,
              width: minimumGraphWidth,
              height: minimumGraphHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
          <svg
            viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            role="group"
            aria-label="Roadmap connections"
          >
            <defs>
              {Object.entries(arrowColors).map(([status, color]) => (
              <marker
                key={status}
                id={`${arrowId}-${status}`}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill={color} />
              </marker>
              ))}
            </defs>
            {canvasConnections.map((connection, connectionIndex) => {
              const from = canvasNodesById.get(connection.from)
              const to = canvasNodesById.get(connection.to)
              if (!from || !to) return null
              const arrowStatus = to.status
              const markerEnd = `url(#${arrowId}-${arrowStatus})`
              const path = getConnectionPath(
                from, to, canvasPositions, graphSize, nodeWidth, connectionStyle,
              )
              const fromPoint = canvasPositions[from.id] ?? { x: 0.5, y: 0.5 }
              const toPoint = canvasPositions[to.id] ?? { x: 0.5, y: 0.5 }
              const labelX = (fromPoint.x + toPoint.x) * graphSize.width / 2
              const labelY = (fromPoint.y + toPoint.y) * graphSize.height / 2 - 8 + ((connectionIndex % 3) - 1) * 10
              const labelWidth = Math.max(48, (connection.label?.length ?? 0) * 5.7 + 12)

              const dashed = connection.from === INDEPENDENT_ROUTE_ID
                ? independentSkills.some((node) => node.status !== 'completed')
                : isConnectionDashed(connection, from.status, to.status)

              return (
                <g
                  key={`${connection.from}-${connection.to}`}
                  tabIndex={0}
                  role="img"
                  aria-label={`${from.title} to ${to.title}${connection.kind === 'prerequisite' ? connection.optional ? ', optional prerequisite check' : ', prerequisite' : ', suggested route'}`}
                  className="roadmap-connection pointer-events-auto outline-none"
                  style={{ color: arrowColors[arrowStatus] }}
                >
                  <title>{from.title} → {to.title}{connection.kind === 'prerequisite' ? connection.optional ? ' (optional prerequisite)' : ' (required prerequisite)' : ' (suggested route, not a prerequisite)'}</title>
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    pointerEvents="stroke"
                  />
                  <path
                  className="roadmap-connection-line"
                    d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={to.status === 'in-progress' ? '2.5' : '1.75'}
                  strokeDasharray={dashed ? '5 5' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={markerEnd}
                />
                  {connection.label && <g className="pointer-events-none" aria-hidden="true">
                    <rect x={labelX - labelWidth / 2} y={labelY - 9} width={labelWidth} height="18" rx="9"
                      fill="white" stroke={connection.kind === 'prerequisite' ? '#93c5fd' : '#fcd34d'} />
                    <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize="9"
                      fill={connection.kind === 'prerequisite' ? '#1d4ed8' : '#92400e'}>
                      {connection.label}
                    </text>
                  </g>}
                </g>
              )
            })}
          </svg>

          {routeHub && independentSkills.length > 0 && <svg
            viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            {independentSkills.map((node) => {
              const point = canvasPositions[node.id] ?? defaultPosition(node)
              const direction = independentTrunkX >= point.x ? 1 : -1
              const x1 = point.x * graphSize.width + direction * nodeWidth / 2
              const x2 = independentTrunkX * graphSize.width
              const y = point.y * graphSize.height
              return <path key={node.id} d={`M ${x1} ${y} H ${x2}`} fill="none"
                stroke={node.status === 'completed' ? arrowColors.completed : '#94a3b8'}
                strokeWidth="1.75" strokeDasharray={node.status === 'completed' ? undefined : '5 5'}
                strokeLinecap="round" />
            })}
            {independentSkills.length > 1 && <path
              d={`M ${independentTrunkX * graphSize.width} ${Math.min(routeHubPosition.y, ...independentSkills.map((node) => (canvasPositions[node.id] ?? defaultPosition(node)).y)) * graphSize.height} V ${Math.max(routeHubPosition.y, ...independentSkills.map((node) => (canvasPositions[node.id] ?? defaultPosition(node)).y)) * graphSize.height}`}
              fill="none" stroke={independentSkills.every((node) => node.status === 'completed') ? arrowColors.completed : '#94a3b8'}
              strokeWidth="1.75" strokeDasharray={independentSkills.every((node) => node.status === 'completed') ? undefined : '5 5'}
              strokeLinecap="round" />}
            <path
              d={`M ${independentTrunkX * graphSize.width} ${routeHubPosition.y * graphSize.height} H ${(routeHubPosition.x - nodeWidth / (2 * graphSize.width)) * graphSize.width}`}
              fill="none" stroke={independentSkills.every((node) => node.status === 'completed') ? arrowColors.completed : '#94a3b8'}
              strokeWidth="1.75" strokeDasharray={independentSkills.every((node) => node.status === 'completed') ? undefined : '5 5'}
              strokeLinecap="round" />
          </svg>}

          <div className="pointer-events-none absolute inset-0">
            {routeHub && <div
              className="pointer-events-none absolute z-10 flex h-[60px] items-center justify-center rounded-xl border border-dashed border-amber-400 bg-amber-50 px-3 text-center shadow-sm"
              style={{
                left: `${routeHubPosition.x * 100}%`,
                top: `${routeHubPosition.y * 100}%`,
                width: nodeWidth,
                transform: 'translate(-50%, -50%)',
              }}
              aria-label="Suggested route join. This is not a learning step or prerequisite."
            >
              <span>
                <span className="block text-[10px] font-semibold leading-tight text-amber-900">Independent skills route</span>
                <span className="mt-1 block text-[8px] leading-tight text-amber-800">Suggested join · not required</span>
              </span>
            </div>}
            {nodes.map((node) => (
              <div
                key={node.id}
                data-roadmap-node
                className="pointer-events-auto absolute z-10 touch-none cursor-grab active:cursor-grabbing [&>div]:pointer-events-auto"
                style={{
                  left: `${(positions[node.id]?.x ?? defaultPosition(node).x) * 100}%`,
                  top: `${(positions[node.id]?.y ?? defaultPosition(node).y) * 100}%`,
                  width: nodeWidth,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  suppressNodeClickRef.current = false
                  dragRef.current = { id: node.id, pointerId: event.pointerId,
                    startX: event.clientX, startY: event.clientY, moved: false }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current
                  if (!drag || drag.pointerId !== event.pointerId) return
                  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true
                  if (drag.moved) moveNode(node.id, event.clientX, event.clientY)
                }}
                onPointerUp={(event) => {
                  if (dragRef.current?.pointerId !== event.pointerId) return
                  finishDrag()
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                }}
                onPointerCancel={() => finishDrag(true)}
                onLostPointerCapture={() => finishDrag(true)}
                onClickCapture={(event) => {
                  if (event.detail > 0 && suppressNodeClickRef.current) {
                    event.preventDefault()
                    event.stopPropagation()
                    suppressNodeClickRef.current = false
                  }
                }}
              >
                {node.kind === 'skill' && !connections.some((edge) => edge.to === node.id
                  && edge.kind === 'prerequisite' && !edge.optional) && (
                  <span className="absolute -top-2 right-1 z-20 -translate-y-full rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-500 shadow-sm">
                    No prerequisite
                  </span>
                )}
                <RoadmapNode
                  node={node}
                  width={nodeWidth}
                  selected={selectedNodeId === node.id}
                  onSelect={onSelectNode}
                />
              </div>
            ))}
          </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  )
}
