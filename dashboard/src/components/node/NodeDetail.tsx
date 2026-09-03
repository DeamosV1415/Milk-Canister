import { useState, type ReactNode } from "react"
import { BatteryLowIcon } from "@phosphor-icons/react/dist/csr/BatteryLow"
import { BatteryVerticalHighIcon } from "@phosphor-icons/react/dist/csr/BatteryVerticalHigh"
import { ClockCountdownIcon } from "@phosphor-icons/react/dist/csr/ClockCountdown"
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop"
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin"
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake"
import { ThermometerSimpleIcon } from "@phosphor-icons/react/dist/csr/ThermometerSimple"
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning"
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash"
import { motion, useReducedMotion } from "motion/react"
import { Card, Meter, Readout, STATUS_META, StatusPill } from "@/components/chrome/Primitives"
import { Button, Segmented } from "@/components/chrome/Controls"
import { TemperatureChart } from "@/components/charts/TemperatureChart"
import { FreshnessMeter } from "@/components/charts/FreshnessMeter"
import { VesselSchematic } from "./VesselSchematic"
import { cn } from "@/lib/utils"
import { duration, placeName, timeShort, titleCase } from "@/lib/format"
import { SAFE_BAND, type CanNode } from "@/telemetry/types"

/*
  The selected can.

  Everything an engineer would want and a seller would not — fitted UA, heat
  ingress in watts, stratification delta, RSSI — stays out. What is here is the
  handful of things that change what the seller does today, plus one action
  button on the occasions when there is actually something to do.
*/

type Range = "1h" | "3h" | "all"
const RANGE_HOURS: Record<Range, number | null> = { "1h": 1, "3h": 3, all: null }

export function NodeDetail({ node }: { node: CanNode }) {
  const { reading, derived, spec } = node
  const [range, setRange] = useState<Range>("3h")

  const offline = derived.status === "offline"
  const tooWarm = derived.status === "breach"
  const meta = STATUS_META[derived.status]

  const packPct = Math.round(derived.pcmChargeFrac * 100)
  const packLow = derived.pcmChargeFrac < 0.2

  // At most one action, and only when one exists. A button that is always
  // there stops being a prompt and becomes furniture.
  const action = tooWarm
    ? {
        label: "Chill this now",
        tone: "risk" as const,
        icon: <SnowflakeIcon size={17} weight="bold" />,
      }
    : packLow
      ? {
          label: "Swap cooling pack",
          tone: "warn" as const,
          icon: <PackageIcon size={17} weight="bold" />,
        }
      : null

  return (
    <div
      id="detail-scroll"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-5"
    >
      {/* ---- Headline: the answer, in one sentence ---------------------- */}
      <section
        className={cn(
          "card flex shrink-0 flex-wrap items-center justify-between gap-6 border-l-4 p-5 lg:p-6",
          meta.line,
          meta.tint,
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-title text-[22px] text-ink">{node.id}</h1>
            <StatusPill status={derived.status} />
          </div>
          <p className={cn("t-title text-[26px] leading-tight", meta.text)}>{meta.plain}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <MapPinIcon size={15} weight="fill" className="shrink-0 opacity-60" />
            {placeName(node.route)}
            <span className="text-ink-faint">·</span>
            {titleCase(node.operator)}
          </p>
        </div>

        <div className="flex items-center gap-6">
          {action ? (
            <Button tone={action.tone} icon={action.icon}>
              {action.label}
            </Button>
          ) : null}
          <div className="flex items-baseline gap-2">
            <output
              className={cn(
                "t-display text-[clamp(3.5rem,8vw,5rem)]",
                tooWarm ? "text-risk" : "text-ink",
              )}
            >
              {reading.milkCoreC.toFixed(1)}
            </output>
            <span className="t-display text-[24px] text-ink-faint">°C</span>
          </div>
        </div>
      </section>

      {offline ? (
        <p className="flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-sunk px-4 py-3 text-[13px] text-ink-soft">
          <WifiSlashIcon size={17} weight="bold" className="shrink-0" />
          This can has not reported in a while. The numbers below are the last
          ones it sent, not what is happening right now.
        </p>
      ) : null}

      {/* ---- Two numbers that change what you do today ------------------ */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <Readout
              label="Stays cold for about"
              icon={<ClockCountdownIcon size={16} weight="bold" />}
              value={duration(derived.coldLifeMin)}
              size="md"
              tone={derived.coldLifeMin < 90 ? "text-warn" : undefined}
              sub={`Before it passes ${SAFE_BAND.max}°C, with today's heat outside (${reading.ambientC.toFixed(0)}°C)`}
            />
            <Meter
              className="mt-4"
              frac={Math.min(1, derived.coldLifeMin / 1440)}
              tone={derived.coldLifeMin < 90 ? "bg-warn" : "bg-cool"}
            />
          </Card>

          <Card className="p-5">
            <Readout
              label="Cooling pack left"
              icon={<PackageIcon size={16} weight="bold" />}
              value={packPct}
              unit="%"
              size="md"
              tone={packLow ? "text-warn" : undefined}
              sub={
                packLow
                  ? "Swap this pack at the collection centre"
                  : `${spec.pcmKg} kg pack, frozen at +${spec.pcmMeltC}°C`
              }
            />
            <Meter
              className="mt-4"
              frac={derived.pcmChargeFrac}
              tone={packLow ? "bg-warn" : "bg-cool"}
            />
          </Card>
        </div>
      </Reveal>

      {/* ---- The graph + the can ---------------------------------------- */}
      <Reveal delay={0.1}>
        <div className="grid min-h-[320px] grid-cols-1 gap-4 lg:grid-cols-[1fr_290px]">
          <Card
            title="Temperature over time"
            hint="Stay inside the green band"
            icon={<ThermometerSimpleIcon size={17} weight="bold" />}
            right={
              <Segmented
                ariaLabel="Chart time range"
                value={range}
                onChange={setRange}
                options={[
                  { value: "1h", label: "1h" },
                  { value: "3h", label: "3h" },
                  { value: "all", label: "All" },
                ]}
              />
            }
            className="min-h-[320px]"
            bodyClassName="min-h-0 pr-2"
          >
            <TemperatureChart history={node.history} rangeHours={RANGE_HOURS[range]} />
          </Card>

          <Card
            title="Inside the can"
            icon={<DropIcon size={17} weight="bold" />}
            className="min-h-[320px]"
          >
            <VesselSchematic node={node} />
          </Card>
        </div>
      </Reveal>

      {/* ---- Freshness --------------------------------------------------- */}
      <Reveal delay={0.15}>
        <Card
          title="How fresh is it"
          hint="This is what sets the price you are paid"
          icon={<DropIcon size={17} weight="fill" />}
        >
          <FreshnessMeter node={node} />
        </Card>
      </Reveal>

      {/* ---- The sensor itself ------------------------------------------- */}
      <DeviceStrip node={node} />
    </div>
  )
}

/**
 * Staggered entry for the main blocks.
 *
 * Deliberately NOT react-bits' AnimatedContent: that one is GSAP+ScrollTrigger
 * (+60 kB gzip) and renders its child `invisible` until a scroll trigger fires,
 * which also has to be pointed at this pane's internal scroller or the card
 * never appears at all. Motion is already bundled and animates on mount, so
 * there is no scroller to misconfigure and nothing can end up stuck hidden.
 */
function Reveal({ children, delay }: { children: ReactNode; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="shrink-0"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function DeviceStrip({ node }: { node: CanNode }) {
  const { reading, derived } = node
  const battery = Math.round(reading.batteryPct)
  const lowBattery = battery < 25
  const offline = derived.status === "offline"
  const flag = lowBattery || offline

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-[12.5px]",
        flag ? "border-warn-line bg-warn-soft" : "border-line bg-sunk",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2",
          lowBattery ? "font-medium text-warn" : "text-ink-soft",
        )}
      >
        {lowBattery ? (
          <BatteryLowIcon size={17} weight="bold" className="shrink-0" />
        ) : (
          <BatteryVerticalHighIcon size={17} weight="bold" className="shrink-0 opacity-60" />
        )}
        {lowBattery
          ? `Sensor battery low — ${battery}%. Charge it or you stop getting warnings.`
          : `Sensor battery ${battery}%`}
      </span>
      <span
        className={cn(
          "flex items-center gap-2",
          offline ? "font-medium text-warn" : "text-ink-faint",
        )}
      >
        {offline ? <WarningIcon size={16} weight="fill" className="shrink-0" /> : null}
        {offline ? "Not reporting right now" : `Last reading ${timeShort(reading.t)}`}
      </span>
    </div>
  )
}
