# Running the checks

Four commands cover everything a content change is judged by. All of them run on your machine exactly as
they run in CI — there is no hidden pipeline step.

```sh
make validate-content     # every content file against its schema
node scripts/verify-content.mjs    # sources, quotes, verbatim, separation of duties
make test                 # unit and contract tests, including the banned-term check
make lint                 # code style, architecture rules, and a dated-commitment gate
```

You need Node 22 or newer and a `make setup` once. Nothing else.

## `make validate-content`

Checks every file under `content/` against the schema it declares, and refuses unknown properties. This is
the one that catches a missing `fr`, a misspelled field, four options where the schema wants exactly four
of a particular shape, an empty string where text is required, and a verification block written in any form
other than the legal one.

A green run says what it looked at:

    validate-content: OK - 414/414 content file(s) valid against 12 schema(s), ...

Run this first. It is fast, and most mistakes are structural.

## `node scripts/verify-content.mjs`

Also available as `make verify-content`. This is the content-specific gate, and it does four jobs:

1. **Binds each question to its source register** — the cited chapter exists, the page is inside that
   chapter, the hash matches what was read.
2. **Checks the two quotes against the cached text** — `source.quote` must appear word-for-word;
   `verification.evidence` must contain a real run from the source and introduce no word the source does not
   contain.
3. **Checks the wording is not copied** — no run of 14 or more consecutive words shared with the guide.
4. **Checks the separation of duties over git history** — no single commit both authors a claim and grants
   its verification.

A green run prints its own numbers, including the ones that would let you tighten a threshold later:

    verify-content: longest verbatim run in authored prose 13 word(s) at
    content/questions/economy/eco-18-peace-arch.json explanation.en, threshold 14; ...

Read that line. The corpus ceiling is **13** and the threshold is **14**, so there is exactly one word of
headroom. The threshold is not strict because it cannot be: phrases like "the party holding the most seats
in the House of Commons" have no paraphrase that is not a distortion, and the number was measured against
those rather than chosen. It catches a lifted *sentence*, which is what copying produces. It does not catch
a lifted clause, and passing it is not evidence that you paraphrased.

It needs the full git history. On a shallow clone it refuses to run rather than reporting green over commits
it cannot see.

## `make test`

The unit and contract suite. For content work the one that matters is the contract test binding questions to
their source register — and in particular **the banned-term check** described in
[`when-the-guide-is-out-of-date.md`](when-the-guide-is-out-of-date.md). That check lives here, not in
`verify-content`, so if you are writing near a page the register flags, run `make test` before you push.

## `make lint`

ESLint, the architecture rules, and a gate over dated commitments written in `docs/`. **That last one reads
today's date**, so it can fail on a branch you did not touch, for a commitment that came due overnight. If it
fails and the message is about a document you have never opened: say so in the pull request and stop. Do not
try to fix it and do not force anything. It is ours to clear.

## The cached source, and the one check you may not be able to run

*Discover Canada* is Crown copyright. We may paraphrase and cite it; we may not redistribute it from an
open-source repository. So the PDF and its extracted text are **not in this repository** and are git-ignored.
What is committed is the manifest — `content/sources/discover-canada.json` — with the URL, the edition, the
retrieval date and two SHA-256 digests.

Without those files, the text checks cannot run. `verify-content` says so explicitly and counts them:

    verify-content: text checks ran against a cached extraction for 0 question(s);
    389 could NOT be checked because the extraction is absent
    (this is the CI case — those questions are unchecked, not passing)

That is the honest state, not a tick. To fetch the source yourself: download the guide from the `url` in the
manifest, save it in `content/sources/` under the `file` name the manifest gives, and check the digest:

    sha256sum content/sources/discover-canada-2012-large-print.pdf

If the digest does not match, **stop**. Either the document changed or you have a different edition, and in
both cases every question verified against the old digest is due for re-checking.

**A gap you should know about:** the text checks read the *extracted* `.txt`, whose own digest is recorded as
`extractedTextSha256`, and the manifest does not record how that extraction was produced. So there is
currently no documented way to reproduce it byte-for-byte from the PDF. If your local run reports the
extraction as absent, that is expected and is not something you need to solve — write the question, and note
in the pull request that the text checks could not run locally.

## Reading a red run

The messages say what to do. Two real ones:

    verify-content: FAIL: content/questions/elections/gov-40-who-may-vote.json: source.quote is not a
    contiguous passage of discover-canada's cached extraction. ADR-0003 requires it to be, because that is
    the check that catches a fabricated citation before any verifier runs.

Meaning: the passage in `source.quote` is not in the guide, at least not in those words. You paraphrased the
quote, retyped it from memory, or fixed its punctuation. Copy and paste the passage exactly.

    verify-content: FAIL: ... explanation.en shares a run of 37 consecutive words with discover-canada's
    text, at or over the threshold of 14. ADR-0003 check 5: the wording must not be verbatim. Paraphrase it.
    Options are exempt and prose is not.

Meaning: you copied a sentence into the explanation. Say it in your own, simpler words. Note that options
are exempt on purpose — "The House of Commons." is four words with no honest paraphrase — but the prompt and
the explanation are prose you wrote, and the obligation to paraphrase falls there.

Failures name the file, the field and the rule. If one names none of those, or you cannot act on it, that is
a bug in the message: please quote it in an issue.

## Before you push

```sh
make validate-content && node scripts/verify-content.mjs && make test && make lint
```

If all four are green your content change is in good shape. What is left is the part no machine does: a
second reader going to the source and finding the passage.
