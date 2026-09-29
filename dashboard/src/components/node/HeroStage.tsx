import type { ReactNode } from "react"
import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown"
import { ArrowUpIcon } from "@phosphor-icons/react/dist/csr/ArrowUp"
import { BatteryEmptyIcon } from "@phosphor-icons/react/dist/csr/BatteryEmpty"
import { BatteryHighIcon } from "@phosphor-icons/react/dist/csr/BatteryHigh"
import { BatteryLowIcon } from "@phosphor-icons/react/dist/csr/BatteryLow"
import { BatteryMediumIcon } from "@phosphor-icons/react/dist/csr/BatteryMedium"
import { DoorOpenIcon } from "@phosphor-icons/react/dist/csr/DoorOpen"
import { LightningSlashIcon } from "@phosphor-icons/react/dist/csr/LightningSlash"
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin"
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus"
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { STATUS_META, StatusPill } from "@/components/chrome/Primitives"
import { CanIllustration } from "./CanIllustration"
import { cn } from "@/lib/utils"
import { duration, placeName, titleCase } from "@/lib/format"
import { headline } from "@/lib/story"
import type { CanEvent } from "@/lib/timeline"
import { SAFE_BAND, type CanNode } from "@/telemetry/types"

/*
  The selected can, as one scene: the verdict in a sentence on the left, the
  can itself on the right, and four plain facts along the bottom. The panel's
  own light follows the milk — cool when it is cold, warm when it is not — so
  the state reads before a single word does.
*/

const BACKDROP: Record<CanNode["derived"]["status"], string> = {
  nominal:
    "radial-gradient(55% 80% at 82% 45%, rgba(157,201,230,.30), transparent 70%), radial-gradient(40% 60% at 0% 100%, rgba(237,243,236,.8), transparent 70%)",
  watch:
    "radial-gradient(55% 80% at 82% 45%, rgba(224,195,128,.22), transparent 70%), radial-gradient(40% 60% at 0% 100%, rgba(251,243,219,.7), transparent 70%)",
  breach:
    "radial-gradient(60% 90% at 100% 0%, rgba(242,184,162,.30), transparent 70%), radial-gradient(50% 70% at 0% 100%, rgba(251,243,219,.6), transparent 70%)",
  offline: "radial-gradient(55% 80% at 82% 45%, rgba(234,234,231,.7), transparent 70%)",
}

export function HeroStage({
  node,
  now,
  events,
  action,
}: {
  node: CanNode
  now: number
  events: CanEvent[]
  action?: ReactNode
}) {
  const { reading: r, derived: d, spec } = node
  const meta = STATUS_META[d.status]
  const h = headline(node, now, events)
  const offline = d.status === "offline"
  const tooWarm = d.status === "breach"

  return (
    <section
      className={cn(
        "card relative grid shrink-0 overflow-hidden",
        "grid-cols-[auto_1fr] [grid-template-areas:'head_head'_'temp_can'_'chips_chips']",
        // Side-by-side only when the pane is wide enough for both to breathe.
        "xl:grid-cols-[1fr_minmax(300px,400px)] xl:[grid-template-areas:'head_can'_'temp_can'_'chips_can']",
        d.status === "watch" && "mood-watch",
      )}
      style={{ background: `${BACKDROP[d.status]}, var(--color-surface)` }}
    >
      {/* ---- The verdict --------------------------------------------------- */}
      <div className="flex min-w-0 flex-col px-5 pt-5 [grid-area:head] xl:px-7 xl:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="t-title text-[22px] text-ink">{node.id}</h1>
            <StatusPill status={d.status} />
          </div>
          {/* Wide: the action sits top-right. Narrow: it follows the sentence
              that explains it (below), rather than wrapping in above the place. */}
          {action ? <div className="hidden sm:block">{action}</div> : null}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
          <MapPinIcon size={15} weight="fill" className="shrink-0 opacity-60" />
          {placeName(node.route)}
          <span className="text-ink-faint">·</span>
          {titleCase(node.operator)}
        </p>

        <h2 className={cn("t-title mt-5 text-[24px] lg:text-[28px] xl:mt-6 xl:text-[30px]", meta.text)}>{h.title}</h2>
        <p className="mt-1 max-w-[52ch] text-[14px] text-ink-soft">{h.detail}</p>
        {action ? <div className="mt-4 sm:hidden">{action}</div> : null}
      </div>

      {/* ---- The number ---------------------------------------------------- */}
      <div className="flex flex-col justify-center px-5 pt-2 [grid-area:temp] xl:flex-row xl:items-end xl:justify-start xl:gap-5 xl:px-7 xl:pt-5">
        <div className="flex items-baseline">
          <output
            className={cn(
              "t-display text-[64px] lg:text-[88px] xl:text-[104px]",
              offline ? "text-ink-faint" : tooWarm ? "text-risk" : "text-ink",
            )}
          >
            {r.milkCoreC.toFixed(1)}
          </output>
          <span className="t-display ml-1 text-[20px] text-ink-faint lg:text-[26px] xl:text-[30px]">°C</span>
        </div>
        <div className="pb-1 xl:pb-3">
          {offline ? (
            <p className="text-[13px] text-ink-faint">Last reading</p>
          ) : (
            <Trend perHour={d.trendPerHour} warm={tooWarm || d.status === "watch"} />
          )}
          <p className="t-label">
            Should be {SAFE_BAND.min} to {SAFE_BAND.max}°C
          </p>
        </div>
      </div>

      {/* ---- The can -------------------------------------------------------- */}
      <div className="flex items-center justify-center pr-2 [grid-area:can] xl:px-4 xl:pt-4">
        <CanIllustration
          tempC={r.milkCoreC}
          fillFrac={r.fillL / spec.capacityL}
          cooler={r.cooler}
          lidOpen={r.lid === "open"}
          offline={offline}
          className="max-w-[220px] lg:max-w-[300px] xl:max-w-[400px]"
        />
      </div>

      {/* ---- Four facts ------------------------------------------------------ */}
      <div className="flex flex-wrap gap-2 px-5 pt-4 pb-5 [grid-area:chips] xl:self-end xl:px-7 xl:pb-7">
        <CoolerChip node={node} />
        <Chip icon={<SunIcon size={15} weight="bold" />}>
          Outside <b className="font-semibold text-ink">{Math.round(r.ambientC)}°</b>
        </Chip>
        <BatteryChip node={node} />
        <Chip
          tone={r.lid === "open" ? "warn" : undefined}
          icon={r.lid === "open" ? <DoorOpenIcon size={15} weight="bold" /> : <PackageIcon size={15} weight="bold" />}
        >
          {Math.round(r.fillL)} of {spec.capacityL} L ·{" "}
          {r.lid === "open" ? `Lid open ${duration(Math.max(1, d.lidOpenMin))}` : "Lid closed"}
        </Chip>
      </div>
    </section>
  )
}

function Trend({ perHour, warm }: { perHour: number; warm: boolean }) {
  if (Math.abs(perHour) < 0.1)
    return (
      <p className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft">
        <MinusIcon size={14} weight="bold" />
        Steady over the last hour
      </p>
    )
  const up = perHour > 0
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-[13px] font-semibold",
        up ? (warm ? "text-risk" : "text-warn") : "text-cool",
      )}
    >
      {up ? <ArrowUpIcon size={14} weight="bold" /> : <ArrowDownIcon size={14} weight="bold" />}
      {up ? "Up" : "Down"} {Math.abs(perHour).toFixed(1)}° in the last hour
    </p>
  )
}

type ChipTone = "cool" | "warn" | "risk" | undefined

function Chip({ children, icon, tone }: { children: ReactNode; icon?: ReactNode; tone?: ChipTone }) {
  const tones = {
    cool: "border-cool-line bg-cool-soft text-cool",
    warn: "border-warn-line bg-warn-soft text-warn",
    risk: "border-risk-line bg-risk-soft text-risk",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[13px] backdrop-blur-sm",
        tone ? tones[tone] : "border-line bg-surface/75 text-ink-soft",
      )}
    >
      {icon ? (
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}

function CoolerChip({ node }: { node: CanNode }) {
  switch (node.reading.cooler) {
    case "on":
      return (
        <Chip tone="cool" icon={<SnowflakeIcon size={15} weight="bold" />}>
          Cooling
        </Chip>
      )
    case "idle":
      return <Chip icon={<SnowflakeIcon size={15} weight="bold" />}>Cold enough, cooler resting</Chip>
    case "fault":
      return (
        <Chip tone="risk" icon={<WarningCircleIcon size={15} weight="bold" />}>
          Cooler stopped
        </Chip>
      )
    case "off":
      return (
        <Chip tone="warn" icon={<LightningSlashIcon size={15} weight="bold" />}>
          Cooler off, no power
        </Chip>
      )
  }
}

function BatteryChip({ node }: { node: CanNode }) {
  const pct = Math.round(node.reading.batteryPct)
  const charging = node.reading.solarW > 3
  const concern = node.derived.concern === "battery" || node.derived.concern === "no-power"
  const Icon =
    pct >= 70 ? BatteryHighIcon : pct >= 35 ? BatteryMediumIcon : pct >= 10 ? BatteryLowIcon : BatteryEmptyIcon
  return (
    <Chip tone={concern ? "warn" : undefined} icon={<Icon size={15} weight="bold" />}>
      Battery <b className={cn("font-semibold", concern ? "text-warn" : "text-ink")}>{pct}%</b>
      {charging ? " · charging from sun" : ""}
    </Chip>
  )
}
