/**
 * A quest's moment lines — `declinedLine`, `reminderLine`, `afterLine`,
 * `doneLine` — reach a player only if a verifier granted them, and the two
 * silences read differently. The mutation half.
 *
 * `every-moment-line-reaches-the-player.test.ts` walks the shipped documents,
 * and on the day this was written every moment line in them is granted — which
 * is exactly why this file synthesises its own. A corpus with nothing refused
 * cannot show a refusal working. Everything here is one document, one field
 * flipped, both sides asserted.
 *
 * What it holds, in the order `TN-DIALOGUE` states it:
 *
 *  1. **The same line, one word apart.** Granted, it is said at its moment in its
 *     speaker's name. Declined, nothing opens, no word of it is on the page, and
 *     the console names the pointer and the status.
 *  2. **Two silences.** A moment the document never wrote and a moment whose line
 *     was refused both open nothing, and are different words (`no-line`,
 *     `unverified`), different census numbers and different console output.
 *  3. **Each moment's behaviour.** "Not now" is answered and the offer stays;
 *     the reminder is said instead of the step prompt and never beside it; the
 *     after-line is said every time; the card line follows the route.
 *  4. **A landmark speaks its moment lines in its own name, with no face.**
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  completionLine,
  createQuestController,
  momentSpeech,
  type QuestController,
} from '../../../app/bootstrap/quest';
import { readQuest } from '../../../app/bootstrap/quests';
import {
  adjudicateQuest,
  createDialogueLedger,
  describeDialogueCensus,
  momentVerdict,
  QUEST_MOMENTS,
  type DialogueCensus,
  type QuestMoment,
  type SpokenQuest,
} from '../../../app/bootstrap/verified-dialogue';
import type { LevelPlacements } from '../../../app/bootstrap/engageables';
import { questStateFor, withQuestState, type Progress } from '@domain/entities/progress';
import type { LevelId, QuestId } from '@domain/ids';
import { createSettingsStore } from '@ui/settings';

import { buildPage, type FakePage } from '../ui/support/fake-dom';
import {
  brandId,
  declinedFact,
  emptyProgress,
  flavourFact,
  grantedFact,
  ORIGIN,
  testClock,
  text as localised,
} from '../support/fixtures';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/* ---------------------------------------------------------- the documents --- */

const GUIDE = 'guide';
const LIGHT = 'harbour-light';
const LIGHT_NAME = localised('The harbour light', 'Le feu du port');

const GUIDE_NAME = (
  JSON.parse(readFileSync(`${REPO_ROOT}content/characters/guide.json`, 'utf8')) as {
    readonly name: { readonly en: string; readonly fr: string };
  }
).name;

const PLACEMENTS: LevelPlacements = {
  characters: [{ characterId: GUIDE }],
  pois: [
    {
      id: LIGHT,
      name: LIGHT_NAME,
      blurb: localised('A true, short thing.', 'Une chose vraie et courte.'),
    },
  ],
};

const QUEST_ID = 'alberta-foothills-ranch-gate';

const WORDS: Readonly<Record<QuestMoment, string>> = {
  declinedLine: 'That is fine. Come and find me when you want to ride.',
  reminderLine: 'Keep riding along the fence. The gate comes first.',
  afterLine: 'Alberta has the most beef cattle in Canada.',
  doneLine: 'You rode out to the gate and answered everything I asked.',
};

const OFFER = 'Come and see the ranch.';
const PROMPT = 'Answer 2 questions about the economy';
const SUMMARY = 'Ride out to the gate and answer two questions.';

type Fact = Record<string, unknown> | 'absent';

/**
 * A quest whose moments carry the given `fact` blocks, spoken by `speaker`.
 *
 * Everything but the four `fact` blocks is held constant, so the only thing that
 * differs between two halves of an assertion is one word inside one block.
 */
function questWith(
  facts: Partial<Record<QuestMoment, Fact>>,
  speaker: string = GUIDE,
  giver: string = GUIDE,
): Record<string, unknown> {
  const moments = Object.fromEntries(
    QUEST_MOMENTS.flatMap((moment) => {
      const fact = facts[moment] ?? 'absent';
      return fact === 'absent'
        ? []
        : [[moment, { speaker, text: { en: WORDS[moment], fr: `${WORDS[moment]} (fr)` }, fact }]];
    }),
  );
  return {
    id: QUEST_ID,
    levelId: 'alberta-foothills',
    giver,
    title: { en: 'Ride out to the gate', fr: 'Allez jusqu’à la barrière' },
    summary: { en: SUMMARY, fr: `${SUMMARY} (fr)` },
    steps: [
      {
        id: 'meet',
        kind: 'talk',
        targetId: giver,
        prompt: { en: 'Talk to the guide', fr: 'Parlez au guide' },
        dialogue: [{ speaker, text: { en: OFFER, fr: `${OFFER} (fr)` }, fact: flavourFact() }],
      },
      {
        id: 'answer',
        kind: 'answer',
        targetId: 'economy',
        prompt: { en: PROMPT, fr: `${PROMPT} (fr)` },
        subject: 'economy',
        count: 2,
      },
    ],
    ...moments,
  };
}

const everyMoment = (fact: Fact): Partial<Record<QuestMoment, Fact>> =>
  Object.fromEntries(QUEST_MOMENTS.map((moment) => [moment, fact]));

function adjudicate(raw: Record<string, unknown>): {
  readonly quest: SpokenQuest;
  readonly census: DialogueCensus;
} {
  const read = readQuest(raw, 'fixture');
  if (!read.ok) throw new Error(`fixture did not load: ${read.error.message}`);
  const ledger = createDialogueLedger();
  const spoken = adjudicateQuest(read.value, ledger, String(read.value.id));
  if (!spoken.ok) throw new Error(`fixture was not adjudicable: ${spoken.error.message}`);
  return { quest: spoken.value, census: ledger.census };
}

/* ------------------------------------------------------------ the harness --- */

type State = 'on-offer' | 'active' | 'completed';

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
  readonly progress: () => Progress;
  readonly opened: () => number;
  readonly closed: () => number;
  readonly focusReturns: () => number;
}

function harnessFor(
  quest: SpokenQuest,
  state: State,
  placements: LevelPlacements = PLACEMENTS,
): Harness {
  const page = buildPage();
  let progress: Progress =
    state === 'on-offer'
      ? emptyProgress()
      : withQuestState(emptyProgress(), quest.levelId, {
          questId: quest.id,
          status: state,
          stepIndex: 1,
          stepProgress: 0,
          updatedAt: ORIGIN,
        });
  let opens = 0;
  let closes = 0;
  let focus = 0;

  const controller = createQuestController({
    levelId: quest.levelId,
    quests: [quest],
    placements: () => placements,
    host: page.host,
    store: createSettingsStore(),
    clock: testClock(),
    announce: vi.fn(),
    progress: () => progress,
    commit: (next) => {
      progress = next;
    },
    setTask: vi.fn(),
    onOpen: () => {
      opens += 1;
    },
    onClose: () => {
      closes += 1;
    },
    onCompleted: vi.fn(),
    restoreFocusTo: () => {
      focus += 1;
      return null;
    },
  });

  return {
    page,
    controller,
    progress: () => progress,
    opened: () => opens,
    closed: () => closes,
    focusReturns: () => focus,
  };
}

const dialogOpen = (page: FakePage): boolean => {
  const dialog = page.doc.byTestId('dialogue');
  return dialog !== null && !dialog.hidden;
};

const body = (page: FakePage): string =>
  dialogOpen(page) ? (page.doc.byTestId('dialogue-text')?.textContent ?? '') : '';

const speakerOf = (page: FakePage): string => {
  const dialog = page.doc.byTestId('dialogue');
  if (dialog === null || dialog.hidden) return '';
  return page.doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? '';
};

/** Run, and hand back what went to `console.error` while it ran. */
function consoleDuring(run: () => void): string {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    run();
    return spy.mock.calls.map((call) => String(call[0])).join('\n');
  } finally {
    spy.mockRestore();
  }
}

/** Reach a moment the way a player does, from the state it belongs to. */
function reach(moment: Exclude<QuestMoment, 'doneLine'>, facts: Partial<Record<QuestMoment, Fact>>) {
  const { quest } = adjudicate(questWith(facts));
  const state: State =
    moment === 'declinedLine' ? 'on-offer' : moment === 'reminderLine' ? 'active' : 'completed';
  const harness = harnessFor(quest, state);
  const said = consoleDuring(() => {
    harness.controller.engage(GUIDE);
    if (moment === 'declinedLine') harness.page.doc.byTestId('dialogue-decline')?.click();
  });
  return { ...harness, said };
}

const SPOKEN_MOMENTS = ['declinedLine', 'reminderLine', 'afterLine'] as const;

/* ------------------------------------------------------ 1. the mutation --- */

describe('each moment line, one word apart', () => {
  for (const moment of SPOKEN_MOMENTS) {
    it(`${moment}: is said when the verifier granted it and silent when the verifier declined it`, () => {
      /* Both halves in one `it`: a filter that silenced everything fails the
         first, one that silenced nothing fails the second. */
      const granted = reach(moment, { [moment]: grantedFact() });
      expect(body(granted.page)).toBe(WORDS[moment]);
      expect(speakerOf(granted.page)).toBe(GUIDE_NAME.en);
      expect(granted.said).toBe('');

      const declined = reach(moment, { [moment]: declinedFact() });
      expect(dialogOpen(declined.page), 'a declined line opened a dialog').toBe(false);
      expect(declined.page.host.textContent ?? '').not.toContain(WORDS[moment]);
      expect(declined.said).toContain(`${QUEST_ID}#/${moment}/0`);
      expect(declined.said).toContain('rejected');
      expect(declined.said).toContain('ADR-0003');
    });
  }

  it('doneLine: is the card’s line when granted and absent from it when declined', () => {
    const granted = completionLine({ by: 'quest', quest: adjudicate(questWith({ doneLine: grantedFact() })).quest });
    expect(granted.said).toBe('spoken');
    expect(granted.said === 'spoken' && granted.text.en).toBe(WORDS.doneLine);

    const declined = completionLine({ by: 'quest', quest: adjudicate(questWith({ doneLine: declinedFact() })).quest });
    expect(declined.said).toBe('unverified');
    expect(declined.said === 'unverified' && declined.silenced.pointer).toBe(`${QUEST_ID}#/doneLine`);
  });

  it('is silent for every status that is not "verified"', () => {
    for (const status of ['unverified', 'quarantined', 'rejected'] as const) {
      for (const moment of SPOKEN_MOMENTS) {
        const declined = reach(moment, { [moment]: declinedFact(status) });
        expect(dialogOpen(declined.page), `${moment} / ${status}`).toBe(false);
        expect(declined.page.host.textContent ?? '', `${moment} / ${status}`).not.toContain(WORDS[moment]);
      }
    }
  });

  it('refuses the whole document when a moment line’s fact block cannot be read', () => {
    /* A misspelt field must not present as an honest rejection (ADR-0024). */
    const read = readQuest(questWith({ afterLine: { claimsFact: false } }), 'fixture');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const result = adjudicateQuest(read.value, createDialogueLedger(), QUEST_ID);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain('#/afterLine/0');
  });

  it('refuses a document whose moment line is malformed, naming the field', () => {
    const raw = questWith({ afterLine: flavourFact() }) as Record<string, Record<string, unknown>>;
    const { speaker: _speaker, ...unattributed } = raw['afterLine'] ?? {};
    const read = readQuest({ ...raw, afterLine: unattributed }, 'fixture');
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error.message).toContain('afterLine');
  });
});

/* ------------------------------------------------------ 2. two silences --- */

describe('a moment nobody wrote and a moment a verifier refused are different silences', () => {
  it('are different words', () => {
    const absent = adjudicate(questWith({})).quest;
    const refused = adjudicate(questWith(everyMoment(declinedFact()))).quest;

    for (const moment of QUEST_MOMENTS) {
      expect(momentVerdict(absent, moment).said, moment).toBe('no-line');
      expect(momentVerdict(refused, moment).said, moment).toBe('unverified');
    }
    for (const moment of SPOKEN_MOMENTS) {
      expect(momentSpeech(absent, moment, PLACEMENTS, 'alberta-foothills').said).toBe('no-line');
      expect(momentSpeech(refused, moment, PLACEMENTS, 'alberta-foothills').said).toBe('unverified');
    }
  });

  it('are different census numbers: a refused line is counted, an absent one is not', () => {
    const absent = adjudicate(questWith({})).census;
    const granted = adjudicate(questWith(everyMoment(grantedFact()))).census;
    const refused = adjudicate(questWith(everyMoment(declinedFact()))).census;

    /* One line on the opening `talk` step in all three. */
    expect(absent.moments).toBe(0);
    expect(absent.examined).toBe(1);
    expect(absent.utterances).toBe(1);

    expect(granted.moments).toBe(4);
    expect(granted.examined).toBe(5);
    expect(granted.utterances).toBe(5);
    expect(granted.refused).toHaveLength(0);
    expect(granted.silenced).toHaveLength(0);

    expect(refused.moments).toBe(4);
    expect(refused.examined).toBe(5);
    expect(refused.refused.map((claim) => claim.pointer).sort()).toEqual(
      QUEST_MOMENTS.map((moment) => `${QUEST_ID}#/${moment}/0`).sort(),
    );
    expect(refused.silenced.map((block) => block.pointer).sort()).toEqual(
      QUEST_MOMENTS.map((moment) => `${QUEST_ID}#/${moment}`).sort(),
    );

    expect(describeDialogueCensus(absent)).not.toBe(describeDialogueCensus(refused));
    expect(describeDialogueCensus(refused)).toContain('4 of the lines are moment lines');
  });

  it('are different console output: only the refusal is reported', () => {
    for (const moment of SPOKEN_MOMENTS) {
      expect(reach(moment, {}).said, `${moment} absent`).toBe('');
      expect(reach(moment, { [moment]: declinedFact() }).said, `${moment} refused`).not.toBe('');
    }
  });

  it('say a one-line refusal plainly, not as a speaker stopped mid-thought', () => {
    const [block] = adjudicate(questWith({ afterLine: declinedFact() })).census.silenced;
    expect(block?.lines).toBe(1);
    expect(block?.message).toContain('is a line a verifier did not grant');
    expect(block?.message).not.toContain('mid-thought');
  });
});

/* ----------------------------------------------------- 3. each moment --- */

describe('"Not now" is answered, and the offer stays open', () => {
  it('opens the answer as its own dialog, with one way onward, after the offer has closed', () => {
    const { page, controller, progress, opened, closed, focusReturns } = reach('declinedLine', {
      declinedLine: flavourFact(),
    });

    const state = questStateFor(
      progress(),
      brandId<LevelId>('alberta-foothills'),
      brandId<QuestId>(QUEST_ID),
    );
    expect(state?.status, 'the decline was not recorded').toBe('declined');
    expect(body(page)).toBe(WORDS.declinedLine);
    expect(page.doc.byTestId('dialogue-accept'), 'the answer re-offered the quest').toBe(null);
    expect(page.doc.byTestId('dialogue-decline')).toBe(null);
    expect(page.doc.byTestId('dialogue-next')).not.toBe(null);

    /* The offer closed (given back once, focus returned once) and the answer
       took the level again. */
    expect(opened()).toBe(2);
    expect(closed()).toBe(1);
    expect(focusReturns()).toBe(1);

    page.doc.byTestId('dialogue-next')?.click();
    expect(dialogOpen(page)).toBe(false);
    expect(closed(), 'the level was not given back after the answer').toBe(2);
    expect(focusReturns(), 'focus was not sent back to the level').toBe(2);

    expect(controller.canEngage(GUIDE), 'declining took the offer away').toBe(true);
    controller.engage(GUIDE);
    expect(page.doc.byTestId('dialogue-accept'), 'the quest was not offered again').not.toBe(null);
  });

  it('closes quietly, exactly as before, when the quest wrote no answer or it was refused', () => {
    for (const facts of [{}, { declinedLine: declinedFact() }]) {
      const { page, opened, closed } = reach('declinedLine', facts);
      expect(dialogOpen(page)).toBe(false);
      expect(opened()).toBe(1);
      expect(closed()).toBe(1);
    }
  });
});

describe('the reminder is said instead of the step prompt', () => {
  it('says the reminder and only the reminder', () => {
    const { page } = reach('reminderLine', { reminderLine: flavourFact() });
    expect(body(page)).toBe(WORDS.reminderLine);
    expect(page.host.textContent ?? '').not.toContain(PROMPT);
    expect(page.doc.byTestId('dialogue-accept'), 'the reminder was a second offer').toBe(null);
  });

  it('borrows nothing when there is no reminder: no prompt, no dialog, no prompt offered', () => {
    const { quest } = adjudicate(questWith({}));
    const { page, controller } = harnessFor(quest, 'active');
    expect(controller.canEngage(GUIDE)).toBe(false);
    expect(controller.engage(GUIDE)).toBe(false);
    expect(page.host.textContent ?? '').toBe('');
  });
});

describe('the after-line is said every time a finished giver is engaged', () => {
  it('says the same line on the first and the second engagement, and never the summary', () => {
    const { quest } = adjudicate(questWith({ afterLine: grantedFact() }));
    const { page, controller, opened } = harnessFor(quest, 'completed');

    for (const time of [1, 2]) {
      expect(controller.engage(GUIDE), `engagement ${String(time)}`).toBe(true);
      expect(body(page), `engagement ${String(time)}`).toBe(WORDS.afterLine);
      expect(page.host.textContent ?? '').not.toContain(SUMMARY);
      page.doc.byTestId('dialogue-next')?.click();
      expect(dialogOpen(page)).toBe(false);
    }
    expect(opened()).toBe(2);
  });

  it('offers no prompt for a finished giver with nothing to say, and reads no summary', () => {
    const { quest } = adjudicate(questWith({ afterLine: declinedFact() }));
    const { page, controller } = harnessFor(quest, 'completed');
    expect(controller.canEngage(GUIDE)).toBe(false);
    consoleDuring(() => {
      expect(controller.engage(GUIDE)).toBe(false);
    });
    expect(page.host.textContent ?? '').not.toContain(SUMMARY);
  });
});

describe('the card line follows the route that finished the level', () => {
  it('is drawn for the quest route and never for the walk to the end', () => {
    const { quest } = adjudicate(questWith({ doneLine: grantedFact() }));
    expect(completionLine({ by: 'quest', quest }).said).toBe('spoken');
    /* The same granted line, and the other route: `TN-DONE` rule 6. */
    expect(completionLine({ by: 'level' }).said).toBe('other-route');
  });

  it('says "no-line" for a quest with no done line, never another quest’s', () => {
    expect(completionLine({ by: 'quest', quest: adjudicate(questWith({})).quest }).said).toBe('no-line');
  });
});

/* ---------------------------------------------------- 4. a landmark --- */

describe('a landmark speaks its moment lines in its own name, with no face', () => {
  const lightQuest = (): SpokenQuest =>
    adjudicate(questWith(everyMoment(flavourFact()), LIGHT, LIGHT)).quest;

  it('is resolved as a landmark and named by its pois[].name', () => {
    for (const moment of SPOKEN_MOMENTS) {
      const speech = momentSpeech(lightQuest(), moment, PLACEMENTS, 'alberta-foothills');
      expect(speech.said, moment).toBe('spoken');
      if (speech.said !== 'spoken') continue;
      expect(speech.speaker.kind).toBe('landmark');
      expect(speech.speaker.name).toEqual(LIGHT_NAME);
      /* The key is absent, not undefined: there is no pose on a plaque to read. */
      expect(Object.hasOwn(speech.line, 'expression')).toBe(false);
    }
  });

  it('opens its after-line dialog named after itself, in both languages', () => {
    for (const locale of ['en', 'fr'] as const) {
      const { page, controller } = harnessFor(lightQuest(), 'completed');
      controller.setLocale(locale);
      expect(controller.engage(LIGHT)).toBe(true);
      expect(speakerOf(page)).toBe(LIGHT_NAME[locale]);
      expect(speakerOf(page)).not.toBe(LIGHT);
    }
  });

  it('still carries an expression a character’s moment line declares', () => {
    /* The other direction, so the absence above is about the landmark and not
       about a reader that drops the field for everybody. */
    const raw = questWith({ afterLine: flavourFact() }) as Record<string, Record<string, unknown>>;
    const read = readQuest(
      { ...raw, afterLine: { ...(raw['afterLine'] ?? {}), expression: 'happy' } },
      'fixture',
    );
    expect(read.ok).toBe(true);
    expect(read.ok && read.value.afterLine?.expression).toBe('happy');
  });

  it('refuses a moment line whose speaker the level does not place, and says why', () => {
    const { quest } = adjudicate(questWith({ afterLine: flavourFact() }, 'a-plaque-nobody-placed'));
    const speech = momentSpeech(quest, 'afterLine', PLACEMENTS, 'alberta-foothills');
    expect(speech.said).toBe('unnamed');

    const { page, controller } = harnessFor(quest, 'completed');
    const said = consoleDuring(() => {
      expect(controller.engage(GUIDE)).toBe(false);
    });
    expect(dialogOpen(page)).toBe(false);
    expect(said).toContain('cannot name it');
    expect(said).toContain('a-plaque-nobody-placed');
  });
});
