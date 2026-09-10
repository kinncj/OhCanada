/**
 * A page that mounts one DOM screen, so axe-core can scan it in a real browser.
 *
 * Why this exists: `tests/a11y/screens.spec.ts` had `fixme` scans pointed at
 * `./#/settings` and `./#/question`, routes that do not exist — the composition
 * root (`app/bootstrap`) is another agent's file and slice 1's screens are not
 * wired into the game yet. Rather than scan nothing, or edit somebody else's
 * boot sequence, this harness mounts the components directly, at the same
 * portrait viewport, with the same page chrome as `index.html`.
 *
 * It is a test fixture and ships in no build: it is under `tests/`, it is served
 * by the dev server the a11y config starts, and nothing in `app/` imports it.
 *
 * The strings below are **fixtures, not content**. Question wording, option
 * wording and NPC lines come from `content/` and are written by the content
 * agents; what is here exists only so a scan has realistic text to measure —
 * including a deliberately long question, which is what `TN-CARD-10` asks for
 * at 200 % text.
 */

import type { LevelId } from '../../app/domain/ids';

import { createCharacterCreator, type CreatorSlot } from '../../app/ui/character-creator';
import { describeEntry, type MapEntry } from '../../app/ui/level-select';
import { createShell } from '../../app/ui/shell';
import { createDialogue } from '../../app/ui/dialogue';
import { createHud } from '../../app/ui/hud';
import { createLevelAnnouncer, type LevelEvent } from '../../app/ui/level-events';
import { createLevelComplete } from '../../app/ui/level-complete';
import { createLevelError, createLevelLoading } from '../../app/ui/level-screens';
import { interactHint, interactPrompt } from '../../app/ui/interact';
import { mountLiveRegion, announce } from '../../app/ui/live-region';
import { createPassport } from '../../app/ui/passport';
import { createPoiCard } from '../../app/ui/poi-card';
import { createExamResult, type ExamReviewItem } from '../../app/ui/exam-result';
import { createExamScreen, type ExamTimerView } from '../../app/ui/exam-screen';
import { createExamStartScreen, type ExamStartState } from '../../app/ui/exam-start';
import { createQuestionCard, type QuestionView } from '../../app/ui/question-card';
import { createSettingsScreen } from '../../app/ui/settings-screen';
import { createStudyScreen, type StudyState } from '../../app/ui/study-screen';
import {
  applySettings,
  createSettingsStore,
  DEFAULT_SETTINGS,
  prefersReducedMotion,
  type Settings,
} from '../../app/ui/settings';
import { hasCopyRow, isUiLocale, text, type UiLocale } from '../../app/ui/copy';

const params = new URLSearchParams(window.location.search);
const ui = document.getElementById('ui');
if (ui === null) throw new Error('the harness page is missing #ui');

mountLiveRegion(ui);

const locale: UiLocale = isUiLocale(params.get('locale')) ? (params.get('locale') as UiLocale) : 'en';

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  locale,
  textScale: Number(params.get('textScale') ?? '100'),
  singleSwitch: params.get('switch') === '1',
  reducedMotion: params.get('motion') === 'reduced',
  highContrast: params.get('contrast') === 'high',
  dyslexiaFont: params.get('font') === 'dyslexia',
};

const store = createSettingsStore(settings);
const apply = (): void =>
  void applySettings(document, store.current, prefersReducedMotion(window));
apply();
store.subscribe(apply);

const slotsFor = (locale: UiLocale): readonly CreatorSlot[] => [
  {
    id: 'skin',
    testId: 'slot-skin',
    label: locale === 'fr' ? 'Teint de peau' : 'Skin tone',
    /* Unnamed ramp, ordinal only: docs/content-review.md 8.1 leaves the naming
       open (OQ-REVIEW-6), so the fixture names nobody. */
    options: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `skin-${String(n)}`,
      name: locale === 'fr' ? `Teint ${String(n)}` : `Skin tone ${String(n)}`,
    })),
  },
  {
    id: 'hair',
    testId: 'slot-hair',
    label: locale === 'fr' ? 'Cheveux' : 'Hair',
    options: [
      { id: 'coily', name: locale === 'fr' ? 'Crépus' : 'Coily' },
      { id: 'curly', name: locale === 'fr' ? 'Bouclés' : 'Curly' },
      { id: 'straight', name: locale === 'fr' ? 'Raides' : 'Straight' },
      { id: 'braids', name: locale === 'fr' ? 'Tresses' : 'Braids' },
    ],
  },
  {
    id: 'coat',
    testId: 'slot-coat',
    label: locale === 'fr' ? 'Manteau' : 'Coat',
    options: [
      { id: 'parka', name: 'Parka' },
      { id: 'anorak', name: 'Anorak' },
      { id: 'peacoat', name: locale === 'fr' ? 'Caban' : 'Pea coat' },
    ],
  },
];

const SLOTS: readonly CreatorSlot[] = slotsFor(locale);

const LONG_PROMPT_EN =
  'Which of these best describes what the Constitution Act, 1867 set up for Canada, ' +
  'including the way power is shared between the federal government and the provinces, ' +
  'and the way laws are made in each of them?';
const LONG_PROMPT_FR =
  'Laquelle de ces phrases décrit le mieux ce que la Loi constitutionnelle de 1867 a mis en ' +
  'place au Canada, y compris le partage des pouvoirs entre le gouvernement fédéral et les ' +
  'provinces, et la façon dont les lois sont faites dans chacun?';

const QUESTION: QuestionView = {
  kind: 'new',
  index: 0,
  total: 3,
  prompt:
    params.get('long') === '1'
      ? locale === 'fr'
        ? LONG_PROMPT_FR
        : LONG_PROMPT_EN
      : locale === 'fr'
        ? "Qui est le chef d'État du Canada?"
        : 'Who is the head of state of Canada?',
  options:
    locale === 'fr'
      ? ['Le monarque', 'Le premier ministre', 'Le gouverneur général', "Le président de la Chambre"]
      : ['The monarch', 'The prime minister', 'The governor general', 'The speaker of the House'],
  correctIndex: 0,
  explanation:
    locale === 'fr'
      ? 'Le Canada est une monarchie constitutionnelle.'
      : 'Canada is a constitutional monarchy.',
};

/**
 * The level's own fixtures. Every string here is transcribed from
 * `docs/stories/TN-LEVEL-ottawa.md`'s copy table, because the level's copy
 * belongs to the level document (ADR-0010) and reaches `app/ui` as data — the
 * components take it as a required option rather than owning it.
 *
 * The two strings that used to be placeholders here — the region's name and the
 * loading sentence — are gone: `TN-HUD` and `TN-WAIT` write them down, so
 * `hud.label` and `level.<id>.loading` are rows in `app/ui/copy.ts`. The HUD
 * names itself from the table, and the level screens read {@link waiting} from
 * the table rather than retyping it, so a wording change reaches the scan
 * without this fixture being edited.
 */
const LEVEL = {
  en: {
    title: 'Ottawa',
    mode: 'Skating',
    task: 'Answer 3 questions (0 of 3)',
    officer: 'Talk to the officer',
    landmark: 'Look at Parliament Hill',
    arrival: 'You are on the Rideau Canal in Ottawa. Skating.',
    poi: {
      title: 'Parliament Hill',
      body: [
        'The Parliament buildings are in Ottawa. The tall clock tower is called the Peace Tower.',
      ],
    },
  },
  fr: {
    title: 'Ottawa',
    mode: 'Patinage',
    task: 'Répondez à 3 questions (0 sur 3)',
    officer: "Parler à l'agent",
    landmark: 'Regarder la Colline du Parlement',
    arrival: 'Vous êtes sur le canal Rideau à Ottawa. Patinage.',
    poi: {
      title: 'La Colline du Parlement',
      body: [
        "Les édifices du Parlement sont à Ottawa. La haute tour de l'horloge s'appelle la tour de la Paix.",
      ],
    },
  },
} as const;

/**
 * Which level's waiting sentence and failure title the two level screens draw.
 *
 * `?place=<id>`, defaulting to the level the rest of this fixture is about. It
 * is a parameter rather than a constant because the strings are **per level**
 * now — one `level.loading` row for four levels is the defect
 * `TN-WAIT-a-level-opens-or-it-does-not.md` exists to make impossible — and
 * because the longest sentence and the longest title in French belong to Québec
 * City, which is what a 200 % scan has to be pointed at to prove anything.
 *
 * Checked against the table rather than trusted: a `?place=` nobody wrote rows
 * for falls back, because a harness that renders `undefined` would scan a defect
 * of its own making.
 */
const PLACE = ((): string => {
  const asked = params.get('place') ?? 'ottawa';
  return hasCopyRow(`level.${asked}.loading`) ? asked : 'ottawa';
})();

const waiting = {
  title: text(locale, `level.${PLACE}.title` as Parameters<typeof text>[1]),
  loading: text(locale, `level.${PLACE}.loading` as Parameters<typeof text>[1]),
  errorTitle: text(locale, `level.${PLACE}.error.title` as Parameters<typeof text>[1]),
};

/**
 * The shell's map entries.
 *
 * **No copy here.** `TN-TITLE`, `TN-MAP`, `TN-FLOW` and `TN-LEVELS` write every
 * string these screens draw, so `app/ui/copy.ts` carries the rows and the shell
 * takes none as an option. What is left is the *state* of the journey, which is
 * data: ten entries in map order, from `TN-LEVELS-2-to-10-spine.md`, with levels
 * 2 and 10 carrying no id because that file deliberately leaves them unscoped.
 *
 * The default fixture shows all three card states at once — Ottawa open, Halifax
 * built and not yet earned, the other eight not made yet — because `TN-MAP-05`
 * is about telling the last two apart, and a scan that never draws both proves
 * nothing about it.
 */
const PLACES: readonly (readonly [number, string | undefined])[] = [
  [1, 'halifax'],
  [2, undefined],
  [3, 'quebec-city'],
  [4, 'ottawa'],
  [5, 'toronto'],
  [6, 'winnipeg'],
  [7, 'prairie-rail'],
  [8, 'alberta-foothills'],
  [9, 'vancouver'],
  [10, undefined],
];

/**
 * `?stamped=<id>` puts one level's stamp in the passport, so the "Earned" badge
 * is a state a scan can actually reach. Without it `MapEntry.stamped` is never
 * `true` on any harness page and the badge is drawn by nothing.
 */
const STAMPED = params.get('stamped');

const mapEntries = (built: readonly string[]): readonly MapEntry[] =>
  PLACES.map(([number, id]) => ({
    number,
    ...(id === undefined ? {} : { id: id as LevelId }),
    built: id !== undefined && built.includes(id),
    unlocked: id === 'ottawa',
    stamped: id !== undefined && id === STAMPED,
  }));

const level = LEVEL[locale];

const screen = params.get('screen') ?? 'settings';

switch (screen) {
  case 'settings': {
    createSettingsScreen(ui, {
      store,
      announce,
      onClose: () => undefined,
      showSound: params.get('sound') === '1',
    }).show();
    break;
  }

  case 'creator': {
    createCharacterCreator(ui, {
      slots: SLOTS,
      locale,
      announce,
      /* Fixed rather than random, so a scan is reproducible. The randomiser
         itself is proved uniform in the unit suite. */
      initialSelection: { skin: 'skin-3', hair: 'curly', coat: 'parka' },
      singleSwitch: store.current.singleSwitch,
      motion: store.current.reducedMotion ? 'reduced' : 'full',
      onOpenSettings: () => undefined,
      onStart: () => undefined,
    }).show();
    break;
  }

  case 'dialogue': {
    createDialogue(ui, {
      speakerName: locale === 'fr' ? 'Agent' : 'Officer',
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onClose: () => undefined,
    }).show({
      lines:
        locale === 'fr'
          ? [
              'Bonjour! Bienvenue à Ottawa. Ottawa est la capitale du Canada.',
              'Patinez sur le canal jusqu’à la Colline du Parlement et trouvez la tour de la Paix. Ensuite, répondez à trois questions.',
            ]
          : [
              "Hello! Welcome to Ottawa. Ottawa is Canada's capital city.",
              'Skate up the canal to Parliament Hill and find the Peace Tower. Then answer three questions.',
            ],
      /* The two choices are copy rows now (`TN-QUEST`), so the scan measures the
         strings the game draws rather than a fixture's copy of them. The lines
         above stay fixtures: they are the quest document's, and
         `content/quests/` is the content author's. */
      accept: { label: text(locale, 'quest.accept'), onSelect: () => undefined },
      decline: { label: text(locale, 'quest.decline'), onSelect: () => undefined },
    });
    break;
  }

  case 'card': {
    const card = createQuestionCard(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onAnswer: () => undefined,
      onNext: () => undefined,
      onDismiss: () => undefined,
    });
    card.present(QUESTION);
    /*
     * `?answered=<index>` takes an option, which is the state where the card
     * draws colour at all: a green fill on the right answer and a red one on the
     * answer taken. Both are judged by axe here rather than trusted — and the
     * default is a *wrong* answer, because that is the card at its busiest: two
     * fills, two marks, two state words, the explanation and "Next".
     */
    const answered = params.get('answered');
    if (answered !== null) {
      ui.querySelector<HTMLElement>(`[data-testid="option-${answered}"]`)?.click();
    }
    break;
  }

  case 'study': {
    const state = ((): StudyState => {
      switch (params.get('state')) {
        case 'empty':
          return { kind: 'empty' };
        case 'error':
          return {
            kind: 'error',
            message:
              locale === 'fr'
                ? "Nous n'avons pas pu charger les questions."
                : 'We could not load the questions.',
          };
        case 'summary':
          return {
            kind: 'summary',
            correct: 4,
            total: 5,
            returning: [QUESTION.prompt, QUESTION.options[1] ?? ''],
          };
        default:
          return { kind: 'ready', available: 12, drillSize: 5 };
      }
    })();

    createStudyScreen(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onStart: () => undefined,
      onExit: () => undefined,
      onAgain: () => undefined,
      onPractiseNew: () => undefined,
      onRetry: () => undefined,
    }).show(state);
    break;
  }

  case 'level-loading': {
    const loading = createLevelLoading(ui, {
      locale,
      title: waiting.title,
      /* This level's own sentence, from the table `TN-WAIT` owns. The screen
         takes it as data because the level owns the wording (`OQ-LEVEL-9`), and
         because one row for four levels is the defect (`TN-WAIT`). */
      message: waiting.loading,
      onBack: () => undefined,
      singleSwitch: store.current.singleSwitch,
    });
    loading.show();
    /* The stalled case is a state, not a wait: the escape is revealed on demand
       so a scan of it needs no timer. */
    if (params.get('stalled') === '1') loading.offerEscape();
    break;
  }

  case 'level-error': {
    createLevelError(ui, {
      locale,
      title: waiting.errorTitle,
      onRetry: () => undefined,
      onBack: () => undefined,
      singleSwitch: store.current.singleSwitch,
    }).show();
    break;
  }

  /*
   * The card a player reads when a level's task is finished (`TN-QUEST-04`).
   *
   * `?stamp=0` drops the stamp sentence, which is the state a level with no
   * `stamp.<id>.earned` row is in — every level but Ottawa today — and it is a
   * different accessibility question from the full card: the dialog has a name
   * and no description, and it must still read.
   */
  case 'complete': {
    /*
     * `?stamp=0` drops the stamp sentence; `?answered=0` drops the score line,
     * which is the card a player gets for **walking to the end of a level
     * without answering anything** — a real state since reaching the end is what
     * finishes a level, and a different accessibility question from the full
     * card: fewer descriptions, one fewer action, and the dialog still has to
     * read. `?next=0` takes the route into the new level away, which is the last
     * level in the chain and a replayed level.
     */
    const walkedPast = params.get('answered') === '0';
    const nothingOpened = params.get('next') === '0';
    /* `?reason=quest` is the quest path — "Task done!" — and the default is the
       path this card is drawn on most: the player reached the end of the level.
       They are two headings, and only one of them is true at a time. */
    const finishedAQuest = params.get('reason') === 'quest';
    createLevelComplete(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onChooseLevel: () => undefined,
      onKeepPlaying: () => undefined,
      onOpenPassport: () => undefined,
      ...(nothingOpened ? {} : { onPlayNext: () => undefined }),
    }).show({
      reason: finishedAQuest ? 'quest' : 'level',
      ...(params.get('stamp') === '0'
        ? {}
        : { stampMessage: text(locale, `stamp.${PLACE}.earned` as Parameters<typeof text>[1]) }),
      /* One slot, two rows, never both: the score when something was answered
         here and `level.complete.none` when nothing was. `?answered=0` is the
         second, which is the card a player gets for walking to the end without
         stopping — and the longest French sentence on the screen. */
      progressMessage: walkedPast
        ? text(locale, 'level.complete.none')
        : text(locale, 'level.complete.score', { correct: 2, total: 3 }),
      ...(nothingOpened
        ? {}
        : {
            next: {
              /* The level that just opened, exactly as the composition root
                 hands it over: that level's own `level.<id>.play` row, and the
                 map's own description of its card. */
              label: text(locale, 'level.quebec-city.play'),
              description: describeEntry(
                {
                  locale,
                  entries: [
                    { number: 3, id: 'quebec-city' as LevelId, built: true, unlocked: true },
                  ],
                  stampsToUnlock: 1,
                },
                'quebec-city' as LevelId,
              ) ?? '',
            },
          }),
    });
    break;
  }

  /*
   * The passport (`TN-PASSPORT`): ten slots, three states, and the empty state a
   * new player meets first.
   *
   * `?stamps=` chooses which: `none` is the beginning — no stamps, ten slots,
   * `passport-empty` — and the default earns one, so a scan sees "Earned" beside
   * "Not earned yet" and "Not made yet" on one page. That matters more here than
   * on most screens: the whole accessibility question is whether three states are
   * told apart without colour.
   */
  case 'passport': {
    const stamps = params.get('stamps') ?? 'one';
    createPassport(ui, {
      locale,
      entries: PLACES.map(([number, id]) => ({
        number,
        ...(id === undefined ? {} : { id: id as LevelId }),
        built: id !== undefined && ['halifax', 'quebec-city', 'ottawa', 'toronto'].includes(id),
        unlocked: id === 'halifax',
        stamped: stamps !== 'none' && id === 'ottawa',
      })),
      announce,
      singleSwitch: store.current.singleSwitch,
      onBack: () => undefined,
    }).show();
    break;
  }

  case 'poi': {
    createPoiCard(ui, {
      locale,
      announce,
      onClose: () => undefined,
      singleSwitch: store.current.singleSwitch,
    }).show(level.poi);
    break;
  }

  /*
   * The whole page, not a component: one `<main>` holding the `aria-hidden`
   * canvas and the HUD, with a modal over it when asked for. This is the page
   * `TN-HUD-07` describes, and it is the one the scan runs with axe's `region`
   * and `landmark-one-main` rules turned back on.
   */
  case 'level': {
    const game = document.getElementById('game');
    const hud = createHud(ui, {
      locale,
      announce,
      onPause: () => undefined,
      onResume: () => undefined,
      onOpenSettings: () => undefined,
      onOpenStudy: () => undefined,
      onOpenPassport: () => undefined,
      onInteract: () => undefined,
      onExportSave: () => undefined,
      singleSwitch: store.current.singleSwitch,
      ...(game === null ? {} : { canvasHost: game }),
    });

    hud.setMode(level.mode);
    if (params.get('task') === '1') hud.setTask(level.task);
    if (params.get('warning') === '1') hud.setStorageWarning(true);

    /*
     * The events arrive as an injected subscription, exactly as they will from
     * the composition root. The harness plays a short trace rather than
     * calling the HUD directly, so what is scanned is the wiring and not a
     * hand-placed prompt.
     */
    const listeners: ((event: LevelEvent) => void)[] = [];
    createLevelAnnouncer(
      (listener) => {
        listeners.push(listener);
        return () => undefined;
      },
      {
        locale,
        announce,
        arrival: level.arrival,
        failure: waiting.errorTitle,
        /*
         * The prompts are resolved the way the composition root resolves them —
         * through `app/ui/interact.ts`, from copy rows — rather than from this
         * fixture. That is the point of `TN-REACH`: the level document's landmark
         * name must never reach the HUD, so a harness that hand-fed one would
         * scan a page the game does not draw. `?done=1` is the third state.
         */
        targets: {
          'npc.officer': {
            prompt:
              interactPrompt(locale, {
                id: 'officer',
                kind: 'npc',
                done: params.get('done') === '1',
              }) ?? '',
          },
          /*
           * The other named character, and the one three levels place: the
           * guide. It is here so a scan can read the prompt the HUD draws for
           * it — `TN-GUIDE-03`'s defect was the *generic* row, "Talk to this
           * person", drawn about a beaver on the level the game opens on — and
           * resolved through `interactPrompt` like the officer's, so the
           * harness cannot hand-feed a string the game would not draw.
           */
          'npc.guide': {
            prompt:
              interactPrompt(locale, {
                id: 'guide',
                kind: 'npc',
                done: params.get('done') === '1',
              }) ?? '',
          },
          'poi.parliament-hill': {
            prompt:
              interactPrompt(locale, {
                id: 'parliament-hill',
                kind: 'poi',
                done: params.get('done') === '1',
              }) ?? '',
          },
        },
        onPrompt: (target) => {
          hud.setPrompt(target?.prompt ?? null);
        },
      },
    );

    const emit = (event: LevelEvent): void => {
      for (const listener of [...listeners]) listener(event);
    };
    emit({ name: 'level/ready' });
    if (params.get('prompt') === '1') {
      /* `?who=guide` puts the other character in reach. Anything else is the
         officer, so every existing scan is unchanged. */
      emit({
        name: 'poi/entered',
        detail: params.get('who') === 'guide' ? 'npc.guide' : 'npc.officer',
      });
      /* The one-time hint, beside the prompt and never instead of it
         (`TN-REACH-04`). It is a paragraph: it takes no focus, is in no tab
         order and is in no switch ring, which the scans assert. */
      if (params.get('hint') === '1') hud.setHint(interactHint(locale));
    }
    /* `TN-QUEST-05`: an answer step that cannot start says so, visibly as well
       as out loud, and blocks nothing. */
    if (params.get('notice') === '1') hud.setNotice(text(locale, 'quest.noQuestions'));

    /*
     * A modal over the running level. Mounted inside `<main>`: a dialog is not a
     * landmark, so a modal that sits beside `<main>` leaves its own content
     * outside every landmark and axe's `region` rule is right to say so.
     */
    switch (params.get('over')) {
      case 'menu':
        hud.openMenu();
        break;
      case 'settings':
        createSettingsScreen(hud.main, { store, announce, onClose: () => undefined }).show();
        break;
      case 'poi':
        createPoiCard(hud.main, {
          locale,
          announce,
          onClose: () => undefined,
          restoreFocusTo: () => hud.prompt,
        }).show(level.poi);
        break;
      case 'passport': {
        createPassport(hud.main, {
          locale,
          entries: mapEntries(['ottawa', 'halifax']),
          announce,
          singleSwitch: store.current.singleSwitch,
          onBack: () => undefined,
        }).show();
        break;
      }
      case 'card': {
        createQuestionCard(hud.main, {
          locale,
          announce,
          onAnswer: () => undefined,
          onNext: () => undefined,
          onDismiss: () => undefined,
        }).present(QUESTION);
        break;
      }
      default:
        break;
    }
    break;
  }

  /*
   * Exam mode's three screens (`TN-EXAM`, `TN-TIMER`, `TN-RESULT`, `TN-ATTEMPT`).
   *
   * Every state that matters to a scan is a parameter, because most of them
   * cannot be reached by clicking: a clock with four minutes left, an exam that
   * ran out of time, a saved attempt whose questions have left the build. The
   * numbers below are fixtures; the *words* all come from `app/ui/copy.ts`, so
   * what axe measures is the string the game draws.
   */
  case 'exam-start': {
    const state = ((): ExamStartState => {
      switch (params.get('state')) {
        case 'not-ready':
          return { kind: 'not-ready' };
        case 'error':
          return {
            kind: 'error',
            message: text(locale, 'study.error'),
          };
        case 'resume':
          return {
            kind: 'resume',
            answered: 12,
            total: 20,
            remainingMs: params.get('timer') === 'off' ? null : 14 * 60_000,
          };
        case 'gone':
          return { kind: 'gone' };
        default:
          return {
            kind: 'ready',
            questionCount: 20,
            passMark: 15,
            timeLimitMs: 1_800_000,
            /* `?subjects=0` is the build that cannot derive the number and
               therefore draws no line at all (`OQ-EXAM-5`). */
            ...(params.get('subjects') === '0'
              ? {}
              : { subjects: { ready: 1, total: 10 } }),
          };
      }
    })();

    const start = createExamStartScreen(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onStart: () => undefined,
      onContinue: () => undefined,
      onNewExam: () => undefined,
      onOpenStudy: () => undefined,
      onRetry: () => undefined,
      onBack: () => undefined,
    });
    start.show(state);
    /* `?timer=on` turns the switch on, which is the state with the fill, the
       tick and the state word "On" — the one a contrast scan has to see. */
    if (params.get('timer') === 'on') {
      ui.querySelector<HTMLElement>('[data-testid="exam-timer-toggle"]')?.click();
    }
    break;
  }

  case 'exam': {
    const total = 20;
    const chosen: (number | null)[] = Array.from({ length: total }, (_unused, index) =>
      params.get('answered') === 'all' || index < Number(params.get('answered') ?? '0')
        ? 1
        : null,
    );
    const at = Number(params.get('at') ?? '0');
    const timer = ((): ExamTimerView => {
      switch (params.get('timer')) {
        case 'running':
          return { kind: 'running', remainingMs: 30 * 60_000, paused: false };
        case 'last-minute':
          return { kind: 'running', remainingMs: 50_000, paused: false };
        case 'paused':
          return { kind: 'running', remainingMs: 20 * 60_000, paused: true };
        case 'stopped':
          return { kind: 'stopped' };
        default:
          return { kind: 'none' };
      }
    })();

    const exam = createExamScreen(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      storageBlocked: params.get('storage') === 'blocked',
      question: (index) =>
        index < 0 || index >= total
          ? null
          : {
              index,
              total,
              prompt: QUESTION.prompt,
              options: [...QUESTION.options],
              chosenIndex: chosen[index] ?? null,
            },
      answered: () => chosen.filter((value) => value !== null).length,
      unanswered: () => chosen.flatMap((value, index) => (value === null ? [index] : [])),
      timer: () => timer,
      onChoose: (index, chosenIndex) => {
        chosen[index] = chosenIndex;
        exam.refresh();
      },
      onFinish: () => undefined,
      onLeave: () => undefined,
      onOpenSettings: () => undefined,
      onStopTimer: () => undefined,
    });
    exam.show(Number.isFinite(at) ? at : 0);

    switch (params.get('over')) {
      case 'menu':
        ui.querySelector<HTMLElement>('[data-testid="exam-menu-button"]')?.click();
        break;
      case 'unanswered':
        ui.querySelector<HTMLElement>('[data-testid="exam-finish"]')?.click();
        break;
      case 'leave':
        ui.querySelector<HTMLElement>('[data-testid="exam-menu-button"]')?.click();
        ui.querySelector<HTMLElement>('[data-testid="exam-leave"]')?.click();
        break;
      default:
        break;
    }
    break;
  }

  case 'exam-result': {
    const passed = params.get('passed') !== '0';
    const correct = passed ? 17 : 11;
    const item = (
      chosenIndex: number | null,
      correctIndex: number,
      unavailable = false,
    ): ExamReviewItem =>
      unavailable
        ? { prompt: null, options: [], chosenIndex, correctIndex }
        : {
            prompt: QUESTION.prompt,
            options: [...QUESTION.options],
            chosenIndex,
            correctIndex,
            ...(QUESTION.explanation === undefined
              ? {}
              : { explanation: QUESTION.explanation }),
          };

    const result = createExamResult(ui, {
      locale,
      announce,
      singleSwitch: store.current.singleSwitch,
      onPractise: () => undefined,
      onAgain: () => undefined,
      onClose: () => undefined,
    });
    result.show({
      correct,
      total: 20,
      passMark: 15,
      passed,
      timed: params.get('timer') !== 'off',
      timeUp: params.get('timeup') === '1',
      unanswered: params.get('timeup') === '1' ? 4 : 0,
      subjects: [
        {
          id: 'government',
          name: text(locale, 'level.ottawa.subtitle'),
          correct: 8,
          total: 10,
        },
        {
          id: 'elections',
          name: text(locale, 'level.toronto.subtitle'),
          correct: 3,
          total: 5,
        },
        /* A subject this build cannot name keeps its numbers and loses its
           label (`TN-RESULT-07`), which is a different thing for a scan to
           read than a named row. */
        { id: 'who-we-are', name: null, correct: 2, total: 5 },
      ],
      subjectsReady: { ready: 1, total: 10 },
      /* Right, wrong, unanswered and gone — the four states a review item can
         be in, all on one page, because telling them apart without colour is
         the whole accessibility question here. */
      review: [item(0, 0), item(2, 1), item(null, 3), item(null, 0, true)],
    });
    if (params.get('over') === 'review') result.openReview();
    break;
  }

  /*
   * The shell: the game's front door, and the page a cold load lands on.
   *
   * This is the one case in this harness that is a whole *page* rather than a
   * component — a `<main>` landmark with real content in it — so its scan runs
   * with axe's `region` and `landmark-one-main` rules ON. See
   * `tests/a11y/shell.spec.ts`.
   */

  case 'shell': {
    const view = params.get('view') ?? 'title';
    const built =
      params.get('levels') === 'none'
        ? []
        : params.get('levels') === 'one'
          ? ['ottawa']
          : ['ottawa', 'halifax'];

    const shell = createShell(ui, {
      store,
      entries: mapEntries(built),
      stampsToUnlock: 1,
      creator: {
        slots: { en: slotsFor('en'), fr: slotsFor('fr') },
        /* First-run only when the creator is what is being scanned: otherwise
           Play would go through the creator and never reach the level select,
           which is the flow these scans are about. */
        required: view === 'creator',
        /* Fixed rather than random, so a scan is reproducible. */
        initialSelection: { skin: 'skin-3', hair: 'curly', coat: 'parka' },
      },
      announce,
      onPlayLevel: () => undefined,
      ...(params.get('resume') === '1' ? { resumeLevelId: 'ottawa' as LevelId } : {}),
      ...(params.get('study') === '1' ? { onOpenStudy: (): void => undefined } : {}),
      /* `passport.open` on the level select, which is the passport's home
         (`TN-PASSPORT-01`, `OQ-PASSPORT-3`): the stamp count is already on this
         screen, so the control that opens it belongs beside the count. */
      ...(params.get('passport') === '1' ? { onOpenPassport: (): void => undefined } : {}),
      ...(params.get('exam') === '1' ? { onOpenExam: (): void => undefined } : {}),
      examUnfinished: params.get('unfinished') === '1',
      ...(params.get('export') === '1' ? { onExportSave: (): void => undefined } : {}),
    });

    shell.start();
    if (params.get('storage') === 'blocked') shell.setStorageWarning(true);
    if (view === 'creator' || view === 'level-select') shell.show(view);
    break;
  }

  default:
    throw new Error(`unknown screen: ${screen}`);
}

/* The marker every scan waits for, so a spec fails on a missing screen rather
   than passing against an empty page. */
document.documentElement.setAttribute('data-tn-harness-ready', screen);
