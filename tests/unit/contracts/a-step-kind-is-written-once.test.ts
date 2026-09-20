/**
 * A STEP KIND IS SPELLED ONE WAY, AND THE LOADER KNOWS EVERY KIND THE SCHEMA
 * PERMITS. ADR-0063's engine obligation, ADR-0024.
 *
 * The defect this exists for is recorded in ADR-0063 rather than guessed at. The
 * step-kind vocabulary is stated four times — `quest.schema.json`'s `enum`, the
 * union on `QuestStepDocument`, `QuestStepKind` in `app/domain`, and the runtime
 * list in `app/bootstrap/quests.ts` — and when `read` was added, only the first
 * two moved. `ports-match-schemas.test.ts` compares those two in both
 * directions; **nothing compared either to the other two.** The result was a
 * document the repository accepts and the artefact refuses, with a message
 * naming four kinds out of five.
 *
 * That is the safe direction — a `read` step authored early is rejected loudly
 * rather than drawn as a blank — but it is not a state to leave a build in, and
 * it is not a state anything would have reported. So:
 *
 *  - **schema ↔ port** is held by `ports-match-schemas.test.ts` (both ways).
 *  - **port ↔ domain** is held by `entities-mirror-ports.test.ts`, as two
 *    identity functions in opposite directions.
 *  - **schema ↔ the loader's runtime list** is held *here*, at run time, because
 *    that link is the one a type cannot hold: `STEP_KINDS` is a value, and the
 *    schema is a JSON file nothing typechecks against.
 *
 * `STEP_KINDS` is derived in `app/bootstrap/quests.ts` from a `Record` keyed by
 * the port's own union, so the compiler already refuses a table that is missing
 * a kind or invents one. This file is what catches the remaining gap: a kind
 * that reaches the port and the table but never reached the schema, or the
 * reverse.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STEP_KINDS, readQuest } from '../../../app/bootstrap/quests';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface QuestSchema {
  readonly $defs: {
    readonly questStep: {
      readonly properties: {
        readonly kind: { readonly enum: readonly string[] };
      };
    };
  };
}

const schema = JSON.parse(
  readFileSync(`${REPO_ROOT}content/schemas/quest.schema.json`, 'utf8'),
) as QuestSchema;

const schemaKinds = schema.$defs.questStep.properties.kind.enum;

describe('the step-kind vocabulary is one vocabulary', () => {
  it('is judging a real enum, not an empty one (ADR-0024)', () => {
    // Every assertion below is a set comparison, and two empty sets are equal.
    // If the schema is ever reshaped so this lookup lands on nothing, the
    // comparisons would all pass while checking nothing at all.
    expect(schemaKinds.length).toBeGreaterThan(0);
    expect(STEP_KINDS.length).toBeGreaterThan(0);
  });

  it('accepts exactly the kinds content/schemas/quest.schema.json permits', () => {
    expect([...STEP_KINDS].sort(), 'the loader and the schema disagree about what a step may be').toEqual(
      [...schemaKinds].sort(),
    );
  });

  it('knows `read`, the kind ADR-0063 added', () => {
    /*
     * Named rather than left to the set comparison. This is the exact pair that
     * was out of step: `read` in the schema and the port, absent from the
     * loader's list, so an authored `read` step failed to load with a message
     * that did not mention `read` at all.
     */
    expect(schemaKinds).toContain('read');
    expect(STEP_KINDS).toContain('read');
  });

  it('names every kind it accepts when it refuses one it does not', () => {
    /*
     * The message is part of the contract. A developer who writes `kind: "dance"`
     * is told what the alternatives are, and if that sentence is built from a
     * different list than the one being checked against, it is a lie that reads
     * like help. `STEP_KINDS` is the only list, so the message is the check.
     */
    const refused = readQuest(
      {
        $schema: 'https://truenorth.app/schemas/quest.schema.json',
        id: 'quest.somewhere.a-job',
        levelId: 'somewhere',
        giver: 'officer',
        title: { en: 'A job', fr: 'Une mission' },
        summary: { en: 'Do the thing.', fr: 'Faites la chose.' },
        steps: [
          {
            id: 'step',
            kind: 'dance',
            targetId: 'officer',
            prompt: { en: 'Dance', fr: 'Dansez' },
          },
        ],
      },
      'fixture',
    );

    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    for (const kind of schemaKinds) expect(refused.error.message).toContain(kind);
  });
});
