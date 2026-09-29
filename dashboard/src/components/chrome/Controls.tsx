import { cn } from "@/lib/utils"

/* ===========================================================================
   Small interactive controls. Built here rather than pulled in, because each
   one has to obey the palette and the 12px corner exactly.
   =========================================================================== */

/**
 * Segmented control. The sliding indicator is a sibling absolute element, so
 * only `transform` animates — no layout thrash while it moves.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  className?: string
  ariaLabel: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex rounded-lg border border-line bg-sunk p-0.5",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 rounded-[6px] bg-surface shadow-[0_1px_2px_rgba(38,36,31,0.06)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          left: 2,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 min-w-[52px] px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-200",
            o.value === value ? "text-ink" : "text-ink-faint hover:text-ink-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Loading placeholder shaped like the thing it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-sunk", className)}
    />
  )
}
