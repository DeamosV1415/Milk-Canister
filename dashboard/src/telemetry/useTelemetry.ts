import { useEffect, useState } from "react"
import { telemetrySource } from "./index"
import { deriveSnapshot } from "./derive"
import type { DemoControls } from "./source"
import type { FleetSnapshot } from "./types"

/**
 * Subscribes to the configured telemetry source for the lifetime of the app
 * and derives verdicts from each raw snapshot. Returns `null` until the first
 * snapshot lands, so callers render an explicit loading state.
 */
export function useTelemetry(): {
  snapshot: FleetSnapshot | null
  label: string
  isLive: boolean
  demo: DemoControls | undefined
} {
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(null)

  useEffect(() => telemetrySource.subscribe((raw) => setSnapshot(deriveSnapshot(raw))), [])

  return {
    snapshot,
    label: telemetrySource.label,
    isLive: telemetrySource.isLive,
    demo: telemetrySource.demo,
  }
}
