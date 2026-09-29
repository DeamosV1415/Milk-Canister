/**
 * The words. Every sentence the seller reads about a can is built here, from
 * the concern the dashboard worked out, so the headline, the roster, the banner
 * and the phone all say the same thing in the same voice.
 */

import { SAFE_BAND, type CanNode } from "@/telemetry/types"
import { clock, clockDay, duration, titleCase } from "./format"
import { lastOf, warmSince, type CanEvent } from "./timeline"

export interface Headline {
  title: string
  detail: string
}

const safeUntil = (n: CanNode, now: number) =>
  Number.isFinite(n.derived.coldLifeMin)
    ? `Stays safe until ${clockDay(now + n.derived.coldLifeMin * 60_000, now)}.`
    : "Stays cold for the rest of the day."

export function headline(n: CanNode, now: number, events: CanEvent[]): Headline {
  const { reading: r, derived: d } = n
  const since = warmSince(events)
  const warmFor = since ? ` It has been above ${SAFE_BAND.max}°C since ${clock(since)}.` : ""

  switch (d.concern) {
    case "offline":
      return {
        title: "No signal from this can",
        detail: `Last reading at ${clockDay(r.t, now)}. The numbers here may be out of date.`,
      }
    case "warm": {
      if (r.cooler === "fault") {
        const at = lastOf(events, "cooler-stopped")
        return {
          title: "The cooler stopped working",
          detail: (at ? `It stopped at ${clock(at.t)}.` : "") + warmFor,
        }
      }
      if (r.cooler === "off")
        return { title: "The battery ran out", detail: "Cooling stopped." + warmFor }
      if (r.lid === "open")
        return { title: "The lid was left open", detail: "Warm air got in." + warmFor }
      return {
        title: "Too warm",
        detail: `It is ${Math.round(r.ambientC)}° outside, too hot for the cooler to keep up.` + warmFor,
      }
    }
    case "freeze":
      return {
        title: "Milk may be freezing on the cooler",
        detail: "The cold plate is below freezing. Get the cooler checked.",
      }
    case "cooler": {
      const at = lastOf(events, "cooler-stopped")
      return {
        title: "The cooler stopped working",
        detail: `${at ? `It stopped at ${clock(at.t)}. ` : ""}The milk is still cold. ${safeUntil(n, now)}`,
      }
    }
    case "no-power":
      return {
        title: "The battery is empty",
        detail: `Cooling has stopped. ${safeUntil(n, now)}`,
      }
    case "lid":
      return {
        title: "The lid is open",
        detail: `Open for ${duration(d.lidOpenMin)}. Close it, the milk is warming.`,
      }
    case "warming":
      return {
        title: "Getting close to warm",
        detail: Number.isFinite(d.coldLifeMin)
          ? `Goes above ${SAFE_BAND.max}°C at ${clockDay(now + d.coldLifeMin * 60_000, now)}. Keep it in the shade.`
          : "Keep it in the shade and the lid shut.",
      }
    case "battery":
      return {
        title: "Battery running low",
        detail: `Cooling stops at ${clockDay(now + d.powerLeftMin * 60_000, now)} unless it is charged.`,
      }
    case "ok":
      return { title: "Milk is cold and good", detail: safeUntil(n, now) }
  }
}

/** The short line under each can in the list. */
export function rosterNote(n: CanNode): string {
  const d = n.derived
  switch (d.concern) {
    case "offline":
      return "No signal"
    case "warm":
      return "Too warm now"
    case "freeze":
      return "Cooler too cold"
    case "cooler":
      return "Cooler stopped"
    case "no-power":
      return "Battery empty"
    case "lid":
      return "Lid open"
    case "warming":
      return "Getting close to warm"
    case "battery":
      return `Battery low · ${Math.round(n.reading.batteryPct)}%`
    case "ok":
      return Number.isFinite(d.coldLifeMin) ? `Cold for ${duration(d.coldLifeMin)}` : "Cold all day"
  }
}

/** "K. Mahesh" */
export const personName = (n: CanNode) => titleCase(n.operator)

/** What the automatic SMS says when one of these moments happens. */
export function eventMessage(n: CanNode, e: CanEvent): string | null {
  const t = e.reading.milkCoreC.toFixed(1)
  switch (e.kind) {
    case "filled":
      return `${n.id} filled with ${Math.round(e.reading.fillL)} L. We will message you if anything changes.`
    case "warm":
      return `${n.id} is too warm (${t}°C). Sell it now or get it to a chiller.`
    case "safe":
      return `${n.id} is back under ${SAFE_BAND.max}°C (${t}°C).`
    case "cooler-stopped":
      return `${n.id}: the cooler has stopped. The milk is still cold, but get it checked today.`
    case "power-out":
      return `${n.id}: the battery ran out and cooling has stopped. Charge it as soon as you can.`
    case "cooler-back":
      return `${n.id}: cooling is working again.`
    case "lid":
      return `${n.id}: the lid has been open for ${Math.round(
        Math.max(10, (n.reading.t - e.t) / 60_000),
      )} minutes. Please close it.`
    case "battery-low":
      return `${n.id}: battery is at ${Math.round(e.reading.batteryPct)}%. Charge it today so cooling does not stop.`
    case "signal-lost":
      return null
  }
}

/** What a manual "Alert" from the dashboard says. */
export function manualMessage(n: CanNode, now: number, events: CanEvent[]): string {
  const h = headline(n, now, events)
  const temp = `${n.reading.milkCoreC.toFixed(1)}°C`
  if (n.derived.status === "breach")
    return `Please check ${n.id} now: ${h.title.toLowerCase()}, milk is at ${temp}. Sell it or get it to a chiller.`
  return `Please check ${n.id}: ${h.title.toLowerCase()}. Milk is at ${temp}.`
}
