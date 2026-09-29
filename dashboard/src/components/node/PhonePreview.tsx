import { ChecksIcon } from "@phosphor-icons/react/dist/csr/Checks"
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { motion, useReducedMotion } from "motion/react"
import { Card } from "@/components/chrome/Primitives"
import { cn } from "@/lib/utils"
import { clock } from "@/lib/format"
import { eventMessage, personName } from "@/lib/story"
import type { CanEvent, EventTone } from "@/lib/timeline"
import type { CanNode } from "@/telemetry/types"

/*
  What the seller actually receives. The dashboard is for whoever is looking
  at it; the text message is for the person standing next to the can, who may
  never open the dashboard at all. Showing both side by side makes the point
  that the product works for someone with a basic phone.

  Messages come from the same events that put pins on the day strip, so the
  two can never tell different stories.
*/

export interface SentAlert {
  t: number
  text: string
}

interface Msg {
  key: string
  t: number
  text: string
  tone: EventTone | "manual"
}

const MAX_SHOWN = 3

export function PhonePreview({
  node,
  events,
  sent,
}: {
  node: CanNode
  events: CanEvent[]
  sent: SentAlert[]
}) {
  const reduce = useReducedMotion()

  const msgs: Msg[] = [
    ...events.flatMap((e): Msg[] => {
      const text = eventMessage(node, e)
      return text ? [{ key: `${e.kind}-${e.t}`, t: e.t, text, tone: e.tone }] : []
    }),
    ...sent.map((s) => ({ key: `m-${s.t}`, t: s.t, text: s.text, tone: "manual" as const })),
  ]
    .sort((a, b) => a.t - b.t)
    .slice(-MAX_SHOWN)

  if (!msgs.length) {
    const t = node.filledAt ?? node.history[0]?.t ?? node.reading.t
    msgs.push({
      key: "quiet",
      t,
      text: `${node.id} is cold and safe. We will message you if anything changes.`,
      tone: "cool",
    })
  }

  return (
    <Card
      title={`On ${personName(node)}'s phone`}
      hint="Text alerts, sent automatically"
      icon={<DeviceMobileIcon size={17} weight="bold" />}
    >
      <div className="px-5 pb-5">
        <div className="mx-auto w-full max-w-[272px] overflow-hidden rounded-[30px] border-[7px] border-ink bg-[#efeae2]">
          <div className="flex items-center gap-2.5 border-b border-line bg-surface px-3.5 py-2.5">
            <span aria-hidden className="grid size-7 place-items-center rounded-full bg-cool-soft text-cool">
              <SnowflakeIcon size={14} weight="bold" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[12.5px] font-semibold text-ink">ChillCan</div>
              <div className="truncate text-[11px] text-ink-faint">{node.trip?.centre ?? node.id}</div>
            </div>
          </div>

          <div className="flex min-h-[208px] flex-col justify-end gap-2.5 px-3 py-3" aria-live="polite">
            {msgs.map((m) => (
              <motion.div
                key={m.key}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "rounded-[4px_12px_12px_12px] bg-surface px-2.5 pt-2 pb-1.5 text-[12.5px] leading-[1.45] text-ink shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
                  m.tone === "risk" && "border-l-[3px] border-risk",
                  m.tone === "warn" && "border-l-[3px] border-warn-line",
                  m.tone === "manual" && "border-l-[3px] border-ink",
                )}
              >
                {m.tone === "manual" ? (
                  <span className="mb-0.5 block text-[11px] font-semibold text-ink-soft">From the dairy</span>
                ) : null}
                {m.text}
                <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-ink-faint">
                  {clock(m.t)}
                  <ChecksIcon size={13} weight="bold" className="text-cool" aria-label="delivered" />
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
