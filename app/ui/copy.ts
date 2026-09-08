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
 * above each block. Keys marked `NEEDS_COPY` are the exceptions and are listed
 * in {@link COPY_GAPS} so they are greppable and reportable rather than quietly
 * authored here.
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

  /* NEEDS_COPY — see COPY_GAPS. A switch has to say its state as a word
     (TN-SET-07: "while still showing its state as a word"), and no table gives
     one. */
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
  'study.count': '{{n}} questions',
  'study.start': 'Start',
  'study.empty.title': 'Nothing to review yet',
  'study.empty.body': 'Play a level and answer a few questions first.',
  'study.empty.practise': 'Practise new questions',
  'study.short': 'You have {{n}} questions ready. We will ask those.',
  'study.summary.title': 'Finished',
  'study.summary.score': 'You got {{correct}} out of {{total}} right.',
  'study.summary.comeBack': 'We will ask these again:',
  'study.summary.allRight': 'You got them all right.',
  'study.again': 'Study again',
  'study.exit': 'Back to the game',
  'study.leave': 'Leave',
  'study.leaveKept': 'Your answers so far are saved.',

  /* docs/stories/TN-SAVE-save-and-reload.md — the storage warning these screens raise. */
  'storage.warning': 'This browser is not saving your progress.',
  'storage.warning.help':
    'You can keep playing, but everything will be gone when you close the tab.',

  /* docs/stories/TN-LEVEL-ottawa.md */
  'level.error.retry': 'Try again',
} as const;

export type CopyKey = keyof typeof EN;

/**
 * Canadian French typography, as `docs/stories/README.md` fixes it: no space
 * before `?` or `!`, a space before `:`. Vouvoiement throughout (`OQ-STYLE-1`).
 * No string here requires gender agreement about the player
 * (`docs/content-review.md` §8.6) — asserted in the unit suite, not trusted.
 */
const FR: Readonly<Record<CopyKey, string>> = {
  'settings.title': 'Réglages',
  'settings.language': 'Langue',
  'settings.language.en': 'English',
  'settings.language.fr': 'Français',
  'settings.autoMove': 'Déplacement automatique',
  'settings.autoMove.help': "Vous n'avez pas besoin de garder le doigt sur l'écran.",
  'settings.singleSwitch': 'Mode à un bouton',
  'settings.singleSwitch.help': 'Touchez pour déplacer la sélection. Maintenez pour choisir.',
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
  'study.count': '{{n}} questions',
  'study.start': 'Commencer',
  'study.empty.title': "Rien à réviser pour l'instant",
  'study.empty.body': "Jouez d'abord à un niveau et répondez à quelques questions.",
  'study.empty.practise': "S'exercer avec de nouvelles questions",
  'study.short': 'Vous avez {{n}} questions prêtes. Nous poserons celles-là.',
  'study.summary.title': 'Terminé',
  'study.summary.score': 'Vous avez {{correct}} bonnes réponses sur {{total}}.',
  'study.summary.comeBack': 'Nous reposerons ces questions :',
  'study.summary.allRight': 'Vous avez tout bon.',
  'study.again': 'Réviser encore',
  'study.exit': 'Retour au jeu',
  'study.leave': 'Quitter',
  'study.leaveKept': 'Vos réponses sont enregistrées.',

  'storage.warning': "Ce navigateur n'enregistre pas votre progression.",
  'storage.warning.help':
    "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet.",

  'level.error.retry': 'Réessayer',
};

/**
 * Strings this module had to write because no story table carries them. They
 * are reported upward with the task, not buried: a UI agent authoring copy is
 * exactly what `docs/stories/README.md` forbids ("Where a string is not written
 * here, it is an open question in that file, not a licence to improvise").
 *
 * A unit test asserts this list matches the keys marked NEEDS_COPY above, so a
 * sixth invented string cannot slip in unlisted.
 */
export const COPY_GAPS: readonly CopyKey[] = ['settings.state.on', 'settings.state.off'];

const TABLES: Readonly<Record<UiLocale, Readonly<Record<CopyKey, string>>>> = {
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
  if (params === undefined) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
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
