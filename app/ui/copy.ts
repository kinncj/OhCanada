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
 * above each block. The exceptions are the rows {@link COPY_GAPS} declares;
 * see that constant for why each was written here and what stays a caller's
 * option.
 *
 * **A key that names a level carries the level's id.** `level.loading` and
 * `level.error.title` — one row each, for whichever level happened to have a
 * story — are how Halifax came to tell a player it was getting the canal ready
 * and to name Ottawa when it failed. The rows are `level.<id>.loading` and
 * `level.<id>.error.title` now, and the unqualified spellings are refused by
 * `tests/unit/ui/copy.test.ts` rather than merely absent.
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
  /* An appearance control on a screen of accessibility switches, and here
     anyway: it is where `creator.intro` sends the player, so it is where the
     promise is kept. Neither language agrees with the player — « personnage »
     is masculine whoever is playing. */
  'settings.character': 'Change my character',
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

  /* docs/stories/TN-CREATOR-character-creator.md — the screen's own chrome. It
     owns no slot label and no option name; those are the two blocks below. */
  'creator.title': 'Make your character',
  'creator.intro': 'Pick how you look. You can change this later in Settings.',
  'creator.preview.label': 'Your character',
  'creator.randomise': 'Surprise me',
  'creator.start': 'Start playing',
  'creator.saveFailed':
    'We could not save your character. You can keep playing, but your choices may be lost.',
  'creator.retry': 'Try again',
  'creator.continue': 'Keep playing',

  /* docs/stories/TN-FIRSTRUN-choosing-a-character-before-playing.md — the
     primary control when this screen was opened from Settings. Exactly one of
     `creator.start` and `creator.done` is drawn, because each is named for
     where it goes. */
  'creator.done': 'Done',

  /* docs/stories/TN-LOOK-what-the-player-can-choose.md — five of the six slots
     and thirteen of the twenty-two options. `TN-SKIN` owns the six skin tones;
     the sixth slot's label and three options are `COPY_GAPS` rows.

     **The key is derived from the rig, by one rule, in two shapes.** A slot row
     is `creator.slot.<slotName>` and an option row is
     `creator.<slotName>.<optionId>`, both spelled exactly as
     `content/characters/rig.json` spells them. That is why
     `creator.skin.skin-1` stutters and stays: a key a gate can generate from
     the rig needs no mapping table, and a prettier key is a table somebody
     maintains and eventually gets wrong.

     `creator.slot.hair` and `creator.slot.coat` are deleted rather than
     reworded. The first named a slot the rig split in two on purpose; the
     second named `costume`, which is not player-selectable and says which
     character an artboard is.

     `headCovering.none` and `feature.none` are two rows and never one: "None"
     and "No" are two words, and one shared row would be one row saying two
     things. */
  'creator.slot.skin': 'Skin tone',
  'creator.slot.hairShape': 'Hair',
  'creator.slot.hairColour': 'Hair colour',
  'creator.slot.headCovering': 'Head covering',
  'creator.slot.feature': 'Glasses',
  'creator.hairShape.crop': 'Short',
  'creator.hairShape.coil': 'Tight curls',
  'creator.hairShape.bob': 'Chin length',
  'creator.hairShape.long': 'Long',
  'creator.hairColour.black': 'Black',
  'creator.hairColour.brown': 'Brown',
  'creator.hairColour.blond': 'Blond',
  'creator.hairColour.red': 'Red',
  'creator.hairColour.grey': 'Grey',
  'creator.headCovering.none': 'None',
  'creator.headCovering.toque': 'Toque',
  'creator.feature.none': 'No',
  'creator.feature.glasses': 'Yes',
  'creator.optionGone':
    'One of your choices is not in this version. We picked a new one. You can change it here.',

  /* docs/stories/TN-SKIN-naming-the-six-skin-tones.md — an ordinal and a
     lightness band shared by two options, so no tone is the marked case and
     none is the unremarkable one. The band word is a measurement of
     `assets/style/palette.json`, asserted by
     `tests/unit/ui/skin-tone-names-are-measured.test.ts`. The noun lives on
     `creator.slot.skin`, so the live region reads "Skin tone: 4, medium" and
     never "Skin tone: Skin tone 4". */
  'creator.skin.skin-1': '1, light',
  'creator.skin.skin-2': '2, light',
  'creator.skin.skin-3': '3, medium',
  'creator.skin.skin-4': '4, medium',
  'creator.skin.skin-5': '5, dark',
  'creator.skin.skin-6': '6, dark',

  /* The character creator's rows no story table carries yet. **Written by
     app/ui, and every one is listed in {@link COPY_GAPS}**, to be ratified or
     replaced by `TN-SKIN` and `TN-LOOK`'s owner rather than left looking
     reviewed.

     `creator.slot.skin.help` is the line under the skin group's heading. The
     six names already say where each tone sits; this says which way the
     numbers run, once, on the group — so no single tone is the one described
     as an end (`TN-SKIN` ruling 4), and it is "dark", never "deep" (ruling 6).

     `creator.slot.presentation` and its three options name the rig's
     `presentation` slot, and are drawn only once the rig offers it. "Style",
     not "Gender": the slot draws how the character looks and claims nothing
     about who the player is (`docs/content-review.md` §8.6 — labelled by what
     is visible, never "Boy" or "Girl"). "Style" rather than "Look", because
     "Look: Neutral" can be read as an order. "Neutral" rather than "Neither",
     because the value is read alone in the preview and the live region —
     "Style: Neither" says nothing on its own. "Style" is the same word in
     French, and is written out in both on purpose. */
  'creator.slot.skin.help': 'From light to dark',
  'creator.slot.presentation': 'Style',
  'creator.presentation.feminine': 'Feminine',
  'creator.presentation.masculine': 'Masculine',
  'creator.presentation.neutral': 'Neutral',

  /* docs/stories/TN-CARD-question-card.md */
  'card.progress': 'Question {{n}} of {{total}}',
  /* A sentence rather than a lone word (ADR-0036). "New", alone at the top of a
     card, read as a label nobody explained — a new what? These say what the tag
     is about, and still say nothing about how questions are chosen
     (`TN-CARD-02`). Listed in `COPY_GAPS` until `TN-CARD`'s table is amended. */
  'card.kind.new': 'New question',
  'card.kind.seen': 'You have seen this question before',
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
  /* **Ratified 2026-09-17 and transcribed from `TN-STUDY-study-mode.md`**, whose
     table carries it as a row like any other — so it is no longer a
     {@link COPY_GAPS} entry. The English is taken exactly as this module
     proposed it. What it replaced — "Practise the questions you have seen." —
     was untrue for the player most likely to read it: on a brand-new profile
     Study draws from the whole bank, so the third live-site audit found the
     sentence above five cards every one of which was tagged "New question".
     This one is true on the first drill and on the hundredth, and the card still
     says of each question whether it is new or seen. `TN-STUDY-01`,
     `TN-STUDY-08` and `TN-STUDY-10` quote it. */
  'study.intro': 'Practise questions for the citizenship test. There is no time limit.',
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

  /* docs/stories/TN-EXAM-starting-and-answering.md */
  /* The practice exam, and it says **practice** on every screen that names it:
     this game is not from IRCC (`title.notOfficial`), and a screen that says
     "Exam" to somebody preparing for a real test they are anxious about is one
     word away from being read as the real thing (`TN-EXAM`, decision 1).

     No number is written into a row here. `exam.rules.length` and
     `exam.rules.pass` carry `exam.questionCount` and `exam.passMark` from
     `content/game.config.json` as placeholders, and they are two rows rather
     than one because a plural category is chosen once per string — "The exam has
     20 questions. You need 15 out of 20 to pass." carries two counted nouns
     behind two different numbers, and at a pass mark of one the French would
     draw the wrong ending whichever placeholder the form came from
     (`TN-COPY` rule 9). */
  'exam.open': 'Practice exam',
  'exam.title': 'Practice exam',
  'exam.intro': 'This is a practice exam in the same shape as the real test.',
  'exam.rules.length.one': 'The exam has {{count}} question.',
  'exam.rules.length.other': 'The exam has {{count}} questions.',
  'exam.rules.pass': 'You need {{pass}} out of {{count}} to pass.',
  'exam.noFeedback': 'You will see how you did at the end.',
  'exam.changeAnswers': 'You can go back and change an answer before you finish.',
  'exam.subjectsReady': 'Subjects ready: {{ready}} of {{total}}',
  'exam.subjects.help': 'This exam only asks about the subjects that are ready.',
  'exam.start': 'Start the exam',
  'exam.previous': 'Previous',
  /* The same two words as `card.next` and a separate key on purpose, for the
     reason `study.error.retry` and `level.error.retry` are separate: `card.next`
     moves past feedback the player has just read, `exam.next` moves between
     questions nobody has been marked on yet, and either may be reworded without
     the other. Nothing draws both at once. */
  'exam.next': 'Next',
  'exam.finish': 'Finish the exam',
  'exam.answered': 'Answers given: {{done}} of {{total}}',
  'exam.notAnsweredYet': 'Not answered yet',
  'exam.unanswered.one': 'You have not answered {{n}} question.',
  'exam.unanswered.other': 'You have not answered {{n}} questions.',
  'exam.goToUnanswered': 'Go to the first one you skipped',
  'exam.finishAnyway': 'Finish anyway',
  'exam.notReady.title': 'The exam is not ready yet',
  'exam.notReady.body':
    'We are still writing the questions. You can practise in Study instead.',

  /* docs/stories/TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md */
  /* The exam's own menu, and not the HUD's.

     `exam-screen` drew `hud.menu` and `hud.menu.title` until these two rows
     existed, and `TN-HUD-02` says in as many words that the HUD's menu belongs
     to a level and that Exam mode does not use it. A screen drawing another
     screen's keys is how the two stop being able to differ, and these two must
     be able to: one of them offers "Leave the level", and one of them opens over
     the only surface in this game that can be lost.

     **The control matches `hud.menu` word for word and the dialog's name does
     not.** One word for one thing wherever a player can see which screen they
     are on; a name that says *which* menu this is where they cannot — "Menu,
     dialog" tells somebody who cannot see the exam behind it nothing about where
     they are, and "Exam menu, dialog" confirms in two words that the exam is
     still there.

     It is "Exam menu" and not "Practice exam menu": a player reading this name
     has already passed `title.exam`, `exam.title` and `exam.start`, and a fourth
     restatement is length a screen-reader user pays for on every open
     (`OQ-EXAMMENU-1`).

     `exam.menu` is the same word in both languages and is written twice, never
     shared — `TN-MOVE-06` and `TN-NAMES-03`'s rule, and the reason
     `locomotion.train.label` is two rows. */
  'exam.menu': 'Menu',
  'exam.menu.title': 'Exam menu',

  /* docs/stories/TN-TIMER-the-exam-clock.md */
  /* The one clock this game is allowed, and every word it can say.

     **The limit is a separate row from the label.** "Use the 30-minute timer"
     writes a configuration number into a sentence, and `timeLimitSeconds` is
     configuration: `exam.timer.use` carries no number and `exam.timer.limit`
     carries it with both forms in both languages, drawn beside the switch as its
     value. `settings.state.on` and `settings.state.off` are the words the switch
     shows; this block invents no third pair.

     `exam.timer.left` is a counted noun because there is no honest way to write
     "26 minutes left" with a preposition after the number, so it takes
     `TN-COPY`'s rule 2 and carries both forms in both languages —
     « Il reste 1 minutes » is the defect that rule exists to prevent. Below one
     minute the clock says so in words rather than counting seconds: a per-second
     display is motion nobody asked for and is the difference between a limit and
     a pressure (`TN-TIMER` rule 2). */
  'exam.timer.use': 'Use the timer',
  'exam.timer.help':
    'The real test has a time limit. With the timer off, you can take as long as you like.',
  'exam.timer.limit.one': '{{n}} minute',
  'exam.timer.limit.other': '{{n}} minutes',
  'exam.timer.left.one': '{{n}} minute left',
  'exam.timer.left.other': '{{n}} minutes left',
  'exam.timer.lessThanMinute': 'Less than 1 minute left',
  'exam.timer.paused': 'Timer paused',
  'exam.timer.off': 'No timer. Take as long as you like.',
  'exam.timer.stop': 'Turn the timer off',
  'exam.timer.stopped': 'The timer is off. You can take as long as you like.',
  'exam.timer.timeUp.title': 'Time is up',
  'exam.timer.timeUp.body': 'We marked the questions you answered.',

  /* docs/stories/TN-RESULT-exam-results.md */
  /* A count of right answers, never a percentage, a grade, a letter, a star, a
     streak or a rank — and never a word that calls the player a failure. The
     heading under the pass mark is "Not this time" and the sentence under it is
     arithmetic, not judgement (`TN-RESULT`, and `TN-CARD-04`'s rule held here).

     Every count on this screen puts its noun in front of the number and a
     preposition after it (`TN-COPY` rule 1), which is why `exam.result.score`,
     `exam.result.passMark` and `exam.result.subjectRow` carry no plural rows in
     either language. `exam.result.unanswered` could not take that shape, so it
     carries both forms under rule 2. */
  'exam.result.title': 'Your exam',
  'exam.result.passed.title': 'You passed',
  'exam.result.notYet.title': 'Not this time',
  'exam.result.score': 'Right answers: {{correct}} out of {{total}}',
  'exam.result.passMark': 'You need {{pass}} out of {{total}} to pass.',
  'exam.result.withTimer': 'You took this exam with the timer.',
  'exam.result.noTimer': 'You took this exam without the timer.',
  'exam.result.bySubject': 'How you did, subject by subject',
  'exam.result.subjectRow': '{{subject}}: {{correct}} out of {{total}}',
  'exam.result.unanswered.one': 'You did not answer {{n}} question.',
  'exam.result.unanswered.other': 'You did not answer {{n}} questions.',
  'exam.result.review': 'See every question',
  'exam.result.noAnswer': 'You did not answer this one.',
  'exam.result.unavailable': 'This question could not be shown.',
  'exam.result.practise': 'Practise the questions you missed',
  'exam.again': 'Try the exam again',

  /* docs/stories/TN-ATTEMPT-leaving-and-resuming-an-exam.md */
  /* Leaving an exam costs nothing, so leaving asks nothing — `exam.leave.confirm`
     and `exam.leave.stay` are drawn in exactly one case, the browser that cannot
     save, where leaving really does end the exam. That is the only difference
     between the two cases (`TN-ATTEMPT-05`).

     `exam.resume.continue` is "Carry on" and « Reprendre », not « Continuer »,
     even though `title.continue` is « Continuer » and means something similar:
     two controls that both read « Continuer » on two screens a player reaches in
     the same minute is how a player learns to stop reading them. */
  'exam.leave': 'Leave the exam',
  'exam.leave.kept': 'Your exam is saved. You can finish it later.',
  'exam.leave.notKept':
    'This browser is not saving your progress, so leaving will end this exam.',
  'exam.leave.confirm': 'Leave and lose this exam?',
  'exam.leave.stay': 'Keep going',
  'exam.resume': 'Finish your exam',
  'exam.resume.title': 'You have an exam to finish',
  'exam.resume.continue': 'Carry on',
  'exam.new': 'Start a new exam',
  'exam.new.confirm': 'Your unfinished exam will be gone. Start a new one?',
  'exam.new.keep': 'Keep the one I have',
  'exam.gone.title': 'We could not open your exam',
  'exam.gone.body':
    'Some of its questions are not in this version. You can start a new exam.',

  /* docs/stories/TN-PASSPORT-my-passport.md */
  /* The screen owns its heading **and** the label of the control that opens it,
     which is the rule `TN-SET` states for `settings.title` and
     `common.settings`; `passport.open` moved here from `TN-QUEST` on 2026-09-08
     with its wording unchanged.

     `passport.state.earned` is written with the map's rows below rather than
     here, because the map draws it on a card whose stamp is in the passport, and
     one fact said in two words is two things to get wrong. `map.stamps`,
     `map.levelsReady`, `map.moreComing`, `map.state.notBuilt`,
     `map.notBuilt.help` and `map.number` are drawn by this screen and owned by
     `TN-MAP` for the same reason.

     **The three `passport.exam.*` rows are here now.** They were held back while
     this build had no exam — a "Practice exam" panel naming a feature the game
     did not have and offering a control that opened nothing — and Exam mode is
     what they were waiting for. `TN-EXAM-05`'s not-ready sentence landed with
     them, as `exam.notReady.title` and `exam.notReady.body` above; the passport
     draws it in the one case `TN-PASSPORT-06` names, where the exam cannot run
     and no control may offer to start it. */
  'passport.open': 'See my passport',
  'passport.exam.title': 'Practice exam',
  'passport.exam.none': 'You have not taken the practice exam yet.',
  'passport.exam.last': 'Your last practice exam',
  'passport.title': 'My passport',
  'passport.intro': "You earn a stamp when you finish a level's task.",
  'passport.state.notEarned': 'Not earned yet',
  'passport.empty.title': 'No stamps yet',
  'passport.empty.body': 'Finish a level to earn your first stamp.',

  /* docs/stories/TN-QUEST-parliament-hill.md */
  /* The two choices the offer puts in front of the player, and the sentence for
     an `answer` step that cannot start.

     **Every other word the officer says is the quest document's.** The lines,
     the expressions and each step's prompt are `content/quests/<id>.json` under
     ADR-0010 and reach `app/ui` as data — which is what lets one dialogue
     component carry any NPC in any level, and why `officer.greet`,
     `officer.offer`, `officer.declined`, `officer.reminder`, `officer.afterStamp`
     and the three `quest.step.*` prompts are **not** rows here. `quest.done.body`
     is reported rather than transcribed: it names Parliament Hill, so a single
     row for every quest is the defect `level.loading` was. */
  'quest.accept': "Yes, let's go",
  'quest.decline': 'Not now',
  'quest.noQuestions': 'The questions are not ready right now. Try again later.',
  /* ADR-0048, and **listed in {@link COPY_GAPS}**: said in the strip and aloud
     when a task step asks again some of what this level visit already answered,
     because it has nothing new left. "Some": the set can hold new questions
     too, as the Prairies' combine does after the grain elevator. The card's own
     tag says which one was seen before. */
  'quest.askedAgain': 'You have already answered some of these questions here.',
  'quest.done.title': 'Task done!',
  'common.keepPlaying': 'Keep playing',
  /* **`npc.officer.name` and `npc.guide.name` were here and are deleted.** They
     were a quest giver's speaker label — the dialog's accessible name
     (`TN-QUEST-08`) — written when `content/characters/` was empty. ADR-0029
     moved that name to `content/characters/<id>.json#/name`, where it is
     content, bilingual, schema-validated and in the same document as the rig the
     character plays, and made a landmark giver's name the level's own
     `pois[].name`. Nothing reads the rows now, and a row nothing reads is one
     that can quietly start disagreeing with the document that replaced it, so a
     maintainer editing it edits nothing while believing otherwise. **No
     `npc.<id>.name` row is written again**: a lighthouse would need one, and
     `TN-LEVEL-peggys-cove.md` refuses to invent it. */

  /* docs/stories/TN-DONE-finishing-a-level.md */
  /* The heading follows **what finished**. A quest completing draws
     `quest.done.title`; reaching the end of a level having accepted no task
     draws this one, because "Task done!" over a player who was never offered a
     task is a claim about something they never did. */
  'level.complete.title': 'Level finished!',
  /* One slot, two rows, never both and never empty (`TN-DONE-02`): the score
     when at least one question was answered in this level, and this sentence
     when none was. It carries no number, so "0 out of 0" cannot be drawn, and no
     imperative, so it is an open door rather than a mark. */
  'level.complete.none':
    'You did not answer any questions here. Every place in this level has something to teach you.',
  /* The card owns its score row rather than borrowing `study.summary.score`
     (`TN-DONE`, and `OQ-DONE-2` for the alternative): Study counts a drill the
     player asked for, this counts whatever a level happened to offer somebody
     walking through it, and two different questions must be free to be reworded
     apart. A label in front of the number and a preposition after it —
     `TN-COPY`'s counting rule 1 — so neither language needs plural rows and
     neither can draw "1 right answers". */
  'level.complete.score': 'Right answers in this level: {{correct}} out of {{total}}',
  /* The line above "Play Peggy's Cove" when finishing this level opened another,
     and that button's description. Written by app/ui and listed in `COPY_GAPS`
     (second live-site audit): the card used to draw the map's own three rows
     joined, "Peggy's Cove. Open. You can play this now.", which read like
     screen-reader text to a sighted player and like a list to a listener. One
     plain sentence for both, naming no level: the button right under it names
     the place, and French needs no article or agreement for a place here. */
  'level.complete.nextOpen': 'A new level is open. You can play it now.',

  /* The card at the end of a level whose task is not done (ADR-0036). Written by
     app/ui and listed in `COPY_GAPS`: `TN-DONE` has no row for this state,
     because until ADR-0036 reaching the end always earned the stamp. The body is
     `passport.intro` — the promise itself, in the words the passport uses — and
     then one of the two lines below. Plain, second person, no mark and no blame:
     the player can keep playing or leave, and nothing is taken away. */
  'level.unfinished.title': 'You are at the end of this level',
  /* `{{step}}` is the task's own current step, the tracker's words: "Answer 2
     questions about voting". Last in the sentence, so no noun follows it. */
  'level.unfinished.next': 'Your task here is not finished yet. Next: {{step}}',
  'level.unfinished.notStarted':
    "You have not started this level's task yet. Go back to find where it starts.",

  /* `stamp.<id>.earned` and `level.<id>.play`: one pair per built level, each
     transcribed from that level's own story, which `TN-DONE`'s two directories
     name. **Written out and never assembled**, for the reason
     `level.<id>.error.title` is: the six levels take four different forms
     after « tampon » — « d'Halifax », « de la Ville de Québec », « de Toronto »,
     « des Prairies » — and "Play {{level}}" is wrong the same way, « à » against
     « dans la » against « dans les ». The Prairies is where the **English**
     stops templating too: "the {{level}} stamp" yields "the The Prairies stamp"
     against a title that is capitalised on the map, and the row below uses the
     bare plural attributively instead (`TN-LEVEL-prairie-rail.md`). A built
     level missing either row fails `tests/unit/ui/copy.test.ts` rather than
     reaching a player wearing another level's words. */
  'stamp.halifax.earned': 'You earned the Halifax stamp.',
  /* `TN-LEVEL-peggys-cove.md`. The possessive is the village's own and the
     apostrophe is the one *Discover Canada* writes; the Canadian
     Geographical Names Database writes "Peggys Cove" and this game does not. */
  'stamp.peggys-cove.earned': "You earned the Peggy's Cove stamp.",
  'stamp.quebec-city.earned': 'You earned the Québec City stamp.',
  'stamp.ottawa.earned': 'You earned the Ottawa stamp.',
  'stamp.toronto.earned': 'You earned the Toronto stamp.',
  'stamp.winnipeg.earned': 'You earned the Winnipeg stamp.',
  'stamp.prairie-rail.earned': 'You earned the Prairies stamp.',
  /* `TN-LEVEL-alberta-foothills.md`: the bare plural used attributively, because
     the title is "The Alberta foothills" on the map and a template would have
     drawn "the The Alberta foothills stamp". */
  'stamp.alberta-foothills.earned': 'You earned the Alberta foothills stamp.',
  'stamp.vancouver.earned': 'You earned the Vancouver stamp.',
  /* `TN-LEVEL-the-north.md`. "the North" mid-sentence, lower-case article
     against a title capitalised on the map — the Prairies' problem again,
     and the tenth level is where it stops recurring. */
  'stamp.the-north.earned': 'You earned the North stamp.',
  'level.halifax.play': 'Play Halifax',
  'level.peggys-cove.play': "Play Peggy's Cove",
  'level.quebec-city.play': 'Play Québec City',
  'level.ottawa.play': 'Play Ottawa',
  'level.toronto.play': 'Play Toronto',
  'level.winnipeg.play': 'Play Winnipeg',
  'level.prairie-rail.play': 'Play the Prairies',
  'level.alberta-foothills.play': 'Play the Alberta foothills',
  'level.vancouver.play': 'Play Vancouver',
  'level.the-north.play': 'Play the North',
  /* The sentence under a locked card that names the level to finish first.
     **Written out per level, and listed in {@link COPY_GAPS}** until `TN-MAP`'s
     owner ratifies them (ADR-0039). `map.locked.after`, "Finish {{level}} first.",
     dropped the map title into a sentence and drew "Finish The Prairies first."
     and « Terminez d'abord Les Prairies. » — the capital article the stamp and
     play rows above were written out to avoid, arriving on the one level-keyed
     sentence that was still a template. The template stays only for a card with
     no id, which this build does not have. */
  'level.halifax.finishFirst': 'Finish Halifax first.',
  'level.peggys-cove.finishFirst': "Finish Peggy's Cove first.",
  'level.quebec-city.finishFirst': 'Finish Québec City first.',
  'level.ottawa.finishFirst': 'Finish Ottawa first.',
  'level.toronto.finishFirst': 'Finish Toronto first.',
  'level.winnipeg.finishFirst': 'Finish Winnipeg first.',
  'level.prairie-rail.finishFirst': 'Finish the Prairies first.',
  'level.alberta-foothills.finishFirst': 'Finish the Alberta foothills first.',
  'level.vancouver.finishFirst': 'Finish Vancouver first.',
  'level.the-north.finishFirst': 'Finish the North first.',

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
  /* Drawn by `hud-task-cue` after the task when the stop it names is behind the
     player (second live-site audit, a skipped Town Clock). Written by app/ui and
     listed in `COPY_GAPS`. A label, so no full stop; "behind" and not "left",
     because it is about the way the player has come, not a screen direction. */
  'hud.task.behind': 'Behind you',

  /* docs/stories/TN-REACH-what-is-in-reach.md — what `interact-prompt` says,
     and the one-time explanation of the marks beside it.

     **The prompt says what pressing will do; it is never a name.** It drew the
     landmark's own name from the level document until these rows existed, which
     says what is there rather than what choosing it does — and put "CN Tower"
     inside `hud`, a surface `TN-NAMES-04` fails the build for. A name is not a
     copy string when it is interpolated at runtime, which is exactly how it got
     past a check written against copy tables.

     Four generic rows and one per-target row per target a level writes one for,
     resolved in one order by `app/ui/interact.ts`: **done** beats a level's own
     row, which beats the kind. A target with no row offers no prompt at all —
     never "Interact", never a name, never an empty string.

     `hud.interact.hint` **names no input**: not "tap", not a key, not "hold". A
     hint that names one input is wrong for the other three, and "choose it" is
     true for a thumb, a keyboard and one switch. */
  'hud.interact.poi': 'Look at this place',
  /* The fourth generic row, and the only one whose kind word keeps a dot: it is
     a **kind** and not a target, which is the distinction `OQ-REACH-1` drew when
     every per-target row was respelled to `hud.interact.<id>`.

     ADR-0029 let a point of interest offer a quest, so Peggy's Point Lighthouse
     and the Yukon River sternwheeler open a **dialogue with a task in it** and
     not a card. "Look at this place" promises the card, and this file's founding
     rule is that the prompt says what pressing does — a prompt that
     under-promises is the same defect as one that names the target, arriving
     from the other side. Neither level writes a per-target row, because their
     own stories forbid the landmark's name inside the HUD (`TN-PEGGYS-01`,
     `TN-NORTH-01`).

     Not "Talk to this place", which personifies a landmark one screen before
     ADR-0029 §5's voice rule would have caught it; not "Read what is written
     here", which promises lettering `make verify-art` refuses to draw; not "Stop
     here and read", which is the quest tracker's own step prompt said twice.
     "Task" is the game's own word for a quest (`quest.done.title`), and "here"
     does the demonstrative's work the other generic rows give to "this place"
     and "this person". */
  'hud.interact.poi.offer': 'See what to do here',
  'hud.interact.npc': 'Talk to this person',
  'hud.interact.done': 'Done. See it again',
  /* Reworded 2026-09-14 and listed in {@link COPY_GAPS} until `TN-REACH`'s owner
     ratifies it. "A mark shows something to see" was drawn the first time
     anything came into reach — and on Halifax, the level the game opens on, the
     first thing in reach is the guide, who is somebody to talk to rather than
     something to see. "Someone or something" is true of a person, a beaver, a
     lighthouse and a building alike, still names no kind and no input, and
     "choose" is still the single-switch contract's word. */
  'hud.interact.hint': 'A mark shows someone or something you can choose. Get close, then choose.',
  /* ADR-0043, proposed for `TN-REACH-12` and listed in {@link COPY_GAPS}. Drawn in
     the hint's place while a drive has brought the player to rest beside something
     they can choose, and said once per thing per sitting. A live-site audit found a
     keyboard player at a stop who could not tell why the world had stopped or how
     to go on. Like `hud.interact.hint` it names no input: "move" is the game's own
     action, true of a key, a thumb and auto-move's nudge, and "choose" is the
     single-switch contract's word. */
  'hud.stop.hint': 'Stopped here. Choose it, or move again to go on.',
  /* docs/stories/TN-LEVEL-ottawa.md — that level's own two rows, keyed on the
     ids its document gives the targets. Ottawa may write them because its
     character is named and its landmark is not on `TN-NAMES`'s list; a level
     whose landmark **is** on that list draws the generic row instead. */
  'hud.interact.officer': 'Talk to the officer',
  'hud.interact.parliament-hill': 'Look at Parliament Hill',
  /* docs/stories/TN-GUIDE-the-guide.md — a per-target row whose target is on
     three levels, so the character's own story writes it once rather than three
     level stories writing it three times. It is an ordinary rule-2 row: `done`
     still wins, so a finished guide reads "Done. See it again". Its
     absence was a live defect — the kind row calls the guide "this person", and
     the guide is a beaver. */
  'hud.interact.guide': 'Talk to the guide',
  /* Every landmark that opens a card, named the way "Look at Parliament Hill"
     already names its own — `TN-REACH`'s rule 2, a per-target row keyed on the
     id the level document gives the target. **Proposed rows, written by app/ui
     and every one listed in {@link COPY_GAPS}** (ADR-0039), each to move into its
     level's story when that story's owner ratifies it.

     "Look at this place" was drawn for almost every landmark in the game, so a
     player who cannot see the mark was told nothing about which one was in reach
     (`OQ-REACH-4`, whose recommendation this is). The wording follows each
     document's own `pois[].name`, and is **written out, never interpolated**:
     the names carry capital articles ("The canal locks", « Les écluses du
     canal »), indefinite ones (« Un étal de marché ») and none at all
     (« Tramway »), so a template would draw "Look at The canal locks" and
     « Regarder Tramway ».

     Two kinds of landmark — seven landmarks — have **no** row, on purpose, and
     keep the generic one: a name on `TN-NAMES`'s list (Pier 21, the Château Frontenac, the CN
     Tower, Canada Place, the Canadian Museum for Human Rights), and the two
     landmarks that give a quest (Peggy's Point Lighthouse and the Yukon River
     sternwheeler), whose stories keep their names out of the HUD and whose
     prompt is `hud.interact.poi.offer`. `tests/unit/ui/copy.test.ts` holds both
     halves against the level and quest documents. */
  'hud.interact.town-clock': 'Look at the clock',
  'hud.interact.market-stall': 'Look at the stall',
  'hud.interact.harbour-tug': 'Look at the tug',
  'hud.interact.granite-shore': 'Look at the shore',
  'hud.interact.fish-store': 'Look at the store',
  'hud.interact.village-house': 'Look at the house',
  'hud.interact.city-wall': 'Look at the wall',
  'hud.interact.terrace-kiosk': 'Look at the bandstand',
  'hud.interact.rideau-locks': 'Look at the locks',
  'hud.interact.library-of-parliament': 'Look at the Library',
  'hud.interact.warming-hut': 'Look at the hut',
  'hud.interact.dows-lake': 'Look at the pavilion',
  'hud.interact.streetcar': 'Look at the streetcar',
  'hud.interact.nathan-phillips-square': 'Look at Nathan Phillips Square',
  'hud.interact.footbridge': 'Look at the bridge',
  'hud.interact.autumn-maple': 'Look at the maple',
  'hud.interact.grain-bins': 'Look at the bins',
  'hud.interact.grain-elevator': 'Look at the elevator',
  'hud.interact.combine-harvester': 'Look at the combine',
  'hud.interact.container-car': 'Look at the rail car',
  'hud.interact.ranch-gate': 'Look at the gate',
  'hud.interact.ranch-barn': 'Look at the barn',
  'hud.interact.pump-jack': 'Look at the oil pump',
  'hud.interact.beef-cattle': 'Look at the cattle',
  'hud.interact.marina': 'Look at the marina',
  'hud.interact.bulk-carrier': 'Look at the ship',
  'hud.interact.spruce-stand': 'Look at the spruce',
  'hud.interact.driftwood': 'Look at the driftwood',

  /* docs/stories/TN-SAVE-save-and-reload.md — the storage warning these screens
     raise, and the way out it has to offer (TN-HUD-03). */
  'storage.warning': 'This browser is not saving your progress.',
  'storage.warning.help':
    'You can keep playing, but everything will be gone when you close the tab.',
  'save.export': 'Save to a file',
  /* The rest of `TN-SAVE-06`'s rows, drawn by the "Your progress" section of
     Settings (ADR-0046). `save.newer.title` is `TN-SAVE-04`'s sentence about a
     saved game from a newer build, and a file from a newer build is the same
     fact, so the same row says it. */
  'save.import': 'Open a file',
  'save.import.error': 'We could not read that file.',
  'save.import.tooBig': 'That file is too big.',
  'save.import.done': 'Your game is back.',
  'save.newer.title': 'This saved game is from a newer version.',
  /* **Written by app/ui and listed in {@link COPY_GAPS}** (ADR-0046): no story
     table carries the section's heading and reading line, the confirmation's
     question, cost and two answers, the sentence under each refusal, or the
     dialog that starts the game again from the file. The refusal sentences say
     what to do next, never what the player did: choose another file, update the
     game, or nothing at all because nothing changed. "Keep my progress" rather
     than "Cancel", so the safe answer names what it keeps. */
  'save.section': 'Your progress',
  'save.section.help': 'Keep a copy in a file, or bring your progress from another device.',
  'save.import.confirm': 'Replace your progress with this file?',
  'save.import.confirm.body':
    'Your progress and settings on this device will be replaced by the ones in the file.',
  'save.import.replace': 'Replace',
  'save.import.keep': 'Keep my progress',
  'save.import.error.help': 'Choose a file that was saved from this game.',
  'save.import.newer.help': 'Update the game, then open the file again.',
  'save.import.notSaved.help': 'Nothing was changed.',
  'save.import.done.help': 'The game will start again with the progress from your file.',
  'save.import.continue': 'Continue',
  /* "Delete my progress", the one control in this game that destroys something.
     **Both of these are transcribed from `TN-SAVE-save-and-reload.md`**, which
     has owned them all along under these keys — `save.clear` and
     `save.clear.confirm` — and they are therefore not `COPY_GAPS` rows. An
     earlier pass here invented a `save.delete.*` family with its own wording and
     declared it unowned, which is how a screen comes to fail three ratified
     scenarios (`TN-SAVE-06`, `TN-SAVE-07`, `TN-SAVE-11`) while every gate stayed
     green. The keys a story owns are the keys the screen draws.

     The question carries its own cost — "This cannot be undone." — so the
     confirmation needs no separate body row, and the dialog is named by the
     question exactly as the story writes it. */
  'save.clear': 'Delete my progress',
  'save.clear.confirm': 'This cannot be undone. Delete everything?',
  /* The two answers and the two refusal sentences. **Ratified 2026-09-17 and
     transcribed from `TN-SAVE-save-and-reload.md`**, which carries all four in
     its table now and holds them in `TN-SAVE-06` through `TN-SAVE-12`: they are
     no longer {@link COPY_GAPS} rows. "Delete everything" answers the question
     in its own words; the safe answer names what it keeps, never "Cancel".

     The refusal is deliberately *not* "Nothing was changed". `clearBoth`
     (ADR-0026) attempts IndexedDB **and** the `localStorage` a save was carried
     out of, and reports one error for either, so a clear that emptied one store
     and was refused by the other is indistinguishable here from one that changed
     nothing. A sentence claiming nothing changed would be a lie in exactly the
     case where a stale copy is about to come back on the next boot, so it says
     what it knows — the delete did not finish — and what to do. */
  'save.clear.yes': 'Delete everything',
  'save.clear.keep': 'Keep my progress',
  'save.clear.failed': 'We could not finish deleting your progress.',
  'save.clear.failed.help': 'Some of it may still be on this device. Try again.',

  /* docs/stories/TN-MOVE-locomotion-labels.md */
  /* A mode label belongs to the **mode**, not to the level that uses it: `walk`
     is three of the four built levels' word, and written per level it would be
     written three times. One row per mode a level document declares, and not
     one more — the five modes `game.config.json` allows but no level uses have
     no row, because copy for an unscoped level reads as a scheduled level.

     Every value is the name of the activity, one word, in both languages: never
     an instruction ("Press and hold to move" is the control's business), never
     the level's name, and never a bare noun that needs gender agreement. A mode
     a level declares with no row here is a build failure (`TN-MOVE-02`); an
     empty strip is silent to a screen reader and invisible to everyone else,
     which is the worst way for a missing string to present. */
  'locomotion.walk.label': 'Walking',
  'locomotion.toboggan.label': 'Sledding',
  'locomotion.skate.label': 'Skating',
  'locomotion.bike.label': 'Biking',
  /* The fifth mode, added by the level document that declares it and not
     before: `content/levels/prairie-rail.json` puts `train` first and `walk`
     second. It is the vehicle rather than a gerund because English has none to
     reach for here — "Training" means something else and "Riding" is level 8's
     word — and it is the same word in both languages, written twice on purpose
     (`TN-MOVE-06`, `TN-NAMES-03`), never one value shared. */
  'locomotion.train.label': 'Train',
  /* The sixth and seventh, brought by the two documents that declare them:
     `content/levels/alberta-foothills.json` puts `horse` first and
     `content/levels/vancouver.json` puts `skateboard` first.

     **"Horse", never "Riding".** `OQ-MOVE-4` reserved "Riding" for this mode and
     withdrew it: in Canadian English a riding is an electoral district,
     `content/questions/elections/elec-03-another-name-for-a-riding.json` teaches
     exactly that, and level 5's whole subject is federal elections. A strip that
     means one thing where a question card means another is a word this game has
     taught the player to misread.

     « Planche à roulettes » is the one value in this table that is not a single
     word in its language, and it is still a noun and not a phrase about one:
     « planche à roulettes » *is* the French noun for the object, the way « À
     pied » and « En train » are not (`TN-MOVE-06`). It is also the longest label
     of the eight, which `TN-MOVE-05` measures by name at 200 % text. */
  'locomotion.horse.label': 'Horse',
  'locomotion.skateboard.label': 'Skateboarding',

  /* docs/stories/TN-WAIT-a-level-opens-or-it-does-not.md */
  /* The three rows every level's error card shares. They name no place, state
     no fact and do not change between levels, so they are written once for all
     ten. `level.error.back` is drawn by the loading screen too, for the escape
     route a stalled load offers — one string, one meaning, both screens. */
  'level.error.body': 'Check your connection and try again.',
  'level.error.retry': 'Try again',
  'level.error.back': 'Go back',
  /* ADR-0034, amended 2026-09-15, and **listed in {@link COPY_GAPS}**: the card a
     level shows instead of opening when the network is gone and its art was
     never kept. It takes the level's own error title and the two buttons above;
     this sentence is the one thing that differs, and it says what to do. */
  'level.needsConnection.body':
    'This place needs an internet connection the first time you open it. Connect, then try again.',

  /* One waiting sentence and one error title per level, keyed on the level's
     id, each transcribed from that level's own story: `TN-LEVEL-halifax.md`,
     `TN-LEVEL-quebec-city.md`, `TN-LEVEL-ottawa.md`, `TN-LEVEL-toronto.md`,
     `TN-LEVEL-winnipeg.md`, `TN-LEVEL-prairie-rail.md`.

     **`level.loading` and `level.error.title` do not exist, and may not come
     back.** They did, and the unqualified pair *was* the defect: one row each,
     written when Ottawa was the only level with a story, inherited in silence by
     the three levels that shipped after it — so a player opening Halifax read
     "Getting the canal ready." and was told a failure there was Ottawa's. A key
     with no level in it is a key two levels eventually disagree about.

     The waiting sentence names **the work**, in common nouns — the harbour, the
     slope, the canal, the streets — under `TN-COPY-07`: no percentage, no
     fraction, no step count, no ellipsis, and the same sentence for the whole
     wait. It may not name a landmark (`TN-NAMES-01` lists a loading message
     among the screens a real name may not appear on) and it may not state a
     territorial fact or paraphrase one: `docs/content-review.md` §10.2 fixes
     where a player reads those — the sourced "About this place" panel, which
     §10.2 contrasts with exactly the splash card a loading screen is.

     The error title is **written out per level, never assembled from a
     template**. "We could not load {{level}}." is correct in English and quietly
     wrong in French: « charger Halifax » takes no article, « charger la Ville de
     Québec » takes one, and the levels still to come are worse — « le Nord »,
     « les Prairies », « les contreforts de l'Alberta ». Eight rows and no
     interpolation is what makes both languages right. */
  'level.halifax.loading': 'Getting the harbour ready.',
  'level.halifax.error.title': 'We could not load Halifax.',
  /* `TN-LEVEL-peggys-cove.md`. The waiting sentence names the bare rock
     because bare rock is the ground the player walks on, and because a
     loading screen is the splash card `docs/content-review.md` §10.2 rules
     out for anything territorial. */
  'level.peggys-cove.loading': 'Getting the bare rock ready.',
  'level.peggys-cove.error.title': "We could not load Peggy's Cove.",
  'level.quebec-city.loading': 'Getting the snowy slope ready.',
  'level.quebec-city.error.title': 'We could not load Québec City.',
  'level.ottawa.loading': 'Getting the canal ready.',
  'level.ottawa.error.title': 'We could not load Ottawa.',
  'level.toronto.loading': 'Getting the city streets ready.',
  'level.toronto.error.title': 'We could not load Toronto.',
  'level.winnipeg.loading': 'Getting the riverbank ready.',
  'level.winnipeg.error.title': 'We could not load Winnipeg.',
  'level.prairie-rail.loading': 'Getting the railway track ready.',
  /* The row that proves the English needed writing out as well: the title is
     "The Prairies" on the map, and "We could not load {{level}}." would produce
     "We could not load The Prairies." mid-sentence. */
  'level.prairie-rail.error.title': 'We could not load the Prairies.',
  /* `TN-LEVEL-alberta-foothills.md`. The waiting sentence names the pasture —
     the ground the horse walks on — and names neither the province, the
     foothills, the Rockies, a town, the ranch nor a treaty: a loading screen is
     the splash card `docs/content-review.md` §10.2 rules out for a territorial
     statement, and the level's own title is already above it. The error title is
     the first in either language to need writing out in **both**: "The Alberta
     foothills" and « Les contreforts de l'Alberta » both carry a capital article
     on the map, and both are written here with a lower-case one. */
  'level.alberta-foothills.loading': 'Getting the pasture ready.',
  'level.alberta-foothills.error.title': 'We could not load the Alberta foothills.',
  /* `TN-LEVEL-vancouver.md`. The third level on water and the third noun for it:
     Halifax has the harbour, Winnipeg the riverbank, this one the waterfront.
     Not "the seawall" — in Vancouver the Seawall is a named path, and
     `TN-NAMES-01` keeps real names off a loading screen. */
  'level.vancouver.loading': 'Getting the waterfront ready.',
  'level.vancouver.error.title': 'We could not load Vancouver.',
  /* `TN-LEVEL-the-north.md`. The gravel shore, not the river and not the
     bar: Halifax has the harbour, Winnipeg the riverbank, Vancouver the
     waterfront, and a fourth level on water needed a fourth noun. */
  'level.the-north.loading': 'Getting the gravel shore ready.',
  'level.the-north.error.title': 'We could not load the North.',
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
  /* docs/stories/TN-PASSPORT-my-passport.md owns this word. The map draws it on
     a card whose stamp is in the passport, beside — never instead of — the
     card's state word: "Open" says whether the level can be played and "Earned"
     says whether its stamp has been won, and a card can be both. One row for
     both screens, because a stamp the passport calls "Earned" and the map calls
     something else is two words for one fact. */
  'passport.state.earned': 'Earned',
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
  /* Written here and listed in {@link COPY_GAPS}: no story owns it. The map
     and the rail both mark the stop the player is at, and both are hidden from
     assistive technology, so the card for that level has to say it in words or
     the fact exists only in pixels. A label, not a sentence: it names no place,
     because the card already does, and no direction (`OQ-MAP-3`). */
  'map.here': 'You are here',

  /* docs/stories/TN-FLOW-first-run-and-return.md */
  'common.back': 'Back',
  'flow.leaveLevel': 'Leave the level',

  /* The "About this place" panel (`docs/content-review.md` §10.2): the one
     screen in this game that states whose land a level stands on, the one
     control that opens it, and the words for the case where the claim was not
     verified and is therefore not drawn.

     **Every row here is invented and every row here is listed in
     {@link COPY_GAPS}.** No file in `docs/stories/` carries a copy table for
     this panel — `TN-REACH-what-is-in-reach.md` owns what the HUD says is in
     reach and says nothing about the menu, and the ten level stories own the
     *statement*, which is content on the level document and is never a row
     here. So these eleven strings are reported upward to be ratified or
     replaced, exactly as `docs/stories/README.md` requires, rather than written
     and left looking reviewed.

     **`about.title` and `about.open` are the same words on purpose**, which is
     the discipline `hud.menu` and `hud.menu.title` already follow: the dialog's
     accessible name is the phrase the player pressed, so what they see and what
     they hear are one thing. They stay two rows because one is a control and
     one is a heading, and a future reviewer may want to change one without the
     other.

     **Nothing here names a nation, a place or a publisher.** Every such word on
     this screen arrives from the level document, already localised and already
     verified, and an endonym is spelled identically in both languages
     (`docs/content-review.md` §9.3) precisely because it is never translated
     through a table like this one.

     **The two unavailable rows are the panel's hardest sentences**, and the
     rule they are written to is `docs/content-review.md` §10.2's honesty: a
     wrong attribution is worse than an absent one, and an absent one that says
     nothing about its absence is worse than one that does. So the panel says
     the statement is not shown, says which of the two reasons applies, and says
     — in `about.unavailable.ours` — that this is the project's own checking and
     neither a fault in the source nor anything the player did. Neither row
     names a nation or a publisher, because the refused claim *is* a territorial
     attribution and a list of names would be the same claim in a form a reader
     cannot disagree with. */
  'about.open': 'About this place',
  'about.title': 'About this place',
  'about.nations': 'Named in this statement',
  'about.source': 'Where this comes from',
  'about.source.outside': 'This link opens the source outside the game.',
  'about.unavailable.notShown':
    'We show this statement only after someone checks it against its source. ' +
    'This one has not passed that check, so it is not shown.',
  'about.unavailable.checking':
    'The source for this place has changed. Someone is checking the statement again. ' +
    'It comes back when that check is done.',
  'about.unavailable.ours':
    'This is about our own checking. It is not a fault in the source, and it is not something you did.',

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
  'level.peggys-cove.title': "Peggy's Cove",
  'level.peggys-cove.subtitle': 'Who we are',
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
  'level.the-north.title': 'The North',
  'level.the-north.subtitle': "Canada's regions",

  /* The update notice (ADR-0034, "Update flow"; `app/ui/update-notice.ts`).
     **Both rows are written by app/ui and listed in {@link COPY_GAPS}**: no
     story table carries them. The sentence is a status, not an instruction —
     "ready" and not "available", because nothing has to be fetched first — and
     it is a label-shaped line with no full stop, like `map.here`. "Reload" is the
     control's own verb, the one a browser uses, rather than "Update", which would
     promise a download the worker has already done. The notice's other control
     is `common.close`, so no third row is written. */
  'update.ready': 'A new version is ready',
  'update.reload': 'Reload',

  /* The portrait notice (ADR-0060; `app/ui/portrait-notice.ts`): what a desktop,
     a laptop or a tablet is told once, on the load it opens the game on.
     **Both rows are written by app/ui and listed in {@link COPY_GAPS}**: no story
     table carries them.

     Two rows, because they say two different things and only one of them is the
     news. The first is the recommendation. The second is the part a player on a
     supported platform has to be told in the same breath, or the first reads as
     a refusal: desktop is a platform this game is built for (CLAUDE.md,
     Orientation), the canvas is the same canvas, and nothing here is broken.

     "This game", not "TrueNorth": the product's name is `title.game`, it is on
     the screen behind this notice, and a row that spells it again is a second
     place it has to be changed. "Held upright" rather than "in portrait", which
     is a word about a layout and not about a hand — and it is the rotate
     overlay's own word, so a player who meets both meets one vocabulary. No
     imperative: nobody is being told to go and find a phone.

     The notice's only control is `common.close`, so no third row is written. */
  'portrait.notice': 'This game works best on a phone held upright.',
  'portrait.notice.help': 'You can still play here.',
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
  'settings.character': 'Modifier votre personnage',
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
  'creator.preview.label': 'Votre personnage',
  'creator.randomise': 'Au hasard',
  'creator.start': 'Commencer à jouer',
  'creator.saveFailed':
    "Nous n'avons pas pu enregistrer votre personnage. Vous pouvez continuer à jouer, mais vos choix pourraient être perdus.",
  'creator.retry': 'Réessayer',
  'creator.continue': 'Continuer quand même',

  'creator.done': 'Terminé',

  /* Five French forms English does not have, and they are the finding rather
     than a detail. Every `hairShape` and `hairColour` value is a PLURAL
     adjective, because it agrees with « cheveux » — never with the player, so
     « Court(e) » is not a fix, it is the rule in `docs/content-review.md` §8.6
     being broken. Red hair is « Roux » and never « Rouges ». « Gris » already
     carries its plural. « Tuque » is the Canadian French spelling of the
     Canadian English « Toque », and neither is a typo. */
  'creator.slot.skin': 'Teint de peau',
  'creator.slot.hairShape': 'Cheveux',
  'creator.slot.hairColour': 'Couleur des cheveux',
  'creator.slot.headCovering': 'Couvre-chef',
  'creator.slot.feature': 'Lunettes',
  'creator.hairShape.crop': 'Courts',
  'creator.hairShape.coil': 'Boucles serrées',
  'creator.hairShape.bob': 'Au menton',
  'creator.hairShape.long': 'Longs',
  'creator.hairColour.black': 'Noirs',
  'creator.hairColour.brown': 'Bruns',
  'creator.hairColour.blond': 'Blonds',
  'creator.hairColour.red': 'Roux',
  'creator.hairColour.grey': 'Gris',
  'creator.headCovering.none': 'Aucun',
  'creator.headCovering.toque': 'Tuque',
  'creator.feature.none': 'Non',
  'creator.feature.glasses': 'Oui',
  'creator.optionGone':
    "Un de vos choix ne se trouve pas dans cette version. Nous en avons choisi un autre. Vous pouvez le modifier ici.",

  /* « clair », « moyen » and « foncé » agree with « teint », which is masculine
     singular, so this is the one table in the creator whose two languages have
     identical grammar. There is no « clair(e) » to write and none may be
     introduced. */
  'creator.skin.skin-1': '1, clair',
  'creator.skin.skin-2': '2, clair',
  'creator.skin.skin-3': '3, moyen',
  'creator.skin.skin-4': '4, moyen',
  'creator.skin.skin-5': '5, foncé',
  'creator.skin.skin-6': '6, foncé',

  /* Listed in COPY_GAPS with the English. The French agrees with the noun in
     the label and never with the player: « Féminin », « Masculin » and
     « Neutre » agree with « style », which is masculine singular, so choosing
     `feminine` changes no ending anywhere — the option reads « Féminin » for
     everybody, and no other string on any screen reads the choice at all
     (`docs/content-review.md` §8.6). « Du clair au foncé » is two nouns and
     agrees with nobody. */
  'creator.slot.skin.help': 'Du clair au foncé',
  'creator.slot.presentation': 'Style',
  'creator.presentation.feminine': 'Féminin',
  'creator.presentation.masculine': 'Masculin',
  'creator.presentation.neutral': 'Neutre',

  'card.progress': 'Question {{n}} sur {{total}}',
  'card.kind.new': 'Nouvelle question',
  'card.kind.seen': 'Vous avez déjà vu cette question',
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
  /* Amended by `TN-STUDY` at ratification: « des questions **pour le** test »,
     never « des questions **du** test ». « du test » reads in French as
     *questions from the citizenship test* — the real test's own questions —
     where the English states a purpose. This game's questions are non-verbatim
     paraphrases of *Discover Canada* (CLAUDE.md, content rules), the real
     test's are not published, and `title.notOfficial` says on the first screen
     that this game is not the government's; claiming otherwise here would be
     the replaced sentence's defect arriving in the other language.

     « test » and not « examen », deliberately: « examen » is this game's word
     for the *feature* — « Examen pratique » (`exam.title`) — so « examen de
     citoyenneté » on this screen would read as the exam the player can start
     from the menu. `TN-STUDY-11` asserts both halves. */
  'study.intro':
    "Exercez-vous avec des questions pour le test de citoyenneté. Il n'y a aucune limite de temps.",
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

  'exam.open': 'Examen pratique',
  'exam.title': 'Examen pratique',
  'exam.intro': "Cet examen pratique a la même forme que le vrai examen.",
  'exam.rules.length.one': "L'examen compte {{count}} question.",
  'exam.rules.length.other': "L'examen compte {{count}} questions.",
  'exam.rules.pass': 'Il faut {{pass}} sur {{count}} pour réussir.',
  'exam.noFeedback': 'Vous verrez votre résultat à la fin.',
  'exam.changeAnswers':
    'Vous pouvez revenir en arrière et changer une réponse avant de terminer.',
  'exam.subjectsReady': 'Sujets prêts : {{ready}} sur {{total}}',
  'exam.subjects.help': 'Cet examen ne porte que sur les sujets qui sont prêts.',
  'exam.start': "Commencer l'examen",
  'exam.previous': 'Précédent',
  'exam.next': 'Suivant',
  'exam.finish': "Terminer l'examen",
  'exam.answered': 'Réponses données : {{done}} sur {{total}}',
  'exam.notAnsweredYet': 'Pas encore répondu',
  'exam.unanswered.one': 'Il reste {{n}} question sans réponse.',
  'exam.unanswered.other': 'Il reste {{n}} questions sans réponse.',
  'exam.goToUnanswered': 'Aller à la première question sans réponse',
  'exam.finishAnyway': 'Terminer quand même',
  'exam.notReady.title': "L'examen n'est pas encore prêt",
  'exam.notReady.body':
    'Nous écrivons encore les questions. Vous pouvez vous exercer dans la révision.',

  /* docs/stories/TN-EXAMMENU-the-exam-menu-and-the-chosen-answer.md */
  /* « Menu » is the same word as the English and is declared here anyway: a
     French value that fell back to the English one reads correctly and hides a
     missing row (`TN-EXAMMENU-05`). */
  'exam.menu': 'Menu',
  'exam.menu.title': "Menu de l'examen",

  'exam.timer.use': 'Utiliser le chronomètre',
  'exam.timer.help':
    "Le vrai examen a une limite de temps. Sans chronomètre, vous pouvez prendre tout le temps qu'il vous faut.",
  'exam.timer.limit.one': '{{n}} minute',
  'exam.timer.limit.other': '{{n}} minutes',
  'exam.timer.left.one': 'Il reste {{n}} minute',
  'exam.timer.left.other': 'Il reste {{n}} minutes',
  'exam.timer.lessThanMinute': "Il reste moins d'une minute",
  'exam.timer.paused': 'Chronomètre en pause',
  'exam.timer.off': "Aucun chronomètre. Prenez tout le temps qu'il vous faut.",
  'exam.timer.stop': 'Arrêter le chronomètre',
  'exam.timer.stopped':
    "Le chronomètre est arrêté. Vous pouvez prendre tout le temps qu'il vous faut.",
  'exam.timer.timeUp.title': 'Le temps est écoulé',
  'exam.timer.timeUp.body': 'Nous avons corrigé les questions auxquelles vous avez répondu.',

  'exam.result.title': 'Votre examen',
  'exam.result.passed.title': 'Vous avez réussi',
  'exam.result.notYet.title': 'Pas cette fois',
  'exam.result.score': 'Bonnes réponses : {{correct}} sur {{total}}',
  'exam.result.passMark': 'Il faut {{pass}} sur {{total}} pour réussir.',
  'exam.result.withTimer': 'Vous avez fait cet examen avec le chronomètre.',
  'exam.result.noTimer': 'Vous avez fait cet examen sans chronomètre.',
  'exam.result.bySubject': 'Vos résultats par sujet',
  'exam.result.subjectRow': '{{subject}} : {{correct}} sur {{total}}',
  'exam.result.unanswered.one': "Vous n'avez pas répondu à {{n}} question.",
  'exam.result.unanswered.other': "Vous n'avez pas répondu à {{n}} questions.",
  'exam.result.review': 'Voir toutes les questions',
  'exam.result.noAnswer': "Vous n'avez pas répondu à celle-ci.",
  'exam.result.unavailable': "Cette question n'a pas pu être affichée.",
  'exam.result.practise': 'Réviser les questions manquées',
  'exam.again': "Refaire l'examen",

  'exam.leave': "Quitter l'examen",
  'exam.leave.kept': 'Votre examen est enregistré. Vous pourrez le terminer plus tard.',
  'exam.leave.notKept':
    "Ce navigateur n'enregistre pas votre progression : quitter mettra fin à cet examen.",
  'exam.leave.confirm': 'Quitter et perdre cet examen?',
  'exam.leave.stay': "Continuer l'examen",
  'exam.resume': 'Terminer votre examen',
  'exam.resume.title': 'Vous avez un examen à terminer',
  'exam.resume.continue': 'Reprendre',
  'exam.new': 'Commencer un nouvel examen',
  'exam.new.confirm': 'Votre examen non terminé sera supprimé. En commencer un nouveau?',
  'exam.new.keep': "Garder celui que j'ai",
  'exam.gone.title': "Nous n'avons pas pu ouvrir votre examen",
  'exam.gone.body':
    "Certaines de ses questions ne sont pas dans cette version. Vous pouvez commencer un nouvel examen.",

  'passport.open': 'Voir mon passeport',
  'passport.exam.title': 'Examen pratique',
  'passport.exam.none': "Vous n'avez pas encore fait l'examen pratique.",
  'passport.exam.last': 'Votre dernier examen pratique',
  'passport.title': 'Mon passeport',
  'passport.intro': "Vous obtenez un tampon lorsque vous terminez la mission d'un niveau.",
  'passport.state.notEarned': 'Pas encore obtenu',
  'passport.empty.title': "Aucun tampon pour l'instant",
  'passport.empty.body': 'Terminez un niveau pour obtenir votre premier tampon.',

  'quest.accept': 'Oui, allons-y',
  'quest.decline': 'Pas maintenant',
  'quest.noQuestions': "Les questions ne sont pas prêtes pour l'instant. Réessayez plus tard.",
  /* Listed in COPY_GAPS with the English (ADR-0048). */
  'quest.askedAgain': 'Vous avez déjà répondu à certaines de ces questions ici.',
  'quest.done.title': 'Mission accomplie!',
  'common.keepPlaying': 'Continuer à jouer',
  /* `npc.officer.name` and `npc.guide.name` were here — see the English table for
     why both are gone. « L'agent » and « Le guide » are in
     `content/characters/officer.json` and `content/characters/guide.json`, in
     both languages, which is where the game reads them. */

  'level.complete.title': 'Niveau terminé!',
  'level.complete.none':
    "Vous n'avez répondu à aucune question ici. Chaque lieu de ce niveau a quelque chose à vous apprendre.",
  'level.complete.score': 'Bonnes réponses dans ce niveau : {{correct}} sur {{total}}',
  /* See the English table. « Un nouveau niveau » agrees with the level, never
     with the player, and « y jouer » needs no preposition for a place. */
  'level.complete.nextOpen': 'Un nouveau niveau est ouvert. Vous pouvez y jouer maintenant.',

  /* See the English table (ADR-0036). « Vous êtes au bout » agrees with nobody,
     so no row needs a gender. */
  'level.unfinished.title': 'Vous êtes au bout de ce niveau',
  'level.unfinished.next': "Votre mission ici n'est pas encore terminée. Prochaine étape : {{step}}",
  'level.unfinished.notStarted':
    "Vous n'avez pas encore commencé la mission de ce niveau. Retournez en arrière pour trouver où elle commence.",

  /* Four forms after « tampon » in six rows, and « à », « dans la » and
     « dans les » in the six below them: the pair of tables that proves a
     template would have been wrong in French, and — since the Prairies — in
     English too. */
  'stamp.halifax.earned': "Vous avez obtenu le tampon d'Halifax.",
  /* Not translated, and the apostrophe is the same character in both
     languages — the level document's own. */
  'stamp.peggys-cove.earned': "Vous avez obtenu le tampon de Peggy's Cove.",
  'stamp.quebec-city.earned': 'Vous avez obtenu le tampon de la Ville de Québec.',
  'stamp.ottawa.earned': "Vous avez obtenu le tampon d'Ottawa.",
  'stamp.toronto.earned': 'Vous avez obtenu le tampon de Toronto.',
  'stamp.winnipeg.earned': 'Vous avez obtenu le tampon de Winnipeg.',
  /* The fourth form after « tampon », and the one no template reaches:
     « des » is *de + les*. */
  'stamp.prairie-rail.earned': 'Vous avez obtenu le tampon des Prairies.',
  /* One row, two prepositional forms: « des » is *de + les*, and « de l'Alberta »
     is the first elision on a province name in this game. A template that got
     the first right would still have had to carry the second
     (`TN-LEVEL-alberta-foothills.md`). */
  'stamp.alberta-foothills.earned':
    "Vous avez obtenu le tampon des contreforts de l'Alberta.",
  'stamp.vancouver.earned': 'Vous avez obtenu le tampon de Vancouver.',
  /* The fifth form after « tampon », and the first contraction of *de + le*
     in this game: a template corrected four times still writes
     « le tampon de le Nord ». */
  'stamp.the-north.earned': 'Vous avez obtenu le tampon du Nord.',
  'level.halifax.play': 'Jouer à Halifax',
  'level.peggys-cove.play': "Jouer à Peggy's Cove",
  'level.quebec-city.play': 'Jouer dans la Ville de Québec',
  'level.ottawa.play': 'Jouer à Ottawa',
  'level.toronto.play': 'Jouer à Toronto',
  'level.winnipeg.play': 'Jouer à Winnipeg',
  'level.prairie-rail.play': 'Jouer dans les Prairies',
  'level.alberta-foothills.play': "Jouer dans les contreforts de l'Alberta",
  'level.vancouver.play': 'Jouer à Vancouver',
  /* The fourth play shape, after « à », « dans la » and « dans les ».
     Not « Jouer au Nord » — « au Nord » is a compass instruction. */
  'level.the-north.play': 'Jouer dans le Nord',
  /* « d'abord » ne se contracte avec rien, donc chaque ligne ne diffère que par
     l'article du lieu : aucun pour les villes, « la » pour la Ville de Québec,
     « les » pour les Prairies et les contreforts, « le » pour le Nord. */
  'level.halifax.finishFirst': "Terminez d'abord Halifax.",
  'level.peggys-cove.finishFirst': "Terminez d'abord Peggy's Cove.",
  'level.quebec-city.finishFirst': "Terminez d'abord la Ville de Québec.",
  'level.ottawa.finishFirst': "Terminez d'abord Ottawa.",
  'level.toronto.finishFirst': "Terminez d'abord Toronto.",
  'level.winnipeg.finishFirst': "Terminez d'abord Winnipeg.",
  'level.prairie-rail.finishFirst': "Terminez d'abord les Prairies.",
  'level.alberta-foothills.finishFirst': "Terminez d'abord les contreforts de l'Alberta.",
  'level.vancouver.finishFirst': "Terminez d'abord Vancouver.",
  'level.the-north.finishFirst': "Terminez d'abord le Nord.",

  'hud.label': 'Commandes du jeu',
  'hud.menu': 'Menu',
  'hud.menu.title': 'Menu',
  'hud.task': 'Mission',
  /* « Derrière vous » agrees with nobody, and names the way the player came. */
  'hud.task.behind': 'Derrière vous',

  'hud.interact.poi': 'Regarder ce lieu',
  /* « Ce qu'il y a à faire » rather than « vos missions » or « les tâches ici »:
     the phrase names no task the player has not been offered yet and claims no
     count. Impersonal throughout, so the landmark acquires no voice
     (ADR-0029 §5). */
  'hud.interact.poi.offer': 'Voir quoi faire ici',
  /* « Cette personne » is feminine whoever it names, so the row is written about
     the person in reach and never about the player: no agreement, no bracketed
     ending (`docs/content-review.md` §8.6). */
  'hud.interact.npc': 'Parler à cette personne',
  /* Shorter than its English and saying the same two things — the state, then
     the way on — which is what a translation of meaning is allowed to do. */
  'hud.interact.done': 'Terminé. Revoir',
  'hud.interact.hint':
    "Un repère montre quelqu'un ou quelque chose à choisir. Approchez-vous, puis choisissez.",
  /* Voir le bloc anglais (ADR-0043). « Faites votre choix » plutôt que
     « choisissez-le », dont le pronom devrait s'accorder avec ce qui est offert,
     un lieu ou une personne. */
  'hud.stop.hint': 'Arrêt ici. Faites votre choix, ou avancez de nouveau pour continuer.',
  'hud.interact.officer': "Parler à l'agent",
  'hud.interact.parliament-hill': 'Regarder la Colline du Parlement',
  /* « Au », the contraction of « à le », and it agrees with the « votre guide »
     the authored quest lines already use. */
  'hud.interact.guide': 'Parler au guide',
  /* Voir le bloc anglais. L'article suit le nom du lieu et s'élide devant une
     voyelle (« l'étal », « l'élévateur », « l'érable »); un nom de lieu garde la
     majuscule de son document (« la Tour de l'horloge d'Halifax », « la
     Bibliothèque du Parlement ») et un générique la perd dans la phrase (« la
     place Nathan-Phillips »). */
  'hud.interact.town-clock': "Regarder l'horloge",
  'hud.interact.market-stall': "Regarder l'étal de marché",
  'hud.interact.harbour-tug': 'Regarder le remorqueur',
  'hud.interact.granite-shore': 'Regarder la côte',
  'hud.interact.fish-store': 'Regarder le hangar',
  'hud.interact.village-house': 'Regarder la maison',
  'hud.interact.city-wall': 'Regarder le mur',
  'hud.interact.terrace-kiosk': 'Regarder le kiosque',
  'hud.interact.rideau-locks': 'Regarder les écluses',
  'hud.interact.library-of-parliament': 'Regarder la Bibliothèque',
  'hud.interact.warming-hut': 'Regarder la cabane',
  'hud.interact.dows-lake': 'Regarder le pavillon',
  'hud.interact.streetcar': 'Regarder le tramway',
  'hud.interact.nathan-phillips-square': 'Regarder la place Nathan-Phillips',
  'hud.interact.footbridge': 'Regarder la passerelle',
  'hud.interact.autumn-maple': "Regarder l'érable",
  'hud.interact.grain-bins': 'Regarder les silos',
  'hud.interact.grain-elevator': "Regarder l'élévateur",
  'hud.interact.combine-harvester': 'Regarder la moissonneuse',
  'hud.interact.container-car': 'Regarder le wagon',
  'hud.interact.ranch-gate': 'Regarder la barrière',
  'hud.interact.ranch-barn': 'Regarder le ranch',
  'hud.interact.pump-jack': 'Regarder le chevalet',
  'hud.interact.beef-cattle': 'Regarder les bovins',
  'hud.interact.marina': 'Regarder la marina',
  'hud.interact.bulk-carrier': 'Regarder le navire',
  'hud.interact.spruce-stand': 'Regarder les épinettes',
  'hud.interact.driftwood': 'Regarder le bois flotté',

  'storage.warning': "Ce navigateur n'enregistre pas votre progression.",
  'storage.warning.help':
    "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet.",
  'save.export': 'Enregistrer dans un fichier',
  'save.import': 'Ouvrir un fichier',
  'save.import.error': "Nous n'avons pas pu lire ce fichier.",
  'save.import.tooBig': 'Ce fichier est trop volumineux.',
  'save.import.done': 'Votre partie est restaurée.',
  'save.newer.title': "Cette partie sauvegardée provient d'une version plus récente.",
  /* Listed in COPY_GAPS with the English. « remplacés » agrees with « votre
     progression et vos réglages », never with the player; « Garder ma
     progression » names what the safe answer keeps, as the English does. */
  'save.section': 'Votre progression',
  'save.section.help':
    "Gardez une copie dans un fichier, ou apportez votre progression d'un autre appareil.",
  'save.import.confirm': 'Remplacer votre progression par ce fichier?',
  'save.import.confirm.body':
    'Votre progression et vos réglages sur cet appareil seront remplacés par ceux du fichier.',
  'save.import.replace': 'Remplacer',
  'save.import.keep': 'Garder ma progression',
  'save.import.error.help': 'Choisissez un fichier enregistré depuis ce jeu.',
  'save.import.newer.help': 'Mettez le jeu à jour, puis ouvrez le fichier de nouveau.',
  'save.import.notSaved.help': "Rien n'a été modifié.",
  'save.import.done.help': 'Le jeu va recommencer avec la progression de votre fichier.',
  'save.import.continue': 'Continuer',
  /* Transcribed from `TN-SAVE-save-and-reload.md`, which owns both rows and
     writes the French out: no space before the question mark, which is Canadian
     French, and « définitive » agrees with « action ». `TN-SAVE-11` asserts both
     of these strings by name. */
  'save.clear': 'Supprimer ma progression',
  'save.clear.confirm': 'Cette action est définitive. Tout supprimer?',
  /* Transcribed from `TN-SAVE` with the English, and the help line is the one
     row that story **amended** rather than taking as proposed.

     It used to read « Une partie est peut-être encore sur cet appareil. », on
     the reading that « une partie » is "some of it". True in a vacuum, false in
     this product's vocabulary: in this game's French « partie » is the word for
     *a saved game* — « votre partie sauvegardée » (`save.error.title`), « Votre
     partie est restaurée » (`save.import.done`) — so the sentence read first as
     *a saved game may still be on this device*, which is a different claim, on
     the one screen where a player needs certainty about what was destroyed.
     « Une partie **de votre progression** » can only be read as a portion, and
     names the same thing the first sentence names. `TN-SAVE-11` asserts the new
     wording and refuses the old by name; `TN-SAVE-10` measures it at 200 %. */
  'save.clear.yes': 'Tout supprimer',
  'save.clear.keep': 'Garder ma progression',
  'save.clear.failed': "Nous n'avons pas pu terminer la suppression de votre progression.",
  'save.clear.failed.help':
    'Une partie de votre progression est peut-être encore sur cet appareil. Réessayez.',

  'locomotion.walk.label': 'Marche',
  /* « Glissade » is the activity — « faire de la glissade » — and « Toboggan »
     is the object you sit on. The label names what you are doing (`OQ-MOVE-1`). */
  'locomotion.toboggan.label': 'Glissade',
  'locomotion.skate.label': 'Patinage',
  /* « Vélo », the everyday word, and it needs no article in a label. Not
     « Cyclisme », which is a race. */
  'locomotion.bike.label': 'Vélo',
  /* The same word as the English, declared here rather than shared with it:
     `TN-MOVE-06` requires a value in each language even when they are identical,
     so a missing French row fails the check instead of reading correctly. Not
     « En train », which is a phrase where every other row is a bare noun. */
  'locomotion.train.label': 'Train',
  'locomotion.horse.label': 'Cheval',
  'locomotion.skateboard.label': 'Planche à roulettes',

  'level.error.body': 'Vérifiez votre connexion et réessayez.',
  'level.error.retry': 'Réessayer',
  'level.error.back': 'Retour',
  /* Listed in COPY_GAPS with the English. « Internet » takes its capital in
     Canadian French, and « l'ouvrez » is the place, never the player. */
  'level.needsConnection.body':
    "Cet endroit a besoin d'une connexion Internet la première fois que vous l'ouvrez. Connectez-vous, puis réessayez.",

  'level.halifax.loading': 'Préparation du port.',
  /* « La côte rocheuse » is one letter from « les Rocheuses », which level 8's
     art contract deliberately refuses to claim; « la roche nue » ships. */
  'level.peggys-cove.loading': 'Préparation de la roche nue.',
  'level.halifax.error.title': "Nous n'avons pas pu charger Halifax.",
  'level.peggys-cove.error.title':
    "Nous n'avons pas pu charger Peggy's Cove.",
  'level.quebec-city.loading': 'Préparation de la pente enneigée.',
  /* The row that proves the template would have been wrong: the article is
     here and it is absent from the other three. */
  'level.quebec-city.error.title': "Nous n'avons pas pu charger la Ville de Québec.",
  'level.ottawa.loading': 'Préparation du canal.',
  'level.ottawa.error.title': "Nous n'avons pas pu charger Ottawa.",
  'level.toronto.loading': 'Préparation des rues de la ville.',
  'level.toronto.error.title': "Nous n'avons pas pu charger Toronto.",
  'level.winnipeg.loading': 'Préparation de la rive.',
  /* No article and no elision — « charger Winnipeg » — where Halifax's row
     elides and the Prairies' takes a plural article. The easy case, written out
     beside the hard ones because that is what makes the pair an argument. */
  'level.winnipeg.error.title': "Nous n'avons pas pu charger Winnipeg.",
  'level.prairie-rail.loading': 'Préparation de la voie ferrée.',
  'level.prairie-rail.error.title': "Nous n'avons pas pu charger les Prairies.",
  /* « Préparation du pâturage », not « de la prairie »: « la prairie » is the
     plainest French noun for open grassland and it is **the title of level 7**,
     so the obvious word would have put the previous level's name on this
     level's waiting screen — the exact defect `TN-WAIT` exists to make
     impossible, arriving through a common noun instead of a template. English
     has no such collision, which is why the two languages were written
     separately rather than translated from each other
     (`TN-LEVEL-alberta-foothills.md`). */
  'level.alberta-foothills.loading': 'Préparation du pâturage.',
  'level.alberta-foothills.error.title':
    "Nous n'avons pas pu charger les contreforts de l'Alberta.",
  'level.vancouver.loading': 'Préparation du front de mer.',
  /* « La rive » is Winnipeg's and « le rivage » is a word away from it;
     « la grève » is the exact Quebec French noun for a gravel shore and also
     means a labour strike, which a newcomer studying for citizenship meets
     first. « La plage de galets » ships. */
  'level.the-north.loading': 'Préparation de la plage de galets.',
  'level.vancouver.error.title': "Nous n'avons pas pu charger Vancouver.",
  /* The article goes down and the noun keeps its capital: « le nord » in
     lower case is a direction. Level 8 is the opposite case, so a template
     taught to lower-case a title's first word would set this one pointing. */
  'level.the-north.error.title': "Nous n'avons pas pu charger le Nord.",
  'title.game': 'TrueNorth',
  'title.tagline': "Préparez-vous à l'examen de citoyenneté canadienne.",
  'title.notOfficial': "Ce jeu n'est pas fait par le gouvernement du Canada.",
  'title.play': 'Jouer',
  'title.continue': 'Continuer',
  'title.lastPlayed': 'Dernier niveau : {{level}}',

  'map.open': 'Choisir un niveau',
  'map.title': 'Choisir un niveau',
  /* « tampon », never « timbre »: a timbre is a postage stamp and the mark in a
     passport is a tampon. `OQ-MAP-5` asked it, `TN-PASSPORT-my-passport.md`
     answered it on 2026-09-08, and it moves `map.stamps` and both
     `map.locked.stamps` rows together. « Cachet » is recorded as `OQ-PASSPORT-5`
     for the first French reviewer. */
  'map.stamps': 'Tampons : {{earned}} sur {{total}}',
  'map.levelsReady': 'Niveaux prêts : {{ready}} sur {{total}}',
  'map.moreComing': "D'autres arrivent.",
  'map.state.open': 'Ouvert',
  'map.state.locked': 'Verrouillé',
  'passport.state.earned': 'Obtenu',
  'map.state.notBuilt': 'Pas encore créé',
  'map.open.help': 'Vous pouvez y jouer maintenant.',
  'map.locked.after': "Terminez d'abord {{level}}.",
  'map.locked.stamps.one': 'Gagnez encore {{n}} tampon pour ouvrir ce niveau.',
  'map.locked.stamps.other': 'Gagnez encore {{n}} tampons pour ouvrir ce niveau.',
  'map.notBuilt.help': 'Ce niveau est encore en préparation.',
  'map.number': 'Niveau {{n}}',
  /* « ici » and no place: the card already names it, and French does not put
     one preposition in front of all ten (« à Ottawa », « dans le Nord »). */
  'map.here': 'Vous êtes ici',

  'common.back': 'Retour',
  'flow.leaveLevel': 'Quitter le niveau',

  /* Le panneau « À propos de ce lieu ». Voir le bloc anglais pour la raison
     de chaque ligne. Aucune de ces lignes ne nomme une nation, un lieu ou un
     éditeur : ces mots arrivent du document du niveau, dans les deux langues,
     et un endonyme s'écrit de la même façon dans les deux
     (`docs/content-review.md` §9.3). */
  'about.open': 'À propos de ce lieu',
  'about.title': 'À propos de ce lieu',
  'about.nations': 'Noms cités dans cet énoncé',
  'about.source': "D'où cela vient",
  'about.source.outside': "Ce lien ouvre la source à l'extérieur du jeu.",
  'about.unavailable.notShown':
    "Nous montrons cet énoncé seulement après que quelqu'un l'a vérifié auprès de sa source. " +
    "Celui-ci n'a pas passé cette vérification. Nous ne le montrons donc pas.",
  'about.unavailable.checking':
    "La source de ce lieu a changé. Quelqu'un vérifie l'énoncé de nouveau. " +
    'Il reviendra une fois cette vérification terminée.',
  'about.unavailable.ours':
    "Cela concerne nos propres vérifications. Ce n'est pas une erreur de la source, et ce n'est pas de votre faute.",

  'level.halifax.title': 'Halifax',
  'level.halifax.subtitle': 'Droits et responsabilités',
  'level.peggys-cove.title': "Peggy's Cove",
  'level.peggys-cove.subtitle': 'Qui nous sommes',
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
  'level.the-north.title': 'Le Nord',
  'level.the-north.subtitle': 'Les régions du Canada',

  /* Listed in COPY_GAPS with the English. « prête » agrees with « version »,
     which is feminine, and never with the player. « Recharger » is the verb a
     French browser puts on the same action. */
  'update.ready': 'Une nouvelle version est prête',
  'update.reload': 'Recharger',

  /* Listed in COPY_GAPS with the English. « à la verticale » is the rotate
     overlay's own phrase, so the two screens a player could meet on the same
     device use one wording. « Ce jeu » carries no agreement with the player, and
     « ici » is the screen they are on rather than a device they do not have. */
  'portrait.notice': 'Ce jeu fonctionne mieux sur un téléphone tenu à la verticale.',
  'portrait.notice.help': 'Vous pouvez quand même jouer ici.',
};

/**
 * Strings this module had to write because no story table carries them.
 *
 * **It was empty, and the "About this place" panel is why it is not.** Sixteen
 * rows are listed below, and listing them is the point: `docs/stories/README.md`
 * says the UI invents no copy, so a string this directory had to write is
 * declared here and reported upward to be ratified or replaced in a story file.
 * A row written and left off this list would be a string that *looks* reviewed,
 * which is the one outcome this constant exists to prevent. The unit suite
 * pins the list to exactly its entries, so one more invented row anywhere else
 * fails the build rather than joining them quietly.
 *
 * Eight are the panel's. The five after `map.here` are the character creator's,
 * explained beside the list. The ninth is `map.here`, "You are here", and
 * `TN-MAP` now carries it as a proposed row. The level select marks the stop the
 * player is at on the map and on the route beside the cards, and both are hidden
 * from assistive technology, so the card has to carry the fact as a word.
 * `TN-MAP` has no row for it, because until then the marked stop was
 * computed from words the card already carried.
 *
 * Why there was no table to transcribe from: `docs/content-review.md` §10.2
 * specifies the panel — where it is reachable from, what it states, that it is
 * sourced — and specifies no wording, and no file in `docs/stories/` has ever
 * owned its chrome. The ten level stories own the *statement*, which is content
 * on the level document and never a row here.
 *
 * The rest were reported and are written down now. `settings.state.on` / `.off`,
 * `hud.label`, the four mode labels and the eight per-level waiting and failure
 * rows were each reported as a gap and are each written down now — in
 * `TN-COPY-strings-and-counts.md`, `TN-HUD`, `TN-MOVE-locomotion-labels.md`,
 * `TN-WAIT-a-level-opens-or-it-does-not.md` and the four level stories — so
 * nothing in this table is invented: every row above is transcribed from a
 * "Player-facing copy" table and names the story file it came from.
 *
 * The closed gaps landed differently, on purpose:
 *
 *  - `hud.label` is drawn here by the HUD itself, like `hud.menu`. It is one
 *    name for the whole game, `TN-HUD-09` requires it to become French when the
 *    player changes language without reloading the level, and `TN-HUD`'s table
 *    rules out "HUD", "Region" and the empty string — none of which a
 *    caller-supplied `string` can be stopped from being. A row the region reads
 *    itself is stronger than a required option: the name cannot be omitted *or*
 *    replaced with a wrong one.
 *  - `level.<id>.loading` and `level.<id>.error.title` are **required options**
 *    on `createLevelLoading` and `createLevelError`. Each names one level, the
 *    level is chosen by the composition root, and under ADR-0010 a level's own
 *    text will move onto the level document — so both screens take theirs as
 *    data and `app/bootstrap` looks the row up by id. Required, not defaulted: a
 *    screen that waits without saying what for, or fails without naming what
 *    failed, is the defect `TN-LEVEL-01` and `TN-WAIT-02` are written against,
 *    and a required option cannot be forgotten.
 *  - A mode label is read straight from this table by the composition root,
 *    under the key the *level document* carries (`LocomotionTuning.labelKey`).
 *    The level says which key; this table says what the key means; neither says
 *    the other's half.
 *
 * The unit suite asserts this list holds exactly these rows *and* that
 * the marker this module used to carry beside an invented string survives
 * nowhere in the source, so a new one cannot slip in unlisted.
 */
export const COPY_GAPS: readonly CopyKey[] = [
  'about.open',
  'about.title',
  'about.nations',
  'about.source',
  'about.source.outside',
  'about.unavailable.notShown',
  'about.unavailable.checking',
  'about.unavailable.ours',
  'map.here',
  /* The character creator's five: the skin group's reading line, and the
     `presentation` slot's label and three options. No story table carries any
     of them; the reasoning for each word is beside the rows in `EN` and `FR`. */
  'creator.slot.skin.help',
  'creator.slot.presentation',
  'creator.presentation.feminine',
  'creator.presentation.masculine',
  'creator.presentation.neutral',
  /* ADR-0036's five. The card at the end of an unfinished level — its heading and
     its two ways of saying what is left — and the question card's tag, reworded
     from a lone "New" into words that say what they are about. `TN-DONE` has no
     row for the first three and `TN-CARD`'s table still carries the old tag. */
  'level.unfinished.title',
  'level.unfinished.next',
  'level.unfinished.notStarted',
  'card.kind.new',
  'card.kind.seen',
  /* ADR-0039, 2026-09-14: the audit's copy findings. The hint is a ratified
     `TN-REACH` row reworded, so it is unratified again until that story's owner
     takes the new words; the twenty-seven landmark prompts are per-target rows
     `TN-REACH` says belong in each level's story; and the ten finish-first
     sentences replace a template `TN-MAP` owns. All three are written as
     proposed rows in those stories. */
  'hud.interact.hint',
  'hud.interact.town-clock',
  'hud.interact.market-stall',
  'hud.interact.harbour-tug',
  'hud.interact.granite-shore',
  'hud.interact.fish-store',
  'hud.interact.village-house',
  'hud.interact.city-wall',
  'hud.interact.terrace-kiosk',
  'hud.interact.rideau-locks',
  'hud.interact.library-of-parliament',
  'hud.interact.warming-hut',
  'hud.interact.dows-lake',
  'hud.interact.streetcar',
  'hud.interact.nathan-phillips-square',
  'hud.interact.footbridge',
  'hud.interact.autumn-maple',
  'hud.interact.grain-bins',
  'hud.interact.grain-elevator',
  'hud.interact.combine-harvester',
  'hud.interact.container-car',
  'hud.interact.ranch-gate',
  'hud.interact.ranch-barn',
  'hud.interact.pump-jack',
  'hud.interact.beef-cattle',
  'hud.interact.marina',
  'hud.interact.bulk-carrier',
  'hud.interact.spruce-stand',
  'hud.interact.driftwood',
  'level.halifax.finishFirst',
  'level.peggys-cove.finishFirst',
  'level.quebec-city.finishFirst',
  'level.ottawa.finishFirst',
  'level.toronto.finishFirst',
  'level.winnipeg.finishFirst',
  'level.prairie-rail.finishFirst',
  'level.alberta-foothills.finishFirst',
  'level.vancouver.finishFirst',
  'level.the-north.finishFirst',
  /* The update notice's two (ADR-0034, "Update flow"): the sentence and the
     Reload control. ADR-0034 names this list as where they go until a story
     ratifies them. */
  'update.ready',
  'update.reload',
  /* The portrait notice's two (ADR-0060): the recommendation, and the sentence
     that keeps it from reading as a refusal on a platform this game supports.
     ADR-0060 names this list as where they go until a story ratifies them. */
  'portrait.notice',
  'portrait.notice.help',
  /* ADR-0043: what the strip says while a drive holds the player at a stop,
     proposed for `TN-REACH-12` until that story's owner takes the words. */
  'hud.stop.hint',
  /* ADR-0046's eleven, Settings' "Your progress" section: its heading and
     reading line, the confirmation before a file replaces the save (question,
     cost, both answers), the sentence under an **import's** refusal, and the
     dialog that starts the game again from the file.

     Everything "Delete my progress" draws left this list on 2026-09-17:
     `TN-SAVE`'s table carries the control, the question, both answers and both
     halves of the refusal now, and all six are transcribed rather than
     listed. */
  'save.section',
  'save.section.help',
  'save.import.confirm',
  'save.import.confirm.body',
  'save.import.replace',
  'save.import.keep',
  'save.import.error.help',
  'save.import.newer.help',
  'save.import.notSaved.help',
  'save.import.done.help',
  'save.import.continue',
  /* ADR-0034's amendment: the sentence on the card a level shows instead of
     opening, offline, when its art was never kept. */
  'level.needsConnection.body',
  /* ADR-0048: what the strip says when a task step asks again what this visit
     already answered. */
  'quest.askedAgain',
  /* The second live-site audit's P3 pass: the completion card's line about the
     level that just opened, in one plain sentence instead of the map's three
     rows joined, and the cue after the task when its stop is behind the player.
     Proposed rows in `TN-DONE` and `TN-HUD`. */
  'level.complete.nextOpen',
  'hud.task.behind',
];

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
/**
 * Is there a row under this key, and is it one {@link text} may draw?
 *
 * Two screens build a key from data rather than writing it: the map, whose cards
 * are ten level ids, and the composition root, which looks up a level's waiting
 * sentence and the `labelKey` a level document declares for its locomotion mode.
 * Both can therefore ask for a row nobody wrote — level 2 has a subject line and
 * deliberately no place name, and a level id can arrive from a `?level=` address
 * a player typed. Asked rather than assumed, because the alternative reaches a
 * player as the word "undefined" or as a dialog with no name.
 *
 * A plural form is not a {@link CopyKey}: `study.count.one` is a row, and it is
 * reachable only through {@link count}, so the predicate refuses it rather than
 * narrowing a caller into drawing "{{n}} question" with the placeholder still in
 * it.
 */
export function hasCopyRow(key: string): key is CopyKey {
  return (
    Object.hasOwn(EN, key) &&
    !key.endsWith('.one') &&
    !key.endsWith('.other')
  );
}

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
 *
 * The browser's own order is kept: the first tag that is French or English
 * decides, so `['de-DE', 'fr-CA']` is French and `['en-US', 'fr-CA']` is
 * English. A browser that asks for neither gets `fallback`, which the
 * composition root takes from `game.config.json#/defaultLocale`.
 */
export function preferredLocale(
  languages: readonly string[],
  fallback: UiLocale = 'en',
): UiLocale {
  for (const tag of languages) {
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return fallback;
}
