# Brag Plan: SN Instance Scan

## What is this app?
A read-only ServiceNow scoped application that walks an instance application-by-application
and produces a full architecture inventory — tables, automation, integrations, security,
cross-scope dependencies and base-table customizations — with an optional GenAI summary and
a downloadable PDF report.

## The angle
Most ServiceNow instances are inherited, not built. Years of apps, plugins and quiet
customizations nobody wrote down. The premise: **you cannot govern what you have never
counted.** This tool counts it in one click, and changes nothing while doing it.

The specificity comes from real numbers off a real instance — 1,350 installed modules,
84 tables profiled, 59 inbound cross-references, 44 base-table customizations — not
invented stats.

## Hook (first 2-3 seconds)
A single line on near-black, in Sora: **"You inherited the instance."**
Then, beneath it, a number counting up fast and stopping hard: **1,350 installed modules.**
The hook is the gap between "you own this" and "you have never seen it."

## Key moments (the middle)
- **One click, six scan modes.** The console's Start-a-scan row; "Full" is pressed, the
  status pill flips to a pulsing **Running**.
- **The dashboard filling in.** Metric tiles count up to the real figures: 84 tables
  profiled, 1,350 installed modules, 5 apps scanned. Numbers arrive one tile at a time.
- **The findings nobody tracks.** 59 inbound cross-references and 44 base-table
  customizations — the governance signal, held on screen with the line
  **"Nothing was written. Read-only by design."**

## Outro / punchline
The PDF report sliding into frame, then the product name and the line:
**"SN Instance Scan — know what you actually run."**

## User flow worth showing
Entry → key action → result, straight from the console:
1. Open the Instance Scan Console (dark theme, indigo accent, left rail).
2. Press **Full** in Start a scan — status pill goes to Running.
3. The dashboard fills: run-activity tiles, then coverage-and-findings tiles with real counts,
   then a report to download.

## Tone
- Preset: polished
- Creative direction: quiet enterprise product film — an audit tool that behaves like one
- Interpretation: few scenes, long holds, no jokes. Restraint is the point: the product's own
  claim is that it is careful and read-only, so the edit should feel careful too. Slow
  crossfades, generous whitespace, numbers doing the talking.

## Format: landscape — 1920x1080
## Duration: 20s target

## Visual identity (from the project)
- Background (dark): `oklch(15% 0.018 265)`
- Surface: `oklch(20.5% 0.018 265)`
- Accent: `oklch(72% 0.16 265)` (indigo, dark theme)
- Text: `oklch(95% 0.008 265)` / muted `oklch(66% 0.02 265)`
- Status: running `oklch(68% 0.16 235)`, complete `oklch(66% 0.14 150)`, review `oklch(78% 0.13 80)`
- Display font: Sora (600/700)
- Body font: Work Sans (400/500)
- Strongest visual element: the console dashboard — big Sora numerals over dark cards with
  1px borders, 14px radius, and opaque status pills

## Share copy (draft)
Most ServiceNow instances are inherited, not built. SN Instance Scan counts every table,
script, integration and quiet customization in one pass — and writes nothing back.

## Audio direction
- Role: sparse professional accents over a low, warm bed
- Music: restrained corporate/ambient bed, slow build, no drop
- Music treatment: fade in over scene 1, sit low under the count-ups, lift slightly into the
  findings beat, fade to near-silence under the final product name
- Music cue guidance: bundled preset if available, otherwise detect at composition time;
  target one strong cue at the 1,350 number landing and one at the findings reveal; sequential
  tile reveals should use every-other-beat spacing so each number is readable
- Audio-reactive treatment: subtle — allow the accent glow on the hero number to breathe with
  bass energy; no waveform bars, no visualizers
- SFX posture: sparse, motion-matched. A soft click on the scan button, a light tick under the
  counters, one quiet paper/confirm tone on the PDF
- Audio-coupled moments: the count-up ticks, tile-by-tile arrival, the button press
- Restraint rule: no whooshes, no risers, no impacts. This is an audit tool, not a trailer.

## Storyboard

### Scene 1 — The inheritance — 4.5s
Near-black field. Sora 600, centred, generous letter-spacing: "You inherited the instance."
Holds ~1.4s. Line fades back, and a single large numeral counts up fast and stops hard:
**1,350** with "installed modules" small and muted beneath it. Indigo accent glow behind it.
Sequential/interaction: yes — the headline settles first, then the numeral count-up runs ~0.9s and lands.
Audio intent: quiet, weighted, a little ominous. The number landing is the first real beat.
Audio-coupled idea: soft counter ticks under the count-up, one low accent as it lands.
Music: low warm bed fading in.
Transition mood: soft crossfade → Scene 2

### Scene 2 — One click — 5s
The console's Start-a-scan row on the dark surface: four primary buttons (Full, Custom Only,
Installed Modules, AI Agent Discovery). Cursor moves to **Full** and presses it. The button
depresses; a status pill flips to a pulsing **Running**. Small muted line: "Six scan modes.
No configuration."
Sequential/interaction: yes — simulate the cursor press on Full, then the pill state change to Running with its pulsing dot.
Audio intent: precise and small. One click, then the room goes quiet as work starts.
Audio-coupled idea: a soft UI click on the press; a faint pulse under the Running dot.
Music: bed continues, unchanged.
Transition mood: soft crossfade → Scene 3

### Scene 3 — It counts everything — 5.5s
The dashboard. Metric tiles arrive one at a time on the dark cards, each a big Sora numeral
over a muted label: **5** apps scanned, **84** tables profiled, **1,350** installed modules,
then **59** inbound cross-references and **44** base-table customizations, the last carrying
an amber "Review" pill. Each number counts up as its tile lands.
Sequential/interaction: yes — five tiles arrive one by one, each count-up ~0.4s, spaced on every other beat so each figure is readable; all five hold together on screen for the final ~1.2s.
Audio intent: steady accumulation. Each tile is a small, clean arrival, not an impact.
Audio-coupled idea: a light tick per tile arrival, counter ticks under each number.
Music: bed lifts slightly as tiles accumulate.
Transition mood: soft crossfade → Scene 4

### Scene 4 — Read-only, on purpose — 5s
The two governance figures hold large: **59 cross-scope dependencies · 44 base-table
customizations.** Beneath them, in Work Sans, the line **"Nothing was written. Read-only by
design."** Then a PDF report page slides up into frame, and the whole thing settles to the
product name in Sora: **SN Instance Scan** with "know what you actually run."
Sequential/interaction: yes — the two figures hold, the read-only line fades in beneath them (~1.3s hold), then the PDF slides in and the wordmark resolves.
Audio intent: resolution and calm. The claim lands in near-silence.
Audio-coupled idea: one quiet confirm tone as the PDF settles.
Music: fades down under the read-only line, near-silent on the wordmark.
Transition mood: settle and hold — end

**Music mood for this video:** restrained corporate/ambient — low, warm, slow build, no drop
**Audio summary:** A low bed fades in under the opening claim, stays quiet through a single
button click, accumulates gently as five real numbers arrive tile by tile, lifts once for the
governance findings, then falls away so "Nothing was written" lands in near-silence.
