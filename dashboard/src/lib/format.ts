/** Formatting helpers. Every readout is fixed-width so digits never reflow. */

export const degC = (v: number, dp = 1) => `${v.toFixed(dp)}`

export const pad = (v: number, width: number) => String(v).padStart(width, "0")

/** Cold life as HHhMMm, or an explicit sentinel. Never a bare "0". */
export function duration(min: number): string {
  if (!Number.isFinite(min)) return "a long time"
  if (min <= 0) return "no time left"
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return h > 0 ? `${h}h ${pad(m, 2)}m` : `${m}m`
}

export function clockIST(t: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(t)
}

export function timeShort(t: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(t)
}

/** Map a value into a 0..1 fraction of a range, clamped. */
export const norm = (v: number, lo: number, hi: number) =>
  Math.max(0, Math.min(1, (v - lo) / (hi - lo)))

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
