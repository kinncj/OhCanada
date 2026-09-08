# ADR-0019: A rule drawn round a container measures the container, not the property

- Status: Accepted (2026-09-08)

## Context

Four times now, in four different layers, this repository has drawn a rule or an exemption around a
**container** when the property being protected belonged to the container's **contents**. Each was found by a
person reporting a blind spot, never by a gate. The third is mine, written into an ADR in the same session in
which I described the first two — which is the reason this record exists rather than a fifth observation
later. **The fourth is also mine, committed hours after this ADR was written, in a gate of my own.**

| # | The rule as written | The container it measured | The property it meant |
|---|---|---|---|
| 1 | a skipped schema file's `$defs` are skipped with it | the **file** | is this `$def` reached by a schema the application reads? |
| 2 | check `content/schemas/*.schema.json` references in `*.md` | the **file extension** | is this a claim a human wrote? |
| 3 | "landmarks are not moved to 1×" (ADR-0013 §4, now replaced) | the **asset category** | does *this drawing* survive the two-size test at 1×? |
| 4 | "a level that draws art declares an asset of kind `atlas`" (my gate, withdrawn) | the **enum's membership** | does the level name somewhere its textures come from? |

The shape is identical every time and so is the failure:

- **It is right on the examples that prompted it.** `common.schema.json`'s root genuinely has no port type.
  The first dead schema path genuinely was in Markdown. A landmark genuinely is something a player looks at
  closely. `levelAssetKind` genuinely listed `atlas` and no other texture kind.
- **It is wrong on the next case, silently.** Seventeen self-contained `$defs` are hidden for a reason that
  does not apply to them. Two of three real dead paths sit in JSON. One landmark, measured, does not need
  2× — and the rule would have spent 12.85 MiB to honour a category. Seven of Ottawa's eight assets ship as
  standalone images because they exceed the atlas width limit, so case 4's rule was false for 88 % of the art
  it judged.
- **Its silence reads as coverage.** A skipped def, an unscanned file and an un-measured asset all look
  exactly like a checked one from outside. Case 4 is the exception that proves the shape: it was *loud*, and
  it was still wrong, because a container-scoped rule that happens to fail tells you the container is empty
  rather than that the rule is mis-scoped.

Two further things are worth naming because they are what makes the pattern hard to see from inside.

**The container is almost always the easy thing to enumerate.** `readdirSync` gives you files. A glob gives
you extensions. A level document gives you `pois[]`. The property — *reached by a live schema*, *written by a
human*, *legible at 25 %* — needs a graph walk, a judgement about authorship, or an artist looking at a
drawing. The rule lands on the container because that is where the API is, and the reasoning follows the
implementation rather than the other way round.

**Case 4 was committed by the author of this ADR, on the day of writing it, and this ADR's own second test
would have caught it.** "Ask what the next member looks like" — the next member was an 1800 px parallax layer
that cannot be atlassed, which is most of the art in the game. That is worth more as evidence than four clean
cases would be: it shows the pattern is not carelessness and is not fixed by knowing about it. The
justification for case 4 was even reasonable on its face — the enum listed exactly one texture kind, so
inferring "every texture arrives through an atlas" followed from it. The enum was incomplete, and an
incomplete container is indistinguishable from a complete one when you are reading it as a definition rather
than as a list.

**Two of the four were written by an agent that had just argued the opposite elsewhere in the same
document.** ADR-0013 §2 defines "full-screen" *mechanically, per asset* — "the key appears in some level
document's `layers[]`" — and explicitly rejects a pixel-area threshold because it "gets the answer wrong in
both directions". Twelve paragraphs later the same ADR decided landmark scale **by category**. Having the
right principle written down, in the same file, was not sufficient.

## Decision

**When writing a rule or an exemption, name the property, then find the smallest thing that carries it. If
the rule is stated over a container, it must be because the container is what carries the property — not
because the container is what was easy to enumerate.**

Three tests to apply while writing one. They are cheap and any of them failing is the signal:

1. **Say the rule as a property of one member.** "This `$def` is exempt because *its file* is exempt" is not
   a property of the def. "This `$def` is exempt because no schema the application reads reaches it" is. If
   the sentence has to reach up to the container to justify itself, the rule is at the wrong level.
2. **Ask what the next member looks like.** Not the ones that prompted the rule — the next one. Seventeen rig
   defs, a `$comment` in a `.json`, a landmark whose artist measured it. If the rule's justification does not
   survive an honest description of a plausible next member, it is a generalisation from the examples rather
   than a rule.
3. **Ask whether a wrong answer would be visible.** A container-scoped rule fails *silently* by definition:
   the members it wrongly covers are never examined, so there is no output to be wrong. That is what makes
   this class expensive rather than merely untidy.

**Where the property is genuinely not mechanisable, the rule moves to the person who can evaluate it and is
recorded where they work.** This is the resolution of case 3 and it generalises. Whether a drawing survives
the two-size test is not derivable from any file property — not its category, not its megapixels — so the
decision belongs to the artist and is recorded in the source filename (`…@1x.svg`), in the tree art owns. A
build script asserting it would be asserting something it cannot see. **"Not mechanisable" is a valid answer
and is not the same as "unchecked"**; it means the check is a named person's judgement, recorded in a place a
reviewer will pass.

### What this is not

It is **not** "prefer fine-grained rules". A rule at the wrong granularity in the other direction is its own
defect, and this project has rejected that too: ADR-0003's staleness grain records that a chapter-grain flag
forced **all 57** questions volatile, and *"a flag that fires on everything carries the same information as a
flag that fires on nothing"*. The instruction is to match the grain to the property, in whichever direction
that lands.

## Alternatives considered

- **Leave it as three anecdotes in three ADRs.** The status quo, and it is what produced the third instance:
  ADR-0018 described the first two in its Consequences and I committed the third in ADR-0013 that same
  session. Prose in a consequences section is not a rule anyone applies while writing.
- **Build a gate for it.** The obvious impulse here and it does not work, which is worth stating so nobody
  spends a day discovering it. The defect is a *justification* that does not match its *scope* — a mismatch
  between a sentence and a set. Nothing in CI reads a justification. A linter could at best count exemptions,
  and "how many entries are in your skip table" measures the container again, one level up, which would be
  this ADR committing its own error.
- **Ban exemption tables.** Over-corrects into something unworkable: `SKIPPED_SCHEMAS` is legitimate and its
  entries are true. The defect was never that an exemption existed; it was that the exemption's *reason* was
  narrower than its *reach*.
- **Require every exemption to carry a written reason.** Already the convention, and all three defects had
  one. Case 1's reason — "a file-level skip hid the shared `$defs`" — was accurate, well argued, and about
  the container. A good reason attached to the wrong scope is the failure mode, not the absence of a reason.
- **Fold this into ADR-0018.** Rejected: ADR-0018 is about *claim gates* specifically, and cases 1 and 3 are
  not claim gates — one is a type-binding exemption, the other an art-authoring rule. Filing the general
  pattern under the narrowest of its three instances is a container error about a rule about container
  errors.

## Consequences

- **All four instances are fixed.** Case 1 cascades only where no live schema `$ref`s the def
  (ADR-0017 §5). Case 2 scans `.md` bodies and `.json` string values, with a stated asymmetry for `.ts`
  (ADR-0018). Case 3 makes scale a per-asset authoring decision recorded in the filename, with 2× as the
  default and the two-size test as the departure (ADR-0013 §4, replaced). Case 4's gate was withdrawn and
  `levelAssetKind` gained `image` (ADR-0020).
- **This ADR has no gate and says so.** It is a rule for review and for the moment of writing, which puts it
  in the same category as the rules ADR-0009 lists under "rules stated here that no gate can express". Naming
  that up front is the point: an unmechanised rule presented as if it were enforced is itself the failure
  this project keeps removing.
- **Expect it to be violated again.** Four instances over two slices, twice by an author who had the correct
  principle written down in the same document, and once *by the author of this ADR within hours of writing
  it*. The realistic value of this record is that the next one gets **recognised** faster, not that it gets
  prevented — and case 4 is the evidence for exactly that: it was recognised in one reading, from the
  question "what does that rule actually measure?", rather than after a slice in production.
- **All four were reported by a person, not caught by a gate**, and that is the load-bearing fact about
  where this class is found. It argues for describing the pattern in review vocabulary — "what does this rule
  measure, and what does it mean?" — rather than for another check.
