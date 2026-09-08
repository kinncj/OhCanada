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

    make sources        # once implemented (task 1.17)

Until then, download the guide from the URL in `discover-canada.json`, place it in this directory
under the `file` name the manifest gives, and check the digest:

    sha256sum content/sources/discover-canada-2012-large-print.pdf

If the digest does not match the manifest, **stop**. Either the document changed or you have a
different edition, and in both cases every question verified against the old digest is now
`quarantined` until re-checked. That is the mechanism, not an inconvenience.

## The edition currently cached is out of date, on purpose

Read `discover-canada.json`'s `knownStaleness` before authoring anything. The cached guide is the
2012 large-print edition, and parts of it are no longer true — most obviously the Oath of Citizenship,
which names Queen Elizabeth II and omits the 2021 amendment recognising Aboriginal and treaty rights.

It is cached anyway because it is the edition the study guide has been distributed as, and because
a source that is wrong in a *known, recorded* way is safer than one that is wrong in an unknown way.
Every affected subject is listed in the manifest. A question drawn from those areas must be checked
against the live canada.ca page, not this file.
