# Audio: procedural soundscapes

TrueNorth ships no recorded audio. Every file under `assets/dist/audio/` is synthesised offline from a seeded
random generator (licence **Generated**), so a clean checkout reproduces identical bytes and nothing is downloaded.

| Piece | Where |
| --- | --- |
| UI cues (`click`, `correct`, `wrong`, `stamp`, `step`) and the original `wind` loop | `scripts/assets.mjs` |
| Ambience loops and one-shot cues (this document) | `scripts/lib/soundscapes.mjs` |
| Browser playback (Howler) | `app/adapters/audio/howler-audio.ts` |
| Crossfade / ducking / one-shot timing (pure, unit-tested) | `app/adapters/audio/soundscape-mixer.ts` |
| Tests | `tests/unit/adapters/audio-mixer.test.ts` |

## Generating

`generateSoundscapes({ outDir, upsertCredit })` writes `<outDir>/audio/<name>.wav` and credits every file through
`upsertCredit({ path: 'audio/<name>.wav', title, author: 'TrueNorth (scripts/lib/soundscapes.mjs)', license:
'Generated', source })`. It is idempotent: a file that already exists is never rewritten. `wind.wav` is a special
case — when it pre-exists it was produced (and is credited) by `scripts/assets.mjs`, so the module leaves both the
bytes and the credit alone.

It is meant to be called from `scripts/assets.mjs` right after the procedural-audio step:

```js
const { generateSoundscapes } = await import('./lib/soundscapes.mjs');
await generateSoundscapes({ outDir: dist, upsertCredit, log: console.log });
```

For a standalone render (e.g. to audition or measure): `node scripts/lib/soundscapes.mjs /some/dir` prints a table
of durations and sizes and writes into `/some/dir/audio`.

Format: 22 050 Hz, mono, 16-bit PCM WAV. Whole set: 29 files, **6.9 MB** (budget 12 MB). Loops are RMS-normalised
to -17 dBFS so districts sit at the same perceived level, then capped at **-3 dBFS peak**; one-shots are
peak-normalised to -3 dBFS. `aurora-drone` is deliberately rendered at 60 % (subtle).

### Loops (seamless, 8–12 s)

Each loop is rendered with 0.5 s of pre-roll (so filters and envelopes have settled at sample 0) and 0.3 s of tail;
the tail is equal-power crossfaded into the head, and discrete events (chirps, horns, creaks) are only placed inside
the loop body so none straddles the seam. `ocean`, `harbour`, `rink` and `aurora-drone` are additionally periodic in
their loop length (wave period 10 s / 6 s; hum and pad partials complete whole cycles), so their seams are exact.

| File | Length | Recipe |
| --- | --- | --- |
| `wind` | 10 s | brown noise, 380 Hz low-pass, slow gust envelope, faint 900 Hz whistle on gusts (only written when absent) |
| `canal-water` | 10 s | lapping: band-passed white noise under random lap bumps + bubble pings; 110 Hz brown "traffic" bed |
| `city-hum` | 12 s | 160 Hz brown rumble with swells, 1.1 kHz pink tyre wash, two far horns (chord of sines + breath, low-passed) |
| `forest` | 12 s | pink noise through a 1.6 kHz band-pass (needles) on gusts, 300 Hz brown floor, 3 bird "species" of sine-sweep chirps in phrases |
| `ocean` | 10 s | 10 s raised-cosine wave envelope on 220 Hz brown; foam = 2.8 kHz band-passed white lagging the crest by 1.3 s; pink wash |
| `rain` | 10 s | granular impulses (2 500/s) band-limited 350 Hz–5 kHz, high-passed pink wash, six rising-pitch drips |
| `snowfield` | 10 s | 240 Hz brown under slow gusts, muffled 500 Hz swirl, four resonant (Q 14) rising creaks |
| `harbour` | 12 s | 6 s wave swell + foam, lapping water, three low-passed gull cries, two rope creaks (pulse train through a sweeping Q 9 resonator) |
| `tundra-wind` | 10 s | high-passed (1.4 kHz) white on sparse gusts (power 2.5), Q 22 whistle sweeping 1.5–2.8 kHz, thin brown floor |
| `campfire` | 8 s | 140 Hz brown roar, 450 Hz pink flutter (7 Hz AM), 45 resonant crackles (1.5–5.5 kHz) and five low pops |
| `prairie` | 10 s | 2.2 kHz pink swish through grain, 320 Hz brown, three insect voices (4–6.5 kHz carriers, 22–48 Hz stridulation) |
| `rink` | 10 s | 60/120/180/240 Hz hum with 0.3 Hz beating, HVAC pink wash, five distant skate scrapes (3.2→1.5 kHz sweeps), one board thump |
| `aurora-drone` | 12 s | just-intonation A2 sus2/add9 pad: detuned sine triplets per voice, per-voice LFOs (12/6/4/3 s), 12 s low-pass sweep, faint shimmer |

### One-shots (0.3–3 s)

| File | Length | Recipe |
| --- | --- | --- |
| `goose-honk` | 0.42 s | band-limited saw gliding 360→470→360 Hz through three nasal formants |
| `goose-flock` | 2.6 s | seven honks at random pitches/offsets, half low-passed for distance |
| `loon-call` | 2.2 s | two sine notes (600→690 Hz, 880→830 Hz) with 11 Hz tremolo and lake reverb |
| `beaver-splash` | 1.3 s | slap burst, low-pass sweep 4 kHz→500 Hz body, 70 Hz thump, eight droplet pings |
| `moose-call` | 2.0 s | saw 95→150 Hz through 330/780/1500 Hz formants, breath noise, small reverb |
| `bear-grunt` | 0.7 s | jittered pulse train 72→54 Hz through two formants, breathy low-pass |
| `gull` | 0.95 s | two raspy (30 Hz FM) descending saw notes, band-passed at 2 kHz |
| `skate-scrape` | 0.55 s | white noise through a 3.2→1.4 kHz sweeping band-pass, 6 kHz ice hiss, edge tick |
| `footstep-snow` | 0.32 s | two dense crackle bursts (heel/toe) at 1.8 kHz, brown thud |
| `footstep-gravel` | 0.38 s | sparse impulses through a 3 kHz band-pass, soft low thud |
| `footstep-wood` | 0.30 s | 110 Hz pitched thump + knock, 4 ms feedback comb for hollowness |
| `train-whistle` | 2.6 s | four-tone horn chord (233/311/370/466 Hz) with harmonics, breath, pitch bend and long reverb |
| `church-bell` | 3.0 s | eight inharmonic partials (hum, prime, tierce, quint, nominal…) with separate decays, strike transient |
| `fiddle-riff` | 2.6 s | D-major pentatonic phrase (D E F# A B A F# D): band-limited saw, 5.5 Hz vibrato, body formants, bow noise, reverb |
| `whistle-referee` | 0.85 s | 2150 + 2330 Hz tones with ~38 Hz "pea" amplitude modulation |
| `camera-shutter` | 0.30 s | two filtered clicks 110 ms apart with a short mirror whir between |

Determinism: each file is seeded with `hashString(name)` (FNV-1a) into mulberry32 — the same generator as
`common/rng.ts` — so a render is reproducible on any machine.

## Content: zones

`content/schemas/district.schema.json` describes a **soundscape** object on `scene.ambience` (district-wide) and on
each `pois[].ambience` (zone override):

```json
{ "loop": "harbour", "oneshots": ["gull", "beaver-splash"], "volume": 0.6 }
```

`loop` and every `oneshots[]` entry name a file above (without `.wav`); `volume` is 0..1 and is multiplied by the
master volume from settings.

## Playback

`AudioPort.setSoundscape(zone)` (in `app/application/engine-ports.ts`) is the engine-facing entry point;
`playAmbience(id)` remains as a thin wrapper equal to `setSoundscape({ loop: id, oneshots: [], volume: 0.45 })`.

`HowlerAudio` keeps two looping `Howl` slots. Switching zones starts the new loop at volume 0 on the free slot and
runs a **1.5 s equal-power crossfade** (sine in / cosine out, so the summed power stays constant across noisy beds);
the outgoing slot is unloaded once drained. Changing only the volume of the current loop ramps in place. If the
same loop is already playing and the slot is not fading out, nothing restarts. `stopAmbience()` fades both slots out
over 0.6 s.

One-shots are scheduled by `SoundscapeMixer` every **6–25 s** from a PRNG seeded per zone
(`hashString(loop + '|' + oneshots.join(','))`), so a given zone always plays the same sequence at the same
offsets from entry. Each cue carries a random stereo pan in ±0.8 (applied through Howler's `stereo()` when the
spatial plugin is present) and a gain of `master × duck × min(1, zone.volume × 1.4)`.

`duck(true)` (menus, dialogue, questions) ramps everything — loops and one-shots — to **40 %** over 300 ms and
`duck(false)` ramps back. Gains are applied by a 50 ms ticker that runs only while a ramp is in flight, a slot needs
unloading, or a one-shot is pending.

All of the timing lives in `SoundscapeMixer` (no Howler, no DOM): it takes a millisecond clock and a seeded RNG
factory, and `tests/unit/adapters/audio-mixer.test.ts` covers the crossfade curve and slot hand-over, the scheduling
window and determinism, and the ducking ramp.

## Checks

```sh
npx tsc -p tsconfig.json --noEmit
npx eslint app scripts tests
npx vitest run tests/unit/adapters
node scripts/lib/soundscapes.mjs /tmp/soundscapes   # render + size/duration table
```
