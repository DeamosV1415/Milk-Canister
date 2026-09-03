import { useCallback, useLayoutEffect, useRef, useState } from "react"

/** Observes an element's box so SVG can be laid out in real pixels. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [rect, setRect] = useState({ width: 0, height: 0 })

  const setNode = useCallback((node: T | null) => {
    ref.current = node
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setRect((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  })

  return { ref: setNode, ...rect }
}
