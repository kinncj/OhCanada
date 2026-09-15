# ADR-0036: A stamp is for the task, and a level asks its own subject

- Status: Accepted (2026-09-14). **Amended by ADR-0048 (2026-09-15):** with no `answer` step being played a
  landmark asks only a question resting on its own sentence, or nothing — §2 rule 4 no longer falls back to the
  rest of the subject — and no landmark draw asks again what the level visit has answered. The consequence below
  about the 24 landmarks with no question of their own is replaced: they ask nothing outside a task.
- Amends: `TN-DONE-01` and `TN-DONE-02` (reaching the end of a level no longer earns the stamp of a level whose
  task is not done); `TN-CARD` (the counter, the "New" tag and the controls after an answer). Resolves
  `OQ-PASSPORT-8`.
- Criteria: the rules below, held by the tests named under Consequences.

## Context

A play-through of the live build on 2026-09-14 found the core learning loop broken in three places.

**1. The questions had nothing to do with the place or the level.** Toronto's streetcar — a card about what
cities look after — asked about Magna Carta, and the CN Tower asked about residential schools. Winnipeg's
officer talked about laws and then asked about the Royal Flag. "What is the job of the police?" was the first
landmark question in Halifax, Peggy's Cove, the Prairies, the Alberta foothills, Vancouver and the North.
Halifax's tracker said "Answer 2 questions about voting" over a card that read "Question 1 of 1" and asked
about the police.

The cause was one missing field. `app/bootstrap/main.ts` drew every landmark question as `drill(1)` from the
whole bank, and said so in a comment: `SceneLevel` — the level the renderer hands back — did not carry
`subject`, so the composition root could not ask for one. ADR-0030 §2 had already said what the draw should
be: "a level's `subject` is the remit of its quest's `answer` steps and of the bank the scheduler draws for
it". Two further defects hid behind the first:

- a landmark always asked **one** question, so an `answer` step of two or three could only be finished by
  engaging a landmark already marked "Done" again and again, and the card never counted the step;
- a quest that opens `talk` → `answer` — Peggy's Cove's lighthouse and the North's sternwheeler, whose
  givers say "then three questions" — asked **nothing** on acceptance, because there was no landmark left
  to ask at. The count was made up later by whatever landmark came next, on whatever subject.

**2. A stamp was earned without doing the task.** Reaching the end of Ottawa drew "You earned the Ottawa
stamp. You did not answer any questions here." Peggy's Cove and Québec City stamped with their tasks
unfinished. `TN-DONE-01` and `TN-DONE-02` say exactly this — "the stamp is still earned, because reaching the
end is what earns it" — and the passport says the opposite to every player who opens it:
`passport.intro`, "You earn a stamp when you finish a level's task."

`TN-PASSPORT` noticed the disagreement and parked it as `OQ-PASSPORT-8`, "a wording question rather than a
behaviour one", on the premise that six of the ten levels had no task. That premise has expired: every one of
the ten levels ships a quest (`content/quests/`, ten documents, one per level).

**3. The in-level card was cluttered.** Every card said "Question 1 of 1" and carried an unexplained "New",
and after an answer offered "Finish" and "Close" side by side, both of which did the same thing.

## Decision

### 1. A stamp is for the task

**The passport's promise wins.** It is the sentence printed on screen, and `TN-CARD` already states the
principle for its own card: "that promise is printed on the card, so it is the one that wins when something
else disagrees with it". A learning tool whose stamps can be collected by holding one direction teaches that
the questions are optional.

Reaching the end of a level (`reachLevelEnd`, `app/domain/entities/level-end.ts`):

1. **earns nothing new when the stamp is already in the passport.** A stamp is never taken away — including a
   stamp an older build wrote for a walk;
2. **earns the stamp when the level sets no task.** None ships today, and a level nobody can finish is a dead
   end rather than a rule;
3. **earns the stamp when one of the level's quests is complete** and the stamp is missing (a save from an
   older build, an import);
4. **otherwise earns nothing: the level is unfinished.**

Every other stamp is earned where it always was: by the answer or the visit that completes the quest.

**Unlocking follows stamps, unchanged.** `unlockedLevelIds` runs over the stamps in the save, so an unfinished
level opens nothing. The stories do not conflict on this once rule 1 is settled: `TN-DONE`'s "the level that
just opened is offered" describes the card of a level that earned its stamp.

**The end of an unfinished level still draws a card**, because the player has arrived somewhere and a game
that pretends otherwise is the defect this project keeps finding. It is the same `quest-complete-card` dialog
with `data-reason="unfinished"`:

- the heading `level.unfinished.title` — "You are at the end of this level";
- `passport.intro`, the promise itself, in the passport's own words;
- what is left: `level.unfinished.next` — "Your task here is not finished yet. Next: {{step}}", where
  `{{step}}` is the tracker's own line — or `level.unfinished.notStarted` when no task is being played;
- **"Keep playing" as the one primary action**, and "Choose a level" beside it, quiet. No stamp line, no
  score, no next level, no passport button: nothing was earned.

It is drawn once per sitting, like the arrival it answers. The world keeps its marks — `markLevelComplete` is
not called — and finishing the task afterwards still draws "Task done!" with the stamp and the level that
opened. `markLevelComplete` moved from the arrival to the finished card, so a level finished by its task
tells the world it is over too: it used to be called only on arrival at the end, which is now the rarer route
to a stamp. That last path matters in shipped content: Halifax's harbour tug and Peggy's Cove's village house
stand past their levels' arrival lines, so a player finishing those tasks crosses the end first. Before this
ADR, finishing the task after the end said nothing at all.

### 2. A level asks its own subject, and a landmark asks what it just told

`SceneLevel` carries `subject` (`app/adapters/phaser/level-document.ts`). `app/bootstrap/landmark-questions.ts`
is the rule:

1. **Every in-level question comes from the level's subject** (ADR-0030 §2). An `answer` step's own `subject`
   is the fallback only when the level has none; `an-answer-step-asks-its-level-subject.test.ts` holds the two
   equal in shipped content.
2. **While an `answer` step is being played, a landmark asks everything that step has left**, narrowed by its
   `questionPool` when it names one.
3. **The card counts the step, not the draw.** "Question 2 of 2" is the second of the step's two questions.
   With no step being played a landmark asks one question and the card draws **no counter**.
4. **A question resting on the sentence the landmark just told is asked first**, when it is inside the subject
   and was not asked in this sitting. A proposition's identity is its `source.quote` (ADR-0028 §4, ADR-0030);
   `app/application/content/proposition.ts` uses the contract gate's normalisation and counts a question when
   the whole of one quote appears, on word boundaries, in the other — a blurb often rests on two sentences
   while each question quotes one. `scheduleReview` takes this as `prefer` and ignores any id outside the
   subject or the pool, so a landmark whose sentence another subject grades asks nothing out of remit.
5. **Accepting a quest whose next step is `answer` asks that step at the giver**, through the same chain a
   landmark uses (`QuestWiring.onAccepted`).

Study's draw is unchanged: it passes no scope and draws from every bank. Its card follows §3 like every other
use of the card.

### 3. The card says something, and offers one way on

- **No counter for one question.** "Question 1 of 1" counts nothing. The dialog is then named by the question
  itself and has no separate description, so the question is read once.
- **In a level the counter counts the task** (`QuestionView.progress`).
- **The tag is words about the question:** "New question" / « Nouvelle question », and "You have seen this
  question before" / « Vous avez déjà vu cette question ». It still says nothing about how questions are
  chosen (`TN-CARD-02`).
- **After the last question is answered, "Close" goes**, leaving "Finish". Both end the set and keep the
  answer, so two controls with nothing to tell them apart was the clutter. In Study they differ in one respect —
  "Close" says the answers were kept and skips the summary — and the summary is the better end to a drill whose
  every question was answered. On any other question "Next" and "Close" are different choices — go on, or
  leave the drill with the answers kept (`TN-STUDY-05`) — so both stay. Escape still leaves the card.
- **A short bank counts to what it drew**, so the card never promises a question that is not coming.

### Copy

Five rows are written by `app/ui` and listed in `COPY_GAPS` for the product owner to ratify or replace:
`level.unfinished.title`, `level.unfinished.next`, `level.unfinished.notStarted`, `card.kind.new` and
`card.kind.seen`. The unfinished card's body reuses `passport.intro` rather than restating the rule in new
words.

## Consequences

- **Progression now requires answering.** A first-run player must finish Halifax's task — nine questions over
  four landmarks — to open Peggy's Cove. That is the passport's promise kept, and it is the largest behaviour
  change in this ADR.
- **The tracker and the card can still disagree about topic**, and only content can fix it. Every `answer`
  step names a topic in its prompt ("about voting") and none names a `questionPool`, so the step draws from the
  whole subject. The candidate pools, and the steps whose subject has too few questions on the named topic
  (Peggy's Cove's official languages and becoming Canadian, Québec City's "how this country got its name",
  Toronto's "voting where you live"), are listed in the report for this change and are content work.
- **24 of the 36 landmarks tell a sentence no question in their level's subject rests on** — some because
  another subject grades it (Toronto's streetcar, `gov-59`), most because no question exists. They ask a
  question from the subject rather than about the landmark. Also content work.
- **Tests.** `tests/unit/domain/entities/level-end.test.ts`,
  `tests/unit/application/content/proposition.test.ts`, `tests/unit/bootstrap/landmark-questions.test.ts` and
  `tests/unit/contracts/an-answer-step-asks-its-level-subject.test.ts` are new. `schedule-review.test.ts`,
  `study-session.test.ts`, `question-card.test.ts`, `level-complete.test.ts`, `copy.test.ts` and
  `front-door.test.ts` gained cases that fail on the old behaviour. `level-end-to-next.spec.ts` was rewritten
  around the three routes to the end of a level; `level-quest.spec.ts`, `study-and-settings.spec.ts` and
  `quest-moments.spec.ts` follow the new card, and the saves the last one seeds moved to `tests/e2e/saves.ts`.

## Alternatives considered

- **Keep `TN-DONE`'s rule and reword `passport.intro`.** Rejected. It makes the passport honest by making the
  stamp mean "walked", in a tool whose purpose is the test.
- **Block the exit until the task is done.** Rejected. A wall the player cannot pass or understand; the card
  that says what is left, with the level handed back, does the same job without trapping anyone.
- **Open the next level without a stamp.** Rejected. Unlocking is a function of stamps; a second source of
  "open" is two answers that can disagree on the map.
- **Hide "Close" after every answer.** Rejected. It removes Study's mid-drill way out on touch.
- **Drop the "New" tag.** Rejected. `TN-CARD-01` promises it; the defect was the lone word, not the fact.
