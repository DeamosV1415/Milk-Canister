/**
 * ChillCan telemetry domain model.
 *
 * This file is the contract between the dashboard and whatever is producing
 * readings. The simulator implements it today; the ESP32 field unit implements
 * it tomorrow. Nothing in `src/components` may import from `simulator.ts` —
 * it goes through `TelemetrySource` (see `source.ts`) so the swap is one file.
 *
 * The split that matters: a source sends RAW data only (`RawSnapshot`). Every
 * judgement — cold life, status, "offline", what happened today — is worked
 * out dashboard-side in `derive.ts`. The firmware never has to compute a
 * verdict, and the judging panel can see exactly what was measured.
 */

/** Milk safety band, per FSSAI guidance for raw milk held for collection. */
export const SAFE_BAND = { min: 2.0, max: 8.0 } as const

/**
 * Milk freezes at roughly -0.52 degC. A Peltier cold plate reading at or below
 * this means the cooler is freezing milk against the plate and rupturing fat
 * globules — a fault, not a "colder is better" win.
 */
export const MILK_FREEZE_POINT_C = -0.52

/** A can that has not reported for this long is treated as offline. */
export const STALE_AFTER_MS = 5 * 60_000

export type NodeStatus = "nominal" | "watch" | "breach" | "offline"

export type LidState = "sealed" | "open"

/**
 * What the Peltier is doing, as the firmware reports it.
 *   on    — thermostat is driving the Peltier
 *   idle  — milk is at setpoint, thermostat resting
 *   fault — driven, but the cold plate is not getting colder than the milk
 *   off   — battery at the low-voltage cutoff; the ESP32 keeps reporting on
 *           its reserve, but cooling has stopped
 */
export type CoolerState = "on" | "idle" | "fault" | "off"

/**
 * One instantaneous sample from one can.
 *
 * HARDWARE STATUS (2026-09-29): the team has an ESP32, DS18B20 probes, a pH
 * probe and a Peltier. Fields marked PLANNED are not wired yet — the simulator
 * fills them so the design can be judged, and the README lists what each one
 * needs.
 */
export interface Reading {
  /** Epoch milliseconds. */
  t: number
  /** DS18B20 in the milk. degC. CONFIRMED. */
  milkCoreC: number
  /** DS18B20 on the Peltier cold plate, inside the can. degC. PLANNED (same 1-wire bus). */
  coldPlateC: number
  /** DS18B20 outside the can, shaded. degC. PLANNED (same 1-wire bus). */
  ambientC: number
  /** Food-grade pH probe. Fresh raw milk sits near 6.7. CONFIRMED. */
  ph: number
  /** Firmware's own view of the Peltier. CONFIRMED (the ESP32 drives it). */
  cooler: CoolerState
  /** Battery, percent. PLANNED (ESP32 ADC across a divider). */
  batteryPct: number
  /** Solar input, watts. 0 with no panel or at night. PLANNED. */
  solarW: number
  /** Lid reed switch. PLANNED. */
  lid: LidState
  /** Load-cell fill volume, litres. PLANNED. */
  fillL: number
  /** ESP32 WiFi RSSI, dBm. CONFIRMED (`WiFi.RSSI()`). */
  rssiDbm: number
}

/** Physical build parameters of one can. Fixed at manufacture. */
export interface CanSpec {
  /** Nominal capacity, litres. */
  capacityL: number
  /** Heat-transfer coefficient of the insulated body, lid closed, W/K. */
  designUaWPerK: number
  /** Usable battery energy, Wh. */
  batteryWh: number
  /** Peltier electrical draw while running, W. */
  peltierW: number
  /** Peltier coefficient of performance: watts of heat moved per watt drawn. */
  peltierCop: number
  /** Thermostat target, degC. */
  setpointC: number
  /** ESP32 + sensors, always on, W. */
  baseLoadW: number
}

/** Where the milk is going and when it gets picked up. Comes from the co-op schedule. */
export interface Trip {
  /** Collection centre, as the seller says it: "Halagur dairy". */
  centre: string
  /** Epoch ms. */
  pickupAt: number
}

// ---------------------------------------------------------------------------
// What a source sends
// ---------------------------------------------------------------------------

export interface RawNode {
  id: string
  /** Village or society, "DISTRICT / VILLAGE". */
  route: string
  operator: string
  spec: CanSpec
  trip: Trip | null
  /** When the current milk went in. Optional; bounds "today" when present. */
  filledAt?: number
  /** Readings, oldest first. Send ~12 h so the day strip has a day to draw. */
  history: Reading[]
}

export interface RawSnapshot {
  /** Source clock, epoch ms. Real sources send Date.now(). */
  t: number
  nodes: RawNode[]
}

// ---------------------------------------------------------------------------
// What the dashboard works out
// ---------------------------------------------------------------------------

/**
 * The single most important thing about a can right now, in priority order.
 * Drives the headline sentence, the roster note and the one action.
 */
export type Concern =
  | "offline"
  | "warm" //      above 8 degC
  | "freeze" //    cold plate below the milk freeze point
  | "cooler" //    Peltier fault, milk still cold
  | "no-power" //  battery at cutoff, milk still cold
  | "lid" //       lid open for a while
  | "warming" //   close to 8 degC, or will be soon
  | "battery" //   cooling will stop within a few hours
  | "ok"

export interface Derived {
  /** Minutes until the milk crosses SAFE_BAND.max. Infinity past the 48 h horizon. */
  coldLifeMin: number
  /** Minutes until the battery hits cutoff and cooling stops. Infinity if not within 48 h. */
  powerLeftMin: number
  /** Minutes above SAFE_BAND.max since the milk went in. */
  minutesAboveBand: number
  /** Projected dye-reduction grade from time spent warm. */
  mbrtGrade: MbrtGrade
  /** Milk temperature change over the last hour, degC. */
  trendPerHour: number
  /** How long the lid has been open, minutes. 0 when sealed. */
  lidOpenMin: number
  status: NodeStatus
  concern: Concern
}

/** BIS IS 1479 Part 3 dye-reduction grading. Drives the farmer's milk price. */
export type MbrtGrade = "I" | "II" | "III" | "IV"

export const MBRT_LABEL: Record<MbrtGrade, string> = {
  I: "Very good",
  II: "Good",
  III: "Fair",
  IV: "Poor",
}

/** One can, ready for the UI. */
export interface CanNode extends RawNode {
  /** Latest reading. For an offline can, the last one it sent. */
  reading: Reading
  derived: Derived
}

/** One snapshot of the whole fleet, as handed to the UI. */
export interface FleetSnapshot {
  t: number
  nodes: CanNode[]
}
