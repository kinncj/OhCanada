# ADR-0010: Player-facing text lives with the document that means it

- Status: Accepted (2026-09-08)

## Context

Slice 1 task 1.2 had to settle a question slice 0 recorded and did not answer. `docs/architecture.md` §6
listed it as an open seam in these words: "How a question carries its EN and FR text. Undecided, and it must
be settled by task 1.2 before a question is authored."

The repository argued with itself. `QuestionDocument` declared `promptKey`, `optionKeys` and
`explanationKey`, which puts the wording in a locale bundle. `common.schema.json` defined a `localizedText`
`$def` — `{ en, fr }`, both required — that nothing referenced, which points the other way. ADR-0003's CI
clause is phrased per question ("missing EN or FR text"), which only makes sense if a question *has* text.
Three artefacts, three implied answers, and content authoring (task 1.7) about to start against whichever
one the author happened to read.

Two facts decided it, and neither is about taste.

**The verifier reads one file.** ADR-0003 makes the content-verifier confirm, for one question, that the
answer is entailed by the cited passage, that no distractor is entailed, that the French is a faithful
translation, and that the wording is not verbatim. With keys, that agent opens the question file, then the
EN bundle, then the FR bundle, and joins them by hand across three documents — to check one claim whose
source, hash and evidence live in the first of them. The separation of duties ADR-0003 depends on gets
harder to hold the more files each side has to touch.

**A quarantined question must take its text with it.** ADR-0003 excludes a quarantined question from the
build. With keys, its six strings stay in the shared bundle: loaded on every screen, counted against the
8 MB initial payload, and reported by `validate-content`'s EN/FR parity check as strings that must exist in
both languages — for a question nothing will ever ask. Pruning them is a second, separate mechanism that
would have to agree with the first.

## Decision

- **A content document carries its own player-facing text inline**, as `common.schema.json#/$defs/localizedText`:
  an object with `en` and `fr`, both required, both non-empty. This covers a level title, a landmark name and
  blurb, a quest title and summary, a quest step's prompt, a line of NPC dialogue, a character's display name,
  and a question's prompt, four options and explanation.
- **A locale bundle carries engine and UI vocabulary**, `content/locales/<locale>/<bundle>.json`: menus,
  settings, the rotate overlay, the build-status line, live-region templates, error copy, locomotion mode
  labels, character slot and option labels. Keys are flat and dotted, so one key is spelled exactly one way.
- **The dividing line is reuse, not screen.** Does this string belong to one content document, or is it
  vocabulary many documents share? "Turn your phone upright" belongs to no level. "Skating" is the name of a
  mode eight levels may offer. "The Peace Tower was completed in 1927" belongs to exactly one landmark.
- **A locale bundle may not carry a claim about Canada.** If a string states a fact, it belongs in a content
  document, because that is the only place ADR-0003's `FactClaim` can reach it. This is the one rule here
  that no gate expresses; see Consequences.
- Both mechanisms produce EN and FR from the first commit, and neither is optional. Inline text is complete
  because the schema requires both languages on every value; bundle text is complete because
  `make validate-content` checks EN/FR key parity across the pair of files.

## Alternatives considered

- **Keys everywhere, including questions.** The status quo the port implied, and the tidier-looking answer:
  one string table, one loading path, one place a translator works. Rejected for the two reasons in Context —
  the verifier's join across three files, and the orphaned strings a quarantine leaves behind — plus a third:
  a question bank is loaded per subject and a locale bundle is loaded whole, so putting ten subjects' worth
  of question text in the bundle moves roughly 60 strings per subject onto the initial-payload budget for a
  player who opens one level.
- **Inline everywhere, deleting locale bundles.** Rejected: the rotate overlay and the build-status line
  belong to no content document and would have nowhere to live, "Back" would be duplicated into every
  document that shows it, and changing one word of chrome would become an N-file edit — which is the drift
  this project keeps fixing, pointed the other way.
- **A locale file per question (`content/questions/<id>.en.json`).** Rejected: it doubles the file count and
  re-creates exactly the join it was meant to remove, with the added failure mode of a question whose FR file
  is missing entirely rather than whose FR string is missing.
- **Inline text plus an optional key override, so either works.** Rejected outright. Two mechanisms for the
  same string is how a question ends up with a prompt in one place and a translation in another, and neither
  the schema nor a reviewer can tell which one the game will show.

## Consequences

- `localizedText` stops being an unreferenced definition and becomes the most-referenced shape in
  `content/schemas`. Its `SKIPPED_DEFS` exemption in `tests/unit/contracts/ports-match-schemas.test.ts` is
  deleted, `LocalizedText` is exported from the ports index, and the two sides are compared like any other
  binding — which is the exemption table working as ADR-0007 designed it, failing the moment its reason
  expired.
- EN/FR completeness for content is now enforced by the **schema**, per value, rather than by a parity script
  across two files. A question missing its French prompt fails `make validate-content` on the question file
  itself, naming the field. ADR-0003's "missing EN or FR text" clause becomes structural.
- `app/ui/rotate-overlay.ts` and `app/ui/build-status.ts` carry hardcoded EN/FR copy with a
  `TODO(slice-1): move to content/locales and read through the LocalizerPort`. Both are chrome under this
  decision, so both move to a locale bundle unchanged in meaning, in one change, when task 1.15 wires the
  `LocalizerPort`. Neither becomes a content document.
- `LocaleBundle` gains `$schema` and stops being the shape the adapter assembles: the on-disk file declares
  its own locale. The old port comment said "this is not the on-disk shape … that indirection is exactly what
  a schema would settle", and this is that settlement.
- `LocomotionTuning.labelKey` and `CharacterSlot.labelKey` stay keys, and are the clearest test of the rule:
  they name engine vocabulary a level and a character *use*, rather than text a level or character *owns*.
- **The rule a gate cannot express, stated so its silence is not read as compliance:** nothing mechanical can
  tell whether a sentence in a locale bundle states a fact about Canada. `verify-content` can be pointed at
  every `FactClaim` in the content documents and check each one; it cannot notice a factual claim that was
  written into `ui.json` instead, where no `FactClaim` exists to check. That is held by review and by the
  author agent's brief. It is the reason the dividing line above is stated as a rule about *meaning* and not
  only as a rule about file paths.
