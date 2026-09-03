/**
 * Lumped-capacitance thermal model for a PCM-buffered insulated milk can.
 *
 * Every constant below is sourced from the project research note (SIH 26110).
 * The simulator integrates these equations rather than emitting a random walk,
 * so the traces on screen show real behaviour: thermal lag after a lid event,
 * the PCM plateau while latent heat is being spent, and the sharp knee when the
 * cartridge runs out. That knee is the whole argument for the product, so it
 * has to be honest.
 */

import type { CanSpec, Derived, MbrtGrade, Reading } from "./types"
import { SAFE_BAND } from "./types"

/** Specific heat capacity of whole cow milk, kJ/kg.K. */
export const MILK_CP = 3.93
/** Density of whole cow milk, kg/m^3 -> kg/L. */
export const MILK_RHO = 1.03

/** Baseline 40 L keeper: 45 mm PUF, ~0.70 m^2 envelope. */
export const DEFAULT_SPEC: CanSpec = {
  capacityL: 40,
  pcmKg: 8,
  pcmMeltC: 5,
  pcmLatentKjPerKg: 196,
  designUaWPerK: 0.39,
}

/** Thermal mass of the milk charge, kJ/K. */
export function milkThermalMass(fillL: number): number {
  return fillL * MILK_RHO * MILK_CP
}

/** Total latent energy of a fully charged cartridge, kJ. */
export function pcmCapacityKj(spec: CanSpec): number {
  return spec.pcmKg * spec.pcmLatentKjPerKg
}

/**
 * Effective UA rises when the lid is open — the gasket path is the weakest
 * link in the envelope, and an open lid roughly triples ingress. The research
 * note budgets 20-35% of total UA to the lid and thermal bridges.
 */
export function effectiveUa(spec: CanSpec, lidOpen: boolean): number {
  return lidOpen ? spec.designUaWPerK * 3.1 : spec.designUaWPerK
}

/** Steady-state heat ingress at a given ambient delta, watts. */
export function ingressWatts(ua: number, ambientC: number, milkC: number): number {
  return ua * (ambientC - milkC)
}

/**
 * Project minutes until the milk crosses the top of the safe band.
 *
 * While latent heat remains, the PCM absorbs the ingress and the milk holds
 * near the melt point, so cold life is dominated by how long the cartridge
 * lasts. Once it is spent, the can is bare insulation and the milk warms on the
 * lumped-capacitance exponential:
 *
 *   t = (m.cp / UA) . ln[(Tamb - T0) / (Tamb - T1)]
 */
export function projectColdLifeMin(
  spec: CanSpec,
  reading: Reading,
  pcmRemainingKj: number,
): number {
  const ua = effectiveUa(spec, reading.lid === "open")
  const { ambientC, milkCoreC, fillL } = reading

  // Already breached, or ambient is colder than the milk: no meaningful countdown.
  if (milkCoreC >= SAFE_BAND.max) return 0
  if (ambientC <= SAFE_BAND.max) return Infinity

  const mcp = milkThermalMass(fillL) // kJ/K
  let minutes = 0

  // Phase 1 — PCM buffering. Ingress is soaked by latent heat at ~constant temp.
  if (pcmRemainingKj > 0) {
    const ingressKw = ingressWatts(ua, ambientC, milkCoreC) / 1000 // kJ/s
    if (ingressKw > 0) {
      minutes += pcmRemainingKj / ingressKw / 60
    }
  }

  // Phase 2 — bare insulation. Exponential approach to ambient.
  const start = pcmRemainingKj > 0 ? Math.min(milkCoreC, spec.pcmMeltC) : milkCoreC
  const num = ambientC - start
  const den = ambientC - SAFE_BAND.max
  if (num > 0 && den > 0 && num > den) {
    const seconds = (mcp / (ua / 1000)) * Math.log(num / den)
    minutes += seconds / 60
  }

  return Math.max(0, minutes)
}

/**
 * MBRT grade projected from cumulative time spent outside the safe band.
 *
 * Psychrotroph load compounds with warm minutes, and BIS IS 1479 grading is
 * what actually sets the farmer's price — so this is the number that turns a
 * temperature chart into rupees.
 */
export function projectMbrt(minutesAboveBand: number): MbrtGrade {
  if (minutesAboveBand < 20) return "I"
  if (minutesAboveBand < 75) return "II"
  if (minutesAboveBand < 180) return "III"
  return "IV"
}

/** Classify a node for the roster. Order matters: worst condition wins. */
export function classify(reading: Reading, coldLifeMin: number): Derived["status"] {
  if (reading.milkCoreC > SAFE_BAND.max) return "breach"
  if (reading.milkCoreC > SAFE_BAND.max - 1.5) return "watch"
  if (coldLifeMin < 60) return "watch"
  return "nominal"
}

/**
 * Recover UA from two samples by inverting the lumped-capacitance solution.
 * This is what the field test protocol in the research note actually measures,
 * so showing a *fitted* UA next to the *design* UA is the honest way to say
 * "the build matches the model" — or that it does not.
 */
export function fitUa(a: Reading, b: Reading): number | null {
  const dtSec = (b.t - a.t) / 1000
  if (dtSec <= 0) return null

  const ambient = (a.ambientC + b.ambientC) / 2
  const num = ambient - a.milkCoreC
  const den = ambient - b.milkCoreC
  if (num <= 0 || den <= 0 || num === den) return null

  const mcp = milkThermalMass(b.fillL) // kJ/K
  const uaKwPerK = (mcp * Math.log(num / den)) / dtSec
  const ua = uaKwPerK * 1000 // W/K
  return Number.isFinite(ua) && ua > 0 ? ua : null
}
