/**
 * Simulated fleet. Integrates the thermal model in `thermal.ts` forward in
 * time, so what you see on screen is the physics of an insulated can with a
 * battery-powered Peltier — not a decorative random walk.
 *
 * Each can is seeded into a different situation so the roster shows the range
 * of states the product has to handle at once, and so the demo opens on
 * something worth talking about:
 *
 *   CAN-02  cooler failed overnight, milk has gone warm       -> too warm
 *   CAN-11  doorstep collection, lid left open at a stop      -> keep an eye
 *   CAN-19  hill route with no solar, battery nearly flat     -> keep an eye
 *   CAN-07  lost signal 40 minutes ago                        -> no signal
 *   CAN-04  full, cold, charging from the sun                 -> safe
 *
 * Nothing here changes on its own at random: a presenter should never be
 * surprised mid-sentence. Things go wrong on purpose through `DemoControls`.
 */

import type { CoolerState, LidState, RawNode, RawSnapshot, Reading, Trip } from "./types"
import { SAFE_BAND } from "./types"
import {
  DEFAULT_SPEC,
  LOW_VOLTAGE_CUTOFF,
  coolingWatts,
  effectiveUa,
  ingressWatts,
  milkThermalMass,
  thermostat,
} from "./thermal"
import type { DemoControls, Scenario, TelemetrySource } from "./source"

/** Simulated seconds per real second. At 60, one real minute is one hour. */
const TIME_SCALE = 60
/** Wall-clock interval between integration steps, ms. */
const TICK_MS = 1000
/** Simulated seconds per step. */
const STEP_SEC = (TICK_MS / 1000) * TIME_SCALE
/** Rolling history depth: 12 simulated hours, enough to draw a day. */
const HISTORY_LEN = Math.round((12 * 3600) / STEP_SEC)

const HOUR = 3600_000

interface NodeState {
  id: string
  route: string
  operator: string
  spec: typeof DEFAULT_SPEC
  trip: Trip
  filledAt: number

  milkC: number
  ph: number
  fillL: number
  /** Battery energy, Wh. */
  wh: number
  /** Thermostat latch. */
  on: boolean

  lid: LidState
  lidTimer: number
  /** Doorstep-collection cans open their lid at every house. */
  doorstep: boolean

  ambientBaseC: number
  solarPeakW: number

  scenarios: Set<Scenario>
  /** Battery level to restore when the "battery dies" scenario is undone. */
  savedWh: number | null

  history: Reading[]
}

interface Seed {
  id: string
  route: string
  operator: string
  centre: string
  /** The dairy's collection slot, hour of day in IST. Collected at this hour, am and pm. */
  slotH: number
  milkC: number
  fillL: number
  /** Battery level at "now". Held steady through warm-up so the demo opens predictably. */
  batteryFrac: number
  ambientBaseC: number
  solarPeakW: number
  doorstep?: boolean
  /** [hours before "now", what happens]. Played during warm-up. */
  script?: Array<[number, (n: NodeState, sim: Simulation) => void]>
}

const SEEDS: Seed[] = [
  {
    id: "CAN-04",
    route: "MANDYA / HALAGUR",
    operator: "R. SHIVANNA",
    centre: "Halagur dairy",
    slotH: 6,
    milkC: 4.0,
    fillL: 38,
    batteryFrac: 0.9,
    ambientBaseC: 31,
    solarPeakW: 40,
  },
  {
    id: "CAN-11",
    route: "MANDYA / KIRUGAVALU",
    operator: "B. LAKSHMI",
    centre: "Kirugavalu dairy",
    slotH: 6.5,
    milkC: 5.4,
    fillL: 27,
    batteryFrac: 0.55,
    ambientBaseC: 35,
    solarPeakW: 40,
    doorstep: true,
    script: [[0.4, (n, sim) => sim.setScenario(n, "lidOpen", true)]],
  },
  {
    id: "CAN-02",
    route: "MANDYA / BASARALU",
    operator: "K. MAHESH",
    centre: "Basaralu dairy",
    slotH: 7,
    milkC: 4.3,
    fillL: 22,
    batteryFrac: 0.85,
    ambientBaseC: 38,
    solarPeakW: 40,
    script: [[11, (n, sim) => sim.setScenario(n, "coolerFault", true)]],
  },
  {
    id: "CAN-19",
    route: "CHIKMAGALUR / MULLAYANAGIRI",
    operator: "S. THIMMAPPA",
    centre: "Mullayanagiri dairy",
    slotH: 5.5,
    milkC: 3.8,
    fillL: 18,
    batteryFrac: 0.14,
    ambientBaseC: 22,
    solarPeakW: 0, // hill route, no panel fitted
  },
  {
    id: "CAN-07",
    route: "MANDYA / DUDDA",
    operator: "N. GOWRAMMA",
    centre: "Dudda dairy",
    slotH: 7.5,
    milkC: 4.6,
    fillL: 22,
    batteryFrac: 0.7,
    ambientBaseC: 34,
    solarPeakW: 40,
    script: [[0.7, (n, sim) => sim.setScenario(n, "signalLost", true)]],
  },
]

/** Probe jitter so readings look like probes, not like math. */
const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp

/** Hour of day in India, 0..24, for the sun and the daily heat cycle. */
function hourIST(t: number): number {
  return (((t / HOUR + 5.5) % 24) + 24) % 24
}

/** The next time the dairy collects: `slotH` o'clock IST, morning or evening. */
function nextPickup(now: number, slotH: number): number {
  const IST = 5.5 * HOUR
  const midnight = Math.floor((now + IST) / (24 * HOUR)) * 24 * HOUR - IST
  for (let k = 0; k < 4; k++) {
    const t = midnight + slotH * HOUR + k * 12 * HOUR
    if (t > now + 20 * 60_000) return t
  }
  return now + 12 * HOUR
}

class Simulation {
  nodes: NodeState[] = []
  clock = 0
  /** True while replaying the past. Batteries hold still so "now" is predictable. */
  private warming = true

  constructor(now: number) {
    this.clock = now - HISTORY_LEN * STEP_SEC * 1000
    this.nodes = SEEDS.map((s) => this.seed(s, now))

    // Warm up: play the last 12 hours so every can arrives with a day behind
    // it, including whatever went wrong along the way.
    const pending = SEEDS.map((s) => [...(s.script ?? [])].sort((a, b) => b[0] - a[0]))
    for (let i = 0; i < HISTORY_LEN; i++) {
      this.clock += STEP_SEC * 1000
      this.nodes.forEach((n, k) => {
        const due = pending[k]
        while (due.length && this.clock >= now - due[0][0] * HOUR) due.shift()![1](n, this)
        this.step(n, STEP_SEC)
      })
    }
    // Anything scripted at "0 hours ago" lands now, after the history is drawn.
    this.nodes.forEach((n, k) => pending[k].forEach(([, fn]) => fn(n, this)))
    this.warming = false
  }

  private seed(s: Seed, now: number): NodeState {
    const spec = { ...DEFAULT_SPEC }
    return {
      id: s.id,
      route: s.route,
      operator: s.operator,
      spec,
      trip: { centre: s.centre, pickupAt: nextPickup(now, s.slotH) },
      filledAt: this.clock,
      milkC: s.milkC,
      ph: 6.7,
      fillL: s.fillL,
      wh: spec.batteryWh * s.batteryFrac,
      on: false,
      lid: "sealed",
      lidTimer: 300,
      doorstep: s.doorstep ?? false,
      ambientBaseC: s.ambientBaseC,
      solarPeakW: s.solarPeakW,
      scenarios: new Set(),
      savedWh: null,
      history: [],
    }
  }

  setScenario(n: NodeState, s: Scenario, on: boolean) {
    if (on === n.scenarios.has(s)) return
    if (on) {
      n.scenarios.add(s)
      if (s === "batteryDead") n.savedWh = n.wh
      if (s === "lidOpen") n.lid = "open"
    } else {
      n.scenarios.delete(s)
      if (s === "batteryDead" && n.savedWh != null) {
        n.wh = n.savedWh
        n.savedWh = null
      }
      if (s === "lidOpen") {
        n.lid = "sealed"
        n.lidTimer = 600
      }
    }
  }

  /** Advance every can by one step. */
  tick() {
    this.clock += STEP_SEC * 1000
    for (const n of this.nodes) this.step(n, STEP_SEC)
  }

  private step(n: NodeState, dtSec: number) {
    const now = this.clock
    const { spec } = n
    const has = (s: Scenario) => n.scenarios.has(s)

    // --- Collection: the milk goes to the dairy, the can comes back -------
    if (now >= n.trip.pickupAt) this.handover(n, now)

    // --- Weather: daily heat cycle peaking mid-afternoon, and the sun -----
    const h = hourIST(now)
    const ambientC =
      n.ambientBaseC +
      4 * Math.cos(((h - 15) / 24) * 2 * Math.PI) +
      (has("heatwave") ? 8 : 0) +
      noise(0.2)
    const sun = h > 6 && h < 18 ? Math.sin(((h - 6) / 12) * Math.PI) : 0
    const solarW = has("batteryDead") ? 0 : n.solarPeakW * sun * (0.85 + Math.random() * 0.15)

    // --- Lid ----------------------------------------------------------------
    if (has("lidOpen")) {
      n.lid = "open"
    } else if (n.doorstep) {
      n.lidTimer -= dtSec
      if (n.lidTimer <= 0) {
        if (n.lid === "open") {
          n.lid = "sealed"
          n.lidTimer = 600 + Math.random() * 900
        } else if (Math.random() < 0.5) {
          n.lid = "open"
          n.lidTimer = 60 + Math.random() * 120
        } else {
          n.lidTimer = 300 + Math.random() * 600
        }
      }
    } else {
      n.lid = "sealed"
    }

    // --- Cooler ---------------------------------------------------------------
    const cutoffWh = spec.batteryWh * LOW_VOLTAGE_CUTOFF
    let cooler: CoolerState
    let qOut = 0
    let draw = spec.baseLoadW
    if (has("coolerFault")) {
      cooler = "fault"
      n.on = false
    } else if (n.wh <= cutoffWh) {
      cooler = "off"
      n.on = false
    } else {
      n.on = thermostat(spec, n.milkC, n.on)
      cooler = n.on ? "on" : "idle"
      if (n.on) {
        qOut = coolingWatts(spec)
        draw += spec.peltierW
      }
    }

    // --- Battery --------------------------------------------------------------
    if (!this.warming) {
      n.wh = Math.max(0, Math.min(spec.batteryWh, n.wh + ((solarW - draw) * dtSec) / 3600))
    }
    if (has("batteryDead")) n.wh = Math.min(n.wh, cutoffWh * 0.6)

    // --- Heat balance ---------------------------------------------------------
    const qIn = ingressWatts(effectiveUa(spec, n.lid === "open"), ambientC, n.milkC)
    n.milkC += ((qIn - qOut) * dtSec) / 1000 / milkThermalMass(n.fillL) + noise(0.01)

    // --- Acidity: lactic acid builds fast once the milk is warm ---------------
    if (n.milkC > SAFE_BAND.max) {
      n.ph -= (dtSec / 3600) * 0.03 * Math.pow(2, (n.milkC - SAFE_BAND.max) / 3)
    }
    n.ph = Math.max(6.1, Math.min(6.78, n.ph + noise(0.0008)))

    // --- Report ---------------------------------------------------------------
    // A can with no signal keeps living — the physics carries on — it just
    // stops telling us about it. When it comes back, the gap is visible.
    if (has("signalLost")) return

    n.history.push({
      t: now,
      milkCoreC: n.milkC,
      coldPlateC: n.milkC - (cooler === "on" ? 3.2 : 0.4) + noise(0.05),
      ambientC,
      ph: n.ph,
      cooler,
      batteryPct: (n.wh / spec.batteryWh) * 100,
      solarW,
      lid: n.lid,
      fillL: n.fillL,
      rssiDbm: -67 + noise(5),
    })
    if (n.history.length > HISTORY_LEN) n.history.shift()
  }

  /** Pickup: milk handed over, can refilled, battery topped up at the dairy. */
  private handover(n: NodeState, now: number) {
    n.filledAt = now
    n.fillL = 18 + Math.round(Math.random() * 20)
    n.milkC = 4.2 + Math.random() * 0.8
    n.ph = 6.68 + Math.random() * 0.06
    if (!n.scenarios.has("batteryDead")) n.wh = Math.max(n.wh, n.spec.batteryWh * 0.95)
    this.setScenario(n, "lidOpen", false)
    n.trip = { ...n.trip, pickupAt: n.trip.pickupAt + 12 * HOUR }
  }

  snapshot(): RawSnapshot {
    return {
      t: this.clock,
      nodes: this.nodes.map(
        (n): RawNode => ({
          id: n.id,
          route: n.route,
          operator: n.operator,
          spec: n.spec,
          trip: n.trip,
          filledAt: n.filledAt,
          // Copied so React sees a new array each tick.
          history: n.history.slice(),
        }),
      ),
    }
  }

  find(id: string) {
    return this.nodes.find((n) => n.id === id)
  }
}

export class SimulatedTelemetrySource implements TelemetrySource {
  readonly label = "Simulated fleet"
  readonly isLive = false

  private sim: Simulation | null = null
  private emit: (() => void) | null = null

  subscribe(cb: (snapshot: RawSnapshot) => void): () => void {
    const sim = new Simulation(Date.now())
    this.sim = sim
    this.emit = () => cb(sim.snapshot())
    this.emit()

    const handle = window.setInterval(() => {
      sim.tick()
      this.emit?.()
    }, TICK_MS)

    return () => {
      window.clearInterval(handle)
      this.emit = null
    }
  }

  readonly demo: DemoControls = {
    toggle: (id, s) => {
      const n = this.sim?.find(id)
      if (!n || !this.sim) return
      this.sim.setScenario(n, s, !n.scenarios.has(s))
      this.emit?.()
    },
    active: (id) => this.sim?.find(id)?.scenarios ?? new Set(),
    skip: (minutes) => {
      if (!this.sim) return
      const steps = Math.round((minutes * 60) / STEP_SEC)
      for (let i = 0; i < steps; i++) this.sim.tick()
      this.emit?.()
    },
    fix: (id) => {
      const n = this.sim?.find(id)
      if (!n || !this.sim) return
      for (const s of [...n.scenarios]) this.sim.setScenario(n, s, false)
      this.emit?.()
    },
  }
}
