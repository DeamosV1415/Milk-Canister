import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight"
import { cn } from "@/lib/utils"
import { duration, placeName } from "@/lib/format"
import { MicroTrace } from "@/components/charts/MicroTrace"
import { STATUS_META } from "@/components/chrome/Primitives"
import { SAFE_BAND, type CanNode, type NodeStatus } from "@/telemetry/types"

/**
 * The cans, worst first. A seller scans down and stops when it goes quiet.
 * Structure is unchanged from the tactical version — it worked — but the row
 * now leads with the temperature and says what to do about it in words.
 */
const RANK: Record<NodeStatus, number> = { breach: 0, offline: 1, watch: 2, nominal: 3 }

export function FleetRoster({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: CanNode[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const sorted = [...nodes].sort((a, b) => {
    const r = RANK[a.derived.status] - RANK[b.derived.status]
    return r !== 0 ? r : a.derived.coldLifeMin - b.derived.coldLifeMin
  })

  return (
    <ul className="flex flex-col gap-2 px-3 pb-3" role="listbox" aria-label="Your cans">
      {sorted.map((n) => {
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
              {/* Status stripe. Colour plus the word below — never colour alone. */}
              <span aria-hidden className={cn("h-9 w-1 shrink-0 rounded-full", meta.dot)} />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="t-title shrink-0 text-[14px] text-ink">{n.id}</span>
                  <span className="min-w-0 truncate text-[12px] text-ink-faint">
                    {placeName(n.route)}
                  </span>
                </span>
                <span className={cn("truncate text-[12.5px]", meta.text)}>
                  {offline
                    ? "No signal"
                    : tooWarm
                      ? "Too warm now"
                      : `Cold for ${duration(n.derived.coldLifeMin).toLowerCase()}`}
                </span>
              </span>

              <MicroTrace
                values={n.history.slice(-40).map((r) => r.milkCoreC)}
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
