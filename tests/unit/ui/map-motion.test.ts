import { describe, expect, it } from 'vitest';

import { SHIPPED_MAP_ANCHORS, createLevelMap } from '@ui/level-map';
import { injectScreenStyles } from '@ui/screen-styles';
import type { LevelId } from '@domain/ids';

import { buildPage, type FakeElement } from './support/fake-dom';

/**
 * The map's motion, and the proof that reduced motion removes all of it.
 *
 * The level select's map draws the travelled line in when the screen opens and
 * then swells the "you are here" pin. CLAUDE.md: "Reduced motion disables
 * parallax easing, particles and squash-and-stretch"; the brief for this screen:
 * reduced motion disables all of it, nothing may count down or flash, and
 * nothing may be needed to read the state.
 *
 * The fake DOM has no cascade, so what can be proved here is **what the
 * stylesheet says**, read as rules: which rules animate, that each of them is
 * inside the map, that a reduced-motion rule with `!important` covers the whole
 * map for the attribute and for the media query, and that every animation ends,
 * changes no colour or opacity, and leaves the drawn state behind it.
 * `tests/a11y/shell.spec.ts` asserts the same in Chromium, with the animations
 * the browser actually runs.
 */

interface CssRule {
  /** The at-rules this rule is nested in, outermost first. */
  readonly context: readonly string[];
  readonly selector: string;
  readonly body: string;
}

/** A small, literal CSS reader: comments out, then blocks by brace depth. */
function rulesOf(css: string): readonly CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const character of source) {
    if (character === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (character === '}') {
      const selector = stack.pop() ?? '';
      const body = buffer.trim();
      if (body !== '') rules.push({ context: [...stack], selector, body });
      buffer = '';
    } else {
      buffer += character;
    }
  }
  return rules;
}

const declaration = (body: string, property: string): string | null => {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body);
  return match?.[1]?.trim() ?? null;
};

const selectorsOf = (rule: CssRule): readonly string[] =>
  rule.selector.split(',').map((part) => part.replace(/\s+/g, ' ').trim());

const CSS = ((): string => {
  const page = buildPage();
  return injectScreenStyles(page.document).textContent ?? '';
})();

const RULES = rulesOf(CSS);

const inKeyframes = (rule: CssRule): boolean =>
  rule.context.some((at) => at.startsWith('@keyframes'));

/** Every rule that starts an animation, outside keyframes and outside reduced motion. */
const ANIMATING = RULES.filter((rule) => {
  if (inKeyframes(rule)) return false;
  const value = declaration(rule.body, 'animation') ?? declaration(rule.body, 'animation-name');
  return value !== null && !value.startsWith('none');
});

const MAP_ANIMATING = ANIMATING.filter((rule) =>
  selectorsOf(rule).some((selector) => selector.includes('.tn-map')),
);

const keyframesBody = (name: string): readonly CssRule[] =>
  RULES.filter((rule) => rule.context.includes(`@keyframes ${name}`));

describe('the map moves, once', () => {
  it('has motion to remove, so the proof below is not about nothing', () => {
    const names = MAP_ANIMATING.map((rule) => declaration(rule.body, 'animation')?.split(/\s+/)[0]);
    expect(names.sort()).toEqual(['tn-map-here-pulse', 'tn-map-route-draw']);
  });

  it('starts every animation inside the map, where the reduced-motion rule reaches', () => {
    for (const rule of MAP_ANIMATING) {
      for (const selector of selectorsOf(rule)) {
        expect(selector, 'an animated map rule reaches outside .tn-map').toMatch(/^\.tn-map(\s|__)/);
      }
    }
    /* And the elements those selectors name really are inside `.tn-map`. */
    const anchors = SHIPPED_MAP_ANCHORS;
    if (anchors === null) throw new Error('the shipped sidecar did not read');
    const page = buildPage();
    const map = createLevelMap(page.document, anchors);
    map.draw([
      { id: 'halifax' as LevelId, state: 'open', stop: { before: 'none', after: 'travelled', reached: true, current: false } },
      { id: 'quebec-city' as LevelId, state: 'open', stop: { before: 'travelled', after: 'none', reached: false, current: true } },
    ]);
    const root = map.element as unknown as FakeElement;
    const moving = [
      ...root.querySelectorAll('line'),
      ...root.querySelectorAll('[data-journey-current="true"]'),
    ];
    expect(moving.length).toBeGreaterThan(2);
    for (const node of moving) expect(node.closest('.tn-map')).toBe(root);
  });

  it('ends within five seconds, and nothing loops', () => {
    const drawTime = declaration(
      RULES.find((rule) => rule.selector === '.tn-map' && declaration(rule.body, '--tn-route-draw') !== null)
        ?.body ?? '',
      '--tn-route-draw',
    );
    expect(drawTime).toBe('1200ms');

    for (const rule of MAP_ANIMATING) {
      expect(declaration(rule.body, 'animation'), rule.selector).not.toMatch(/infinite/);
    }

    /* The line: one run, paced by shares that add up to one, so it is done at
       --tn-route-draw. */
    const draw = MAP_ANIMATING.find((rule) => rule.body.includes('tn-map-route-draw'));
    expect(declaration(draw?.body ?? '', 'animation')).toMatch(
      /^tn-map-route-draw calc\(var\(--tn-route-draw\) \* var\(--tn-leg-share\)\) linear\s+calc\(var\(--tn-route-draw\) \* var\(--tn-leg-start\)\) 1 backwards$/,
    );

    /* The pulse: after the line, a fixed number of fixed-length swells. */
    const pulse = declaration(
      MAP_ANIMATING.find((rule) => rule.body.includes('tn-map-here-pulse'))?.body ?? '',
      'animation',
    );
    const match = /^tn-map-here-pulse (\d+)ms ease-in-out var\(--tn-route-draw\) (\d+)$/.exec(pulse ?? '');
    expect(match, `the pulse is not in the expected shape: ${pulse ?? 'missing'}`).not.toBeNull();
    const total = 1200 + Number(match?.[1]) * Number(match?.[2]);
    expect(total).toBeLessThanOrEqual(5000);
  });

  it('changes no colour and no opacity while it moves, so nothing flashes', () => {
    const allowed = new Set(['stroke-dasharray', 'stroke-dashoffset', 'transform']);
    for (const name of ['tn-map-route-draw', 'tn-map-here-pulse']) {
      const frames = keyframesBody(name);
      expect(frames.length, `@keyframes ${name} is missing`).toBeGreaterThan(0);
      for (const frame of frames) {
        for (const part of frame.body.split(';')) {
          const property = part.split(':')[0]?.trim() ?? '';
          if (property === '') continue;
          expect(allowed.has(property), `@keyframes ${name} animates ${property}`).toBe(true);
        }
      }
    }
  });
});

describe('reduced motion removes all of it', () => {
  const covers = (rule: CssRule | undefined): void => {
    expect(rule, 'no reduced-motion rule for the map').toBeDefined();
    expect(declaration(rule?.body ?? '', 'animation')).toBe('none !important');
    expect(declaration(rule?.body ?? '', 'transition')).toBe('none !important');
  };

  it('under the setting: [data-tn-motion="reduced"] reaches the map and everything in it', () => {
    const rule = RULES.find(
      (candidate) =>
        candidate.context.length === 0 &&
        selectorsOf(candidate).includes('[data-tn-motion="reduced"] .tn-map *') &&
        selectorsOf(candidate).includes('[data-tn-motion="reduced"] .tn-map'),
    );
    covers(rule);
  });

  it('under the media query alone, if the attribute is never written', () => {
    const rule = RULES.find(
      (candidate) =>
        candidate.context.includes('@media (prefers-reduced-motion: reduce)') &&
        selectorsOf(candidate).includes('.tn-map *') &&
        selectorsOf(candidate).includes('.tn-map'),
    );
    covers(rule);
  });

  it('wins: no animation on the map is declared !important', () => {
    for (const rule of MAP_ANIMATING) {
      expect(declaration(rule.body, 'animation'), rule.selector).not.toMatch(/!important/);
    }
  });

  it('leaves the finished drawing: the line has no dash outside its keyframes', () => {
    /* With the animation removed, a leg is a plain solid line. If a dash were
       set on the resting rule, reduced motion would leave the line half-hidden,
       which is information removed with the movement. */
    const resting = RULES.filter(
      (rule) =>
        !inKeyframes(rule) &&
        selectorsOf(rule).some(
          (selector) =>
            selector.includes('.tn-map__leg') ||
            selector.includes('.tn-map__casing') ||
            selector.includes('.tn-map__route'),
        ),
    );
    expect(resting.length).toBeGreaterThan(0);
    for (const rule of resting) {
      expect(rule.body, rule.selector).not.toMatch(/stroke-dash(array|offset)/);
      expect(rule.body, rule.selector).not.toMatch(/opacity|visibility/);
    }
  });

  it('leaves the "you are here" pin bigger, because the size is not the pulse', () => {
    const size = RULES.find(
      (rule) =>
        !inKeyframes(rule) &&
        rule.context.length === 0 &&
        rule.selector === '.tn-map .tn-map__stop[data-journey-current="true"] .tn-journey__pin' &&
        declaration(rule.body, 'inline-size') !== null,
    );
    const plain = RULES.find(
      (rule) =>
        rule.context.length === 0 && rule.selector === '.tn-map .tn-map__stop .tn-journey__pin',
    );
    const cqi = (rule: CssRule | undefined): number =>
      Number(/inline-size:\s*([\d.]+)cqi/.exec(rule?.body ?? '')?.[1] ?? '0');
    expect(cqi(size)).toBeGreaterThan(cqi(plain));
    expect(cqi(plain)).toBeGreaterThan(0);
  });
});
