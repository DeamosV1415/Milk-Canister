import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight"
import { cn } from "@/lib/utils"
import { placeName } from "@/lib/format"
import { rosterNote } from "@/lib/story"
import { MicroTrace } from "@/components/charts/MicroTrace"
import { STATUS_META } from "@/components/chrome/Primitives"
import { sortCans } from "@/lib/fleet"
import { SAFE_BAND, type CanNode } from "@/telemetry/types"

/**
 * The cans, worst first. Each row leads with the temperature and says what is
 * going on in words.
 */
export function FleetRoster({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: CanNode[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <ul className="flex flex-col gap-2 px-3 pb-3" role="listbox" aria-label="Your cans">
      {sortCans(nodes).map((n) => {
        const meta = STATUS_META[n.derived.status]
        const selected = n.id === selectedId
        const offline = n.derived.status === "offline"
        const tooWarm = n.derived.status === "breach"

        return (
          <li key={n.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(n.id)}
              className={cn(
                "lift group flex w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-left",
                selected
                  ? "border-ink/25 bg-surface shadow-[0_2px_8px_rgba(38,36,31,0.05)]"
                  : "border-line bg-surface hover:border-ink/15",
              )}
            >
              {/* Status stripe. Colour plus the words beside it — never colour alone. */}
              <span aria-hidden className={cn("h-9 w-1 shrink-0 rounded-full", meta.dot)} />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="t-title shrink-0 text-[14px] text-ink">{n.id}</span>
                  <span className="min-w-0 truncate text-[12px] text-ink-faint">
                    {placeName(n.route)}
                  </span>
                </span>
                <span className={cn("truncate text-[12.5px]", meta.text)}>{rosterNote(n)}</span>
              </span>

              <MicroTrace
                values={n.history.slice(-60).map((r) => r.milkCoreC)}
                width={40}
                height={22}
                ceiling={SAFE_BAND.max}
                className={offline ? "opacity-30" : "opacity-100"}
              />

              <span className="flex w-11 shrink-0 flex-col items-end">
                <span
                  className={cn(
                    "t-display text-[20px]",
                    offline ? "text-ink-faint" : tooWarm ? "text-risk" : "text-ink",
                  )}
                >
                  {n.reading.milkCoreC.toFixed(1)}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {offline ? "old" : `${n.reading.fillL.toFixed(0)} L`}
                </span>
              </span>

              <CaretRightIcon
                size={15}
                weight="bold"
                aria-hidden
                className={cn(
                  "shrink-0 transition-opacity",
                  selected ? "text-ink opacity-70" : "text-ink-faint opacity-0 group-hover:opacity-60",
                )}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
