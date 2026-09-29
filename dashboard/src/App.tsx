import { useCallback, useEffect, useMemo, useState } from "react"
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop"
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal"
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack"
import Noise from "@/components/Noise"
import CountUp from "@/components/CountUp"
import ClickSpark from "@/components/ClickSpark"
import GradualBlur from "@/components/GradualBlur"
import { HeaderBar } from "@/components/chrome/HeaderBar"
import { Skeleton } from "@/components/chrome/Controls"
import { DemoPanel } from "@/components/demo/DemoPanel"
import { CanStrip } from "@/components/fleet/CanStrip"
import { FleetRoster } from "@/components/fleet/FleetRoster"
import { NodeDetail } from "@/components/node/NodeDetail"
import type { SentAlert } from "@/components/node/PhonePreview"
import { manualMessage } from "@/lib/story"
import { timeline } from "@/lib/timeline"
import { useTelemetry } from "@/telemetry/useTelemetry"
import type { CanNode } from "@/telemetry/types"

export default function App() {
  const { snapshot, isLive, demo } = useTelemetry()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [sent, setSent] = useState<Record<string, SentAlert[]>>({})

  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot])
  const now = snapshot?.t ?? 0

  // Land on whichever can needs attention first. Chosen during render (React's
  // "adjust state while rendering" pattern) rather than in an effect, so there
  // is never a first frame showing some other can — that frame used to send
  // the phone strip scrolling toward the wrong card.
  if (selectedId == null && nodes.length) setSelectedId(firstToShow(nodes))

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

  // Presenter shortcut. Ignored while typing, and absent entirely on live data.
  useEffect(() => {
    if (!demo) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (e.key === "d" || e.key === "D") setDemoOpen((o) => !o)
      if (e.key === "Escape") setDemoOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [demo])

  const sendAlert = useCallback(() => {
    if (!selected) return
    const text = manualMessage(selected, now, timeline(selected))
    setSent((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), { t: now, text }] }))
  }, [selected, now])

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas lg:h-dvh lg:overflow-hidden">
      {/* A whisper of warm grain so the large flat areas read as paper rather
          than as an empty div. Barely there by design. */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-multiply">
        <Noise patternSize={300} patternAlpha={6} patternRefreshInterval={40} />
      </div>

      <HeaderBar nodes={nodes} isLive={isLive} now={now} />

      {!snapshot ? (
        <LoadingState />
      ) : (
        <main className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[356px_1fr]">
          {/* ---- Your cans: desktop list ------------------------------------ */}
          <aside className="hidden min-h-0 flex-col border-r border-line bg-canvas lg:flex">
            <div className="flex shrink-0 items-center gap-2.5 px-5 pt-5 pb-3">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-sunk text-ink-soft">
                <StackIcon size={17} weight="bold" />
              </span>
              <div>
                <h2 className="t-title text-[15px] text-ink">Your cans</h2>
                <p className="t-label mt-0.5">Needs attention first</p>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <ClickSpark sparkColor="#26241f" sparkSize={7} sparkRadius={13} sparkCount={6} duration={330}>
                <div className="h-full overflow-y-auto">
                  <FleetRoster nodes={nodes} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
                </div>
              </ClickSpark>
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

          {/* ---- Your cans: phone strip ------------------------------------- */}
          <div className="sticky top-0 z-20 lg:hidden">
            <CanStrip
              nodes={nodes}
              selectedId={selected?.id ?? ""}
              onSelect={setSelectedId}
              litresSafe={litresSafe}
              litresTotal={litresTotal}
            />
          </div>

          {/* ---- Selected can ----------------------------------------------- */}
          {selected ? (
            <NodeDetail
              key={selected.id}
              node={selected}
              now={now}
              sent={sent[selected.id] ?? []}
              onAlert={sendAlert}
            />
          ) : (
            <div className="flex items-center justify-center p-10">
              <span className="text-[14px] text-ink-faint">Pick a can to see how it is doing</span>
            </div>
          )}
        </main>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line bg-surface px-4 py-2.5 lg:px-6">
        <span className="text-[12px] text-ink-faint">ChillCan · SIH 26110</span>
        <span className="flex items-center gap-4 text-[12px] text-ink-faint">
          {isLive ? "Live readings from your cans" : "Demo data, not real readings yet"}
          {demo ? (
            <button
              type="button"
              onClick={() => setDemoOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-medium text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
            >
              <SlidersHorizontalIcon size={13} weight="bold" />
              Demo controls
              <kbd className="rounded border border-line bg-sunk px-1 font-sans text-[11px]">D</kbd>
            </button>
          ) : null}
        </span>
      </footer>

      {demo ? (
        <DemoPanel open={demoOpen} demo={demo} node={selected} onClose={() => setDemoOpen(false)} />
      ) : null}
    </div>
  )
}

/**
 * The worst can we can actually hear from. An offline can shows a frozen pane
 * and reads as a broken app on first load, so it only wins if nothing else is
 * reachable.
 */
function firstToShow(nodes: CanNode[]): string {
  const reachable = nodes.filter((n) => n.derived.status !== "offline")
  const pool = reachable.length ? reachable : nodes
  const rank = { breach: 0, watch: 1, nominal: 2, offline: 3 } as const
  return [...pool].sort(
    (a, b) =>
      rank[a.derived.status] - rank[b.derived.status] ||
      a.derived.coldLifeMin - b.derived.coldLifeMin,
  )[0].id
}

/**
 * Skeletons shaped like the real layout, not a spinner. The page that arrives
 * should look like the page that was promised.
 */
function LoadingState() {
  return (
    <main className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[356px_1fr]">
      <aside className="hidden flex-col gap-2 border-r border-line px-3 pt-5 lg:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
        ))}
      </aside>
      <div className="flex flex-col gap-4 p-4 lg:p-5">
        <Skeleton className="h-[380px] w-full rounded-[14px]" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      </div>
    </main>
  )
}
