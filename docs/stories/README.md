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
| `TN-QUEST-parliament-hill.md` | `TN-QUEST` | Offer, accept, decline, track, complete, stamp |
| `TN-CARD-question-card.md` | `TN-CARD` | The question card: arrival, right, wrong, leaving |
| `TN-STUDY-study-mode.md` | `TN-STUDY` | The Study drill and its summary |
| `TN-SAVE-save-and-reload.md` | `TN-SAVE` | Exactly what survives a closed tab; export and import |
| `TN-SET-settings.md` | `TN-SET` | Language and the accessibility switches the other stories set |

`TN-SET` is not in the task-1.1 list. It is here because every other story states an accessibility
precondition ("Given single-switch mode is on"), and a precondition nobody can set is not testable. It is
deliberately small.

## Rules these stories are written to

- **Accessibility is acceptance, not a section.** Every file carries its own keyboard-only, single-switch,
  screen-reader, reduced-motion and 200 %-text scenarios, and opens with a coverage map naming the scenario
  that discharges each one. There is no separate accessibility story, on purpose.
- **Bilingual is acceptance.** Every file has EN and FR scenarios. Player-facing wording is written out in
  both languages so the UI agent is not inventing copy. Where a string is not written here, it is an open
  question in that file, not a licence to improvise.
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
  the wording never contains `(e)`, `·e` or a bracketed ending.
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
- FR copy is a translation of meaning, never of word order. It is held to the same grade-6 bar as EN.

## Shared test vocabulary

These are contracts. A story references a `data-testid` or an event name; the agent that builds the thing
provides it.

### DOM markers

| `data-testid` | What it marks |
|---|---|
| `playable` | The level is loaded and accepts input. Already used by `tests/perf` and `tests/a11y`. |
| `level-loading`, `level-error` | Load in progress; load failed. |
| `scene-state` | The E2E scene probe — see below. |
| `hud`, `hud-quest-tracker`, `hud-mode-label`, `menu-button` | The lower-third HUD. |
| `move-left`, `move-right`, `turn-around` | The hold-to-move controls (see `OQ-INPUT-1`). |
| `interact-prompt` | The "you can engage this" button shown when a target is in reach. |
| `character-creator`, `character-preview`, `slot-skin`, `slot-hair`, `slot-coat`, `randomise-character`, `start-playing` | Character creator. |
| `dialogue`, `dialogue-text`, `dialogue-accept`, `dialogue-decline`, `dialogue-next` | NPC dialogue. |
| `poi-card`, `poi-card-close` | Landmark information card. |
| `about-this-place`, `about-this-place-open`, `about-this-place-close` | The territorial statement panel (`docs/content-review.md` §10.2). |
| `question-card`, `question-kind`, `question-progress`, `question-prompt`, `option-0`…`option-3`, `question-feedback`, `question-explanation`, `question-next` | The question card. |
| `quest-complete-card`, `passport`, `stamp-ottawa` | Quest completion and the passport. |
| `study-screen`, `study-start`, `study-empty`, `study-summary`, `study-again`, `study-exit` | Study mode. |
| `settings-screen`, `setting-language`, `setting-auto-move`, `setting-single-switch`, `setting-reduced-motion`, `setting-high-contrast`, `setting-dyslexia-font`, `setting-text-size`, `setting-subtitles` | Settings. |
| `storage-warning`, `save-error`, `save-export`, `save-import`, `save-import-error` | Persistence. |

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
- a **long press** (contact held past a threshold the player can change in settings) chooses the highlighted
  item;
- nothing scans on its own, nothing expires, and the player may take as long as they like.

Every story proves that its whole flow is completable with those two gestures alone. See `OQ-SWITCH-1`.

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
- **`OQ-SWITCH-1` — short press / long press, or something else?** *Recommendation:* as described above; it
  needs no timer the player can lose to, which auto-scanning does.
- **`OQ-EVENT-1` — do these event names match what task 1.5 emits?** They are the PO's proposal. If the use
  cases pick other names, the stories are updated, not the tests quietly.
- **`OQ-SUBJECT-1` — Level 4's subject is not written down anywhere.** `docs/plan/slices.md` names the
  subject of every level except 3 and 4. *Recommendation:* "How Canadians Govern Themselves" /
  « Comment les Canadiens se gouvernent », `subject.government`. Needs a decision before task 1.7 authors a
  question against it.
- ~~**`OQ-REVIEW-1` — `docs/content-review.md` does not exist.**~~ **Answered 2026-09-08** — it exists now,
  and the questions it could not answer moved into it as `OQ-REVIEW-2` … `OQ-REVIEW-11`. Three of those
  reach back into these stories and are still open: `OQ-REVIEW-6` recommends the skin-tone option names that
  `OQ-CREATOR-5` asked for; `OQ-REVIEW-7` names a conflict between `CharacterSlot.default` and "no tone is
  the default" that `TN-CREATOR-01` sits on top of; and `OQ-REVIEW-2` — who may grant cultural sign-off —
  is unanswered and blocks nothing in slice 1 only because slice 1 depicts no nation. `OQ-LEVEL-3` (the
  officer's gender presentation and skin tone) is answered in part: whatever is chosen, §6 of that document
  fixes the proportions and §8.6 fixes how the option is labelled.
