import { useEffect, useState } from "react"
import { BroadcastIcon } from "@phosphor-icons/react/dist/csr/Broadcast"
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { clockIST } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CanNode } from "@/telemetry/types"

/**
 * Masthead. One headline sentence about the whole fleet, and the provenance
 * note. The tally row is gone — five numbers about counts is exactly the kind
 * of density this audience does not want.
 */
export function HeaderBar({
  nodes,
  isLive,
}: {
  nodes: CanNode[]
  isLive: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const h = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(h)
  }, [])

  const breach = nodes.filter((n) => n.derived.status === "breach").length
  const watch = nodes.filter((n) => n.derived.status === "watch").length

  // One sentence, in the seller's terms.
  const headline =
    breach > 0
      ? `${breach} can${breach > 1 ? "s" : ""} too warm`
      : watch > 0
        ? `${watch} can${watch > 1 ? "s" : ""} to keep an eye on`
        : "All your milk is cold"

  const tone = breach > 0 ? "text-risk" : watch > 0 ? "text-warn" : "text-fresh"

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-cool-soft text-cool"
            >
              <SnowflakeIcon size={17} weight="bold" />
            </span>
            <span className="t-title text-[19px] text-ink">ChillCan</span>
          </span>
          <span className={cn("t-title text-[15px]", tone)}>{headline}</span>
        </div>

        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 text-[12.5px] text-ink-faint">
            {isLive ? (
              <BroadcastIcon size={15} weight="bold" className="shrink-0 animate-breathe text-fresh" />
            ) : (
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-ink-faint/50" />
            )}
            {isLive ? "Live from your cans" : "Demo data"}
          </span>
          <time className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
            <ClockIcon size={15} weight="bold" className="shrink-0 opacity-70" />
            <span className="tnum">{clockIST(now)}</span>
          </time>
        </div>
      </div>
    </header>
  )
}
