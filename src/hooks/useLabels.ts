import { useCallback, useEffect, useState } from 'react'
import { Labels, labelBus } from '../db/dexieClient'
import type { Label } from '../db/schema'

export default function useLabels() {
  const [labels, setLabels] = useState<Label[]>([])

  const load = useCallback(async () => {
    try {
      const all = await Labels.list()
      setLabels(all)
    } catch {
      // ignore load errors; UI will fallback to previous snapshot
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const all = await Labels.list()
      if (!cancelled) setLabels(all)
    })()

    const handler: EventListener = () => { void load() }
    labelBus.addEventListener('label:added', handler)
    labelBus.addEventListener('label:updated', handler)
    labelBus.addEventListener('label:removed', handler)

    return () => {
      cancelled = true
      labelBus.removeEventListener('label:added', handler)
      labelBus.removeEventListener('label:updated', handler)
      labelBus.removeEventListener('label:removed', handler)
    }
  }, [load])

  return { labels, reloadLabels: load }
}
