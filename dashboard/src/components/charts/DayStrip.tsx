import { useId, useMemo, useState, type ReactNode } from "react"
import { BatteryLowIcon } from "@phosphor-icons/react/dist/csr/BatteryLow"
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check"
import { DoorOpenIcon } from "@phosphor-icons/react/dist/csr/DoorOpen"
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop"
import { LightningSlashIcon } from "@phosphor-icons/react/dist/csr/LightningSlash"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { ThermometerHotIcon } from "@phosphor-icons/react/dist/csr/ThermometerHot"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash"
import { useMeasure } from "@/lib/useMeasure"
import { clock } from "@/lib/format"
import { smoothPath } from "@/lib/smooth"
import { cn } from "@/lib/utils"
import type { CanEvent, EventKind, EventTone } from "@/lib/timeline"
import { SAFE_BAND, STALE_AFTER_MS, type Reading } from "@/telemetry/types"

/* ===========================================================================
   The day, as a story.

   One line: milk temperature. Its colour IS the reading — blue while cold,
   turning amber as it nears 8 degC, red above — so the line explains itself
   without a legend. Below it, pins mark the moments that changed the story,
   worked out from the readings: when the cooler stopped, when it went warm,
   when the lid was left open. Stretches with no signal are shown as gaps,
   never bridged, because a line through a gap would be a guess.
   =========================================================================== */

const PAD = { l: 34, r: 18, t: 14 }
const PLOT_H = 190
/** Badge row + two staggered label rows. */
const LANE_H = 118
/** Labels closer than this alternate rows. */
const PIN_MIN_GAP = 104
/** Badges closer than this merge into one. */
const CLUSTER_PX = 30

const SEVERITY: Record<EventTone, number> = { risk: 4, warn: 3, neutral: 2, cool: 1, fresh: 0 }

interface Cluster {
  px: number
  /** The most serious event in the group; its icon and label represent it. */
  lead: CanEvent
  all: CanEvent[]
  row: number
  showLabel: boolean
}

const ICON: Record<EventKind, (p: { size: number; weight: "bold" }) => ReactNode> = {
  filled: (p) => <DropIcon {...p} />,
  warm: (p) => <ThermometerHotIcon {...p} />,
  safe: (p) => <CheckIcon {...p} />,
  "cooler-stopped": (p) => <WarningCircleIcon {...p} />,
  "power-out": (p) => <LightningSlashIcon {...p} />,
  "cooler-back": (p) => <SnowflakeIcon {...p} />,
  lid: (p) => <DoorOpenIcon {...p} />,
  "battery-low": (p) => <BatteryLowIcon {...p} />,
  "signal-lost": (p) => <WifiSlashIcon {...p} />,
}

const TONE: Record<EventTone, { badge: string; stroke: string }> = {
  risk: { badge: "border-risk-line bg-risk-soft text-risk", stroke: "var(--color-risk)" },
  warn: { badge: "border-warn-line bg-warn-soft text-warn", stroke: "var(--color-warn)" },
  fresh: { badge: "border-fresh-line bg-fresh-soft text-fresh", stroke: "var(--color-fresh)" },
  cool: { badge: "border-cool-line bg-cool-soft text-cool", stroke: "var(--color-cool)" },
  neutral: { badge: "border-line bg-sunk text-ink-soft", stroke: "var(--color-ink-faint)" },
}

export function DayStrip({
  history,
  events,
  now,
  rangeHours,
}: {
  history: Reading[]
  events: CanEvent[]
  /** Right edge of the chart. For a can with no signal, the gap up to now shows. */
  now: number
  /** Window in hours. `null` plots everything held. */
  rangeHours: number | null
}) {
  const { ref, width } = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<Reading | null>(null)
  const uid = useId().replace(/:/g, "")

  const start = useMemo(() => {
    if (!history.length) return now
    return rangeHours == null ? history[0].t : Math.max(history[0].t, now - rangeHours * 3600_000)
  }, [history, now, rangeHours])

  // Split into runs at signal gaps, then thin each run to keep the path light.
  const runs = useMemo(() => {
    const inWin = history.filter((r) => r.t >= start)
    const step = Math.max(1, Math.floor(inWin.length / 140))
    const out: Reading[][] = []
    let cur: Reading[] = []
    inWin.forEach((r, i) => {
      const prev = inWin[i - 1]
      if (prev && r.t - prev.t > STALE_AFTER_MS) {
        if (cur.length) out.push(cur)
        cur = []
      }
      if (i % step === 0 || i === inWin.length - 1 || (inWin[i + 1] && inWin[i + 1].t - r.t > STALE_AFTER_MS) || !prev || r.t - prev.t > STALE_AFTER_MS)
        cur.push(r)
    })
    if (cur.length) out.push(cur)
    return out
  }, [history, start])

  const all = useMemo(() => runs.flat(), [runs])

  const geom = useMemo(() => {
    if (all.length < 2 || width < 160) return null
    const innerW = width - PAD.l - PAD.r
    const temps = all.map((r) => r.milkCoreC)
    const lo = Math.min(0, Math.floor(Math.min(...temps) - 1))
    const hi = Math.max(12, Math.ceil(Math.max(...temps) + 1.5))
    const x = (t: number) => PAD.l + ((t - start) / Math.max(1, now - start)) * innerW
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * PLOT_H
    const bottom = PAD.t + PLOT_H

    const lines = runs.map((run) => {
      const pts = run.map((r) => ({ x: x(r.t), y: y(r.milkCoreC) }))
      const line = smoothPath(pts)
      const area = pts.length > 1 ? `${line}L${pts[pts.length - 1].x} ${bottom}L${pts[0].x} ${bottom}Z` : ""
      return { line, area }
    })

    // Gaps: between runs, and from the last reading up to now.
    const gaps: Array<[number, number]> = []
    for (let i = 1; i < runs.length; i++) {
      gaps.push([runs[i - 1][runs[i - 1].length - 1].t, runs[i][0].t])
    }
    const last = all[all.length - 1]
    if (now - last.t > STALE_AFTER_MS) gaps.push([last.t, now])

    return { innerW, lo, hi, x, y, bottom, lines, gaps }
  }, [all, runs, width, start, now])

  // Every event keeps its own dot on the line. Badges below are grouped when
  // events land within a badge-width of each other — the most serious one
  // speaks for the group — and labels alternate rows so they never overprint.
  const { dots, clusters } = useMemo(() => {
    if (!geom) return { dots: [], clusters: [] }
    const dots = events
      .filter((e) => e.t >= start && e.t <= now)
      .map((e) => ({ e, px: geom.x(e.t), py: geom.y(e.reading.milkCoreC) }))

    const clusters: Cluster[] = []
    for (const d of dots) {
      const c = clusters[clusters.length - 1]
      if (c && d.px - c.px < CLUSTER_PX) {
        c.all.push(d.e)
        if (SEVERITY[d.e.tone] > SEVERITY[c.lead.tone]) c.lead = d.e
      } else {
        clusters.push({ px: d.px, lead: d.e, all: [d.e], row: 0, showLabel: true })
      }
    }

    let lastLabelled = -Infinity
    let lastRow = 1
    for (const c of clusters) {
      c.row = c.px - lastLabelled < PIN_MIN_GAP ? (lastRow === 0 ? 1 : 0) : 0
      c.showLabel = c.px - lastLabelled >= PIN_MIN_GAP / 2
      if (c.showLabel) {
        lastLabelled = c.px
        lastRow = c.row
      }
    }
    return { dots, clusters }
  }, [events, geom, start, now])

  const g = geom
  const off = (v: number) => (g ? Math.max(0, Math.min(1, (v - g.lo) / (g.hi - g.lo))) : 0)
  const lastPoint = all[all.length - 1]
  const lastWarm = lastPoint ? lastPoint.milkCoreC > SAFE_BAND.max : false
  const stale = lastPoint ? now - lastPoint.t > STALE_AFTER_MS : false

  return (
    <div ref={ref} className="relative w-full" style={{ height: PAD.t + PLOT_H + LANE_H }}>
      {!g ? (
        <div className="flex h-full items-center justify-center text-[13px] text-ink-faint">
          Waiting for readings
        </div>
      ) : (
        <>
          <svg
            width={width}
            height={PAD.t + PLOT_H + LANE_H}
            className="block"
            role="img"
            aria-label={`Milk temperature from ${clock(start)} to now. ${events.length} events.`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(ev) => {
              const box = ev.currentTarget.getBoundingClientRect()
              const t = start + ((ev.clientX - box.left - PAD.l) / g.innerW) * (now - start)
              let best = all[0]
              for (const r of all) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r
              setHover(Math.abs(best.t - t) < 20 * 60_000 ? best : null)
            }}
          >
            <defs>
              {/* Colour by height: the line is blue where the milk is cold and
                  red where it is warm, wherever that happens along the day. */}
              <linearGradient
                id={`t-${uid}`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={g.y(g.lo)}
                x2="0"
                y2={g.y(g.hi)}
              >
                <stop offset="0" stopColor="#1f6c9f" />
                <stop offset={off(5.8)} stopColor="#1f6c9f" />
                <stop offset={off(7.2)} stopColor="#b37d12" />
                <stop offset={off(8.2)} stopColor="#9f2f2d" />
                <stop offset="1" stopColor="#9f2f2d" />
              </linearGradient>
              <linearGradient id={`f-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity="1" />
              </linearGradient>
              <pattern id={`h-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-line)" strokeWidth="3" />
              </pattern>
            </defs>

            {/* Too-warm zone and the two lines that matter */}
            <rect
              x={PAD.l}
              y={PAD.t}
              width={g.innerW}
              height={Math.max(0, g.y(SAFE_BAND.max) - PAD.t)}
              rx="8"
              fill="var(--color-risk-soft)"
              opacity="0.55"
            />
            <line x1={PAD.l} x2={PAD.l + g.innerW} y1={g.y(SAFE_BAND.max)} y2={g.y(SAFE_BAND.max)} stroke="var(--color-risk-line)" strokeDasharray="4 4" />
            <line x1={PAD.l} x2={PAD.l + g.innerW} y1={g.y(SAFE_BAND.min)} y2={g.y(SAFE_BAND.min)} stroke="#d8d5cf" strokeDasharray="4 4" />
            <text x={PAD.l + 10} y={g.y(SAFE_BAND.max) - 8} fontSize="11.5" fontWeight="600" fill="var(--color-risk)">
              Too warm above {SAFE_BAND.max}°
            </text>
            {[SAFE_BAND.max, SAFE_BAND.min].map((v) => (
              <text key={v} x={PAD.l - 8} y={g.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">
                {v}°
              </text>
            ))}

            {/* No-signal gaps */}
            {g.gaps.map(([a, b]) => {
              const x0 = g.x(a)
              const w = Math.max(2, g.x(b) - x0)
              return (
                <g key={a}>
                  <rect x={x0} y={PAD.t} width={w} height={PLOT_H} fill={`url(#h-${uid})`} opacity="0.9" />
                  {w > 64 ? (
                    <text x={x0 + w / 2} y={PAD.t + PLOT_H / 2} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--color-ink-faint)">
                      No signal
                    </text>
                  ) : null}
                </g>
              )
            })}

            {/* The line */}
            {g.lines.map((l, i) => (
              <g key={i}>
                {l.area ? (
                  <>
                    <path d={l.area} fill={`url(#t-${uid})`} opacity="0.16" />
                    <path d={l.area} fill={`url(#f-${uid})`} opacity="0.7" />
                  </>
                ) : null}
                <path d={l.line} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                <path d={l.line} fill="none" stroke={`url(#t-${uid})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}

            {/* Pins: connector from the moment on the line down to its badge */}
            {dots.map(({ e, px, py }) => (
              <g key={`${e.kind}-${e.t}`}>
                <line x1={px} x2={px} y1={py + 6} y2={g.bottom + 12} stroke={TONE[e.tone].stroke} strokeDasharray="2 3" opacity="0.55" />
                <circle cx={px} cy={py} r="4.5" fill={TONE[e.tone].stroke} stroke="#fff" strokeWidth="2" />
              </g>
            ))}

            {/* Latest reading */}
            {lastPoint ? (
              <g>
                {!stale ? (
                  <circle
                    cx={g.x(lastPoint.t)}
                    cy={g.y(lastPoint.milkCoreC)}
                    r="9"
                    fill={lastWarm ? "var(--color-risk)" : "var(--color-cool)"}
                    opacity="0.16"
                    className="animate-breathe"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                ) : null}
                <circle
                  cx={g.x(lastPoint.t)}
                  cy={g.y(lastPoint.milkCoreC)}
                  r="4.5"
                  fill={stale ? "var(--color-ink-faint)" : lastWarm ? "var(--color-risk)" : "var(--color-cool)"}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </g>
            ) : null}

            {/* Hover */}
            {hover ? (
              <g pointerEvents="none">
                <line x1={g.x(hover.t)} x2={g.x(hover.t)} y1={PAD.t} y2={g.bottom} stroke="var(--color-ink-faint)" opacity="0.35" />
                <circle cx={g.x(hover.t)} cy={g.y(hover.milkCoreC)} r="5" fill="var(--color-ink)" stroke="#fff" strokeWidth="2.5" />
              </g>
            ) : null}

            {/* Time: the ends, and the middle */}
            <text x={PAD.l} y={g.bottom + 16} fontSize="11" fill="var(--color-ink-faint)">
              {clock(start)}
            </text>
            {g.innerW > 360 ? (
              <text x={PAD.l + g.innerW / 2} y={g.bottom + 16} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">
                {clock(start + (now - start) / 2)}
              </text>
            ) : null}
            <text x={PAD.l + g.innerW} y={g.bottom + 16} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">
              now
            </text>
          </svg>

          {/* Badges and labels are HTML so the icons are real Phosphor glyphs. */}
          {clusters.map(({ lead, all: group, px, row, showLabel }) => (
            <div
              key={`b-${lead.kind}-${lead.t}`}
              title={group.map((e) => `${e.label}, ${clock(e.t)}`).join("\n")}
            >
              <span
                className={cn(
                  "absolute grid size-[26px] -translate-x-1/2 place-items-center rounded-lg border-[1.5px]",
                  TONE[lead.tone].badge,
                )}
                style={{ left: px, top: g.bottom + 22 }}
              >
                {ICON[lead.kind]({ size: 14, weight: "bold" })}
                {group.length > 1 ? (
                  <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-ink text-[10px] font-semibold text-canvas">
                    {group.length}
                  </span>
                ) : null}
              </span>
              {showLabel ? (
                // Labels are clamped inside the card; the badge stays on its moment.
                <span
                  className="pointer-events-none absolute -translate-x-1/2 text-center leading-tight whitespace-nowrap"
                  style={{ left: Math.max(48, Math.min(width - 48, px)), top: g.bottom + 52 + row * 30 }}
                >
                  <span className="block text-[12px] font-semibold text-ink">{lead.label}</span>
                  <span className="block text-[11px] text-ink-faint">
                    {clock(lead.t)}
                    {group.length > 1 ? ` · +${group.length - 1} more` : ""}
                  </span>
                </span>
              ) : null}
            </div>
          ))}

          {hover ? (
            <div
              className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] whitespace-nowrap shadow-[0_2px_8px_rgba(38,36,31,0.06)]"
              style={{ left: Math.max(70, Math.min(width - 70, g.x(hover.t))) }}
            >
              <span className="font-semibold text-ink">{hover.milkCoreC.toFixed(1)}°C</span>
              <span className="ml-2 text-ink-faint">{clock(hover.t)}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
