# ChillCan — Fleet Telemetry Dashboard

Cold-chain monitoring for PCM-buffered milk chilling cans.
**SIH problem statement 26110.**

Currently running on **simulated data**. The status bar says so, on every
screen, at all times — that line is load-bearing, do not remove it for a demo.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

---

## For the hardware team: going live

You change **one line**. Nothing in `src/components/` imports the simulator, so
no UI code moves.

### 1. Write a source

Implement `TelemetrySource` (`src/telemetry/source.ts`). Push or poll, MQTT or
HTTP or WebSocket — the dashboard does not care. The only contract is: call
`cb` with a complete `FleetSnapshot` whenever data arrives, return a teardown.

```ts
// src/telemetry/mqtt.ts
export class MqttTelemetrySource implements TelemetrySource {
  readonly label = "FIELD UPLINK / LORAWAN"
  readonly isLive = true

  subscribe(cb: (snap: FleetSnapshot) => void) {
    const client = mqtt.connect(BROKER_URL)
    client.on("message", (_t, buf) => cb(decode(buf)))
    return () => client.end()
  }
}
```

### 2. Swap it in

```diff
// src/telemetry/index.ts
- export const telemetrySource: TelemetrySource = new SimulatedTelemetrySource()
+ export const telemetrySource: TelemetrySource = new MqttTelemetrySource()
```

Setting `isLive = true` flips the heartbeat dot green and rewrites the
provenance line. **Never set it true for simulated data.**

### 3. What the node has to send

One `Reading` per can per uplink (`src/telemetry/types.ts`). Every field maps to
a real sensor:

| Field | Sensor |
| --- | --- |
| `milkCoreC` | DS18B20, mid-depth in the milk column |
| `milkTopC` | DS18B20, top of the column (stratification) |
| `wallC` | DS18B20, inner wall beside the PCM cartridge |
| `ambientC` | ambient probe, outside the body, shaded |
| `pcmC` | probe embedded in the PCM cartridge |
| `ph` | food-grade pH probe |
| `lid` | reed switch — `"sealed"` / `"open"` |
| `fillL` | load cell |
| `batteryPct`, `rssiDbm` | node housekeeping |

Everything in `Derived` — cold life, PCM charge, fitted UA, MBRT grade — is
computed dashboard-side. **Do not send those from the node.** The split between
measured and inferred is deliberate and the judging panel will ask about it.

---

## The thermal model

`src/telemetry/thermal.ts` implements the physics from the project research
note. The simulator integrates these equations forward rather than emitting a
random walk, so the traces show real behaviour: thermal lag after a lid event,
the PCM plateau while latent heat is spent, and the knee when the cartridge
runs out.

| Constant | Value | Source |
| --- | --- | --- |
| Milk specific heat | 3.93 kJ/kg·K | whole cow milk, ~3.5% fat |
| Milk density | 1.03 kg/L | at 20 °C |
| Design UA | 0.39 W/K | 40 L keeper, 45 mm PUF, ~0.70 m² |
| PCM | 8 kg @ +5 °C, 196 kJ/kg | organic PCM (savE OM03 / PlusICE A4) |
| Safe band | 2–8 °C | FSSAI raw-milk holding |
| Milk freeze point | −0.52 °C | wall probe below this is a **fault** |

Two model choices worth defending out loud:

- **Lid open triples ingress** (`UA × 3.1`). The gasket is the weakest path in
  the envelope; the research note budgets 20–35% of total UA to the lid and
  thermal bridges.
- **`fitUa()` only inverts while the milk is warming toward ambient.** It
  returns `null` whenever the cartridge is actively pulling heat out, which is
  correct rather than a bug. It is no longer shown in the UI (the seller has no
  use for W/K) but it stays in `thermal.ts` — it is the number that proves a
  built can matches the model, so keep it for the hardware write-up and the
  field-test protocol.

### Tuning the demo

- `TIME_SCALE` in `simulator.ts` (default `90`) — simulated seconds per real
  second. Raise it to make the PCM knee arrive during a short demo.
- Seeded cans in `seedNodes()` cover the full state range on purpose: freshly
  charged, mid-route with lid cycling, cartridge spent and breaching, a cold
  hill run that is battery-limited, and one with no uplink.
- Projected cold life runs long (30 h+) at moderate ambient because 8 kg of PCM
  genuinely holds that long against ~14 W of ingress. If you want the 8–12 h
  figures from the research note's headline case, raise `ambientBaseC` or cut
  `pcmKg` — do not fudge the display.

---

## Design system

`DESIGN.md` is the source of truth for anything new. The load-bearing rules:

- **If a number does not change what the seller does today, it does not go on
  the screen.** The dashboard is for a dairy farmer, not a technician.
- Colour is reserved for state (safe / keep an eye / too warm / temperature)
  and never carries meaning alone — always a dot, a word, and a sentence.
- Every text token clears WCAG AA on every surface it can land on.
- Plain language: "Stays cold for about", not "Projected cold life".
- One line on the temperature chart. Zones explain it, so the axis stays quiet.

## Stack

Vite - React 19 - TypeScript - Tailwind v4 - Motion
Type: Outfit (numbers and verdicts) + Plus Jakarta Sans (everything else)
Icons: Phosphor, imported per-icon from `@phosphor-icons/react/dist/csr/<Name>`
(the package barrel does not tree-shake; deep imports keep it at 14 kB gzip)

UI components from the [React Bits](https://reactbits.dev) registry via the
shadcn CLI (`components.json` -> `@react-bits`):

| Component | Job |
| --- | --- |
| `Noise` | a whisper of warm grain so large flat areas read as paper |
| `CountUp` | the one on-mount aggregate ("milk still cold today") |
| `ClickSpark` | tactile feedback on the one thing you do here: pick a can |
| `GradualBlur` | softens the cut where the can list runs under the total |

Pulled and rejected, with reasons:

- `GlitchText` - hardcodes `#120F17` and a cyan text-shadow (a second accent).
- `AnimatedList` - only accepts `string[]`; would flatten structured rows.
- `DecryptedText` - terminal scramble idiom; hostile to this audience.
- `SpotlightCard` - hardcodes `bg-neutral-900 rounded-3xl p-8`; unusable light.
- `AnimatedContent` - works, but drags in GSAP + ScrollTrigger (+60 kB gzip)
  for three mount fades, and renders children `invisible` until a scroll
  trigger fires. Replaced with Motion, already bundled, zero extra bytes.

Charts are hand-rolled SVG. A chart library's defaults - cycled hues, dense
gridlines, a legend per series - are what this interface is trying not to be.

### Bundle

Vendors are split so each caches independently across deploys:

| Chunk | gzip |
| --- | --- |
| react | 57 kB |
| motion | 40 kB |
| icons | 14 kB |
| app | 23 kB |
| css | 8 kB |

Motion is the one worth revisiting: it is there for `CountUp`'s spring and the
card reveals. Swapping both for CSS keyframes would drop ~40 kB gzip if load
time on a rural connection ever becomes the binding constraint.
