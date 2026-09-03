import { useMemo } from "react"
import { cn } from "@/lib/utils"

/**
 * A bare sparkline. It answers one question — "which way is this going?" —
 * and the number beside it carries the value. Anything more is chart-junk at
 * 22px tall.
 */
export function MicroTrace({
  values,
  width = 96,
  height = 24,
  /** Optional threshold; segments above it are re-stroked warm. */
  ceiling,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  ceiling?: number
  className?: string
}) {
  const d = useMemo(() => {
    if (values.length < 2) return { line: "", breach: "" }

    let lo = Math.min(...values)
    let hi = Math.max(...values)
    if (ceiling != null) {
      lo = Math.min(lo, ceiling)
      hi = Math.max(hi, ceiling)
    }
    if (hi - lo < 0.001) {
      hi += 0.5
      lo -= 0.5
    }

    const pad = 3
    const x = (i: number) => (i / (values.length - 1)) * width
    const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2)

    const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")

    let breach = ""
    if (ceiling != null) {
      let open = false
      values.forEach((v, i) => {
        if (v > ceiling) {
          breach += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
          open = true
        } else {
          open = false
        }
      })
    }

    return { line, breach }
  }, [values, width, height, ceiling])

  if (!d.line) return <div style={{ width, height }} className={className} />

  return (
    <svg width={width} height={height} className={cn("block shrink-0", className)} aria-hidden>
      <path
        d={d.line}
        fill="none"
        stroke="var(--color-cool)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {d.breach ? (
        <path
          d={d.breach}
          fill="none"
          stroke="var(--color-risk)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}
