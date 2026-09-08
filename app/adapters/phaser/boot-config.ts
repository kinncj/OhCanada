/**
 * The slice of `content/game.config.json` the renderer needs, parsed once at boot.
 *
 * Why a hand-written parser instead of ajv: this runs before the first frame and
 * it is on the 6 s time-to-play budget, so the boot path does not pull a JSON
 * Schema validator into the initial chunk. `make validate-content` already checks
 * the file against `content/schemas/game.config.schema.json` in CI; this parser
 * is the runtime guard that turns "the config is wrong" into a `Result` the
 * composition root can report instead of a black canvas.
 *
 * Why the types below are `Pick`s of the port and not interfaces of their own:
 * the hand parse is a *reading* of `content/game.config.json`, not a second
 * declaration of it. `app/application/ports` already mirrors
 * `content/schemas/game.config.schema.json` property for property, and
 * `tests/unit/contracts/ports-match-schemas.test.ts` is the gate that keeps it
 * mirroring. Deriving from `GameConfigDocument` puts this adapter behind that
 * same gate: rename a property in the schema and the port test fails, then the
 * port is fixed and this file stops compiling. Restating the shape here is how
 * `levelOrder` survived a slice while the config said `levels` — the second
 * declaration was invisible from the first. The import is type-only, so the
 * derivation costs nothing at runtime and no application code, and no validator,
 * reaches the boot path (`boot-config-derives-from-port.test.ts` checks both).
 *
 * Adapters may import `common/` and the application's ports — they exist to
 * implement them — but not `app/ui`, `app/bootstrap` or another adapter (ADR-0005).
 */

import type { FeatureFlags, GameConfigDocument, ThemeColours } from '@application/ports';

import { appErr, ok, type Result } from '@common/result';

/**
 * The renderer's view of the config: the handful of properties it needs, under
 * the port's types.
 *
 * `ThemeColours` is the palette (`game.config.schema.json#/$defs/theme`) — the
 * sky at the top of the playfield and the ground at the bottom paint the canvas
 * gradient *and* the page background behind it, which is how the desktop side
 * panels are made (see `GameRenderer`).
 *
 * Only two members are the renderer's own; everything else is `Pick`ed so that
 * the name here is the name in the schema, checked by the compiler.
 */
export interface BootConfig
  extends Pick<
      GameConfigDocument,
      'title' | 'version' | 'defaultLocale' | 'designWidth' | 'designHeight'
    >,
    /* Flattened out of `featureFlags`: the scene needs the flag, not the block. */
    Pick<FeatureFlags, 'debugOverlay'> {
  /** Phaser's clear colour, `#rrggbb`. Equal to `palette.sky`; not a config property. */
  readonly backgroundColor: string;
  /**
   * The config's `theme` after the merge below. Optional in the document,
   * always complete here, so the scene can draw without a fallback of its own.
   */
  readonly palette: ThemeColours;
}

/**
 * The palette used when the document being parsed supplies none.
 *
 * `theme` is optional in `content/schemas/game.config.schema.json` and optional
 * again per level, because most levels differ from the game default in one or
 * two colours and a level should not have to restate the whole block to change
 * its sky. So every key here is a per-key fallback: `readPalette` merges over
 * this object, and a document that omits `theme` entirely — or omits `inkMuted`
 * inside it — still yields a complete, drawable palette rather than a black
 * canvas or an `undefined` colour reaching Phaser.
 *
 * These are therefore the renderer's own last-resort values, not a copy of the
 * shipped config and not the source of the colours you see: `content/game.config.json`
 * carries a `theme` and it wins (see `boot-config.test.ts`, "lets the shipped
 * theme, not the built-in default, reach the palette"). Keep them a palette that
 * is legible on its own — `ink` and `inkMuted` clear WCAG AAA, 7:1, against
 * every stop of the sky-to-ground gradient, which is asserted in that same test
 * file — because the case where they are used is the case where nobody chose.
 *
 * Typed as `ThemeColours` on purpose: the fallback has to be a complete instance
 * of the shape the schema declares, so a colour added to the theme block fails
 * here rather than resolving to `undefined` at the first frame.
 */
export const DEFAULT_PALETTE: ThemeColours = {
  sky: '#0f3057',
  ground: '#12352a',
  horizon: '#e8eef4',
  ink: '#ffffff',
  inkMuted: '#a8c4dc',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** `#rrggbb` -> `0xrrggbb`. Phaser wants an integer everywhere but the clear colour. */
export function toPhaserColor(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/**
 * `0xrrggbb` -> `#rrggbb`. The way back out, for the colours the *page* is
 * painted with: CSS custom properties are strings, and the land under the
 * horizon is a computed shade rather than a palette literal
 * (`GameRenderer.cssVariables`). Values outside 24 bits are masked rather than
 * throwing — a colour is not worth a failed boot.
 */
export function toCssColor(value: number): string {
  return `#${(Math.round(value) & 0xffffff).toString(16).padStart(6, '0')}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (field: string, message: string) =>
  appErr('invalid', `config.boot.${field}`, message, { field });

function readString(
  source: Record<string, unknown>,
  field: string,
): Result<string> {
  const value = source[field];
  if (typeof value !== 'string' || value.length === 0) {
    return invalid(field, `"${field}" must be a non-empty string.`);
  }
  return ok(value);
}

function readPositiveInt(
  source: Record<string, unknown>,
  field: string,
): Result<number> {
  const value = source[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return invalid(field, `"${field}" must be a positive integer.`);
  }
  return ok(value);
}

function readPalette(raw: Record<string, unknown>): Result<ThemeColours> {
  const theme = raw['theme'];
  if (theme === undefined) return ok(DEFAULT_PALETTE);
  if (!isRecord(theme)) return invalid('theme', '"theme" must be an object.');

  const merged: Record<keyof ThemeColours, string> = { ...DEFAULT_PALETTE };
  for (const key of Object.keys(DEFAULT_PALETTE) as (keyof ThemeColours)[]) {
    const value = theme[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
      return invalid(`theme.${key}`, `"theme.${key}" must be a #rrggbb colour.`);
    }
    merged[key] = value;
  }
  return ok(merged);
}

/**
 * The one narrowing this parser cannot prove.
 *
 * `defaultLocale` is a branded `LocaleCode` in the port because the schema
 * constrains it to a supported locale — `common.schema.json#/$defs/locale`, an
 * enum of `en` and `fr` — and that constraint is checked by
 * `make validate-content`, not here: this parser only establishes "non-empty
 * string", which is the boot guard it has always been. A config that ships a
 * locale the game does not have fails CI, not the first frame.
 * Widening the field to `string` instead would silently drop it out of the
 * `Pick` above and hand back the freedom to misspell it, so the assertion is
 * kept, named, and confined to one line.
 */
const asLocaleCode = (value: string): GameConfigDocument['defaultLocale'] =>
  value as GameConfigDocument['defaultLocale'];

/**
 * Parse an untrusted `game.config.json` document into the renderer's view of it.
 * Every failure is an expected failure with a greppable code (`config.boot.*`).
 */
export function parseBootConfig(raw: unknown): Result<BootConfig> {
  if (!isRecord(raw)) {
    return invalid('document', 'game.config.json must be a JSON object.');
  }

  const title = readString(raw, 'title');
  if (!title.ok) return title;

  const version = readString(raw, 'version');
  if (!version.ok) return version;

  const defaultLocale = readString(raw, 'defaultLocale');
  if (!defaultLocale.ok) return defaultLocale;

  const designWidth = readPositiveInt(raw, 'designWidth');
  if (!designWidth.ok) return designWidth;

  const designHeight = readPositiveInt(raw, 'designHeight');
  if (!designHeight.ok) return designHeight;

  const flags = raw['featureFlags'];
  if (!isRecord(flags)) {
    return invalid('featureFlags', '"featureFlags" must be an object.');
  }
  const debugOverlay = flags['debugOverlay'];
  if (typeof debugOverlay !== 'boolean') {
    return invalid(
      'featureFlags.debugOverlay',
      '"featureFlags.debugOverlay" must be a boolean.',
    );
  }

  const palette = readPalette(raw);
  if (!palette.ok) return palette;

  return ok({
    title: title.value,
    version: version.value,
    defaultLocale: asLocaleCode(defaultLocale.value),
    designWidth: designWidth.value,
    designHeight: designHeight.value,
    backgroundColor: palette.value.sky,
    palette: palette.value,
    debugOverlay,
  });
}

/**
 * Linear per-channel blend between two `#rrggbb` colours, as a Phaser integer.
 *
 * The sky-to-ground gradient is drawn as horizontal bands rather than with
 * `Graphics.fillGradientStyle`, because that call is WebGL-only and would leave
 * a flat rectangle on the Canvas fallback path. Bands cost one fill each and the
 * whole background stays a single pass, which is what keeps the background's
 * share of the <= 4x overdraw budget at 1x (CLAUDE.md, Budgets).
 *
 * `position` is clamped to 0..1; a non-finite position resolves to `from`.
 */
export function mixColor(from: string, to: string, position: number): number {
  return blendColors(toPhaserColor(from), toPhaserColor(to), position);
}

/**
 * The same blend between two colours that are already Phaser integers.
 *
 * The land at the horizon is painted by mixing a shade of `palette.ground` back
 * into the sky-to-ground gradient it sits on, and both of those are computed
 * values rather than palette literals — so the mix has to take integers. Keeping
 * one implementation means the land and the sky cannot round differently and
 * leave a seam between them (`boot-scene.ts`, `#paintLand`).
 *
 * `position` is clamped to 0..1; a non-finite position resolves to `from`.
 */
export function blendColors(from: number, to: number, position: number): number {
  const t = Number.isFinite(position) ? Math.min(1, Math.max(0, position)) : 0;

  const channel = (shift: number): number => {
    const start = (from >> shift) & 0xff;
    const end = (to >> shift) & 0xff;
    return Math.round(start + (end - start) * t) & 0xff;
  };

  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
