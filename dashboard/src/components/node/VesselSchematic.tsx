import { cn } from "@/lib/utils"
import { MILK_FREEZE_POINT_C, SAFE_BAND, type CanNode } from "@/telemetry/types"

/*
  The can, drawn to the build spec: rotomoulded twin wall, 45 mm foam, central
  removable cooling pack, gasketed lid.

  Structure is unchanged from the tactical version — it was working — but the
  skin is now light and the callouts speak plainly. Milk level tracks the load
  cell, the pack fills as it charges, and the lid actually opens.
*/

const W = 250
const H = 280

const BODY_X = 76
const BODY_W = 98
const BODY_TOP = 56
const BODY_BOT = 214
const WALL_T = 11

export function VesselSchematic({ node }: { node: CanNode }) {
  const { reading, derived } = node
  const offline = derived.status === "offline"
  const freezeRisk = reading.wallC <= MILK_FREEZE_POINT_C
  const tooWarm = reading.milkCoreC > SAFE_BAND.max
  const lidOpen = reading.lid === "open"

  const bodyH = BODY_BOT - BODY_TOP
  const innerBot = BODY_BOT - WALL_T

  const fillFrac = Math.max(0.06, Math.min(1, reading.fillL / node.spec.capacityL))
  const milkTop = innerBot - (bodyH - WALL_T) * fillFrac

  const packTop = BODY_TOP + 16
  const packH = innerBot - packTop
  const charge = Math.max(0, Math.min(1, derived.pcmChargeFrac))

  const milkTone = tooWarm ? "var(--color-risk)" : "var(--color-cool)"

  return (
    <div className="flex h-full items-center justify-center px-4 pb-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("block h-auto w-full max-w-[250px]", offline && "opacity-45")}
        role="img"
        aria-label={`Can ${node.id}: milk ${reading.milkCoreC.toFixed(1)} degrees, ${reading.fillL.toFixed(0)} of ${node.spec.capacityL} litres, lid ${lidOpen ? "open" : "closed"}, cooling pack ${Math.round(charge * 100)} percent`}
      >
        <defs>
          <pattern id="foam" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-line)" strokeWidth="2" />
          </pattern>
          <linearGradient id="milkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={milkTone} stopOpacity="0.34" />
            <stop offset="100%" stopColor={milkTone} stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* ---- Lid ------------------------------------------------------- */}
        <g
          transform={
            lidOpen ? `rotate(-8 ${BODY_X + BODY_W + 4} ${BODY_TOP - 2}) translate(0 -4)` : undefined
          }
          style={{ transition: "transform 400ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          <rect
            x={BODY_X - 4}
            y={BODY_TOP - 14}
            width={BODY_W + 8}
            height="12"
            rx="3"
            fill="var(--color-sunk)"
            stroke="var(--color-ink-faint)"
            strokeWidth="1.5"
          />
          <line
            x1={BODY_X - 4}
            y1={BODY_TOP - 2}
            x2={BODY_X + BODY_W + 4}
            y2={BODY_TOP - 2}
            stroke={lidOpen ? "var(--color-warn)" : "var(--color-line)"}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* ---- Body: outer shell, foam, inner shell ---------------------- */}
        <rect
          x={BODY_X}
          y={BODY_TOP}
          width={BODY_W}
          height={bodyH}
          rx="6"
          fill="var(--color-surface)"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.5"
        />
        <rect x={BODY_X} y={BODY_TOP} width={WALL_T} height={bodyH} fill="url(#foam)" />
        <rect x={BODY_X + BODY_W - WALL_T} y={BODY_TOP} width={WALL_T} height={bodyH} fill="url(#foam)" />
        <rect x={BODY_X} y={innerBot} width={BODY_W} height={WALL_T} fill="url(#foam)" />

        {/* ---- Milk ------------------------------------------------------ */}
        <rect
          x={BODY_X + WALL_T}
          y={milkTop}
          width={BODY_W - WALL_T * 2}
          height={innerBot - milkTop}
          fill="url(#milkfill)"
        />
        <line
          x1={BODY_X + WALL_T}
          y1={milkTop}
          x2={BODY_X + BODY_W - WALL_T}
          y2={milkTop}
          stroke={milkTone}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* ---- Cooling pack --------------------------------------------- */}
        <rect
          x={W / 2 - 11}
          y={packTop}
          width="22"
          height={packH}
          rx="4"
          fill="var(--color-sunk)"
          stroke="var(--color-line)"
          strokeWidth="1.5"
        />
        <rect
          x={W / 2 - 9}
          y={packTop + packH * (1 - charge)}
          width="18"
          height={packH * charge}
          rx="3"
          fill={charge < 0.15 ? "var(--color-warn)" : "var(--color-cool)"}
          opacity={charge < 0.15 ? 0.45 : 0.22}
          style={{ transition: "all 500ms ease-out" }}
        />

        {/* ---- Callouts. Right = milk, left = coldest spot. -------------- */}
        <Callout
          side="right"
          tipX={W / 2 + 13}
          tipY={(milkTop + innerBot) / 2}
          gutterX={BODY_X + BODY_W + 10}
          label="Milk"
          value={`${reading.milkCoreC.toFixed(1)}°`}
          tone={tooWarm ? "var(--color-risk)" : "var(--color-ink)"}
          emphasis
        />
        <Callout
          side="left"
          tipX={BODY_X + WALL_T + 3}
          tipY={innerBot - 36}
          gutterX={BODY_X - 10}
          label={freezeRisk ? "Freezing!" : "Coldest"}
          value={`${reading.wallC.toFixed(1)}°`}
          tone={freezeRisk ? "var(--color-risk)" : "var(--color-ink-soft)"}
        />

        {/* ---- Caption --------------------------------------------------- */}
        <text
          x={W / 2}
          y={BODY_BOT + 26}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="var(--color-ink)"
        >
          {reading.fillL.toFixed(0)} of {node.spec.capacityL} litres
        </text>
        <text
          x={W / 2}
          y={BODY_BOT + 44}
          textAnchor="middle"
          fontSize="12"
          fill={lidOpen ? "var(--color-warn)" : "var(--color-ink-faint)"}
        >
          {lidOpen ? "Lid is open" : "Lid closed and sealed"}
        </text>
      </svg>
    </div>
  )
}

function Callout({
  side,
  tipX,
  tipY,
  gutterX,
  label,
  value,
  tone,
  emphasis,
}: {
  side: "left" | "right"
  tipX: number
  tipY: number
  gutterX: number
  label: string
  value: string
  tone: string
  emphasis?: boolean
}) {
  const anchor = side === "right" ? "start" : "end"
  return (
    <g>
      <circle cx={tipX} cy={tipY} r="3" fill={tone} />
      <line x1={tipX} y1={tipY} x2={gutterX} y2={tipY} stroke={tone} strokeWidth="1" opacity="0.35" />
      <text x={gutterX} y={tipY - 6} textAnchor={anchor} fontSize="11.5" fill="var(--color-ink-faint)">
        {label}
      </text>
      <text
        x={gutterX}
        y={tipY + 11}
        textAnchor={anchor}
        fontSize={emphasis ? "19" : "15"}
        fontWeight="600"
        fontFamily="Outfit Variable, Outfit, sans-serif"
        fill={tone}
      >
        {value}
      </text>
    </g>
  )
}
