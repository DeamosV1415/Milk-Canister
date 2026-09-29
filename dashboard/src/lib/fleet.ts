import type { CanNode, NodeStatus } from "@/telemetry/types"

/** Worst first. A seller scans down and stops when it goes quiet. */
const RANK: Record<NodeStatus, number> = { breach: 0, offline: 1, watch: 2, nominal: 3 }

export function sortCans(nodes: CanNode[]): CanNode[] {
  return [...nodes].sort((a, b) => {
    const r = RANK[a.derived.status] - RANK[b.derived.status]
    return r !== 0 ? r : a.derived.coldLifeMin - b.derived.coldLifeMin
  })
}
