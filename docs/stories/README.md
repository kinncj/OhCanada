# Stories — slice 1 (vertical proof, Level 4 Ottawa)

These files are the acceptance criteria for slice 1. Every other task in `docs/plan/slice-1.md` builds
against them. If a scenario here and an implementation disagree, the scenario is the specification until a
story is changed on purpose.

The slice's definition of done, as a sentence: *a player can create a character, skate the Ottawa level,
talk to the officer, accept and finish one quest, answer three scheduled questions, earn a stamp, run a
Study drill, close the tab and come back to the same state.* One file per clause.

| File | Area | Covers |
|---|---|---|
| `TN-CREATOR-character-creator.md` | `TN-CREATOR` | Making a character before the first level |
| `TN-LEVEL-ottawa.md` | `TN-LEVEL` | Loading Level 4, skate locomotion, camera, POIs, pause |
| `TN-HUD-hud-and-menu.md` | `TN-HUD` | The lower-third HUD, the menu, the storage warning, the page's landmarks |
| `TN-QUEST-parliament-hill.md` | `TN-QUEST` | Offer, accept, decline, track, complete, stamp |
| `TN-CARD-question-card.md` | `TN-CARD` | The question card: arrival, right, wrong, leaving |
| `TN-STUDY-study-mode.md` | `TN-STUDY` | The Study drill and its summary |
| `TN-SAVE-save-and-reload.md` | `TN-SAVE` | Exactly what survives a closed tab; export and import |
| `TN-RESUME-questions-after-a-reload.md` | `TN-RESUME` | Which question is asked when an answer step is resumed |
| `TN-SET-settings.md` | `TN-SET` | Language, hold time, and the accessibility switches the other stories set |
| `TN-COPY-strings-and-counts.md` | `TN-COPY` | The rules every copy table obeys: plurals, state words, waiting copy, missing strings |

`TN-SET` is not in the task-1.1 list. It is here because every other story states an accessibility
precondition ("Given single-switch mode is on"), and a precondition nobody can set is not testable. It is
deliberately small.

`TN-HUD` and `TN-COPY` were added after task 1.15 built the screens, for the same reason: both were shared
vocabulary in this file and the acceptance criteria of no file. `storage-warning` was required by
`TN-SET-03` and `TN-CREATOR-03` and owned by nobody; `study.count` drew "1 questions" because one copy table
row cannot say two things. A rule with no story is a rule nothing can fail.

Two more strings joined their tables on 2026-09-08, both found the same way — the screens had to take them
from the caller as **required** options, so no screen could be mounted without somebody inventing a word.
`hud.label`, the accessible name of the `hud` region that `TN-HUD-07` requires, is now in `TN-HUD`;
`level.loading`, the text `TN-LEVEL-01` requires instead of a bare spinner, is now in `TN-LEVEL`, with the
rule that it may not claim progress the game cannot measure. **A gap reported under `TN-COPY-06` is a debt,
not a home.** A string that lives in a caller forever is a string two callers will eventually disagree about.

`TN-RESUME` was added on 2026-09-08 for the sharpest version of that problem: not a rule nobody owned, but a
moment **two stories owned and answered differently**. `TN-SAVE-01` said a question already answered is never
asked again after a reload; `TN-CARD-02` and `TN-CARD-04` promise the player, in printed copy, that a
question they got wrong comes back soon. Building the domain proved the two cannot both hold. `TN-CARD` won,
`TN-SAVE` was amended, and the reasoning lives in `TN-RESUME` rather than in a commit message, because a
reader who finds one story contradicting another trusts neither. **When a seam between two stories has to be
decided, the decision goes in a file, with what it costs, and both sides point at it.**

## Rules these stories are written to

- **Accessibility is acceptance, not a section.** Every file carries its own keyboard-only, single-switch,
  screen-reader, reduced-motion and 200 %-text scenarios, and opens with a coverage map naming the scenario
  that discharges each one. There is no separate accessibility story, on purpose.
- **Bilingual is acceptance.** Every file has EN and FR scenarios. Player-facing wording is written out in
  both languages so the UI agent is not inventing copy. Where a string is not written here, it is an open
  question in that file, not a licence to improvise.
- **A string is written down once.** One key, one copy table, one file. Where a second screen needs the same
  words it names the key and the file that owns it (`TN-HUD` does this for eight keys). Two tables carrying
  the same words is how they stop being the same words.
- **A rule is written down once, too.** Where two stories describe the same moment, one of them owns it and
  the other links. `TN-RESUME` owns what happens to the questions when a step is resumed; `TN-SAVE` and
  `TN-CARD` name it and do not restate it.
- **Counts and state words follow `TN-COPY-strings-and-counts.md`**, not each screen's judgement. It has one
  rule for plurals in both languages, and it exists because "1 questions" is not a Study bug, it is a bug in
  every string with a number in it.
- **A screen that is waiting says what it is doing, not how far along it is** (`TN-COPY-07`). No percentage,
  no step count, no ellipsis, no bar with a value, unless the game really knows both halves of the fraction —
  and in slice 1 it never does. The honest answer to a long wait is the escape route in `TN-LEVEL-02`.
- **Plain language**, roughly CLB 4 / grade 6. Short sentences. No jargon the player did not bring with them:
  the words *spaced repetition*, *FSRS*, *scheduler*, *due*, *card state* never appear on screen.
- **One thumb, portrait.** Hold to move, tap to jump, tap an NPC or POI to engage. No scenario may need two
  hands, a pinch, a swipe, a drag or a double tap.
- **No timers.** Exam mode is not in this slice. Nothing on screen counts down, and no scenario may pass or
  fail on how fast the player acts. Load timeouts are not player timers and are allowed to appear as an
  escape route from a stall.
- **A scenario must be able to fail.** If a step could be written today against an empty page and still pass,
  it is wrong. Waiting for a marker before asserting anything is the pattern (`tests/a11y/screens.spec.ts`
  already does this).
- **A check that passes is not the same as a check that ran.** A lint rule that never executed, a scan rule
  that self-passed and a test that was skipped all report exactly what a clean run reports. Where a story
  leans on a tool's green tick, it also says how that tick can be made to go red — `TN-HUD-10` is the worked
  example, and it exists because `landmark-one-main` passed on a page with no `<main>` at all.

## Depiction is acceptance too

`docs/content-review.md` governs how this game depicts people and places, and it changes what a story has to
contain. A story that puts a person or a place on screen carries these as scenarios, in the same file, on
the same footing as its accessibility and bilingual ones:

- **A "what is depicted" section, before the scenarios**, naming what the art agent is being asked to draw
  and — explicitly — what is *not* depicted. `TN-LEVEL-ottawa.md` already does this for the officer.
- **No option is coupled to another.** Where the player picks how somebody looks, a scenario asserts that
  choosing any option in one group leaves every other group's option count unchanged
  (`docs/content-review.md` §8.2). This is the mechanically checkable half of "no caricature".
- **The randomiser is uniform.** Where a "surprise me" exists, a scenario asserts every option can come up
  (§8.3). A weighted default player is a statement made in code.
- **No French copy about the player requires gender agreement** (§8.6). FR scenarios assert the wording, and
  the wording never contains `(e)`, `·e` or a bracketed ending. This binds copy about *characters* too where
  a story fixes their name: see `OQ-LEVEL-8`.
- **A nation's own name is identical in EN and FR** (§9.3). Where a story writes one, both columns match.
- **Territory is stated, not performed.** Any level story includes the "About this place" panel: reachable
  from pause and from credits, never modal, never dismissed to reach gameplay, EN and FR, keyboard and
  single switch (§10.2).

What a story must **not** do: assert that a depiction is approved. No scenario may encode a cultural
sign-off, because no agent may grant one (`docs/content-review.md` §1). A story states what is on screen;
whether it may be on screen at all is that document's shipping rule, not a test.

## French style

- Vouvoiement (« vous »), to match IRCC's own French. See `OQ-STYLE-1` in `TN-SET-settings.md`.
- Canadian French typography: **no** space before `?` and `!`; a space before `:`. Guillemets « » with a
  space inside.
- FR copy is a translation of meaning, never of word order. It is held to the same grade-6 bar as EN, and it
  may take a different shape from the English where the English shape is what breaks it: `study.summary.score`
  is a sentence in English and a label in French, and `TN-STUDY` says why.
- Numbers are formatted for the locale, never concatenated: « 0,6 », « 150 % » with a space.
  `TN-COPY-strings-and-counts.md` says why this is a rule and not a preference.

## Shared test vocabulary

These are contracts. A story references a `data-testid` or an event name; the agent that builds the thing
provides it.

### Words these stories use precisely

| Word | Means |
|---|---|
| **a sitting** | One run of the page: from opening the game to closing the tab. What the game remembers only for a sitting is listed in `TN-SAVE`'s "does not survive" table. `TN-RESUME` defines the term and owns what depends on it. |
| **ready to come back** | The scheduler would offer this question now. Never said on screen — the player sees only "New" or "Seen before". |

### DOM markers

| `data-testid` | What it marks |
|---|---|
| `playable` | The level is loaded and accepts input. Already used by `tests/perf` and `tests/a11y`. |
| `level-loading`, `level-error` | Load in progress; load failed. `level-loading` carries `level.loading` (`TN-LEVEL-01`). |
| `scene-state` | The E2E scene probe — see below. |
| `hud`, `hud-quest-tracker`, `hud-mode-label`, `menu-button` | The lower-third HUD (`TN-HUD`). `hud` is a region named by `hud.label`. |
| `menu` | The menu opened from `menu-button` (`TN-HUD-02`). |
| `move-left`, `move-right`, `turn-around` | The hold-to-move controls (see `OQ-INPUT-1`). |
| `interact-prompt` | The "you can engage this" button shown when a target is in reach. |
| `character-creator`, `character-preview`, `slot-skin`, `slot-hair`, `slot-coat`, `randomise-character`, `start-playing`, `creator-settings`, `creator-save-error`, `creator-retry`, `creator-continue` | Character creator. |
| `dialogue`, `dialogue-speaker`, `dialogue-text`, `dialogue-accept`, `dialogue-decline`, `dialogue-next` | NPC dialogue. `dialogue-speaker` carries the speaker's name and is the dialog's accessible name (`TN-QUEST-08`). |
| `poi-card`, `poi-card-close` | Landmark information card. |
| `about-this-place`, `about-this-place-open`, `about-this-place-close` | The territorial statement panel (`docs/content-review.md` §10.2). |
| `question-card`, `question-kind`, `question-progress`, `question-prompt`, `option-0`…`option-3`, `question-feedback`, `question-explanation`, `question-next`, `question-close`, `question-closed-notice` | The question card. |
| `quest-complete-card`, `passport`, `stamp-ottawa` | Quest completion and the passport. |
| `study-screen`, `study-count`, `study-start`, `study-empty`, `study-empty-title`, `study-practise-new`, `study-error`, `study-retry`, `study-left-notice`, `study-summary`, `study-summary-score`, `study-summary-returning`, `study-again`, `study-exit` | Study mode. |
| `settings-screen`, `settings-close`, `setting-language`, `setting-auto-move`, `setting-single-switch`, `setting-hold-time`, `setting-reduced-motion`, `setting-high-contrast`, `setting-dyslexia-font`, `setting-text-size`, `setting-text-size-value`, `setting-subtitles`, `setting-sound` | Settings. `setting-sound` is present only when a sound ships (`TN-SET-01`). |
| `storage-warning`, `save-error`, `save-export`, `save-import`, `save-import-error` | Persistence. `storage-warning` is owned by `TN-HUD-03`. |

### The scene probe

The Phaser canvas is `aria-hidden` and Playwright cannot read it. So that camera and locomotion scenarios
can fail, the game exposes one element, `data-testid="scene-state"`, refreshed at most ten times a second
and present **only** when the page is opened with `?e2e=1`:

`data-level`, `data-mode`, `data-paused`, `data-player-x`, `data-player-y`, `data-speed`, `data-facing`,
`data-grounded`, `data-camera-x`, `data-parallax-easing` (`on`/`off`), `data-particles` (a count).

It carries no player-facing text, so it is invisible to axe and to a screen reader. See `OQ-TEST-1`.

### Event names

Proposed by these stories, fixed by the use cases that emit them (task 1.5). `level/ready`, `player/moved`,
`quest/step-completed` and `question/answered` are already named in `docs/architecture.md`.

`level/ready` · `level/failed` · `player/moved` · `player/jumped` · `player/stopped` · `player/braked` ·
`poi/entered` · `poi/left` · `poi/engaged` · `npc/engaged` · `dialogue/opened` · `dialogue/closed` ·
`quest/offered` · `quest/accepted` · `quest/declined` · `quest/step-completed` · `quest/completed` ·
`stamp/earned` · `question/asked` · `question/answered` · `question/dismissed` · `study/started` ·
`study/finished` · `character/created` · `settings/changed` · `locale/changed` · `progress/saved` ·
`progress/save-failed` · `progress/loaded`.

### The single-switch contract

CLAUDE.md says single-switch mode is "tap anywhere advances". With one contact and no countdown allowed,
these stories use:

- a **short press anywhere** moves the highlight to the next item and wraps at the end;
- a **long press** (contact held past the threshold the player sets in "Hold time", `TN-SET-09`) chooses the
  highlighted item;
- nothing scans on its own, nothing expires, and the player may take as long as they like.

Every story proves that its whole flow is completable with those two gestures alone. See `OQ-SWITCH-1`.

**The "no countdown" half of that contract is structural, not promised.** Task 1.15 classified a press *on
release*, from two timestamps, and `tests/unit/ui/single-switch.test.ts` greps `app/ui/single-switch.ts` for
`setTimeout`, `setInterval`, `requestAnimationFrame` and `requestIdleCallback` and fails if any appears. An
auto-scanning implementation cannot be written without one of them, so the rule cannot regress quietly into
a timer the player can lose to. That is the standard this directory wants everywhere: prove the property by
what the code cannot contain, not by waiting two minutes and asserting nothing happened.

The threshold itself is a player setting, not a constant. `TN-SET-09` draws it as four named values rather
than a slider, and requires the hold-time control to accept the *shorter* of the default and the current
threshold — so the one control that changes what a long press means can never be locked behind a long press
the player cannot make.

## What the a11y suite proves, and what it does not

`tests/a11y` mounts each DOM screen in a harness and runs axe-core against it, and — since `TN-HUD` shipped —
also assembles them into one page and scans that. A hundred and twenty-two passing checks mean **the
components are accessible in isolation, and the harness's assembled page is accessible with no rule turned
off**. They do not mean the shipped page is accessible, and nobody should read them that way, because the
screens are still not routed through `app/bootstrap`: nothing in that suite exercises the production build or
the composition root. A component that passes a harness can still be mounted twice, mounted inside an
`aria-hidden` subtree, or never mounted at all.

The claim is honest and it is narrow, so it is written down rather than left to be inferred from a green
tick. Closing the gap is `OQ-TEST-2`, which the whole-page scan **does not close**: that scan runs against
the harness's page, not `dist/`.

The scans do fail when something is wrong, which is the only reason to keep them. Two real defects were
found by axe in task 1.15's own code before it went green: an empty unnamed button, caused by a CSS rule
overriding `[hidden]`, and `color-contrast` returning *incomplete* on symbol-only nodes. Neither was
visible by reading the code.

### The two axe rules that were disabled, and are not any more

`region` and `landmark-one-main` were disabled in the a11y spec, with the reason written beside them: a
single modal over an `aria-hidden` canvas has no document landmarks, and inventing a `<main>` to satisfy a
scanner is not accessibility. That reason expired the moment `TN-HUD` built the page those rules describe —
one `<main>`, a named `hud` region, real content outside the modals — and `TN-HUD-07` required both rules
back on for the whole-page scan. They are on, and that scan disables nothing at all.

**Being enabled is not the same as being enforced.** `landmark-one-main` self-passed on this page even with
`<main>` removed: the `<section aria-label>` on the HUD kept the content inside a landmark, and axe's
`passForModal` heuristic read the full-bleed `#game` div as a modal. The negative control had to unwrap
`<main>` *and* strip the region's label before the rule would fire. So the green tick carries two guards —
the rule ids are asserted to appear in the results, because a rule that never ran also reports no violations,
and the negative control is asserted to fail — and `TN-HUD-10` is the story that keeps them there. Nobody
simplifies a guard away on the grounds that the scan is green; the scan being green is what is being checked.

Any further rule this project disables carries its reason in the file **and** a line here, naming the
condition under which it goes back on. A suppression with no expiry is a lowered bar with a comment.

## Open questions

Every file ends with its own. They are questions, not decisions — no scenario in these files depends on an
answer nobody has given. Cross-cutting ones live here.

- **`OQ-INPUT-1` — where does the player hold to move?** A virtual pad in the lower third, or the left and
  right halves of the play area? The stories only require the two controls to exist and be addressable as
  `move-left` and `move-right`, with a hit area of at least 44 CSS px. *Recommendation:* left/right halves of
  the lower third, with a visible but unobtrusive hint, so nothing covers the playfield.
- **`OQ-TEST-1` — is the scene probe acceptable?** Camera and momentum cannot otherwise be asserted from
  Playwright. *Recommendation:* yes, gated behind `?e2e=1` and stripped from production builds; the
  alternative is screenshot diffing, which fails for the wrong reasons.
- **`OQ-TEST-2` — when is the *page* scanned, rather than the components?** **Still open.** The whole-page
  scan added with `TN-HUD` runs against the harness's assembled page, because `app/bootstrap` does not yet
  mount these screens; it is a real page with real landmarks and it is not the shipped one.
  *Recommendation:* when the screens are routed, add the same scan against the built output — the creator,
  then the level with its HUD, then one modal open over it — and keep the per-component and harness-page
  scans as well. Three scans answer three different questions and none replaces another. Until the built
  output is scanned, no report may describe the a11y suite as proving the shipped page.
- **`OQ-TEST-3` — can a test move the clock?** Several scenarios in `TN-RESUME` say "an hour has passed",
  because what the scheduler offers depends on time and nothing else can express that. If the time the
  scheduler reads is not a port with a fake, those scenarios can only be written as sleeps, which is how a
  suite becomes flaky and then becomes ignored. *Recommendation:* a clock port, injected like every other
  adapter; the stories keep saying "an hour has passed" and never name the fake. See `OQ-RESUME-1`.
- **`OQ-SWITCH-1` — short press / long press, or something else?** *Recommendation:* as described above; it
  needs no timer the player can lose to, which auto-scanning does. Task 1.15 implemented it with no
  scheduling primitive at all, which is the strongest form of that argument.
- **`OQ-EVENT-1` — do these event names match what task 1.5 emits?** They are the PO's proposal. If the use
  cases pick other names, the stories are updated, not the tests quietly.
- **`OQ-SUBJECT-1` — Level 4's subject is not written down anywhere.** `docs/plan/slices.md` names the
  subject of every level except 3 and 4. *Recommendation:* "How Canadians Govern Themselves" /
  « Comment les Canadiens se gouvernent », `subject.government`. Needs a decision before task 1.7 authors a
  question against it.
- ~~**`OQ-REVIEW-1` — `docs/content-review.md` does not exist.**~~ **Answered 2026-09-08** — it exists now,
  and the questions it could not answer moved into it as `OQ-REVIEW-2` … `OQ-REVIEW-11`. Two of those still
  reach back into these stories: `OQ-REVIEW-6` recommends the skin-tone option names that `OQ-CREATOR-5`
  asked for, and `OQ-REVIEW-2` — who may grant cultural sign-off — is unanswered and blocks nothing in
  slice 1 only because slice 1 depicts no nation. `OQ-LEVEL-3` (the officer's gender presentation and skin
  tone) is answered in part: whatever is chosen, §6 of that document fixes the proportions and §8.6 fixes
  how the option is labelled — and `OQ-LEVEL-8` now names the three French strings that move together with
  it.
- ~~**`OQ-REVIEW-7` — `CharacterSlot.default` versus "no tone is the default".**~~ **Answered 2026-09-08 —
  in the art bible's favour, and the whole conflict was the name.** The architect renamed the field to
  `fallback`, which is what `content/schemas/character.schema.json` now requires; nothing about the
  behaviour changed, and `TN-CREATOR-01` ("each group already has one option chosen") is unaffected. One
  stale reference remains outside this directory: `docs/content-review.md` still calls the field `default`
  in its open-questions section. That file is not this agent's to edit — flagged for its owner.
