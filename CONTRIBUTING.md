# Contributing to TrueNorth

Welcome. This page assumes you have never seen this repository before.

TrueNorth is a free game that teaches the material on the Canadian citizenship test. People study with it
for a real exam, so a wrong fact is a bug of the same seriousness as a crash, and a screen a blind or
one-handed player cannot use is a bug too. Almost everything unusual about how we work here follows from
those two sentences.

You do not need to be a programmer to help. The most valuable contribution to this project is telling us
that something we say about Canada is wrong.

**Adding or correcting a question, a fact, or a line of dialogue? Start with
[`docs/guidelines/`](docs/guidelines/README.md).** It is written for a first-time contributor who is not a
programmer, and it covers everything this page summarises, with a real question file explained field by
field.

- [Three things to know first](#three-things-to-know-first)
- [Report a wrong question or a wrong depiction](#report-a-wrong-question-or-a-wrong-depiction)
- [Run it on your machine](#run-it-on-your-machine)
- [What happens to your pull request](#what-happens-to-your-pull-request)
- [The verification gate](#the-verification-gate)
- [Accessibility and plain language](#accessibility-and-plain-language)
- [Licensing: what we can and cannot accept](#licensing-what-we-can-and-cannot-accept)
- [Depicting people, places and cultures](#depicting-people-places-and-cultures)
- [Commits and pull requests](#commits-and-pull-requests)
- [What to read next](#what-to-read-next)
- [Being treated well](#being-treated-well)

## Three things to know first

**Most of this repository is written by AI agents.** A human maintainer directs and reviews the work, but
the commits, the ADRs and much of the prose come from agents working to the rules in
[`CLAUDE.md`](CLAUDE.md). Your pull request is read by a person. Please do not be surprised by the volume
of writing in `docs/` — it exists because agents have no memory between sessions, so every decision has to
be written down or it is lost.

**The gates are strict on purpose, and some of them are unusual.** Content is checked against the published
source. Accessibility is tested by machine on every change. Architecture rules are enforced by a linter, not
by review. A change that a reviewer likes can still be refused by a gate, and that is the intended design.

**A check can fail for reasons that have nothing to do with your change.** The clearest example: `make lint`
includes an obligation gate ([ADR-0009](docs/adr/ADR-0009-adr-obligations-are-machine-checked.md)) that
reads today's date and fails when a dated commitment written in `docs/` has come due and has not been
closed. That can turn a green branch red overnight with no commit. If a check fails and the message is
about something you have never touched, **say so in the pull request and stop** — do not try to fix it, and
do not force anything. It is ours to clear.

**Status, as of this writing:** early development. Nothing is playable yet. The question bank, however, is
real — several hundred verified questions across nine subjects — so there is plenty to check and correct.
`node scripts/verify-content.mjs` prints today's counts, and `docs/plan/slices.md` tracks where the work is.

## Report a wrong question or a wrong depiction

This is the easy path, it needs no setup, and it is a first-class contribution — not a lesser one than code.
Opening a well-described issue about a wrong answer does more for the people using this game than most pull
requests will.

Two [issue templates](https://github.com/kinncj/OhCanada/issues/new/choose) exist for it:

- **Question correction** — a question, answer, distractor, explanation or French translation is wrong,
  ambiguous, out of date, or copied word for word from the source. Give the question `id` if you can find
  it (or paste the text), say what is wrong, and link the canada.ca page that supports the correction.
- **Cultural accuracy** — art, a character, a place or wording misrepresents a people, a place or a
  culture. These are handled as correctness bugs, on the same footing as a wrong answer. If you would
  rather not raise it in public, [`SECURITY.md`](SECURITY.md) has a private route and it is entirely
  appropriate to use it for this.

Anything that fits neither template is still welcome as a plain issue.

Please **do not** open a pull request that edits `content/questions/**` and marks it verified. That is not
gatekeeping — the next section explains why such a change cannot be accepted from anyone, including us.

## Run it on your machine

You need **Node 22 or newer** (`"engines": { "node": ">=22" }` in `package.json`; CI runs Node 22) and
`git`. Nothing else — no database, no server, no API key, no accounts.

```sh
git clone https://github.com/kinncj/OhCanada.git
cd OhCanada
make setup      # npm ci, plus the Playwright Chromium browser
make            # list every target, with a one-line description each
```

The loop you will use most:

```sh
npm run dev                                     # Vite dev server, hot reload
make lint typecheck test validate-content       # the fast gate — run this before you push
make test                                       # unit tests with coverage thresholds
make build preview                              # production build, then serve it locally
```

**Everything CI does is a `make` target.** There is no hidden pipeline step, no bespoke CI script and no
secret configuration: the workflows in `.github/workflows/` install dependencies and then call the same
targets you can call. If you want to know exactly what will run against your branch, read the two `run:`
lines in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). If a target is green locally it will be
green in CI, barring the date-dependent gate described above.

The slower, browser-based gate — the same one the second required check runs:

```sh
make assets build test-e2e test-perf test-a11y
```

`verify-content` and `verify-art` are real gates now, not placeholders. `verify-content` binds every
question to its cached source, checks both quoted passages against that source, checks that nothing was
copied verbatim, and reads git history for the separation of duties described below. It prints its own
counts on every run, including how many questions it could **not** check — the cached guide is Crown
copyright and is not in this repository, so in CI the text checks cannot run and the summary says so rather
than printing a tick. Do not read a passing `verify-content` as "my question was verified": what it proves
is stated in its output, and a verified status still comes from a second reader.
[`docs/guidelines/running-the-checks.md`](docs/guidelines/running-the-checks.md) explains each command, what
a red run is telling you, and how to fetch the source locally.

## What happens to your pull request

Fork the repository, branch, push, open a pull request against `main`. Then, in order:

1. **If this is your first contribution here, the workflows will not start until a maintainer approves
   them.** GitHub is configured with `first_time_contributors` approval for fork pull requests. Your pull
   request will sit with no checks running and no explanation, which looks exactly like being ignored. It
   is not. It is a one-time click on our side, and it exists because a pull request runs arbitrary code
   from the pull request on our runners. Once you have one merged contribution, later ones start
   immediately. If a day goes by with nothing happening, a polite comment is welcome.

2. **Two checks are required, and both must be green before the merge button works.** Their names are
   exactly:

   - `Lint, types, unit tests, content` — runs `make lint typecheck test validate-content verify-content
     verify-art`. `lint` is ESLint plus dependency-cruiser (the architecture rules in `CLAUDE.md` are
     machine-enforced, so an import across a forbidden layer boundary fails here) plus the obligation gate.
   - `Build, e2e, perf, a11y` — runs `make assets build test-e2e test-perf test-a11y`. That is the
     production build, the Playwright end-to-end suite, the performance budgets, and axe-core against every
     DOM screen.

   On a failure, the Playwright HTML report is uploaded as a build artifact for 14 days; open it from the
   run's summary page, click the failing test, and the trace viewer loads inside it.

3. **A code owner must approve.** `.github/CODEOWNERS` assigns every path to the maintainer, so every pull
   request needs their review. Pushing a new commit after an approval dismisses that approval, so try to
   land review feedback in one push rather than five.

4. **Your branch must be up to date with `main` before it can merge**, and any review conversation must be
   resolved. Merge or rebase `main` in if GitHub tells you the branch is behind.

Useful things to do while you wait: fill in the pull request template honestly (it asks whether a new gate
has been seen to *fail* on a real violation, not merely to pass — a gate nobody has watched fail is not
known to work), and say in the description what you could not test and why.

## The verification gate

This is the most unusual rule in the project and the reason most content pull requests are sent back. It is
worth understanding before you write a question, not after.

**A question ships only when all of this is true:**

- `verification.status = "verified"`, for the **current** `sourceHash` of the cited source page;
- a non-empty `evidence` field quoting the passage from *Discover Canada* that supports the answer;
- exactly three distractors, none of which the source also supports;
- both English and French text, with the French a faithful translation;
- wording that is **not verbatim** from the source — paraphrased, in plain language.

**The author and the verifier are different, and neither may do the other's job.** An author writes
questions, quests and dialogue and may *never* write a `verification` block. A verifier writes *only* the
verification block and may never edit the text it is judging.

Here is why, because a rule you understand is a rule you will not accidentally break: a question marked
verified by the person who wrote it carries no information at all. The author already believed the answer
was right — that is why they wrote it. Their "verified" restates the belief that produced the error, so it
cannot catch the error. The only thing worth anything is a second reader going to canada.ca, finding the
passage, and quoting it. That is what `evidence` is: a status with no quoted passage is an assertion, and
this project does not accept assertions. Anyone can later open the question file and check the quote against
the source themselves.

So: **send corrections and new question text as issues, or as pull requests that leave `verification`
alone.** A correction goes through the same verifier as a new question — the bar does not drop because a
correction came from the community, and it does not rise either.

Two more consequences you will meet:

- A question whose source page changes under us, or whose check is older than 180 days, is **quarantined**
  and drops out of the build rather than being left quietly wrong. It goes back to the verifier.
- A question the verifier judges wrong is **rejected** and goes back to the author. Rejected and quarantined
  are different states because they wake different people.

The same rule now covers **any player-facing sentence that states a fact about Canada** — a landmark blurb
or a line of NPC dialogue, not only a question card. A wrong fact in a dialogue line is read by the same
player for the same purpose.

[`docs/guidelines/who-writes-what.md`](docs/guidelines/who-writes-what.md) is the practical version of this
rule — what to put in the file, why moving a question needs two commits, and what the history check can and
cannot see. [ADR-0003](docs/adr/ADR-0003-content-verification.md) is the whole rule, including the four
statuses and the five checks, and it wins wherever the two disagree.

## Accessibility and plain language

These are requirements. A pull request that ignores them is refused, and if you do not know the rules the
refusal will feel arbitrary — so here they are.

- **Screens are DOM with ARIA roles.** Question cards, dialogue, menus and settings are real HTML elements.
  The Phaser canvas is `aria-hidden`, with a live region announcing game events. Text painted into the
  canvas is not acceptable for anything a player must read or operate.
- **Keyboard-only playable**, plus a single-switch mode where tapping anywhere advances.
- **Touch targets at least 44 pt.** Text scales 100–200% without breaking. High contrast is supported and
  **colour is never the only signal**. Reduced motion genuinely reduces motion.
- **English and French, from the first commit.** Both languages ship together; a string in one language only
  fails `make validate-content` on the file.
- **Plain language, roughly CLB 4 / grade 6**, for anything a player reads. Our audience is learning English
  or French while learning this material. Short sentences, common words, no idioms.
- **Subtitles on by default**; every sound has a visual equivalent. No timers anywhere except Exam mode,
  where the timer is optional.

`make test-a11y` runs axe-core over every DOM screen in CI. It is a gate, not a report.

## Licensing: what we can and cannot accept

- **Code** is MIT ([`LICENSE`](LICENSE)).
- **Original art** is CC BY 4.0 ([`LICENSE-ASSETS`](LICENSE-ASSETS)), attributed to "TrueNorth contributors".
- **Question data** is CC0.
- **Third-party assets** must be **CC0 or CC BY only** — no NonCommercial, no NoDerivatives, nothing that
  restricts redistribution — and every one is listed in `assets/credits.json` with author, licence and
  source URL. `make validate-content` fails on any file in `assets/dist/` that has no credit.
- **Dependencies** must not restrict open-source redistribution. This is why characters use Rive
  (Apache-2.0) rather than Spine.

By opening a pull request you are stating that you wrote what you are submitting, or that you have the right
to contribute it under these terms.

Said plainly: **a contribution whose licence you cannot establish cannot be accepted, however good it is.**
An image found through a search engine, a sprite from another game, text pasted from a site with no licence
notice, an AI-generated asset whose training terms you cannot vouch for — all of these are refusals, and not
because the work is poor. If you are not sure where something came from, say so before you spend time on it
and we will work it out together. See [ADR-0004](docs/adr/ADR-0004-licensing.md).

One specific thing: *Discover Canada* itself is Crown material. Facts from it are **paraphrased**, never
pasted. Copying its wording is both a licensing problem and a verification failure.

## Depicting people, places and cultures

Landmarks and the people you meet in this game are drawn from references and simplified — never invented.
Indigenous content in particular follows a review standard: name the nation depicted, no invented patterns,
no sacred items used as props, no caricature, and identical cartoon proportions for every character so that
no group is drawn as the "other" one.

Those rules and the process behind them are in [`docs/content-review.md`](docs/content-review.md). Read it
before you draw, write or file anything that depicts a specific community. Two things in it are worth
knowing before you start:

- **No community reviewer is engaged for this project today**, and the document says so plainly rather than
  implying an approval that nobody gives. That is why so much of it ends in "does not ship yet".
- **A report from a member of a depicted nation can fail a depiction; no comment on a public issue can pass
  one.** If you report a problem, the depiction is disabled first and discussed second, and the fix goes
  back through the full authoring and verification path (§7).

If you are working on art that depicts a specific community, open an issue and ask before you invest time.

## Commits and pull requests

- **Imperative subject, 72 characters or fewer, plain verbs**: "Add", "Fix", "Move", "Remove". Not "Added",
  not "This commit fixes". Explain the why in the body if it is not obvious.
- **No attribution trailers of any kind** — no `Co-Authored-By`, no `Signed-off-by`, no tool advertising.
  This applies to everyone, humans and agents alike.
- Reference the slice from `docs/plan/` in the body when there is one.
- New behaviour comes with a test that fails without the change.
- Keep pull requests small and about one thing. A drive-by reformat inside a behaviour change makes the
  behaviour change unreviewable.

Changing an established decision means **writing a new ADR in `docs/adr/`**, not editing the decisions table
in `CLAUDE.md`. If your change needs a decision reversed, say so in the pull request and we will work out
the ADR together — do not silently edit the table, because the linter and several other documents are
written against it.

## What to read next

Only if you are changing code or content. In rough order of how likely each is to change what you do:

| Document | What it will tell you |
|---|---|
| [`docs/guidelines/`](docs/guidelines/README.md) | How to add or correct a question, a landmark blurb or a line of dialogue, written for someone seeing this repository for the first time. Start here for anything under `content/`. |
| [`CLAUDE.md`](CLAUDE.md) | The working agreement: the fixed decisions, the layer rules, the performance budgets, the accessibility and content rules. One page. Read it before changing anything. |
| [ADR-0003](docs/adr/ADR-0003-content-verification.md) | The verification gate in full — the four statuses, the five checks, why authoring and verification are separated. Required reading before touching `content/`. |
| [ADR-0004](docs/adr/ADR-0004-licensing.md) | Which licences are acceptable and what provenance an asset needs before it can ship. |
| [ADR-0005](docs/adr/ADR-0005-architecture-layers.md) | The layer boundaries dependency-cruiser enforces, so `make lint` does not surprise you: `domain` imports nothing outside `domain`/`common`; `application` is ports only; adapters never import each other; `ui` is DOM only; concretes are wired only in `bootstrap`. |
| [`docs/architecture.md`](docs/architecture.md) | How the pieces actually fit together, and which seams are still open. |
| [`docs/adr/`](docs/adr/) | Every other decision, with the reasoning and the alternatives that were rejected. |
| [`docs/runbook.md`](docs/runbook.md) | Deploys, rollback, and the security invariants behind the workflows. Read it before changing anything in `.github/workflows/`. |

## Being treated well

Read the [Code of Conduct](CODE_OF_CONDUCT.md). It is short and it is enforced. This project is built for
newcomers to Canada, and mockery of the peoples and cultures it depicts is named in it as unacceptable
behaviour.

Security or privacy problems go through [`SECURITY.md`](SECURITY.md) rather than a public issue.

Thank you for being here. If something in this document is wrong, unclear, or assumes knowledge you do not
have, that is a bug in the document — please open an issue and say so.
