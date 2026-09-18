# ADR-0060: A device that is not a phone held upright is told once, and never blocked

- Status: Accepted (2026-09-18)
- Acceptance: `tests/unit/ui/viewport-mode.test.ts`, `tests/unit/ui/portrait-notice.test.ts`,
  `tests/unit/bootstrap/portrait-notice.test.ts`, `tests/a11y/portrait-notice.spec.ts`.
- Builds on: ADR-0002 (portrait only, and what a wide window gets instead), ADR-0005 (`app/ui` is DOM only),
  ADR-0026 (where a save lives), ADR-0034 (the update notice, whose shape this borrows), ADR-0055 (the side
  panels carry the level's sky and ground).
- Does **not** amend: the Orientation row of `CLAUDE.md`, and does not touch `app/ui/rotate-overlay.ts`.
  Desktop is still a supported platform and a sideways phone is still paused.
- Numbering. `main` holds up to ADR-0059, which is the high-water mark across every ref this repository can
  see. 0060 is the next one, which is ADR-0053's rule.

## Context

The product owner asked for two things: that it be **explicit that the game works better on a mobile device
in portrait**, and that the same thing be **said in the game, on load, when the player is not on a phone in
portrait**.

The README half is prose. The in-game half is the one with a trap in it, and the trap is that this game
already has a screen that looks like the answer and is not.

`app/ui/rotate-overlay.ts` is a blocking `alertdialog`. It has a focus trap, it makes the page `inert`, it
covers the screen, and it holds the `orientation` pause reason so the level stops. It fires for exactly one
case — a **phone turned sideways** — and its own header says why that is the only case:

> A tablet or a desktop window in landscape is *not* this case: it keeps the same portrait canvas, centred,
> with side panels — so the trigger is `classifyViewport`, not `window.orientation`.

That is ratified, twice. `CLAUDE.md`'s Orientation row says "Desktop centres the portrait canvas; side panels
extend the level's sky/ground", and ADR-0055 spent a slice making those panels carry each level's own sky and
ground so a wide window looks like the game rather than like a framed picture. **Desktop, laptop and tablet
are supported platforms**, and reaching for the overlay's trigger — or for its shape — would have converted a
supported platform into a blocked one while appearing to implement a request.

So the question this ADR answers is not "how do we detect a desktop". It is "what does a player on a platform
we support get told, and what does it cost them".

## Decision

**A device that is not a phone held upright is shown one dismissible, non-blocking notice on the load it
opens the game on. It is never paused, never trapped, and never asked twice on that device.**

### 1. The audience is a third answer, beside the two the layout already has

`classifyViewport` answers a **layout** question and has three answers: `portrait`, `landscape-phone`, `wide`.
It cannot answer the audience question, because a tablet held upright is `portrait` — it gets the design
layout, and nothing about that is wrong.

`classifyAudience` is therefore added beside it, with three answers of its own: `phone-portrait`,
`phone-landscape`, `large`. It is **derived from `classifyViewport` rather than measured again**, and that is
the design rather than an implementation detail. The two cases have to be mutually exclusive — no player may
ever be both paused by a modal and nudged by a notice — and the cheap way to get that wrong is two predicates
over two sets of numbers that agree today and drift the first time a breakpoint moves. `phone-landscape` is
returned on exactly the branch where `classifyViewport` returned `landscape-phone`, so the answers cannot
disagree without one line being edited twice.

`large` is a desktop window, a laptop, or a tablet **in either orientation**. A tablet in portrait is `large`
because its short side is over the 600 px breakpoint that already separates a phone from a tablet — the same
constant, not a second one.

Degenerate input (0, NaN, a negative from a browser mid-rotation) is `phone-portrait`, for the same reason it
is `portrait` in the function above: the failure mode of guessing wrong is a notice shown to somebody it is
not about.

### 2. It is a line in the page's own `<main>`, not a toast and not a dialog

The notice is a status sentence, a help sentence and one Close button, drawn first inside the one `<main>`,
which is exactly the shape ADR-0034 gave the update notice. That placement does the accessibility work by
construction: it is inside the landmark, it is in the Tab order, it is inside the front door's switch ring, it
takes no focus, and at 200 % text it grows downwards and covers no control.

Two alternatives were considered and rejected.

- **A toast.** A toast floats over the page, so at 200 % text it covers controls rather than moving them, and
  the convention that makes a toast a toast is that it leaves by itself. This game has no timers outside Exam
  mode (`CLAUDE.md`), and a notice that expires is one a slow reader never finishes.
- **A line baked into the title screen.** The title screen's copy belongs to `TN-TITLE`, the screen is not the
  only place a player can be, and a line inside it could not be dismissed without the screen owning a
  dismissal it should not know about. The notice would also have to be drawn and then hidden for the phone
  player it is not for, where the shape chosen here is simply never built for them.

The sentence carries `role="status"` and `aria-live="off"`, and the words are spoken **once** through the one
live region — the update notice's rule, for the same reason: two polite live regions is a well-known way to
make a screen reader go quiet.

### 3. Two sentences, because one of them would be a refusal

`portrait.notice` — "This game works best on a phone held upright." — is the recommendation.
`portrait.notice.help` — "You can still play here." — is the part a player on a supported platform has to be
told in the same breath. A laptop player told only the first has been told their platform is wrong, and it is
not. Both rows are written by `app/ui`, both are listed in `COPY_GAPS`, and this ADR is their home until a
story ratifies them — which is exactly what ADR-0034 did for `update.ready` and `update.reload`.

The wording reuses the rotate overlay's vocabulary ("upright", « à la verticale ») so a player who could meet
both screens meets one vocabulary, and it names no device the player does not have.

### 4. It is decided once, at load, and not re-asked on resize

`main.ts` re-classifies the viewport on every resize, `orientationchange` and visual-viewport change, because
the rotate overlay must appear the instant a phone turns. The notice does not follow that. The audience is
taken once, from the viewport the page loaded at.

A version that re-fired would interrupt a desktop player who dragged their window wider mid-level, and would
tell a tablet player twice for turning their tablet. Neither is news, and neither was asked for. "Shown once
on load" is the request and is also the only version of this that cannot become a nag.

### 5. Dismissal is per device, under its own key, and is not in the save

The flag is one `localStorage` key, `truenorth.portrait-notice.dismissed`, written through the same
`browserLocalStorage()` probe the save uses. It is **not** a field in the save, and ADR-0026 is why rather
than convenience:

- **A save is portable.** ADR-0046 replaces progress *and settings* whole from a file, so a save exported from
  a laptop and opened on another device would carry a laptop's dismissal onto it, and a phone's
  non-dismissal back the other way. What has been read on *this* screen is a property of the screen.
- **It has to be readable before the save is.** The save is an IndexedDB round trip (ADR-0026);
  `localStorage` answers synchronously, so the notice is decided before the front door is drawn rather than
  appearing a beat after the player has started reading.
- **Deleting progress must not un-dismiss it.** `save.clear` empties the save's key; this one is not the
  save's key, so a sentence the player has already read and put away stays put away.

A browser that refuses storage shows the notice on every load. That is the honest direction: the same browser
is already being told by the storage warning that it is keeping nothing.

## Consequences

- A desktop, laptop or tablet player sees one sentence on their first load, closes it, and never sees it
  again on that device. Nothing about their game is paused, covered, inerted or otherwise made
  second-class — which is the ratified decision this ADR exists to protect.
- A phone player in portrait sees nothing new, ever.
- A phone player turned sideways gets the rotate overlay and only the rotate overlay, unchanged.
- `app/ui` gains no storage and no `window` reads: the audience is a pure function over two numbers, the
  decision of when to ask is `app/bootstrap`'s, and the dismissal callback is the composition root's
  (ADR-0005).
- `<html>` publishes `data-tn-audience` beside `data-tn-mode`, so a suite can assert which of the three
  audiences a page decided it had rather than inferring it from pixels.

## What this does not do

- It does not change `classifyViewport`, `data-tn-mode`, the rotate overlay, or the side panels.
- It does not add a setting. There is nothing here to configure: the notice is shown once and is then gone
  for good on that device.
- It does not detect a device. It measures a viewport, which is the only honest thing a browser can tell us,
  and it says so in a sentence about what suits the game rather than a claim about what the player is
  holding.
