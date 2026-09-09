import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { PALETTE } from '@ui/palette';
import { createScreen } from '@ui/screen';
import { injectScreenStyles } from '@ui/screen-styles';

import { buildPage, FakeEvent, press } from './support/fake-dom';

/**
 * The shell every slice-1 screen is built on. Its whole job is to make four
 * promises in one place instead of five: a role, a name, focus containment, and
 * a way out.
 */

const openScreen = (options: Partial<Parameters<typeof createScreen>[1]> = {}) => {
  const page = buildPage();
  const screen = createScreen(page.host, {
    id: 'tn-test-screen',
    testId: 'test-screen',
    locale: 'en',
    ...options,
  });
  return { page, screen };
};

describe('the screen shell', () => {
  it('is a named modal dialog with a test id from the shared vocabulary', () => {
    const { screen, page } = openScreen();
    const element = page.doc.byTestId('test-screen');

    expect(element).not.toBeNull();
    expect(element?.getAttribute('role')).toBe('dialog');
    expect(element?.getAttribute('aria-modal')).toBe('true');
    expect(element?.getAttribute('lang')).toBe('en');
    expect(screen.element.tabIndex).toBe(-1);
  });

  it('starts hidden, so nothing flashes on boot', () => {
    const { screen } = openScreen();
    expect(screen.visible).toBe(false);
    expect(screen.element.hidden).toBe(true);
  });

  it('names itself through an element that exists and carries text', () => {
    const { screen, page } = openScreen();
    const title = page.doc.createElement('h1');
    title.textContent = 'Settings';
    screen.card.append(title as unknown as HTMLElement);
    screen.labelledBy(title as unknown as HTMLElement);

    const labelId = screen.element.getAttribute('aria-labelledby');
    expect(labelId).not.toBeNull();
    expect(page.doc.getElementById(labelId ?? '')?.textContent).toBe('Settings');
  });

  it('gives an element an id to be named by, rather than leaving a dangling reference', () => {
    /* A dangling `aria-labelledby` is an unnamed dialog, which is worse than
       none: axe's `aria-dialog-name` is best-practice only, so nothing in a
       WCAG-tagged scan would catch it. */
    const { screen, page } = openScreen();
    const title = page.doc.createElement('h1');
    title.textContent = 'Study';
    screen.card.append(title as unknown as HTMLElement);
    screen.labelledBy(title as unknown as HTMLElement);

    expect(title.id).not.toBe('');
    expect(screen.element.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('describes itself, and can stop', () => {
    const { screen, page } = openScreen();
    const body = page.doc.createElement('p');
    body.textContent = 'Pick how you look.';
    screen.card.append(body as unknown as HTMLElement);

    screen.describedBy(body as unknown as HTMLElement);
    expect(screen.element.getAttribute('aria-describedby')).toBe(body.id);

    screen.describedBy(null);
    expect(screen.element.getAttribute('aria-describedby')).toBeNull();
  });

  it('takes focus and inerts the rest of the page when it opens', () => {
    const { screen, page } = openScreen();
    screen.show();

    expect(screen.element.hidden).toBe(false);
    expect(page.doc.activeElement).toBe(screen.element as unknown);
    expect(page.game.inert).toBe(true);
    /* The announcer stays perceivable: inerting it would silence the game
       exactly when the player needs telling why it paused. */
    expect(page.live.inert).toBe(false);
  });

  it('un-inerts and gives focus back when it closes', () => {
    const { screen, page } = openScreen();
    const opener = page.doc.createElement('button');
    page.ui.append(opener);
    opener.focus();

    screen.show();
    expect(page.doc.activeElement).not.toBe(opener);

    screen.hide();
    expect(page.game.inert).toBe(false);
    expect(page.doc.activeElement).toBe(opener);
    expect(screen.element.hidden).toBe(true);
  });

  it('releases focus before hiding, so focus never lands on the body', () => {
    /* `hidden` on an ancestor of the focused element drops focus on `<body>`,
       which is the "focus never falls to the body" failure TN-STUDY-06 names. */
    const { screen, page } = openScreen();
    const opener = page.doc.createElement('button');
    page.ui.append(opener);
    opener.focus();

    screen.show();
    screen.hide();

    expect(page.doc.activeElement).not.toBeNull();
    expect(page.doc.activeElement).toBe(opener);
  });

  it('leaves on Escape, and only while it is open', () => {
    const onEscape = vi.fn();
    const { screen } = openScreen({ onEscape });

    press(screen.element as never, 'Escape');
    expect(onEscape).not.toHaveBeenCalled();

    screen.show();
    press(screen.element as never, 'Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores an Escape somebody else already handled', () => {
    const onEscape = vi.fn();
    const { screen } = openScreen({ onEscape });
    screen.show();

    const event = new FakeEvent('keydown', { key: 'Escape' });
    event.preventDefault();
    screen.element.dispatchEvent(event as never);
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('runs no switch ring unless single-switch mode is on', () => {
    const { screen, page } = openScreen();
    screen.show();
    expect(page.doc.listenerCount('pointerdown')).toBe(0);
    expect(screen.ring.enabled).toBe(false);
  });

  it('starts the ring when the mode is on, and stops it when the screen closes', () => {
    const { screen, page } = openScreen({ switch: { enabled: true, holdMs: 600 } });
    const control = page.doc.createElement('button');
    control.textContent = 'Start playing';
    screen.card.append(control as unknown as HTMLElement);

    screen.show();
    expect(screen.ring.enabled).toBe(true);
    expect(screen.ring.index).toBe(0);

    screen.hide();
    expect(screen.ring.enabled).toBe(false);
  });

  it('turns the ring on and off while it is open, so the mode can be left', () => {
    /* TN-SET-05: "no setting can put the game into a state that the switch alone
       cannot leave" — including single-switch mode itself. */
    const { screen, page } = openScreen();
    const control = page.doc.createElement('button');
    screen.card.append(control as unknown as HTMLElement);
    screen.show();

    screen.setSwitchEnabled(true, 800);
    expect(screen.ring.enabled).toBe(true);
    expect(page.doc.listenerCount('pointerup')).toBe(1);

    screen.setSwitchEnabled(false);
    expect(screen.ring.enabled).toBe(false);
    expect(page.doc.listenerCount('pointerup')).toBe(0);
  });

  it('re-reads the ring only while it is open and switched on', () => {
    const { screen } = openScreen({ switch: { enabled: false, holdMs: 600 } });
    screen.refreshSwitch();
    expect(screen.ring.items.length).toBe(0);
  });

  it('carries the language on the element, so a screen reader changes voice', () => {
    const { screen } = openScreen();
    screen.setLocale('fr');
    expect(screen.element.getAttribute('lang')).toBe('fr');
  });

  it('is idempotent about opening and closing', () => {
    const { screen } = openScreen();
    screen.show();
    screen.show();
    screen.hide();
    screen.hide();
    expect(screen.visible).toBe(false);
  });

  it('takes itself off the page when destroyed, without leaving anything inert', () => {
    const { screen, page } = openScreen();
    screen.show();
    screen.destroy();
    expect(page.game.inert).toBe(false);
    expect(page.doc.byTestId('test-screen')).toBeNull();
  });
});

describe('the screen stylesheet', () => {
  it('is injected once, however many screens are on the page', () => {
    const page = buildPage();
    const first = injectScreenStyles(page.document);
    const second = injectScreenStyles(page.document);
    expect(first).toBe(second);
    expect(page.doc.head.children.length).toBe(1);
  });

  it('keeps every promise the screens depend on', () => {
    const page = buildPage();
    const css = injectScreenStyles(page.document).textContent ?? '';

    /*
     * Every touch target, in `rem`, and never below 44 CSS px.
     *
     * The number is read rather than typed: the sheet says 3rem today and the
     * floor is 2.75rem (44 px at 100 %, 88 px at 200 %), so an assertion on the
     * literal would fail on a redesign that made the buttons *bigger*. What must
     * never happen is a value below the floor, or one in `px` — a pixel literal
     * shrinks relative to the text it holds exactly when the player asked for
     * bigger text (CLAUDE.md: >= 44 pt, text scaling 100-200 %).
     */
    const sizes = [...css.matchAll(/min-(?:block|inline)-size:\s*([\d.]+)(\w+)/g)];
    expect(sizes.length, 'the sheet declares no minimum control size at all').toBeGreaterThan(0);
    for (const [, value, unit] of sizes) {
      expect(unit, `min-size in "${unit ?? '?'}" does not scale with the text`).toBe('rem');
      expect(Number(value)).toBeGreaterThanOrEqual(2.75);
    }

    /* Reduced motion from the setting, and from the media query on its own. */
    expect(css).toContain('[data-tn-motion="reduced"]');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    /* Focus is a change of geometry, not only of colour. */
    expect(css).toContain('outline-offset');
    /* Long words wrap rather than pushing the page sideways at 200%. */
    expect(css).toContain('overflow-wrap: anywhere');
    /* High contrast and the dyslexia font are still switchable. */
    expect(css).toContain('[data-tn-contrast="high"]');
    expect(css).toContain('[data-tn-font="dyslexia"]');
  });

  /**
   * Flat fills only, and it is an accessibility rule before it is a style one.
   *
   * axe cannot compute the contrast of text over a gradient or a translucent
   * wash: it reports *incomplete*, an unknown, and `tests/a11y` treats an
   * unknown as a failure. It is also the art bible's rule for every material in
   * the game, so the screens and the canvas break it or keep it together.
   */
  it('paints with flat, opaque colour, so contrast is computable', () => {
    const page = buildPage();
    const css = injectScreenStyles(page.document).textContent ?? '';

    for (const banned of ['gradient(', 'rgba(', 'hsla(', 'opacity: 0.', 'backdrop-filter']) {
      expect(css, `"${banned}" makes a colour axe cannot judge`).not.toContain(banned);
    }
  });

  /**
   * No backtick anywhere in the sheet's source, comments included.
   *
   * The whole stylesheet is one template literal, so a backtick in a comment
   * closes it. TypeScript keeps compiling — the backticks pair up and the file
   * still parses — and the failure surfaces later and somewhere else: the Vite
   * dev server returns 500 for the module, which took out the entire a11y
   * harness and reported as fifteen `waitForSelector` timeouts naming screens
   * that had nothing wrong with them.
   *
   * The source is read off disk because the evidence is gone by the time the
   * module has been evaluated.
   */
  it('has no backtick inside the stylesheet literal, which would close it', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../app/ui/screen-styles.ts', import.meta.url)),
      'utf8',
    );
    const opens = source.indexOf('const CSS = `');
    expect(opens, 'the stylesheet is not a template literal any more').toBeGreaterThan(-1);
    const body = source.slice(opens + 'const CSS = `'.length, source.indexOf('\n`;\n', opens));

    const offending = body
      .split('\n')
      .map((line, index) => [index + 1, line] as const)
      .filter(([, line]) => line.includes('`'))
      .map(([number, line]) => `${String(number)}: ${line.trim()}`);
    expect(offending, offending.join(' | ')).toEqual([]);
  });

  /**
   * The sheet's colours are the art palette's, resolved through `./palette.ts`.
   *
   * `tests/unit/ui/palette.test.ts` holds that module against
   * `assets/style/palette.json`; this holds the stylesheet against that module,
   * so a hex typed straight into the CSS cannot slip past both.
   */
  it('names no colour the art palette does not define', () => {
    const page = buildPage();
    const css = injectScreenStyles(page.document).textContent ?? '';
    const known = new Set<string>(Object.values(PALETTE));
    /* The high-contrast theme is black and white by definition: those two are
       not palette entries and must not be, because they are the absence of hue
       rather than a colour chosen from a ramp. */
    known.add('#000000');
    known.add('#ffffff');

    for (const [hex] of css.matchAll(/#[0-9a-f]{6}/g)) {
      expect(known.has(hex), `${hex} is not a colour in assets/style/palette.json`).toBe(true);
    }
  });
});
