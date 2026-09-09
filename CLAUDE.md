# TrueNorth — working agreement

Portrait-first 2D side-scrolling game teaching the official IRCC Canadian citizenship test
(*Discover Canada*). Open source. Read this before changing anything.

## Decisions (change only via a new ADR in `docs/adr/`)

| Topic | Decision |
|---|---|
| Audience | Newcomers of all ages, public release. Plain language. Accessibility is a requirement, not a feature. |
| Purpose | Learning tool. Exam mirrors IRCC: 20 questions, 15 to pass, 30 min. Timer only in Exam mode, and optional. |
| Scope | 10 levels, 10 subjects, exam. Slices are engineering practice, never a scope cut. |
| Orientation | Portrait always. Design resolution 1080×1920. Desktop centres the portrait canvas; side panels extend the level's sky/ground. |
| Traversal | One-thumb: hold to move, tap to jump/interact, tap NPC or POI to engage. No trick system. Auto-move option. |
| Art | Casual cartoon: bold rounded shapes, saturated palette, 3-tone cel shading, outline on characters only. Landmarks and NPCs are reference-accurate, simplified — never invented. |
| Licence | Code MIT. Original art CC-BY-4.0. Question data CC0. Third-party assets CC0/CC-BY only, attributed. No dependency that restricts open-source redistribution (excludes Spine runtimes). |
| Facts | Paraphrased from Discover Canada on canada.ca, chapter-referenced, agentically verified before shipping. |
| Language | EN and FR from the first commit. |
| Engine | Phaser 4 (≥ 4.2), TypeScript strict, Vite. |
| Characters | Rive (`@rive-app/canvas`) behind `ICharacterRenderer`; sprite-sheet fallback with identical slot names. |
| Hosting | GitHub Pages via Actions calling Makefile targets. PWA. Capacitor optional and isolated in `infra/`. |
| Storage | Local only: IndexedDB, with `localStorage` as the fallback and the store a save is migrated out of (ADR-0026). JSON export/import. No accounts, no server, no analytics. |

## Architecture (enforced by dependency-cruiser in `make lint`)

- `app/domain` imports nothing outside `domain` and `common`. No framework imports, ever.
- `app/application` imports `domain` and `common`. Ports (interfaces) only — no Phaser, no DOM.
- `app/adapters/*` implement application ports. **Adapters never import each other.**
- `app/ui` is DOM only; it never imports adapters or scenes.
- `app/bootstrap` is the composition root and the only place concretes are wired.
- Systems communicate over the typed event bus, not direct references.
- ECS-lite: entities are ids, components are data, systems are functions. Composition over inheritance.

## Budgets (CI fails on breach)

- 60 fps iPhone 13+/iPad/desktop; 30 fps Android 2021 mid-range. Frame time ≤ 16.7 ms at the medium preset.
- Initial payload ≤ 8 MB; each level ≤ 8 MB; total ≤ 100 MB; time-to-play ≤ 6 s on 25 Mbps.
- Decoded texture memory ≤ 64 MB per level on iPhone; unload the previous level before loading the next.
- Overdraw ≤ 4× screen area per frame. Particles ≤ 400 phone, ≤ 1500 iPad/desktop.
- Domain + application unit coverage ≥ 90%.

## Accessibility (tested, not aspirational)

- Question cards, dialogue, menus and settings are **DOM with ARIA roles**; the Phaser canvas is `aria-hidden`
  with a live region announcing game events.
- Touch targets ≥ 44 pt. Text scaling 100–200%. Dyslexia-friendly font toggle. High contrast; colour is never
  the only signal. Reduced motion disables parallax easing, particles and squash-and-stretch.
- Keyboard-only playable; single-switch mode (tap anywhere advances). Subtitles on by default; every sound has
  a visual equivalent. No timers outside Exam mode.
- Plain language, roughly CLB 4 / grade-6, for dialogue and questions.
- axe-core runs in CI on every DOM screen.

## Content rules

- Every content file declares `$schema`; `make validate-content` rejects unknown properties.
- A question ships only with `verification.status = "verified"` for the current `sourceHash`, 3 distractors,
  EN and FR text, and non-verbatim wording. Author and verifier are separate agents; the author never sets
  verification status, the verifier never edits question text.
- `volatile` items are re-verified every run and quarantined when the source changes or `asOf` exceeds 180 days.
- ≥ 30 verified questions per subject before that level ships.
- Indigenous content follows `docs/content-review.md`: name the nation depicted, no invented patterns, no
  sacred items as props, no caricature. Cartoon proportions are identical for all characters.

## Commits

Imperative subject ≤ 72 characters, plain verbs ("Add", "Fix", "Move"). No AI co-authorship or attribution
trailers of any kind. Reference the slice in the body when relevant.

## Where state lives

`docs/plan/slices.md` and `docs/plan/slice-N.md` carry plan state between sessions — not conversation history.
Read the plan before starting work; update it when you finish.
