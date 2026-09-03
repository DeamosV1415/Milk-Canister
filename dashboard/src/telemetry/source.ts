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
 *   export class MqttTelemetrySource implements TelemetrySource {
 *     subscribe(cb: (snap: FleetSnapshot) => void) {
 *       const client = mqtt.connect(BROKER_URL)
 *       client.on("message", (_topic, buf) => cb(decode(buf)))
 *       return () => client.end()
 *     }
 *   }
 *
 * The only contract is: call `cb` with a complete `FleetSnapshot` whenever new
 * data arrives, and return a teardown function. Push or poll, MQTT or HTTP or
 * WebSocket — the dashboard does not care.
 */

import type { FleetSnapshot } from "./types"

export interface TelemetrySource {
  /**
   * Begin delivering snapshots. Must invoke `cb` once with current state as
   * soon as it is available, then again on every update.
   *
   * @returns teardown that stops delivery and releases the transport.
   */
  subscribe(cb: (snapshot: FleetSnapshot) => void): () => void

  /** Human-readable transport label, rendered in the status bar. */
  readonly label: string

  /** False for simulated data, so the UI can mark it as such. Never lie here. */
  readonly isLive: boolean
}
