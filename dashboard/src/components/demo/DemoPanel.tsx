import type { ReactNode } from "react"
import { BatteryEmptyIcon } from "@phosphor-icons/react/dist/csr/BatteryEmpty"
import { DoorOpenIcon } from "@phosphor-icons/react/dist/csr/DoorOpen"
import { FastForwardIcon } from "@phosphor-icons/react/dist/csr/FastForward"
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal"
import { ThermometerHotIcon } from "@phosphor-icons/react/dist/csr/ThermometerHot"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash"
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import type { DemoControls, Scenario } from "@/telemetry/source"
import type { CanNode } from "@/telemetry/types"

/*
  Presenter controls, for a demo without hardware. Press D.

  Everything here goes through the simulator's `DemoControls`; a real source
  does not provide them, so this panel can never appear over live data.
*/

const SCENARIOS: Array<{ id: Scenario; label: string; icon: ReactNode }> = [
  { id: "lidOpen", label: "Leave lid open", icon: <DoorOpenIcon size={16} weight="bold" /> },
  { id: "heatwave", label: "Heatwave, +8°", icon: <ThermometerHotIcon size={16} weight="bold" /> },
  { id: "coolerFault", label: "Cooler fails", icon: <WarningCircleIcon size={16} weight="bold" /> },
  { id: "batteryDead", label: "Battery dies", icon: <BatteryEmptyIcon size={16} weight="bold" /> },
  { id: "signalLost", label: "Lose signal", icon: <WifiSlashIcon size={16} weight="bold" /> },
]

export function DemoPanel({
  open,
  demo,
  node,
  onClose,
}: {
  open: boolean
  demo: DemoControls
  node: CanNode | null
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const active = node ? demo.active(node.id) : new Set<Scenario>()

  return (
    <AnimatePresence>
      {open && node ? (
        <motion.aside
          role="dialog"
          aria-label="Demo controls"
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_40px_rgba(38,36,31,0.14)] sm:inset-x-auto sm:right-5 sm:bottom-14 sm:w-[340px]"
        >
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-ink text-canvas">
                <SlidersHorizontalIcon size={16} weight="bold" />
              </span>
              <div className="leading-tight">
                <p className="t-title text-[15px] text-ink">Demo controls</p>
                <p className="t-label">
                  Acting on <span className="font-semibold text-ink">{node.id}</span>. Press D to hide.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close demo controls"
              className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-sunk hover:text-ink"
            >
              <XIcon size={16} weight="bold" />
            </button>
          </header>

          <p className="t-label mt-4 mb-2">Make something go wrong</p>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIOS.map((s) => {
              const on = active.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => demo.toggle(node.id, s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
                    on
                      ? "border-ink bg-ink text-canvas"
                      : "border-line bg-surface text-ink-soft hover:border-ink/25 hover:text-ink",
                  )}
                >
                  {s.icon}
                  {s.label}
                </button>
              )
            })}
          </div>

          <p className="t-label mt-4 mb-2">Move time forward</p>
          <div className="grid grid-cols-2 gap-2">
            {[1, 3].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => demo.skip(h * 60)}
                className="flex items-center justify-center gap-2 rounded-lg border border-line bg-sunk px-3 py-2 text-[13px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-line active:scale-[0.98]"
              >
                <FastForwardIcon size={16} weight="fill" />
                Skip {h} {h === 1 ? "hour" : "hours"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => demo.fix(node.id)}
            disabled={active.size === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-fresh px-3 py-2.5 text-[13.5px] font-semibold text-white transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            <WrenchIcon size={16} weight="bold" />
            Fix this can
          </button>
          <p className="t-label mt-2.5 text-center text-[11.5px]">
            Demo data only. A real feed has no controls.
          </p>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
