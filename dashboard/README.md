# ChillCan — Dashboard

Is my milk still cold? Monitoring for Peltier-cooled milk cans.
**SIH problem statement 26110.**

Currently running on **simulated data**. The header and footer say so on every
screen, at all times. That line is load-bearing; do not remove it for a demo.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

---

## Giving the demo

The simulator runs **one real minute = one simulated hour**, and opens on the
same five situations every time:

| Can | Opens as | Story |
| --- | --- | --- |
| CAN-02 | Too warm | Cooler failed this morning; milk went warm this afternoon |
| CAN-07 | No signal | Stopped reporting 40 minutes ago |
| CAN-11 | Keep an eye | Doorstep round; lid left open at a stop |
| CAN-19 | Keep an eye | Hill route, no solar panel, battery at 14% |
| CAN-04 | Safe | Full, cold, charging from the sun |

Nothing goes wrong at random. Press **D** (or "Demo controls" in the footer) to
break the selected can on purpose:

- **Leave lid open**, **Heatwave +8°**, **Cooler fails**, **Battery dies**, **Lose signal**
- **Skip 1 / 3 hours** to fast-forward the physics and watch the consequences land
- **Fix this can** clears everything

A good 60-second run: select CAN-04 (safe), press D, *Cooler fails*, *Skip 3
hours* twice. The headline, the can drawing, the trip verdict, the day chart's
pins and the phone alerts all change together, because they all come from the
same readings.

At each dairy's collection time (5:30–7:30, morning and evening) the milk is
handed over: the can refills, and its battery is topped up. A broken cooler
stays broken until you fix it.

The panel only exists for the simulator. A real source has no `demo` controls,
so the panel cannot appear over live data.

---

## For the hardware team: going live

You change **one line**. Nothing in `src/components/` imports the simulator.

### 1. Send readings, nothing else

Implement `TelemetrySource` (`src/telemetry/source.ts`) and hand the dashboard
a `RawSnapshot` whenever data arrives:

```ts
// src/telemetry/http.ts
export class HttpTelemetrySource implements TelemetrySource {
  readonly label = "ESP32 fleet"
  readonly isLive = true

  subscribe(cb: (snap: RawSnapshot) => void) {
    const poll = async () => cb(await (await fetch(API_URL)).json())
    poll()
    const h = setInterval(poll, 15_000)
    return () => clearInterval(h)
  }
}
```

A `RawSnapshot` is, per can: id, route, operator, spec, trip (pickup time),
and the last ~12 hours of `Reading`s. **That's all.** The dashboard works out
everything else in `src/telemetry/derive.ts` and `src/lib/timeline.ts`:

- **Status and the headline**: too warm, cooler stopped, lid open, battery low…
- **Offline**: a can is "no signal" when its last reading is >5 minutes old.
  The firmware does not need to report its own absence.
- **Events**: the pins on the day chart and the phone alerts ("Cooler stopped
  9:12 am") are found by walking the readings. The firmware sends no events.
- **Cold life**: the thermal model runs forward from the latest reading.

### 2. Swap it in

```diff
// src/telemetry/index.ts
- export const telemetrySource: TelemetrySource = new SimulatedTelemetrySource()
+ export const telemetrySource: TelemetrySource = new HttpTelemetrySource()
```

Set `isLive = true` only for real data. It changes the provenance line.

### 3. What each reading contains

As of 2026-09-29 the team has an ESP32, DS18B20 probes, a pH probe and a
Peltier. Fields marked *planned* are not wired yet; the simulator fills them so
the design can be judged.

| Field | Source | Status |
| --- | --- | --- |
| `milkCoreC` | DS18B20 in the milk | wired |
| `ph` | food-grade pH probe | wired |
| `cooler` | firmware: `on` / `idle` / `fault` / `off` | wired (the ESP32 drives the Peltier) |
| `rssiDbm` | `WiFi.RSSI()` | wired |
| `coldPlateC` | DS18B20 on the Peltier cold plate | planned (same 1-wire bus) |
| `ambientC` | DS18B20 outside, shaded | planned (same 1-wire bus) |
| `batteryPct` | ESP32 ADC across a divider | planned |
| `solarW` | panel current sense; 0 if no panel | planned |
| `lid` | reed switch, `sealed` / `open` | planned |
| `fillL` | load cell | planned |

If a planned sensor never arrives, send a sensible constant (for example,
`fillL` = the can's usual volume). The UI keeps working; that one fact just
stops being informative.

`cooler: "fault"` means *driven but not cooling*: the firmware sees the cold
plate failing to drop below the milk while the Peltier is on. `off` means the
battery hit the low-voltage cutoff. The ESP32 keeps reporting on its reserve,
but cooling has stopped.

---

## The thermal model

`src/telemetry/thermal.ts`. Lumped capacitance: the milk is one thermal mass,
heat leaks in through the body, and the Peltier pulls it out while it runs.
The simulator integrates these equations. `project()` runs the same equations
forward to answer "how long does it stay cold?", so the countdown and the trace
always agree.

| Constant | Value | Note |
| --- | --- | --- |
| Milk specific heat | 3.93 kJ/kg·K | whole cow milk |
| Milk density | 1.03 kg/L | |
| Body UA | 0.39 W/K | 40 L can, 45 mm PUF |
| Lid open | UA × 3.1 | gasket is the weakest path |
| Peltier | 36 W drawn, COP 0.6 → ~22 W of cooling | TEC1-12703 class |
| Thermostat | 4 °C ± 0.3 | |
| Battery | 240 Wh (12 V 20 Ah), cutoff at 5% | |
| Safe band | 2–8 °C | FSSAI raw-milk holding |
| Milk freeze point | −0.52 °C | cold plate below this is a **fault** |

`project()` is deliberately pessimistic, because "safe until 3:02 pm" is a
food-safety promise:

- **Solar is ignored.** Clouds happen, and nights always do.
- Ambient holds at the current value.
- An open lid is assumed to stay open 30 more minutes.

The numbers worth knowing for Q&A: at 35 °C outside, a sealed can leaks ~12 W,
and the Peltier moves ~22 W, so it keeps up with room to spare. An **open lid**
leaks ~37 W and overwhelms it. With the cooler **dead**, 22 L of milk at 38 °C
ambient takes ~8 hours to drift from 4 °C past 8 °C, because the insulation is
doing most of the work. Tune in `DEFAULT_SPEC`; never fudge the display.

`fitUa()` recovers UA from two readings while the cooler is off. It is not
shown in the UI, but it proves a built can matches the model. Keep it for
the field-test write-up.

---

## Design

`DESIGN.md` is the source of truth. The short version: the selected can is one
scene. The verdict is written as a sentence, the can is drawn from its own
readings, and four plain facts sit under it. After that come the questions a
seller asks, in order: will it reach the dairy cold, what happened today, what
will I be paid, and what did my phone tell me.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · Motion
Type: Outfit (numbers, verdicts) + Plus Jakarta Sans (everything else)
Icons: Phosphor, deep-imported per icon from `@phosphor-icons/react/dist/csr/<Name>`
(the package barrel does not tree-shake).

From the [React Bits](https://reactbits.dev) registry (`components.json` →
`@react-bits`): `Noise` (paper grain), `CountUp` (litres total), `ClickSpark`
(tactile can selection), `GradualBlur` (list edge). Pulled and rejected:
`GlitchText`, `AnimatedList`, `DecryptedText`, `SpotlightCard` (hardcoded dark
styling or wrong idiom) and `AnimatedContent` (GSAP + ScrollTrigger, +60 kB gzip
for three fades).

The can, the day chart and the trip line are hand-built SVG. A chart library's
defaults are what this interface is trying not to look like.

| Chunk | gzip |
| --- | --- |
| react | 57 kB |
| motion | 42 kB |
| app | 32 kB |
| icons | 24 kB |
| css | 10 kB |
