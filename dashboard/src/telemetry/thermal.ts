/**
 * Thermal model for an insulated milk can with a battery-powered Peltier.
 *
 * Lumped capacitance: the milk is one thermal mass, heat leaks in through the
 * body at UA x (ambient - milk), and the Peltier pulls heat out at
 * peltierW x COP while it runs. The simulator integrates these equations, and
 * `project()` runs the same equations forward to answer "how long does it stay
 * cold?" — so the countdown on screen and the trace on screen always agree.
 */

import type { CanSpec, MbrtGrade, Reading } from "./types"
import { SAFE_BAND } from "./types"

/** Specific heat capacity of whole cow milk, kJ/kg.K. */
export const MILK_CP = 3.93
/** Density of whole cow milk, kg/L. */
export const MILK_RHO = 1.03

/**
 * Baseline 40 L can: 45 mm PUF (~0.39 W/K), a 12 V 20 Ah pack, and a single
 * TEC1-12703-class Peltier run at ~36 W for ~22 W of heat moved.
 */
export const DEFAULT_SPEC: CanSpec = {
  capacityL: 40,
  designUaWPerK: 0.39,
  batteryWh: 240,
  peltierW: 36,
  peltierCop: 0.6,
  setpointC: 4,
  baseLoadW: 0.8,
}

/** Battery fraction at which firmware cuts the Peltier to keep the ESP32 alive. */
export const LOW_VOLTAGE_CUTOFF = 0.05

/** How far ahead `project()` looks. Beyond this, "a long time" is honest enough. */
export const PROJECTION_HORIZON_MIN = 48 * 60

/** Thermal mass of the milk charge, kJ/K. */
export function milkThermalMass(fillL: number): number {
  return Math.max(1, fillL) * MILK_RHO * MILK_CP
}

/**
 * An open lid roughly triples ingress — the gasket path is the weakest link in
 * the envelope; the research note budgets 20-35% of total UA to the lid.
 */
export function effectiveUa(spec: CanSpec, lidOpen: boolean): number {
  return lidOpen ? spec.designUaWPerK * 3.1 : spec.designUaWPerK
}

/** Heat leaking in, watts. */
export function ingressWatts(ua: number, ambientC: number, milkC: number): number {
  return ua * (ambientC - milkC)
}

/** Heat the Peltier removes while running, watts. */
export function coolingWatts(spec: CanSpec): number {
  return spec.peltierW * spec.peltierCop
}

/**
 * Thermostat with hysteresis, shared by the simulator and the projection so
 * both make the same decision from the same numbers.
 */
export function thermostat(spec: CanSpec, milkC: number, wasOn: boolean): boolean {
  if (milkC > spec.setpointC + 0.3) return true
  if (milkC < spec.setpointC - 0.3) return false
  return wasOn
}

/**
 * Run the can forward from a reading and report when the milk crosses 8 degC
 * and when the battery hits cutoff.
 *
 * Assumptions, all deliberately pessimistic because this number is a food
 * safety promise:
 *  - Solar is ignored. Clouds happen, and nights always do.
 *  - Ambient holds at the current value.
 *  - An open lid is assumed to stay open for 30 more minutes, then close.
 */
export function project(
  spec: CanSpec,
  r: Reading,
): { coldLifeMin: number; powerLeftMin: number } {
  const step = 5 // minutes
  const mcp = milkThermalMass(r.fillL) // kJ/K
  const cutoffWh = spec.batteryWh * LOW_VOLTAGE_CUTOFF

  let T = r.milkCoreC
  let wh = (spec.batteryWh * r.batteryPct) / 100
  let on = r.cooler === "on"
  const healthy = r.cooler !== "fault"

  let coldLife: number | null = T >= SAFE_BAND.max ? 0 : null
  let powerLeft: number | null = wh <= cutoffWh ? 0 : null

  for (let m = 0; m < PROJECTION_HORIZON_MIN; m += step) {
    if (coldLife != null && powerLeft != null) break

    const lidOpen = r.lid === "open" && m < 30
    const qIn = ingressWatts(effectiveUa(spec, lidOpen), r.ambientC, T)

    let draw = spec.baseLoadW
    let qOut = 0
    if (healthy && wh > cutoffWh) {
      on = thermostat(spec, T, on)
      if (on) {
        qOut = coolingWatts(spec)
        draw += spec.peltierW
      }
    }

    wh -= (draw * step) / 60
    if (powerLeft == null && wh <= cutoffWh) powerLeft = m + step

    T += ((qIn - qOut) * step * 60) / 1000 / mcp
    if (coldLife == null && T >= SAFE_BAND.max) coldLife = m + step
  }

  return {
    coldLifeMin: coldLife ?? Infinity,
    powerLeftMin: powerLeft ?? Infinity,
  }
}

/**
 * Dye-reduction grade projected from time spent above the band.
 *
 * Psychrotroph load compounds with warm minutes, and BIS IS 1479 grading is
 * what actually sets the farmer's price — so this is the number that turns a
 * temperature trace into rupees.
 */
export function projectMbrt(minutesAboveBand: number): MbrtGrade {
  if (minutesAboveBand < 30) return "I"
  if (minutesAboveBand < 120) return "II"
  if (minutesAboveBand < 240) return "III"
  return "IV"
}

/**
 * Recover UA from two samples by inverting the lumped-capacitance solution.
 * Only valid while the Peltier is off and the milk is warming toward ambient —
 * it returns null otherwise, which is correct rather than a bug. Not shown in
 * the UI; it is the number that proves a built can matches the model, for the
 * hardware write-up and the field-test protocol.
 */
export function fitUa(a: Reading, b: Reading): number | null {
  if (a.cooler === "on" || b.cooler === "on") return null
  const dtSec = (b.t - a.t) / 1000
  if (dtSec <= 0) return null

  const ambient = (a.ambientC + b.ambientC) / 2
  const num = ambient - a.milkCoreC
  const den = ambient - b.milkCoreC
  if (num <= 0 || den <= 0 || num === den) return null

  const mcp = milkThermalMass(b.fillL) // kJ/K
  const ua = ((mcp * Math.log(num / den)) / dtSec) * 1000 // W/K
  return Number.isFinite(ua) && ua > 0 ? ua : null
}
