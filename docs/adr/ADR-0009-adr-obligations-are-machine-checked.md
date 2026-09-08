# ADR-0009: A dated obligation in a document is machine-checked

- Status: Accepted (2026-09-08)
- Amended 2026-09-08: adds `VOIDED` as a second terminal marker alongside `DISCHARGED`. The original text
  folded withdrawal into `DISCHARGED` ("an obligation that is no longer applicable is discharged with a
  sentence saying so") to keep the format small. That fold broke on its first real use, the same day: the
  visibility reversal in ADR-0006 removed the premise of an open obligation before any work was scheduled
  against it, and writing `DISCHARGED` there would have claimed delivery that never happened — the exact
  class of false claim this ADR exists to stop. Two states, one parsing rule; see "The marker".
- Amended 2026-09-08 (second): the GitHub Issues alternative was rejected partly because "issues are not
  visible in a private repository's diff". ADR-0006 has since made the repository public, so that clause is
  no longer true and is removed. The rejection stands on its remaining two grounds.

## Context

This project's recurring failure mode is a written claim that stops being true and nothing noticing.

ADR-0006 has carried a false claim twice. It said rollback was "documented and tested once" when it had
never been tested; that was corrected by a first amendment, which opened a dated obligation to actually
drill it. The drill happened, and a second amendment closed the obligation — but only because a human read
both documents and spotted the drift. `docs/runbook.md` §6 hands the closure off in prose ("that ADR's line
claiming rollback is 'documented, not tested' is now out of date and should be amended by the architect"),
which is a to-do addressed to whoever reads it next. Nothing schedules that read.

So the pattern is established and it is not working: we write obligations with owners and dates, in the
right places, honestly — and then discharge depends on somebody happening to look. Every gate this project
trusts is mechanical (dependency-cruiser for layering, `validate-content` for schemas, the contract test for
`PROVISIONAL` port markers). Dated obligations are the one class of commitment enforced by attention alone,
and they are exactly the class where the cost of forgetting is a document that lies.

A note on why this is worth a gate rather than better discipline: the two amendments to ADR-0006 are
evidence that the discipline is *good*. The claim was found, twice, and fixed properly both times. The gate
is not compensating for carelessness. It is removing the dependency on a specific person re-reading a
specific paragraph at the right moment.

## Decision

A dated obligation written anywhere under `docs/` uses a fixed marker. A gate in `make lint` fails the build
when an obligation is past its date and not marked discharged. `scripts/**` is outside the architect's
boundary, so this ADR specifies the gate completely enough to be built without further design decisions,
and does not implement it.

### The marker

Three markers, all uppercase so they are greppable, all key-less where a position is unambiguous:

```
OBLIGATION due=YYYY-MM-DD owner=<owner>
DISCHARGED YYYY-MM-DD
VOIDED YYYY-MM-DD
```

`DISCHARGED` and `VOIDED` are both *terminal*: either one closes an obligation's block, and the gate treats
them identically. They differ only in what they assert to a reader, and the difference is the whole reason
there are two — **`DISCHARGED` means the work was done; `VOIDED` means the premise went away and no work was
owed.** Recording a withdrawn obligation as discharged claims a delivery that never happened, which is the
failure mode this ADR exists to prevent, so the format must not force that wording. The parsing cost of the
second keyword is one alternation in one regex.

Written in a document, as a Markdown list item:

```markdown
- **OBLIGATION due=2026-10-08 owner=infra** — land the artefact size ceiling and the retention policy,
  record the numbers in runbook §3, and close the corresponding gap in §6.
```

and, when it is done, in the same list item:

```markdown
- ~~**OBLIGATION due=2026-10-08 owner=infra** — land the artefact size ceiling and ...~~
  **DISCHARGED 2026-10-02** — ceiling set at 40 MB per run, retention 3 days, both recorded in runbook §3.
```

Rules for the writer, all of them things a person would do anyway:

- The obligation is a **Markdown list item**. Everything from the `-` to the next list item at the same or
  shallower indentation is that obligation's *block*.
- `due` is an ISO date, `YYYY-MM-DD`. No relative dates, no "when X exists". If the trigger is genuinely
  conditional, pick the date by which the condition should have occurred and re-date it with a note if it
  has not; a condition with no date is not an obligation, it is a hope.
- `owner` is one token matching `[A-Za-z0-9_./-]+` — an agent role (`infra`, `architect`, `content`) or a
  person. Exactly one owner. A shared obligation is nobody's.
- To close an obligation, put `DISCHARGED <date>` or `VOIDED <date>` **in the same block**, followed by what
  actually closed it. No id, no cross-reference, no registry file. The obligation and its closure are read
  together because they sit together.
- Struck-through text (`~~…~~`) is normal for a closed obligation and the gate ignores the tildes; the
  existing convention of keeping a closed obligation in place rather than deleting it is preserved.
- Choose the keyword honestly. `DISCHARGED` asserts the obligation's work was done and should be followed by
  the evidence. `VOIDED` asserts the obligation no longer applies and should be followed by *what removed
  it* — a reversed decision, a dropped feature, a constraint that evaporated. If some of the work landed
  before the premise disappeared, say so in the `VOIDED` sentence rather than reaching for `DISCHARGED`.
  Deleting the line is not how an obligation ends, in either case.

That is the whole format. It was chosen so that the marker is something a person would write in prose
anyway, with two uppercase words and one `key=value` pair added. A fussier format — ids, a registry file, a
YAML front-matter block — would be skipped under pressure, and a gate that people route around measures
nothing, which is the failure mode this ADR exists to end.

### What the gate does

Input: every `*.md` file under `docs/`, recursively. Not `CLAUDE.md`, not `README.md`, not source comments —
one directory, so there is no question about where an obligation is allowed to live.

**Fenced code blocks and inline code spans are skipped.** Text between ``` fences, and text inside backticks,
is documentation *about* the format, not an obligation. This ADR is the proof that the rule is needed: the
examples above contain the word `OBLIGATION`, one of them with a real date, and without this exclusion the
gate's own specification would be reported as three malformed markers and one live obligation. A gate that
cannot read the document defining it is a gate nobody will trust.

"Today" is the system date in **UTC**, overridable by the environment variable
`TRUENORTH_OBLIGATION_TODAY=YYYY-MM-DD`. The override exists so the gate itself is testable; a date-dependent
check that cannot be tested at a fixed date will rot exactly like the claims it guards.

The gate **fails** (non-zero exit, one line per finding naming file, line, owner and the obligation text) on:

1. **Overdue.** An obligation whose `due` is strictly before today, with **neither** a `DISCHARGED` nor a
   `VOIDED` marker in its block. This is the check the ADR is for. Due *today* passes; the day is not over.
2. **Malformed marker.** A line outside code, containing the standalone word `OBLIGATION`, that does not match
   `OBLIGATION\s+due=(\d{4}-\d{2}-\d{2})\s+owner=(\S+)` after `~~`, `*` and `_` are stripped. A typo must be
   loud. A silently unrecognised obligation is worse than no gate, because it looks like coverage.
   The same applies to a line containing `DISCHARGED` or `VOIDED` that is not followed by an ISO date.
3. **Dangling closure.** A `DISCHARGED` or `VOIDED` marker in a block with no obligation — a copy-paste, or
   an obligation deleted instead of struck through.
4. **Double closure.** Both `DISCHARGED` and `VOIDED` in one block. They assert different things; a block
   claiming both is a block whose reader cannot tell whether the work happened.
5. **Impossible date.** A `due`, `DISCHARGED` or `VOIDED` date that is not a real calendar date, or a closure
   date in the future.

The gate **passes but reports** every open obligation, sorted by due date, with days remaining. Open
obligations should be visible on every run, not only on the day they start failing.

Wiring: run it in `make lint`, alongside dependency-cruiser, so it is in the pull-request gate set and in the
deploy gate set that `deploy-pages.yml` runs before publishing. Exact target names and script layout are
infra's.

### The one deliberate oddity

This gate can turn a green tree red **with no commit**, because the clock moved. That is intended and is the
point: the obligation became overdue whether or not anyone touched the repository, and the next person to
open a pull request is the right person to be told. The fix is to discharge the obligation or to re-date it
with a note saying why — not to silence the gate.

## Alternatives considered

- **Keep relying on review.** Rejected: this is the status quo, and the two ADR-0006 amendments are the
  evidence. It worked twice and cost a human read each time; it also left a wrong claim standing in between.
- **GitHub Issues with due dates.** Rejected: they drift out of step with the document that made the
  commitment, and the obligation's context — the ADR paragraph around it — does not travel. The commitment
  belongs in the document that makes it, where it is reviewed in the same diff as the claim it qualifies.
- **A registry file (`docs/obligations.yml`) that the gate reads.** Rejected: two places to update, so the
  registry becomes the thing that goes stale, and we have replaced a false claim in an ADR with a false claim
  about an ADR. The document is the source of truth.
- **Hand-written obligation ids (`OBLIGATION[ADR-0006-1]`) so a discharge elsewhere can reference it.**
  Rejected: it buys remote discharge, which is not wanted — a discharge recorded away from the obligation is
  how the runbook §6 / ADR-0006 split happened in the first place. Ids are also the part of a format people
  get wrong or skip. If the gate needs to name an obligation in an error message, it derives
  `<file>:<line>`, which is more useful than an id anyway.
- **A warning rather than a failure.** Rejected: CLAUDE.md's architecture section already establishes that
  this project has no warnings, only failures. A warning is a to-do addressed to nobody, which is the thing
  being fixed.
- **Putting this in `docs/architecture.md` instead of an ADR.** Rejected: `architecture.md` describes how the
  system fits together and defers decisions to `docs/adr/`. This is a decision with alternatives and a real
  cost (a gate that can fail on a clock tick), which is ADR-shaped. `architecture.md` should link here rather
  than restate it.

## Consequences

- An obligation written in an ADR is a commitment the build can check, so writing one costs the author
  nothing extra and buys real enforcement. Expect more of them, which is the desired effect.
- A wrong `due` date now has a consequence, so dates will be chosen more carefully. Re-dating with a note is
  legitimate and expected; the gate does not punish it.
- Existing prose obligations are not retro-fitted wholesale. ADR-0006's closed rollback obligation was
  converted to the marker format when this ADR landed, unchanged in meaning, so the corpus contains at least
  one discharged obligation for the gate to parse. Anything else predating this ADR is converted when it is
  next touched.
- The gate reads documents, not reality. It cannot tell whether the sentence next to `DISCHARGED` is true —
  it enforces that a claim was made and dated by an owner, not that the work happened. That is the same
  guarantee an ADR amendment gives, made unskippable.

### Rules stated here that no gate can express

Named so nobody mistakes the gate's silence for compliance:

- **Deleting an obligation instead of discharging it is invisible.** The gate sees what is present; a removed
  line leaves no trace to check. This is a convention held by review only.
- **Re-dating an obligation indefinitely defeats it.** Pushing `due` forward on every run is mechanically
  indistinguishable from planning. Only a reader notices the pattern.
- **The truth of a discharge is unverifiable.** See above.
- **`VOIDED` is the easiest way to escape an obligation, and the gate cannot tell abuse from a real
  reversal.** Both look like a closed block. The distinction is whether something outside the obligation
  actually changed — a reversed decision, a dropped constraint — and only a reader can check that the stated
  cause exists. A `VOIDED` whose sentence does not name what removed the premise should fail review.
- **An obligation nobody wrote is not caught.** The gate checks obligations that exist; it cannot know that a
  paragraph should have carried one. That remains the architect's job at ADR-writing time.

### This ADR's own obligation

Written in the format it specifies, because an ADR that defines a discipline and exempts itself from it is
the first place the discipline breaks.

- **OBLIGATION due=2026-10-08 owner=infra** — implement this gate under `scripts/` to the specification
  above and wire it into `make lint`, including a test that exercises the overdue, malformed, dangling,
  double-closure, discharged and voided cases against a fixed `TRUENORTH_OBLIGATION_TODAY`. The corpus
  already contains one of each terminal state — ADR-0006 carries a `DISCHARGED` rollback obligation and a
  `VOIDED` artefact-ceiling one — so both parse paths have a real example to run against. Until this lands,
  this ADR describes a gate
  that does not exist, and the obligations already written in the marker format are checked by nothing.
