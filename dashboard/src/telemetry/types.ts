/**
 * ChillCan telemetry domain model.
 *
 * This file is the contract between the dashboard and whatever is producing
 * readings. The simulator implements it today; the ESP32 field unit implements
 * it tomorrow. Nothing in `src/components` may import from `simulator.ts` —
 * it goes through `TelemetrySource` (see `source.ts`) so the swap is one file.
 */

/** Milk safety band, per FSSAI guidance for raw milk held for collection. */
export const SAFE_BAND = { min: 2.0, max: 8.0 } as const

/**
 * Milk freezes at roughly -0.52 degC. Any wall reading at or below this means
 * the PCM is over-cooling and rupturing fat globules — a hardware fault, not a
 * "colder is better" win. The dashboard must surface it as a fault.
 */
export const MILK_FREEZE_POINT_C = -0.52

export type NodeStatus = "nominal" | "watch" | "breach" | "offline"

/** Lid position is a discrete event source, not a continuous channel. */
export type LidState = "sealed" | "open"

/**
 * One instantaneous sample from one can. The hardware payload maps 1:1 onto
 * this — every field is something a sensor on the can actually measures, except
 * those marked DERIVED, which the dashboard computes.
 */
export interface Reading {
  /** Epoch milliseconds, device clock. */
  t: number

  /** DS18B20 probe, mid-depth in the milk column. degC. */
  milkCoreC: number
  /** DS18B20 probe, top of the milk column. Shows stratification. degC. */
  milkTopC: number
  /** DS18B20 probe, against the inner wall beside the PCM cartridge. degC. */
  wallC: number
  /** Ambient probe, outside the can body, shaded. degC. */
  ambientC: number
  /** Probe embedded in the PCM cartridge. degC. */
  pcmC: number

  /** Food-grade pH probe in the milk. Fresh raw milk sits near 6.7. */
  ph: number

  /** Lid reed switch. */
  lid: LidState
  /** Load-cell derived fill volume, litres. */
  fillL: number
  /** Node battery, percent. */
  batteryPct: number
  /** LoRaWAN RSSI, dBm. Negative; closer to zero is better. */
  rssiDbm: number
}

/**
 * Values the dashboard computes from readings + the thermal model. Kept apart
 * from `Reading` so it is always obvious what was measured and what was
 * inferred — a distinction the judging panel will ask about.
 */
export interface Derived {
  /** Fraction of PCM latent heat still unspent, 0..1. */
  pcmChargeFrac: number
  /** Minutes until milkCoreC is projected to cross SAFE_BAND.max. */
  coldLifeMin: number
  /** Fitted heat-transfer coefficient of the whole can, W/K. */
  uaWPerK: number
  /** Steady-state heat ingress at the current ambient delta, W. */
  ingressW: number
  /** Cumulative minutes spent above SAFE_BAND.max this collection cycle. */
  minutesAboveBand: number
  /** Projected Methylene Blue Reduction Test grade from thermal history. */
  mbrtGrade: MbrtGrade
  status: NodeStatus
}

/** BIS IS 1479 Part 3 dye-reduction grading. Drives the farmer's milk price. */
export type MbrtGrade = "I" | "II" | "III" | "IV"

export interface MbrtBand {
  grade: MbrtGrade
  label: string
  /** Dye reduction time, hours. */
  hours: string
}

export const MBRT_BANDS: Record<MbrtGrade, MbrtBand> = {
  I: { grade: "I", label: "VERY GOOD", hours: ">5H" },
  II: { grade: "II", label: "GOOD", hours: "3-5H" },
  III: { grade: "III", label: "FAIR", hours: "1-3H" },
  IV: { grade: "IV", label: "POOR", hours: "<1H" },
}

/** Physical build parameters of one can. Fixed at manufacture. */
export interface CanSpec {
  /** Nominal capacity, litres. */
  capacityL: number
  /** PCM charge mass, kg. */
  pcmKg: number
  /** PCM melt point, degC. Organic PCM, deliberately above milk freeze point. */
  pcmMeltC: number
  /** PCM latent heat, kJ/kg. */
  pcmLatentKjPerKg: number
  /** Design heat-transfer coefficient, W/K. */
  designUaWPerK: number
}

export interface CanNode {
  id: string
  /** Village or society the can is assigned to. */
  route: string
  operator: string
  spec: CanSpec
  reading: Reading
  derived: Derived
  /** Rolling window, oldest first. Bounded by the source. */
  history: Reading[]
}

export type EventKind =
  | "lid-open"
  | "lid-seal"
  | "band-exit"
  | "band-return"
  | "pcm-low"
  | "freeze-risk"
  | "uplink-loss"
  | "handover"

export interface FleetEvent {
  id: string
  t: number
  nodeId: string
  kind: EventKind
  detail: string
  severity: "info" | "warn" | "critical"
}

/** One snapshot of the whole fleet, as handed to the UI. */
export interface FleetSnapshot {
  t: number
  nodes: CanNode[]
  events: FleetEvent[]
}
