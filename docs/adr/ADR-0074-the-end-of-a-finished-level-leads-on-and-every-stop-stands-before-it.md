# ADR-0074: The end of a finished level leads on, and every stop stands before it

- Status: Accepted (2026-09-24), from the owner's playtest of the same day.
- **Amends ADR-0036 §1** in two sentences. "It is drawn once per sitting, like the arrival it answers" becomes
  *once per arrival*. And the end of a level whose stamp is already held no longer draws the finished card
  when the next level can be opened; it opens that level (§2).
- **Amends `TN-DONE`**: `TN-DONE-09` ("the card does not come back in this sitting, however often I cross
  the end") and `TN-DONE-05` ("finishing the same level twice"). `TN-DONE-10` is new.
- **Amends `app/adapters/phaser/level-exit.ts`'s latch**, which said "it never re-arms".
- Numbering. `git log --all --name-only -- docs/adr` over every ref this checkout can see, after fetching
  `claude/fervent-dijkstra-vxyz3k`, puts the high-water mark at 0072. **0073 is the first number above it.**

## Context

The owner reported two defects on 2026-09-24.

1. **"Dow's Lake reaches the end of the map before the actual last POI."** Ottawa's end line is where
   `watchExit` puts it, half a view back from the right bound: x 8,460 on a 9,000 px level at zoom 1. Dow's
   Lake stands at x 8,700 with a 240 px radius. A player walking to it crosses the end first. Measured over
   all ten levels with the scene's own arithmetic, Ottawa is the only one: its last engage zone ends 480 px
   past the line. Every other level clears it. Halifax and Peggy's Cove clear it by only 40 px.
2. **"Hitting the end of the wall should send you to the next level."** The scene's latch fired once per
   visit. A player who reached the end with the task unfinished got the "not finished yet" card. If they
   then finished the task and walked to the end again, nothing happened. "Task done!" had already offered
   the next level. But a player who pressed "Keep playing" to walk the rest of the level found the end
   silent. A player who came back to a level stamped in an earlier sitting got a card saying they had
   finished, with no way on but the map.

## Decision

### 1. The latch re-arms

`watchExit` reports **each arrival**. It re-arms when the player goes back behind the line by
`EXIT_REARM_VIEW_FRACTION` of the camera's view: a tenth, 108 world px at zoom 1. That point is never
behind the spawn. A turn at the line carries the player a few pixels back, and that is still the same
arrival: the hysteresis is there so a jostle cannot open a card every frame. A walk back and a return is a
new arrival.

The scene still only observes. What an arrival is worth is `app/bootstrap`'s decision.

### 2. What each arrival does

| The level, at the moment of arrival | What happens |
|---|---|
| Task not done, stamp not held | The "not finished yet" card (ADR-0036), **once per arrival**. |
| Stamp already held: earned by the task in this sitting ("Task done!" was drawn) or in an earlier one | **The next level in `journey` order opens directly**, by the same route as the card's "Play …". No card. |
| This arrival wrote the stamp: a level with no task, or a save whose quest an older build completed | The finished card, as before. The stamp is news, and the card is where it is said. |
| Stamp held, but it is the last level or the next one is not open | The finished card, as before, once per sitting. |

"Can be opened" uses the checks `playNextLevel` already makes: built, unlocked, and nameable by this build.
The scene's `level/completed` echo is never an arrival and never moves the player.

### 3. Accessibility

- The canvas is `aria-hidden`, so the move is said in the live region. First "Level finished!" (the
  existing `level.complete.title` row, which is true on this route), then the next level's own waiting
  sentence and its name, as on every route into a level. It is said after the old level is taken down,
  because teardown empties the queue.
- Keyboard, single switch, touch and auto-move all move the same player across the same line, so all of
  them trigger it. Nothing on this route animates, so reduced motion has nothing to turn off.
- Leaving the new level still goes to the map (`TN-FLOW`: back goes one step up).

### 4. Every stop stands before the end

The line stays where `level-exit.ts` puts it. At that point the camera has settled on its clamp and the
player is still walking freely. Moving the line would break both. The **level's geometry** is what has to
fit around it:

> For every level, every point of interest's engage zone — `position.x` plus the larger of its `radiusPx`
> and the widest `interaction.reachPx` the level's modes declare — and every character's `position.x` plus
> that reach end strictly before the end line.

`tests/unit/contracts/every-stop-stands-before-the-end.test.ts` holds the rule over every
`content/levels/*.json`, using the scene's bounds, spawn and view. A level that breaks it needs more
`size.x` and more ground polyline. It does not need a special case in the engine.

## Consequences

- A player who comes back to the end after "Keep playing" goes on to the next place. The map is still one
  tap away from every card, and from the menu.
- `tests/unit/adapters/phaser/level-exit.test.ts` asserts one arrival for a jostle, two for a walk back and
  a return, and the re-arm point for short and broken documents.
- `tests/unit/bootstrap/front-door.test.ts` asserts the four rows of §2 and the live-region order.
- `tests/e2e/level-end-to-next.spec.ts` walks the start level with its stamp held into the next level.
  `tests/e2e/ottawa-end-walks-on.spec.ts` seeds a save with Ottawa finished, walks Ottawa to its end, and
  sees the next level load.
- **Ottawa breaks §4 today**, by 480 px, and the new contract test fails on it until its document changes.
  The fix is content: `size.x` to at least 9,481 (9,600 is proposed, which puts the line at 9,060, 120 px
  past Dow's Lake's zone), the ground polyline extended to match, and the parallax layers and texture
  budget checked again. That change is `content/`'s to make.

## Obligations

Written in ADR-0009's format.

- ~~**OBLIGATION due=2026-10-01 owner=content** — extend `content/levels/ottawa.json` so that
  `every-stop-stands-before-the-end.test.ts` passes. Make `size.x` at least 9,481 (9,600 is proposed), extend
  the last ground point to match, and confirm that `make assets` and `make check-textures` still pass and
  the parallax layers tile to the new width.~~
  **DISCHARGED 2026-09-24** — `content/levels/ottawa.json` is 9,600 wide with the ground extended flat to it; the end line now falls past Dow's Lake's reach, `every-stop-stands-before-the-end.test.ts` passes for all ten levels, `make assets` and `make check-textures` pass (Ottawa 84 %, unchanged), and `ottawa-end-walks-on.spec.ts` walks the built level past the pavilion to the end.

## Alternatives considered

- **Move the line past the last stop, in the engine.** Rejected. At some widths the line would sit where
  the camera is still sliding or the player is already against the wall, which is the state `level-exit.ts`
  exists to prevent. It would also hide a content defect behind an engine special case.
- **Draw "Task done!" again at the end and let the player press Play.** Rejected. The card already said it,
  and the owner asked for the end itself to lead on.
- **Re-arm exactly at the line.** Rejected. A turn at the line would count as a second arrival and open a
  second card.

## References

- ADR-0036: a stamp is for the task; the unfinished card.
- ADR-0009: the obligation marker above.
- `app/adapters/phaser/level-exit.ts`, `app/bootstrap/main.ts` (`reachedTheEnd`, `playNextLevel`).
- `docs/stories/TN-DONE-finishing-a-level.md`: `TN-DONE-05`, `TN-DONE-09`, `TN-DONE-10`.
