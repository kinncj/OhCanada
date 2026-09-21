/**
 * The two term families ADR-0052 §4(a) names, and the matching it specifies.
 *
 * This is the "one module beside the gate" the obligation asks for, and it sits
 * beside `a-done-line-describes-the-route.test.ts` rather than in
 * `tests/unit/support/` for the reason §4(a) gives: *"so a list is never
 * scattered across files"*. A reader who opens the gate finds the words it
 * judges by one directory entry away, and a word added here cannot drift from
 * the test that applies it.
 *
 * It is a plain `.ts` and not a `.test.ts`, so `vitest.config.ts`'s
 * `include: ['tests/unit/**\/*.test.ts']` does not collect it as a suite.
 *
 * It imports nothing from `app/`. That is deliberate and is explained under
 * "Normalisation" below.
 *
 * ## What the rule is
 *
 * ADR-0052 §3, stated as a permission rather than a ban:
 *
 * > A `doneLine` may describe where the player went, what the place was, and
 * > that the errand the quest named is finished — in the past tense, in the
 * > giver's own voice.
 *
 * So it says nothing about answering: not that questions were answered, not how
 * many, not how well, not what was learned, and no praise for any of it. The
 * reason is not style. The completion card's two counting rows are recomputed on
 * every showing; a sentence written months ago in a content document cannot be,
 * so any claim about answers authored ahead of time is a claim about a player
 * who has not played yet.
 *
 * ## Normalisation, and the one place this departs from `proposition.ts`
 *
 * §4(a) asks for "the normalisation the proposition gate already uses
 * (`app/application/content/proposition.ts`), so casing and spacing cannot
 * smuggle a term past it" — and then, in the same breath, "French accents are
 * significant and are not stripped."
 *
 * Those two sentences cannot both be obeyed by calling `normaliseQuote`:
 * that function's second line is `.replace(/\p{Diacritic}/gu, '')`, which strips
 * exactly what the next sentence says to keep. The second sentence wins, because
 * it is the specific carve-out and the first is naming the properties it cares
 * about — *casing and spacing*. So `normaliseDoneLine` below is `normaliseQuote`
 * minus the diacritic fold, and this module holds its own copy rather than
 * importing a function whose behaviour it would then have to undo.
 *
 * **The residual that creates, recorded rather than left to be discovered
 * (ADR-0019):** an unaccented `repondu` or `felicitations` is a different string
 * from `répondu` and `félicitations` and is *not* matched. Stripping accents
 * would catch strictly more, and §4(a) chose precision in the French list over
 * that. A line that reaches the shipped content with its accents missing has a
 * bigger problem than this gate.
 *
 * `toLowerCase` rather than `toLocaleLowerCase`: a gate must fold the same way
 * on every machine that runs it, and the locale-sensitive form reads the host's
 * locale. For the Latin text in these files the two agree.
 *
 * ## What these families do not catch
 *
 * §4(a) is explicit that this is a tripwire on the machine-visible failure and
 * not the whole of §3, and the ADR would rather say so than let a passing suite
 * imply coverage:
 *
 *  - **A warm sentence using none of these words still passes.** *"You rode the
 *    whole ranch and came away knowing it"* holds no term here and praises by
 *    implication, which is precisely the defect class. That rule is held by the
 *    author's brief and by review of the ten lines — not here, and explicitly
 *    **not** by a verifier, whose five ADR-0003 checks are about truth and none
 *    of which reads tone.
 *  - **Implication is a judgement, and no string identifies a paraphrase**
 *    (ADR-0028 §4).
 *  - **Some terms over-match, and the list is still the ADR's.** EN `right` is
 *    also a direction (*"you walked right up to the door"*) and EN `test` is
 *    also a trial. A `doneLine` has no business containing either word under
 *    §3's permission, so the over-match costs an author a rewording and never a
 *    false green — which is the direction a tripwire should err in.
 */

/** How a term is looked for once both it and the line are normalised. */
export type TermMatch = 'word' | 'prefix';

/** One entry in a family: what to look for, and what to print when it is found. */
export interface Term {
  /** What the failure message names, e.g. `question` or `répond*`. */
  readonly label: string;
  /** The normalised form actually compared against the line. */
  readonly needle: string;
  readonly match: TermMatch;
}

/** The two languages every `doneLine` carries. */
export type Language = 'en' | 'fr';

/** The two families §4(a) names. A family in one language is not one in the other. */
export type FamilyName = 'answering' | 'praise';

/**
 * Case, punctuation and whitespace folded; accents kept.
 *
 * `normaliseQuote`'s folding minus its diacritic strip — see the header. The
 * result is a single-spaced run of letters and numbers, which is what makes the
 * word-boundary test below a plain substring test on a padded string.
 */
export const normaliseDoneLine = (text: string): string =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();

const word = (label: string): Term => ({
  label,
  needle: normaliseDoneLine(label),
  match: 'word',
});

const prefix = (label: string): Term => ({
  label: `${label}*`,
  needle: normaliseDoneLine(label),
  match: 'prefix',
});

/**
 * *Answering* — the family the audit actually found, in both languages.
 *
 * Every member is §4(a)'s, in §4(a)'s order, with one correction.
 *
 * **§4(a)'s French stem is misspelled, and the fix is recorded rather than
 * silently widened.** The ADR writes the stem as `répond*` and then names four
 * forms under it — `répondu`, `répondez`, `réponse`, `réponses`. The last two
 * cannot be reached by that stem: *réponse* is spelled with an `s` where
 * *répondu* has a `d`, so `répond` is not a prefix of it. Carrying the ADR's
 * spelling alone would have shipped a family that silently missed the two
 * noun forms — the very forms *bonnes réponses* is built from. So **both stems
 * are carried**, `répond*` and `répons*`, which is exactly the set of four forms
 * the ADR asked for. A single wider `répon*` would cover the same French words
 * and was not used: it claims more than the ADR decided.
 *
 * The rest are whole words, so EN `right` does not fire on *rights and
 * responsibilities*, which is a subject name and not a claim about how the
 * player did.
 *
 * `bonne réponse` / `bonnes réponses` are kept even though `répons*` now reaches
 * both: when a line says *bonnes réponses* the report should name the phrase
 * that makes it a claim about correctness, not just the noun stem.
 */
const ANSWERING: Readonly<Record<Language, readonly Term[]>> = {
  en: [
    word('answer'),
    word('answered'),
    word('answering'),
    word('question'),
    word('questions'),
    word('right'),
    word('correct'),
    word('wrong'),
    word('learn'),
    word('learned'),
    word('quiz'),
    word('score'),
    word('test'),
  ],
  fr: [
    prefix('répond'),
    prefix('répons'),
    word('question'),
    word('questions'),
    word('bonne réponse'),
    word('bonnes réponses'),
    word('appris'),
    word('juste'),
    word('exact'),
  ],
};

/**
 * *Praise* — no shipped line has ever held one of these, and that is the point.
 *
 * The audit's defect praised by implication while using none of them, so this
 * family guards the shape the *next* author reaches for once the answering
 * family is closed off. `TN-STANDING-01`'s second scenario asks for exactly
 * this: "no sentence on the card contains 'well done', 'great', 'perfect' or
 * 'nice work'".
 *
 * `excellent` is a member of both languages' lists and is not shared between
 * them: it is an English word matched against `en` and a French word matched
 * against `fr`, and either list could lose it without touching the other.
 */
const PRAISE: Readonly<Record<Language, readonly Term[]>> = {
  en: [
    word('well done'),
    word('great'),
    word('perfect'),
    word('nice work'),
    word('proud'),
    word('excellent'),
    word('amazing'),
  ],
  fr: [
    word('bravo'),
    word('parfait'),
    word('excellent'),
    word('félicitations'),
    word('fier'),
    word('fière'),
  ],
};

/** Both families, by name, so a caller can report which one fired. */
export const TERM_FAMILIES: Readonly<Record<FamilyName, Readonly<Record<Language, readonly Term[]>>>> =
  {
    answering: ANSWERING,
    praise: PRAISE,
  };

/** Every family name, for tests that must show each one is exercised. */
export const FAMILY_NAMES: readonly FamilyName[] = ['answering', 'praise'];

/** Every language a `doneLine` carries, in report order. */
export const LANGUAGES: readonly Language[] = ['en', 'fr'];

/**
 * Does the normalised line hold this term on word boundaries?
 *
 * The line is padded with single spaces and the needle is looked for with its
 * own spaces around it, so `question` does not fire inside `questionable` and a
 * multi-word phrase like `well done` has to appear as consecutive words.
 * A prefix term tests each whole token's start instead, which is how `répond*`
 * reaches `répondu` and `réponses` without reaching a word that merely contains
 * those letters in the middle.
 */
const holdsTerm = (normalisedLine: string, term: Term): boolean => {
  if (term.needle === '') return false;
  if (term.match === 'prefix') {
    return normalisedLine.split(' ').some((token) => token.startsWith(term.needle));
  }
  return ` ${normalisedLine} `.includes(` ${term.needle} `);
};

/** One family's hits in one line, in the family's own order. */
export const termsFound = (line: string, family: FamilyName, language: Language): readonly string[] => {
  const normalised = normaliseDoneLine(line);
  return TERM_FAMILIES[family][language]
    .filter((term) => holdsTerm(normalised, term))
    .map((term) => term.label);
};

/** What a `doneLine` claimed that §3 does not permit it to claim. */
export interface DoneLineFinding {
  readonly questId: string;
  /** JSON pointer into the quest document, e.g. `/doneLine/text/fr`. */
  readonly pointer: string;
  readonly language: Language;
  readonly family: FamilyName;
  /** Every term of that family the line holds — not only the first. */
  readonly terms: readonly string[];
  readonly line: string;
}

/**
 * Every finding against one `doneLine`, both families, one language.
 *
 * Returns one finding per family that fired, each naming every term it matched,
 * because "the term matched" in §4(a) is what tells an author which word to
 * change and half a list would send them back for the rest.
 */
export const findingsForLine = (
  questId: string,
  language: Language,
  line: string,
): readonly DoneLineFinding[] =>
  FAMILY_NAMES.flatMap((family) => {
    const terms = termsFound(line, family, language);
    if (terms.length === 0) return [];
    return [
      {
        questId,
        pointer: `/doneLine/text/${language}`,
        language,
        family,
        terms,
        line,
      },
    ];
  });

/** The sentence a finding prints, naming quest, pointer, language and terms. */
export const describeFinding = (finding: DoneLineFinding): string =>
  `${finding.questId} ${finding.pointer} (${finding.language}) — ` +
  `${finding.family}: ${finding.terms.join(', ')}\n` +
  `    "${finding.line}"\n` +
  '    A done line describes where the player went, what the place was, and that the errand is ' +
  'finished — not how the player answered (ADR-0052 §3).';
