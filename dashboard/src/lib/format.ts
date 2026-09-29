/** Formatting helpers. Everything reads the way a person would say it. */

const TZ = "Asia/Kolkata"

export const pad = (v: number, width: number) => String(v).padStart(width, "0")

/** "37h 10m", "45m". Never a bare "0". */
export function duration(min: number): string {
  if (!Number.isFinite(min)) return "over 2 days"
  if (min <= 0) return "no time"
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return h > 0 ? `${h}h ${pad(m, 2)}m` : `${m}m`
}

const clockFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
})

/** "7:12 pm" */
export function clock(t: number): string {
  return clockFmt.format(t).replace(/\s?([ap])\.?m\.?/i, " $1m").toLowerCase()
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ })
const dayKey = (t: number) => dayFmt.format(t)

/** "7:12 pm", "1:20 am tomorrow", or "Thu 9:00 am" — relative to `now`. */
export function clockDay(t: number, now: number): string {
  const a = dayKey(now)
  const b = dayKey(t)
  if (a === b) return clock(t)
  if (dayKey(now + 86_400_000) === b) return `${clock(t)} tomorrow`
  if (dayKey(now - 86_400_000) === b) return `${clock(t)} yesterday`
  const wd = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: TZ }).format(t)
  return `${wd} ${clock(t)}`
}

/**
 * "MANDYA / BASARALU" -> "Basaralu". Route records arrive uppercase from the
 * co-operative; shouting them back at the seller is not the voice we want.
 */
export function placeName(route: string): string {
  const leaf = route.split(" / ").pop() ?? route
  return titleCase(leaf)
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}
