import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import type {
  RoadmapConnection,
  RoadmapNodeData,
  RoadmapSummary,
} from '../type'
import { RoadmapNode } from './RoadmapNode'
import { RoadmapProgressBadge } from './RoadmapProgressBadge'

type RoadmapCanvasProps = {
  nodes: RoadmapNodeData[]
  connections: RoadmapConnection[]
  selectedNodeId: string | null
  onSelectNode: (node: RoadmapNodeData) => void
  detailsOpen?: boolean
  progressSummary?: RoadmapSummary
}

const GRAPH_WIDTH = 1000
const NODE_HEIGHT = 50
const GRAPH_VERTICAL_INSET = 18
const MIN_NODE_WIDTH = 96
const MAX_NODE_WIDTH = 190

type GraphSize = {
  width: number
  height: number
}

function getConnectionPath(
  from: RoadmapNodeData,
  to: RoadmapNodeData,
  { width, height }: GraphSize,
  nodeWidth: number,
) {
  const verticalInset = Math.min(GRAPH_VERTICAL_INSET, height * 0.08)
  const contentHeight = height - verticalInset * 2
  const x1 = ((from.position.column - 0.5) * width) / 4
  const y1 = verticalInset + ((from.position.row - 0.5) * contentHeight) / 6
  const x2 = ((to.position.column - 0.5) * width) / 4
  const y2 = verticalInset + ((to.position.row - 0.5) * contentHeight) / 6

  if (from.position.row === to.position.row) {
    const directionX = x2 > x1 ? 1 : -1
    const startX = x1 + directionX * (nodeWidth / 2)
    const endX = x2 - directionX * (nodeWidth / 2)
    return `M ${startX} ${y1} H ${endX}`
  }

  const startY = y1 + NODE_HEIGHT / 2
  const endY = y2 - NODE_HEIGHT / 2

  if (x1 === x2) return `M ${x1} ${startY} V ${endY}`

  const middleY = (startY + endY) / 2
  const directionX = x2 > x1 ? 1 : -1
  const radius = Math.min(8, Math.abs(middleY - startY), Math.abs(endY - middleY))

  return [
    `M ${x1} ${startY}`,
    `V ${middleY - radius}`,
    `Q ${x1} ${middleY} ${x1 + directionX * radius} ${middleY}`,
    `H ${x2 - directionX * radius}`,
    `Q ${x2} ${middleY} ${x2} ${middleY + radius}`,
    `V ${endY}`,
  ].join(' ')
}

export function RoadmapCanvas({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  detailsOpen = false,
  progressSummary,
}: RoadmapCanvasProps) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const rows = [...new Set(nodes.map((node) => node.position.row))]
    .sort((first, second) => first - second)
  const graphRef = useRef<HTMLDivElement>(null)
  const [graphSize, setGraphSize] = useState<GraphSize>({
    width: GRAPH_WIDTH,
    height: 576,
  })
  const nodeWidth = Math.max(
    detailsOpen ? MIN_NODE_WIDTH : 120,
    Math.min(MAX_NODE_WIDTH, graphSize.width / 4 - (detailsOpen ? 28 : 30)),
  )

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

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#DCE8F7] bg-white shadow-sm">
      <div className="shrink-0 border-b border-[#E4ECF8] bg-white px-4 py-3 sm:px-5 [@media(max-height:760px)]:py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">Your path to data engineering</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Follow the recommended route or explore upcoming branches.
            </p>
          </div>
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
      <div className="min-h-0 flex-1 bg-[#F4F8FF] p-3 sm:p-4">
        <div className="h-full overflow-y-auto overscroll-contain min-[640px]:hidden">
          <ol className="mx-auto max-w-xl space-y-1 px-1 py-2">
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
                  <div className="space-y-2">
                    {rowNodes.map((node) => (
                      <RoadmapNode
                        key={node.id}
                        node={node}
                        width="100%"
                        selected={selectedNodeId === node.id}
                        onSelect={onSelectNode}
                      />
                    ))}
                  </div>
                  {rowIndex < rows.length - 1 && (
                    <div className="flex h-8 items-center justify-center text-blue-400" aria-hidden="true">
                      <ArrowDown size={16} />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="hidden h-full min-h-0 overflow-x-auto overflow-y-hidden min-[640px]:block">
          <div
            ref={graphRef}
            className="relative mx-auto h-full min-h-0 w-full max-w-[1000px]"
          >
          <svg
            viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="roadmap-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#8bb1ff" />
              </marker>
            </defs>
            {connections.map((connection) => {
              const from = nodesById.get(connection.from)
              const to = nodesById.get(connection.to)
              if (!from || !to) return null

              return (
                <path
                  key={`${connection.from}-${connection.to}`}
                  d={getConnectionPath(from, to, graphSize, nodeWidth)}
                  fill="none"
                  stroke={connection.optional ? '#a8b8d1' : '#8bb1ff'}
                  strokeWidth={to.status === 'in-progress' ? '2.5' : '1.75'}
                  strokeDasharray={connection.optional ? '5 5' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#roadmap-arrow)"
                />
              )
            })}
          </svg>

          <div
            className="absolute inset-x-0 grid grid-cols-4 grid-rows-6"
            style={{ top: Math.min(GRAPH_VERTICAL_INSET, graphSize.height * 0.08), bottom: Math.min(GRAPH_VERTICAL_INSET, graphSize.height * 0.08) }}
          >
            {nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-center"
                style={{
                  gridColumn: node.position.column,
                  gridRow: node.position.row,
                }}
              >
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
    </section>
  )
}
