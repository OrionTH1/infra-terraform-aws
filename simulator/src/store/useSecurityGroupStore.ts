import { create } from 'zustand'
export interface TooltipContent {
  title: string
  subtitle?: string
  lines: string[]
  side: 'left' | 'right'
}

export interface BoundaryAnchor {
  top: number
  left: number
  right: number
  height: number
}

export interface HoveredBoundary {
  key: string
  nodeId: string
  boundaryId: string | null
  pairId: string | null
  anchor: BoundaryAnchor
  content: TooltipContent
}

interface SecurityGroupState {
  hoveredPairId: string | null
  hoveredBoundaryId: string | null
  hoveredKey: string | null
  hoveredNodeId: string | null
  hoveredAnchor: BoundaryAnchor | null
  hoveredContent: TooltipContent | null
  hoverBoundary: (boundary: HoveredBoundary) => void
  toggleBoundary: (boundary: HoveredBoundary) => void
  clearBoundary: (key: string) => void
  clearAllBoundaries: () => void
}

const CLOSED = {
  hoveredKey: null,
  hoveredNodeId: null,
  hoveredBoundaryId: null,
  hoveredPairId: null,
  hoveredAnchor: null,
  hoveredContent: null,
}

function opened(boundary: HoveredBoundary) {
  return {
    hoveredKey: boundary.key,
    hoveredNodeId: boundary.nodeId,
    hoveredBoundaryId: boundary.boundaryId,
    hoveredPairId: boundary.pairId,
    hoveredAnchor: boundary.anchor,
    hoveredContent: boundary.content,
  }
}

export const useSecurityGroupStore = create<SecurityGroupState>((set) => ({
  ...CLOSED,
  hoverBoundary: (boundary) => set(opened(boundary)),
  toggleBoundary: (boundary) =>
    set((state) => (state.hoveredKey === boundary.key ? CLOSED : opened(boundary))),
  clearBoundary: (key) => set((state) => (state.hoveredKey === key ? CLOSED : state)),
  clearAllBoundaries: () => set((state) => (state.hoveredKey === null ? state : CLOSED)),
}))
