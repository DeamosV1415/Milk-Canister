import type { ReactNode } from "react"
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning"
import { motion, useReducedMotion } from "motion/react"
import type { CanNode } from "@/telemetry/types"

/**
 * Only when the milk is too warm. The one element on the page allowed to be a
 * solid block of colour — it has to win against everything else, and it only
 * gets to because it is rare.
 */
export function AlertBanner({ node, action }: { node: CanNode; action?: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      role="alert"
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] bg-risk px-5 py-4 text-white"
    >
      <WarningIcon size={24} weight="fill" className="shrink-0" aria-hidden />
      {/* Wide enough minimum that on a phone the button drops to its own row
          instead of crushing the sentence into a column. */}
      <div className="min-w-[min(100%,240px)] flex-1">
        <p className="t-title text-[16px]">{node.id} is too warm</p>
        <p className="text-[13px] text-white/90">
          Sell it now at the nearest dairy, or get it to a chiller.
        </p>
      </div>
      {action}
    </motion.div>
  )
}
