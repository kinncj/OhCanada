import { expect, test, type Page } from '@playwright/test';

import { HARNESS_URL } from './playwright.config';

/**
 * Radio groups, from the keyboard and from one switch, in a real Chromium.
 *
 * **The defect this exists for.** `app/ui/focus-trap.ts` owns Tab inside every
 * modal screen, and it used to stop on every button its selector matched,
 * including the radios whose `tabindex` is `-1`. The screens kept a roving
 * `tabindex` and the trap walked past it, so a keyboard player crossed the
 * creator's six groups in twenty-two Tabs rather than six, and Settings'
 * language and hold-time groups the same way.
 *
 * What the ARIA radio group pattern requires, and what each test holds:
 *
 *  - **Tab and Shift+Tab stop once per group**, on the chosen option, and walk
 *    the same stops in reverse;
 *  - **the arrow keys move and choose within a group**, wrap at both ends, and
 *    never move focus out of it or change another group;
 *  - **one switch still reaches every option**, because the switch ring is its
 *    own list and never read the Tab order.
 *
 * The creator and Settings, in English and in French: the two screens that
 * hold radio groups. The exam and question cards use `aria-pressed` buttons,
 * not radios, so each option is its own Tab stop there by design.
 */

type Locale = 'en' | 'fr';
type Harness = 'creator' | 'settings';

const ROOT: Readonly<Record<Harness, string>> = {
  creator: 'character-creator',
  settings: 'settings-screen',
};

interface Focus {
  readonly id: string;
  readonly role: string | null;
  readonly group: string | null;
  readonly checked: string | null;
}

async function open(
  page: Page,
  screen: Harness,
  locale: Locale,
  extra: Readonly<Record<string, string>> = {},
): Promise<void> {
  const params = new URLSearchParams({ screen, locale, ...extra });
  const response = await page.goto(`${HARNESS_URL}?${params.toString()}`);
  expect(response?.status()).toBeLessThan(400);
  await page.waitForSelector(`html[data-tn-harness-ready="${screen}"]`, { timeout: 15_000 });
  await expect(page.getByTestId(ROOT[screen])).toBeVisible();
}

const focusOf = (page: Page): Promise<Focus> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) {
      return { id: 'body', role: null, group: null, checked: null };
    }
    return {
      id: active.getAttribute('data-testid') ?? (active.id !== '' ? active.id : active.tagName),
      role: active.getAttribute('role'),
      group: active.closest('[role="radiogroup"]')?.getAttribute('data-testid') ?? null,
      checked: active.getAttribute('aria-checked'),
    };
  });

/** Every radio group on the page, in reading order. */
const groupsOn = (page: Page): Promise<string[]> =>
  page
    .locator('[role="radiogroup"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));

const optionsIn = (page: Page, group: string): Promise<string[]> =>
  page
    .locator(`[data-testid="${group}"] [role="radio"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));

/** Group to chosen option, for every group on the page. */
const chosenOn = (page: Page): Promise<Record<string, string | null>> =>
  page.locator('[role="radiogroup"]').evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => [
        node.getAttribute('data-testid') ?? '',
        node.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute('data-testid') ??
          null,
      ]),
    ),
  );

/** Press `key` until focus comes back to the first stop it reached: one lap, every stop once. */
async function lap(page: Page, key: 'Tab' | 'Shift+Tab'): Promise<Focus[]> {
  const stops: Focus[] = [];
  for (let press = 0; press < 60; press += 1) {
    await page.keyboard.press(key);
    const now = await focusOf(page);
    expect(now.id, `focus fell to the body after ${key}`).not.toBe('body');
    if (stops[0]?.id === now.id) return stops;
    stops.push(now);
  }
  throw new Error(`${key} never came back round: ${stops.map((stop) => stop.id).join(', ')}`);
}

async function expectOneStopPerGroup(page: Page): Promise<void> {
  const groups = await groupsOn(page);
  expect(groups.length, 'the premise: this screen has radio groups').toBeGreaterThan(1);

  const forward = await lap(page, 'Tab');
  const radios = forward.filter((stop) => stop.role === 'radio');
  expect(
    radios.map((stop) => stop.group),
    `each radio group is one Tab stop, in reading order: ${forward.map((stop) => stop.id).join(', ')}`,
  ).toEqual(groups);
  for (const stop of radios) {
    expect(stop.checked, `${stop.id} is a Tab stop but not the chosen option`).toBe('true');
  }
  expect(
    forward.filter((stop) => stop.role !== 'radio').length,
    'Tab reached nothing but the radios',
  ).toBeGreaterThan(0);

  const backward = await lap(page, 'Shift+Tab');
  expect(backward.map((stop) => stop.id)).toEqual(forward.map((stop) => stop.id).reverse());
}

async function expectArrowsWithin(page: Page, group: string): Promise<void> {
  const options = await optionsIn(page, group);
  expect(options.length, `the premise: ${group} has options to move between`).toBeGreaterThan(1);
  const before = await chosenOn(page);

  for (let press = 0; press < 60 && (await focusOf(page)).group !== group; press += 1) {
    await page.keyboard.press('Tab');
  }
  const start = await focusOf(page);
  expect(start.group, `Tab never reached ${group}`).toBe(group);
  expect(start.checked, 'Tab entered the group somewhere other than its chosen option').toBe('true');
  const at = options.indexOf(start.id);
  expect(at).toBeGreaterThanOrEqual(0);

  const expectOn = async (index: number, key: string): Promise<void> => {
    const expected = options[((index % options.length) + options.length) % options.length];
    const now = await focusOf(page);
    expect(now.id, `${key} in ${group}`).toBe(expected);
    expect(now.group, `${key} took focus out of ${group}`).toBe(group);
    expect(now.checked, `${key} moved focus without choosing`).toBe('true');
    await expect(page.locator(`[data-testid="${group}"] [aria-checked="true"]`)).toHaveCount(1);
  };

  /* All the way round each way, so both wraps are crossed wherever the group starts. */
  for (let step = 1; step <= options.length; step += 1) {
    await page.keyboard.press('ArrowRight');
    await expectOn(at + step, 'ArrowRight');
  }
  for (let step = 1; step <= options.length; step += 1) {
    await page.keyboard.press('ArrowLeft');
    await expectOn(at - step, 'ArrowLeft');
  }
  await page.keyboard.press('ArrowDown');
  await expectOn(at + 1, 'ArrowDown');
  await page.keyboard.press('ArrowUp');
  await expectOn(at, 'ArrowUp');

  expect(await chosenOn(page), 'walking one group round changed a choice').toEqual(before);

  /* And Tab leaves the group in one press, and Shift+Tab comes back to its choice. */
  await page.keyboard.press('Tab');
  expect((await focusOf(page)).group, `Tab stayed inside ${group}`).not.toBe(group);
  await page.keyboard.press('Shift+Tab');
  expect((await focusOf(page)).id).toBe(start.id);
}

for (const locale of ['en', 'fr'] as const) {
  test.describe(`radio groups, in ${locale}`, () => {
    test('the creator: Tab and Shift+Tab stop once per group, on the chosen option', async ({
      page,
    }) => {
      await open(page, 'creator', locale);
      await expectOneStopPerGroup(page);
    });

    test('the creator: the arrow keys choose within a group, wrap, and stay in it', async ({
      page,
    }) => {
      await open(page, 'creator', locale);
      const groups = await groupsOn(page);
      await expectArrowsWithin(page, groups[0] ?? 'slot-skin');
      await expectArrowsWithin(page, groups[groups.length - 1] ?? 'slot-presentation');
    });

    test('settings: Tab and Shift+Tab stop once per group, on the chosen option', async ({
      page,
    }) => {
      await open(page, 'settings', locale);
      expect(await groupsOn(page)).toEqual(['setting-language', 'setting-hold-time']);
      await expectOneStopPerGroup(page);
    });

    test('settings: the arrow keys choose within Language and Hold time, and wrap', async ({
      page,
    }) => {
      await open(page, 'settings', locale);
      await expectArrowsWithin(page, 'setting-hold-time');
      await expectArrowsWithin(page, 'setting-language');
    });
  });
}

test('one switch still reaches every option in every group, and short presses choose nothing', async ({
  page,
}) => {
  await open(page, 'creator', 'en', { switch: '1' });
  const radios = await page
    .locator('[data-testid="character-creator"] [role="radio"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
  expect(radios.length, 'the premise: the creator has options').toBeGreaterThan(6);
  const before = await chosenOn(page);

  const highlighted = new Set<string>();
  for (let press = 0; press < 80 && radios.some((id) => !highlighted.has(id)); press += 1) {
    highlighted.add(
      await page.evaluate(
        () =>
          document.querySelector('[data-switch-highlight="true"]')?.getAttribute('data-testid') ??
          '',
      ),
    );
    await page.keyboard.press('Space');
  }

  expect(radios.filter((id) => !highlighted.has(id)), 'options one switch never reached').toEqual(
    [],
  );
  expect(await chosenOn(page), 'a short press chose something').toEqual(before);
});
