/**
 * The seam between the dashboard and the world.
 *
 * ------------------------------------------------------------------------
 * FOR THE HARDWARE TEAM
 * ------------------------------------------------------------------------
 * To go from dummy data to the real fleet, you write ONE new file that
 * implements `TelemetrySource` and change ONE line in `src/telemetry/index.ts`.
 * Nothing in `src/components` imports the simulator directly, so no UI code
 * changes.
 *
 *   export class HttpTelemetrySource implements TelemetrySource {
 *     readonly label = "ESP32 fleet"
 *     readonly isLive = true
 *     subscribe(cb: (snap: RawSnapshot) => void) {
 *       const poll = async () => cb(await (await fetch(API_URL)).json())
 *       poll()
 *       const h = setInterval(poll, 15_000)
 *       return () => clearInterval(h)
 *     }
 *   }
 *
 * The only contract is: call `cb` with a complete `RawSnapshot` whenever new
 * data arrives, and return a teardown. Send readings only — status, cold life,
 * "offline" and the day's events are all worked out dashboard-side.
 */

import type { RawSnapshot } from "./types"

export interface TelemetrySource {
  /**
   * Begin delivering snapshots. Must invoke `cb` once with current state as
   * soon as it is available, then again on every update.
   *
   * @returns teardown that stops delivery and releases the transport.
   */
  subscribe(cb: (snapshot: RawSnapshot) => void): () => void

  /** Human-readable transport label. */
  readonly label: string

  /** False for simulated data, so the UI can mark it as such. Never lie here. */
  readonly isLive: boolean

  /**
   * Presenter controls. Only the simulator has these; a real source leaves
   * this undefined and the demo panel never renders.
   */
  readonly demo?: DemoControls
}

/** Things that can go wrong with a can, on demand, for a live demo. */
export type Scenario = "lidOpen" | "heatwave" | "coolerFault" | "batteryDead" | "signalLost"

export interface DemoControls {
  /** Switch a scenario on or off for one can. */
  toggle(nodeId: string, scenario: Scenario): void
  /** Which scenarios are currently switched on for one can. */
  active(nodeId: string): ReadonlySet<Scenario>
  /** Run the simulation forward instantly. */
  skip(minutes: number): void
  /** Clear every scenario on a can and put it back in working order. */
  fix(nodeId: string): void
}
