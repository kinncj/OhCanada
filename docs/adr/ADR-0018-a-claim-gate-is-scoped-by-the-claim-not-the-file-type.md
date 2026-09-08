# ADR-0018: A gate that checks claims is scoped by the claim, not by the file type

- Status: Accepted (2026-09-08)

## Context

`tests/unit/contracts/documents-name-real-schemas.test.ts` was written to close one recurring failure: a
document naming a `content/schemas/*.schema.json` that does not exist. It found `SECURITY.md` pointing a
security researcher at `save.schema.json` when the file is `progress.schema.json`, and that was routed and
fixed.

It scanned `*.md`. That was not a decision; it was the shape of the first defect, generalised one step and
stopped.

The art agent found what the stopping cost. Its rig work named a not-yet-existing schema in three places, and
the gate caught **one** of them:

| Where | Caught? |
|---|---|
| `assets/style/rig-contract.md` | yes |
| `assets/style/rig-contract.json`, `$comment` block | **no** |
| `assets/credits.json`, `modifications` field | **no** |

Two of three missed. Same claim, same dead path, same consequence for a reader — one file type over. The
agent found and fixed both by hand and **reported the blind spot rather than quietly patching it**, which is
why this ADR exists rather than a silent commit.

Then the same class of defect arrived from the other direction, in my own work. `ADR-0017` was cited by
`content/schemas/rig.schema.json` and by `tests/unit/contracts/rig-is-coherent.test.ts` before the ADR was
written, because the session that wrote those files was cut off before the record. A file citing a decision
that does not exist is a document pointing a reader at nothing — the identical failure the gate exists to
prevent, in a different vocabulary. Nothing caught it. And when this ADR's own number was first referenced
from the widened gate, the widened gate caught **that**, which is the cheapest possible evidence that the
widening was the right call.

## Decision

**The scope of a gate that checks claims is the set of places the claim can be made, not the set of files of
a convenient type.**

Concretely, for this gate:

- **Scan `.md` bodies and `.json` string values** for `content/schemas/*.schema.json` paths. `$comment`,
  `note`, `description` and `modifications` are prose fields this project uses heavily and in places
  *requires*, so a JSON file here carries as much documentation as a Markdown one. Values only, never keys: a
  key is structure and a schema already constrains it.
- **Also resolve `ADR-NNNN` references** against `docs/adr/`. One `readdirSync`.
- **A JSON file that does not parse is scanned as text.** `tsconfig.json` is JSONC and carries a long block
  comment that is exactly the prose this gate is for. The first draft threw on it, on the belief that
  unparseable JSON is a defect; it is not, JSON-with-comments is a real format. Stripping comments to parse
  it is worse than the fallback, because `//` appears inside every `https://truenorth.app/schemas/…` string
  in this repository and a naive stripper would corrupt precisely the values being searched for. Text
  scanning can only find *more* references, never fewer, which is the safe direction.

And one deliberate asymmetry, which is the part worth arguing:

- **`.ts` is scanned for ADR ids and NOT for schema paths.**

A schema path in TypeScript is almost always a real `readFileSync` argument, so a dead one already fails a
test that runs, loudly, with a stack trace. An `ADR-NNNN` in a comment is never executed — nothing resolves
it, so nothing can fail on it. **Scan the places where being wrong is silent.** A gate that re-reports what
another gate already proves is not extra safety; it is one more thing to keep in step, and the day the two
disagree the reader has to work out which is authoritative.

## Alternatives considered

- **Keep `.md` as the scope and say so.** The other half of the coordinator's question, and it is defensible
  only if a claim in a `.json` prose field is somehow less of a claim. It is not: `assets/credits.json`'s
  `modifications` field is read by a human deciding whether an attribution is honest, and
  `rig-contract.json`'s `$comment` is the normative note explaining where the file's home is. Rejected on the
  measurement — two of three real defects were in JSON.
- **Scan every text file in the repository.** The obvious generalisation and it over-fires. `.ts`, `.mjs` and
  `.cjs` contain executed paths, so it would duplicate the suite (see the asymmetry above), and lockfiles and
  generated artefacts contain strings nobody wrote. "Every string a human wrote" is the honest scope and it
  is smaller than "every string".
- **Strip comments so JSONC parses properly.** Rejected on the URL hazard above. The failure mode would be
  silent and would hit exactly the strings under test.
- **Fail on a JSON file that does not parse.** What the first draft did. Rejected because it is false:
  `tsconfig.json` is a legitimate JSONC file that `tsc` reads happily, and a gate about dangling references
  has no business having an opinion about JSON dialects. Its assertion would also have been load-bearing for
  the wrong reason — the file parses or it does not, which `make typecheck` settles.
- **Check ADR references in a separate gate.** Rejected: it is the same predicate — "this document points at
  something; is the something there?" — over the same corpus. Two gates would need the same file walk, the
  same skip list and the same anti-vacuum floors, and would drift.
- **Also check that the cited ADR is *relevant*.** Not possible, and worth naming so its absence is not read
  as coverage. The gate resolves pointers; it cannot tell that `ADR-0007` is the right ADR to cite in a given
  paragraph.

## Consequences

- **The gate found this ADR's own dangling reference the moment it was widened**, which is the shortest
  possible demonstration that it works and the reason the number could not be cited speculatively.
- **Citing an ADR is now a commitment to having written it.** That is the intended friction, and it points at
  a real hazard: code that cites a decision nobody recorded is the decision being made in a comment, where it
  has no alternatives, no consequences and no reviewer.
- **A JSON prose field is now load-bearing text.** An author writing `$comment` should expect it to be read
  by a gate. That is a small constraint and it is the correct one — these fields exist to be read.
- **This is the second scope-by-container defect in this repository.** The first was
  `ports-match-schemas.test.ts` skipping a schema file and thereby hiding every `$def` inside it, fixed by
  asking what actually made a `$def` dangerous rather than which file it sat in (ADR-0017 §5). The shape
  repeats: an exemption or a scope drawn around a *container* when the property being protected belongs to
  its *contents*. A third arrived in the same session, in ADR-0013 §4, written by the author of this
  sentence: landmark scale decided by *asset category* rather than by whether the drawing survives the
  two-size test. **ADR-0019** generalises the pattern and this bullet is why it exists — describing two
  instances in a consequences section did not stop the third.
- **What it still cannot do is unchanged and stated in the file itself, as a test rather than a comment**:
  it resolves pointers and cannot verify the sentence around one. `SECURITY.md`'s claim was *true* and its
  path was dead; a document whose path is live and whose claim is false reads identically to this gate.
