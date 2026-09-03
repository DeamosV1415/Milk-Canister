import { useId, useMemo, useState } from "react"
import { useMeasure } from "@/lib/useMeasure"
import { timeShort } from "@/lib/format"
import { SAFE_BAND, type Reading } from "@/telemetry/types"

/* ===========================================================================
   Milk temperature over time.

   One line. Not four.

   The earlier version drew core, wall, PCM and ambient together with dash
   patterns and an axis legend — correct for an engineer auditing an envelope,
   useless to someone who wants to know whether their milk is still cold. So
   this chart answers exactly that: where the line sits relative to the green
   "good" band, and whether it is heading up.

   Everything else is atmosphere: a soft fill under the curve, a warm wash in
   the too-warm zone, and a rounded smooth line. The zones do the explaining,
   so the axis can stay almost silent.
   =========================================================================== */

const PAD = { l: 36, r: 18, t: 18, b: 26 }

/**
 * Catmull-Rom through the points, converted to cubic beziers. A raw polyline
 * of sensor samples looks jagged and anxious; a smoothed curve reads as a
 * trend, which is what is actually being communicated.
 */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ""
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)},${c2x.toFixed(2)} ${c2y.toFixed(2)},${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

export function TemperatureChart({
  history,
  rangeHours,
}: {
  history: Reading[]
  /** Window to plot, in simulated hours. `null` plots everything held. */
  rangeHours: number | null
}) {
  const { ref, width, height } = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, "")

  // Trim to the requested window, then thin to ~60 points: a gentler curve
  // and far less DOM than plotting every sample.
  const data = useMemo(() => {
    if (history.length < 2) return []
    let win = history
    if (rangeHours != null) {
      const cutoff = history[history.length - 1].t - rangeHours * 3600_000
      const trimmed = history.filter((r) => r.t >= cutoff)
      if (trimmed.length >= 2) win = trimmed
    }
    const step = Math.max(1, Math.floor(win.length / 60))
    return win.filter((_, i) => i % step === 0 || i === win.length - 1)
  }, [history, rangeHours])

  const geom = useMemo(() => {
    if (data.length < 2 || width < 120 || height < 120) return null

    const innerW = width - PAD.l - PAD.r
    const innerH = height - PAD.t - PAD.b

    // Domain always contains the whole safe band plus a little air, so the
    // green zone never scrolls off and the line always has context.
    let lo = Math.min(SAFE_BAND.min, ...data.map((r) => r.milkCoreC))
    let hi = Math.max(SAFE_BAND.max + 2, ...data.map((r) => r.milkCoreC))
    const pad = Math.max(0.8, (hi - lo) * 0.14)
    lo -= pad
    hi += pad

    const x = (i: number) => PAD.l + (i / (data.length - 1)) * innerW
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * innerH

    const pts = data.map((r, i) => ({ x: x(i), y: y(r.milkCoreC) }))
    const line = smoothPath(pts)

    return { innerW, innerH, lo, hi, x, y, pts, line }
  }, [data, width, height])

  const active = hover != null ? data[hover] : null
  const latest = data.length ? data[data.length - 1] : null
  const tooWarm = latest ? latest.milkCoreC > SAFE_BAND.max : false

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={ref} className="relative min-h-0 flex-1">
        {!geom ? (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-faint">
            Waiting for readings
          </div>
        ) : (
          <svg
            width={width}
            height={height}
            className="block"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const rel = e.clientX - box.left - PAD.l
              const i = Math.round((rel / geom.innerW) * (data.length - 1))
              setHover(Math.max(0, Math.min(data.length - 1, i)))
            }}
          >
            <defs>
              <clipPath id={`clip-${uid}`}>
                <rect x={PAD.l} y={PAD.t} width={geom.innerW} height={geom.innerH} />
              </clipPath>
            </defs>

            {/* ---- Zones. These carry the meaning, so the axis needn't. ----
                 There is deliberately no gradient fill under the curve: a blue
                 wash painted over a green band mixes to a muddy teal and the
                 two zones stop being legible as zones. The bands are the
                 colour story; the line just has to sit cleanly on top.      */}
            {/* Too warm: everything above 8 degC. */}
            <rect
              x={PAD.l}
              y={PAD.t}
              width={geom.innerW}
              height={Math.max(0, geom.y(SAFE_BAND.max) - PAD.t)}
              rx="8"
              fill="var(--color-risk-soft)"
              opacity="0.6"
            />
            {/* Good: the band the milk is supposed to live in. */}
            <rect
              x={PAD.l}
              y={geom.y(SAFE_BAND.max)}
              width={geom.innerW}
              height={Math.max(0, geom.y(SAFE_BAND.min) - geom.y(SAFE_BAND.max))}
              rx="8"
              fill="var(--color-fresh-soft)"
            />

            <text
              x={PAD.l + 10}
              y={PAD.t + 15}
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-risk)"
              opacity="0.85"
            >
              Too warm
            </text>
            <text
              x={PAD.l + 10}
              y={(geom.y(SAFE_BAND.max) + geom.y(SAFE_BAND.min)) / 2 + 4}
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-fresh)"
              opacity="0.85"
            >
              Good — 2 to 8°
            </text>

            {/* ---- Axis. Two ticks. That is the entire budget. ------------ */}
            {[SAFE_BAND.max, SAFE_BAND.min].map((v) => (
              <g key={v}>
                <line
                  x1={PAD.l}
                  y1={geom.y(v)}
                  x2={PAD.l + geom.innerW}
                  y2={geom.y(v)}
                  stroke="var(--color-fresh-line)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
                <text
                  x={PAD.l - 8}
                  y={geom.y(v) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--color-ink-faint)"
                >
                  {v}°
                </text>
              </g>
            ))}

            {/* ---- The line ---------------------------------------------- */}
            <g clipPath={`url(#clip-${uid})`}>
              {/* A soft white underlay lifts the line off the zone tint just
                  enough to keep it crisp, without introducing a second hue. */}
              <path
                d={geom.line}
                fill="none"
                stroke="var(--color-surface)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />
              <path
                d={geom.line}
                fill="none"
                stroke="var(--color-cool)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* ---- Now ---------------------------------------------------- */}
            {latest ? (
              <g>
                <circle
                  cx={geom.pts[geom.pts.length - 1].x}
                  cy={geom.pts[geom.pts.length - 1].y}
                  r="8"
                  fill={tooWarm ? "var(--color-risk)" : "var(--color-cool)"}
                  opacity="0.14"
                />
                <circle
                  cx={geom.pts[geom.pts.length - 1].x}
                  cy={geom.pts[geom.pts.length - 1].y}
                  r="4"
                  fill={tooWarm ? "var(--color-risk)" : "var(--color-cool)"}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                />
              </g>
            ) : null}

            {/* ---- Time ends only. No dense tick row. --------------------- */}
            <text x={PAD.l} y={height - 8} fontSize="11" fill="var(--color-ink-faint)">
              {timeShort(data[0].t)}
            </text>
            <text
              x={PAD.l + geom.innerW}
              y={height - 8}
              textAnchor="end"
              fontSize="11"
              fill="var(--color-ink-faint)"
            >
              now
            </text>

            {/* ---- Hover -------------------------------------------------- */}
            {hover != null && geom.pts[hover] ? (
              <g pointerEvents="none">
                <line
                  x1={geom.pts[hover].x}
                  y1={PAD.t}
                  x2={geom.pts[hover].x}
                  y2={PAD.t + geom.innerH}
                  stroke="var(--color-ink-faint)"
                  strokeWidth="1"
                  opacity="0.35"
                />
                <circle
                  cx={geom.pts[hover].x}
                  cy={geom.pts[hover].y}
                  r="5"
                  fill="var(--color-cool)"
                  stroke="var(--color-surface)"
                  strokeWidth="2.5"
                />
              </g>
            ) : null}
          </svg>
        )}

        {active ? (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] shadow-[0_2px_8px_rgba(38,36,31,0.06)]">
            <span className="font-semibold text-ink">{active.milkCoreC.toFixed(1)}°C</span>
            <span className="ml-2 text-ink-faint">{timeShort(active.t)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
