/**
 * Every `locomotion[].mode` a level declares is one `content/game.config.json`
 * names in `locomotionModes` (ADR-0023).
 *
 * `level.schema.json#/$defs/locomotionMode` is an open `id` since ADR-0023, so
 * the schema no longer catches `tobogan`. The vocabulary moved to the config
 * rather than vanishing, and this gate is what keeps that a build failure: a
 * misspelt or unregistered mode fails here, in `make test`, instead of at load
 * as `unsupported` on a player's device. Adding a mode is one line in the config
 * and a tuning in the level — never an edit to an adapter or to this file.
 *
 * The level list is read from `content/levels/`, so the next level is covered
 * without anyone remembering to add it. A ride's `mode` is not checked here:
 * the level parser already holds each ride to the level's own `locomotion[]`,
 * which this gate holds to the config.
 *
 * Two suites. The fixtures prove the predicate rejects a mode outside the
 * vocabulary, so a reader that stopped finding modes cannot pass the corpus by
 * reading nothing.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import gameConfigJson from "../../../content/game.config.json";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

const MODES: readonly string[] = (
  gameConfigJson as { locomotionModes: readonly string[] }
).locomotionModes;

/**
 * Every `locomotion[].mode` in `level` that `modes` does not name, as
 * `locomotion[i] (<mode>)` messages. A non-string or missing mode is reported
 * too: the schema would refuse it, but this gate must not read it as "fine".
 */
export const unconfiguredModes = (
  level: unknown,
  modes: readonly string[],
): readonly string[] => {
  const locomotion = (level as { locomotion?: unknown } | null)?.locomotion;
  if (!Array.isArray(locomotion)) return ["locomotion is not an array"];
  return locomotion.flatMap((tuning: unknown, index) => {
    const mode = (tuning as { mode?: unknown } | null)?.mode;
    return typeof mode === "string" && modes.includes(mode)
      ? []
      : [`locomotion[${String(index)}] (${String(mode)})`];
  });
};

const levelFiles = readdirSync(LEVELS_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

const readLevel = (file: string): unknown =>
  JSON.parse(readFileSync(`${LEVELS_DIR}/${file}`, "utf8")) as unknown;

describe("a level moves only by a mode the config names", () => {
  it("reads a real corpus and a real vocabulary", () => {
    /* An empty directory or an empty list would let every case below pass over
       nothing (ADR-0024). */
    expect(levelFiles.length).toBeGreaterThan(0);
    expect(MODES.length).toBeGreaterThan(1);
    expect(new Set(MODES).size).toBe(MODES.length);
  });

  it.each(levelFiles)("%s", (file) => {
    const level = readLevel(file);
    const locomotion = (level as { locomotion?: unknown }).locomotion;
    expect(
      Array.isArray(locomotion) && locomotion.length > 0,
      `${file} declares no locomotion`,
    ).toBe(true);
    const offenders = unconfiguredModes(level, MODES);
    expect(
      offenders,
      `content/levels/${file} moves by ${offenders.join(", ")}, which content/game.config.json's ` +
        "`locomotionModes` does not name. Add the mode to the config (ADR-0023) or fix the spelling; " +
        "never add it to an adapter.",
    ).toEqual([]);
  });
});

describe("the predicate refuses what it should", () => {
  const modes = ["walk", "toboggan"];

  it("accepts every mode in the vocabulary", () => {
    expect(
      unconfiguredModes(
        { locomotion: [{ mode: "toboggan" }, { mode: "walk" }] },
        modes,
      ),
    ).toEqual([]);
  });

  it("names a misspelt mode and its index", () => {
    expect(
      unconfiguredModes(
        { locomotion: [{ mode: "walk" }, { mode: "tobogan" }] },
        modes,
      ),
    ).toEqual(["locomotion[1] (tobogan)"]);
  });

  it("refuses a mode that is real elsewhere but not in this vocabulary", () => {
    expect(
      unconfiguredModes({ locomotion: [{ mode: "dogsled" }] }, modes),
    ).toEqual(["locomotion[0] (dogsled)"]);
  });

  it("does not read a missing mode or a missing array as fine", () => {
    expect(unconfiguredModes({ locomotion: [{}] }, modes)).toEqual([
      "locomotion[0] (undefined)",
    ]);
    expect(unconfiguredModes({}, modes)).toEqual([
      "locomotion is not an array",
    ]);
  });
});
