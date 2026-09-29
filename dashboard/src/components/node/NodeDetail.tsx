import { useMemo, useState, type ReactNode } from "react"
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check"
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock"
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt"
import { WifiHighIcon } from "@phosphor-icons/react/dist/csr/WifiHigh"
import { WifiLowIcon } from "@phosphor-icons/react/dist/csr/WifiLow"
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash"
import { motion, useReducedMotion } from "motion/react"
import { Card } from "@/components/chrome/Primitives"
import { Segmented } from "@/components/chrome/Controls"
import { DayStrip } from "@/components/charts/DayStrip"
import { FreshnessMeter } from "@/components/charts/FreshnessMeter"
import { AlertBanner } from "./AlertBanner"
import { HeroStage } from "./HeroStage"
import { PhonePreview, type SentAlert } from "./PhonePreview"
import { TripCard } from "./TripCard"
import { cn } from "@/lib/utils"
import { clockDay } from "@/lib/format"
import { personName } from "@/lib/story"
import { timeline } from "@/lib/timeline"
import type { CanNode } from "@/telemetry/types"

/*
  The selected can.

  Order is the order of questions a seller asks: is it OK (hero), will it get
  there (trip), what happened (today), what will I be paid (freshness), and
  what did my phone tell me (alerts). Engineering numbers — heat ingress,
  fitted UA, RSSI in dBm — stay out.
*/

type Range = "1h" | "3h" | "all"
const RANGE_HOURS: Record<Range, number | null> = { "1h": 1, "3h": 3, all: null }

/** A manual alert counts as "sent" for this long, then the button comes back. */
const ALERT_COOLDOWN_MS = 30 * 60_000

export function NodeDetail({
  node,
  now,
  sent,
  onAlert,
}: {
  node: CanNode
  now: number
  sent: SentAlert[]
  onAlert: () => void
}) {
  const [range, setRange] = useState<Range>("all")
  const events = useMemo(() => timeline(node), [node])

  const status = node.derived.status
  const tooWarm = status === "breach"
  const offline = status === "offline"

  // At most one action, and only when there is something to act on.
  const needsAction = tooWarm || status === "watch"
  const justSent = sent.some((s) => now - s.t < ALERT_COOLDOWN_MS)
  const action = needsAction ? (
    <AlertAction name={personName(node)} sent={justSent} onClick={onAlert} onDark={tooWarm} />
  ) : null

  return (
    <div
      id="detail-scroll"
      className="flex flex-col gap-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-5"
    >
      {tooWarm ? <AlertBanner node={node} action={action} /> : null}

      {offline ? (
        <p className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-sunk px-4 py-3 text-[13px] text-ink-soft">
          <WifiSlashIcon size={17} weight="bold" className="shrink-0" />
          This can has not reported since {clockDay(node.reading.t, now)}. Everything below is
          the last thing it told us, not what is happening now.
        </p>
      ) : null}

      <Reveal delay={0}>
        <HeroStage node={node} now={now} events={events} action={tooWarm ? null : action} />
      </Reveal>

      <div className="grid shrink-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Reveal delay={0.05}>
            <TripCard node={node} now={now} />
          </Reveal>
          <Reveal delay={0.1}>
            <Card
              title="Today"
              hint="Milk temperature, and what happened"
              icon={<ClockIcon size={17} weight="bold" />}
              right={
                <Segmented
                  ariaLabel="Time range"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "1h", label: "1h" },
                    { value: "3h", label: "3h" },
                    { value: "all", label: "Today" },
                  ]}
                />
              }
              bodyClassName="px-2 pb-1"
            >
              <DayStrip
                history={node.history}
                events={events}
                now={now}
                rangeHours={RANGE_HOURS[range]}
              />
            </Card>
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Reveal delay={0.08}>
            <Card
              title="How fresh is it"
              hint="Sets the price you are paid"
              icon={<DropIcon size={17} weight="fill" />}
            >
              <FreshnessMeter node={node} />
            </Card>
          </Reveal>
          <Reveal delay={0.12}>
            <PhonePreview node={node} events={events} sent={sent} />
          </Reveal>
        </div>
      </div>

      <DeviceStrip node={node} now={now} />
    </div>
  )
}

function AlertAction({
  name,
  sent,
  onClick,
  onDark,
}: {
  name: string
  sent: boolean
  onClick: () => void
  onDark: boolean
}) {
  if (sent)
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold",
          onDark ? "bg-white/15 text-white" : "bg-fresh-soft text-fresh",
        )}
      >
        <CheckIcon size={16} weight="bold" />
        Alert sent to {name}
      </span>
    )
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold",
        "transition-[background-color,transform] duration-150 active:scale-[0.98]",
        onDark ? "bg-white text-risk hover:bg-white/90" : "bg-ink text-canvas hover:bg-ink/90",
      )}
    >
      <PaperPlaneTiltIcon size={16} weight="bold" />
      Alert {name}
    </button>
  )
}

/**
 * Staggered entry for the main blocks, on mount only. Motion rather than
 * react-bits' AnimatedContent: that one is GSAP + ScrollTrigger (+60 kB gzip)
 * and leaves children invisible until a scroll trigger fires.
 */
function Reveal({ children, delay }: { children: ReactNode; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="min-w-0 shrink-0"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** The sensor itself: is it talking to us, and how well. */
function DeviceStrip({ node, now }: { node: CanNode; now: number }) {
  const { reading, derived } = node
  const offline = derived.status === "offline"
  const rssi = reading.rssiDbm
  const signal = offline ? "none" : rssi > -70 ? "good" : rssi > -85 ? "weak" : "poor"
  const Icon = signal === "none" ? WifiSlashIcon : signal === "good" ? WifiHighIcon : WifiLowIcon

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-[12.5px]",
        offline ? "border-warn-line bg-warn-soft" : "border-line bg-sunk",
      )}
    >
      <span className={cn("flex items-center gap-2", offline ? "font-medium text-warn" : "text-ink-soft")}>
        <Icon size={17} weight="bold" className="shrink-0" />
        {signal === "none" ? "Not reporting right now" : `Signal ${signal}`}
      </span>
      <span className="text-ink-faint">Last reading {clockDay(reading.t, now)}</span>
    </div>
  )
}
