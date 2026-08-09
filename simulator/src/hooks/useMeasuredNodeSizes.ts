import { useMemo } from 'react'
import { useStore } from '@xyflow/react'

export interface MeasuredSize {
  width: number
  height: number
}

const MEASURED_TYPES = new Set([
  'task',
  'autoScaling',
  'alb',
  'waf',
  'rdsInstance',
  'regionalService',
  'clusterVolume',
  'cloudWatchAlarms',
  'snsTopic',
])

export function useMeasuredNodeSizes(): Map<string, MeasuredSize> {
  const serialized = useStore((state) => {
    const entries: string[] = []
    state.nodeLookup.forEach((node, id) => {
      if (!MEASURED_TYPES.has(node.type ?? '')) return
      entries.push(`${id}:${Math.round(node.measured?.width ?? 0)}:${Math.round(node.measured?.height ?? 0)}`)
    })
    return entries.join(',')
  })

  return useMemo(() => {
    const sizes = new Map<string, MeasuredSize>()
    if (serialized === '') return sizes

    for (const entry of serialized.split(',')) {
      const [id, width, height] = entry.split(':')
      if (Number(height) > 0) sizes.set(id, { width: Number(width), height: Number(height) })
    }
    return sizes
  }, [serialized])
}
