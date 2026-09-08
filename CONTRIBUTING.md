# Contributing

Thanks for helping. This project teaches people facts they will be tested on for citizenship, so accuracy
and accessibility are treated as correctness, not polish.

## Ground rules

- **Questions are verified, not trusted.** Every question is checked against the cited *Discover Canada*
  section on canada.ca before it can ship: the answer must be entailed by the source, each distractor must
  not be, the French must be a faithful translation, and the wording must not be verbatim. A question that
  fails is quarantined and excluded from the build. See `docs/adr/ADR-0003-content-verification.md`.
  Authoring and verification are done by different agents; the author never marks its own work verified.
- **Accessibility is a gate.** Screens are DOM with ARIA roles, keyboard-operable, screen-reader friendly,
  and axe-core clean in CI. Colour is never the only signal. If a change fails the audit, it does not land.
- **Licences.** Code MIT, original art CC BY 4.0, question data CC0. Third-party assets must be CC0 or CC BY
  and listed in `assets/credits.json` with author, licence and source. Only contribute what you may license
  this way.
- **Cultural accuracy.** Indigenous content follows `docs/content-review.md`: name the nation depicted, no
  invented patterns, no sacred items as props, no caricature.

## Reporting a problem with a question

Open an issue using **Question correction**. Give the question `id`, what is wrong, and a source. Corrections
go through the same verifier as new questions.

For art that misrepresents a place, a person or a culture, use **Cultural accuracy**. These are treated as
correctness bugs.

## Working on the code

```
make setup        # install dependencies and browsers
make lint typecheck test
make test-e2e test-a11y
make validate-content verify-content
```

Read `CLAUDE.md` first: it carries the architecture rules, the budgets and the decisions. Changing a decision
means writing an ADR, not editing the table.

Commits: imperative subject, 72 characters or fewer, plain verbs. No attribution trailers.
