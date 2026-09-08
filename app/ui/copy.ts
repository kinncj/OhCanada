/**
 * Every player-facing string the slice-1 DOM screens draw, in EN and FR.
 *
 * TODO(slice-1): move to content/locales and read through the LocalizerPort.
 * Same TODO, same reason, as `app/ui/rotate-overlay.ts` and
 * `app/ui/build-status.ts`: the locale bundle schema is being decided, and
 * inventing `content/locales/*.json` is the content agent's call. Keeping every
 * screen's copy in this one module — rather than a `COPY` table per file — is
 * what makes that move a single change instead of five.
 *
 * The wording is not this module's to choose. Every key below is transcribed
 * from a "Player-facing copy" table in `docs/stories/`; the story file is named
 * above each block. There are no exceptions left: {@link COPY_GAPS} is empty,
 * and the two strings that used to be missing — `hud.label` and `level.loading`
 * — are now rows here, transcribed from `TN-HUD` and `TN-LEVEL` like the rest.
 * See that constant for what stays a caller's option and why.
 *
 * Counted strings (`study.count`, `settings.holdTime.seconds`) are two rows and
 * are reached through {@link count}, never {@link text}: the type makes that a
 * compile error rather than a convention.
 *
 * DOM only (ADR-0005). No adapters, no scenes, no i18next.
 */

export type UiLocale = 'en' | 'fr';

/** Interpolation values for `{{name}}` placeholders. Primitives only. */
export type CopyParams = Readonly<Record<string, string | number>>;

/**
 * English, and the shape of the table. `FR` below is typed against
 * `keyof typeof EN`, so a French string that is missing or misspelt is a
 * compile error rather than a screen that silently speaks English —
 * `TN-CREATOR-09`'s "a missing French string is visible as a bug" enforced at
 * the only level available before the bundles exist.
 */
const EN = {
  /* docs/stories/TN-SET-settings.md */
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.language.en': 'English',
  'settings.language.fr': 'Français',
  'settings.autoMove': 'Move by itself',
  'settings.autoMove.help': 'You do not need to hold the screen.',
  'settings.singleSwitch': 'One-button mode',
  'settings.singleSwitch.help': 'Tap to move the highlight. Hold to choose.',
  'settings.holdTime': 'Hold time',
  'settings.holdTime.help': 'How long you hold the button to choose something.',
  'settings.holdTime.short': 'Short',
  'settings.holdTime.medium': 'Medium',
  'settings.holdTime.long': 'Long',
  'settings.holdTime.veryLong': 'Very long',
  'settings.holdTime.seconds.one': '{{seconds}} second',
  'settings.holdTime.seconds.other': '{{seconds}} seconds',
  'settings.reducedMotion': 'Less movement',
  'settings.highContrast': 'High contrast',
  'settings.dyslexiaFont': 'Easier-to-read font',
  'settings.textSize': 'Text size',
  'settings.subtitles': 'Subtitles',
  'settings.sound': 'Sound',
  'settings.sound.master': 'Overall',
  'settings.sound.music': 'Music',
  'settings.sound.sfx': 'Sound effects',
  'settings.sound.voice': 'Voices',
  'common.close': 'Close',
  'common.settings': 'Settings',

  /* docs/stories/TN-COPY-strings-and-counts.md owns these two, and only these
     two: no switch invents its own pair. They are drawn as a control's own
     state or after a colon, never concatenated into a sentence about the
     label — French adjectives agree and the switch labels do not share a
     gender, so the state word is a value and the invariable masculine is
     correct. */
  'settings.state.on': 'On',
  'settings.state.off': 'Off',

  /* docs/stories/TN-CREATOR-character-creator.md */
  'creator.title': 'Make your character',
  'creator.intro': 'Pick how you look. You can change this later in Settings.',
  'creator.slot.skin': 'Skin tone',
  'creator.slot.hair': 'Hair',
  'creator.slot.coat': 'Coat',
  'creator.randomise': 'Surprise me',
  'creator.start': 'Start playing',
  'creator.saveFailed':
    'We could not save your character. You can keep playing, but your choices may be lost.',
  'creator.retry': 'Try again',
  'creator.continue': 'Keep playing',

  /* docs/stories/TN-CARD-question-card.md */
  'card.progress': 'Question {{n}} of {{total}}',
  'card.kind.new': 'New',
  'card.kind.seen': 'Seen before',
  'card.correct': "That's right!",
  'card.wrong': 'Not quite.',
  'card.answerIs': 'The answer is: {{answer}}',
  'card.why': 'Why: {{explanation}}',
  'card.againSoon': 'You will see this question again soon.',
  'card.yourAnswer': 'Your answer',
  'card.correctAnswer': 'Correct answer',
  'card.next': 'Next',
  'card.finish': 'Finish',
  'card.close': 'Close',
  'card.closedNotice': 'No problem. We will ask again later.',

  /* docs/stories/TN-STUDY-study-mode.md */
  'study.open': 'Study',
  'study.title': 'Study',
  'study.intro': 'Practise the questions you have seen. There is no time limit.',
  'study.count.one': '{{n}} question',
  'study.count.other': '{{n}} questions',
  'study.start': 'Start',
  'study.empty.title': 'Nothing to review yet',
  'study.empty.body': 'Play a level and answer a few questions first.',
  'study.empty.practise': 'Practise new questions',
  'study.short.one': 'You have {{n}} question ready. We will ask it.',
  'study.short.other': 'You have {{n}} questions ready. We will ask those.',
  'study.error': 'We could not load the questions. Check your connection and try again.',
  'study.error.retry': 'Try again',
  'study.summary.title': 'Finished',
  'study.summary.score': 'You got {{correct}} out of {{total}} right.',
  'study.summary.comeBack': 'We will ask these again:',
  'study.summary.allRight': 'You got them all right.',
  'study.again': 'Study again',
  'study.exit': 'Back to the game',
  'study.leave': 'Leave',
  'study.leaveKept': 'Your answers so far are saved.',

  /* docs/stories/TN-QUEST-parliament-hill.md */
  'passport.open': 'See my passport',

  /* docs/stories/TN-HUD-hud-and-menu.md */
  /* The accessible name of the `hud` region (`TN-HUD-07`). It names what the
     region is *for*, and the story's table rules out "HUD", "Heads-up display",
     "Region", "Section" and the empty string by name — which is why the HUD
     draws this row rather than taking a name from its caller. */
  'hud.label': 'Game controls',
  'hud.menu': 'Menu',
  'hud.menu.title': 'Menu',
  /* docs/stories/TN-QUEST-parliament-hill.md — drawn by `hud-quest-tracker`. */
  'hud.task': 'Task',

  /* docs/stories/TN-SAVE-save-and-reload.md — the storage warning these screens
     raise, and the way out it has to offer (TN-HUD-03). */
  'storage.warning': 'This browser is not saving your progress.',
  'storage.warning.help':
    'You can keep playing, but everything will be gone when you close the tab.',
  'save.export': 'Save to a file',

  /* docs/stories/TN-LEVEL-ottawa.md */
  /* The waiting sentence `TN-LEVEL-01` asks for instead of a bare spinner,
     under `TN-COPY-07`'s waiting rule: it names the work and claims no progress
     the game cannot measure — no percentage, no fraction, no "2 of 4", no
     ellipsis, no bar with a value — and it does not change while the load runs.
     It names the canal, so it is Ottawa's; `OQ-LEVEL-9` keeps the key and lets
     each level own the wording, which is why `createLevelLoading` still takes
     the sentence as data. */
  'level.loading': 'Getting the canal ready.',
  'locomotion.skate.label': 'Skating',
  'level.error.title': 'We could not load Ottawa.',
  'level.error.body': 'Check your connection and try again.',
  'level.error.retry': 'Try again',
  'level.error.back': 'Go back',
  /* docs/stories/TN-TITLE-title-screen.md */
  /* `title.game` is the product's name and is the same string in both
     languages, like the language names in `TN-SET`. It is never translated. */
  'title.game': 'TrueNorth',
  'title.tagline': 'Get ready for the Canadian citizenship test.',
  /* On the first screen, not in a credits page nobody opens: this game teaches
     an official exam and is not from IRCC (`TN-TITLE-01`). */
  'title.notOfficial': 'This game is not made by the Government of Canada.',
  'title.play': 'Play',
  'title.continue': 'Continue',
  /* A label, not a sentence. "You were in Ottawa" needs a preposition in front
     of a place name and French does not use one preposition for all ten places
     (« à Ottawa », « dans le Nord »). The noun goes in front of the placeholder
     and nothing follows it — `TN-COPY`'s counting rule 1, applied to a
     preposition. */
  'title.lastPlayed': 'Last played: {{level}}',

  /* docs/stories/TN-MAP-level-select.md */
  'map.open': 'Choose a level',
  'map.title': 'Choose a level',
  'map.stamps': 'Stamps: {{earned}} of {{total}}',
  'map.levelsReady': 'Levels ready: {{ready}} of {{total}}',
  'map.moreComing': 'More are coming.',
  'map.state.open': 'Open',
  'map.state.locked': 'Locked',
  /* "Not made yet", never "Coming soon": "soon" is a promise with a date in it
     and this project has no date (`TN-MAP`, and `TN-MAP-04`'s "it is not drawn
     as an error"). Neither this row nor its help may acquire a date, a version
     number or a percentage. */
  'map.state.notBuilt': 'Not made yet',
  'map.open.help': 'You can play this now.',
  'map.locked.after': 'Finish {{level}} first.',
  'map.locked.stamps.one': 'Earn {{n}} more stamp to open this.',
  'map.locked.stamps.other': 'Earn {{n}} more stamps to open this.',
  'map.notBuilt.help': 'We are still making this level.',
  'map.number': 'Level {{n}}',

  /* docs/stories/TN-FLOW-first-run-and-return.md */
  'common.back': 'Back',
  'flow.leaveLevel': 'Leave the level',

  /* docs/stories/TN-LEVELS-2-to-10-spine.md owns the place name and the subject
     line for the nine levels that are not Ottawa; `TN-LEVEL-ottawa.md` owns
     Ottawa's pair. They are rows here because the map draws all ten and nine of
     them have no level document to carry their own text.

     Levels 2 and 10 have no id yet, so their rows are keyed on the map number.
     **Level 2 has a subject line and no place name**, and that is the rule
     working rather than an omission: naming a nation's territory as the setting
     of a level nobody may build yet states a plan this project has not earned
     the right to state (`docs/content-review.md` §1). `TN-MAP-04` requires the
     card to draw no placeholder in its place. */
  'level.halifax.title': 'Halifax',
  'level.halifax.subtitle': 'Rights and responsibilities',
  'level.2.subtitle': 'Who we are',
  'level.quebec-city.title': 'Québec City',
  'level.quebec-city.subtitle': "Canada's history",
  'level.ottawa.title': 'Ottawa',
  'level.ottawa.subtitle': 'How Canadians govern themselves',
  'level.toronto.title': 'Toronto',
  'level.toronto.subtitle': 'Federal elections',
  'level.winnipeg.title': 'Winnipeg',
  'level.winnipeg.subtitle': 'The justice system',
  'level.prairie-rail.title': 'The Prairies',
  'level.prairie-rail.subtitle': 'Modern Canada',
  'level.alberta-foothills.title': 'The Alberta foothills',
  'level.alberta-foothills.subtitle': "Canada's economy",
  'level.vancouver.title': 'Vancouver',
  'level.vancouver.subtitle': 'Canadian symbols',
  'level.10.title': 'The North',
  'level.10.subtitle': "Canada's regions",
} as const;

/** Every row in the table, plural forms included. */
type CopyRow = keyof typeof EN;

/**
 * A plural row: `study.count.one`, `settings.holdTime.seconds.other`.
 *
 * `TN-COPY-strings-and-counts.md` rule 3 — "the category is chosen by
 * `Intl.PluralRules` for the active locale, never by `n === 1`" — is enforced
 * here rather than asked for in a comment: {@link CopyKey} subtracts these rows,
 * so {@link text} cannot name one and the only way to reach a counted string is
 * {@link count}, which asks `Intl`. A hand-written `n === 1 ? a : b` does not
 * compile, which is a stronger guarantee than a review catching it.
 */
type PluralRow = CopyRow & (`${string}.one` | `${string}.other`);

/** A key {@link text} can draw: everything except a plural form. */
export type CopyKey = Exclude<CopyRow, PluralRow>;

/**
 * A counted string, named without its form: `study.count`, not
 * `study.count.other`. Every base here declares both forms in both languages,
 * which the unit suite checks — `TN-COPY-03`, "a count key without both forms
 * fails the check".
 */
type BaseOf<T> = T extends `${infer Base}.${'one' | 'other'}` ? Base : never;
export type CountKey = BaseOf<PluralRow>;

/**
 * Canadian French typography, as `docs/stories/README.md` fixes it: no space
 * before `?` or `!`, a space before `:`. Vouvoiement throughout (`OQ-STYLE-1`).
 * No string here requires gender agreement about the player
 * (`docs/content-review.md` §8.6) — asserted in the unit suite, not trusted.
 */
const FR: Readonly<Record<CopyRow, string>> = {
  'settings.title': 'Réglages',
  'settings.language': 'Langue',
  'settings.language.en': 'English',
  'settings.language.fr': 'Français',
  'settings.autoMove': 'Déplacement automatique',
  'settings.autoMove.help': "Vous n'avez pas besoin de garder le doigt sur l'écran.",
  'settings.singleSwitch': 'Mode à un bouton',
  'settings.singleSwitch.help': 'Touchez pour déplacer la sélection. Maintenez pour choisir.',
  'settings.holdTime': 'Durée du maintien',
  'settings.holdTime.help': 'Le temps que vous devez maintenir le bouton pour choisir.',
  'settings.holdTime.short': 'Courte',
  'settings.holdTime.medium': 'Moyenne',
  'settings.holdTime.long': 'Longue',
  'settings.holdTime.veryLong': 'Très longue',
  'settings.holdTime.seconds.one': '{{seconds}} seconde',
  'settings.holdTime.seconds.other': '{{seconds}} secondes',
  'settings.reducedMotion': 'Moins de mouvement',
  'settings.highContrast': 'Contraste élevé',
  'settings.dyslexiaFont': 'Police plus lisible',
  'settings.textSize': 'Taille du texte',
  'settings.subtitles': 'Sous-titres',
  'settings.sound': 'Son',
  'settings.sound.master': 'Général',
  'settings.sound.music': 'Musique',
  'settings.sound.sfx': 'Effets sonores',
  'settings.sound.voice': 'Voix',
  'common.close': 'Fermer',
  'common.settings': 'Réglages',

  'settings.state.on': 'Activé',
  'settings.state.off': 'Désactivé',

  'creator.title': 'Créez votre personnage',
  'creator.intro': "Choisissez votre apparence. Vous pourrez la changer plus tard dans les Réglages.",
  'creator.slot.skin': 'Teint de peau',
  'creator.slot.hair': 'Cheveux',
  'creator.slot.coat': 'Manteau',
  'creator.randomise': 'Au hasard',
  'creator.start': 'Commencer à jouer',
  'creator.saveFailed':
    "Nous n'avons pas pu enregistrer votre personnage. Vous pouvez continuer à jouer, mais vos choix pourraient être perdus.",
  'creator.retry': 'Réessayer',
  'creator.continue': 'Continuer quand même',

  'card.progress': 'Question {{n}} sur {{total}}',
  'card.kind.new': 'Nouvelle',
  'card.kind.seen': 'Déjà vue',
  'card.correct': "C'est exact!",
  'card.wrong': 'Pas tout à fait.',
  'card.answerIs': 'La bonne réponse est : {{answer}}',
  'card.why': 'Pourquoi : {{explanation}}',
  'card.againSoon': 'Vous reverrez cette question bientôt.',
  'card.yourAnswer': 'Votre réponse',
  'card.correctAnswer': 'Bonne réponse',
  'card.next': 'Suivant',
  'card.finish': 'Terminer',
  'card.close': 'Fermer',
  'card.closedNotice': 'Pas de problème. Nous reposerons la question plus tard.',

  'study.open': 'Réviser',
  'study.title': 'Révision',
  'study.intro':
    "Exercez-vous avec les questions que vous avez déjà vues. Il n'y a aucune limite de temps.",
  'study.count.one': '{{n}} question',
  'study.count.other': '{{n}} questions',
  'study.start': 'Commencer',
  'study.empty.title': "Rien à réviser pour l'instant",
  'study.empty.body': "Jouez d'abord à un niveau et répondez à quelques questions.",
  'study.empty.practise': "S'exercer avec de nouvelles questions",
  'study.short.one': 'Vous avez {{n}} question prête. Nous poserons celle-là.',
  'study.short.other': 'Vous avez {{n}} questions prêtes. Nous poserons celles-là.',
  'study.error':
    "Nous n'avons pas pu charger les questions. Vérifiez votre connexion et réessayez.",
  'study.error.retry': 'Réessayer',
  'study.summary.title': 'Terminé',
  'study.summary.score': 'Bonnes réponses : {{correct}} sur {{total}}',
  'study.summary.comeBack': 'Nous reposerons ces questions :',
  'study.summary.allRight': 'Vous avez tout bon.',
  'study.again': 'Réviser encore',
  'study.exit': 'Retour au jeu',
  'study.leave': 'Quitter',
  'study.leaveKept': 'Vos réponses sont enregistrées.',

  'passport.open': 'Voir mon passeport',

  'hud.label': 'Commandes du jeu',
  'hud.menu': 'Menu',
  'hud.menu.title': 'Menu',
  'hud.task': 'Mission',

  'storage.warning': "Ce navigateur n'enregistre pas votre progression.",
  'storage.warning.help':
    "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet.",
  'save.export': 'Enregistrer dans un fichier',

  'level.loading': 'Préparation du canal.',
  'locomotion.skate.label': 'Patinage',
  'level.error.title': "Nous n'avons pas pu charger Ottawa.",
  'level.error.body': 'Vérifiez votre connexion et réessayez.',
  'level.error.retry': 'Réessayer',
  'level.error.back': 'Retour',
  'title.game': 'TrueNorth',
  'title.tagline': "Préparez-vous à l'examen de citoyenneté canadienne.",
  'title.notOfficial': "Ce jeu n'est pas fait par le gouvernement du Canada.",
  'title.play': 'Jouer',
  'title.continue': 'Continuer',
  'title.lastPlayed': 'Dernier niveau : {{level}}',

  'map.open': 'Choisir un niveau',
  'map.title': 'Choisir un niveau',
  'map.stamps': 'Timbres : {{earned}} sur {{total}}',
  'map.levelsReady': 'Niveaux prêts : {{ready}} sur {{total}}',
  'map.moreComing': "D'autres arrivent.",
  'map.state.open': 'Ouvert',
  'map.state.locked': 'Verrouillé',
  'map.state.notBuilt': 'Pas encore créé',
  'map.open.help': 'Vous pouvez y jouer maintenant.',
  'map.locked.after': "Terminez d'abord {{level}}.",
  'map.locked.stamps.one': 'Gagnez encore {{n}} timbre pour ouvrir ce niveau.',
  'map.locked.stamps.other': 'Gagnez encore {{n}} timbres pour ouvrir ce niveau.',
  'map.notBuilt.help': 'Ce niveau est encore en préparation.',
  'map.number': 'Niveau {{n}}',

  'common.back': 'Retour',
  'flow.leaveLevel': 'Quitter le niveau',

  'level.halifax.title': 'Halifax',
  'level.halifax.subtitle': 'Droits et responsabilités',
  'level.2.subtitle': 'Qui nous sommes',
  'level.quebec-city.title': 'Ville de Québec',
  'level.quebec-city.subtitle': "L'histoire du Canada",
  'level.ottawa.title': 'Ottawa',
  'level.ottawa.subtitle': 'Comment les Canadiens se gouvernent',
  'level.toronto.title': 'Toronto',
  'level.toronto.subtitle': 'Les élections fédérales',
  'level.winnipeg.title': 'Winnipeg',
  'level.winnipeg.subtitle': 'Le système de justice',
  'level.prairie-rail.title': 'Les Prairies',
  'level.prairie-rail.subtitle': 'Le Canada moderne',
  'level.alberta-foothills.title': 'Les contreforts de l\'Alberta',
  'level.alberta-foothills.subtitle': "L'économie du Canada",
  'level.vancouver.title': 'Vancouver',
  'level.vancouver.subtitle': 'Les symboles canadiens',
  'level.10.title': 'Le Nord',
  'level.10.subtitle': 'Les régions du Canada',
};

/**
 * Strings this module had to write because no story table carries them.
 *
 * Empty, and it is meant to stay empty. `settings.state.on` / `.off`,
 * `hud.label` and `level.loading` were each reported as a gap and are each
 * written down now — in `TN-COPY-strings-and-counts.md`, `TN-HUD` and
 * `TN-LEVEL` — so nothing in this table is invented: every row above is
 * transcribed from a "Player-facing copy" table and names the story file it
 * came from.
 *
 * The two closed gaps landed differently, on purpose:
 *
 *  - `hud.label` is drawn here by the HUD itself, like `hud.menu`. It is one
 *    name for the whole game, `TN-HUD-09` requires it to become French when the
 *    player changes language without reloading the level, and `TN-HUD`'s table
 *    rules out "HUD", "Region" and the empty string — none of which a
 *    caller-supplied `string` can be stopped from being. A row the region reads
 *    itself is stronger than a required option: the name cannot be omitted *or*
 *    replaced with a wrong one.
 *  - `level.loading` stays a **required option** on `createLevelLoading`. The
 *    sentence names the canal, `OQ-LEVEL-9` keeps the wording with the level
 *    that waits, and under ADR-0010 a level file carries its own text — so the
 *    screen takes it as data and Ottawa's caller passes this row. Required, not
 *    defaulted: a screen that waits without saying what for is `TN-LEVEL-01`'s
 *    named defect, and a required option cannot be forgotten.
 *
 * The unit suite asserts this list is empty *and* that the marker this module
 * used to carry beside an invented string survives nowhere in the source, so a
 * new one cannot slip in unlisted.
 */
export const COPY_GAPS: readonly CopyKey[] = [];

const TABLES: Readonly<Record<UiLocale, Readonly<Record<CopyRow, string>>>> = {
  en: EN,
  fr: FR,
};

export const UI_LOCALES: readonly UiLocale[] = ['en', 'fr'];

/** Narrow an arbitrary string to a locale this UI can draw. */
export function isUiLocale(value: unknown): value is UiLocale {
  return value === 'en' || value === 'fr';
}

/**
 * Resolve a key for a locale, interpolating `{{name}}` placeholders.
 *
 * A placeholder with no matching parameter is left as written rather than
 * replaced with an empty string: "Question {{n}} of 3" on screen is a visible
 * bug, "Question  of 3" is a plausible-looking one.
 */
export function text(locale: UiLocale, key: CopyKey, params?: CopyParams): string {
  const template = TABLES[locale][key];
  return params === undefined ? template : interpolate(template, params);
}

function interpolate(template: string, params: CopyParams): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The CLDR locale each UI locale formats numbers and plurals with. */
function intlLocale(locale: UiLocale): 'fr-CA' | 'en-CA' {
  return locale === 'fr' ? 'fr-CA' : 'en-CA';
}

/**
 * A number written the way the language writes it — "0.3" in English,
 * « 0,3 » in French (`docs/stories/README.md`, French style: "numbers are
 * formatted for the locale, never concatenated").
 */
export function formatNumber(locale: UiLocale, value: number): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(value);
}

/**
 * The plural category `Intl` gives this locale for this number.
 *
 * The whole reason this function exists rather than a comparison: English and
 * French disagree at zero — `0` is `other` in English ("0 questions") and `one`
 * in French (« 0 question ») — and they disagree again at 0.3, which French
 * treats as singular. A rule written for one language is wrong in the other, and
 * `Intl` already knows both.
 */
export function pluralCategory(locale: UiLocale, value: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(intlLocale(locale)).select(value);
}

/**
 * Draw a counted string: `count('fr', 'study.count', 0)` → « 0 question ».
 *
 * The category comes from {@link pluralCategory}; a category the table does not
 * carry falls back to `other` visibly rather than throwing, because a screen
 * that renders nothing is worse than one that renders the wrong ending — and
 * `TN-COPY-03` has already failed the build for the missing row by then.
 *
 * `{{n}}` is filled with the locale-formatted number. Extra placeholders (the
 * hold-time control's `{{seconds}}`) come from `params`.
 */
export function count(
  locale: UiLocale,
  key: CountKey,
  value: number,
  params?: CopyParams,
): string {
  const category = pluralCategory(locale, value);
  const table = TABLES[locale];
  const wanted = `${key}.${category}` as CopyRow;
  const row = wanted in table ? wanted : (`${key}.other` as CopyRow);
  return interpolate(table[row], { n: formatNumber(locale, value), ...params });
}

/**
 * The plural forms of a counted string that arrives as **data** rather than as a
 * row in the table above.
 *
 * `count` is the right tool for a string this module owns. Some strings it does
 * not own: the level select's "how many stamps open this place" is supplied by
 * the caller, because no story table carries it yet. A caller holding two
 * strings is one `n === 1` away from being wrong in French, where zero is
 * singular — so the forms come in as data and the *choice between them* stays
 * here, on `Intl.PluralRules`, where `count` already makes it.
 *
 * `other` is required by the type: it is the only category every locale has, so
 * a caller cannot supply a set of forms that has no answer.
 */
export type PluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & {
  readonly other: string;
};

/**
 * Draw a counted string from caller-supplied forms.
 *
 * `{{n}}` is filled with the locale-formatted number, exactly as {@link count}
 * fills it; extra placeholders come from `params`.
 */
export function pluralise(
  locale: UiLocale,
  forms: PluralForms,
  value: number,
  params?: CopyParams,
): string {
  const category = pluralCategory(locale, value);
  const template = forms[category] ?? forms.other;
  return interpolate(template, { n: formatNumber(locale, value), ...params });
}

/**
 * "Hair: Curly" / « Cheveux : Bouclés ».
 *
 * Canadian French puts a space before a colon and English does not
 * (`docs/stories/README.md`, French style), and this pairing is written in four
 * places — the announcer, the creator's preview, the settings announcements —
 * so the rule lives here rather than four times.
 */
export function labelled(locale: UiLocale, label: string, value: string): string {
  return locale === 'fr' ? `${label} : ${value}` : `${label}: ${value}`;
}

/**
 * A percentage the way each language writes it — "150%" in English,
 * « 150 % » with a non-breaking space in French. `Intl` knows this; hardcoding
 * it would be authoring copy.
 */
export function percent(locale: UiLocale, value: number): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

/**
 * The browser's preferred language, narrowed (`OQ-SET-2`: start in French when
 * the browser asks for French, otherwise English; the player's own choice wins
 * from then on and is applied by the caller, not here).
 */
export function preferredLocale(languages: readonly string[]): UiLocale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return 'en';
}
