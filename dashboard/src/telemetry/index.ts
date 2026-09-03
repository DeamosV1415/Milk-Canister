/**
 * Composition root for telemetry.
 *
 * HARDWARE TEAM: this is the one line to change. Swap the constructor below
 * for your transport (see the worked example in `source.ts`) and the entire
 * dashboard switches over to the real fleet. No component imports change.
 */

import { SimulatedTelemetrySource } from "./simulator"
import type { TelemetrySource } from "./source"

export const telemetrySource: TelemetrySource = new SimulatedTelemetrySource()

export * from "./types"
export * from "./thermal"
export type { TelemetrySource } from "./source"
