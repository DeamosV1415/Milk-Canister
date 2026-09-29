/**
 * What happened to a can today, worked out from its readings.
 *
 * The firmware does not send events — it sends readings, and this walks them
 * looking for the moments a seller would care about. That keeps the hardware
 * contract tiny and means the pins on the day strip and the alerts on the
 * phone can never disagree with the temperature trace.
 */

import { LID_CONCERN_MIN } from "@/telemetry/derive"
import { SAFE_BAND, STALE_AFTER_MS, type CanNode, type Reading } from "@/telemetry/types"

export type EventKind =
  | "filled"
  | "warm"
  | "safe"
  | "cooler-stopped"
  | "power-out"
  | "cooler-back"
  | "lid"
  | "battery-low"
  | "signal-lost"

export type EventTone = "risk" | "warn" | "fresh" | "cool" | "neutral"

export interface CanEvent {
  t: number
  kind: EventKind
  tone: EventTone
  label: string
  reading: Reading
}

/** Degrees below the line the milk has to fall before we call it safe again. */
const RECOVER_MARGIN = 0.2
const BATTERY_LOW_PCT = 20

export function timeline(node: CanNode): CanEvent[] {
  const h = node.history
  if (!h.length) return []
  const out: CanEvent[] = []
  const add = (kind: EventKind, tone: EventTone, label: string, reading: Reading) =>
    out.push({ t: reading.t, kind, tone, label, reading })

  if (node.filledAt != null && node.filledAt > h[0].t) {
    const r = h.find((x) => x.t >= node.filledAt!)
    if (r) add("filled", "cool", "New milk in", r)
  }

  let warm = h[0].milkCoreC > SAFE_BAND.max
  let lidRun: Reading | null = h[0].lid === "open" ? h[0] : null
  let lidFlagged = false

  for (let i = 1; i < h.length; i++) {
    const a = h[i - 1]
    const b = h[i]

    if (b.t - a.t > STALE_AFTER_MS) add("signal-lost", "neutral", "Signal lost", a)

    // New milk went in: the old batch's temperature story ends here. A drop
    // across this line is fresh milk, not warm milk recovering, so it gets no
    // "back under 8" pin.
    if (node.filledAt != null && a.t < node.filledAt && b.t >= node.filledAt) {
      warm = b.milkCoreC > SAFE_BAND.max
      continue
    }

    // Hysteresis, so probe noise at 8.0 degC does not stack up a column of pins.
    if (!warm && b.milkCoreC > SAFE_BAND.max) {
      warm = true
      add("warm", "risk", "Too warm", b)
    } else if (warm && b.milkCoreC < SAFE_BAND.max - RECOVER_MARGIN) {
      warm = false
      add("safe", "fresh", "Back under 8°", b)
    }

    const wasCooling = a.cooler === "on" || a.cooler === "idle"
    const isCooling = b.cooler === "on" || b.cooler === "idle"
    if (wasCooling && b.cooler === "fault") add("cooler-stopped", "risk", "Cooler stopped", b)
    if (wasCooling && b.cooler === "off") add("power-out", "warn", "Battery ran out", b)
    if (!wasCooling && isCooling) add("cooler-back", "cool", "Cooling back on", b)

    if (b.lid === "open") {
      if (a.lid !== "open") {
        lidRun = b
        lidFlagged = false
      }
      if (lidRun && !lidFlagged && b.t - lidRun.t >= LID_CONCERN_MIN * 60_000) {
        lidFlagged = true
        add("lid", "warn", "Lid left open", lidRun)
      }
    } else {
      lidRun = null
    }

    if (a.batteryPct >= BATTERY_LOW_PCT && b.batteryPct < BATTERY_LOW_PCT)
      add("battery-low", "warn", "Battery low", b)
  }

  return out.sort((x, y) => x.t - y.t)
}

/** When the milk most recently went above 8 degC, if it is above now. */
export function warmSince(events: CanEvent[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === "safe") return null
    if (events[i].kind === "warm") return events[i].t
  }
  return null
}

/** Most recent event of a kind. */
export function lastOf(events: CanEvent[], kind: EventKind): CanEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].kind === kind) return events[i]
  return null
}
