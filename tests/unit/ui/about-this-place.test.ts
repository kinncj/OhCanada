import { describe, expect, it, vi } from 'vitest';

import {
  createAboutThisPlace,
  type AboutThisPlaceOptions,
  type AboutThisPlaceView,
} from '@ui/about-this-place';
import { text } from '@ui/copy';
import { createHud } from '@ui/hud';

import { buildPage, press, pressSwitch, type FakeElement } from './support/fake-dom';

/**
 * `docs/content-review.md` §10.2: the "About this place" panel.
 *
 * §10.2 has two halves and this file holds both.
 *
 *  - **The panel states the sourced territorial fact**, always reachable, never
 *    on the way into a level, "DOM, ARIA, keyboard, single-switch, EN and FR,
 *    like every other screen".
 *  - **A claim that was not verified is not drawn, and the refusal carries no
 *    nation and no publisher.** That is the assertion this file exists for. The
 *    adapter's own suite proves the serialised `about` carries none of those
 *    words when a statement is declined
 *    (`tests/unit/adapters/phaser/a-claim-draws-only-when-verified.test.ts`);
 *    this is the same claim from the DOM side, because the way that guarantee
 *    dies is a panel that keeps a list the sentence lost.
 *
 * The fixtures below are **fixtures, not content**. A real statement, its
 * nations and its publisher come from `content/levels/*.json` through
 * `SceneLevel.about`, and nothing in `app/ui` may read one. The words here are
 * invented so the assertions read like the scenario; the one thing they
 * deliberately imitate is shape — an endonym that is identical in both
 * languages, because `docs/content-review.md` §9.3 says a nation's own name for
 * itself is not translated.
 */

const STATEMENT_EN: AboutThisPlaceView = {
  kind: 'statement',
  statement: 'Fixture Town is on the traditional territory of the Fixture Nation.',
  nations: ['Fixture Nation'],
  publisher: 'Fixture Nation Council',
  sourceUrl: 'https://example.invalid/about',
};

const STATEMENT_FR: AboutThisPlaceView = {
  ...STATEMENT_EN,
  statement:
    'Fixture Town se trouve sur le territoire traditionnel de la Fixture Nation.',
};

const NOT_CHECKED: AboutThisPlaceView = { kind: 'unavailable', reason: 'not-checked' };
const BEING_CHECKED: AboutThisPlaceView = { kind: 'unavailable', reason: 'being-checked' };

function open(overrides: Partial<AboutThisPlaceOptions> = {}) {
  const page = buildPage();
  const onClose = vi.fn();
  const announce = vi.fn();
  const panel = createAboutThisPlace(page.host, {
    locale: 'en',
    onClose,
    announce,
    ...overrides,
  });
  return {
    page,
    panel,
    onClose,
    announce,
    at: (testId: string) => page.doc.byTestId(testId),
  };
}

describe('the "About this place" panel', () => {
  it('states the territorial fact first, then who it names, then where it came from', () => {
    /* §10.2: "First line is the territorial fact." Everything after it is what
       lets a reader check that line rather than take it. */
    const { panel, at } = open();
    panel.show(STATEMENT_EN);

    const root = at('about-this-place');
    expect(root?.hidden).toBe(false);
    expect(at('about-this-place-statement')?.textContent).toBe(STATEMENT_EN.statement);
    expect(at('about-this-place-nations')?.textContent).toContain('Fixture Nation');
    expect(at('about-this-place-source')?.textContent).toBe('Fixture Nation Council');

    /* Order on the page is order in the accessibility tree, and the fact is
       first in both. */
    const body = root?.textContent ?? '';
    expect(body.indexOf(STATEMENT_EN.statement)).toBeLessThan(body.indexOf('Fixture Nation Council'));
  });

  it('is a dialog named by the words the player pressed to open it', () => {
    /*
     * `about.title` is `about.open` verbatim — `app/ui/menu.ts`'s rule, "what
     * they see and what they hear are the same thing" — and the name is the
     * heading rather than a hardcoded `aria-label`, so a language change moves
     * both together.
     */
    const { panel, at, page } = open();
    panel.show(STATEMENT_EN);

    const root = at('about-this-place');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(page.doc.getElementById(root?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      text('en', 'about.title'),
    );
    expect(text('en', 'about.title')).toBe(text('en', 'about.open'));
    expect(text('fr', 'about.title')).toBe(text('fr', 'about.open'));
  });

  it('says nothing to the live region, in either branch', () => {
    /*
     * `TN-PEGGYS-03` and `TN-NORTH-03`: "nothing about it is announced unasked
     * while I am playing". It is a dialog, it takes focus, and a screen reader
     * reads a dialog on arrival — the rule `app/ui/level-screens.ts` states for
     * the two screens that do not announce themselves. A live-region message as
     * well would say everything twice.
     */
    const { panel, announce } = open();
    panel.show(STATEMENT_EN);
    panel.hide();
    panel.show(NOT_CHECKED);
    expect(announce).not.toHaveBeenCalled();
  });

  it('links the source by its publisher, and says out loud that the link leaves the game', () => {
    const { panel, at } = open();
    panel.show(STATEMENT_EN);

    const link = at('about-this-place-source');
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe('https://example.invalid/about');
    /* The text is who published it, never the URL and never "click here". */
    expect(link?.textContent).toBe('Fixture Nation Council');
    expect(link?.textContent).not.toContain('http');
    /* A new context, and one that cannot reach back into a game holding a save. */
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    /* Announced as prose, not as an icon or a `title`: the same sentence is on
       screen for a sighted reader and is the link's accessible description. */
    const describedBy = link?.getAttribute('aria-describedby') ?? '';
    expect(at('about-this-place')?.find(describedBy)?.textContent).toBe(
      text('en', 'about.source.outside'),
    );
  });

  it('says a statement was not verified without making the claim in another form', () => {
    /*
     * The assertion this file exists for. Halifax's statement was declined
     * because its first sentence places Halifax in Mi'kma'ki and the cited
     * source does not say so — so a panel that dropped the sentence and kept
     * `nations: ["Mi'kmaq"]`, or named the publisher, would still be making the
     * declined claim, in a form a reader cannot disagree with.
     *
     * The view has no field to leak, which is the real guarantee; this is the
     * belt to that braces, and it is written over the rendered DOM because that
     * is where a future "helpful" addition would show up.
     */
    const { panel, at } = open();
    panel.show(NOT_CHECKED);

    const root = at('about-this-place');
    const rendered = root?.textContent ?? '';
    expect(rendered).toContain(text('en', 'about.unavailable.notShown'));
    expect(at('about-this-place-nations')).toBeNull();
    expect(at('about-this-place-source')).toBeNull();
    for (const leaked of ['Fixture Nation', 'Fixture Nation Council', 'example.invalid']) {
      expect(rendered, `the refusal carries "${leaked}"`).not.toContain(leaked);
    }
    /* Nor the developer's sentence: `AboutThisPlace.message` names a field in a
       document and is for a console. The view has no room for it. */
    expect(rendered).not.toContain('/territory');
    expect(rendered).not.toContain('verification');
  });

  it('blames neither the player nor the source', () => {
    /*
     * "A panel that says a statement could not be verified must not read as an
     * error the player caused or as a defect in the nation's page." So the
     * second sentence is about this project's own checking, it is drawn in both
     * refusals, and the words that would blame are absent from both.
     */
    for (const view of [NOT_CHECKED, BEING_CHECKED]) {
      const { panel, at } = open();
      panel.show(view);

      expect(at('about-this-place-ours')?.textContent).toBe(text('en', 'about.unavailable.ours'));
      const rendered = (at('about-this-place')?.textContent ?? '').toLowerCase();
      for (const word of ['error', 'failed', 'invalid', 'sorry', 'wrong', 'broken', 'try again']) {
        expect(rendered, `the refusal says "${word}"`).not.toContain(word);
      }
    }
  });

  it('tells a source that moved apart from one that was never checked', () => {
    /*
     * `TN-PEGGYS-06` and `TN-NORTH-06`: with the statement quarantined because
     * its source changed, the panel "says plainly that the source is being
     * checked". Everything else — never verified, verified with nothing quoted,
     * or read and declined — is one sentence, because those three differ to a
     * verifier and not to a player, and spelling them out would publish a
     * verdict about a nation's own page.
     */
    const { panel, at } = open();

    panel.show(BEING_CHECKED);
    expect(at('about-this-place-unavailable')?.getAttribute('data-tn-reason')).toBe('being-checked');
    expect(at('about-this-place-unavailable')?.textContent).toBe(
      text('en', 'about.unavailable.checking'),
    );

    panel.hide();
    panel.show(NOT_CHECKED);
    expect(at('about-this-place-unavailable')?.getAttribute('data-tn-reason')).toBe('not-checked');
    expect(at('about-this-place-unavailable')?.textContent).toBe(
      text('en', 'about.unavailable.notShown'),
    );
  });

  it('leaves nothing of a statement behind when it is shown a refusal next', () => {
    /* The two branches share no element on purpose. A panel that reused one
       node would be one `textContent` away from keeping a nation's name under a
       sentence saying the claim was declined. */
    const { panel, at } = open();
    panel.show(STATEMENT_EN);
    panel.show(NOT_CHECKED);

    expect(at('about-this-place')?.textContent).not.toContain('Fixture Nation');
    expect(at('about-this-place-statement')).toBeNull();
  });

  it('closes on Close and on Escape, and tells the caller both times', () => {
    const { panel, at, onClose } = open();

    panel.show(STATEMENT_EN);
    at('about-this-place-close')?.click();
    expect(at('about-this-place')?.hidden).toBe(true);

    panel.show(STATEMENT_EN);
    press(at('about-this-place') as FakeElement, 'Escape');
    expect(at('about-this-place')?.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('gives focus back to whatever opened it', () => {
    /* Opened from the pause menu, which has already restored focus to
       `menu-button` on its way out — so the panel remembers that button as its
       own return point, and closing it puts the player back where they were. */
    const page = buildPage();
    const hud = createHud(page.host, { locale: 'en', onOpenAbout: () => undefined });
    const opener = page.doc.byTestId('menu-button');
    opener?.focus();

    const panel = createAboutThisPlace(hud.main, { locale: 'en' });
    panel.show(STATEMENT_EN);
    expect(page.doc.activeElement).not.toBe(opener);

    panel.hide();
    expect(page.doc.activeElement).toBe(opener);
  });

  it('is operable with one switch: short press moves, long press chooses', () => {
    /* CLAUDE.md: single-switch mode, tap anywhere advances. Nothing scans on its
       own and nothing expires, so the panel is unchanged however long a reader
       takes over it. */
    const clock = { now: 0 };
    const { page, panel, onClose } = open({
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
    });
    panel.show(STATEMENT_EN);

    /* Two items in the ring, in reading order: the source link, then Close.
       The highlight lands on the first when the panel opens, so one short press
       reaches Close and a long press takes it. */
    pressSwitch(page, clock, 100);
    pressSwitch(page, clock, 900);
    expect(onClose).toHaveBeenCalledTimes(1);

    /* And nothing expires while a reader takes their time over it. */
    clock.now += 120_000;
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes a switch threshold change under an open panel', () => {
    const { panel } = open({ singleSwitch: true, holdMs: 600 });
    panel.show(STATEMENT_EN);
    panel.setSingleSwitch(true, 2_000);
    expect(panel.visible).toBe(true);
  });

  it('is French end to end, and the nation is spelled the same in both', () => {
    /*
     * `docs/content-review.md` §9.3: "A nation's own name for itself is
     * identical in the EN and FR strings." The chrome translates; the endonym
     * and the publisher arrive from the level document and do not.
     */
    const { panel, at } = open({ locale: 'fr' });
    panel.setLocale('fr', STATEMENT_FR);

    const root = at('about-this-place');
    expect(root?.getAttribute('lang')).toBe('fr');
    expect(root?.textContent).toContain('À propos de ce lieu');
    expect(root?.textContent).toContain('territoire traditionnel');
    expect(at('about-this-place-nations')?.textContent).toContain('Fixture Nation');
    expect(at('about-this-place-close')?.textContent).toBe('Fermer');
    expect(at('about-this-place-ours')).toBeNull();
  });

  it('changes language under an open panel, chrome and content together', () => {
    const { panel, at } = open();
    panel.show(STATEMENT_EN);
    panel.setLocale('fr', STATEMENT_FR);

    expect(at('about-this-place-statement')?.textContent).toBe(STATEMENT_FR.statement);
    expect(at('about-this-place')?.textContent).toContain(text('fr', 'about.source'));
    expect(at('about-this-place')?.textContent).not.toContain(text('en', 'about.source'));
    expect(panel.visible).toBe(true);
  });

  it('draws a refusal in French too, with no nation and no publisher in it', () => {
    const { panel, at } = open({ locale: 'fr' });
    panel.setLocale('fr', NOT_CHECKED);

    expect(at('about-this-place-unavailable')?.textContent).toBe(
      text('fr', 'about.unavailable.notShown'),
    );
    expect(at('about-this-place-ours')?.textContent).toBe(text('fr', 'about.unavailable.ours'));
    expect(at('about-this-place-nations')).toBeNull();
    expect(at('about-this-place-source')).toBeNull();
  });

  it('draws no "named here" heading over an empty list', () => {
    /* A statement may legitimately name nobody (ADR-0051): where the source it
       cites names no people for that place, `nations` is empty and the level
       document records why. A label promising names above nothing is worse than
       no label, so the heading goes with the list rather than standing over an
       empty one.

       This was written as a defence against a state "the game should never
       reach". It is now the state several levels are heading for, and the panel
       needed no change to draw it — which is the only reason this ADR touched no
       file in `app/ui` and added no copy row. */
    const { panel, at } = open();
    panel.show({ ...STATEMENT_EN, nations: [] });

    expect(at('about-this-place-nations')).toBeNull();
    expect(at('about-this-place')?.textContent).not.toContain(text('en', 'about.nations'));
    /* The statement and its source are still there: an empty list is not a
       reason to withhold a claim a verifier granted. */
    expect(at('about-this-place-statement')?.textContent).toBe(STATEMENT_EN.statement);
    expect(at('about-this-place-source')).not.toBeNull();
  });

  it('does nothing when hidden twice, so a caller cannot be told it closed again', () => {
    const { panel, onClose, at } = open();
    panel.show(STATEMENT_EN);
    at('about-this-place-close')?.click();
    panel.hide();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(at('about-this-place')?.hidden).toBe(true);
  });

  it('is removed by destroy, leaving the page as it found it', () => {
    const { panel, at, page } = open();
    panel.show(STATEMENT_EN);
    panel.destroy();

    expect(at('about-this-place')).toBeNull();
    expect(page.game.inert).toBe(false);
  });
});

describe('the control that opens it', () => {
  it('is in the pause menu, after the passport and before leaving', () => {
    /*
     * §10.2 fixes the panel as "opened from the pause menu and from the credits
     * screen". There is no credits screen in this build — reported, not
     * silently dropped — so the pause menu is the route, and it is the route on
     * every level.
     */
    const page = buildPage();
    const hud = createHud(page.host, {
      locale: 'en',
      onOpenSettings: () => undefined,
      onOpenStudy: () => undefined,
      onOpenPassport: () => undefined,
      onOpenAbout: () => undefined,
      onLeaveLevel: () => undefined,
    });
    hud.openMenu();

    const labels = page.doc
      .byTestId('menu')
      ?.querySelectorAll('button')
      .map((node) => node.getAttribute('data-testid'));
    expect(labels).toEqual([
      'menu-settings',
      'menu-study',
      'menu-passport',
      'about-this-place-open',
      'menu-leave',
      'menu-close',
    ]);
    expect(page.doc.byTestId('about-this-place-open')?.textContent).toBe(text('en', 'about.open'));
  });

  it('is not offered where there is no place to be about', () => {
    /* A menu opened anywhere but over a level draws no item, on the same rule
       "Leave the level" follows. An item that opened an empty panel would be
       worse than no item. */
    const page = buildPage();
    const hud = createHud(page.host, {
      locale: 'en',
      onOpenSettings: () => undefined,
      onOpenStudy: () => undefined,
      onOpenPassport: () => undefined,
    });
    hud.openMenu();

    expect(page.doc.byTestId('about-this-place-open')).toBeNull();
  });

  it('closes the menu before the panel opens, so the page never holds two dialogs', () => {
    const page = buildPage();
    const openAbout = vi.fn();
    const hud = createHud(page.host, { locale: 'en', onOpenAbout: openAbout });
    hud.openMenu();

    page.doc.byTestId('about-this-place-open')?.click();
    expect(page.doc.byTestId('menu')?.hidden).toBe(true);
    expect(openAbout).toHaveBeenCalledTimes(1);
  });

  it('is French', () => {
    const page = buildPage();
    const hud = createHud(page.host, { locale: 'fr', onOpenAbout: () => undefined });
    hud.openMenu();

    expect(page.doc.byTestId('about-this-place-open')?.textContent).toBe(
      'À propos de ce lieu',
    );
  });
});
