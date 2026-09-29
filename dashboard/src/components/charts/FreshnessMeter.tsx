import { MBRT_LABEL, SAFE_BAND, type CanNode } from "@/telemetry/types"
import { duration } from "@/lib/format"
import { cn } from "@/lib/utils"

/* ===========================================================================
   Freshness.

   A seller does not need a time-series of pH — they need to know how fresh
   the milk is, whether it is still getting worse, and what grade they will be
   paid at. So pH becomes a position on a scale, and the grade becomes a word.
   =========================================================================== */

/** pH range shown on the scale. Below 6.3 the milk fails at the centre. */
const SCALE = { lo: 6.2, hi: 6.8 }

export function FreshnessMeter({ node }: { node: CanNode }) {
  const { reading, derived, history } = node
  const ph = reading.ph
  const pos = Math.max(0, Math.min(1, (ph - SCALE.lo) / (SCALE.hi - SCALE.lo)))

  // Still getting worse? Compare against roughly an hour ago.
  const ref = history[Math.max(0, history.length - 60)]?.ph ?? ph
  const falling = ph - ref < -0.004

  const verdict =
    ph >= 6.55
      ? { word: "Fresh", tone: "text-fresh", note: "Full price at the dairy" }
      : ph >= 6.42
        ? { word: "Turning", tone: "text-warn", note: "May be graded down" }
        : { word: "Sour", tone: "text-risk", note: "Likely to be turned away" }

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className={cn("t-display text-[32px]", verdict.tone)}>{verdict.word}</div>
          <p className="mt-1 text-[13px] text-ink-soft">{verdict.note}</p>
        </div>
        <div className="text-right">
          <div className="t-label">Grade</div>
          <div className="t-title text-[19px] text-ink">{MBRT_LABEL[derived.mbrtGrade]}</div>
        </div>
      </div>

      <div>
        <div className="relative">
          <div
            className="h-2.5 w-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-risk-line) 0%, var(--color-warn-line) 45%, var(--color-fresh-line) 100%)",
            }}
            aria-hidden
          />
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow-[0_1px_4px_rgba(38,36,31,0.18)] transition-[left] duration-500 ease-out"
            style={{ left: `${pos * 100}%` }}
            role="img"
            aria-label={`Freshness ${verdict.word}, pH ${ph.toFixed(2)}`}
          />
        </div>
        <div className="mt-2 flex justify-between">
          {["Sour", "Turning", "Fresh"].map((s) => (
            <span key={s} className="t-label text-[11.5px]">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* The "why". Only when there is something to explain. */}
      {derived.minutesAboveBand >= 1 ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          Above {SAFE_BAND.max}°C for{" "}
          <span className="font-semibold">{duration(derived.minutesAboveBand)}</span> today.{" "}
          {derived.mbrtGrade === "I"
            ? "Not enough to change the grade yet."
            : "That is what pushed the grade down."}
        </p>
      ) : null}

      <div className="flex items-center justify-between border-t border-line pt-3 text-[13px]">
        <span className="text-ink-soft">
          Acidity <span className="tnum font-semibold text-ink">{ph.toFixed(2)} pH</span>
        </span>
        <span className={falling ? "text-warn" : "text-ink-faint"}>
          {falling ? "Still souring" : "Holding steady"}
        </span>
      </div>
    </div>
  )
}
