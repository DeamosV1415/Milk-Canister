import { BroadcastIcon } from "@phosphor-icons/react/dist/csr/Broadcast"
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { clock } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CanNode } from "@/telemetry/types"

/**
 * Masthead. One sentence about the whole fleet, the data's provenance, and the
 * time. The clock shows the feed's time, not the laptop's — in the demo the
 * simulation runs an hour a minute, and a clock that disagreed with every
 * timestamp on the page would be the first thing a judge noticed.
 */
export function HeaderBar({
  nodes,
  isLive,
  now,
}: {
  nodes: CanNode[]
  isLive: boolean
  now: number
}) {
  const count = (s: string) => nodes.filter((n) => n.derived.status === s).length
  const breach = count("breach")
  const watch = count("watch")
  const offline = count("offline")

  const parts: string[] = []
  if (breach) parts.push(`${breach} can${breach > 1 ? "s" : ""} too warm`)
  if (watch) parts.push(`${watch} to keep an eye on`)
  if (offline) parts.push(`${offline} not reporting`)
  const headline = breach || watch ? parts.join(" · ") : offline ? `Milk is cold · ${parts.join("")}` : "All your milk is cold"
  const tone = breach ? "text-risk" : watch ? "text-warn" : "text-fresh"

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1.5 px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-cool-soft text-cool">
              <SnowflakeIcon size={17} weight="bold" />
            </span>
            <span className="t-title text-[19px] text-ink">ChillCan</span>
          </span>
          <span className={cn("t-title text-[14px] lg:text-[15px]", tone)}>{headline}</span>
        </div>

        <div className="flex items-center gap-4 lg:gap-5">
          <span className="flex items-center gap-2 text-[12.5px] text-ink-faint">
            {isLive ? (
              <BroadcastIcon size={15} weight="bold" className="animate-breathe shrink-0 text-fresh" />
            ) : (
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-ink-faint/50" />
            )}
            {isLive ? "Live from your cans" : "Demo data"}
          </span>
          <time className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
            <ClockIcon size={15} weight="bold" className="shrink-0 opacity-70" />
            <span className="tnum">{clock(now)}</span>
          </time>
        </div>
      </div>
    </header>
  )
}
