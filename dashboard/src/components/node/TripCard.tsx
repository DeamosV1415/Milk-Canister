import type { ReactNode } from "react"
import { LightningSlashIcon } from "@phosphor-icons/react/dist/csr/LightningSlash"
import { TruckIcon } from "@phosphor-icons/react/dist/csr/Truck"
import { Card } from "@/components/chrome/Primitives"
import { cn } from "@/lib/utils"
import { clock, clockDay, duration } from "@/lib/format"
import { SAFE_BAND, type CanNode } from "@/telemetry/types"

/*
  The question a seller actually asks: will it still be cold when the truck
  comes? So instead of "stays cold for 7h 20m" as a bare number, the two times
  that matter — pickup, and the moment it goes warm — sit on one line, and the
  answer is written above it.
*/

type Tone = "fresh" | "warn" | "risk" | "neutral"

const TONE_TEXT: Record<Tone, string> = {
  fresh: "text-fresh",
  warn: "text-warn",
  risk: "text-risk",
  neutral: "text-ink-soft",
}

export function TripCard({ node, now }: { node: CanNode; now: number }) {
  const { trip, derived: d, reading: r } = node
  if (!trip) return null

  const offline = d.status === "offline"
  const tooWarm = d.status === "breach"
  const pickupAt = trip.pickupAt
  const pickupInMin = Math.max(0, (pickupAt - now) / 60_000)
  const safeUntil = Number.isFinite(d.coldLifeMin) ? now + d.coldLifeMin * 60_000 : null
  const coolerWorking = r.cooler === "on" || r.cooler === "idle"
  const powerOut =
    coolerWorking && Number.isFinite(d.powerLeftMin) ? now + d.powerLeftMin * 60_000 : null

  // ---- The answer ---------------------------------------------------------
  let tone: Tone
  let title: string
  let detail: string
  if (offline) {
    tone = "neutral"
    title = "Can't tell until it reports"
    detail = `No signal since ${clockDay(r.t, now)}.`
  } else if (tooWarm) {
    tone = "risk"
    title = "Won't reach the dairy cold"
    detail = `It is already too warm. Selling it now beats waiting ${duration(pickupInMin)} for pickup.`
  } else if (safeUntil == null || safeUntil >= pickupAt) {
    const spare = safeUntil == null ? Infinity : (safeUntil - pickupAt) / 60_000
    tone = spare < 60 ? "warn" : "fresh"
    title = spare < 60 ? "Only just makes it" : "Reaches the dairy cold"
    detail =
      safeUntil == null
        ? "Stays cold well past pickup."
        : `${duration(spare)} to spare after pickup.`
  } else {
    tone = "risk"
    title = "Won't reach the dairy cold"
    detail = `Goes above ${SAFE_BAND.max}°C at ${clockDay(safeUntil, now)}, ${duration(
      (pickupAt - safeUntil) / 60_000,
    )} before pickup.`
  }
  const powerNote =
    !tooWarm && !offline && powerOut != null && powerOut < pickupAt
      ? `Battery runs out at ${clockDay(powerOut, now)}, and cooling stops then.`
      : null

  // ---- The line -----------------------------------------------------------
  // Pickup sits a little past the middle, so there is room to show what
  // happens after it.
  const end = now + Math.max(pickupAt - now, 30 * 60_000) * 1.6
  const pos = (t: number) => Math.max(0, Math.min(1, (t - now) / (end - now)))
  const coldTo = tooWarm ? 0 : safeUntil == null || offline ? 1 : pos(safeUntil)
  const pPickup = pos(pickupAt)
  // An offline can's projection is a guess from an old reading — don't plot it.
  const pSafe = safeUntil != null && !tooWarm && !offline && safeUntil < end ? pos(safeUntil) : null
  // After pickup the dairy charges the battery, so only a run-out before then matters.
  const pPower = powerOut != null && powerOut < pickupAt && !tooWarm && !offline ? pos(powerOut) : null
  // When the safe-until mark would sit on top of the pickup label, lift it above the line.
  const safeAbove = pSafe != null && Math.abs(pSafe - pPickup) < 0.2

  return (
    <Card
      title={`Trip to ${trip.centre}`}
      hint={`Pickup at ${clockDay(pickupAt, now)}`}
      icon={<TruckIcon size={17} weight="bold" />}
    >
      <div className="px-5 pb-6">
        <p className={cn("t-title text-[22px] lg:text-[24px]", TONE_TEXT[tone])}>{title}</p>
        <p className="text-[13px] text-ink-soft">{detail}</p>
        {powerNote ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1 text-[12.5px] text-warn">
            <LightningSlashIcon size={14} weight="bold" aria-hidden />
            {powerNote}
          </p>
        ) : null}

        <div className={cn("relative mx-2 h-2.5", safeAbove ? "mt-12" : "mt-7", "mb-12")}>
          {/* Cold stretch */}
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", offline ? "bg-line" : "bg-fresh-line")}
            style={{ width: `${coldTo * 100}%` }}
          />
          {/* Warm stretch */}
          {coldTo < 1 ? (
            <div
              className="absolute inset-y-0 right-0 rounded-full"
              style={{
                left: `${coldTo * 100}%`,
                background: offline
                  ? "var(--color-line)"
                  : "repeating-linear-gradient(90deg, var(--color-risk-line) 0 10px, transparent 10px 16px)",
              }}
            />
          ) : null}

          {/* Now */}
          <span
            className={cn(
              "absolute top-1/2 left-0 size-[18px] -translate-y-1/2 rounded-full border-[3px] border-surface shadow-[0_1px_4px_rgba(38,36,31,0.2)]",
              offline ? "bg-ink-faint" : tooWarm ? "bg-risk" : "bg-cool",
            )}
            style={{ marginLeft: -4 }}
          />
          <Label at={0} align="start">
            <b>Now</b>
            {clock(now)}
            {offline ? "" : ` · ${r.milkCoreC.toFixed(1)}°`}
          </Label>

          {/* Safe until */}
          {pSafe != null ? (
            <>
              <span
                className="absolute top-1/2 h-[18px] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fresh"
                style={{ left: `${pSafe * 100}%` }}
              />
              <Label at={pSafe} align={pSafe > 0.85 ? "end" : "center"} above={safeAbove}>
                <b>Safe until</b>
                {clockDay(safeUntil!, now)}
              </Label>
            </>
          ) : null}

          {/* Battery runs out */}
          {pPower != null ? (
            <span
              className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-warn-line bg-warn-soft text-warn"
              style={{ left: `${pPower * 100}%` }}
              title="Battery runs out"
            >
              <LightningSlashIcon size={11} weight="bold" />
            </span>
          ) : null}

          {/* Pickup */}
          <span
            className="absolute top-1/2 grid size-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[9px] border-[1.5px] border-ink bg-surface text-ink"
            style={{ left: `${pPickup * 100}%` }}
          >
            <TruckIcon size={16} weight="fill" />
          </span>
          <Label at={pPickup} align="center" offset={24}>
            <b>Pickup</b>
            {clock(pickupAt)}
          </Label>
        </div>
      </div>
    </Card>
  )
}

function Label({
  at,
  align,
  above,
  offset = 18,
  children,
}: {
  at: number
  align: "start" | "center" | "end"
  above?: boolean
  offset?: number
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "absolute text-[12px] leading-[1.35] whitespace-nowrap text-ink-faint [&>b]:block [&>b]:text-[12.5px] [&>b]:font-semibold [&>b]:text-ink",
        align === "center" && "-translate-x-1/2 text-center",
        align === "end" && "-translate-x-full text-right",
      )}
      style={{
        left: `${at * 100}%`,
        ...(above ? { bottom: offset } : { top: offset }),
      }}
    >
      {children}
    </span>
  )
}
