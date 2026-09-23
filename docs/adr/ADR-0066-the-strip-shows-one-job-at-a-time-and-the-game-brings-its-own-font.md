# ADR-0066: The strip shows one job at a time, and the game brings its own font

- Status: Accepted (2026-09-21). **Amended by ADR-0071 (2026-09-23):** the bundled faces' ceiling in §1 is
  ≤ 300 KB, not ≤ 200 KB, by the product owner's decision. Nothing else here moves.
- Settles the residual ADR-0045 §1 left to the product owner — "a three-line French prompt with a long task
  does not fit in a third of the screen at true 200 %" — and the second, larger defect found while trying to
  settle it by copy: **the game does not control the font its layout is measured against**.
- **Amends ADR-0045 §1.** The strip's order is unchanged and its spacing is unchanged. What changes is that
  the offer row and the task row are **no longer drawn at the same time**, so the pair ADR-0045 measured and
  could not fit is a pair the game no longer produces. Both of ADR-0045's two "not taken" measures — drawing
  the task at 175 % when the setting says 200 %, and hiding the word "Task" — are **refused outright** here,
  not left open; see §2 and the alternatives.
- **Amends ADR-0039 §1**, in one respect: the strip's children are still in that order, but the task and the
  offer are alternatives rather than neighbours. ADR-0039's "the strip draws what the player can do first",
  its chrome-holds-still rule and its one-scroll-box decision all stand.
- **Amends ADR-0004**, third bullet: the permitted-licence test gains a narrow, font-only exception for
  `OFL-1.1`. The general "no copyleft" test is unchanged for every other kind of asset, and ShareAlike stays
  forbidden everywhere. `content/schemas/credits.schema.json` must follow; see the obligations.
- **Amends `CLAUDE.md`** in the same commit as this ADR: the **Licence** row, for the same reason, and a new
  **Type** row recording that the game ships its own face. Nothing else in the agreement moves.
- **Amends `docs/stories/TN-HUD-hud-and-menu.md`** (`TN-HUD-01`'s list of what the strip holds, and
  `TN-HUD-08`'s 200 % scenario) and **`docs/stories/TN-REACH-what-is-in-reach.md`** (the offer is drawn
  *instead of* the task, not beside it; and the open defect that file records at the end is answered here).
  Those files are their owners' to rewrite; this ADR does not rewrite them, and an obligation below carries
  the rewrite.
- **Does not amend** `TN-NAMES-naming-real-places.md`, `TN-COPY-strings-and-counts.md`, or the copy rows
  `task-fits-the-strip` shortened. Those rows are better short and stay short; they are simply no longer the
  thing standing between a player and their task.
- Slice: F2d (readability pass), residual, plus the font defect found under it.
- Numbering. `main` at `a59679d` holds ADR-0001…ADR-0037, ADR-0039…ADR-0049 and ADR-0051…ADR-0064.
  `git ls-remote --heads origin` reports eight remote heads (`main`, `archive/v0.1`, three `dependabot/*`,
  `how-the-game-grows`, `lesson-passage-route`, `task-fits-the-strip`), and `git log --all --name-only --
  docs/adr` across every ref this repository can see puts the high-water mark at **0065** — the guide-reach
  ADR on `origin/how-the-game-grows`, PR #132, green and about to land. No document's prose claims 0066.
  **0066 is the first number above the mark.** The holes at 0038, which nothing ever occupied, and at 0050,
  spent by a dropped draft, stay untaken, per ADR-0052 and ADR-0063. This check is made every time because
  it has failed before: on 2026-09-17 two agents on branches that could not see each other both took 0057
  and both landed.

## Context

### The defect that no copy change can fix

At 200 % text on a 390 × 844 portrait phone, the HUD strip cannot hold a landmark **offer** row and an
"Answer N questions about …" **task** row at once. The task ends below the strip, and the player has to
scroll inside the strip to find out what they are doing. **Ten of the ten built levels overflow in at least
one language.** This is shipped today.

It is not a copy problem, and that is established by having tried. `origin/task-fits-the-strip` shortened
twenty-five of twenty-seven offer rows from two or three lines to one — "Look at the Halifax Town Clock"
became "Look at the clock", « Regarder la côte de granit » became « Regarder la côte » — and the sweep still
reports fifty overflow lines on CI.

The arithmetic, measured on the CI runner's rendering and recorded in
`docs/stories/TN-REACH-what-is-in-reach.md` (the section "What the strip can hold is a property of the FONT"),
is why no further shortening helps:

- the prompt column is ~272 px in Liberation-Sans-equivalent width; a **one-line offer** holds 16–17
  characters, and `"Look at the "` / « Regarder le » is already 12. That is **four or five characters for the
  landmark's name**. Nothing can be named in five, so every offer takes two lines, and the task gets at most
  three;
- a **three-line task** holds 47 (EN) or 53 (FR) characters, of which `"Task: Answer 5 questions about "` /
  « Mission : Répondez à 5 questions sur » is 31 or 37. That is **16 characters of topic**, in both
  languages. Sixteen will not hold "the flag and the coat of arms" or « les peuples qui ont bâti le Canada »;
- the budget is a clean invariant: **offer lines + task lines ≤ 5**. `line-height` is fixed in the stylesheet
  (36.8 px for the offer, 38.4 px for the task at 200 %), so only the line counts move;
- the strip's other rows are irrelevant. `hint`, `notice` and `warning` change the overflow by **0.0 px**,
  because ADR-0045 already put the task above them.

Sixteen characters is not a budget an author can write in. The lever is not the words.

### The second defect, which is why this is an ADR and not a patch

**The measurement is not reproducible across machines, because the game does not control its own font.**
`app/ui/screen-styles.ts` declares `font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial,
sans-serif` for `.tn-screen` and for `.tn-hud`; `app/adapters/phaser/boot-scene.ts` declares the same stack
for the canvas. `system-ui` resolves per platform, per image, per installed package set. On the developer
machine it resolved to Liberation Sans and the sweep measured **0 of 144 pairings overflowing**; on the CI
runner it resolves to a wider face and the same spec measures **50**. Narrowing the local viewport reproduces
CI's numbers exactly — the pixel values, and which offer the spec picks as tallest — so the cause is glyph
advance width and nothing else.

Everything else in the strip is already pinned. Sizes are `rem`, line heights are fixed ratios, padding and
gaps hold still under `calc(Nrem / var(--tn-text-scale, 1))` (ADR-0039). **Advance width is the one input to
this layout that nobody chose**, and it is the input that decides where a line wraps, and wrapping is the
whole mechanism.

Two consequences, both of which this ADR has to answer:

1. A gate that flips with the runner image is not a gate. It is a measurement of the runner. Fixing the
   layout does not fix this.
2. The runner's face may be **stricter than any device a player will hold**. If it is DejaVu Sans — a common
   Linux fallback, and notably wide — then SF (iOS) and Roboto (Android) are both narrower, and the game is
   being held to a rendering no player sees. The face has not been identified yet. This ADR is written so
   that the answer does not change the decision; see §4.

### A third thing, found while writing this

The project is not "already in the business of controlling type". It is in the business of **naming** type
and hoping.

`[data-tn-font="dyslexia"]` selects `"Atkinson Hyperlegible", "Comic Sans MS", Verdana, Tahoma, sans-serif`,
and **no font file ships**: there is no `woff2`, `ttf` or `otf` anywhere in the tree outside
`node_modules/`, and `assets/credits.json` credits none. So the dyslexia-friendly font toggle — a row in
CLAUDE.md's accessibility section, required and not aspirational — today resolves to Comic Sans MS where
Microsoft's core fonts happen to be installed, to Verdana or Tahoma where they are not, and to the platform
default sans where neither is. On a Linux device with none of the three it changes nothing but
`letter-spacing` and `word-spacing`. No test asserts that the toggle changes the rendered face; the unit
tests assert the attribute, and the a11y suite asserts the switch's knob.

That is a second, independent reason to bundle a face, and it means the payload cost below buys two things.

## Decision

### 1. The game ships its own face, and the HUD never measures `system-ui`

**Yes, a bundled face.** Not a fallback stack with known metrics, and not "neither".

- The UI ships **one bundled text face** used by `.tn-screen`, `.tn-hud` and the Phaser canvas' text, and
  **one bundled face for the dyslexia toggle**, so that the toggle changes the rendering on every device
  rather than on some of them.
- `system-ui`, `-apple-system`, `"Segoe UI"`, `Roboto`, `"Comic Sans MS"`, `Verdana` and `Tahoma` leave the
  stacks. A stack whose entries may or may not be installed, in versions nobody chose, is the defect; naming
  more of them does not make it deterministic, it makes it deterministic-looking.
- The faces are shipped assets under `assets/`, credited in `assets/credits.json` with `kind: "shipped"`, and
  precached by the worker with the rest of the initial payload (ADR-0034).
- **Weights.** The stylesheet asks for 400, 600 and 800. A bundled family that offers only 400 and 700 is
  acceptable — CSS font matching picks 700 for both 600 and 800 and does **not** synthesise — but a family
  where the browser would synthetically embolden is **not**, because synthetic emboldening widens glyphs by
  an amount nobody specified, which is this ADR's defect arriving through the back door. The implementer
  asserts no synthesis, per the obligation below.

**Why not a defined fallback stack with known metrics.** Because a stack does not have metrics. It has a list
of family *names*; what resolves is a property of the device, and a face's metrics are a property of its
version. `size-adjust`, `ascent-override` and `descent-override` on a fallback `@font-face` normalise
*average* advance width toward the bundled face, which helps and should be used — but average width is not
where a line wraps. Two faces with identical average width wrap a French sentence in different places.

**Why the pin is necessary and not sufficient, which is the hinge of this whole document.** A bundled font
can still fail to arrive: a cold first paint before the worker holds it, a blocked or failed request, a user
stylesheet, a reader's own font forced by the platform. `font-display` decides what is drawn in the
meantime, and every choice it offers ends in the fallback some of the time. **So the layout must survive a
font the game did not choose, and pinning alone cannot make it.** That is §2.

**Licence and budget.**

- A font under `MIT` or `Apache-2.0` already satisfies ADR-0004. In practice the legibility faces this game
  wants are `OFL-1.1`, which ADR-0004's "no copyleft condition" test forbids today — Atkinson Hyperlegible,
  the family the stylesheet already names, is OFL-1.1 (`github.com/googlefonts/atkinson-hyperlegible`,
  `OFL.txt`). ADR-0004 is amended for fonts only. **Why OFL is admitted where CC BY-SA is refused:** ADR-0004
  rejects ShareAlike because "a forked repository should not inherit an obligation it did not choose", and
  OFL imposes no such obligation. Its reciprocity binds the **font file and its derivatives** and explicitly
  does not reach a document, a web page or a program that uses or embeds the font. A fork inherits exactly
  three things: keep the font file under OFL, keep its copyright notice, and do not ship a *modified* copy
  under the Reserved Font Name. None of those touches the fork's own code, art or question data, which is
  what the ADR-0004 test was protecting.
- **The shipped font file is not modified.** No subsetting, no re-hinting, no renaming. Two reasons, and the
  second is the one that matters: subsetting is modification and would drag the Reserved Font Name clause in,
  and a Latin legibility face with the French accents this game needs is small enough that the saving is not
  worth the licence question. **Ceiling: the bundled faces together add ≤ 200 KB to the initial payload**,
  against a budget of 8 MB. If a candidate cannot meet that unmodified, it is not the candidate.
  **Amended by ADR-0071 (2026-09-23): ≤ 300 KB** (300 000 B). The owner chose to ship Atkinson Hyperlegible and
  OpenDyslexic at 400 and 700, all four unmodified, 258 376 B together.
- The face must not be **wider** than what the game is measured on today. Stated mechanically so it can be
  checked rather than eyeballed: the pinned face's advance width for the sweep's reference strings, at the
  same size, must be **no greater than the current CI runner's** for the same strings. A pin that loses
  ground is not a pin, it is a regression with a licence file.

### 2. The strip shows one job at a time

This is the part that fixes the defect, and it is the option the question invited: **the offer row and the
task row are two different jobs, and nothing says they must be simultaneous.**

- **When nothing is in reach**, the strip draws the task in full, as it does today.
- **When a target is in reach**, the strip draws the **offer** in full and the task **collapses to a bounded
  indicator** — a fixed word and a count, `Task 3/5` / « Mission 3/5 », at most one line in either language.
  The full sentence returns the moment the offer is withdrawn.
- The indicator carries the **same information for everybody**: its visible text and its accessible name say
  the same thing, the name simply expanded for speech ("Task 3 of 5"). It must **not** carry the full task
  sentence in an `aria-label` while hiding it from sight. TN-REACH already names that asymmetry as a defect —
  "the name being in a button for one of them and nowhere for the other" — and it would be that defect again.
- **The task sentence gains a permanent home that is not the strip: the level menu**, which is a sheet that
  scrolls, is already one press away, and is already in the single-switch ring. It draws the task in full
  whenever there is one.
- `hud-task-cue` ("Behind you" / « Derrière vous ») belongs to the **full** task row and is not drawn beside
  the indicator. It is already announced once, when it becomes true, and that announcement is unchanged.
- **The rule is not conditional on text scale.** It applies at 100 % exactly as at 200 %, in both languages,
  on every device. This is deliberate and it is the compliance argument in §3 below.

**What this buys, in the only unit that matters.** The invariant stops being "offer lines + task lines ≤ 5"
and becomes "**one row ≤ 4 lines, with the fifth line as headroom**", because the indicator is one line and
content cannot lengthen it. On the widest rendering measured, four lines hold about 62 (EN) and 70 (FR)
characters, so after the 31/37-character stem the author has roughly **31 (EN) and 33 (FR) characters of
topic** instead of sixteen. The copy lever, dead at sixteen, is alive at thirty-one:

| longest shipped task, with its label | chars | 4-line capacity on the widest face measured |
|---|---|---|
| "Task: Answer 5 questions about the results and the government" | 61 | ~62 |
| « Mission : Répondez à 5 questions sur les peuples qui ont bâti le Canada » | 71 | ~70 |

Every English task fits. **One French topic is over by about one character** — « les peuples qui ont bâti le
Canada », 34 against ~33 — and that is now a one-word edit in one quest file rather than a defect with no
available fix. That is the difference this decision makes: the same problem, moved from "no copy can fix it"
to "shorten one phrase, and the gate will say when".

### 3. What a player at 200 % text loses, and why that is still compliant

Say it plainly, because the question deserves a plain answer rather than a reassurance.

**What every player loses:** while standing within reach of something, the task sentence is replaced by a
count. They get it back by stepping out of reach, by opening the menu, or by listening — a new task is still
announced in full in the live region when it arrives, exactly as it is today.

**What a player at 200 % specifically loses: nothing that a player at 100 % keeps.** That is the whole point
of making the rule unconditional. WCAG 1.4.4 asks that text can be resized to 200 % "without loss of content
or functionality"; the test is a comparison between the scaled page and the unscaled one, and under this rule
those two pages hold the same content. Today's behaviour fails that test in the other direction: at 100 % the
task is on screen and at 200 % it is not, which is loss of content caused by resizing, which is the
non-conformance being fixed.

**A cap on how far HUD chrome grows with `--tn-text-scale` is refused**, and so are its two relatives:

- **Chrome already holds still.** ADR-0039 made the strip's padding, gaps, borders and control minima
  `calc(Nrem / var(--tn-text-scale, 1))`. There is nothing left to cap there; the only remaining lever is the
  **text**, and capping the text is the thing that must not happen.
- **Drawing the task at 175 % when the setting says 200 %** — ADR-0045's first unchosen measure — is refused.
  It is a straightforward 1.4.4 failure, it silently disagrees with the number the Settings slider shows the
  player, and it singles out the one row the player most needs to read. If it were acceptable, the fix would
  have been to cap at 150 % and stop having this conversation.
- **Hiding the word "Task" / « Mission » from sight while keeping it for a screen reader** — ADR-0045's
  second — is refused for the reason given in §2: it makes the sighted player and the screen-reader player
  read different strips, and it buys about six characters.
- **Letting the strip grow past a third of the viewport** at large text is refused. At 200 % it would need
  roughly 45 vh, and the thing it would cover is the level the player is walking through, including the
  landmark they are walking to. Trading the playfield for a sentence is a worse loss than delaying the
  sentence by one step, and it breaks `TN-HUD-01` and the "skater is drawn inside the upper two thirds"
  scenario.

### 4. What the gate measures, and with what margin: both, and the margin is a second run

The sweep on `origin/task-fits-the-strip` is the right sweep — it pairs each quest with **its own** level's
offer rows, and it picks the **tallest** offer rather than the longest string, both of which are correct and
are kept. What changes is what it asserts and what it asserts it against.

**a. It asserts the face before it measures anything.** Before the first `getBoundingClientRect`, the spec
checks that the pinned family is loaded and rendering — `document.fonts.check` for the family at the size
under test, **and** a width assertion for a recorded reference string, because `fonts.check` answers a
question about availability and not about which face actually drew. A font that failed to arrive must fail
the test **loudly**, with the words "the pinned face is not rendering", rather than quietly re-measuring the
runner. Today's silent re-measurement is what produced 0 and 50 from the same specification.

**b. It measures lines, not pixels.** The quantity this layout depends on is the wrapped line count; a pixel
overflow reported to one decimal place is a property of the runner dressed up as a property of the game. The
assertions become:

| run | what is drawn | budget |
|---|---|---|
| pinned face | offer alone, tallest per level | ≤ 4 lines |
| pinned face | task alone, longest per level, both languages | ≤ 4 lines |
| pinned face | offer + the one-line indicator | ≤ 5 lines, structurally |
| **named fallback face, web font disabled** | offer alone, and task alone | ≤ 5 lines |

A single pixel assertion stays as a backstop — the task's bottom edge is inside the strip — because it is
the player-visible property and it costs nothing. It is asserted, not reported as a number.

**c. The margin is one line in five, and it is derived rather than guessed.** A row that fits in 4 of the 5
lines the strip holds can absorb **25 % more total advance width** before it needs a fifth. That is the
margin, and the number it must cover is the spread between the narrowest and widest faces the game can
credibly land on.

**And here the evidence needs a correction, which is the reason the margin is not left as a percentage.**
TN-REACH describes the CI face as "about 15 % wider". The table in the same section gives the prompt column
as 332 px on Liberation Sans against 272 px equivalent on the runner. 272 ⁄ 332 = 0.819, so the runner's face
is **22 % wider**, not 15 %. The two numbers in one paragraph disagree, and the larger one is the one derived
from the measurements. A 25 % margin against a 22 % observed spread is three points of slack — which is not a
margin, it is a coincidence. So:

**d. The margin is not a percentage. It is a second run on a named face.** A guessed percentage cannot cover
a set of faces nobody enumerated. The fallback tier in the table above runs the whole sweep with the web font
disabled, against a face the test environment **installs and names** — not against whatever the image
happens to have, which would be the same non-determinism one level down. That tier's budget is 5 lines: no
headroom, because it is the degraded path, but the task is still on screen. The 25 % headroom then has only
one job left, which is drift in the pinned face across version bumps, and for that it is generous.

**e. The named fallback face is the widest face the game can plausibly land on.** Which face that is, is
`ui-a11y`'s to determine and record; the requirement here is that it is named in the spec, installed by the
test environment, and justified in one sentence.

### 5. What this decision is under each possible answer about the runner's face

The face rendering on CI has not been identified. The decision is written so that it does not depend on the
answer, and that independence is the test of whether the decision is any good:

- **If it is DejaVu Sans.** Then the 50 overflow lines were measured on a rendering no player holds, and the
  copy pass was held to a standard SF and Roboto never impose. **Nothing in §1–§4 changes.** The fallback
  tier gains value rather than losing it: DejaVu is a real fallback on Linux desktops and on Android
  WebViews with restricted font sets, so a game that fits on it is a game that fits, and it becomes a good
  candidate for §4e's named face.
- **If it is narrower than DejaVu.** Then the fallback tier is weaker than it should be, and §4e is what
  fixes it: the tier is named and installed rather than inherited, so the budget stops depending on what the
  image ships.
- **If it stays unknown.** **Nothing changes, and the question stops mattering the day §4a and §4e land** —
  after that, both tiers render a face the specification names, and the runner's default face is no longer an
  input to any assertion this project makes. The obligation to identify it stands anyway, because a number
  in `docs/` that nobody can reproduce is the thing this repository has an ADR-0009 gate about.

## Alternatives considered

- **Shorten the copy further.** Rejected, having been tried: `origin/task-fits-the-strip` landed 25 of 27
  offer rows to one line and still leaves 50 overflow lines on CI. Sixteen characters of topic is not a
  budget, and the next shortening is a landmark's real name, which is not a layout knob.
- **Cap text growth in the strip at 150 % or 175 %.** Rejected: §3. It is a 1.4.4 failure and it makes the
  Settings slider lie about its own value.
- **Hide the word "Task" visually and keep it for assistive technology.** Rejected: §3. Two different strips
  for two different players, in exchange for six characters.
- **Grow the strip past 33 vh at large text.** Rejected: §3. It covers the level.
- **Move Settings and Menu out of the strip into a screen corner**, the measure ADR-0045 said "would fit
  nearly every pair". Rejected here: it recovers one row of about 48 px, which is roughly one line of the
  five, so it does not clear the four-or-five-characters-for-a-name arithmetic — it moves the cliff without
  removing it. It also puts chrome over the playfield, which is the objection §3 makes to growing the strip,
  and it is a much larger change to `TN-HUD` than the one this ADR makes.
- **Draw the offer in the world, over the canvas, on the target itself.** Rejected on three counts: a DOM
  label over the canvas has to track a moving camera to stay truthful; it breaks the "skater is drawn inside
  the upper two thirds" scenario and puts text over art whose contrast axe cannot compute (ADR-0039's
  objection to a sticky footer, one surface along); and the offer is the strip's one control in the
  single-switch ring, so moving it fragments a ring that took a live-site audit to build.
- **Alternate the two rows on a timer, or marquee the task.** Rejected: it is motion, so reduced motion has
  to disable it, and what reduced motion would then show is one of the two rows — which is this decision,
  arrived at by a worse road. A sentence that is not there when the player looks at it is worse than a
  sentence they know how to get back.
- **Let the strip keep scrolling and mark the task as scrolled-to.** Rejected: that is the shipped defect
  with a label on it. The complaint is that the player has to scroll to find their own task.
- **Pin nothing and give the gate a stated pixel margin.** Rejected: it is the one option that fixes neither
  defect. The number would be derived from two faces out of an unenumerated set — and, as §4c shows, the two
  numbers already on the record disagree by seven points about what that spread even is.
- **Pin the font and change nothing else.** Rejected, and this is the alternative closest to being right: it
  makes the gate deterministic, which is worth having, and it leaves the layout broken on every path where
  the font does not arrive. A layout that is correct only while a network request succeeded is not correct.
- **Bundle a subset of the face rather than the whole file.** Rejected: subsetting is modification, which
  engages the Reserved Font Name clause of OFL and buys tens of kilobytes against an 8 MB budget. Not worth
  a licence question.
- **Keep naming Atkinson Hyperlegible in the dyslexia stack and ship nothing.** Rejected: that is the status
  quo, and the status quo is a required accessibility feature that does nothing on a device without Microsoft
  core fonts.

## Budget impact

| cost | size |
|---|---|
| Bundled UI face, unmodified `woff2`, 2 weights | ceiling 200 KB for **all** bundled faces together — **300 KB since ADR-0071** |
| Bundled dyslexia face, unmodified `woff2` | included in the same ceiling |
| Initial payload | 8 MB budget; the ceiling above is 2.5 % of it |
| Level payloads, decoded texture memory | unchanged — fonts are initial-path assets, not level assets |
| Strip height at 200 % | unchanged; the cap stays 33 vh |

Time-to-play: the faces are on the critical path and precached, so they cost one round trip on a cold first
load and nothing afterwards. The 6 s budget on 25 Mbps is not at risk from 200 KB; the implementer confirms
it against `make build`'s artefact check rather than assuming it.

## Consequences

- The strip's height stops depending on content **while an offer is up**: the offer comes from `copy.ts` and
  the indicator is digits. That is the property worth having — a content author can no longer lengthen the
  HUD by editing a quest file, which is how this defect arrived (TN-REACH: "the task row is the only row in
  the strip whose words come from `content/`").
- A player who wants the task while standing at a landmark has to step away or open the menu. That is a real
  cost, it is the same cost at every text size, and it is stated in `TN-HUD` rather than discovered.
- `COPY_GAPS` gains rows for the indicator and for the menu's task line. The copy is the copy owner's, not
  this ADR's; the shape is fixed here (a word and a count, one line in both languages) and the strings are
  not.
- The a11y suite gains the fallback tier, which roughly doubles the sweep's runtime. It is worth it: that
  tier is the only thing in the repository that tests the game as a player with no web font sees it.
- `assets/credits.json` gains two entries and `credits.schema.json` gains one enum value. The credit gate
  walks `assets/dist`, so a font that ships without a credit fails `make validate-content`, which is the
  behaviour wanted.
- The dyslexia toggle becomes real, and becomes testable: a spec can assert the rendered family changes,
  which nothing asserts today.
- **This ADR is written before the code.** Nothing in §1–§4 exists yet. Until the obligations below are
  discharged, the defect is shipped and the gate still measures the runner.

### Rules stated here that no gate can express

Named so that nobody mistakes the suite's silence for compliance:

- **"The indicator says the same thing to everybody" cannot be checked mechanically.** A spec can assert
  that an accessible name exists and that it is not the full task sentence; it cannot tell whether "Task 3 of
  5" and `Task 3/5` are the same information. Only a reader can.
- **"The pinned face is no wider than the runner's" is checkable; "the pinned face is legible" is not.** The
  width assertion will happily accept a condensed face that meets every budget and that nobody can read. The
  face is chosen by a person, for legibility, and then checked for width — never the other way round.
- **The named fallback face being the *widest plausible* face is a judgement.** The gate will assert whatever
  face it is told to install. Whether that face represents the worst device a player will hold is a claim
  about the world, and §4e requires it to be written down in one sentence so a reader can disagree with it.
- **Nothing stops a future stylesheet re-adding `system-ui`.** A lint rule could forbid the token in
  `app/ui/screen-styles.ts`, and one should exist; it cannot stop a font arriving by any other route.
- **The step-away-to-read-the-task cost is not measurable.** Whether players actually find their task is a
  question for play-testing, not for CI. If they do not, this decision is wrong and should be replaced rather
  than patched.

## Obligations

Written in ADR-0009's format. Owners are single tokens; the dates are the ones that matter, not the ones that
are comfortable.

- ~~**OBLIGATION due=2026-10-19 owner=ui-a11y** — land §2: the offer and the task take turns in the strip, the
  bounded indicator with its accessible name, the level menu drawing the task in full, and `hud-task-cue`
  attached to the full row. Rewrite `TN-HUD-hud-and-menu.md` (`TN-HUD-01`, `TN-HUD-08`) and
  `TN-REACH-what-is-in-reach.md` (the offer replaces the task; the open defect at the end of that file is
  answered by this ADR) in the same change, and declare the new copy rows in `COPY_GAPS`. Until this lands,
  ten of ten built levels put the player's task below the strip at 200 % text in at least one language.~~
  **DISCHARGED 2026-09-23** — in the commit that carries this line. `app/ui/hud.ts` draws the task in full as
  `hud-quest-tracker` only while no offer is up; with one up it draws `hud-task-indicator`, "Task 3/5" /
  « Mission 3/5 », whose visible words are `aria-hidden` beside a visually hidden twin reading "Task 3 of 5" /
  « Mission 3 sur 5 » — no `aria-label`, and no task sentence anywhere in it. The count is the quest's own step
  number and step total (`QuestController.taskPosition`). `hud-task-cue` is drawn only beside the full row. A
  new task is still announced in full, and the offer coming and going says nothing. `app/ui/menu.ts` draws
  `menu-task`, "Your task: …", whenever there is a task. `TN-HUD-01`, `TN-HUD-07`, `TN-HUD-08` and
  `TN-REACH` are rewritten; `hud.task.indicator`, `hud.task.indicator.spoken` and `hud.menu.task` are in
  `COPY_GAPS` (81 rows). `tests/unit/ui/hud.test.ts` holds the turn-taking, the name, the cue, the menu line
  and the switch ring; `tests/a11y/level-screens.spec.ts` holds the one line, the name as read from the
  accessibility tree and a clean axe scan at 100 % and 200 %, EN and FR, dyslexia and high contrast, strip and
  menu; `tests/a11y/readability.spec.ts` measures both strips the game can now draw.

- **OBLIGATION due=2026-11-02 owner=ui-a11y** — land §1: bundle one UI face and one dyslexia face, unmodified,
  within the 200 KB ceiling (300 KB since ADR-0071); remove `system-ui`, `-apple-system`, `"Segoe UI"`, `Roboto`, `"Comic Sans MS"`,
  `Verdana` and `Tahoma` from the stacks in `app/ui/screen-styles.ts` and the stack in
  `app/adapters/phaser/boot-scene.ts`; declare the metrics-adjusted fallback; credit both faces in
  `assets/credits.json` with `kind: "shipped"`. Record in the commit body: the family, its licence, its
  weights, that the browser performs **no** synthetic emboldening at the weights the sheet asks for, the
  measured payload added, and the advance-width comparison §1 requires against the current CI face. If the
  chosen face is not OFL-1.1 or more permissive, say so — the ADR-0004 amendment is permission, not an
  instruction.

- **OBLIGATION due=2026-11-02 owner=infra** — add `OFL-1.1` to the `licence` enum in
  `content/schemas/credits.schema.json`, with a description restricting it to font assets and pointing at
  ADR-0004 as amended here. This must land before or with the obligation above; a font with no expressible
  licence is the ADR-0004 enum defect repeating itself, and that one already cost this project six
  reference photographs.

- **OBLIGATION due=2026-11-09 owner=ui-a11y** — land §4: the sweep asserts the pinned face is rendering
  before it measures, asserts **lines** against the 4-line and 5-line budgets in §4b rather than a decimal
  pixel overflow, and runs the second tier with the web font disabled against a named, installed fallback
  face. Record the name of that face and the one-sentence justification §4e requires. Delete no assertion the
  current sweep makes about pairing a quest with its own level's offers, or about choosing the tallest offer
  rather than the longest string; both are correct.

- **OBLIGATION due=2026-10-19 owner=ui-a11y** — identify the face `system-ui` resolves to on the CI runner
  image and record it, with its version, in `TN-REACH-what-is-in-reach.md` beside the 0-local / 50-CI
  numbers. Also correct that section's "about 15 % wider": its own table gives 332 px against 272 px, which
  is 22 %. A paragraph that contradicts the table above it is the class of claim ADR-0009 exists to stop, and
  the larger number is the one the copy pass was actually held to.

- **OBLIGATION due=2027-01-18 owner=architect** — re-measure §2's four-line capacity table and §4c's margin
  on the tree as it then stands, with the pinned face in place, and record the numbers here. The capacity
  figures above are arithmetic over a character count on a face this project had not chosen yet; once it has
  chosen one, they are either confirmed or they are wrong, and an ADR carrying an unconfirmed table is the
  failure mode ADR-0009 was written about. If the pinned face turns out to be wider than the CI face — the
  one outcome §1 forbids and cannot prevent by itself — this ADR needs replacing, not amending.

## References

- ADR-0002 — portrait, 1080 × 1920, and why the strip is as wide as the playfield.
- ADR-0004 — third-party asset licences; amended here for fonts only.
- ADR-0009 — the obligation markers above, and the gate that reads them.
- ADR-0034 — the worker precaches the initial payload; the fonts ride with it.
- ADR-0039 — the strip offers first; chrome holds still at large text; one scroll box.
- ADR-0045 — the strip's order, the residual this ADR settles, and the two measures it refuses.
- `docs/stories/TN-HUD-hud-and-menu.md` — `TN-HUD-01`, `TN-HUD-08`.
- `docs/stories/TN-REACH-what-is-in-reach.md` — the offer rows, and the font measurement this ADR is built on.
- `tests/a11y/readability.spec.ts` — the sweep, on `origin/task-fits-the-strip`.
- `app/ui/screen-styles.ts`, `app/adapters/phaser/boot-scene.ts` — the three `system-ui` stacks.
