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
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
          {/* Takes the row, but the `right` slot wraps below before this does. */}
          <div className="flex min-w-[min(100%,210px)] flex-1 items-center gap-2.5">
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
