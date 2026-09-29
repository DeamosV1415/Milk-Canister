---
version: 3.0
name: ChillCan-Daylight
description: >
  Design system for ChillCan, the dashboard for Peltier-cooled milk cans (SIH
  problem statement 26110). Light, warm and quiet: a white ground, four
  semantic colours that only ever answer "is my milk still good?", plain
  language throughout, and the can itself drawn as the centre of the screen.
  Built for the person selling the milk, not the person who built the can.

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

  cool: "#1f6c9f"          # the temperature hue; also "cooler running"
  cool-soft: "#e1f3fe"
  cool-line: "#9dc9e6"

  steel: "#b3bcc4"         # the can's outline. Illustration only, never text.
  steel-soft: "#d3d9df"    # ribs, heatsink fins

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
  heroRadius: 14px
  pillRadius: 999px
  border: 1px solid line
  shadow: none by default; 0 2px 8px rgba(38,36,31,0.04) on hover only
---

# ChillCan — Daylight (v3)

## Overview

ChillCan tells a dairy farmer whether their milk is still cold enough to sell.
That is the whole product. Everything on screen either answers that question or
earns its place by changing what the seller does today.

The audience is not technical, is often outdoors, and is frequently on a cheap
phone in bright sun. So: light ground, large numbers, plain sentences, generous
space, and colour used sparingly enough that it still means something when it
appears.

## The rule that shapes everything

**If a number does not change what the seller does today, it does not go on
the screen.**

v1 showed fitted UA in W/K, heat ingress, stratification and an operations log.
All correct, all useless to a farmer. v2 cut them. v3 keeps that rule and
changes the *shape*: v2 was a tidy grid of equal cards, which is exactly what
every generated dashboard looks like. v3 makes one thing the centre.

## The screen, in the order a seller asks

| Block | Question it answers |
| --- | --- |
| Banner (too warm only) | Do I need to act right now? |
| Hero: verdict + can + facts | Is my milk OK, and why not? |
| Trip | Will it still be cold when the truck comes? |
| Today | What happened, and when? |
| How fresh is it | What will I be paid? |
| On their phone | What did the seller's phone already tell them? |
| Device strip | Is the can even talking to us? |

On a phone the list of cans becomes a sideways-swiping strip that sticks under
the header, and the blocks stack in the same order.

## The can is the interface

The hero is drawn around a steel milk can with a window cut into the front and
the Peltier cooler on its side. **Every visual property is a reading**:

| You see | It means |
| --- | --- |
| Milk level in the window | load cell |
| Milk colour: icy blue → cream → peach | milk temperature |
| Frost speckle and condensation drops | how cold it is (a cold can sweats in hot air) |
| Heat shimmer off the lid | above 8 °C |
| Cooler light: blue / grey / red with `!` | running / resting / fault |
| Warm air drifting off the fins | the cooler is working |
| Lid tilted up | reed switch open |
| Whole can greyed out | no signal; this is an old picture |

If a new visual detail cannot be traced to a reading, it does not go on the can.

## Mood

The page's temperature follows the selected can's. Hero backdrop light is cool
blue when safe, amber when watching, warm peach when too warm, grey offline.

- **Keep an eye**: a slow amber ring pulses around the hero (opacity only).
- **Too warm**: a solid red banner above everything, with the one action. It is
  the only solid block of colour in the system, and it only works because it
  is rare.

We considered dimming the rest of the page during a breach and rejected it:
dimming drops `ink-faint` text below AA contrast exactly when it matters most.

## Colour

Colour is reserved for state. There is no brand colour and no decorative accent.

| Colour | Means | Never |
| --- | --- | --- |
| `fresh` green | Milk is cold and good | A generic success tick |
| `warn` amber | Getting close to warm; act soon | Any neutral highlight |
| `risk` red | Too warm; sell or chill now | A delete button, a brand flourish |
| `cool` blue | Temperature itself; the cooler running | A link colour |

`steel` exists only inside the can illustration. It is never text.

Every semantic colour ships as a **pair**, a pale ground plus dark text, and
both halves clear WCAG AA together.

### Colour never carries meaning alone

Each state ships a **dot, a word, and a sentence**. The sentence is built in
`src/lib/story.ts` from the specific concern, not just the status:

| Concern | Headline |
| --- | --- |
| too warm, cooler failed | The cooler stopped working |
| too warm, lid open | The lid was left open |
| cooler fault, milk still cold | The cooler stopped working (with "stays safe until…") |
| lid open 10+ min | The lid is open |
| battery hits cutoff within 6 h | Battery running low |
| offline | No signal from this can |
| fine | Milk is cold and good |

All copy lives in `story.ts`, so the headline, roster, banner and phone can
never disagree.

## Typography

**Outfit** for numbers and verdicts: geometric and round, with excellent
numerals at 104 px. **Plus Jakarta Sans** for everything else. No uppercase
labels, no letter-spaced micro-caps, no monospace. Numbers use `tabular-nums`.

## Charts

### Today (the day strip)

- **One line: milk temperature.** Its colour is the reading: blue while cold,
  amber approaching 8 °C, red above. It uses a vertical gradient in user space,
  so the colour is tied to height, not to time. No legend is needed.
- One soft zone: pale red above 8 °C, labelled "Too warm above 8°". Two dashed
  lines (8° and 2°). Time at the ends and the middle. Nothing else.
- **Pins** mark moments found in the readings (`src/lib/timeline.ts`): cooler
  stopped, too warm, back under 8°, lid left open, battery low, new milk in.
  Every event keeps its own dot on the line. Badges within 30 px merge into one
  that shows the most serious icon and a count. Labels alternate rows so they
  never overprint.
- **Signal gaps are never bridged.** A hatched band reads "No signal". A line
  through a gap would be a guess.

### Trip

The two times that matter, pickup and "safe until", on one line from now. The
answer is written above it ("Reaches the dairy cold", "Won't reach the dairy
cold"). An offline can shows no projection, because that would be a guess from
an old reading. The battery run-out mark only shows if it lands before pickup,
since the dairy recharges the can at collection.

### Never

- A dual y-axis. Ambient is a chip ("Outside 39°"), not a second series.
- A smoothly updating value for a can that is offline.

## Voice

Write what you would say to the person holding the can.

| Not this | This |
| --- | --- |
| Projected cold life | Stays safe until 3:02 pm |
| Peltier duty cycle | Cooling / Cold enough, cooler resting |
| MBRT grade III | Grade: Fair |
| BREACH | CAN-02 is too warm. Sell it now at the nearest dairy, or get it to a chiller. |
| Uplink loss | No signal from this can |
| Warm minutes: 153 | Above 8°C for 2h 33m today. That is what pushed the grade down. |

Times are 12-hour with "tomorrow" when it is ("1:20 am tomorrow"). Durations
read as speech (`3h 41m`).

**Provenance stays non-negotiable.** The header and footer always say whether
the data is live or demo.

## Components

| Piece | Rule |
| --- | --- |
| Card | 1px line, 12px radius, no shadow except hover lift |
| Hero | 14px radius; backdrop light follows the milk; grid areas reflow (side by side ≥1280 px, temp+can paired below that) |
| Status pill | dot + word, never colour alone |
| Chip | a fact with an icon; toned only when that fact is the problem |
| Segmented | sliding indicator animates `transform` only |
| Alert action | at most one per screen, only for watch/too warm; becomes "Alert sent" for 30 min |
| Skeleton | shaped like the layout it stands in for |
| Demo panel | simulator only; the D key; floating, never over live data |

Icons are Phosphor at `bold` weight, 14–17 px, always paired with a label.

## Motion

Animate `transform` and `opacity` only. Slow loops are allowed on the can
(milk surface, cooler light, warm air, heat shimmer) and the "keep an eye"
ring, because they say *this is alive*. Blocks fade up once on mount with a
stagger. Phone messages slide in when they arrive. `prefers-reduced-motion`
collapses all of it.

## Do

- Lead with the verdict, then the evidence
- Pair every colour with a word
- Show a problem's *reason*, not just its measurement
- Trace every visual detail on the can to a reading

## Don't

- Add a metric that does not change a decision
- Use uppercase labels or monospace
- Add a fifth state colour, or use a state colour decoratively
- Bridge a signal gap, or project from a stale reading
- Dim content for emphasis (it breaks contrast)
