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
 * above each block. There are no exceptions left: {@link COPY_GAPS} is empty.
 * See that constant for what stays a caller's option and why.
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
  'quest.done.title': 'Task done!',
  'common.keepPlaying': 'Keep playing',
  /* docs/stories/TN-LEVEL-ottawa.md — the officer's name, which is what the
     dialogue is called for a screen reader (`TN-QUEST-08`) and what a player
     reads above his lines. A character with no row cannot be given an unnamed
     dialog, so the offer is refused and reported instead. */
  'npc.officer.name': 'The officer',
  /* docs/stories/TN-GUIDE-the-guide.md — the same string for the other
     character, and one row for the three levels it stands on. Named by its role
     exactly as the officer is: never a proper name, never a species, never a
     word borrowed from a nation's language (`docs/content-review.md` §3.1).
     Without this row `app/bootstrap/quest.ts` refuses all three offers, Halifax
     included, and Halifax is the level `content/game.config.json` opens on. */
  'npc.guide.name': 'The guide',

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
  'level.halifax.play': 'Play Halifax',
  'level.quebec-city.play': 'Play Québec City',
  'level.ottawa.play': 'Play Ottawa',
  'level.toronto.play': 'Play Toronto',
  'level.winnipeg.play': 'Play Winnipeg',
  'level.prairie-rail.play': 'Play the Prairies',
  'level.alberta-foothills.play': 'Play the Alberta foothills',
  'level.vancouver.play': 'Play Vancouver',

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

  /* docs/stories/TN-REACH-what-is-in-reach.md — what `interact-prompt` says,
     and the one-time explanation of the marks beside it.

     **The prompt says what pressing will do; it is never a name.** It drew the
     landmark's own name from the level document until these rows existed, which
     says what is there rather than what choosing it does — and put "CN Tower"
     inside `hud`, a surface `TN-NAMES-04` fails the build for. A name is not a
     copy string when it is interpolated at runtime, which is exactly how it got
     past a check written against copy tables.

     Three generic rows and one per-target row per target a level writes one for,
     resolved in one order by `app/ui/interact.ts`: **done** beats a level's own
     row, which beats the kind. A target with no row offers no prompt at all —
     never "Interact", never a name, never an empty string.

     `hud.interact.hint` **names no input**: not "tap", not a key, not "hold". A
     hint that names one input is wrong for the other three, and "choose it" is
     true for a thumb, a keyboard and one switch. */
  'hud.interact.poi': 'Look at this place',
  'hud.interact.npc': 'Talk to this person',
  'hud.interact.done': 'Done. See this one again',
  'hud.interact.hint': 'A mark shows something to see. Get close to it, then choose it.',
  /* docs/stories/TN-LEVEL-ottawa.md — that level's own two rows, keyed on the
     ids its document gives the targets. Ottawa may write them because its
     character is named and its landmark is not on `TN-NAMES`'s list; a level
     whose landmark **is** on that list draws the generic row instead. */
  'hud.interact.officer': 'Talk to the officer',
  'hud.interact.parliament-hill': 'Look at Parliament Hill',
  /* docs/stories/TN-GUIDE-the-guide.md — a per-target row whose target is on
     three levels, so the character's own story writes it once rather than three
     level stories writing it three times. It is an ordinary rule-2 row: `done`
     still wins, so a finished guide reads "Done. See this one again". Its
     absence was a live defect — the kind row calls the guide "this person", and
     the guide is a beaver. */
  'hud.interact.guide': 'Talk to the guide',

  /* docs/stories/TN-SAVE-save-and-reload.md — the storage warning these screens
     raise, and the way out it has to offer (TN-HUD-03). */
  'storage.warning': 'This browser is not saving your progress.',
  'storage.warning.help':
    'You can keep playing, but everything will be gone when you close the tab.',
  'save.export': 'Save to a file',

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
  'quest.done.title': 'Mission accomplie!',
  'common.keepPlaying': 'Continuer à jouer',
  'npc.officer.name': "L'agent",
  /* « Guide » is epicene — only the article changes — so this row needs no
     bracketed ending and may never acquire one (`docs/content-review.md` §8.6).
     The article is masculine because the character is a beaver, « un castor »,
     and no statement about a person's gender is being made. Never « Le
     castor »: the label names what the character is for, not what it is. */
  'npc.guide.name': 'Le guide',

  'level.complete.title': 'Niveau terminé!',
  'level.complete.none':
    "Vous n'avez répondu à aucune question ici. Chaque lieu de ce niveau a quelque chose à vous apprendre.",
  'level.complete.score': 'Bonnes réponses dans ce niveau : {{correct}} sur {{total}}',

  /* Four forms after « tampon » in six rows, and « à », « dans la » and
     « dans les » in the six below them: the pair of tables that proves a
     template would have been wrong in French, and — since the Prairies — in
     English too. */
  'stamp.halifax.earned': "Vous avez obtenu le tampon d'Halifax.",
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
  'level.halifax.play': 'Jouer à Halifax',
  'level.quebec-city.play': 'Jouer dans la Ville de Québec',
  'level.ottawa.play': 'Jouer à Ottawa',
  'level.toronto.play': 'Jouer à Toronto',
  'level.winnipeg.play': 'Jouer à Winnipeg',
  'level.prairie-rail.play': 'Jouer dans les Prairies',
  'level.alberta-foothills.play': "Jouer dans les contreforts de l'Alberta",
  'level.vancouver.play': 'Jouer à Vancouver',

  'hud.label': 'Commandes du jeu',
  'hud.menu': 'Menu',
  'hud.menu.title': 'Menu',
  'hud.task': 'Mission',

  'hud.interact.poi': 'Regarder ce lieu',
  /* « Cette personne » is feminine whoever it names, so the row is written about
     the person in reach and never about the player: no agreement, no bracketed
     ending (`docs/content-review.md` §8.6). */
  'hud.interact.npc': 'Parler à cette personne',
  /* Shorter than its English and saying the same two things — the state, then
     the way on — which is what a translation of meaning is allowed to do. */
  'hud.interact.done': 'Terminé. Revoir',
  'hud.interact.hint': 'Un repère indique quelque chose à voir. Approchez-vous, puis choisissez.',
  'hud.interact.officer': "Parler à l'agent",
  'hud.interact.parliament-hill': 'Regarder la Colline du Parlement',
  /* « Au », the contraction of « à le », and it agrees with the « votre guide »
     the authored quest lines already use. */
  'hud.interact.guide': 'Parler au guide',

  'storage.warning': "Ce navigateur n'enregistre pas votre progression.",
  'storage.warning.help':
    "Vous pouvez continuer à jouer, mais tout sera perdu à la fermeture de l'onglet.",
  'save.export': 'Enregistrer dans un fichier',

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

  'level.halifax.loading': 'Préparation du port.',
  'level.halifax.error.title': "Nous n'avons pas pu charger Halifax.",
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
  'level.vancouver.error.title': "Nous n'avons pas pu charger Vancouver.",
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
 */
export function preferredLocale(languages: readonly string[]): UiLocale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'fr') return 'fr';
    if (base === 'en') return 'en';
  }
  return 'en';
}
