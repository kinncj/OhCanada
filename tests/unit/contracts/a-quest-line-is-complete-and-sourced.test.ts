/**
 * A quest giver's line, once it exists, is complete and sourced — TN-DIALOGUE-03.
 *
 * `quest.schema.json` gained four fields for the four moments a step could not
 * speak for: `declinedLine`, `reminderLine`, `afterLine` and `doneLine`
 * (ADR-0010, amended). Each is optional, because silence is a legal answer to a
 * decline. What is not optional is what a line that *is* there must carry, and
 * TN-DIALOGUE-03 was written as the acceptance for exactly that — pending, until
 * the fields existed. They exist; this is the gate, and its last scenario asks
 * for it in this form:
 *
 * > Then a fixture exists for each scenario above / And each is asserted to fail
 * > / And a change that makes any of them pass fails this suite.
 *
 * So every case below takes a **real shipped quest document**, adds one line to
 * it, and asserts what ajv does with it — against
 * `content/schemas/quest.schema.json` itself, compiled the way
 * `scripts/validate-content.mjs` compiles it.
 *
 * **Two of the four scenarios are structural and are held here; the third is
 * not, and saying so is the point of this paragraph.** Both languages
 * (`localizedText` requires `en` and `fr`) and a sourced, verified claim
 * (`factClaim` requires source and verification when `factual` is true) are
 * schema rules and fail on the quest file itself. *A line whose speaker the level
 * does not place* is a cross-document check between `content/quests/` and
 * `content/levels/`, which `validate-content` cannot make while it walks each
 * document against its own schema alone. It is written down as an obligation on
 * ADR-0010 rather than implied by this file's silence.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const QUESTS = `${REPO_ROOT}content/quests`;

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const schemaFile = (name: string): object =>
  JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/${name}`, 'utf8')) as object;
ajv.addSchema(schemaFile('common.schema.json'));
const validate = ajv.compile(schemaFile('quest.schema.json'));

type Json = Record<string, unknown>;

const questFiles = readdirSync(QUESTS).filter((name) => name.endsWith('.json'));

/** A real shipped quest, parsed fresh so a case cannot leak into the next. */
const aQuest = (): Json =>
  JSON.parse(readFileSync(`${QUESTS}/ottawa-parliament-hill.json`, 'utf8')) as Json;

const accepts = (document: unknown): boolean => validate(document) === true;
const errorsOn = (document: unknown): string => {
  validate(document);
  return JSON.stringify(validate.errors ?? []);
};

/** The line a shipped quest would carry: flavour, both languages, no claim. */
const flavourLine = (): Json => ({
  speaker: 'officer',
  text: { en: 'No problem. Come back when you are ready.', fr: 'Pas de souci. Revenez quand vous voulez.' },
  fact: { factual: false, source: null, verification: null },
});

const withLine = (field: string, line: unknown): Json => ({ ...aQuest(), [field]: line });

const FIELDS = ['declinedLine', 'reminderLine', 'afterLine', 'doneLine'] as const;

describe('what a quest giver says is a quest document field, and it is gated', () => {
  it('is judging real documents that pass today', () => {
    expect(questFiles.length).toBeGreaterThan(0);
    for (const file of questFiles) {
      const document = JSON.parse(readFileSync(`${QUESTS}/${file}`, 'utf8')) as Json;
      expect(accepts(document), `${file}: ${errorsOn(document)}`).toBe(true);
    }
  });

  it('accepts each of the four moments when the line is complete', () => {
    for (const field of FIELDS) {
      expect(accepts(withLine(field, flavourLine())), `${field}: ${errorsOn(withLine(field, flavourLine()))}`).toBe(
        true,
      );
    }
  });

  it('keeps silence legal: a quest with no line for a moment is still a quest', () => {
    // The whole reason the fields are optional. A quest that says nothing when
    // the player declines must not be a build failure, or every quest acquires
    // four lines written to satisfy a validator (TN-DIALOGUE-02).
    expect(accepts(aQuest())).toBe(true);
  });

  it('fails a line that exists in one language and not the other', () => {
    for (const field of FIELDS) {
      const half = withLine(field, {
        ...flavourLine(),
        text: { en: 'Come back when you are ready.' },
      });
      expect(accepts(half)).toBe(false);
      expect(errorsOn(half)).toContain(field);
      expect(errorsOn(half)).toContain('fr');
    }
  });

  it('fails a line whose French is present and empty, which is not a translation', () => {
    const blank = withLine('reminderLine', {
      ...flavourLine(),
      text: { en: 'Parliament Hill is that way.', fr: '' },
    });
    expect(accepts(blank)).toBe(false);
  });

  it('fails a claim in a giver\'s mouth that is not sourced and verified', () => {
    // ADR-0003, unchanged, reaching a line of dialogue: a wrong claim in an
    // NPC's mouth is exactly as wrong as one on a question card. This is the
    // reason these lines are content and not copy rows — a copy table row has
    // nowhere to put a source (ADR-0010).
    const unsourced = withLine('afterLine', {
      ...flavourLine(),
      text: { en: 'Ottawa is the capital of Canada.', fr: 'Ottawa est la capitale du Canada.' },
      fact: { factual: true, source: null, verification: null },
    });
    expect(accepts(unsourced)).toBe(false);
    expect(errorsOn(unsourced)).toContain('afterLine');
  });

  it('fails a line with no `fact` declaration at all', () => {
    // Required rather than optional, so the judgement "this states a fact" is
    // recorded for every line instead of defaulting to unchecked.
    const { fact: _dropped, ...noClaim } = flavourLine();
    expect(accepts(withLine('doneLine', noClaim))).toBe(false);
  });

  it('fails a line with no speaker, and refuses a field the schema does not declare', () => {
    const { speaker: _dropped, ...anonymous } = flavourLine();
    expect(accepts(withLine('declinedLine', anonymous))).toBe(false);
    // `additionalProperties: false` stays: a fifth moment is declared or it does
    // not exist, so a typo cannot become a line nothing draws.
    expect(accepts(withLine('afterStampLine', flavourLine()))).toBe(false);
    expect(accepts(withLine('reminderLines', [flavourLine()]))).toBe(false);
  });

  it('takes one line per moment, not a list of them', () => {
    // A step carries `dialogue[]`, a moment carries one line. If a moment ever
    // needs several, that is a schema change and an argument, not an author
    // discovering an array works.
    expect(accepts(withLine('reminderLine', [flavourLine()]))).toBe(false);
  });
});
