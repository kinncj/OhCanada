# Cached sources

Questions are paraphrased from *Discover Canada*, the official IRCC study guide, and every shipped
question carries a `sourceHash` so a verifier can prove which bytes it was checked against
(ADR-0003).

## Why the source files are not in this repository

*Discover Canada* is Crown copyright. Paraphrasing it and citing the chapter is fine — that is what
the game does. Redistributing the document from a public MIT/CC-BY/CC0 repository is not ours to do,
and ADR-0004 forbids shipping third-party material that is not CC0 or CC-BY.

So `content/sources/*.pdf` and `content/sources/*.txt` are git-ignored. What *is* committed is the
manifest: the URL, the SHA-256, the edition and the retrieval date. A verifier re-fetches the bytes,
hashes them, and either gets the same digest or knows the source moved under it.

## Getting the source locally

Download the guide from the URL in `discover-canada.json`, place it in this directory under the
`file` name the manifest gives, and check the digest:

    sha256sum content/sources/discover-canada-2012-large-print.pdf

If the digest does not match the manifest, **stop**. Either the document changed or you have a
different edition, and in both cases every question verified against the old digest is now
`quarantined` until re-checked. That is the mechanism, not an inconvenience.

Then produce the extraction, which is what every check actually reads:

    make sources                 # re-derive each extraction, compare with the register
    npm run sources -- --write   # ... and write the .txt files it reproduced

`make sources` does not fetch anything. It runs the command each register records under
`extraction` and hashes the result against `extractedTextSha256`. For *Discover Canada* that command
is

    pdftotext -layout content/sources/discover-canada-2012-large-print.pdf -

with `pdftotext (poppler-utils) 26.08.0`, and it reproduces `fd51046981…` exactly. The command must
write to stdout, so a re-run can be checked without overwriting your copy; `--write` is the only way
bytes reach this directory.

**If a re-derivation does not match, never re-hash the register to fit.** 389 questions were granted
against `extractedTextSha256`, and changing it re-points every one of them at bytes no verifier read.
Report the mismatch with both digests and your extractor's version.

This target is not in CI. The documents are git-ignored, so there would be nothing for it to read —
and a workflow that ran a command out of a content file would be a supply-chain hole bought for a
check that cannot run there anyway.

## Five of the seven extractions cannot be reproduced by anyone

Recorded here because it is a live gap, not a to-do someone might tidy. `make sources` prints it on
every run and `npm run sources -- --require-recorded` fails on it.

The two PDF sources — `discover-canada` and `huron-wendat-nionwentsio-brief-2016` — record a command
and reproduce their digests. The five HTML sources do not: how their `.txt` was made was never
written down, and two candidate pipelines (a regex tag-stripper, and Chromium's
`document.body.innerText` through Playwright) were tried on 2026-09-09 and neither reproduces the
recorded digest. Each register says so in `extraction.reason` rather than leaving the field empty.

This is not cosmetic. Every one of those five digests is cited as the `sourceHash` of a level's
territory statement, so a shipped claim about whose land a level is set on is pinned to bytes only a
machine that already holds the file can produce. Someone who fetches the page and matches its
`sha256` still cannot check the quote. Closing it means finding a command whose output hashes to the
recorded value — and if none exists, re-extracting with a recorded command and **re-verifying** the
claims that move with it, which is the verifier's call and not an edit to a digest.

## The edition currently cached is out of date, on purpose

Read `discover-canada.json`'s `knownStaleness` before authoring anything. The cached guide is the
2012 large-print edition, and parts of it are no longer true — most obviously the Oath of Citizenship,
which names Queen Elizabeth II and omits the 2021 amendment recognising Aboriginal and treaty rights.

It is cached anyway because it is the edition the study guide has been distributed as, and because
a source that is wrong in a *known, recorded* way is safer than one that is wrong in an unknown way.
Every affected subject is listed in the manifest. A question drawn from those areas must be checked
against the live canada.ca page, not this file.

The sharpest hazard is not that the text is old. It is that **one passage is current and out of date at
the same time**: the Oath on page 2 already carries the June 2021 amendment recognising Aboriginal and
treaty rights, while still naming Queen Elizabeth the Second. A reader who checks that the amendment is
present will conclude the page was revised, and be wrong.

On the Sovereign the document is uniformly pre-accession — five "Her Majesty", zero "His Majesty".
An earlier version of this file claimed the text was *inconsistently* updated on that point, citing one
"His Majesty". That was a misread: the match was "King Charles II of England" in a 1670 sentence about
the Hudson's Bay Company charter.
