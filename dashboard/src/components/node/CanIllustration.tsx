import { useId } from "react"
import { cn } from "@/lib/utils"
import type { CoolerState } from "@/telemetry/types"

/*
  The can, as the seller knows it: a steel milk can with a window cut into the
  front so you can see the milk, and the Peltier cooler bolted to its side.

  Everything drawn here is a reading, not decoration:
    - milk level        <- load cell
    - milk colour       <- milk temperature (icy blue -> cream -> warm peach)
    - frost + droplets  <- how cold it is; a cold can sweats in hot air
    - heat shimmer      <- above 8 degC
    - cooler light      <- blue running, grey resting, red with "!" on fault
    - warm air at fins  <- the cooler is working
    - lid               <- reed switch
*/

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function hex(h: string) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}
function mix(a: string, b: string, t: number) {
  const A = hex(a)
  const B = hex(b)
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  )
}

/** Milk colour by temperature. Cold milk reads icy; warm milk reads sick. */
function milkTint(T: number) {
  if (T <= 4) return "#d9ebf8"
  if (T <= 6.5) return mix("#d9ebf8", "#f5f2e9", (T - 4) / 2.5)
  if (T <= 9.5) return mix("#f5f2e9", "#f7d6c2", (T - 6.5) / 3)
  return "#f7d6c2"
}

const BODY =
  "M82 170 Q82 150 100 141 L128 120 L128 102 L222 102 L222 120 L250 141 Q268 150 268 170 L268 350 Q268 368 250 368 L100 368 Q82 368 82 350Z"
const WIN = { x: 112, y: 196, w: 116, h: 146 }
const DROPS: Array<[number, number]> = [
  [97, 226], [104, 262], [93, 300], [101, 336], [246, 214], [252, 176], [96, 190], [240, 344],
]

export function CanIllustration({
  tempC,
  fillFrac,
  cooler,
  lidOpen,
  offline,
  className,
}: {
  tempC: number
  fillFrac: number
  cooler: CoolerState
  lidOpen: boolean
  offline?: boolean
  className?: string
}) {
  const uid = useId().replace(/:/g, "")
  const id = (s: string) => `${uid}-${s}`

  const frost = offline ? 0 : clamp((7.5 - tempC) / 4.5, 0, 1)
  const warm = offline ? 0 : clamp((tempC - 7) / 3, 0, 1)
  const milkTop = WIN.y + WIN.h - (WIN.h - 10) * clamp(fillFrac, 0.06, 1)
  const tint = milkTint(tempC)
  const aura = warm > 0.3 ? "#f2b8a2" : "#9dc9e6"
  const running = cooler === "on" && !offline
  const led =
    offline ? "#a9a49c" : cooler === "on" ? "#1f6c9f" : cooler === "fault" ? "#9f2f2d" : "#a9a49c"

  const wave = `M${WIN.x - 40} ${milkTop} ${Array.from({ length: 6 }, () => "q10 -5 20 0 t20 0").join(" ")} V${milkTop + 8} H${WIN.x - 40}Z`

  return (
    <svg
      viewBox="0 0 360 400"
      className={cn("block h-auto w-full", offline && "grayscale opacity-60", className)}
      role="img"
      aria-label={`Milk can: ${tempC.toFixed(1)} degrees, ${Math.round(fillFrac * 100)} percent full, lid ${lidOpen ? "open" : "closed"}, cooler ${cooler}`}
    >
      <defs>
        <radialGradient id={id("aura")} cx=".48" cy=".56" r=".5">
          <stop offset="0" stopColor={aura} stopOpacity={0.5 * Math.max(frost, warm)} />
          <stop offset="1" stopColor={aura} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("body")} x1="0" x2="1">
          <stop offset="0" stopColor="#dfe5ea" />
          <stop offset=".32" stopColor="#f8fafb" />
          <stop offset=".5" stopColor="#ffffff" />
          <stop offset=".78" stopColor="#edf1f4" />
          <stop offset="1" stopColor="#d6dde3" />
        </linearGradient>
        <linearGradient id={id("milk")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(tint, "#ffffff", 0.35)} />
          <stop offset="1" stopColor={tint} />
        </linearGradient>
        <linearGradient id={id("frostfade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset=".35" stopColor="#e1f3fe" stopOpacity="0" />
          <stop offset="1" stopColor="#cfe6f6" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id={id("cold")} x1="1" x2="0">
          <stop offset="0" stopColor="#1f6c9f" stopOpacity=".28" />
          <stop offset="1" stopColor="#1f6c9f" stopOpacity="0" />
        </linearGradient>
        <pattern id={id("frost")} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r=".9" fill="#ffffff" />
          <circle cx="6.5" cy="7" r=".7" fill="#b9d9ee" />
        </pattern>
        <clipPath id={id("win")}>
          <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="16" />
        </clipPath>
        <clipPath id={id("bodyclip")}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* Aura and ground shadow */}
      <circle cx="175" cy="232" r="178" fill={`url(#${id("aura")})`} />
      <ellipse cx="175" cy="376" rx="108" ry="9" fill="#26241f" opacity=".07" />

      {/* Heat shimmer */}
      <g opacity={warm} stroke="#d98b82" strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path className="can-rise" d="M150 60 q6 -8 0 -16 q-6 -8 0 -16" />
        <path className="can-rise d2" d="M176 56 q6 -8 0 -16 q-6 -8 0 -16" />
        <path className="can-rise d3" d="M202 60 q6 -8 0 -16 q-6 -8 0 -16" />
      </g>

      {/* Handles */}
      <path d="M84 176 C58 176 58 214 84 214" stroke="#aab3bb" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M266 176 C292 176 292 214 266 214" stroke="#aab3bb" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Body */}
      <path d={BODY} fill={`url(#${id("body")})`} stroke="var(--color-steel)" strokeWidth="1.5" />
      <g clipPath={`url(#${id("bodyclip")})`} style={{ transition: "opacity 800ms" }}>
        <rect x="80" y="100" width="190" height="270" fill={`url(#${id("frost")})`} opacity={0.85 * frost} />
        <rect x="80" y="100" width="190" height="270" fill={`url(#${id("frostfade")})`} opacity={frost} />
      </g>
      <line x1="83" y1="182" x2="267" y2="182" stroke="var(--color-steel-soft)" strokeWidth="3" />
      <line x1="83" y1="354" x2="267" y2="354" stroke="var(--color-steel-soft)" strokeWidth="3" />

      {/* Lid */}
      {/* CSS transform, but pinned to viewBox coordinates. Without
          transform-box the origin resolves against the group's own bbox and
          the lid flies off the can. */}
      <g
        className="can-lid"
        style={{
          transformBox: "view-box",
          transformOrigin: "232px 102px",
          transform: lidOpen ? "rotate(-16deg) translateY(-10px)" : "none",
        }}
      >
        <rect x="116" y="84" width="118" height="20" rx="6" fill={`url(#${id("body")})`} stroke="var(--color-steel)" strokeWidth="1.5" />
        <rect x="160" y="70" width="30" height="16" rx="5" fill="#e6ebef" stroke="var(--color-steel)" strokeWidth="1.5" />
      </g>

      {/* Window into the can */}
      <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="16" fill="#eef2f5" />
      <g clipPath={`url(#${id("win")})`}>
        <rect
          x={WIN.x}
          y={milkTop}
          width={WIN.w}
          height={WIN.y + WIN.h - milkTop}
          fill={`url(#${id("milk")})`}
        />
        <path className={offline ? undefined : "can-wave"} d={wave} fill={mix(tint, "#ffffff", 0.5)} />
        {running ? (
          <rect
            className="can-pulse"
            x={WIN.x + WIN.w - 40}
            y={WIN.y}
            width="40"
            height={WIN.h}
            fill={`url(#${id("cold")})`}
          />
        ) : null}
        <rect x={WIN.x + 12} y={WIN.y - 10} width="16" height={WIN.h + 20} fill="#ffffff" opacity=".35" transform="skewX(-12)" />
      </g>
      <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx="16" fill="none" stroke="var(--color-steel)" strokeWidth="1.5" />

      {/* Condensation: a cold can sweats in hot air */}
      <g opacity={frost} style={{ transition: "opacity 800ms" }}>
        {DROPS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <ellipse cx={x} cy={y} rx="2.4" ry="3.3" fill="#d7eaf7" stroke="#9dc9e6" strokeWidth=".8" />
            <circle cx={x - 0.8} cy={y - 1.2} r=".8" fill="#fff" />
          </g>
        ))}
      </g>

      {/* Peltier cooler */}
      <g>
        <rect x="262" y="238" width="18" height="82" rx="5" fill="#d3dae0" stroke="#aeb7bf" strokeWidth="1.2" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x="279" y={243 + i * 8.4} width="22" height="4" rx="2" fill="#bdc5cc" />
        ))}
        <circle cx="271" cy="252" r="9" fill={led} opacity=".18" className={running ? "can-pulse" : undefined} />
        <circle cx="271" cy="252" r="3.6" fill={led} />
        {running ? (
          <g stroke="#d9a441" strokeWidth="2" fill="none" strokeLinecap="round" className="can-drift">
            <path d="M308 258 q5 -4 10 0 t10 0" />
            <path d="M308 278 q5 -4 10 0 t10 0" />
            <path d="M308 298 q5 -4 10 0 t10 0" />
          </g>
        ) : null}
        {cooler === "fault" && !offline ? (
          <g>
            <circle cx="301" cy="236" r="10" fill="var(--color-risk)" />
            <text x="301" y="241" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="var(--font-display)">
              !
            </text>
          </g>
        ) : null}
      </g>
    </svg>
  )
}
