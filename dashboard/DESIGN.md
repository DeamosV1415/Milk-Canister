---
version: 2.0
name: ChillCan-Daylight
description: >
  Design system for ChillCan, the cold-chain dashboard for PCM-buffered milk
  chilling cans (SIH problem statement 26110). Light, warm and quiet: a white
  ground, four semantic colours that only ever answer "is my milk still good?",
  and plain language throughout. Built for the person selling the milk, not the
  person who built the can.

colors:
  canvas: "#fbfbfa"        # page
  surface: "#ffffff"       # cards
  sunk: "#f7f6f3"          # insets, quiet strips
  line: "#eaeae7"          # every border, 1px

  ink: "#26241f"           # 15.0:1  headings, big numbers
  ink-soft: "#6b6862"      #  5.4:1  body, secondary
  ink-faint: "#75716a"     #  4.7:1  labels, smallest text

  fresh: "#346538"         # safe / good
  fresh-soft: "#edf3ec"
  fresh-line: "#a8c9aa"

  warn: "#8a5c00"          # keep an eye
  warn-soft: "#fbf3db"
  warn-line: "#e0c380"

  risk: "#9f2f2d"          # too warm
  risk-soft: "#fdebec"
  risk-line: "#e2a5a2"

  cool: "#1f6c9f"          # the temperature hue
  cool-soft: "#e1f3fe"
  cool-line: "#9dc9e6"

typography:
  display:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: -0.03em
    lineHeight: 1
    usage: numbers and verdicts
  title:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: -0.015em
    lineHeight: 1.25
  body:
    fontFamily: "Plus Jakarta Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    lineHeight: 1.6
  label:
    fontSize: 12.5px
    fontWeight: 500
    color: ink-faint
    textTransform: none

geometry:
  cardRadius: 12px
  pillRadius: 999px
  border: 1px solid line
  shadow: none by default; 0 2px 8px rgba(38,36,31,0.04) on hover only
---

# ChillCan — Daylight

## Overview

ChillCan tells a dairy farmer whether their milk is still cold enough to sell.
That is the whole product. Everything on screen either answers that question or
earns its place by changing what the seller does today.

The audience is not technical, is often outdoors, and is frequently on a cheap
phone screen in bright sun. So: light ground, large numbers, plain sentences,
generous space, and colour used sparingly enough that it still means something
when it appears.

## The rule that shapes everything

**If a number does not change what the seller does today, it does not go on
the screen.**

This is what separates v2 from v1. The first version showed fitted UA in W/K,
heat ingress in watts, stratification deltas, RSSI in dBm, and an append-only
operations log. All of it correct, all of it useless to a farmer. It is gone.

What survived, and why:

| Shown | Because |
| --- | --- |
| Milk temperature | The question itself |
| Stays cold for | Decides whether they can wait or must move now |
| Cooling pack left | Decides whether to swap a pack at the centre |
| Freshness + grade | Decides what they get paid |
| Litres and lid | Confirms the can is what they think it is |
| Sensor battery | A flat battery means no warnings at all |

What was cut: UA, ingress watts, stratification, warm-minute counters as a bare
figure, RSSI, the operations log, the fleet tally row.

Note the asymmetry: **cutting a number is not the same as hiding a problem.**
Warm minutes came back — not as a counter, but as a sentence that appears only
when there is something to explain: *"This milk spent 2h 31m above 8°C today.
That is what pushed the grade down."*

## Colour

### Ground

White surfaces on a barely-warm canvas. One theme, no dark mode. Cards are
`#ffffff` on `#fbfbfa` with a single `1px solid #eaeae7` border — that border is
the only structural device. No shadows except an ultra-diffuse lift on hover.

### Four meanings, and nothing else

Colour is reserved for state. There is no brand colour, no decorative accent,
no chart palette.

| Colour | Means | Never |
| --- | --- | --- |
| `fresh` green | Milk is cold and good | A generic success tick |
| `warn` amber | Getting close to warm; act soon | Any neutral highlight |
| `risk` red | Too warm; sell or chill now | A delete button, a brand flourish |
| `cool` blue | Temperature itself | A second accent or a link colour |

Every semantic colour ships as a **pair** — pale ground plus dark text — and
both halves clear WCAG AA together. Every text token clears AA on every surface
it can land on.

### Colour never carries meaning alone

Each state ships a **dot, a word, and a sentence**:

| State | Word | Sentence |
| --- | --- | --- |
| nominal | Safe | Milk is cold and good |
| watch | Keep an eye | Getting close to warm |
| breach | Too warm | Sell or chill this now |
| offline | No signal | Last known reading |

The sentence is the important part. "Breach" is a status code; "Sell or chill
this now" is an instruction.

## Typography

**Outfit** for numbers and verdicts — geometric, round, friendly, with excellent
numerals at large sizes. **Plus Jakarta Sans** for everything else.

No uppercase labels. No letter-spaced micro-caps. No monospace. Those are the
things that made v1 feel like equipment, and they are exactly what tires a
non-technical reader out. Labels are sentence case at 12.5px.

Numbers get `tabular-nums` so a live readout does not jitter horizontally.

## Charts

### One line

The temperature chart draws **milk temperature and nothing else**. v1 drew four
series distinguished by dash pattern with a legend to decode them; correct for
an engineer auditing an envelope, useless to someone asking whether their milk
is still cold.

### Zones carry the meaning, so the axis can stay quiet

- Green band = the 2–8 °C the milk should live in, labelled in words.
- Warm pink wash = above 8 °C, labelled "Too warm".
- Two axis ticks. That is the entire budget.
- Time labels at the ends only: the start time, and "now".

Because the zones explain the chart, there is no gridline field, no dense tick
row, and no legend.

### No gradient fill under the curve

Tried, removed. A blue area wash painted over a green band mixes to a muddy
teal and both zones stop reading as zones. The line gets a soft white underlay
instead — it stays crisp against the tint without introducing a second hue.

### The curve is smoothed

Catmull-Rom through the samples. A raw polyline of sensor readings looks jagged
and anxious; a smooth curve reads as a trend, which is what is being said.

### Never a dual y-axis

Ambient runs ~40 °C while milk runs ~4 °C. In v1 that needed a second aligned
strip. Here ambient is simply not plotted — it appears as a phrase instead:
*"with today's heat outside (41°C)"*. A sentence beat a second chart.

## Voice

Write what you would say to the person holding the can.

| Not this | This |
| --- | --- |
| Projected cold life | Stays cold for about |
| PCM cartridge charge 91% | Cooling pack left 91% |
| MBRT grade III / fair | Grade at the centre: fair |
| Acidification / pH | How fresh is it |
| BREACH | Too warm — sell or chill this now |
| Uplink loss | No signal |
| Warm minutes: 153 | This milk spent 2h 31m above 8°C today |

Times read as speech: `37h 10m`, not `37H 10M`. Roman numerals are out — "III"
renders as three bars in a geometric sans and means nothing to a seller anyway,
so grades show their word.

**Provenance stays non-negotiable.** The footer always says whether the data is
live or demo. That rule carries over from v1 unchanged.

## Components

Small set, each with one job:

| Piece | Where | Rule |
| --- | --- | --- |
| Card | every block | 1px line, 12px radius, no shadow except hover lift |
| Status pill | headline, roster | dot + word, never colour alone |
| Readout | the numbers | label with icon above, value below, unit beside |
| Meter | cold life, cooling pack | rounded track, one fill, no ticks |
| Segmented | chart range | sliding indicator animates transform only |
| Button | contextual action | solid ink, at most one per screen |
| Skeleton | loading | shaped like the layout it stands in for |

Icons are Phosphor at `bold` weight, 15-17px, always paired with a label -
never an icon-only control. Card icons sit in a 28px `sunk` tile so they read
as part of the header rather than floating beside it.

**One action, only when there is one.** The headline card grows a button when
the milk is too warm ("Chill this now") or the pack is nearly spent ("Swap
cooling pack"), and shows nothing otherwise. A button that is always present
stops being a prompt and becomes furniture.

## Motion

Quiet. Live dot breathes; meters and the freshness marker ease to new values;
the lid rotates when it opens; the main blocks fade up once on mount with a
50ms stagger. Nothing loops. `prefers-reduced-motion` collapses all of it.

Animate `transform` and `opacity` only - never `width`, `top` or `height`.

## Do

- Lead with the verdict, then the evidence
- Pair every colour with a word
- Keep every text token above 4.5:1
- Show a problem's *reason*, not just its measurement
- Let a sentence replace a chart when it can
- Round to what a person would say out loud

## Don't

- Add a metric that does not change a decision
- Use uppercase labels or monospace
- Add a fifth colour, or use a state colour decoratively
- Put a gradient wash over a semantic zone
- Show a bare counter where a sentence would explain
- Use a dual y-axis
- Show smoothly-updating values for a can that is offline
