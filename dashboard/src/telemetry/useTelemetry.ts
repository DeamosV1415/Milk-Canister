import { useEffect, useState } from "react"
import { telemetrySource } from "./index"
import type { FleetSnapshot } from "./types"

/**
 * Subscribes to the configured telemetry source for the lifetime of the app.
 * Returns `null` until the first snapshot lands, so callers render an explicit
 * acquiring state rather than a flash of empty instruments.
 */
export function useTelemetry(): {
  snapshot: FleetSnapshot | null
  label: string
  isLive: boolean
} {
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(null)

  useEffect(() => telemetrySource.subscribe(setSnapshot), [])

  return {
    snapshot,
    label: telemetrySource.label,
    isLive: telemetrySource.isLive,
  }
}
