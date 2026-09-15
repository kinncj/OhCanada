import { describe, expect, it } from 'vitest';

import {
  createFocusTrap,
  nextTabStop,
  tabStopIndices,
  type TabCandidate,
} from '@ui/focus-trap';

import { buildPage, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * The trap walks the Tab order a browser walks: a negative `tabindex` is not a
 * stop, and a radio group is one stop.
 *
 * It used to stop on every button its selector matched, `tabindex="-1"` or
 * not, so a keyboard player crossed the creator's six radio groups in
 * twenty-two presses rather than six, and every radio group in Settings the
 * same way. `nextTabStop` and `tabStopIndices` are pure and proved directly
 * below. The trap itself is then driven on the shared document double, which
 * has a real selector engine and a capture phase. `tests/unit/ui/focus-trap.test.ts`
 * keeps the containment guarantees, and `tests/a11y/radio-groups.spec.ts`
 * presses the real keys in Chromium.
 */

const plain = (tabbable = true): TabCandidate => ({ tabbable, group: null, checked: false });
/* A roving tabindex, as the screens keep one: the checked radio is 0, the rest -1. */
const radio = (group: string, checked = false, tabbable = checked): TabCandidate => ({
  tabbable,
  group,
  checked,
});

describe('tabStopIndices', () => {
  it('leaves out an element with a negative tabindex', () => {
    expect(tabStopIndices([plain(), plain(false), plain()])).toEqual([0, 2]);
  });

  it('keeps one stop per group, on its checked radio', () => {
    const candidates = [
      plain(),
      radio('skin'),
      radio('skin'),
      radio('skin', true),
      radio('hair', true),
      radio('hair'),
      plain(),
    ];
    expect(tabStopIndices(candidates)).toEqual([0, 3, 4, 6]);
  });

  it('stops on the first radio of a group where nothing is checked', () => {
    expect(tabStopIndices([radio('skin'), radio('skin'), plain()])).toEqual([0, 2]);
  });

  it('counts a group once even when its screen forgot to rove the tabindex', () => {
    const unroved = [radio('a', false, true), radio('a', true, true), radio('a', false, true)];
    expect(tabStopIndices(unroved)).toEqual([1]);
  });

  it('has no stops in an empty dialog', () => {
    expect(tabStopIndices([])).toEqual([]);
    expect(tabStopIndices([plain(false)])).toEqual([]);
  });
});

describe('nextTabStop', () => {
  /* button, [skin: 3 radios, second checked], [hair: 2 radios, none checked], button */
  const screen: readonly TabCandidate[] = [
    plain(),
    radio('skin'),
    radio('skin', true),
    radio('skin'),
    radio('hair'),
    radio('hair'),
    plain(),
  ];

  it('walks forward one stop per group, and wraps', () => {
    const order: number[] = [];
    let at = -1;
    for (let step = 0; step < 5; step += 1) {
      at = nextTabStop(screen, at, false);
      order.push(at);
    }
    expect(order).toEqual([0, 2, 4, 6, 0]);
  });

  it('walks backward the same stops in reverse, and wraps', () => {
    const order: number[] = [];
    let at = -1;
    for (let step = 0; step < 5; step += 1) {
      at = nextTabStop(screen, at, true);
      order.push(at);
    }
    expect(order).toEqual([6, 4, 2, 0, 6]);
  });

  it('leaves the group from a radio that has focus but is not its stop', () => {
    expect(nextTabStop(screen, 3, false)).toBe(4);
    expect(nextTabStop(screen, 1, true)).toBe(0);
    expect(nextTabStop(screen, 5, false)).toBe(6);
    expect(nextTabStop(screen, 5, true)).toBe(2);
  });

  it('goes on from a plain control that has just been taken out of the order', () => {
    expect(nextTabStop([plain(), plain(false), plain()], 1, false)).toBe(2);
    expect(nextTabStop([plain(), plain(false), plain()], 1, true)).toBe(0);
  });

  it('stays on a group that is the only stop, from any of its radios', () => {
    const lonely = [radio('only'), radio('only', true), radio('only')];
    expect(nextTabStop(lonely, 1, false)).toBe(1);
    expect(nextTabStop(lonely, 0, false)).toBe(1);
    expect(nextTabStop(lonely, 2, true)).toBe(1);
  });

  it('answers the container when there is nowhere to stop', () => {
    expect(nextTabStop([], -1, false)).toBe(-1);
    expect(nextTabStop([plain(false)], 0, true)).toBe(-1);
  });

  it('enters at the first stop going forward and the last going back, from outside', () => {
    expect(nextTabStop(screen, -1, false)).toBe(0);
    expect(nextTabStop(screen, 99, true)).toBe(6);
    expect(nextTabStop(screen, Number.NaN, false)).toBe(0);
  });

  it('never answers an index that is not a stop', () => {
    const stops = new Set(tabStopIndices(screen));
    for (let index = -1; index <= screen.length; index += 1) {
      for (const backwards of [false, true]) {
        expect(stops.has(nextTabStop(screen, index, backwards))).toBe(true);
      }
    }
  });
});

describe('createFocusTrap over radio groups', () => {
  interface Dialog {
    readonly page: FakePage;
    readonly dialog: FakeElement;
    add(parent: FakeElement, tag: string, attrs?: Record<string, string>): FakeElement;
    focused(): string;
    tab(shiftKey?: boolean): string;
  }

  function dialog(): Dialog {
    const page = buildPage();
    const root = page.doc.createElement('div');
    root.setAttribute('role', 'dialog');
    root.tabIndex = -1;
    page.ui.append(root);

    const focused = (): string => page.doc.activeElement?.getAttribute('data-testid') ?? 'none';
    return {
      page,
      dialog: root,
      add(parent, tag, attrs = {}): FakeElement {
        const node = page.doc.createElement(tag);
        for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
        parent.append(node);
        return node;
      },
      focused,
      tab(shiftKey = false): string {
        press(root, 'Tab', { shiftKey });
        return focused();
      },
    };
  }

  function ariaGroup(scene: Dialog, name: string, count: number, checked: number | null): FakeElement {
    const group = scene.add(scene.dialog, 'div', { role: 'radiogroup', 'data-testid': name });
    for (let index = 0; index < count; index += 1) {
      const chosen = index === checked;
      scene.add(group, 'button', {
        role: 'radio',
        'aria-checked': String(chosen),
        tabindex: chosen || (checked === null && index === 0) ? '0' : '-1',
        'data-testid': `${name}-${String(index)}`,
      });
    }
    return group;
  }

  it('walks one stop per ARIA radio group, and skips a button taken out of the order', () => {
    const scene = dialog();
    scene.add(scene.dialog, 'button', { 'data-testid': 'first' });
    ariaGroup(scene, 'language', 2, 1);
    scene.add(scene.dialog, 'button', { 'data-testid': 'previous', tabindex: '-1' });
    ariaGroup(scene, 'hold', 4, 1);
    scene.add(scene.dialog, 'button', { 'data-testid': 'close' });
    createFocusTrap(scene.dialog as unknown as HTMLElement).activate();

    expect([scene.tab(), scene.tab(), scene.tab(), scene.tab(), scene.tab()]).toEqual([
      'first',
      'language-1',
      'hold-1',
      'close',
      'first',
    ]);
    expect([scene.tab(true), scene.tab(true), scene.tab(true)]).toEqual([
      'close',
      'hold-1',
      'language-1',
    ]);
  });

  it('holds one stop for native radios that share a name, on the checked one', () => {
    const scene = dialog();
    scene.add(scene.dialog, 'button', { 'data-testid': 'before' });
    for (const value of ['a', 'b', 'c']) {
      const input = scene.add(scene.dialog, 'input', {
        type: 'radio',
        name: 'size',
        'data-testid': `size-${value}`,
      });
      (input as unknown as { name: string; checked: boolean }).name = 'size';
      (input as unknown as { checked: boolean }).checked = value === 'c';
    }
    scene.add(scene.dialog, 'button', { 'data-testid': 'after' });
    createFocusTrap(scene.dialog as unknown as HTMLElement).activate();

    expect([scene.tab(), scene.tab(), scene.tab()]).toEqual(['before', 'size-c', 'after']);
  });

  it('still reaches a group with nothing checked, on its first radio', () => {
    const scene = dialog();
    ariaGroup(scene, 'hair', 3, null);
    scene.add(scene.dialog, 'button', { 'data-testid': 'done' });
    createFocusTrap(scene.dialog as unknown as HTMLElement).activate();

    expect([scene.tab(), scene.tab(), scene.tab()]).toEqual(['hair-0', 'done', 'hair-0']);
  });

  it('leaves a hidden radio out, and moves the group stop to what is left', () => {
    const scene = dialog();
    const group = ariaGroup(scene, 'skin', 3, 0);
    group.children[0]!.hidden = true;
    scene.add(scene.dialog, 'button', { 'data-testid': 'done' });
    createFocusTrap(scene.dialog as unknown as HTMLElement).activate();

    expect([scene.tab(), scene.tab()]).toEqual(['skin-1', 'done']);
  });
});
