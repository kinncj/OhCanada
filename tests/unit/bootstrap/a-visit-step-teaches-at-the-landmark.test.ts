/**
 * A `visit` step says what it came to say — and says it in somebody's name.
 *
 * ## The defect
 *
 * Quests were rebuilt to teach at each landmark and ask about it straight away:
 * talk → visit → answer → visit → answer, with **two dialogue lines on every one
 * of the 27 `visit` steps** in `content/quests/`. `app/bootstrap/quests.ts` read
 * them, `quest.schema.json` permitted them, and nothing drew them.
 * `app/bootstrap/quest.ts` reached for dialogue through `openingDialogue` only —
 * `steps[0]`, and only when its kind is `talk` — so arriving at a landmark
 * showed the level's blurb and dropped the lines written to explain why the
 * place matters.
 *
 * That is the shape ADR-0024 is about. A step with no dialogue is **supposed**
 * to be silent, so a step whose dialogue was never read looked exactly like one
 * that had none, and every suite stayed green: `makeQuest`'s `visit` step
 * carries no dialogue, so a test written over the fixture would have proved
 * nothing at all. Everything below is therefore written twice — once with lines
 * and once without — and the corpus half, over the 27 documents that actually
 * ship, is `tests/unit/bootstrap/every-visit-line-reaches-the-player.test.ts`.
 *
 * ## What is being pinned
 *
 *  1. The lines are the **finished** step's, read before the quest advances.
 *  2. Nothing opens until the caller asks, so the landmark's own card goes
 *     first: the place in its own words, then a named speaker commenting on it.
 *  3. The speaker is resolved through `app/bootstrap/engageables.ts` — the one
 *     path there is — so a landmark speaker is named from the level's own
 *     `pois[].name` and nothing anywhere asks it for a pose, a portrait or a
 *     rig. Peggy's Cove and the North may draw no figure at any scale (ADR-0029)
 *     and their quests are offered and spoken by the landmark itself.
 *  4. Silence says which silence it is: `no-dialogue` for a quiet document, and
 *     a console sentence naming the file for every other reason.
 *  5. The caller's continuation — the landmark's question — is paid exactly once
 *     on every path out, including Escape and the step that had nothing to say.
 */

import { describe, expect, it, vi } from 'vitest';

import { createQuestController, type QuestController } from '../../../app/bootstrap/quest';
import { readQuest } from '../../../app/bootstrap/quests';
import { resolveEngageable, type LevelPlacements } from '../../../app/bootstrap/engageables';
import { withQuestState, type Progress } from '@domain/entities/progress';
import { createSettingsStore } from '@ui/settings';
import type { QuestDocument } from '@application/ports';
import { buildPage, press, type FakePage } from '../ui/support/fake-dom';
import { emptyProgress, ORIGIN, testClock, text as localised } from '../support/fixtures';

/* --------------------------------------------------------------- documents */

const BLURB = localised('A true, short thing.', 'Une chose vraie et courte.');

/** A level with a character to talk to and two landmarks to walk to. */
const FOOTHILLS: LevelPlacements = {
  characters: [{ characterId: 'guide' }],
  pois: [
    { id: 'ranch-gate', name: localised('The ranch gate', 'La barrière du ranch'), blurb: BLURB },
    { id: 'ranch-barn', name: localised('The barn', 'La grange'), blurb: BLURB },
  ],
};

const GATE_LINE = 'Alberta has the most beef cattle in Canada.';
const BARN_LINE = 'The Prairie provinces are Alberta, Saskatchewan and Manitoba.';

const flavour = { claimsFact: false } as const;

/** A line, as a quest document writes one. `fact` is required on every line. */
const line = (speaker: string, en: string, fr: string): Record<string, unknown> => ({
  speaker,
  text: { en, fr },
  fact: flavour,
});

/**
 * A quest, built as JSON and read by the loader the game reads.
 *
 * Parsed rather than typed, because half of what is being pinned is that
 * `readStep` keeps `dialogue` on a step that is not `talk` — a fixture cast to
 * `QuestDocument` would assert that over a value the loader never saw.
 */
function parse(raw: Record<string, unknown>): QuestDocument {
  const read = readQuest(raw, 'fixture');
  if (!read.ok) throw new Error(`fixture did not load: ${read.error.message}`);
  return read.value;
}

interface StepOverrides {
  /** Lines on the first `visit` step. `null` is a step that carries none. */
  readonly atTheGate?: readonly Record<string, unknown>[] | null;
  readonly atTheBarn?: readonly Record<string, unknown>[] | null;
}

const ranchQuest = (overrides: StepOverrides = {}): QuestDocument => {
  const atTheGate =
    overrides.atTheGate === undefined
      ? [
          line('guide', GATE_LINE, 'L’Alberta compte le plus de bovins de boucherie au Canada.'),
          line('guide', 'Ranching started here in the 1870s.', 'L’élevage y a commencé en 1870.'),
        ]
      : overrides.atTheGate;
  const atTheBarn =
    overrides.atTheBarn === undefined
      ? [line('guide', BARN_LINE, 'Les provinces des Prairies sont l’Alberta, la Saskatchewan et le Manitoba.')]
      : overrides.atTheBarn;

  return parse({
    id: 'alberta-foothills-ranch-barn',
    levelId: 'alberta-foothills',
    giver: 'guide',
    title: { en: 'Ride out to the ranch', fr: 'Allez jusqu’au ranch' },
    summary: { en: 'You rode out to the ranch.', fr: 'Vous êtes allé au ranch.' },
    steps: [
      {
        id: 'meet-the-guide',
        kind: 'talk',
        targetId: 'guide',
        prompt: { en: 'Talk to the guide', fr: 'Parlez au guide' },
        dialogue: [line('guide', 'Come and see the ranch.', 'Venez voir le ranch.')],
      },
      {
        id: 'ride-up-to-the-ranch-gate',
        kind: 'visit',
        targetId: 'ranch-gate',
        prompt: { en: 'Ride to the ranch gate', fr: 'Allez à la barrière' },
        ...(atTheGate === null ? {} : { dialogue: atTheGate }),
      },
      {
        id: 'answer-at-the-ranch-gate',
        kind: 'answer',
        targetId: 'economy',
        prompt: { en: 'Answer 1 question ({{done}} of 1)', fr: 'Répondez à 1 question' },
        subject: 'economy',
        count: 1,
      },
      {
        id: 'ride-to-the-ranch',
        kind: 'visit',
        targetId: 'ranch-barn',
        prompt: { en: 'Ride to the barn', fr: 'Allez à la grange' },
        ...(atTheBarn === null ? {} : { dialogue: atTheBarn }),
      },
    ],
  });
};

/* ------------------------------------------------------------------- the seam */

interface Harness {
  readonly page: FakePage;
  readonly controller: QuestController;
  readonly opened: () => number;
  readonly closed: () => number;
}

/**
 * A controller with the quest already accepted and the player standing on the
 * step named by `stepIndex`.
 *
 * The state is written into `Progress` rather than walked to through the offer,
 * because what is under test is what a step says on arrival and not how the
 * quest was accepted — which `a-landmark-giver-opens-a-dialog.test.ts` owns.
 */
function harnessFor(
  quest: QuestDocument,
  stepIndex: number,
  placements: LevelPlacements | null = FOOTHILLS,
): Harness {
  const page = buildPage();
  let opens = 0;
  let closes = 0;
  let progress: Progress = withQuestState(emptyProgress(), quest.levelId, {
    questId: quest.id,
    status: 'active',
    stepIndex,
    stepProgress: 0,
    updatedAt: ORIGIN,
  });

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
    restoreFocusTo: () => null,
  });

  return { page, controller, opened: () => opens, closed: () => closes };
}

/** Everything the dialogue is showing, as one string. */
const spoken = (page: FakePage): string => page.doc.byTestId('dialogue-text')?.textContent ?? '';

/** What a screen reader is handed before a word of prose. */
function accessibleName(page: FakePage): string | null {
  const dialog = page.doc.byTestId('dialogue');
  if (dialog === null) return null;
  return page.doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent ?? null;
}

const consoleSaid = (run: () => void): string => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    run();
    return error.mock.calls.flat().join(' ');
  } finally {
    error.mockRestore();
  }
};

/* ------------------------------------------------------------------- the lines */

describe('reaching a landmark says what the step came to say', () => {
  it('opens nothing until the caller asks, so the landmark card goes first', () => {
    const { controller, page, opened } = harnessFor(ranchQuest(), 1);

    const visit = controller.visited('ranch-gate');
    expect(visit.advanced, 'the visit step did not advance').toBe(true);
    /* The card is on screen at this moment. A dialogue opened here would be a
       second modal over it, and the level's own blurb would never be read. */
    expect(page.doc.byTestId('dialogue'), 'a dialogue opened over the landmark card').toBe(null);
    expect(opened()).toBe(0);
  });

  it('says the step’s own lines, in order, when the caller asks for them', () => {
    const { controller, page, opened } = harnessFor(ranchQuest(), 1);
    const onClosed = vi.fn();

    const visit = controller.visited('ranch-gate');
    expect(visit.speak(onClosed)).toBe('spoken');

    expect(page.doc.byTestId('dialogue'), 'nothing was drawn').not.toBe(null);
    expect(spoken(page)).toContain(GATE_LINE);
    expect(spoken(page)).toContain('Ranching started here in the 1870s.');
    expect(spoken(page).indexOf(GATE_LINE)).toBeLessThan(
      spoken(page).indexOf('Ranching started here in the 1870s.'),
    );
    /* The level is held while a modal is up, and not before. */
    expect(opened()).toBe(1);
    /* The question is not owed yet: the player is still reading. */
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('is the step’s dialogue and not its prompt, which is the other field there', () => {
    /*
     * The prompt is the tracker's line and is right there on the same object, so
     * it is the field a wrong read lands on. If this ever shows "Ride to the
     * ranch gate" the dialogue is being drawn from the tracker.
     */
    const { controller, page } = harnessFor(ranchQuest(), 1);
    controller.visited('ranch-gate').speak(vi.fn());
    expect(spoken(page)).not.toContain('Ride to the ranch gate');
  });

  it('is the finished step’s lines, never the next step’s', () => {
    /*
     * `currentStep` answers with the *next* step the instant `progressQuest`
     * succeeds. A reader that came back for the lines after advancing would be
     * handed the `answer` step's — which has none — and 27 authored lines would
     * be dropped while everything went on passing. This is that ordering, pinned.
     */
    const { controller, page } = harnessFor(ranchQuest(), 1);
    expect(controller.visited('ranch-gate').speak(vi.fn())).toBe('spoken');
    expect(spoken(page)).toContain(GATE_LINE);
    expect(spoken(page), 'the next landmark’s line was read instead').not.toContain(BARN_LINE);
  });

  it('names the speaker, draws the name, and hands the same string to the dialog', () => {
    const { controller, page } = harnessFor(ranchQuest(), 1);
    controller.visited('ranch-gate').speak(vi.fn());

    /* `content/characters/guide.json#/name`, through the one resolver there is. */
    const name = page.doc.byTestId('dialogue-speaker')?.textContent ?? '';
    expect(name.trim(), 'a dialog announced as nothing is a defect').not.toBe('');
    expect(name, 'the raw id, read one hyphen at a time').not.toBe('guide');
    expect(accessibleName(page)).toBe(name);
  });

  it('speaks French when the game is in French', () => {
    const { controller, page } = harnessFor(ranchQuest(), 1);
    controller.setLocale('fr');
    controller.visited('ranch-gate').speak(vi.fn());
    expect(spoken(page)).toContain('L’Alberta compte le plus de bovins de boucherie au Canada.');
    expect(spoken(page)).not.toContain(GATE_LINE);
  });

  it('offers one way onward, and pays the caller once when it is taken', () => {
    const { controller, page, closed } = harnessFor(ranchQuest(), 1);
    const onClosed = vi.fn();
    controller.visited('ranch-gate').speak(onClosed);

    /* A line with nothing to decide gets one control, never accept/decline:
       the offer was made and taken long before this step. */
    expect(page.doc.byTestId('dialogue-accept')).toBe(null);
    expect(page.doc.byTestId('dialogue-decline')).toBe(null);
    const onward = page.doc.byTestId('dialogue-next');
    expect(onward, 'no way out of the line').not.toBe(null);

    onward?.click();
    expect(page.doc.byTestId('dialogue')?.hidden).toBe(true);
    expect(closed(), 'the level was not given back').toBe(1);
    expect(onClosed, 'the landmark’s question was owed and not paid').toHaveBeenCalledTimes(1);
  });

  it('pays the caller once when the player presses Escape instead', () => {
    /* `TN-QUEST-03`: leaving a dialogue is not a decision. It is still an exit,
       and the question after the landmark is still owed. */
    const { controller, page } = harnessFor(ranchQuest(), 1);
    const onClosed = vi.fn();
    controller.visited('ranch-gate').speak(onClosed);

    const dialog = page.doc.byTestId('dialogue');
    expect(dialog).not.toBe(null);
    if (dialog !== null) press(dialog, 'Escape');
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

/* ---------------------------------------------------------------- the silence */

describe('a step with nothing to say is silent, and says which silence it is', () => {
  it('opens nothing, and pays the caller straight away', () => {
    const { controller, page, opened } = harnessFor(ranchQuest({ atTheGate: null }), 1);
    const onClosed = vi.fn();

    const visit = controller.visited('ranch-gate');
    expect(visit.advanced, 'the step still advances: silence is not a refusal').toBe(true);
    expect(visit.speak(onClosed)).toBe('no-dialogue');

    expect(page.doc.byTestId('dialogue'), 'a dialogue opened for a step with no lines').toBe(null);
    expect(opened(), 'the level was taken for a dialogue that never opened').toBe(0);
    /* Straight through to the question: the same behaviour as before quests
       taught anything, and the whole point of the continuation. */
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('is the document’s silence and not the code’s, proved by the pair', () => {
    /*
     * ADR-0024, and the reason this file exists. The quiet fixture and the
     * speaking one differ in **one field on one step**, so a reader that stopped
     * looking at `dialogue` would make both of them answer `no-dialogue` and
     * this pair would go red. A suite with only the quiet one passes over the
     * defect, which is exactly what shipped.
     */
    const quiet = harnessFor(ranchQuest({ atTheGate: null }), 1);
    const speaking = harnessFor(ranchQuest(), 1);

    expect(quiet.controller.visited('ranch-gate').speak(vi.fn())).toBe('no-dialogue');
    expect(speaking.controller.visited('ranch-gate').speak(vi.fn())).toBe('spoken');
  });

  it('says nothing at all for a landmark the current step is not about', () => {
    const { controller, page } = harnessFor(ranchQuest(), 1);
    const onClosed = vi.fn();

    /* The barn is a later step's target. Steps cannot be skipped, and the barn
       cannot speak the gate's lines. */
    const visit = controller.visited('ranch-barn');
    expect(visit.advanced).toBe(false);
    expect(visit.speak(onClosed)).toBe('no-step');
    expect(page.doc.byTestId('dialogue')).toBe(null);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('says nothing while the player is on a step of another kind', () => {
    /*
     * Every landmark on every level goes through this call, quest or no quest.
     * Step 0 is the `talk` step and step 2 is the `answer` step; neither is
     * finished by walking up to a gate, and neither may borrow the gate's lines.
     */
    for (const stepIndex of [0, 2]) {
      const { controller, page } = harnessFor(ranchQuest(), stepIndex);
      const onClosed = vi.fn();
      expect(controller.visited('ranch-gate').speak(onClosed)).toBe('no-step');
      expect(page.doc.byTestId('dialogue')).toBe(null);
      expect(onClosed).toHaveBeenCalledTimes(1);
    }
  });
});

/* --------------------------------------------------------------- the plaque */

describe('a landmark speaks in its own name, and is asked for no face', () => {
  const LIGHT = 'peggys-point-light';
  const LIGHT_NAME = localised("Peggy's Point Lighthouse", 'Le phare de Peggy’s Point');
  const FISH_LINE = 'Nova Scotia was one of the four provinces that formed Canada in 1867.';

  /** No characters, ever: `assets/style/peggys-cove-level.md` §0. */
  const PEGGYS_COVE: LevelPlacements = {
    characters: [],
    pois: [
      { id: LIGHT, name: LIGHT_NAME, blurb: BLURB },
      { id: 'fish-store', name: localised('The fish store', 'Le hangar à poisson'), blurb: BLURB },
    ],
  };

  /** The shape the two figureless levels ship: no `expression` on any line. */
  const lighthouseQuest = (): QuestDocument =>
    parse({
      id: 'peggys-cove-point-light',
      levelId: 'peggys-cove',
      giver: LIGHT,
      title: { en: 'Read the light', fr: 'Lire le phare' },
      summary: { en: 'You read the panel.', fr: 'Vous lisez le panneau.' },
      steps: [
        {
          id: 'stop-at-the-light',
          kind: 'talk',
          targetId: LIGHT,
          prompt: { en: 'Read the panel', fr: 'Lisez le panneau' },
          dialogue: [line(LIGHT, 'You are on the Atlantic edge.', 'Vous êtes sur la bordure.')],
        },
        {
          id: 'walk-on-to-the-fish-store',
          kind: 'visit',
          targetId: 'fish-store',
          prompt: { en: 'Walk on to the fish store', fr: 'Allez au hangar' },
          dialogue: [
            line(LIGHT, FISH_LINE, 'La Nouvelle-Écosse est une des quatre provinces de 1867.'),
            line(LIGHT, 'Fishing built these villages.', 'La pêche a bâti ces villages.'),
          ],
        },
      ],
    });

  it('is named from the level’s own pois[].name, with no copy row and no rig', () => {
    const { controller, page } = harnessFor(lighthouseQuest(), 1, PEGGYS_COVE);
    expect(controller.visited('fish-store').speak(vi.fn())).toBe('spoken');

    expect(page.doc.byTestId('dialogue-speaker')?.textContent).toBe(LIGHT_NAME.en);
    expect(accessibleName(page)).toBe(LIGHT_NAME.en);
    expect(spoken(page)).toContain(FISH_LINE);

    /* The resolution that produced that name knows it is a place, which is the
       field anything reaching for a rig would have to branch on first. */
    const resolution = resolveEngageable(PEGGYS_COVE, LIGHT);
    expect(resolution.ok && resolution.engageable.kind).toBe('landmark');
  });

  it('draws no figure: no portrait, no pose, nothing but words and a button', () => {
    /*
     * The live defect this file was written beside — `promptTargets` offering
     * "Talk to this person" for a lighthouse — was a second path that did not
     * ask what it was talking to. This is the same question asked of the DOM:
     * the dialogue a plaque speaks through holds a heading, paragraphs and one
     * control, and no element that could carry an image or a face pose.
     */
    const { controller, page } = harnessFor(lighthouseQuest(), 1, PEGGYS_COVE);
    controller.visited('fish-store').speak(vi.fn());

    const dialog = page.doc.byTestId('dialogue');
    expect(dialog).not.toBe(null);
    const tags = (dialog?.querySelectorAll('*') ?? []).map((node) => node.tagName.toLowerCase());
    expect(tags.length, 'the dialogue drew nothing').toBeGreaterThan(0);
    expect([...new Set(tags)].sort()).toEqual(['button', 'div', 'h1', 'p']);
    expect(dialog?.querySelectorAll('img')).toEqual([]);
    expect(dialog?.querySelectorAll('canvas')).toEqual([]);
    expect(dialog?.querySelectorAll('[data-tn-pose]')).toEqual([]);
    expect(dialog?.querySelectorAll('[data-tn-expression]')).toEqual([]);
  });

  it('keeps the expression key absent on the line it just drew', () => {
    /*
     * Not `undefined`: absent. `readQuest` leaves the key off a landmark line so
     * that nothing downstream can read a pose off a plaque even by accident, and
     * a `visit` step's lines go through the same reader as a `talk` step's.
     */
    const step = lighthouseQuest().steps[1];
    expect(step?.kind).toBe('visit');
    const lines = step?.dialogue ?? [];
    expect(lines.length).toBe(2);
    for (const spokenLine of lines) {
      expect(Object.hasOwn(spokenLine, 'expression')).toBe(false);
    }
  });

  it('still carries a character’s expression, so the rule is about the plaque', () => {
    /* The other direction, so the assertion above is about a landmark rather
       than a reader that drops the field for everybody. */
    const step = ranchQuest({
      atTheGate: [{ ...line('guide', GATE_LINE, 'Une ligne.'), expression: 'thinking' }],
    }).steps[1];
    expect(step?.dialogue?.[0]?.expression).toBe('thinking');
  });
});

/* --------------------------------------------------------------- the refusals */

describe('a line this build cannot attribute is left unsaid, loudly', () => {
  it('refuses a speaker the level does not place, and names the document', () => {
    const quest = ranchQuest({
      atTheGate: [line('a-guide-nobody-placed', GATE_LINE, 'Une ligne.')],
    });
    const { controller, page, opened } = harnessFor(quest, 1);
    const onClosed = vi.fn();

    let outcome = '';
    const said = consoleSaid(() => {
      outcome = controller.visited('ranch-gate').speak(onClosed);
    });

    expect(outcome).toBe('unnamed');
    expect(page.doc.byTestId('dialogue'), 'an unnamed dialog mounted').toBe(null);
    expect(opened()).toBe(0);
    /* The question is still owed: a refused line does not strand the chain. */
    expect(onClosed).toHaveBeenCalledTimes(1);
    /* The sentence names the quest, the step, the speaker and the level. */
    expect(said).toContain('alberta-foothills-ranch-barn');
    expect(said).toContain('ride-up-to-the-ranch-gate');
    expect(said).toContain('a-guide-nobody-placed');
    expect(said).toContain('pois[].id');
  });

  it('refuses a step whose lines name two speakers rather than picking one', () => {
    /*
     * `app/ui/dialogue.ts` has one speaker per dialog because the name is the
     * dialog's accessible name (`TN-QUEST-08`). Two of them would put one
     * speaker's words behind the other's name, which is a screen reader told
     * something untrue. No shipped quest is shaped this way, and this is what
     * happens on the day one is.
     */
    const quest = ranchQuest({
      atTheGate: [line('guide', GATE_LINE, 'Une ligne.'), line('ranch-gate', 'And a sign.', 'Un panneau.')],
    });
    const { controller, page } = harnessFor(quest, 1);
    const onClosed = vi.fn();

    let outcome = '';
    const said = consoleSaid(() => {
      outcome = controller.visited('ranch-gate').speak(onClosed);
    });

    expect(outcome).toBe('many-speakers');
    expect(page.doc.byTestId('dialogue')).toBe(null);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(said).toContain('guide, ranch-gate');
  });

  it('refuses when the level is not loaded, without losing the question', () => {
    const { controller } = harnessFor(ranchQuest(), 1, null);
    const onClosed = vi.fn();
    let outcome = '';
    consoleSaid(() => {
      outcome = controller.visited('ranch-gate').speak(onClosed);
    });
    expect(outcome).toBe('unnamed');
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------ the loader half */

describe('the loader keeps a visit step’s dialogue, which is where this began', () => {
  it('carries dialogue on a visit step and requires none', () => {
    const withLines = ranchQuest().steps[1];
    expect(withLines?.kind).toBe('visit');
    expect(withLines?.dialogue?.length).toBe(2);

    const without = ranchQuest({ atTheGate: null }).steps[1];
    expect(without?.kind).toBe('visit');
    expect(without?.dialogue).toBeUndefined();
  });

  it('refuses a visit step whose dialogue is malformed rather than dropping it', () => {
    /* A step that carries the field has to carry it properly: a document half
       way to having lines must not load as a document with none. */
    const read = readQuest(
      {
        id: 'a-quest',
        levelId: 'alberta-foothills',
        giver: 'guide',
        title: { en: 'A quest', fr: 'Une quête' },
        summary: { en: 'A summary.', fr: 'Un résumé.' },
        steps: [
          {
            id: 'ride',
            kind: 'visit',
            targetId: 'ranch-gate',
            prompt: { en: 'Ride', fr: 'Allez' },
            dialogue: [{ speaker: 'guide', text: { en: 'Only English.' }, fact: flavour }],
          },
        ],
      },
      'fixture',
    );
    expect(read.ok).toBe(false);
  });
});
