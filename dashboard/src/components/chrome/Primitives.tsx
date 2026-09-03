import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { NodeStatus } from "@/telemetry/types"

/* ===========================================================================
   Primitives.

   One container (the card), one status treatment, one readout. The audience
   is a milk seller checking on a can, so every string here is something they
   would actually say out loud.
   =========================================================================== */

export function Card({
  title,
  hint,
  icon,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  hint?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("card flex min-h-0 flex-col overflow-hidden", className)}>
      {title ? (
        <header className="flex shrink-0 items-center justify-between gap-4 px-5 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-sunk text-ink-soft"
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="t-title text-[15px] text-ink">{title}</h2>
              {hint ? <p className="t-label mt-0.5">{hint}</p> : null}
            </div>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}

/**
 * Status in the seller's words, not the engineer's.
 *
 * Colour never carries the meaning on its own — every state ships a word and
 * a shape, so it still reads on a cheap phone screen in sunlight.
 */
export const STATUS_META: Record<
  NodeStatus,
  {
    word: string
    /** What it means for the person holding the can. */
    plain: string
    pill: string
    dot: string
    text: string
    tint: string
    line: string
  }
> = {
  nominal: {
    word: "Safe",
    plain: "Milk is cold and good",
    pill: "bg-fresh-soft text-fresh",
    dot: "bg-fresh",
    text: "text-fresh",
    tint: "bg-fresh-soft",
    line: "border-fresh-line",
  },
  watch: {
    word: "Keep an eye",
    plain: "Getting close to warm",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
    text: "text-warn",
    tint: "bg-warn-soft",
    line: "border-warn-line",
  },
  breach: {
    word: "Too warm",
    plain: "Sell or chill this now",
    pill: "bg-risk-soft text-risk",
    dot: "bg-risk",
    text: "text-risk",
    tint: "bg-risk-soft",
    line: "border-risk-line",
  },
  offline: {
    word: "No signal",
    plain: "Last known reading",
    pill: "bg-sunk text-ink-soft",
    dot: "bg-ink-faint",
    text: "text-ink-soft",
    tint: "bg-sunk",
    line: "border-line",
  },
}

export function StatusPill({
  status,
  className,
}: {
  status: NodeStatus
  className?: string
}) {
  const m = STATUS_META[status]
  return (
    <span className={cn("pill", m.pill, className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", m.dot)} />
      {m.word}
    </span>
  )
}

/** A number with a plain-language label above it. */
export function Readout({
  label,
  icon,
  value,
  unit,
  sub,
  tone,
  size = "md",
  className,
}: {
  label: string
  icon?: ReactNode
  value: ReactNode
  unit?: string
  sub?: ReactNode
  tone?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const scale = {
    sm: "text-[24px]",
    md: "text-[34px]",
    lg: "text-[clamp(3.5rem,8vw,5rem)]",
  }[size]

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="t-label flex items-center gap-1.5">
        {icon ? (
          <span aria-hidden className="shrink-0 opacity-70">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <output className={cn("t-display text-ink", scale, tone)}>{value}</output>
        {unit ? (
          <span className={cn("text-[15px] font-medium text-ink-faint", tone)}>{unit}</span>
        ) : null}
      </div>
      {sub ? <div className="text-[13px] leading-snug text-ink-soft">{sub}</div> : null}
    </div>
  )
}

/**
 * A rounded progress track. Reads as "how much is left", which is the only
 * question a seller asks of a cooling pack or a countdown.
 */
export function Meter({
  frac,
  tone = "bg-cool",
  className,
}: {
  frac: number
  tone?: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, frac)) * 100
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-sunk", className)} aria-hidden>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
