import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { placeName } from "@/lib/format"
import { rosterNote } from "@/lib/story"
import { STATUS_META } from "@/components/chrome/Primitives"
import { sortCans } from "@/lib/fleet"
import type { CanNode } from "@/telemetry/types"

/**
 * The can list, for a phone. Same order and same words as the desktop roster,
 * laid out as cards you swipe sideways so the selected can's detail gets the
 * whole screen below.
 */
export function CanStrip({
  nodes,
  selectedId,
  onSelect,
  litresSafe,
  litresTotal,
}: {
  nodes: CanNode[]
  selectedId: string
  onSelect: (id: string) => void
  litresSafe: number
  litresTotal: number
}) {
  const scroller = useRef<HTMLDivElement | null>(null)

  // Keep the selected card in view without moving the page vertically.
  useEffect(() => {
    const box = scroller.current
    const el = box?.querySelector<HTMLElement>(`[data-can="${selectedId}"]`)
    if (!box || !el) return
    const left = el.offsetLeft - 16
    if (left < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth)
      box.scrollTo({ left, behavior: "smooth" })
  }, [selectedId])

  return (
    <div className="border-b border-line bg-canvas/95 backdrop-blur-md">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <span className="t-title text-[14px] text-ink">Your cans</span>
        <span className="text-[12.5px] text-ink-faint">
          <span className="font-semibold text-ink">{Math.round(litresSafe)}</span> of{" "}
          {Math.round(litresTotal)} L still cold
        </span>
      </div>
      <div
        ref={scroller}
        role="listbox"
        aria-label="Your cans"
        className="relative flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pt-2.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sortCans(nodes).map((n) => {
          const meta = STATUS_META[n.derived.status]
          const selected = n.id === selectedId
          const tooWarm = n.derived.status === "breach"
          const offline = n.derived.status === "offline"
          return (
            <button
              key={n.id}
              data-can={n.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(n.id)}
              className={cn(
                "relative w-[152px] shrink-0 snap-start overflow-hidden rounded-xl border bg-surface py-2.5 pr-3 pl-4 text-left transition-[border-color,box-shadow] duration-200",
                selected ? "border-ink/30 shadow-[0_2px_8px_rgba(38,36,31,0.06)]" : "border-line",
              )}
            >
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", meta.dot)} />
              <span className="flex items-baseline justify-between gap-2">
                <span className="t-title text-[13px] text-ink">{n.id}</span>
                <span
                  className={cn(
                    "t-display text-[19px]",
                    offline ? "text-ink-faint" : tooWarm ? "text-risk" : "text-ink",
                  )}
                >
                  {n.reading.milkCoreC.toFixed(1)}
                </span>
              </span>
              <span className="block truncate text-[11.5px] text-ink-faint">{placeName(n.route)}</span>
              <span className={cn("block truncate text-[12px] font-medium", meta.text)}>{rosterNote(n)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
