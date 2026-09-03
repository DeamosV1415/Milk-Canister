import { useEffect, useMemo, useState } from "react"
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop"
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack"
import Noise from "@/components/Noise"
import CountUp from "@/components/CountUp"
import ClickSpark from "@/components/ClickSpark"
import GradualBlur from "@/components/GradualBlur"
import { HeaderBar } from "@/components/chrome/HeaderBar"
import { Skeleton } from "@/components/chrome/Controls"
import { FleetRoster } from "@/components/fleet/FleetRoster"
import { NodeDetail } from "@/components/node/NodeDetail"
import { useTelemetry } from "@/telemetry/useTelemetry"

export default function App() {
  const { snapshot, isLive } = useTelemetry()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodes = snapshot?.nodes ?? []

  // Land on whichever can needs attention first, preferring one we can
  // actually hear from — an offline node shows a frozen pane and reads as a
  // broken app.
  useEffect(() => {
    if (selectedId || !nodes.length) return
    const reachable = nodes.filter((n) => n.derived.status !== "offline")
    const pool = reachable.length ? reachable : nodes
    const worst = [...pool].sort((a, b) => a.derived.coldLifeMin - b.derived.coldLifeMin)[0]
    setSelectedId(worst.id)
  }, [nodes, selectedId])

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? nodes[0] ?? null,
    [nodes, selectedId],
  )

  const litresSafe = useMemo(
    () =>
      nodes
        .filter((n) => n.derived.status !== "breach" && n.derived.status !== "offline")
        .reduce((a, n) => a + n.reading.fillL, 0),
    [nodes],
  )
  const litresTotal = useMemo(() => nodes.reduce((a, n) => a + n.reading.fillL, 0), [nodes])

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-canvas">
      {/* A whisper of warm grain so the large flat areas read as paper rather
          than as an empty div. Barely there by design. */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-multiply">
        <Noise patternSize={300} patternAlpha={6} patternRefreshInterval={40} />
      </div>

      <HeaderBar nodes={nodes} isLive={isLive} />

      {!snapshot ? (
        <LoadingState />
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[356px_1fr]">
          {/* ---- Your cans ---------------------------------------------- */}
          <aside className="flex min-h-0 flex-col border-r border-line bg-canvas">
            <div className="flex shrink-0 items-center gap-2.5 px-5 pt-5 pb-3">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-sunk text-ink-soft"
              >
                <StackIcon size={17} weight="bold" />
              </span>
              <div>
                <h2 className="t-title text-[15px] text-ink">Your cans</h2>
                <p className="t-label mt-0.5">Needs attention first</p>
              </div>
            </div>

            {/* Selecting a can is the one thing you do here, so it gets a
                little tactile feedback. Sparks are ink-coloured, not festive. */}
            <div className="relative min-h-0 flex-1">
              <ClickSpark sparkColor="#26241f" sparkSize={7} sparkRadius={13} sparkCount={6} duration={330}>
                <div className="h-full overflow-y-auto">
                  <FleetRoster
                    nodes={nodes}
                    selectedId={selected?.id ?? ""}
                    onSelect={setSelectedId}
                  />
                </div>
              </ClickSpark>

              {/* Softens the cut where the list runs under the total below. */}
              <GradualBlur
                target="parent"
                position="bottom"
                height="2.5rem"
                strength={1.4}
                divCount={4}
                curve="ease-out"
                opacity={0.9}
                zIndex={5}
              />
            </div>

            {/* One aggregate, phrased as reassurance rather than a metric. */}
            <div className="shrink-0 border-t border-line px-5 py-4">
              <p className="t-label flex items-center gap-1.5">
                <DropIcon size={15} weight="fill" className="shrink-0 opacity-70" />
                Milk still cold today
              </p>
              <p className="t-display mt-1.5 text-[26px] text-ink">
                <CountUp to={Math.round(litresSafe)} duration={1.2} />
                <span className="ml-1 text-[15px] font-medium text-ink-faint">
                  of {Math.round(litresTotal)} litres
                </span>
              </p>
            </div>
          </aside>

          {/* ---- Selected can -------------------------------------------- */}
          {selected ? (
            <NodeDetail node={selected} />
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-[14px] text-ink-faint">Pick a can to see how it is doing</span>
            </div>
          )}
        </main>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line bg-surface px-6 py-2.5">
        <span className="text-[12px] text-ink-faint">ChillCan · SIH 26110</span>
        <span className="text-[12px] text-ink-faint">
          {isLive ? "Live readings from your cans" : "Demo data — not real readings yet"}
        </span>
      </footer>
    </div>
  )
}

/**
 * Skeletons shaped like the real layout, not a spinner. The page that arrives
 * should look like the page that was promised.
 */
function LoadingState() {
  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[356px_1fr]">
      <aside className="flex min-h-0 flex-col gap-2 border-r border-line px-3 pt-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
        ))}
      </aside>
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-[132px] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-[140px] rounded-xl" />
          <Skeleton className="h-[140px] rounded-xl" />
        </div>
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
    </main>
  )
}
