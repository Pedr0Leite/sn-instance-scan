# Hyperframes Composition Brief: SN Instance Scan

## Objective
Create a short, client-facing launch film for SN Instance Scan — a read-only ServiceNow
instance assessment tool. Serious enterprise product film, not a joke video.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20s (4 scenes: 4.5 / 5 / 5.5 / 5)

## Source Material
- Project root: `/mnt/c/Users/pedro/Documents/Programacao/Github/ServiceNowApps/sn-instance-scan`
- Primary files read: `src/client/app.css` (palette, fonts), `src/client/components/*.tsx`
  (console UI), `src/fluent/tables.now.ts` (schema), `CLAUDE.md` (product behaviour)
- Product name: **SN Instance Scan**
- Tagline / strongest claim: **"Know what you actually run."**
- Secondary claim (verbatim, load-bearing): **"Nothing was written. Read-only by design."**
- Key UI moment to recreate: the **Instance Scan Console dashboard** — dark surface cards,
  1px borders, 14px radius, large Sora numerals over small muted Work Sans labels, and the
  opaque status pills (blue "Running" with a pulsing dot, green "Complete", amber "Review").
- Copy that must appear verbatim:
  - "You inherited the instance."
  - "1,350 installed modules"
  - "Six scan modes. No configuration."
  - "Nothing was written. Read-only by design."
  - "SN Instance Scan"
  - "Know what you actually run."
- Real figures (from a live scan — do not invent others):
  5 apps scanned · 84 tables profiled · 1,350 installed modules ·
  59 inbound cross-references · 44 base-table customizations

## Creative Direction
- Tone preset: polished
- Creative direction: quiet enterprise product film — an audit tool that behaves like one
- Interpretation: few scenes, long holds, slow crossfades (0.6–0.8s), no jokes, no impacts.
  The product's whole claim is that it is careful and changes nothing, so the edit must feel
  careful too. Numbers carry the story; motion stays restrained.
- Angle: Most ServiceNow instances are inherited, not built — years of apps, plugins and quiet
  customizations nobody wrote down. You cannot govern what you have never counted. This tool
  counts it in one click, and writes nothing back.
- Hook: "You inherited the instance." then a hard-landing count-up to **1,350**.
- Outro / punchline: "Nothing was written. Read-only by design." → PDF report → wordmark.
- Avoid:
  - Generic SaaS language ("streamline", "empower", "unlock")
  - Abstract filler visuals, particles, waveform bars, strobing
  - Any redesign of the console's visual identity — match it
  - Inventing metrics beyond the real figures listed above

## Visual Identity
- Background: `oklch(15% 0.018 265)`
- Surface (cards): `oklch(20.5% 0.018 265)`
- Text: `oklch(95% 0.008 265)`; muted labels `oklch(66% 0.02 265)`
- Accent: `oklch(72% 0.16 265)` (indigo)
- Status: running `oklch(68% 0.16 235)` · complete `oklch(66% 0.14 150)` · review `oklch(78% 0.13 80)`
- Display font: Sora (600/700) — headlines and all numerals
- Body font: Work Sans (400/500) — labels and supporting lines
- Visual references from the project: dashboard metric tiles, the Start-a-scan primary button
  row, opaque status pills, the left nav rail's travelling accent pill

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The inheritance — 4.5s — "You inherited the instance." holds, then a large count-up lands on
   **1,350** with "installed modules" beneath it.
2. One click — 5s — Start-a-scan button row; cursor presses **Full**; status pill flips to a
   pulsing **Running**; line: "Six scan modes. No configuration."
3. It counts everything — 5.5s — five dashboard tiles arrive one at a time with counting
   numerals: 5 / 84 / 1,350 / 59 / 44; the last carries an amber "Review" pill; all five hold
   together at the end.
4. Read-only, on purpose — 5s — the two governance figures hold large, then
   "Nothing was written. Read-only by design.", then a PDF report slides up and resolves to the
   wordmark + "Know what you actually run."

## Audio
- Audio role: sparse professional accents over a low, warm bed
- Audio arc: bed fades in under the opening claim → stays quiet through a single button click →
  accumulates gently as five numbers arrive → lifts once for the governance findings → falls
  away so "Nothing was written" lands in near-silence
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (110 BPM —
  chosen as the slowest bundled track, for restraint)
- Music treatment: fade in over scene 1, sit low (≈0.3–0.4) under the count-ups, lift slightly
  into scene 4's findings beat, fade to near-silence under the wordmark
- Music cue guidance: bundled preset copied alongside the track
  (`happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`).
  Suggested locks (3 only): **3.55s** the 1,350 landing · **6.01s** the button press ·
  **18.01s** the PDF/wordmark resolve.
  Sequential tiles: beats are ~0.545s apart, which is **too fast for readable numbers** — snap
  the five tiles to **every other beat**: 9.83 / 10.93 / 12.02 / 13.11 / 14.20, then hold all
  five together ~0.8s.
- Audio-reactive treatment: subtle — allow the indigo accent glow behind the hero numeral and
  the card presence to breathe with bass/RMS energy. No waveform bars, no visualizers, no
  particle systems.
- Audio-coupled moments:
  - Scene 1 numeral count-up — counter ticks, one low accent as it lands
  - Scene 2 button press — a single soft UI click; faint pulse under the Running dot
  - Scene 3 tile arrivals — one light tick per tile, fired at the same timestamp as the visual
  - Scene 4 PDF settle — one quiet confirm tone
- SFX selection guidance: sparse and motion-matched. Interface/click family for the button and
  tiles; nothing percussive or comedic. Choose files after the animation exists.
- SFX analysis guidance:
  `/home/pedro/.claude/plugins/cache/brag/brag/0.2.2/skills/brag/assets/sfx/sfx-analysis.json`
  — prefer low high-frequency-risk files, since the tile tick repeats five times.
- Exact SFX choice: Hyperframes decides filenames, timestamps, density and volume.
- Audio files: music already copied to `brag-output/composition/assets/music/`; copy any
  selected SFX into `brag-output/composition/assets/`.
- Restraint rule: no whooshes, no risers, no impacts. This is an audit tool, not a trailer.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`,
`hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`.
/brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do
not route into its generic promo / launch-video workflow. Prefer native Hyperframes
conventions over anything in `/brag`.

Requirements:
- Recreate the console dashboard tiles and status pills as real HTML/CSS in the composition —
  this is the "show the thing" scene and must look like the actual product.
- Keep every line readable: short labels ≈0.8s settled, sentences ≈0.3s/word (min 1.2s).
- Keep total duration 20s (15–25s band).
- Include the music bed and sparse SFX.
- Beat-lock the 3 major moments listed above within ±0.15s; mark them `// beat-locked`.
- Snap the five tile arrivals to the every-other-beat grid above within ±0.10s; mark
  `// beat-grid`. Readability wins over the grid if they ever conflict.
- Wire at least one visual element to audio data (accent glow / card presence). If extraction
  is unavailable, document it and skip — do not block the render.
- Use local assets only.
- Run `npx hyperframes check` before render — it is brag's single gate.
