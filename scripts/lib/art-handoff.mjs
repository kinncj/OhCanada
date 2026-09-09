/**
 * THE ANONYMISED HAND-OFF: rasterise the art, name it after nothing, and hide
 * the answer key from the thing that has to answer.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT
 *
 * This file builds images and hides names. It does NOT identify anything, and
 * `scripts/verify-art.mjs` deliberately contains no identifier. Naming what a
 * render depicts is the art-verifier's judgement; automating it would replace
 * the one measurement in this project that a machine cannot make. So the seam
 * is: a verdict comes IN, as data, and the harness scores it against the
 * contract in assets/refs/references.json.
 *
 * The harness therefore proves that a STATED VERDICT MATCHES A CONTRACT. It
 * does not prove that the verdict was made blind. Only the hand-off can give
 * that, and only if the hand-off holds: the identifier must be handed this
 * directory and nothing else, and must not go looking for the keymap. A harness
 * cannot stop a determined identifier from reading a sibling directory, and
 * pretending otherwise would be the same false comfort the first pass refused
 * to report.
 *
 * WHY IT EXISTS
 *
 * On 2026-09-08 the art-verifier ran the first blind identification pass by hand
 * and could not run it blind. To rasterise a render it first had to find one,
 * and the source directory's listing spells one subject out in a filename. The
 * subject was named before a single pixel was seen, so the identification was
 * CLOSED-SET, and every identification verdict in docs/art-verification.json is
 * marked untrusted for that reason. That was the
 * right call, and its conclusion is the specification for this file:
 *
 *     Any identifier that finds its own inputs sees their names. Anonymised
 *     hand-off must be done by a step the identifier does not run.
 *
 * And the property that makes it urgent rather than tidy: BLINDNESS LEAKS
 * SILENTLY. A run in which the identifier glimpsed a filename produces output
 * character-for-character identical to a clean one. There is no red mark to
 * look for afterwards. So the leak has to be made impossible at hand-off time
 * and asserted there, which is what `scanForLeaks` below does and what the gate
 * runs on every build whether or not anybody is identifying anything today.
 *
 * HOW THE NAMES ARE MADE OPAQUE
 *
 * `sha256(runSalt || pngBytes)` truncated to 16 hex characters. Two properties
 * matter and they are separate:
 *
 *   1. The name carries no semantic content. Asserted, not assumed: the name
 *      must match /^[0-9a-f]{16}\.png$/, AND no token drawn from the sources'
 *      filenames may appear in it. The regex is the stronger statement; the
 *      substring assertion is the one that was asked for and is the one that
 *      stays legible in a test.
 *   2. The name is UNLINKABLE ACROSS RUNS, because of the salt. A bare content
 *      hash would be stable, so an identifier that once saw the mapping — or
 *      that rasterises the sources itself and hashes them — could recover it
 *      next time. The salt is random per run unless `--seed` is passed, which
 *      exists so the tests can be deterministic and which a real run must not
 *      use.
 *
 * The write order is shuffled too. Emitting files in `references.json` order
 * would put the mapping back into the directory listing by way of mtime, which
 * is the same leak wearing a different hat.
 *
 * WHY LEAK SCANNING PARSES PNG CHUNKS RATHER THAN GREPPING BYTES
 *
 * The obvious implementation — search every byte of every handed-off file for
 * every token — is unusable, and measurably so. A four-character token matched
 * case-insensitively hits random compressed data with probability about
 * (2/256)^4 per offset; over ~60 tokens and a dozen images that is a coin-flip
 * chance of a spurious failure PER RUN. A gate that cries wolf every other
 * build gets disabled, and a disabled gate leaks silently, which is the exact
 * failure this file exists to prevent. So:
 *
 *   - text files handed over (the briefing, the answer template) are scanned in
 *     full, for every token; they are ours and there are no false positives.
 *   - PNGs are parsed as PNGs and REFUSED IF THEY CARRY ANY ancillary text chunk
 *     at all (tEXt/iTXt/zTXt). That is exact, not probabilistic, and it is
 *     strictly stronger than searching those chunks for known tokens.
 *   - the source SVGs are refused if they contain a `<text>` element, because a
 *     name DRAWN INTO the image survives every byte-level check ever written and
 *     no scan short of OCR can see it. Cheap to check, catches the one leak the
 *     rest of this design is blind to.
 *
 * WHY THE RECIPES ARE A TABLE HERE AND NOT PARSED FROM `renderRecipe`
 *
 * `renderRecipe` is prose written for a human draughtsman. It cannot be
 * executed. The table below implements one builder per subject and the gate
 * FAILS if `references.json` grows a subject with renders that this table does
 * not cover. Skipping an unknown subject would be the vacuum: art adds a
 * subject, the harness silently verifies four fifths of the set, and the output
 * looks exactly the same.
 */

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

import sharp from 'sharp';

export const KEYMAP_ID = 'truenorth-art-handoff-keymap';
export const KEYMAP_VERSION = 1;

/**
 * The neutral matte every render is flattened onto.
 *
 * Renders are transparent PNGs and a transparent PNG is shown on whatever the
 * viewer happens to use. White would swallow the constable's white lanyard and
 * the snow banks; black would swallow the navy. A mid grey is the one choice
 * that adds no semantic content of its own, and it is recorded in the keymap so
 * a verdict can be read against the conditions it was made under.
 */
const MATTE = { r: 204, g: 204, b: 204, alpha: 1 };

/** The size ladder from docs/art-verification-method.md, "Probes". */
const LADDER_WIDTHS = [300, 140];

const OPAQUE_NAME = /^[0-9a-f]{16}\.png$/;

/**
 * A private ancillary PNG chunk of N ZERO bytes, N drawn from the run salt.
 *
 * WHY: on the second real run the verifier found that FILE SIZE relinks what
 * content-addressed naming was meant to unlink. The same picture encodes to the
 * same number of bytes every time, so a run whose mapping was once revealed
 * hands that mapping to every later run, by size alone. The salt renames the
 * file and does nothing about its length.
 *
 * WHY ZEROS: the alternative was to vary the PNG compression level, which gives
 * about fourteen distinct sizes -- a one-in-fourteen chance per render that two
 * runs collide, which is not a property, it is a hope. This gives exact control.
 * And the padding is ALL ZEROS rather than random bytes on purpose: a chunk of
 * zeros provably carries no information, so it cannot become the metadata leak
 * that `scanForLeaks` refuses two functions below. The scanner checks that it is
 * zeros, so "provably" is asserted rather than asserted-in-a-comment.
 *
 * `paDx`: ancillary (p), private (a), reserved bit clear (D), safe to copy (x).
 * Every decoder skips it; sharp and every browser read the image unchanged.
 */
export const PAD_CHUNK = 'paDx';

function padPng(png, length) {
  const body = Buffer.alloc(length); // zeros
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(PAD_CHUNK, 4, 'ascii');
  body.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + length)), 8 + length);

  // Before IEND, which is the last 12 bytes of a well-formed PNG.
  const at = png.length - 12;
  return Buffer.concat([png.subarray(0, at), chunk, png.subarray(at)]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function loadContract({ root }) {
  const assets = join(root, 'assets');
  const references = readJson(join(assets, 'refs', 'references.json'));
  const rig = readJson(join(assets, 'style', 'rig-contract.json'));
  return { assets, references, rig };
}

/* ------------------------------------------------------------------ *
 * Determinism
 * ------------------------------------------------------------------ */

/** mulberry32, seeded from a string. Small, fast, and good enough to shuffle. */
function rngFrom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

function shuffle(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Rasterising
 * ------------------------------------------------------------------ */

/**
 * A `<text>` element in a source is a name drawn into the picture. It defeats
 * the hand-off in a way no byte scan can see, so it is refused at the source
 * rather than looked for in the output.
 */
function refuseDrawnText(svg, rel, failures) {
  if (/<text[\s>]/i.test(svg)) {
    failures.push(
      `${rel}: contains a <text> element. A render source may not draw text: the ` +
        `hand-off anonymises filenames and metadata, and a word painted into the ` +
        `image survives all of it.`,
    );
  }
}

/**
 * The path a logical render name resolves to on disk.
 *
 * `references.json` and `rig-contract.json` name the LOGICAL asset. A source may
 * pin itself to 1x by ending its name `@1x`, and scripts/assets.mjs STRIPS that
 * suffix when it forms the asset key -- "the pin is a suffix on a name, not a
 * name". So the two spellings are the same asset, and this resolves through the
 * project's own rule rather than failing every time art pins a source down.
 * Found the hard way: art pinned a landmark source `@1x` mid-slice and this gate
 * called the contract stale.
 *
 * `@2x` is deliberately NOT tried. assets.mjs makes it a hard error -- a source
 * may only pin itself DOWN -- and a resolver that accepted it here would be
 * quietly widening a rule another gate refuses.
 */
export function resolveSource(assets, rel) {
  const literal = join(assets, rel);
  if (existsSync(literal)) return { path: literal, rel };
  const pinned = rel.replace(/(\.[a-z0-9]+)$/i, '@1x$1');
  if (pinned !== rel && existsSync(join(assets, pinned))) {
    return { path: join(assets, pinned), rel: pinned };
  }
  return null;
}

async function rasterise(assets, rel, failures) {
  const found = resolveSource(assets, rel);
  if (!found) {
    failures.push(
      `${rel}: listed as a render source and does not exist (nor does its "@1x" pin)`,
    );
    return null;
  }
  const svg = readFileSync(found.path, 'utf8');
  refuseDrawnText(svg, found.rel, failures);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * One part of a composite, placed at its own window origin.
 *
 * Negative origins are cropped rather than clamped (the toque frame sits at
 * y = -1) and an overrun is a hard error: silently cropping a part that does not
 * fit would quietly change the picture the verdict is about.
 */
async function placement(buf, { x, y, w, mirrorX = false, canvasW, canvasH }) {
  let image = mirrorX ? await sharp(buf).flop().toBuffer() : buf;
  let left = mirrorX ? canvasW - x - w : x;
  let top = y;

  if (left < 0 || top < 0) {
    const meta = await sharp(image).metadata();
    const cropL = Math.max(0, -left);
    const cropT = Math.max(0, -top);
    image = await sharp(image)
      .extract({
        left: cropL,
        top: cropT,
        width: meta.width - cropL,
        height: meta.height - cropT,
      })
      .toBuffer();
    left = Math.max(0, left);
    top = Math.max(0, top);
  }

  const meta = await sharp(image).metadata();
  if (left + meta.width > canvasW || top + meta.height > canvasH) {
    throw new Error(
      `part at (${left},${top}) size ${meta.width}x${meta.height} overruns the ` +
        `${canvasW}x${canvasH} canvas`,
    );
  }
  return { input: image, left, top };
}

const canvas = (width, height) =>
  sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });

const flatten = (image) => image.flatten({ background: MATTE }).png({ palette: false }).toBuffer();

/**
 * Repeat a parallax tile across `width`.
 *
 * The layers a level composites are REPEATING tiles of different widths -- the
 * canal wall is 2016 px and the ice is 1440 -- and the level scrolls them, so
 * neither has a left or a right end. Laying them side by side at their natural
 * widths left a third of the ice band as bare matte, which is not a picture of
 * anything and is not what a player sees. Found by looking at the render, which
 * is the only way this kind of thing is ever found.
 */
async function tileTo(buf, width) {
  const meta = await sharp(buf).metadata();
  if (meta.width >= width) return buf;
  const copies = [];
  for (let left = 0; left < width; left += meta.width) {
    copies.push({ input: buf, left, top: 0 });
  }
  return canvas(width, meta.height)
    .composite(copies)
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------------ *
 * The recipes
 * ------------------------------------------------------------------ */

/**
 * One builder per subject id, because `renderRecipe` is prose. Each returns
 * `{ png, sources, slots }`. A subject in references.json with a non-empty
 * `renders` and no entry here FAILS the gate.
 */
/**
 * TWO SHAPES, NOT N COPIES.
 *
 * The table below is keyed by subject id because `renderRecipe` is prose and a
 * subject's decisions belong beside its id. What a builder DOES, though, is not
 * a property of the subject - it is a property of how many sources answer it and
 * how they stack. Quebec City arriving proved that: its two rendered subjects
 * are, in the art agent's own words in `references.json`, "the `peace-tower`
 * builder unchanged" and "the `rideau-canal-skateway` builder with two filename
 * matches changed". Copying both would have made the next level a third copy,
 * and the copies would drift.
 *
 * So the two shapes are factories and each entry names its shape and its
 * parameters. A new landmark is one line; a new two-tile composite is four. The
 * per-subject prose stays where it was, because that is the part that is
 * genuinely per subject.
 */

/** A single source, rasterised on its own at 1x, flattened onto the matte. */
const singleSource = () => async ({ assets, subject, failures }) => {
  const rel = subject.renders[0];
  const buf = await rasterise(assets, rel, failures);
  if (!buf) return null;
  return { png: await flatten(sharp(buf)), sources: [rel], slots: {} };
};

/**
 * Two repeating parallax tiles, the near one laid `nearTop` px below the far
 * one's top edge and drawn over it. Both are laid from x = 0 and REPEATED to the
 * wider of the two rather than laid side by side: they are tiles the level
 * scrolls, so repeating is what the player sees, and laying them side by side at
 * their natural widths leaves the narrower one's band as bare matte.
 *
 * `farMatch` / `nearMatch` are substrings of the render paths, so `renders[]`
 * can be listed in any order and a missing half is a named failure rather than
 * an undefined composite.
 */
const twoParallaxTiles = ({ farMatch, nearMatch, nearTop, what }) =>
  async ({ assets, subject, failures }) => {
    const farRel = subject.renders.find((r) => r.includes(farMatch));
    const nearRel = subject.renders.find((r) => r.includes(nearMatch));
    if (!farRel || !nearRel) {
      failures.push(`${subject.id}: renders[] must list ${what}`);
      return null;
    }
    const far = await rasterise(assets, farRel, failures);
    const near = await rasterise(assets, nearRel, failures);
    if (!far || !near) return null;

    const fm = await sharp(far).metadata();
    const nm = await sharp(near).metadata();
    const width = Math.max(fm.width, nm.width);
    const height = Math.max(fm.height, nearTop + nm.height);

    const png = await flatten(
      canvas(width, height).composite([
        { input: await tileTo(far, width), left: 0, top: 0 },
        { input: await tileTo(near, width), left: 0, top: nearTop },
      ]),
    );
    return { png, sources: [farRel, nearRel], slots: { nearTop } };
  };

const RECIPES = {
  /** A single source, rasterised on its own at 1x. */
  'peace-tower': singleSource(),

  /**
   * The POI hero for Quebec City, and the only source that carries the city's
   * identifying feature: `references.json` puts the riverfront tiles explicitly
   * out of scope because the low preset drops them and the art bible forbids an
   * identifying feature on a droppable layer.
   */
  'chateau-frontenac': singleSource(),

  /**
   * "Composite the two, canal wall above ice, ice placed 580 px below the wall's
   * top edge (world y 1280 against 700)."
   *
   * Two things the recipe does not state and this builder decides, recorded here
   * so a verdict is read against what was actually drawn:
   *   - x: both tiles are laid from x = 0 and REPEATED to the wider of the two
   *     (2016 and 1440). The recipe fixes only y. They are repeating parallax
   *     tiles that the level scrolls, so repeating is what the player sees;
   *     laying them side by side at their natural widths left a third of the ice
   *     band as bare matte, and centring the narrower one would only move the
   *     hole.
   *   - z: the nearer parallax layer draws over the further one, which is the
   *     order the level uses. They overlap by 60 px.
   */
  'rideau-canal-skateway': twoParallaxTiles({
    farMatch: 'canalwall',
    nearMatch: 'ice',
    nearTop: 580,
    what: 'a canal wall and an ice layer',
  }),

  /**
   * The same shape as the canal, with the same 580 px offset and the same
   * reason: world y 1280 against 700. Neither file answers the subject alone -
   * a run with no promenade is a snowy field, and a promenade with no run is a
   * fence - which is why the subject is the composite and not either tile.
   */
  'dufferin-terrace-toboggan-run': twoParallaxTiles({
    farMatch: 'terrace',
    nearMatch: 'slope',
    nearTop: 580,
    what: 'a terrace promenade and a toboggan slope',
  }),

  /**
   * "A CHARACTER IS NEVER JUDGED FROM ONE FILE." Every part is unidentifiable
   * alone — a sleeve is a red capsule — so the subject is the rig assembled.
   *
   * The recipe's other clause is the one with teeth: "The skin and hair choice
   * must be VARIED between runs - a subject that only ever renders with one tone
   * is a subject nobody checked the others of." So the slots are drawn from the
   * run salt, not fixed, and `--variants` emits more than one figure per run.
   * The chosen slots go in the keymap (which the identifier never reads), so the
   * scorer can say which figure a verdict was about.
   */
  officer: async ({ assets, rig, failures, rng, variantIndex, costume = 'serge' }) => {
    const slots = {
      costume,
      skin: pick(rng, rig.slots.skin.options),
      hairShape: pick(rng, rig.slots.hairShape.options),
      hairColour: pick(rng, rig.slots.hairColour.options),
      expression: pick(rng, rig.expressions.names),
      headCovering: 'none',
      feature: 'none',
    };
    const made = await composeFigure({ assets, rig, slots, failures });
    if (!made) return null;
    return { png: await flatten(sharp(made.png)), sources: made.sources, slots: { ...slots, variantIndex } };
  },
};

/**
 * One figure on one character-space canvas, from `rig-contract.json` alone.
 *
 * Everything this needs is in that file: `parts` in `z` order, `{brace}`
 * templates resolved against the slot choices, each part drawn at its own
 * viewBox origin, and the `mirrorX` parts flopped about the centre line. No
 * knowledge of the rig lives here that the contract does not state.
 */
async function composeFigure({ assets, rig, slots, failures }) {
  const { width, height } = rig.characterSpace;
  const parts = [...rig.parts].sort((a, b) => a.z - b.z);
  const layers = [];
  const sources = [];

  for (const part of parts) {
    const key = `${rig.atlas.framePrefix}${part.frame.replace(
      /\{(\w+)\}/g,
      (_, slot) => slots[slot] ?? `{${slot}}`,
    )}`;
    const frame = rig.frames[key];
    // atlas.rule: "A part whose resolved template is not in `frames` draws
    // nothing. That is how every `none` option works." Not an error.
    if (!frame) continue;
    const buf = await rasterise(assets, frame.source, failures);
    if (!buf) continue;
    sources.push(frame.source);
    layers.push(
      await placement(buf, {
        x: frame.x,
        y: frame.y,
        w: frame.w,
        mirrorX: part.mirrorX === true,
        canvasW: width,
        canvasH: height,
      }),
    );
  }

  if (layers.length === 0) {
    failures.push('the character rig resolved to zero parts');
    return null;
  }
  return { png: await canvas(width, height).composite(layers).png().toBuffer(), sources };
}

/**
 * THE COMPARISON FIGURE: two figures side by side on one canvas.
 *
 * One `mustBeRight` entry on the character subject is "cartoon proportions
 * identical to every other character", and a hand-off holding a single figure
 * CANNOT ANSWER IT. On the first run through this harness it was scored present
 * anyway -- confirmed from `rig-contract.json` rather than from the picture,
 * which the verifier itself called "a code-level check wearing an art verifier's
 * clothes". That is a right answer arrived at by accident, and the contract now
 * says so: the entry carries `requiresComparisonFigure` and the recipe requires
 * two figures built the same way.
 *
 * The two differ in SKIN, HAIR SHAPE, HAIR COLOUR AND EXPRESSION as well as
 * costume, drawn without replacement so they really are different. That is the
 * point: if everything varies except the proportions and the proportions still
 * match, the entry is answered visually, in the way the rule intends. Two
 * figures identical but for costume would prove far less.
 *
 * Which side the subject stands on is drawn from the run salt, so an identifier
 * cannot learn "the left one is the answer" across runs.
 */
const COMPARISONS = {
  officer: async ({ assets, rig, failures, rng }) => {
    const other = (list, taken) => {
      const rest = list.filter((option) => option !== taken);
      return rest.length > 0 ? pick(rng, rest) : taken;
    };
    const a = {
      costume: 'serge',
      skin: pick(rng, rig.slots.skin.options),
      hairShape: pick(rng, rig.slots.hairShape.options),
      hairColour: pick(rng, rig.slots.hairColour.options),
      expression: pick(rng, rig.expressions.names),
      headCovering: 'none',
      feature: 'none',
    };
    const b = {
      costume: rig.slots.costume?.options?.find((o) => o !== 'serge') ?? 'parka',
      skin: other(rig.slots.skin.options, a.skin),
      hairShape: other(rig.slots.hairShape.options, a.hairShape),
      hairColour: other(rig.slots.hairColour.options, a.hairColour),
      expression: other(rig.expressions.names, a.expression),
      headCovering: 'none',
      feature: 'none',
    };

    const left = rng() < 0.5;
    const subjectFirst = left;
    const [first, second] = subjectFirst ? [a, b] : [b, a];
    const one = await composeFigure({ assets, rig, slots: first, failures });
    const two = await composeFigure({ assets, rig, slots: second, failures });
    if (!one || !two) return null;

    const { width, height } = rig.characterSpace;
    return {
      png: await flatten(
        canvas(width * 2, height).composite([
          { input: one.png, left: 0, top: 0 },
          { input: two.png, left: width, top: 0 },
        ]),
      ),
      sources: [...new Set([...one.sources, ...two.sources])],
      slots: { subjectSide: subjectFirst ? 'left' : 'right', subject: a, comparison: b },
    };
  },
};

/* ------------------------------------------------------------------ *
 * Probes
 * ------------------------------------------------------------------ */

/**
 * The masked-feature probe, and an honest note about what is possible today.
 *
 * The first pass found the single most informative result in the whole report:
 * masking the flag dropped identification from about 90% to about 65%, and on a
 * tower crop with the flag masked it failed outright — "a Big Ben-like Gothic
 * clock tower". A subject can pass on one strong feature, and a single
 * whole-image pass cannot tell you that.
 *
 * Masking a FEATURE needs to know where that feature is, and that is knowledge
 * only the drawing has. `references.json` carries no geometry for it, and
 * assets/** is the art agent's boundary, so this harness cannot add the field.
 * What it does instead:
 *
 *   - the mechanism is implemented and tested. If a `mustBeRight` entry grows a
 *     `maskRegion: { x, y, w, h }` in the render's own pixel space, this emits an
 *     extra probe with that rectangle filled with the matte. Fixture-proved in
 *     tests/unit/infra; dormant on today's references.json, where no entry has
 *     one. Adding the field is art's call and is a one-line change per feature.
 *   - the SIZE LADDER, which needs no semantic knowledge, is emitted always.
 *
 * DERIVED PROBES ARE DIAGNOSTIC, NEVER GATING. Failing to identify a 140 px
 * thumbnail, or a render with its strongest cue painted out, is information
 * about which cues carry the recognition. It is not an art defect, and the
 * verifier's own report treats it that way. Only the `full` probe decides
 * whether a subject's identification passes.
 */
/*
 * A SHARP ORDERING TRAP, AND WHY EVERY STAGE BELOW ENDS IN `.toBuffer()`.
 *
 * `sharp(x).composite([...]).extract({...})` in ONE CHAINED PIPELINE applies
 * `extract` BEFORE `composite`. The crop wins, the mask is laid on afterwards or
 * not at all, and what comes out is an UNMASKED image that looks entirely
 * correct. Verified by the art agent, which caught it only by counting matte
 * pixels.
 *
 * Read what that costs here, because it is the worst failure this whole
 * apparatus can have: a masked-feature probe that renders UNMASKED. The verifier
 * is shown the cue it was supposed to be blind to, identifies the subject
 * easily, reports high confidence, and the harness records a pass. Silent green,
 * with the evidence pointing the wrong way. Everything else in this file exists
 * to stop exactly that.
 *
 * The code below is safe because each stage is BUFFERED before the next begins.
 * IF A CROP-PLUS-MASK PROBE IS EVER ADDED -- and it should be; the first hand
 * pass found that a tower crop with the flag masked failed identification
 * outright, which is the most informative single result anyone has got out of
 * this art -- IT MUST BE TWO PIPELINES:
 *
 *     const masked = await sharp(base).composite([patch]).png().toBuffer();
 *     const crop   = await sharp(masked).extract(region).png().toBuffer();
 *
 * and never one chain. Chaining them reads correctly, runs without error, and
 * produces the wrong picture.
 */
async function probesFor({ subjectId, base, sizeLadder, masks }) {
  const probes = [{ probe: 'full', gating: true, png: base }];
  const meta = await sharp(base).metadata();

  if (sizeLadder) {
    for (const width of LADDER_WIDTHS) {
      if (width >= meta.width) continue;
      probes.push({
        probe: `w${width}`,
        gating: false,
        png: await sharp(base).resize({ width }).png().toBuffer(),
      });
    }
  }

  for (const { feature, region } of masks) {
    const { x, y, w, h } = region;
    if (x < 0 || y < 0 || x + w > meta.width || y + h > meta.height) {
      throw new Error(
        `${subjectId}: maskRegion for "${feature}" falls outside the ${meta.width}x${meta.height} render`,
      );
    }
    const patch = await canvas(w, h).flatten({ background: MATTE }).png().toBuffer();
    probes.push({
      probe: `mask:${feature}`,
      gating: false,
      png: await sharp(base)
        .composite([{ input: patch, left: x, top: y }])
        .png()
        .toBuffer(),
    });
  }
  return probes;
}

/* ------------------------------------------------------------------ *
 * Contract checks
 * ------------------------------------------------------------------ */

/**
 * The things about `references.json` that can be checked mechanically, and the
 * ANTI-VACUUM FLOOR. "Measured nothing" is not "everything passed": zero
 * subjects fails, and so does a set in which nothing is renderable, because a
 * hand-off of no images scores a clean sweep of no verdicts and prints OK.
 */
export function checkContract({ references, failures }) {
  const subjects = Array.isArray(references.subjects) ? references.subjects : [];

  if (subjects.length === 0) {
    failures.push(
      'references.json declares zero subjects. ANTI-VACUUM FLOOR: an empty ' +
        'contract is a failure, not a pass — there is nothing to be blind about.',
    );
    return { renderable: [], unrendered: [] };
  }

  const renderable = [];
  const unrendered = [];
  const ids = new Set();

  for (const subject of subjects) {
    const id = subject.id;
    if (!id) {
      failures.push('a subject has no `id`');
      continue;
    }
    if (ids.has(id)) failures.push(`${id}: duplicate subject id`);
    ids.add(id);

    if (!Array.isArray(subject.expectedBlindAnswer) || subject.expectedBlindAnswer.length === 0) {
      failures.push(`${id}: no \`expectedBlindAnswer\`, so no identification can be scored`);
    }
    if (!Array.isArray(subject.mustBeRight) || subject.mustBeRight.length === 0) {
      failures.push(`${id}: no \`mustBeRight\`, so a feature audit would pass over nothing`);
    }

    // ABSENT `renders` IS A DEFECT; AN EMPTY `renders` IS A DECISION.
    // One subject in today's set is unrendered on purpose: its only candidate
    // source is a droppable repeating parallax tile, and the art bible forbids
    // putting an identifying feature on one, so a verifier able to name the
    // place from it would be reporting a defect rather than a pass. That has to
    // be expressible
    // as NEITHER a pass NOR a failure, and `renders: []` plus a recipe saying why
    // is how it is said. A subject that simply omits the field is a subject
    // nobody decided about, and that does fail.
    if (!Array.isArray(subject.renders)) {
      failures.push(
        `${id}: no \`renders\` array. A subject must either list its renders or ` +
          `declare \`renders: []\` and say why in \`renderRecipe\`. An absent field ` +
          `is undecided, which is not the same as unrendered on purpose.`,
      );
      continue;
    }
    if (typeof subject.renderRecipe !== 'string' || subject.renderRecipe.trim() === '') {
      failures.push(`${id}: no \`renderRecipe\``);
      continue;
    }

    if (subject.renders.length === 0) {
      unrendered.push({ subjectId: id, why: subject.renderRecipe });
      continue;
    }
    if (!RECIPES[id]) {
      failures.push(
        `${id}: has renders and this harness has no builder for it. ` +
          `scripts/lib/art-handoff.mjs RECIPES needs one. Skipping an unknown ` +
          `subject would verify four fifths of the set and print the same OK.`,
      );
      continue;
    }
    renderable.push(subject);
  }

  // A contradiction across subjects is what makes a literal verifier fail a
  // render for drawing a required feature (AV-02). It was resolved by scoping
  // the prohibition; this keeps it resolved.
  const required = new Map();
  for (const subject of subjects) {
    for (const entry of subject.mustBeRight ?? []) {
      if (entry?.feature) required.set(normalise(entry.feature), subject.id);
    }
  }
  for (const subject of subjects) {
    for (const forbidden of subject.neverAdd ?? []) {
      const owner = required.get(normalise(forbidden));
      if (owner && owner !== subject.id) {
        failures.push(
          `${subject.id}: neverAdd "${forbidden}" is word-for-word a mustBeRight ` +
            `feature of ${owner}. A prohibition on one subject may not forbid a ` +
            `requirement of another; scope it in its own text.`,
        );
      }
    }
  }

  if (renderable.length === 0) {
    failures.push(
      'no subject in references.json is renderable. ANTI-VACUUM FLOOR: a hand-off ' +
        'of zero images scores a clean sweep of zero verdicts and reports success.',
    );
  }

  return { renderable, unrendered };
}

export const normalise = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* ------------------------------------------------------------------ *
 * Leak scanning
 * ------------------------------------------------------------------ */

/**
 * Every string that, if it reached the identifier, would turn an open-set
 * identification into the closed-set one that invalidated the first pass.
 */
export function leakTokens({ references }) {
  const phrases = new Set();
  const words = new Set();

  // WHOLE STRINGS, for anything that identifies a subject. Multi-word and
  // hyphenated strings do not occur in ordinary prose, so this half can be as
  // broad as it likes without ever firing on a briefing written in English.
  const phrase = (value) => {
    const token = String(value).trim().toLowerCase();
    if (token.length >= 4) phrases.add(token);
  };

  // SINGLE WORDS, only out of `id` and `expectedBlindAnswer` -- the answers
  // themselves. NOT out of `subject` prose or `mustBeRight` text, which was the
  // first implementation and which flagged "from", "with" and "every" in the
  // briefing on the first run. A leak scan that fires on ordinary English gets
  // switched off, and a switched-off scan leaks silently, which is the failure
  // this whole file exists to prevent. Every distinctive word in a render's
  // FILENAME is also a word of some `expectedBlindAnswer` -- parliament, hill,
  // ottawa, canal -- so narrowing to the answers costs nothing real, while
  // "hand" (from `hand-serge.svg`) stops being a forbidden word.
  const word = (value) => {
    for (const part of normalise(value).split(' ')) {
      if (part.length >= 4) words.add(part);
    }
  };

  for (const subject of references.subjects ?? []) {
    phrase(subject.id ?? '');
    word(subject.id ?? '');
    phrase(subject.subject ?? '');
    for (const answer of subject.expectedBlindAnswer ?? []) {
      phrase(answer);
      word(answer);
    }
    for (const rel of subject.renders ?? []) {
      phrase(rel);
      for (const segment of rel.split('/')) {
        phrase(segment);
        phrase(segment.replace(/(@\dx)?\.[a-z0-9]+$/i, ''));
      }
    }
    for (const rel of subject.referenceFiles ?? []) {
      phrase(rel);
      phrase(basename(rel).replace(/\.[a-z0-9]+$/i, ''));
    }
    for (const entry of subject.mustBeRight ?? []) phrase(entry?.feature ?? '');
  }

  const tokens = new Set([...phrases, ...words]);
  tokens.delete('');
  return [...tokens];
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TEXT_CHUNKS = new Set(['tEXt', 'iTXt', 'zTXt']);

/**
 * What a PNG carries besides pixels. Exact; no guessing.
 *
 * `text` is any tEXt/iTXt/zTXt, which is a filename that survived rasterisation
 * and is refused outright. `padNonZero` checks the one chunk this pipeline adds
 * on purpose: the `paDx` length padding that breaks the file-size side channel.
 * The padding is only defensible if it provably carries nothing, so its
 * zero-ness is CHECKED rather than asserted in a comment above the code that
 * writes it.
 */
function pngChunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  const text = [];
  let padNonZero = false;
  let at = 8;
  while (at + 8 <= buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    if (TEXT_CHUNKS.has(type)) text.push(type);
    if (type === PAD_CHUNK) {
      for (const byte of buf.subarray(at + 8, at + 8 + length)) {
        if (byte !== 0) {
          padNonZero = true;
          break;
        }
      }
    }
    if (type === 'IEND') break;
    at += 12 + length;
  }
  return { text, padNonZero };
}

/**
 * The assertion that the anonymisation anonymises. Runs on every gate, not only
 * when somebody is identifying something — a leak that appears on a Tuesday and
 * is noticed at the next hand-off is a leak that has already happened.
 */
/**
 * How many files the surrounding working area may hold before this refuses to
 * vouch for it. A hand-off directory shares its parent with a keymap and,
 * usually, an answers file; two hundred is far past that and far short of a
 * directory nobody should be pointing `--out` at. Hitting it is a FAILURE and
 * not a truncation: a scan that silently stopped early would report exactly
 * what a clean area reports.
 */
const WORKING_AREA_FILE_CAP = 200;

/**
 * Directories that are never a previous run's artefacts and are always
 * enormous. Skipped by name, and the cap above catches anything else.
 */
const WORKING_AREA_SKIP = new Set(['node_modules', '.git', 'handoff']);

export function scanForLeaks({ handoffDir, keymapPath, tokens, workingArea = null }) {
  const failures = [];
  const dir = resolve(handoffDir);
  const keymap = resolve(keymapPath);

  if (keymap === dir || keymap.startsWith(dir + sep)) {
    failures.push(
      `the keymap is inside the identifier's working directory (${relative(dir, keymap)}). ` +
        `It must be written by a step the identifier does not run, to somewhere the ` +
        `identifier is not handed.`,
    );
  }

  const lowered = tokens.map((t) => t.toLowerCase());

  for (const path of walk(dir)) {
    const name = basename(path);
    const buf = readFileSync(path);
    const chunks = pngChunks(buf);

    if (chunks !== null) {
      // A render.
      if (!OPAQUE_NAME.test(name)) {
        failures.push(`${name}: not an opaque render name (expected 16 hex characters + .png)`);
      }
      for (const token of lowered) {
        if (name.toLowerCase().includes(token)) {
          failures.push(`${name}: the render's own name contains "${token}"`);
        }
      }
      if (chunks.text.length > 0) {
        failures.push(
          `${name}: carries PNG text chunk(s) ${chunks.text.join(', ')}. A render is handed ` +
            `over as pixels; metadata is a filename that survived.`,
        );
      }
      if (chunks.padNonZero) {
        failures.push(
          `${name}: its ${PAD_CHUNK} length padding is not all zeros. The padding exists ` +
            `to break the file-size side channel and is only harmless while it says nothing.`,
        );
      }
      continue;
    }

    // Anything else handed over is text we wrote, and is scanned in full.
    const text = buf.toString('utf8').toLowerCase();
    for (const token of lowered) {
      if (text.includes(token)) {
        failures.push(`${relative(dir, path)}: contains the leaking token "${token}"`);
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * The area AROUND the hand-off, when the operator named one
   * ---------------------------------------------------------------- */
  /*
   * A hand-off that is clean in itself is not a blind hand-off if the previous
   * run's answers are sitting next to it. That is not hypothetical: an
   * `audit.json` from an earlier run - which names every subject and every
   * `mustBeRight` feature verbatim, because it is written AFTER reveal - stayed
   * in the session scratchpad and was readable throughout a later run's blind
   * phase. The scratchpad is the directory agents are TOLD to use for working
   * files, so an identifier following its own instructions is one `cat` from
   * the answers.
   *
   * `scoreRun` refuses a stale audit by run id, which is right at score time
   * and is no protection at identify time. What kept that run honest was the
   * verifier not opening the file and checking timestamps to prove it, and
   * discipline is not a control.
   *
   * REFUSED, NOT SWEPT. Deleting the file automatically would destroy a
   * previous verification's evidence to make the next one convenient, so this
   * names what to move and stops. And it only runs when the operator passed
   * `--out`: the gate builds into a fresh mkdtemp whose parent is the system
   * temp directory, which is not a working area and must never be walked.
   */
  if (workingArea !== null) {
    const area = resolve(workingArea);
    const seen = [];
    const collect = (from, depth) => {
      if (seen.length > WORKING_AREA_FILE_CAP || depth > 4) return;
      for (const entry of existsSync(from) ? readdirSync(from, { withFileTypes: true }) : []) {
        const full = join(from, entry.name);
        if (entry.isDirectory()) {
          if (WORKING_AREA_SKIP.has(entry.name) || full === dir) continue;
          collect(full, depth + 1);
          continue;
        }
        if (!entry.isFile() || full === keymap) continue;
        seen.push(full);
        if (seen.length > WORKING_AREA_FILE_CAP) return;
      }
    };
    collect(area, 0);

    if (seen.length > WORKING_AREA_FILE_CAP) {
      failures.push(
        `the working area ${area} holds more than ${String(WORKING_AREA_FILE_CAP)} file(s), so ` +
          `this cannot check that none of them names an answer. Point --out at a directory used ` +
          `for this hand-off and nothing else. Reporting a partial scan as a clean one is how a ` +
          `leak check becomes decorative.`,
      );
    }

    for (const path of seen) {
      const text = readFileSync(path).toString('utf8').toLowerCase();
      const name = basename(path).toLowerCase();
      for (const token of lowered) {
        if (text.includes(token) || name.includes(token)) {
          failures.push(
            `${relative(area, path)} is in the identifier's working area and names "${token}". ` +
              `An earlier run's output must not be reachable during a later run's blind phase - ` +
              `an audit file names every subject and every mustBeRight feature, because it is ` +
              `written after reveal. Move it somewhere this run does not hand over, then build ` +
              `the hand-off again. It is not deleted for you: it is a previous verification's ` +
              `evidence.`,
          );
          break;
        }
      }
    }
  }

  return failures;
}

/* ------------------------------------------------------------------ *
 * Building the hand-off
 * ------------------------------------------------------------------ */

/**
 * Deliberately says nothing about what is in the pictures, what the candidate
 * answers are, or how many distinct subjects there are. Every word here is
 * scanned against the leak tokens, so it cannot drift into naming one.
 */
const BRIEFING = `You have been handed a directory of images and nothing else.

Do not go looking for where they came from. Reading the source tree, the
contract they are judged against, or the keymap turns this from an open
question into a multiple-choice one, and the result is then worth much less
than it appears to be -- which is the failure this hand-off exists to prevent.

For EVERY image in answers.json, before you read anything else, write:
  answer      - what it is, as specifically as you can honestly be. If you
                believe it is a real, named place or thing, name it.
  cues        - what in the image made you say that, most important first.
  confidence  - 0 to 1.
  moreCertain - what would have made you more certain.

Save the completed answers.json and hand it back. Do not edit it afterwards:
its hash is recorded when you hand it over, and the score step re-checks it.

Some images are the same picture at a smaller size, or with part of it painted
over. Answer each on its own terms. "I cannot tell" is a real answer and is
more useful than a guess said firmly.
`;

export async function buildHandoff({
  root,
  handoffDir,
  keymapPath,
  seed = null,
  variants = 2,
  sizeLadder = true,
  force = false,
  workingArea = null,
}) {
  const failures = [];
  const { assets, references, rig } = loadContract({ root });
  const { renderable, unrendered } = checkContract({ references, failures });

  const salt = seed ?? randomBytes(16).toString('hex');
  const rng = rngFrom(salt);
  const runId = createHash('sha256').update(`run:${salt}`).digest('hex').slice(0, 16);

  const built = [];
  for (const subject of renderable) {
    const copies = subject.id === 'officer' ? Math.max(1, variants) : 1;

    // The comparison figure, when the contract says a feature needs one. Keyed
    // like RECIPES and for the same reason: a subject that asks for one and has
    // no builder FAILS, rather than quietly handing over a picture that cannot
    // answer the entry it was added for.
    const needsComparison = (subject.mustBeRight ?? []).some((f) => f?.requiresComparisonFigure);
    if (needsComparison) {
      if (!COMPARISONS[subject.id]) {
        failures.push(
          `${subject.id}: a mustBeRight entry sets \`requiresComparisonFigure\` and this ` +
            `harness has no comparison builder for it. Without the figure the entry ` +
            `cannot be checked, and scoring it present would record a right answer by accident.`,
        );
      } else {
        const pair = await COMPARISONS[subject.id]({ assets, rig, subject, failures, rng });
        if (pair) {
          built.push({
            subjectId: subject.id,
            probe: 'comparison',
            gating: false,
            png: pair.png,
            sources: pair.sources,
            slots: pair.slots,
          });
        }
      }
    }

    for (let variantIndex = 0; variantIndex < copies; variantIndex += 1) {
      const made = await RECIPES[subject.id]({ assets, rig, subject, failures, rng, variantIndex });
      if (!made) continue;

      const masks = (subject.mustBeRight ?? [])
        .filter((entry) => entry?.maskRegion)
        .map((entry) => ({ feature: entry.feature, region: entry.maskRegion }));

      for (const probe of await probesFor({
        subjectId: subject.id,
        base: made.png,
        sizeLadder,
        masks,
      })) {
        built.push({
          subjectId: subject.id,
          probe: probe.probe,
          gating: probe.gating,
          png: probe.png,
          sources: made.sources,
          slots: made.slots,
        });
      }
    }
  }

  // Shuffled so the directory listing, and every mtime in it, is in an order
  // that says nothing about references.json.
  const ordered = shuffle(rng, built);

  // A STALE OUTPUT DIRECTORY IS A LEAK, and it is the one the second real run
  // was caught by: `handoff` wrote ten renders into a directory that still held
  // the previous run's ten, six of which had byte-identical sizes. Content
  // addressing had unlinked the names and file length quietly relinked them.
  //
  // REFUSE rather than clear, by default. A stale hand-off may hold a blind pass
  // somebody has not committed yet, and deleting a directory the caller named is
  // not a thing to do silently. `--force` clears it, and says so.
  if (existsSync(handoffDir)) {
    const stale = readdirSync(handoffDir);
    if (stale.length > 0) {
      if (!force) {
        failures.push(
          `${handoffDir} already holds ${stale.length} file(s). A hand-off must not be ` +
            `written beside an older one: two runs side by side relink by file size and ` +
            `by count what the salt renamed. Use an empty directory, or --force to clear ` +
            `this one -- but not if it holds a blind pass that was never committed.`,
        );
        return { keymap: null, failures, runId };
      }
      rmSync(handoffDir, { recursive: true, force: true });
    }
  }
  mkdirSync(handoffDir, { recursive: true });
  mkdirSync(resolve(keymapPath, '..'), { recursive: true });

  /* ------------------------------------------------------------------ *
   * ONE CANVAS SIZE FOR THE WHOLE RUN
   * ------------------------------------------------------------------ */
  /*
   * PIXEL DIMENSIONS WERE A SIDE CHANNEL, and a sharper one than file size.
   * Order was shuffled and byte length was padded, but the sizes partitioned
   * the set into subject-pure classes: 240x470 appeared exactly four times, all
   * the same subject; 140x274 twice, same subject; 300x170 and 140x79 twice
   * each, one per composite. An identifier could link every ladder rung to its
   * full-size render WITHOUT OPENING EITHER, straight out of answers.json.
   *
   * Jitter does not fix it. Any padding that preserves approximate scale leaves
   * the classes clustered, and clustering is all the linkage needs. So every
   * render is composited onto the SAME canvas, matte-filled, at the largest
   * width and height in the run: the dimensions become a constant and carry no
   * information at all, in answers.json or in the PNG header.
   *
   * WHAT THIS DOES NOT FIX, stated because a fix that is read as bigger than it
   * is, is worse than none. The drawing's own extent is still measurable by
   * anyone who OPENS the image and looks at where the matte stops. That is the
   * bar this raises it to and no higher. And it does nothing about the limit the
   * verifier established and then respected: a ladder cannot measure
   * recognition at its bottom rung once the top rung has been shown to the same
   * identifier. That is a hand-off SHAPE question - the small renders need to
   * reach someone who has not seen the large one - and it needs a decision, not
   * a padding change.
   */
  const natural = await Promise.all(
    ordered.map(async (item) => {
      const meta = await sharp(item.png).metadata();
      return { width: meta.width, height: meta.height };
    }),
  );
  const canvasWidth = Math.max(...natural.map((n) => n.width));
  const canvasHeight = Math.max(...natural.map((n) => n.height));

  const entries = [];
  const seen = new Set();
  for (const [index, item] of ordered.entries()) {
    const uniform = await flatten(
      canvas(canvasWidth, canvasHeight).composite([
        {
          input: item.png,
          left: Math.floor((canvasWidth - natural[index].width) / 2),
          top: Math.floor((canvasHeight - natural[index].height) / 2),
        },
      ]),
    );
    // Padded BEFORE naming, so the name is the hash of the bytes that are
    // written and the two cannot drift apart.
    const png = padPng(uniform, Math.floor(rng() * 4096));
    const meta = await sharp(png).metadata();
    const name = `${createHash('sha256')
      .update(salt)
      .update(png)
      .digest('hex')
      .slice(0, 16)}.png`;
    if (seen.has(name)) {
      failures.push(
        `two renders hashed to the same opaque name (${name}); they are byte-identical ` +
          `and one verdict would answer both`,
      );
      continue;
    }
    seen.add(name);
    writeFileSync(join(handoffDir, name), png);
    entries.push({
      render: name,
      subjectId: item.subjectId,
      probe: item.probe,
      gating: item.gating,
      // What was handed over: the uniform canvas, identical for every render in
      // the run, which is what answers.json shows and what the PNG header says.
      width: meta.width,
      height: meta.height,
      // What was DRAWN, before the canvas was padded round it. The keymap is
      // never handed to the identifier, so recording the natural extent here
      // costs nothing and keeps the size ladder meaningful: it is the only
      // remaining record of which rung a render is.
      naturalWidth: natural[index].width,
      naturalHeight: natural[index].height,
      bytes: png.length,
      matte: MATTE,
      sources: item.sources,
      slots: item.slots,
      sha256: createHash('sha256').update(png).digest('hex'),
    });
  }

  writeFileSync(join(handoffDir, 'READ-ME-FIRST.txt'), BRIEFING);
  writeFileSync(
    join(handoffDir, 'answers.json'),
    `${JSON.stringify(
      {
        runId,
        identifications: entries.map((entry) => ({
          render: entry.render,
          width: entry.width,
          height: entry.height,
          answer: '',
          cues: '',
          confidence: null,
          moreCertain: '',
        })),
      },
      null,
      2,
    )}\n`,
  );

  const keymap = {
    id: KEYMAP_ID,
    version: KEYMAP_VERSION,
    runId,
    createdAt: new Date().toISOString(),
    seeded: seed !== null,
    handoffDir: resolve(handoffDir),
    entries,
    unrendered,
    committedAnswersSha256: null,
    revealedAt: null,
  };
  writeFileSync(keymapPath, `${JSON.stringify(keymap, null, 2)}\n`, { mode: 0o600 });

  failures.push(
    ...scanForLeaks({ handoffDir, keymapPath, tokens: leakTokens({ references }), workingArea }),
  );

  return { keymap, failures, runId };
}

export const sha256Of = (value) => createHash('sha256').update(value).digest('hex');

export const readKeymap = (path) => {
  const keymap = readJson(path);
  if (keymap.id !== KEYMAP_ID) throw new Error(`${path}: not an art hand-off keymap`);
  if (keymap.version !== KEYMAP_VERSION) {
    throw new Error(`${path}: keymap version ${keymap.version}, expected ${KEYMAP_VERSION}`);
  }
  return keymap;
};
