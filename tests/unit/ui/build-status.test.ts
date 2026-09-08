import { describe, expect, it } from 'vitest';

import { createBuildStatus } from '@ui/build-status';

/**
 * The line that stops the boot screen from reading as a failure.
 *
 * The live site was reported twice, from two devices, as "stuck at the loading
 * screen" while it was in fact healthy: a title over an empty landscape says
 * nothing, and nothing is indistinguishable from a load that never finished.
 * The rules this suite locks down are what make the sentence a fix rather than
 * decoration — it is perceivable to assistive technology, it is bilingual, and
 * it never describes progress.
 *
 * `app/ui` is DOM and this suite runs under `environment: 'node'` (there is no
 * jsdom in the tree), so it is exercised against the document double at the
 * bottom of this file — the same approach as `tests/unit/ui/rotate-overlay.test.ts`.
 * The rendered proof, including the axe scan and the contrast of the panel, is
 * `tests/a11y/screens.spec.ts` and `tests/e2e/boot.spec.ts`.
 */

describe('createBuildStatus', () => {
  it('mounts inside the host it was given', () => {
    const page = buildPage();

    const status = createBuildStatus(page.uiHost);

    expect(page.ui.children).toContain(fake(status.element));
  });

  it('is a paragraph a screen reader can read, not a picture on the canvas', () => {
    const element = fake(createBuildStatus(buildPage().uiHost).element);

    /*
      The canvas is `aria-hidden` by contract, so anything painted on it does not
      exist for assistive technology. Before this element the only thing a screen
      reader could perceive on the whole page was "TrueNorth ready".
    */
    expect(element.tag).toBe('p');
    expect(element.getAttribute('aria-hidden')).toBeNull();
    expect(element.textContent.trim().length).toBeGreaterThan(0);
  });

  it('is not a second live region: the announcer stays the only speaker', () => {
    const element = fake(createBuildStatus(buildPage().uiHost).element);

    /* Two polite live regions is a well-known way to make a screen reader silent. */
    expect(element.getAttribute('aria-live')).toBeNull();
    expect(element.getAttribute('role')).toBeNull();
  });

  it('hands the same sentence back for the boot announcement', () => {
    const status = createBuildStatus(buildPage().uiHost);

    /* What is heard and what is seen must not drift apart. */
    expect(status.message).toBe(fake(status.element).textContent);
  });

  it.each([
    ['en', 'en'],
    ['fr', 'fr'],
  ] as const)('ships %s copy, tagged with its own lang', (locale, lang) => {
    const status = createBuildStatus(buildPage().uiHost, { locale });

    expect(fake(status.element).getAttribute('lang')).toBe(lang);
    expect(status.message.trim().length).toBeGreaterThan(0);
  });

  it('says something different in each language, so neither is a placeholder', () => {
    /* EN and FR ship from the first commit (CLAUDE.md, Language). */
    const en = createBuildStatus(buildPage().uiHost, { locale: 'en' }).message;
    const fr = createBuildStatus(buildPage().uiHost, { locale: 'fr' }).message;

    expect(en).not.toBe(fr);
    expect(fr).toMatch(/[àâçéèêëîïôùûü]/u);
  });

  it('defaults to English when no locale is chosen', () => {
    const fallback = createBuildStatus(buildPage().uiHost).message;
    const english = createBuildStatus(buildPage().uiHost, { locale: 'en' }).message;

    expect(fallback).toBe(english);
  });

  it.each(['en', 'fr'] as const)('never describes progress, in %s', (locale) => {
    const message = createBuildStatus(buildPage().uiHost, { locale }).message.toLowerCase();

    /*
      The defect this element exists to fix. Copy that talks about loading,
      waiting or percentages re-creates the impression the screen already gave
      for free, and it would not even be true: nothing is loading.
    */
    for (const forbidden of [
      'load',
      'chargement',
      'charge',
      'wait',
      'patient',
      'please',
      'veuillez',
      '%',
      '...',
      '…',
    ]) {
      expect(message, `"${forbidden}" reads as a stalled loader`).not.toContain(forbidden);
    }
  });

  it.each(['en', 'fr'] as const)('stays short enough to read at a glance, in %s', (locale) => {
    const message = createBuildStatus(buildPage().uiHost, { locale }).message;

    /* Plain language, roughly CLB 4 / grade 6 (CLAUDE.md, Accessibility). */
    expect(message.length).toBeLessThanOrEqual(110);
    expect(message.split(/\s+/u).length).toBeLessThanOrEqual(20);
  });

  it('carries its own styles, and injects them once however many are built', () => {
    const page = buildPage();

    createBuildStatus(page.uiHost);
    createBuildStatus(page.uiHost);

    /* `app/ui` owns its presentation; a second <style> would be a leak per instance. */
    expect(page.doc.head.children).toHaveLength(1);
    expect(page.doc.head.children[0]?.textContent).toContain('#tn-build-status');
  });

  it('does not eat taps on the playfield', () => {
    const page = buildPage();
    createBuildStatus(page.uiHost);

    /*
      `#ui > *` opts children back into hit-testing, so a caption that did not opt
      out would swallow a tap meant for the game the moment slice 1 adds one.
    */
    expect(page.doc.head.children[0]?.textContent).toContain('pointer-events: none');
  });

  it('is removed by destroy', () => {
    const page = buildPage();
    const status = createBuildStatus(page.uiHost);

    status.destroy();

    expect(page.ui.children).not.toContain(fake(status.element));
  });
});

/* ------------------------------------------------------------------ *
 * A document double. Only what `createBuildStatus` reaches for: no
 * layout, no CSS, no selector engine.
 * ------------------------------------------------------------------ */

class FakeElement {
  id = '';
  textContent = '';
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;

  constructor(
    readonly ownerDocument: FakeDocument,
    readonly tag: string,
  ) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parentElement?.removeChild(node);
      node.parentElement = this;
      this.children.push(node);
    }
  }

  removeChild(node: FakeElement): void {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
  }

  remove(): void {
    this.parentElement?.removeChild(this);
    this.parentElement = null;
  }

  find(id: string): FakeElement | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const hit = child.find(id);
      if (hit !== null) return hit;
    }
    return null;
  }
}

class FakeDocument {
  readonly head: FakeElement;
  readonly body: FakeElement;

  constructor() {
    this.head = new FakeElement(this, 'head');
    this.body = new FakeElement(this, 'body');
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(this, tag);
  }

  getElementById(id: string): FakeElement | null {
    return this.head.find(id) ?? this.body.find(id);
  }
}

interface Page {
  readonly doc: FakeDocument;
  readonly ui: FakeElement;
  /** `#ui`, typed as the module expects it. */
  readonly uiHost: HTMLElement;
}

/** The slice-0 tree: `#game` beside `#ui`, with the announcer already in `#ui`. */
function buildPage(): Page {
  const doc = new FakeDocument();

  const game = doc.createElement('div');
  game.id = 'game';
  const ui = doc.createElement('div');
  ui.id = 'ui';
  const live = doc.createElement('div');
  live.id = 'tn-live-region';

  doc.body.append(game, ui);
  ui.append(live);

  return { doc, ui, uiHost: ui as unknown as HTMLElement };
}

/** Re-view an element the module handed back as `HTMLElement` as the double it is. */
function fake(element: HTMLElement): FakeElement {
  return element as unknown as FakeElement;
}
