/**
 * Simulated fleet. Integrates the thermal model in `thermal.ts` forward in
 * time, so what you see on screen is the physics of a PCM-buffered can rather
 * than a decorative random walk.
 *
 * Each node is seeded into a different part of the collection cycle, so the
 * roster shows the full range of states the product has to handle at once:
 * a freshly charged can, one mid-route with the lid being opened at each
 * doorstep, one whose cartridge is spent, and one that has lost uplink.
 */

import type {
  CanNode,
  CanSpec,
  Derived,
  EventKind,
  FleetEvent,
  FleetSnapshot,
  LidState,
  Reading,
} from "./types"
import { MILK_FREEZE_POINT_C, SAFE_BAND } from "./types"
import {
  DEFAULT_SPEC,
  classify,
  effectiveUa,
  ingressWatts,
  milkThermalMass,
  pcmCapacityKj,
  projectColdLifeMin,
  projectMbrt,
} from "./thermal"
import type { TelemetrySource } from "./source"

/** Simulated seconds advanced per real second. Keeps a demo watchable. */
const TIME_SCALE = 90
/** Wall-clock interval between integration steps, ms. */
const TICK_MS = 1000
/** Rolling history depth, samples. At 90x this is ~5 simulated hours. */
const HISTORY_LEN = 200

interface NodeState {
  id: string
  route: string
  operator: string
  spec: CanSpec
  /** Unspent latent heat in the cartridge, kJ. */
  pcmKj: number
  milkCoreC: number
  milkTopC: number
  wallC: number
  pcmC: number
  ambientBaseC: number
  ph: number
  lid: LidState
  lidTimer: number
  fillL: number
  batteryPct: number
  minutesAboveBand: number
  online: boolean
  history: Reading[]
  /** Tracks band crossings so we only log the transition, not every tick. */
  wasInBand: boolean
}

let seq = 0
const uid = () => `e${(++seq).toString(36)}${Date.now().toString(36).slice(-4)}`

/** Deterministic-ish jitter so probes look like probes, not like math. */
const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp

function seedNodes(): NodeState[] {
  const base = (
    id: string,
    route: string,
    operator: string,
    over: Partial<NodeState>,
  ): NodeState => {
    const spec = { ...DEFAULT_SPEC, ...(over.spec ?? {}) }
    const fillL = over.fillL ?? 34
    return {
      id,
      route,
      operator,
      pcmKj: pcmCapacityKj(spec),
      milkCoreC: 4.1,
      milkTopC: 4.4,
      wallC: 3.6,
      pcmC: spec.pcmMeltC,
      ambientBaseC: 34,
      ph: 6.7,
      lid: "sealed",
      lidTimer: 0,
      fillL,
      batteryPct: 96,
      minutesAboveBand: 0,
      online: true,
      history: [],
      wasInBand: true,
      ...over,
      spec,
    }
  }

  return [
    // Freshly charged at the society chiller, full cartridge, sealed.
    base("CAN-04", "MANDYA / HALAGUR", "R. SHIVANNA", {
      milkCoreC: 3.9,
      ambientBaseC: 33,
      fillL: 38,
    }),
    // Mid-route doorstep collection: lid cycles, PCM half spent.
    base("CAN-11", "MANDYA / KIRUGAVALU", "B. LAKSHMI", {
      milkCoreC: 6.4,
      ambientBaseC: 39,
      fillL: 27,
      ph: 6.64,
      minutesAboveBand: 8,
    }),
    // Cartridge effectively spent, ambient spike, actively breaching.
    base("CAN-02", "MANDYA / BASARALU", "K. MAHESH", {
      milkCoreC: 9.4,
      ambientBaseC: 43,
      fillL: 31,
      ph: 6.55,
      minutesAboveBand: 96,
      wasInBand: false,
    }),
    // Long hill leg, cold and healthy, but battery is the constraint.
    base("CAN-19", "CHIKMAGALUR / MULLAYANAGIRI", "S. THIMMAPPA", {
      milkCoreC: 3.2,
      ambientBaseC: 27,
      fillL: 18,
      batteryPct: 21,
    }),
    // Uplink lost — last known values freeze, and the UI must say so.
    base("CAN-07", "MANDYA / DUDDA", "N. GOWRAMMA", {
      milkCoreC: 5.1,
      ambientBaseC: 37,
      fillL: 22,
      online: false,
      batteryPct: 64,
    }),
  ]
}

/**
 * Advance one node by `dtSec` simulated seconds.
 * Returns any events the step produced.
 */
function step(n: NodeState, dtSec: number, now: number): FleetEvent[] {
  const events: FleetEvent[] = []
  const emit = (kind: EventKind, detail: string, severity: FleetEvent["severity"]) =>
    events.push({ id: uid(), t: now, nodeId: n.id, kind, detail, severity })

  if (!n.online) {
    // Offline nodes stop reporting. State is frozen, deliberately: showing a
    // smoothly-updating trace for a can we cannot hear from would be a lie.
    if (Math.random() < 0.02) {
      n.online = true
      emit("handover", "uplink reacquired", "info")
    }
    return events
  }

  // --- Ambient: diurnal drift plus probe noise --------------------------
  const dayPhase = Math.sin(now / 1000 / 600) // slow swing over the demo
  const ambientC = n.ambientBaseC + dayPhase * 2.2 + noise(0.25)

  // --- Lid events: doorstep collection opens the can --------------------
  n.lidTimer -= dtSec
  if (n.lidTimer <= 0) {
    if (n.lid === "open") {
      n.lid = "sealed"
      n.lidTimer = 240 + Math.random() * 900
      emit("lid-seal", "Lid sealed, gasket seated", "info")
    } else if (Math.random() < 0.35) {
      n.lid = "open"
      n.lidTimer = 25 + Math.random() * 55
      emit("lid-open", "Lid open, doorstep intake", "warn")
    } else {
      n.lidTimer = 180 + Math.random() * 600
    }
  }

  // --- Heat balance ------------------------------------------------------
  const ua = effectiveUa(n.spec, n.lid === "open")
  const ingress = ingressWatts(ua, ambientC, n.milkCoreC) // W == J/s
  const ingressKj = (ingress * dtSec) / 1000
  const mcp = milkThermalMass(n.fillL) // kJ/K

  if (n.pcmKj > 0 && ingressKj > 0) {
    // Cartridge soaks the ingress. The milk barely moves — this plateau is
    // the product working, and it is the shape the demo needs to show.
    const soaked = Math.min(n.pcmKj, ingressKj)
    n.pcmKj -= soaked
    const leftover = ingressKj - soaked
    n.milkCoreC += leftover / mcp
    // The cartridge holds at its melt point while latent heat remains.
    n.pcmC = n.spec.pcmMeltC + noise(0.08)
    // Milk creeps toward the melt point rather than sitting pinned to it.
    n.milkCoreC += (n.spec.pcmMeltC - n.milkCoreC) * Math.min(1, dtSec / 5400) * 0.6
  } else {
    // Cartridge spent. Bare insulation from here — exponential warming.
    n.milkCoreC += ingressKj / mcp
    n.pcmC += (ambientC - n.pcmC) * Math.min(1, dtSec / 3600)
  }

  n.milkCoreC += noise(0.012)

  // Stratification: the top of the column runs warmer, more so when open.
  const stratify = n.lid === "open" ? 1.1 : 0.35
  n.milkTopC = n.milkCoreC + stratify + noise(0.05)
  // The wall beside the cartridge is the coldest point in the vessel.
  n.wallC = n.milkCoreC - (n.pcmKj > 0 ? 1.4 : 0.2) + noise(0.06)

  // --- Freeze-risk guard -------------------------------------------------
  if (n.wallC <= MILK_FREEZE_POINT_C) {
    emit("freeze-risk", `Wall ${n.wallC.toFixed(2)} °C, fat globule risk`, "critical")
  }

  // --- Band accounting and pH -------------------------------------------
  const inBand = n.milkCoreC <= SAFE_BAND.max
  if (!inBand) {
    n.minutesAboveBand += dtSec / 60
    // Psychrotroph activity drops pH as lactic acid accumulates. Rate rises
    // steeply with temperature — roughly a doubling per 3 degC over the band.
    const excess = n.milkCoreC - SAFE_BAND.max
    n.ph -= (dtSec / 3600) * 0.018 * Math.pow(2, excess / 3)
  }
  n.ph = Math.max(6.1, Math.min(6.78, n.ph + noise(0.0009)))

  if (n.wasInBand && !inBand) {
    emit("band-exit", `Core ${n.milkCoreC.toFixed(1)} °C, above 8.0 °C`, "critical")
    n.wasInBand = false
  } else if (!n.wasInBand && inBand) {
    emit("band-return", `Core ${n.milkCoreC.toFixed(1)} °C, back in band`, "info")
    n.wasInBand = true
  }

  // --- Cartridge depletion warning --------------------------------------
  const chargeFrac = n.pcmKj / pcmCapacityKj(n.spec)
  if (chargeFrac > 0 && chargeFrac < 0.15 && Math.random() < 0.02) {
    emit("pcm-low", `Cartridge ${Math.round(chargeFrac * 100)}%, swap at centre`, "warn")
  }

  // --- Housekeeping ------------------------------------------------------
  n.batteryPct = Math.max(0, n.batteryPct - dtSec / 90000)

  const reading: Reading = {
    t: now,
    milkCoreC: n.milkCoreC,
    milkTopC: n.milkTopC,
    wallC: n.wallC,
    ambientC,
    pcmC: n.pcmC,
    ph: n.ph,
    lid: n.lid,
    fillL: n.fillL,
    batteryPct: n.batteryPct,
    rssiDbm: -78 + noise(6),
  }

  n.history.push(reading)
  if (n.history.length > HISTORY_LEN) n.history.shift()

  return events
}

function toNode(n: NodeState): CanNode {
  const last =
    n.history[n.history.length - 1] ??
    ({
      t: Date.now(),
      milkCoreC: n.milkCoreC,
      milkTopC: n.milkTopC,
      wallC: n.wallC,
      ambientC: n.ambientBaseC,
      pcmC: n.pcmC,
      ph: n.ph,
      lid: n.lid,
      fillL: n.fillL,
      batteryPct: n.batteryPct,
      rssiDbm: -78,
    } satisfies Reading)

  const coldLifeMin = projectColdLifeMin(n.spec, last, n.pcmKj)
  const ua = effectiveUa(n.spec, last.lid === "open")

  const derived: Derived = {
    pcmChargeFrac: n.pcmKj / pcmCapacityKj(n.spec),
    coldLifeMin,
    uaWPerK: ua,
    ingressW: ingressWatts(ua, last.ambientC, last.milkCoreC),
    minutesAboveBand: n.minutesAboveBand,
    mbrtGrade: projectMbrt(n.minutesAboveBand),
    status: n.online ? classify(last, coldLifeMin) : "offline",
  }

  return {
    id: n.id,
    route: n.route,
    operator: n.operator,
    spec: n.spec,
    reading: last,
    derived,
    history: n.history,
  }
}

export class SimulatedTelemetrySource implements TelemetrySource {
  readonly label = "SIMULATED FEED / THERMAL MODEL"
  readonly isLive = false

  subscribe(cb: (snapshot: FleetSnapshot) => void): () => void {
    const nodes = seedNodes()
    let events: FleetEvent[] = []

    /** Simulated wall clock, advanced at TIME_SCALE. Readings are stamped from
     *  this, never from Date.now() — otherwise the physics runs at 90x while
     *  the time axis runs at 1x and the chart's labels are a lie. */
    let simClock = 0

    // Prime each node with history so the traces are populated on first paint
    // instead of drawing themselves in from an empty axis.
    const warmupSteps = HISTORY_LEN
    simClock = Date.now() - warmupSteps * TICK_MS * TIME_SCALE
    for (let i = 0; i < warmupSteps; i++) {
      simClock += TICK_MS * TIME_SCALE
      for (const n of nodes) step(n, TICK_MS * (TIME_SCALE / 1000), simClock)
    }
    events = []

    const publish = () => {
      cb({
        t: Date.now(),
        nodes: nodes.map(toNode),
        events: events.slice(0, 60),
      })
    }

    publish()

    const handle = window.setInterval(() => {
      simClock += TICK_MS * TIME_SCALE
      const now = simClock
      const produced: FleetEvent[] = []
      for (const n of nodes) {
        produced.push(...step(n, TICK_MS * (TIME_SCALE / 1000), now))
      }

      // Uplink dropout is managed at fleet level so at most ONE can is ever
      // dark. Rolling it per-node let several drop at once and never recover,
      // which made most of the roster unreadable within a minute.
      if (!nodes.some((n) => !n.online) && Math.random() < 0.004) {
        const victim = nodes[Math.floor(Math.random() * nodes.length)]
        victim.online = false
        produced.push({
          id: uid(),
          t: now,
          nodeId: victim.id,
          kind: "uplink-loss",
          detail: "LoRaWAN uplink lost",
          severity: "critical",
        })
      }

      if (produced.length) {
        events = [...produced.reverse(), ...events].slice(0, 60)
      }
      publish()
    }, TICK_MS)

    return () => window.clearInterval(handle)
  }
}
