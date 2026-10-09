import { useState } from 'react'
import { NodeDetailPanel } from '../components/NodeDetailPanel'
import { RoadmapCanvas } from '../components/RoadmapCanvas'
import { RoadmapHeader } from '../components/RoadmapHeader'
import {
  roadmapConnections,
  roadmapNodes,
  roadmapSummary,
} from '../data/roadmapMockData'
import type { RoadmapNodeData } from '../type'

export function RoadmapPage() {
  const [selectedNode, setSelectedNode] = useState<RoadmapNodeData | null>(null)

  return (
    <section aria-label="Career roadmap" className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 gap-4 min-[1200px]:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RoadmapHeader
            summary={roadmapSummary}
            showProgress={!selectedNode}
          />
          <RoadmapCanvas
            nodes={roadmapNodes}
            connections={roadmapConnections}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={setSelectedNode}
            detailsOpen={Boolean(selectedNode)}
            progressSummary={selectedNode ? roadmapSummary : undefined}
          />
        </div>
        {selectedNode && (
          <>
            <button
              type="button"
              aria-label="Close roadmap details"
              onClick={() => setSelectedNode(null)}
              className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px] min-[1200px]:hidden"
            />
            <div className="fixed inset-x-2 bottom-2 top-[6dvh] z-40 overflow-hidden min-[640px]:inset-x-6 min-[640px]:top-[8dvh] min-[1200px]:static min-[1200px]:mt-6 min-[1200px]:h-[calc(100%-1.5rem)] min-[1200px]:w-[304px] min-[1200px]:shrink-0">
              <NodeDetailPanel
                node={selectedNode}
                nodes={roadmapNodes}
                onClose={() => setSelectedNode(null)}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
