import { expect, test, type Page } from "@playwright/test";

/**
 * ADR-0053 §4: the gate that holds "an unaccepted draw lives for the sitting
 * and is never written down".
 *
 * > While the creator is open and the player has not accepted a character,
 * > nothing writes a character — no `character/created`, no
 * > `character/changed`, and the store's `character` is still `null`.
 *
 * This pins the rule, not the symptom. It never asserts that a reload redraws,
 * which would go red the day someone legitimately changes how the draw is
 * seeded. It asserts what the game writes while a first-run player is still
 * choosing: option changes, "Surprise me", a Settings visit, a language change,
 * and Back and Play again.
 *
 * ## How the store is read
 *
 * Through the game, from a second tab of the same browser. That tab boots from
 * the same store and asks it the only question `TN-FIRSTRUN` ruling 1 lets
 * anything ask — "does the save have a character?" — and answers it on the
 * title screen: "Play" for a first run, "Choose a level" for a returning
 * player. No production hook is added and no storage bytes are opened, so the
 * check survives a change to the save's format or to which store holds it
 * (ADR-0026), the reason `first-run.spec.ts` reads its save back the same way.
 *
 * The second tab also has to show the title in French. The language change is
 * a real write of the save, so a French title proves the tab read the store
 * this sitting wrote to, not an empty one. A first run read from an empty store
 * would prove nothing.
 *
 * The events come from the read-only `?e2e=1` trace, which is the seam every
 * other `character/*` assertion in this suite reads.
 */

const CHARACTER_EVENTS = ["character/created", "character/changed"] as const;

/** The trace `?e2e=1` installs. Read-only: a test may look, never steer. */
async function events(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as { __tnExam?: { events(): { name: string }[] } }
    ).__tnExam;
    return (probe?.events() ?? []).map((entry) => entry.name);
  });
}

/** Nothing has written a character yet. `step` names the step in the failure. */
async function expectNoCharacterWritten(
  page: Page,
  step: string,
): Promise<void> {
  const trace = await events(page);
  for (const name of CHARACTER_EVENTS) {
    expect(
      trace,
      `${name} was emitted after ${step}, before the player accepted a character`,
    ).not.toContain(name);
  }
}

/** Pick an option in a group that is not the one already picked. */
async function changeOption(page: Page, slot: string): Promise<void> {
  /* Resolved to one option by its id first: a locator that still said
     "unchecked" would move to another option the moment this one was checked. */
  const id = await page
    .locator(`[data-testid="${slot}"] [role="radio"][aria-checked="false"]`)
    .first()
    .getAttribute("data-testid");
  expect(id, `${slot} offers no option to change to`).not.toBeNull();
  const other = page.getByTestId(id ?? "");
  await other.click();
  await expect(other).toHaveAttribute("aria-checked", "true");
}

test.describe("a character the player has not accepted (ADR-0053)", () => {
  test("is never written down while the creator is open and unfinished", async ({
    page,
    context,
  }) => {
    /* A fresh browser context has no save, so this is a first run. */
    await page.goto("./?e2e=1");
    await expect(page.locator("html")).toHaveAttribute("data-tn-boot", "ready");
    await expect(page.getByTestId("title-play")).toBeVisible();

    await page.getByTestId("title-play").click();
    const creator = page.getByTestId("character-creator");
    await expect(creator).toBeVisible();
    await expectNoCharacterWritten(page, "opening the creator");

    /* Option changes. */
    await changeOption(page, "slot-skin");
    await changeOption(page, "slot-hair-shape");
    await expectNoCharacterWritten(page, "changing options");

    /* "Surprise me": a new draw because the player asked, and still not theirs. */
    await page.getByTestId("randomise-character").click();
    await expectNoCharacterWritten(page, '"Surprise me"');

    /* Back to the title and in again. */
    await page.getByTestId("creator-back").click();
    await expect(page.getByTestId("title-play")).toBeVisible();
    await page.getByTestId("title-play").click();
    await expect(creator).toBeVisible();
    await expectNoCharacterWritten(page, "Back and Play again");

    /* A Settings visit with a language change. The change is saved, and the
       save it makes is exactly where a held draw would leak in. */
    const savesBefore = (await events(page)).filter(
      (name) => name === "progress/saved",
    ).length;
    await page.getByTestId("creator-settings").click();
    await expect(page.getByTestId("settings-screen")).toBeVisible();
    await page.getByTestId("setting-language-fr").click();
    await page.getByTestId("settings-close").click();
    await expect(creator).toBeVisible();
    await expect(creator).toHaveAttribute("lang", "fr");
    await expectNoCharacterWritten(
      page,
      "a Settings visit and a language change",
    );

    /* One more option change after the save, in the language now chosen. */
    await changeOption(page, "slot-skin");

    /* Let the write land before another tab reads the store. */
    await page.waitForFunction((before) => {
      const probe = (
        window as unknown as { __tnExam?: { events(): { name: string }[] } }
      ).__tnExam;
      const names = (probe?.events() ?? []).map((entry) => entry.name);
      return names.filter((name) => name === "progress/saved").length > before;
    }, savesBefore);

    /* The store, asked by the game in a second tab while the creator in this
       tab is still open and unfinished. */
    const reader = await context.newPage();
    await reader.goto("./");
    await expect(reader.locator("html")).toHaveAttribute(
      "data-tn-boot",
      "ready",
    );
    const titleOffers = reader.locator(
      '[data-testid="title-play"], [data-testid="title-choose-level"]',
    );
    await expect(titleOffers.first()).toBeVisible();
    /* A first run: Play, and neither way in that a character would have opened. */
    await expect(
      reader.getByTestId("title-choose-level"),
      "the store holds a character the player never accepted",
    ).toHaveCount(0);
    await expect(reader.getByTestId("title-continue")).toHaveCount(0);
    /* In the language the sitting saved, so this is the store the sitting wrote. */
    await expect(reader.getByTestId("title-play")).toHaveText("Jouer");
    await reader.close();

    /* And the sitting is still where the player left it. */
    await expect(creator).toBeVisible();
    await expect(page.getByTestId("start-playing")).toBeVisible();
    await expectNoCharacterWritten(page, "the whole sitting");
  });
});
