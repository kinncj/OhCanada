/**
 * A quest's closing line describes the route, the place and the errand — and
 * says nothing about how the player answered.
 *
 * This is ADR-0052 §4(a), under the filename that ADR's obligation names. The
 * rule it holds is §3, written as a permission rather than a ban:
 *
 * > A `doneLine` may describe where the player went, what the place was, and
 * > that the errand the quest named is finished — in the past tense, in the
 * > giver's own voice.
 *
 * **The defect, from the third live-site audit (2026-09-16).** The Alberta
 * foothills' card read "…and answered every question along the way about
 * Canada's economy." directly above "Right answers in this level: 2 out of 9".
 * Toronto's said the same above 1 out of 8, and the North's said it in French
 * above « Bonnes réponses dans ce niveau : 0 sur 6 ».
 *
 * **Why it survived authoring, verification and two audits: the sentence is
 * true.** The player really did answer every question along the way —
 * "answered" is not "answered rightly". ADR-0003's five checks all pass on it:
 * the passage is found, the claim is entailed, nothing false is asserted. Its
 * defect is not that it is false. It is that it reports a fact and praises by
 * implication in one sentence, and only the second half is wrong. No existing
 * gate and no existing role was looking for that, which is why this file is a
 * gate and not a review note.
 *
 * ## This is not the same gate as `a-closing-line-claims-only-what-was-asked`
 *
 * Both files read `doneLine` and both were born of the same audit, so the
 * distinction is worth stating plainly rather than leaving to whoever next
 * wonders whether one of them is redundant. Neither replaces the other:
 *
 *  - **That one is about arithmetic.** It asks whether a line claiming the
 *    questions *of the place* ("every question left here") is entitled to, by
 *    reading whether the quest's `answer` steps ask their pools out. It says of
 *    itself, correctly, "this gate is not a word filter", and it *permits*
 *    "answered every question along the way" — because that claim is true
 *    whatever a pool holds.
 *  - **This one is about what the sentence is for.** "Answered every question
 *    along the way" is exactly the line the audit photographed above "0 out of
 *    6", and it is refused here no matter what the arithmetic says. A `doneLine`
 *    may not talk about answering at all.
 *
 * ## What this gate does, precisely
 *
 * Every document under `content/quests/`, both languages of `doneLine.text`,
 * reporting **every** offender — not only the first, and not only the three the
 * audit saw — with quest id, field pointer, language and the matched term. The
 * two term families and the matching live in `./done-line-terms.ts`, one module
 * beside this one so a list is never scattered across files; that module's
 * header carries the normalisation, the accent decision and the over-matches.
 *
 * It reads `content/` from disk rather than the bundle, like every other file in
 * this directory: the expectation is computed by a route the game never takes.
 *
 * ## What it does not catch, said out loud so a green suite is not read as
 * coverage (ADR-0019)
 *
 * A warm sentence using none of the listed terms still passes — "You rode the
 * whole ranch and came away knowing it" praises by implication and holds no
 * term here. That rule is the author's, and review of the ten lines; §4(a) names
 * it as a residual rather than hiding it, and so does `done-line-terms.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  type DoneLineFinding,
  FAMILY_NAMES,
  LANGUAGES,
  type Language,
  describeFinding,
  findingsForLine,
  termsFound,
} from './done-line-terms';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Text {
  readonly en: string;
  readonly fr: string;
}
interface QuestFile {
  readonly id: string;
  readonly doneLine?: { readonly text: Text };
}

const json = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const quests: readonly QuestFile[] = readdirSync(`${REPO_ROOT}content/quests`)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => json<QuestFile>(`content/quests/${name}`));

/** Every complaint against every shipped `doneLine`, quest order then en/fr. */
const findingsInShippedContent = (): readonly DoneLineFinding[] =>
  quests.flatMap((quest) => {
    const text = quest.doneLine?.text;
    if (text === undefined) return [];
    return LANGUAGES.flatMap((language) => findingsForLine(quest.id, language, text[language]));
  });

const report = (findings: readonly DoneLineFinding[]): string =>
  findings.map(describeFinding).join('\n');

/**
 * The three lines the audit photographed, quoted word for word from
 * `docs/stories/TN-STANDING-how-i-did-in-a-level.md`'s own table, which is where
 * ADR-0052's Context says both faces of the defect are reproduced verbatim.
 *
 * **Two of the three still ship.** The Alberta foothills' and Toronto's English
 * lines are, at the time this gate was written, byte for byte what
 * `content/quests/` holds. The North's French line is **not**: it was rewritten
 * to « répondu aux questions que chaque halte vous a posées » by the slice that
 * built the arithmetic gate, which removed the "laissées ici" overclaim and left
 * the claim about answering standing. It is kept here anyway, because §4(a)
 * asks for these three as fixtures and a fixture's job is to pin the wording the
 * rule was written against — a gate that stopped refusing the sentence that
 * caused it, because content moved on, would be a gate nobody could check.
 */
const AUDITED_LINES: readonly { readonly what: string; readonly language: Language; readonly line: string }[] =
  [
    {
      what: 'the Alberta foothills, above "Right answers in this level: 2 out of 9"',
      language: 'en',
      line: "You rode across the ranch, from the gate out to the herd, and answered every question along the way about Canada's economy.",
    },
    {
      what: 'Toronto, above "Right answers in this level: 1 out of 8"',
      language: 'en',
      line: 'You rode the whole boulevard, all the way to the big square, and answered every question along the way about voting and ridings.',
    },
    {
      what: 'the North, above « Bonnes réponses dans ce niveau : 0 sur 6 »',
      language: 'fr',
      line: "Vous avez parcouru la plage de galets, du bateau jusqu'au bois flotté, et répondu à toutes les questions laissées ici sur les régions du Canada.",
    },
  ];

describe('a done line describes the route, not how the player answered', () => {
  it('has done lines to judge, so this is about something (ADR-0024)', () => {
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.filter((quest) => quest.doneLine !== undefined).length).toBeGreaterThan(0);
  });

  it('reads both languages of every quest that has a done line', () => {
    /* The count the gate actually walks, asserted rather than assumed: a
       `doneLine` that lost a language, or a quest that stopped being read,
       would otherwise shrink this gate in silence. */
    const withLines = quests.filter((quest) => quest.doneLine !== undefined);
    for (const quest of withLines) {
      for (const language of LANGUAGES) {
        expect(quest.doneLine?.text[language], `${quest.id} ${language}`).toBeTruthy();
      }
    }
    expect(withLines.length).toBe(quests.length);
  });

  it('is kept by every shipped quest, in both languages', () => {
    const findings = findingsInShippedContent();
    expect(findings, `\n${report(findings)}\n`).toEqual([]);
  });

  describe('the three lines the audit found are refused (TN-STANDING-04)', () => {
    for (const { what, language, line } of AUDITED_LINES) {
      it(`refuses ${what}`, () => {
        const findings = findingsForLine('audited-fixture', language, line);
        expect(findings.length, line).toBeGreaterThan(0);

        const [first] = findings;
        expect(first?.family).toBe('answering');
        expect(first?.pointer).toBe(`/doneLine/text/${language}`);
        expect(first?.language).toBe(language);
        expect(first?.terms.length).toBeGreaterThan(0);
      });
    }

    it('names the quest, the pointer, the language and the term it matched', () => {
      const [alberta] = AUDITED_LINES;
      const findings = findingsForLine('alberta-foothills-ranch-barn', 'en', alberta?.line ?? '');
      const message = findings.map(describeFinding).join('\n');

      expect(message).toContain('alberta-foothills-ranch-barn');
      expect(message).toContain('/doneLine/text/en');
      expect(message).toContain('(en)');
      expect(message).toContain('answered');
    });
  });

  describe('the rule is about answering, not about warmth (TN-STANDING-04)', () => {
    const route = 'You rode across the ranch, from the gate out to the herd.';

    it('passes a line that only says where the player went', () => {
      expect(findingsForLine('a-quest', 'en', route)).toEqual([]);
    });

    it('fails the same line once it adds a claim about answering', () => {
      for (const tail of [
        'and got them all right',
        'and answered every question',
        "and learned a lot about Canada's economy",
      ]) {
        const line = `${route.replace(/\.$/, '')}, ${tail}.`;
        expect(findingsForLine('a-quest', 'en', line), line).not.toEqual([]);
      }
    });

    it('passes "Task done!", which names what finished and not how it went', () => {
      expect(findingsForLine('a-quest', 'en', 'Task done!')).toEqual([]);
      expect(findingsForLine('a-quest', 'fr', 'Tâche terminée !')).toEqual([]);
    });
  });

  describe('both families are live, in both languages', () => {
    it('catches praise that claims nothing about answers', () => {
      expect(termsFound('You walked the harbour. Well done!', 'praise', 'en')).toContain('well done');
      expect(termsFound('Vous avez longé la rivière. Bravo !', 'praise', 'fr')).toContain('bravo');
    });

    it('treats a term of one language as no term of the other', () => {
      /* "Great" is English praise and not French; « bravo » is French praise and
         is not on the English list. A family in one language is not a family in
         the other, so neither line may be caught by the wrong list. */
      expect(termsFound('A great walk.', 'praise', 'en')).toContain('great');
      expect(termsFound('A great walk.', 'praise', 'fr')).toEqual([]);
      expect(termsFound('Bravo !', 'praise', 'fr')).toContain('bravo');
      expect(termsFound('Bravo !', 'praise', 'en')).toEqual([]);
    });

    it('matches on word boundaries, so a longer word is not a term', () => {
      expect(termsFound('The plan was questionable.', 'answering', 'en')).toEqual([]);
      expect(termsFound('You answered a question.', 'answering', 'en')).toEqual([
        'answered',
        'question',
      ]);
    });

    it('does not fire on "rights and responsibilities", which is a subject name', () => {
      const line = 'You walked the harbour down to the tug, at the water’s edge.';
      expect(findingsForLine('a-quest', 'en', `${line.replace(/\.$/, '')}, past the rights office.`)).toEqual(
        [],
      );
    });

    it('reaches all four French forms §4(a) names, across both its stems', () => {
      /* §4(a) now names both stems, `répond*` and `répons*`. It originally
         wrote one, `répond*`, and named `réponse` and `réponses` among its
         forms — which that stem cannot reach, because those two are spelled
         with an `s` where `répondu` has a `d`. Both stems have always been
         carried here, so the four forms the ADR asks for are the four that
         fire. Asserted per form: a loop over a single stem is how the gap got
         past the ADR in the first place. */
      expect(termsFound('Vous avez répondu ici.', 'answering', 'fr')).toContain('répond*');
      expect(termsFound('Répondez ici.', 'answering', 'fr')).toContain('répond*');
      expect(termsFound('Une réponse ici.', 'answering', 'fr')).toContain('répons*');
      expect(termsFound('Des réponses ici.', 'answering', 'fr')).toContain('répons*');
    });

    it('keeps French accents significant, which is a decision and not an accident', () => {
      /* `done-line-terms.ts` folds case, punctuation and spacing but not
         diacritics, because §4(a) says accents are significant. Asserted so the
         residual is on the record and nobody later "fixes" it by accident. */
      expect(termsFound('Vous avez repondu ici.', 'answering', 'fr')).toEqual([]);
    });

    it('folds case and punctuation, so neither can smuggle a term past it', () => {
      expect(termsFound('ANSWERED  every   QUESTION.', 'answering', 'en')).toContain('answered');
      expect(termsFound('You “answered” it.', 'answering', 'en')).toContain('answered');
    });

    it('exercises every family this gate declares', () => {
      /* If a family were added to the module and never applied here, the list
         would grow while the gate stayed the same size. */
      expect([...FAMILY_NAMES]).toEqual(['answering', 'praise']);
      expect([...LANGUAGES]).toEqual(['en', 'fr']);
    });
  });
});
