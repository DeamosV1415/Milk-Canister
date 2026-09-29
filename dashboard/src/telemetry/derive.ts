/**
 * Everything the dashboard infers from raw readings.
 *
 * Sources send readings; this file turns them into verdicts. Keeping it here
 * rather than in the firmware or the simulator means the real fleet and the
 * demo are judged by exactly the same code.
 */

import type {
  CanNode,
  Concern,
  Derived,
  FleetSnapshot,
  NodeStatus,
  RawNode,
  RawSnapshot,
  Reading,
} from "./types"
import { MILK_FREEZE_POINT_C, SAFE_BAND, STALE_AFTER_MS } from "./types"
import { project, projectMbrt } from "./thermal"

/** A lid open longer than this stops being a doorstep pour and becomes a problem. */
export const LID_CONCERN_MIN = 10
/** Cooling stopping within this window is worth a warning today. */
const BATTERY_CONCERN_MIN = 6 * 60

export function deriveSnapshot(raw: RawSnapshot): FleetSnapshot {
  return {
    t: raw.t,
    nodes: raw.nodes.filter((n) => n.history.length > 0).map((n) => deriveNode(n, raw.t)),
  }
}

export function deriveNode(raw: RawNode, now: number): CanNode {
  const history = raw.history
  const reading = history[history.length - 1]
  const online = now - reading.t <= STALE_AFTER_MS

  const { coldLifeMin, powerLeftMin } = project(raw.spec, reading)
  const minutesAboveBand = warmMinutes(history, raw.filledAt)
  const lidOpenMin = openFor(history)

  const partial = {
    coldLifeMin,
    powerLeftMin,
    minutesAboveBand,
    mbrtGrade: projectMbrt(minutesAboveBand),
    trendPerHour: trend(history),
    lidOpenMin,
  }
  const { status, concern } = classify(reading, partial, online)

  const derived: Derived = { ...partial, status, concern }
  return { ...raw, reading, derived }
}

/** Worst condition wins. Order here IS the priority order of the headline. */
function classify(
  r: Reading,
  d: Pick<Derived, "coldLifeMin" | "powerLeftMin" | "lidOpenMin">,
  online: boolean,
): { status: NodeStatus; concern: Concern } {
  if (!online) return { status: "offline", concern: "offline" }
  if (r.milkCoreC > SAFE_BAND.max) return { status: "breach", concern: "warm" }
  if (r.coldPlateC <= MILK_FREEZE_POINT_C) return { status: "watch", concern: "freeze" }
  if (r.cooler === "fault") return { status: "watch", concern: "cooler" }
  if (r.cooler === "off") return { status: "watch", concern: "no-power" }
  if (d.lidOpenMin >= LID_CONCERN_MIN) return { status: "watch", concern: "lid" }
  if (r.milkCoreC > SAFE_BAND.max - 1.5 || d.coldLifeMin < 120)
    return { status: "watch", concern: "warming" }
  if (d.powerLeftMin < BATTERY_CONCERN_MIN) return { status: "watch", concern: "battery" }
  return { status: "nominal", concern: "ok" }
}

/**
 * Time above the band since the milk went in. Gaps longer than the stale
 * threshold (no signal) are not counted — we do not know what happened there,
 * and inventing warm minutes would cost the seller money.
 */
function warmMinutes(history: Reading[], filledAt?: number): number {
  let ms = 0
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1]
    const b = history[i]
    if (filledAt != null && a.t < filledAt) continue
    const dt = b.t - a.t
    if (dt > STALE_AFTER_MS) continue
    if (a.milkCoreC > SAFE_BAND.max) ms += dt
  }
  return ms / 60_000
}

/** How long the lid has been continuously open, counting back from now. */
function openFor(history: Reading[]): number {
  const last = history[history.length - 1]
  if (last.lid !== "open") return 0
  let first = last
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].lid !== "open") break
    first = history[i]
  }
  return (last.t - first.t) / 60_000
}

/** Change over the last hour, degC. */
function trend(history: Reading[]): number {
  const last = history[history.length - 1]
  const target = last.t - 3600_000
  let ref = history[0]
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t <= target) {
      ref = history[i]
      break
    }
  }
  if (last.t - ref.t < 10 * 60_000) return 0
  return ((last.milkCoreC - ref.milkCoreC) / (last.t - ref.t)) * 3600_000
}
