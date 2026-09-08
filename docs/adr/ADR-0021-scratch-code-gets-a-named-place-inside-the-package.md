# ADR-0021: Scratch code gets a named place inside the package

- Status: Accepted (2026-09-08)

## Context

`make lint` runs `eslint .`, so a throwaway probe left at the repository root turns the lint gate red for
everybody. It has happened at least three times in two days — `.tn-composite.mjs`, a coordinator probe, and
two of my own (`.tn-probe.mjs`, `.tn-rigprobe.mjs`) that I deleted before they were noticed. On one occasion
it was red at the same moment a live privacy fix was waiting to ship.

The reason people put them there is **not** carelessness, and getting that wrong is how the wrong fix gets
chosen. A probe of this repository's real behaviour has to import the repository's real dependencies — the
whole point of the pattern this project relies on (ADR-0014: run the *real* authority against the shipped
code). I hit the constraint directly this session: a probe written to the agent scratchpad under `/tmp` failed
with

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'ajv' imported from /tmp/…/probe.mjs
```

Node resolves `node_modules` by walking **up** from the importing file. A scratchpad outside the package
cannot see the package's dependencies, so the probe was copied to the repository root and run there. Every
agent that needs to interrogate ajv, sharp or a build script will rediscover this and make the same move.

So the constraint is real: **a probe must live inside the package tree.** The question is only where.

## Decision

**Scratch code lives in `scratch/` at the repository root. It is gitignored and lint-ignored, and it is the
only place that is.**

- `node_modules` resolves upward from `scratch/`, so `import Ajv2020 from 'ajv/dist/2020.js'` works — the
  constraint is *solved* rather than forbidden.
- One entry in `.gitignore` and one in `eslint.config.js`'s `ignores`, both naming a directory rather than a
  filename pattern.
- The directory is visible in `ls`, so its existence *is* the convention. Nothing has to be remembered from a
  document.

Both files are infra's, so this ADR specifies rather than implements.

- **OBLIGATION due=2026-10-08 owner=infra** — add `scratch/` to `.gitignore` and to `eslint.config.js`'s
  `ignores`, and create `scratch/.gitkeep` so the directory exists in a fresh clone. Until it does, this ADR
  describes a place that is not there and the next probe goes to the root again.

## Alternatives considered

- **An ignore pattern for probe filenames, e.g. `.tn-*.mjs`.** The one-line fix, and it is the one to reject
  carefully because it looks identical in effort. It hides a file *wherever it is*, so a probe left in
  `app/adapters/` is silently unlinted — the ignore is doing the opposite of localising the mess. It also
  encodes a naming convention that nobody is told about: the next agent writes `probe.mjs`, is not covered,
  and breaks lint anyway. A rule that only works if you guessed the prefix is not a rule.
- **A convention forbidding scratch files at the root, with no directory.** ADR-0009's lesson applied: a
  format people route around measures nothing. The reason the files land at the root is a genuine constraint,
  and a ban that does not solve the constraint gets violated by the next agent under time pressure —
  demonstrably, since it has already been violated twice by people who would have agreed with the ban.
- **Use the agent scratchpad under `/tmp`.** The instinctively right answer and it does not work, which is the
  finding worth recording. See the Context: no `node_modules`. It remains correct for scratch *data* —
  fixtures, backups, captured output — and this ADR does not move that. It is only executable probes that
  need the package.
- **Add `scratch/` to `tsconfig.json`'s `exclude` as well.** Unnecessary: `tsconfig.json` lists its
  `include` directories explicitly, so an unlisted directory is already outside `make typecheck`. Adding it
  would be a second statement of a fact already true, and it would go stale silently if `include` changed.
- **Let probes be committed as real tests instead.** Right for anything worth keeping, and wrong as a
  general rule: most probes are one-question throwaways ("does ajv reject this?"), and requiring a probe to
  be test-shaped raises the cost of checking a hunch, which is the behaviour this project most wants to keep
  cheap. Several of this session's findings came from probes that should never have been committed.

## Consequences

- **The lint gate stops being a shared tripwire for private work.** This is the whole benefit and it is worth
  saying plainly: the cost of a stray probe was borne by whoever next ran `make lint`, not by its author.
- **`scratch/` will accumulate junk and nobody will clean it.** Accepted: it is gitignored, so it is
  per-checkout and costs nothing but disk. A tidy-up rule would be a rule nobody follows, which is the
  failure mode this ADR is avoiding elsewhere.
- **Nothing enforces that scratch code goes there.** A probe at the repository root still breaks lint — which
  is, in fact, the enforcement: the failure is immediate, loud, and points at the author's own change. The
  gate that catches this already exists and needs no addition; what was missing was somewhere legitimate to
  put the file.
- **This does not apply to `tests/`.** A file under `tests/` is authored code and is linted like any other. If
  a probe is worth keeping it graduates to a test, and then it is held to the same standard.
