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
/**
 * NOT BUMPED when entries gained `sourceSha256`, deliberately. A version wall
 * would refuse a v1 keymap with "keymap version 1, expected 2", and the useful
 * thing to say about a keymap that carries no source digests is the thing
 * `scoreRun` already says: the record cannot be shown to describe today's art,
 * so it is STALE and must be re-made. The field is additive and its ABSENCE has
 * a defined, safe meaning, which is what makes the wall unnecessary. Bump this
 * when an old keymap would be MISREAD, not when it is merely older.
 */
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

/**
 * The size ladder from docs/art-verification-method.md, "Probes".
 *
 * A LANDMARK'S LADDER. These are ABSOLUTE WIDTHS, derived on 1800 px parallax
 * tiles, and a builder may supply its own rungs instead (`sizeProbes`) when its
 * subject is not a landmark. See `onScreenProbe`, which is where the reason is
 * written down and where the measurement that forced it is quoted.
 */
const LADDER_WIDTHS = [300, 140];

const OPAQUE_NAME = /^[0-9a-f]{16}\.png$/;

/**
 * A private ancillary PNG chunk of ZERO bytes, enough of them that EVERY RENDER
 * IN THE RUN IS EXACTLY THE SAME NUMBER OF BYTES.
 *
 * WHY THERE IS PADDING AT ALL: on the second real run the verifier found that
 * FILE SIZE relinks what content-addressed naming was meant to unlink. The same
 * picture encodes to the same number of bytes every time, so a run whose mapping
 * was once revealed hands that mapping to every later run, by size alone. The
 * salt renames the file and does nothing about its length.
 *
 * WHY THE LENGTH IS A CONSTANT AND NOT A RANDOM DRAW, which is what it was until
 * this was measured. The pad used to be `Math.floor(rng() * 4096)` zero bytes,
 * and the property claimed for it was "the same picture is a different length in
 * the next run". That is not the property that matters and it was not even true:
 *
 *   - 4096 possible lengths over 113 comparable renders gives a 2.7% chance PER
 *     SEED PAIR that some render is the same length twice, and the gate asserted
 *     it never happens. It grew a deterministic failure the day the contract
 *     reached 113 renders, and it would have grown one eventually whatever the
 *     range was.
 *   - and exact equality was the wrong question. Two runs agreeing on one length
 *     out of 113 is the HARMLESS case: an identifier holding that number cannot
 *     tell which of the 113 it belongs to. What leaks is SEPARATION. A render is
 *     relinked when no other render's possible-length interval overlaps its own,
 *     and the interval was 4096 bytes wide on files of 57 KB to 238 KB.
 *
 * Measured on this repository at 118 renders, jittered: 5 of 113 comparable
 * renders (4.4%) had a UNIQUE candidate across the two seeds -- relinked with
 * certainty, from `ls -l` -- and guessing by nearest size was right 14.2% of the
 * time against a 0.8% chance rate, an eighteen-fold lift. The channel the pad
 * was added to close was open on every render more than 4 KB from its nearest
 * neighbour, which is most of the biggest ones.
 *
 * Widening the jitter is not the fix: making the intervals overlap everywhere
 * needs a range of about 113 000 000 bytes, a hundred megabytes per render. The
 * fix is the move this run ALREADY MAKES FOR PIXEL DIMENSIONS one screen down --
 * every render onto one canvas, so the number is a constant and carries no
 * information at all. Same argument, same shape: CONSTANTS BEAT JITTER, because
 * a constant has no distribution to be unlucky in. Every render is padded up to
 * the largest render in the run, so file length partitions nothing, relinks
 * nothing across runs, and needs no probability to describe.
 *
 * WHAT IT COSTS, stated because it is not free: at 118 renders the hand-off goes
 * from 9.8 MB to 28.1 MB, and `make verify-art`'s own 128-render build from
 * 10.6 MB to 30.5 MB -- 2.9x, which is what the largest render is over the mean.
 * That is zeros in a temporary directory and not payload, and it buys the only
 * version of this property that IS a property. If it ever has to come down, the
 * lever is the spread of the encoded sizes, not the pad: nothing narrower than
 * one length closes the channel for the renders at the ends of the range.
 *
 * WHAT IT DOES NOT FIX: the drawing's own extent is still measurable by anyone
 * who OPENS a render and looks at where the matte stops, exactly as the canvas
 * comment says. This closes the channel that is readable WITHOUT opening the
 * file, and no more.
 *
 * WHY ZEROS: the padding is all zeros rather than random bytes on purpose -- a
 * chunk of zeros provably carries no information, so it cannot become the
 * metadata leak that `scanForLeaks` refuses two functions below. The scanner
 * checks that it is zeros AND that every render is the same length, so both
 * halves are asserted rather than asserted-in-a-comment.
 *
 * `paDx`: ancillary (p), private (a), reserved bit clear (D), safe to copy (x).
 * Every decoder skips it; sharp and every browser read the image unchanged.
 */
export const PAD_CHUNK = 'paDx';

/**
 * The smallest pad any render carries, on top of the 12-byte chunk header.
 *
 * The largest render in the run would otherwise be padded with nothing, and a
 * zero-length `paDx` is a chunk the scanner can see but cannot check -- there
 * are no bytes in it to prove are zeros. Cheap insurance that every render in
 * the hand-off is carrying a pad the scan can actually read.
 */
const MIN_PAD = 64;

/**
 * The one length every render in a run is padded to, from the encoded lengths.
 *
 * `+ 12` is the chunk header `padPng` writes around the zeros, so the longest
 * render still clears its own encoded size by `MIN_PAD` bytes of pad.
 */
const uniformByteLength = (encodedLengths) => Math.max(...encodedLengths) + 12 + MIN_PAD;

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

/**
 * THE DIGEST OF THE ART A RENDER WAS DRAWN FROM.
 *
 * WHY NOT THE RENDER ITSELF. The obvious staleness check is "re-render the
 * entry and compare `entry.sha256`", and it cannot be written: that hash is of
 * the PADDED png, and the pad length comes from `rng()` seeded by the run salt,
 * which is `randomBytes(16)` on every real run and is deliberately recorded
 * NOWHERE -- it is the secret that makes the opaque names unlinkable. The
 * uniform canvas is run-global too. So `entry.sha256` is reproducible only by
 * the run that made it, which is exactly what a hand-off wants and exactly what
 * a staleness check cannot use.
 *
 * WHAT IS REPRODUCIBLE is the input: the SVG bytes the recipe read. Hash those,
 * record the hashes in the keymap beside `sources[]`, and a later run can ask
 * the only question that matters -- IS THIS STILL THE ART THAT VERDICT WAS
 * ABOUT? It costs a file read per source and no rasterising at all.
 *
 * WHAT THIS DOES NOT COVER, said out loud so it is not read as bigger than it
 * is:
 *
 *   - A CHANGE TO THE RECIPE. Re-composite the same SVGs differently -- a new
 *     `nearTop`, a different variant slot -- and the picture changes while every
 *     source digest holds. Covering it would mean voiding every record on every
 *     edit to this file, including the edit that added the check, which is a
 *     tripwire nobody would keep.
 *   - A NO-OP EDIT. Reindent an SVG and the digest moves though the picture does
 *     not. That is a false STALE, and it errs towards "go and look again", which
 *     is the safe direction for a verification record.
 *
 * ONE FUNCTION, TWO CALLERS. `buildHandoff` writes these and `scoreRun` reads
 * them back through the same reader, because a check whose two halves compute
 * the digest separately proves that the copy agrees with the copy.
 */
export function sourceDigestReader({ assets }) {
  const cache = new Map();
  return (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    const found = resolveSource(assets, rel);
    // `null`, not a throw: a source that has been deleted or renamed since the
    // verdict is a REAL and interesting state, and the scorer has a word for it.
    const digest = found
      ? createHash('sha256').update(readFileSync(found.path)).digest('hex')
      : null;
    cache.set(rel, digest);
    return digest;
  };
}

/**
 * `{ rel: sha256 }` over a render's sources. Keyed by path and de-duplicated,
 * because a digest is a property of a file: the officer's recipe lists
 * `arm-upper-serge.svg` twice (two arms) and it is one file either way.
 */
export function digestSources({ assets, sources, read = null }) {
  const digest = read ?? sourceDigestReader({ assets });
  const out = {};
  for (const rel of new Set(sources ?? [])) out[rel] = digest(rel);
  return out;
}

/**
 * Rasterised sources, for the length of ONE hand-off.
 *
 * A character artboard draws about twenty parts and several of them are the
 * same file (two arms, two legs), and a run now builds twelve figures across
 * three artboards and their comparison canvases -- so `ground-shadow` alone was
 * being rasterised a dozen times per run, from bytes that cannot have changed
 * in between. Cleared at the top of every `buildHandoff` rather than kept for
 * the process: the cache is keyed by path, and a second run against a different
 * `--root` in the same process is a different tree.
 *
 * NOT AN OPTIMISATION OF THE CHECKS. `refuseDrawnText` still runs on the first
 * read of each file, and its verdict is a property of the bytes, so caching it
 * reports the same failure once instead of a dozen times.
 */
let rasterCache = new Map();

async function rasterise(assets, rel, failures) {
  const found = resolveSource(assets, rel);
  if (!found) {
    failures.push(
      `${rel}: listed as a render source and does not exist (nor does its "@1x" pin)`,
    );
    return null;
  }
  if (rasterCache.has(found.path)) return rasterCache.get(found.path);
  const svg = readFileSync(found.path, 'utf8');
  refuseDrawnText(svg, found.rel, failures);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  rasterCache.set(found.path, png);
  return png;
}

/**
 * One part of a composite, placed at an already-computed canvas origin.
 *
 * Negative origins are cropped rather than clamped (the toque frame sits within
 * a pixel of y = 0 and a posed one rises above it) and an overrun is a hard
 * error: silently cropping a part that does not fit would quietly change the
 * picture the verdict is about.
 *
 * `crop: false` MAKES THE OTHER EDGE A HARD ERROR TOO, and it exists because
 * the asymmetry above is safe for exactly one kind of caller. A parallax tile
 * laid at its own window origin is meant to run off the top; a POSED FIGURE is
 * not, and the difference is that a pose moves. A canvas anchored where a rest
 * pose fits crops a lifted toque and a trailing blade quietly -- the render is
 * still a person, the missing 8 px look like a framing choice, and nothing in
 * the output says the picture lost the cue. So the mounted builder anchors its
 * canvas from the rig's own numbers and then asserts, on both edges, that
 * nothing fell off it.
 */
async function place(buf, { left: leftIn, top: topIn, canvasW, canvasH, crop = true }) {
  let image = buf;
  let left = leftIn;
  let top = topIn;

  if ((left < 0 || top < 0) && !crop) {
    const meta = await sharp(image).metadata();
    throw new Error(
      `part at (${left},${top}) size ${meta.width}x${meta.height} runs off the top or left ` +
        `of the ${canvasW}x${canvasH} canvas, which is anchored to contain it`,
    );
  }
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

/**
 * A single source, rasterised on its own at 1x, flattened onto the matte.
 *
 * TAKES NO PARAMETERS, AND THE SOURCE IS NOT ONE OF THEM. The render is
 * `subject.renders[0]`, out of the contract, because `renders[]` is the art
 * agent's statement of which files the subject IS and a path repeated in this
 * table would be a second copy of that statement, free to drift from it. A
 * proposal to write `singleSource('src/svg/.../landmark-x@1x.svg')` arrives
 * roughly once per level; the argument would be accepted and silently ignored,
 * which is why the shape is worth saying out loud here rather than only in a
 * review comment.
 *
 * WHICH IS ALSO WHY THE COUNT IS CHECKED. `renders[0]` on a subject that lists
 * two sources hands over half of it: one file rasterised, one file in the
 * keymap's `sources[]`, and therefore one file whose digest staleness is ever
 * re-derived. The picture would be wrong and the record would be wrong about
 * what it was a picture of, and both would render perfectly. A subject that
 * grows a second source needs a composite builder, and this says so on the day
 * it grows one instead of on the day somebody looks.
 */
const singleSource = () => async ({ assets, subject, failures }) => {
  if (subject.renders.length !== 1) {
    failures.push(
      `${subject.id}: built by \`singleSource()\` and the contract gives it ` +
        `${subject.renders.length} render source(s). This builder rasterises exactly one, so ` +
        `the rest would be handed over as nothing and re-checked as nothing. It needs a ` +
        `composite builder.`,
    );
    return null;
  }
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
 *
 * `nearTop` IS SIGNED, AND A NEGATIVE ONE IS NOT A TYPO.
 *
 * It is `nearTile.offset.y - farTile.offset.y` out of the level document, and
 * nothing in a parallax stack makes that positive. A NEARER layer is drawn in
 * FRONT of a further one; it is not thereby drawn LOWER. `prairie-rail` is the
 * case that proved it: the railbed (depth 40, scroll 1) sits at world y 800 and
 * the fields (depth 30) at 1010, because the foreground tile spends its top 428
 * rows on telegraph poles and wire that stand UP into the sky, and the fields
 * are seen between them. The offset is -210 and the composite is right.
 *
 * AND THE OLD CODE DID NOT REFUSE THE SIGN. IT WOULD HAVE DRAWN THE WRONG
 * PICTURE AND SAID NOTHING. This took `top: 0` for the far tile and
 * `top: nearTop` for the near one, and the reflex assumption -- "a negative
 * `top` will throw, so at worst the build fails loudly" -- IS FALSE. Measured
 * against sharp 0.35: a negative `top` is accepted, the part of the input above
 * the canvas is CROPPED AWAY, and the remainder is drawn from y 0. So the naive
 * builder deletes the near tile's top `-nearTop` rows -- here, the telegraph
 * poles, which are the whole reason the offset is negative -- and lays what is
 * left flush against the far tile. It renders. The anonymisation holds. The
 * summary reads the same. The identifier is asked to name a picture the level
 * never shows.
 *
 * On TODAY'S prairie tiles it happens to throw instead, and for an unrelated
 * reason: `Math.max(fm.height, nearTop + nm.height)` gives 310, the near tile is
 * 520 tall, and sharp refuses an input taller than the canvas. That is luck, not
 * a guard. Give the far tile 100 more rows and the same code composites cleanly
 * and wrongly. Verified both ways rather than assumed, because "it would have
 * failed loudly" is precisely the comfortable belief this file exists to check.
 *
 * So it is written as a SHIFT: whichever tile is higher goes to composite y 0
 * and the other is pushed down by the difference. The SEPARATION between the two
 * tops is `nearTop` in both directions, nothing is cropped, and the composite is
 * the level's geometry translated rather than clipped.
 */
const twoParallaxTiles = ({ farMatch, nearMatch, nearTop, what }) => {
  const build = async ({ assets, subject, failures }) => {
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
    // Whichever top is higher lands on composite y 0. For a positive `nearTop`
    // this is `far: 0, near: nearTop`, which is what it always was, so every
    // composite built before the sign existed is byte-identical.
    const farAt = Math.max(0, -nearTop);
    const nearAt = Math.max(0, nearTop);
    const height = Math.max(farAt + fm.height, nearAt + nm.height);

    const png = await flatten(
      canvas(width, height).composite([
        { input: await tileTo(far, width), left: 0, top: farAt },
        { input: await tileTo(near, width), left: 0, top: nearAt },
      ]),
    );
    // `nearTop` is the level's number and is what a verdict is read against;
    // `farAt`/`nearAt` are where this run actually put them, which differ from it
    // whenever the near tile is the higher of the two. Recording only the first
    // would leave a reader of the keymap unable to place anything in the picture.
    return { png, sources: [farRel, nearRel], slots: { nearTop, farAt, nearAt } };
  };
  // The parameters, readable from outside, so `levelOffsetDrift` can ask the
  // level documents whether this separation is still the level's. Eight entries
  // in the table below claim "Confirmed against content/levels/X.json" in a
  // COMMENT, which was true on the day each was written and is a sentence no
  // build re-reads. See `levelOffsetDrift`.
  build.parallax = { farMatch, nearMatch, nearTop };
  return build;
};

/* ------------------------------------------------------------------ *
 * Character figures: which slot got what, and why
 * ------------------------------------------------------------------ */

/**
 * THREE ANSWERS TO "WHAT DID THIS SLOT GET", AND ONLY ONE OF THEM IS A CHOICE.
 *
 * Every character artboard plays the SAME part list in the SAME z order; what
 * differs is which templates resolve, because `atlas.rule` says a part whose
 * resolved template is not in `frames` draws nothing. That makes three quite
 * different facts look identical in a keymap unless they are recorded apart:
 *
 *   varied   the run salt chooses, and chooses DIFFERENTLY for each figure.
 *            The recipes demand it in as many words -- "a subject that only
 *            ever renders with one tone is a subject nobody checked the others
 *            of" -- so this is the default and the interesting one.
 *
 *   pinned   the contract fixes it. A head covering on an artboard that draws
 *            its own hat is two hats; an accessory on an artboard whose
 *            `neverAdd` forbids accessories of any kind is a defect drawn on
 *            purpose.
 *
 * `why` on the last two is PROSE FOR A READER OF THE PLAN and no code branches
 * on it. It is a field rather than a comment because a reason kept in the
 * object it governs moves with it: the plans below are the one place a slot's
 * value and the decision behind it are both written, and a comment twenty lines
 * away is the thing that goes stale. `covered`'s is quoted back in the failure
 * message when the claim stops holding, which is exactly when somebody needs to
 * read it.
 *
 *   covered  THE SLOT IS DRAWN AND THEN WHOLLY HIDDEN by a later part of this
 *            costume. It takes the rig's fallback, it is not varied, and -- this
 *            is the whole point of the state -- NOT HAVING VARIED IT IS NOT A
 *            FAILURE. One artboard in today's contract is not a person: its
 *            fills are `leather`, `felt`, `hide` and `white` rather than a
 *            `skin-1`..`skin-6` ramp, so the docs/content-review.md 6.2 row
 *            "every skin fill is a skin ramp entry" GENUINELY CANNOT APPLY to
 *            it. art recorded that as an exemption for one non-human artboard
 *            so that a verifier scores it NOT APPLICABLE rather than FAILED,
 *            and this is where the harness holds the two apart -- the same
 *            split, for the same reason, as `stale` against `staleArt` in
 *            art-score.mjs. A rule nobody could check must not print like a
 *            rule that was checked and did not hold, and a summary that counted
 *            an invisible fallback as one more skin tone exercised would be
 *            reporting coverage of something nobody can see.
 *
 * AND THE EXEMPTION IS CHECKED, NOT BELIEVED. `covered` names the part that
 * does the covering and `checkCoveredSlots` reads the rig for it: that part
 * must draw on this costume, must sit LATER IN Z than every part the slot
 * feeds, and its window must contain theirs. This rig has already moved
 * underneath this file once -- two parts arrived and `hair` went below `face` --
 * and a claim of "you cannot see it anyway" that has stopped being true RENDERS
 * PERFECTLY and says nothing. If the covering part is moved, shrunk, reordered
 * or removed, the exemption fails loudly instead of going on being printed.
 */
const varied = ({ first = null } = {}) => ({ how: 'varied', first });
const pinned = (value, why) => ({ how: 'pinned', value, why });
const covered = (by, why) => ({ how: 'covered', by, why });

/**
 * `expression` is a slot of the rig like any other to a template, and is NOT in
 * `slots` -- it lives in `expressions`, because the state machine drives it.
 * One reader for both so a plan can name it beside the rest.
 */
const slotOptions = (rig, slot) =>
  slot === 'expression' ? (rig.expressions?.names ?? []) : (rig.slots?.[slot]?.options ?? []);
const slotFallback = (rig, slot) =>
  slot === 'expression' ? (rig.expressions?.fallback ?? null) : (rig.slots?.[slot]?.fallback ?? null);

/** The frame a part resolves to under a set of slot choices, or undefined. */
const resolveFrame = (rig, part, slots) =>
  rig.frames?.[
    `${rig.atlas.framePrefix}${part.frame.replace(
      /\{(\w+)\}/g,
      (_, slot) => slots[slot] ?? `{${slot}}`,
    )}`
  ];

const containsWindow = (outer, inner) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.w >= inner.x + inner.w &&
  outer.y + outer.h >= inner.y + inner.h;

/** The plan's own words for why a slot was exempt, quoted when it stops being. */
const because = (choice) => (choice.why ? ` The plan's reason was: "${choice.why}".` : '');

/**
 * Does the "you cannot see it anyway" claim still hold on this artboard?
 *
 * Z ORDER AND GEOMETRY, both, because either alone is satisfiable by art that
 * shows the slot. A covering part drawn first is behind what it claims to hide;
 * a covering part drawn last but smaller leaves an edge of it showing. What
 * this cannot check is OPACITY -- whether the covering part is solid over that
 * window is the drawing's business and the design sheet's claim. Said out loud
 * so the exemption is not read as bigger than it is.
 */
function checkCoveredSlots({ rig, subjectId, plan, slots, failures }) {
  const parts = rig.parts ?? [];
  for (const [slot, choice] of Object.entries(plan)) {
    if (choice.how !== 'covered') continue;

    const cover = parts.find((part) => part.name === choice.by);
    const coverFrame = cover ? resolveFrame(rig, cover, slots) : undefined;
    if (!cover || !coverFrame) {
      failures.push(
        `${subjectId}: "${slot}" is declared NOT APPLICABLE on this artboard because ` +
          `"${choice.by}" covers it, and "${choice.by}" draws nothing here. An exemption ` +
          `whose reason has gone is a rule nobody is checking any more, and this one hides ` +
          `a slot the run then deliberately did not vary.${because(choice)}`,
      );
      continue;
    }

    const readers = parts.filter((part) => part.frame.includes(`{${slot}}`));
    if (readers.length === 0) {
      failures.push(
        `${subjectId}: "${slot}" is declared NOT APPLICABLE and no part of the rig reads it, ` +
          `so the exemption protects nothing and would outlive the slot.${because(choice)}`,
      );
      continue;
    }

    for (const part of readers) {
      const frame = resolveFrame(rig, part, slots);
      if (!frame) continue; // Draws nothing on this artboard: nothing to cover.
      if (part.z >= cover.z) {
        failures.push(
          `${subjectId}: "${slot}" is declared NOT APPLICABLE because "${choice.by}" covers ` +
            `"${part.name}" — and "${part.name}" draws at z ${part.z}, at or above ` +
            `"${choice.by}" at z ${cover.z}. It is on top, so it is visible, so the slot IS ` +
            `applicable and this run neither varied it nor checked it.${because(choice)}`,
        );
        continue;
      }
      if (!containsWindow(coverFrame, frame)) {
        failures.push(
          `${subjectId}: "${slot}" is declared NOT APPLICABLE because "${choice.by}" covers ` +
            `"${part.name}", and it does not: a ${coverFrame.w}x${coverFrame.h} window at ` +
            `(${coverFrame.x},${coverFrame.y}) does not contain "${part.name}"'s ` +
            `${frame.w}x${frame.h} at (${frame.x},${frame.y}). Part of the slot ` +
            `shows.${because(choice)}`,
        );
      }
    }
  }
}

/**
 * The varied slots' options, shuffled once per subject per run.
 *
 * WHY A SEQUENCE AND NOT N INDEPENDENT DRAWS. `--variants` exists to render a
 * subject more than once with different choices, and independent draws collide:
 * two figures that land on the same slots are byte-identical, hash to one
 * opaque name, and the harness refuses the run -- an intermittent failure whose
 * frequency is 1 in (number of options) for a subject with one varied slot.
 * The narrowest such subject today has four. Drawing without replacement makes
 * the variants distinct by construction rather than by luck.
 */
const sequencesFor = (rig, plan, rng) => {
  const out = {};
  for (const [slot, choice] of Object.entries(plan)) {
    if (choice.how !== 'varied') continue;
    const shuffled = shuffle(rng, slotOptions(rig, slot));
    // `first` is how a recipe demands that one value be rendered in EVERY run,
    // whatever the salt says: "at least one run must set headCovering=none,
    // because the toque carries a large share of the identification and a
    // costume that only reads with a hat on has not been checked." It moves to
    // the front of the sequence rather than overriding variant 0, so the demand
    // costs the run no variety: with two options, one run renders both. The
    // first implementation DID override variant 0, and on the very first seed it
    // was tried on the shuffle put the same value at index 1 -- so the run
    // satisfied "at least one" and rendered the other option zero times, which
    // is the half of the recipe that says VARIED.
    out[slot] =
      choice.first === null
        ? shuffled
        : [choice.first, ...shuffled.filter((option) => option !== choice.first)];
  }
  return out;
};

/** How many distinct figures a plan can produce, which caps `--variants`. */
const distinctFigures = (rig, plan) =>
  Math.max(
    1,
    ...Object.entries(plan)
      .filter(([, choice]) => choice.how === 'varied')
      .map(([slot]) => slotOptions(rig, slot).length),
  );

/**
 * A plan resolved to one figure's slots. ONE WALK OF THE PLAN, TWO CHOOSERS:
 * the two answers that are NOT a choice - a value the contract pinned and a
 * value nothing can see - are handled here and only here, so the variant path
 * and the comparison path cannot drift into disagreeing about which slots a
 * figure declares not applicable.
 */
function resolvePlan({ rig, plan, choose }) {
  const slots = {};
  const notApplicable = [];
  const coveredBy = {};
  for (const [slot, choice] of Object.entries(plan)) {
    if (choice.how === 'pinned') {
      slots[slot] = choice.value;
      continue;
    }
    if (choice.how === 'covered') {
      slots[slot] = slotFallback(rig, slot);
      notApplicable.push(slot);
      coveredBy[slot] = choice.by;
      continue;
    }
    slots[slot] = choose(slot, slotOptions(rig, slot)) ?? slotFallback(rig, slot);
  }
  return { slots, notApplicable, coveredBy };
}

/** Variant N of a subject: the Nth entry of each varied slot's shuffled sequence. */
const slotsForVariant = ({ rig, plan, variantIndex, sequences }) =>
  resolvePlan({
    rig,
    plan,
    choose: (slot) => {
      const sequence = sequences[slot] ?? [];
      return sequence[variantIndex % Math.max(1, sequence.length)];
    },
  });

/**
 * One independent draw of a plan, optionally avoiding another figure's choices.
 * Used by the comparison canvas, where the two figures must differ in
 * everything the rig can vary so that identical proportions are the one thing
 * left to read.
 */
const drawSlots = ({ rig, plan, rng, avoid = null }) =>
  resolvePlan({
    rig,
    plan,
    choose: (slot, options) => {
      const taken = avoid?.[slot];
      const rest = taken === undefined ? options : options.filter((option) => option !== taken);
      return pick(rng, rest.length > 0 ? rest : options);
    },
  });

/**
 * "A CHARACTER IS NEVER JUDGED FROM ONE FILE." Every part is unidentifiable
 * alone — a sleeve is a coloured capsule — so the subject is the rig assembled,
 * and the plan above says how this artboard fills it in.
 *
 * The chosen slots go in the keymap (which the identifier never reads), so the
 * scorer can say which figure a verdict was about, and so a reader can tell a
 * slot that was varied from one that could not be.
 */
const characterFigure = (plan) => {
  const build = async ({ assets, rig, subject, failures, rng, variantIndex = 0, memo }) => {
    const sequences = memo.has(subject.id)
      ? memo.get(subject.id)
      : memo.set(subject.id, sequencesFor(rig, plan, rng)).get(subject.id);
    const { slots, notApplicable, coveredBy } = slotsForVariant({
      rig,
      plan,
      variantIndex,
      sequences,
    });
    checkCoveredSlots({ rig, subjectId: subject.id, plan, slots, failures });
    const made = await composeFigure({ assets, rig, slots, failures });
    if (!made) return null;
    return {
      png: await flatten(sharp(made.png)),
      sources: made.sources,
      // `inertSlots` is what makes NOT APPLICABLE printable downstream: without
      // it a fallback value in the keymap is indistinguishable from a chosen
      // one. `coveredBy` is the REASON, recorded beside it, so the record says
      // which part of the rig the exemption rests on rather than leaving a
      // reader to work it out from a z order that moves.
      slots: { ...slots, variantIndex, inertSlots: notApplicable, coveredBy },
    };
  };
  build.distinctFigures = (rig) => distinctFigures(rig, plan);
  // The picture comes out of `rig-contract.json`, not out of `subject.renders`.
  // See `checkContract`: that is what lets a subject whose `renders` is empty
  // still be built, and what keeps a FILE-driven builder refusing to.
  build.rigDriven = true;
  return build;
};

/**
 * THE THREE ARTBOARDS, AS PLANS. Each is the prose recipe in
 * `references.json` read literally, and nothing else lives here: what a builder
 * DOES is `characterFigure` above, which is one function for all three.
 */

/** costume=serge, and everything the recipe says to vary. */
const OFFICER_PLAN = {
  costume: pinned('serge', 'the artboard IS the costume; it is not player-selectable'),
  skin: varied(),
  hairShape: varied(),
  hairColour: varied(),
  expression: varied(),
  headCovering: pinned(
    'none',
    'this costume draws `hat-{costume}` over the crown, and its wide-brimmed felt hat is a ' +
      '`mustBeRight` feature. A second covering on top of it is two hats.',
  ),
  feature: pinned('none', 'the recipe names skin, hair and expression as what varies here'),
};

/**
 * costume=parka, and the artboard the officer's comparison canvas has been
 * building all along -- which is worth having checked rather than assumed. It
 * had: `COMPARISONS.officer` picked its partner with
 * `costume.options.find(o => o !== 'serge')`, which returned `parka` only
 * because `parka` happens to come first in a list that has since grown a third
 * member. The partner is now NAMED, because "the one that is not the officer's"
 * stopped being a description of one thing the moment a third artboard landed,
 * and the contract's own words for the entry are "the officer beside the
 * player, same rig, different costume".
 *
 * TWO CLAUSES THE OTHER PLANS DO NOT HAVE:
 *   - `headCovering` varies, because it is a player-selectable slot here rather
 *     than part of the costume, and
 *   - variant 0 pins it to `none`, because the recipe requires it: "at least
 *     one run must set headCovering=none ... a costume that only reads with a
 *     hat on has not been checked". `first` makes that true of every run
 *     including a `--variants 1` one, rather than true on average.
 */
const PLAYER_PLAN = {
  costume: pinned('parka', 'the artboard IS the costume; it is not player-selectable'),
  skin: varied(),
  hairShape: varied(),
  hairColour: varied(),
  expression: varied(),
  headCovering: varied({ first: 'none' }),
  feature: varied(),
};

/**
 * costume=beaver: the non-human artboard, on the same rig at the same six
 * heads, and the one place `covered` earns its keep.
 *
 * The recipe: "Use costume=beaver and leave every other slot at its fallback:
 * head-skin and hair-crop ARE drawn and are then covered entirely by
 * head-shell-beaver, which is why no pelt tone was added to the skin slot, and
 * a composite that omits them is not what ships. Vary the expression between
 * runs."
 *
 * So this plan is not "the guide has no skin". It has one, it is drawn, and it
 * cannot be seen -- which is why omitting those parts would be a different
 * picture from the shipped one, and why varying them would be reporting
 * coverage of something invisible. `covered('head-shell')` says exactly that
 * and is checked against the rig's z order and part windows every run.
 *
 * `expression` still varies, and the rig is why: `face` draws at z 16, ABOVE
 * `head-shell` at 15, so the shared eyes, brows and mouth land on the snout pad
 * and this artboard's expressions are the game's expressions. The same z order
 * that makes skin not applicable makes expression applicable, from the same
 * three numbers.
 */
const GUIDE_PLAN = {
  costume: pinned('beaver', 'the artboard IS the costume; it is not player-selectable'),
  skin: covered(
    'head-shell',
    'the head shell draws over the shared head and the short crop entirely, which is why no ' +
      'pelt tone was added to the skin slot',
  ),
  hairShape: covered('head-shell', 'the same shell, over the same window'),
  hairColour: covered('head-shell', 'the same shell, over the same window'),
  expression: varied(),
  headCovering: pinned(
    'none',
    "this subject's `neverAdd` forbids clothing, a hat, a scarf or an accessory of any kind",
  ),
  feature: pinned('none', 'same clause: it is an animal companion, not a person in a suit'),
};

/* ------------------------------------------------------------------ *
 * A CHARACTER IN MOTION
 * ------------------------------------------------------------------ */

/**
 * THE FOUR MOUNTED SUBJECTS, AND WHY THEY ARE NOT FOUR MORE CHARACTER FIGURES.
 *
 * `characterFigure` builds a person. These four subjects are a person DOING
 * SOMETHING, and the contract's `expectedBlindAnswer` for every one of them is a
 * verb: "someone ice skating", "a person sledding", "a cyclist", "someone
 * skateboarding". Two things follow that a rest-pose builder gets wrong, and
 * one of them is worse than not building the subject at all.
 *
 *   THE EQUIPMENT IS A BRACE, NOT A SLOT. Four parts resolve on `{mode}`:
 *   `mount-deck`, `mount-fore`, `foot-gear-l` and `foot-gear-r`. `mode` is not
 *   in `rig.slots` -- the rig's own `$comment` says so, "`mode` is NOT a slot:
 *   it joins `expression` as a brace naming something the character does not
 *   choose" -- so it is pinned by the plan rather than varied, and a mode that
 *   authors no frame for a part draws nothing there, which is why the bicycle
 *   has a deck and no prow and the skates have neither.
 *
 *   THE POSE IS A NAMED STATE. Every mounted state in the rig is
 *   `<mode>/<state>`: `skate/idle`, `skate/walk`, `skate/run`, and the same
 *   three for `toboggan`, `bike` and `skateboard`. Setting the mode and playing
 *   the base `walk` renders A WALKING FIGURE WEARING SKATES. That is not a
 *   weaker render than none; it is a picture of the exact defect this art was
 *   drawn to fix -- `skate/walk`'s own note says "this state exists because a
 *   walk cycle on a canal is the defect a player reported from the live site" --
 *   handed to a verifier as the fix.
 *
 * THE STATE NAMES IN `references.json` DO NOT EXIST AND ARE NOT USED HERE. Each
 * of the four recipes says to play `skate-move`, `toboggan-move`, `bike-move` or
 * `skateboard-move`; the rig has no state by any of those names. That prose
 * predates the `<mode>/<state>` scheme the rig and the engine settled on, and a
 * builder that took it literally would fail on a missing key -- loudly, which is
 * the good case. What it must not do is guess. So the table below names the
 * state it plays, and `mountedCharacter` refuses a name the rig does not carry.
 *
 * WHICH STATE, AND WHY `walk` AT t = 0 RATHER THAN `idle` OR `run`.
 * `idle` is a coasting or stopped pose ("a two-foot glide ... It reads correctly
 * stopped as well"), and the contract asks for mid-motion. `run` is the same
 * cycle at 0.72x duration with a few more degrees of pitch -- a variation on
 * `walk`, and the selector only reaches it above speed 0.55. `walk` at t = 0 is
 * the pose the contract's own `mustBeRight` entries MEASURE, which is the check
 * that settles it rather than an argument about which word means "moving":
 *
 *     skate/walk t 0       torso 24 deg   =  "About 24 degrees off vertical at
 *                                             the torso"
 *                          foot-l (-97.62, -49.53)
 *                                        =  "swings back about 98 px and up
 *                                             about 40"
 *     toboggan/walk t 0    torso -27 deg, (-28, +131)
 *                                        =  "reclined 27 degrees ... drops 131
 *                                             px and moves 28 px back"
 *     bike/walk t 0        torso 22 deg   =  "The torso folds 22 degrees over
 *                                             the bar"
 *     skateboard/walk t 0  feet 30.6 px apart
 *                                        =  "Both boots on the deck, 31 px
 *                                             apart"
 *
 * Four subjects, four independent numbers, all from the state named here at the
 * frame named here. No other state or t reproduces them.
 */
const MOUNTS = {
  'player-on-skates': { mode: 'skate', state: 'skate/walk', t: 0 },
  'player-on-a-toboggan': { mode: 'toboggan', state: 'toboggan/walk', t: 0 },
  'player-on-a-bicycle': { mode: 'bike', state: 'bike/walk', t: 0 },
  'player-on-a-skateboard': { mode: 'skateboard', state: 'skateboard/walk', t: 0 },
};

/**
 * A LOCOMOTION MODE THE RIG POSES AND NO SUBJECT CLAIMS.
 *
 * `MOUNTS` covers four modes and the rig declares states for four. The day it
 * declares a fifth, this harness builds four of them and its summary reads
 * exactly the same -- which is the vacuum the RECIPES table refuses one axis
 * over ("art adds a subject, the harness silently verifies four fifths of the
 * set"), arriving along a new axis.
 *
 * REPORTED, NOT FAILED, AND THAT IS THE LESSON OF THE FOUR SUBJECTS THIS BUILDER
 * WAS WRITTEN FOR. The refusal one layer down is a hard failure -- a subject
 * with renders and no builder is a build error -- and it worked exactly as
 * designed and produced a deadlock: the art agent could not declare the sources
 * for four subjects without turning the build red, so it declared none, and the
 * harness then described all four as a decision nobody had made. A gate that
 * fails on art's work in progress gets routed around, and a routed-around gate
 * reports the wrong thing in a voice that sounds right. A mode with no subject
 * is a gap in the CONTRACT, which is art's file to fill; the useful thing this
 * can do is say so on the run that first sees it.
 */
export function posedModesWithoutSubject(rig, references) {
  // A mode is covered when this table names it AND the contract still carries
  // the subject that named it. Either half alone is a claim about the other
  // file: the table without the contract says "there is art for this" about a
  // subject nobody is asking for, and the contract without the table is the
  // refusal one layer down.
  const declared = new Set((references?.subjects ?? []).map((subject) => subject.id));
  const claimed = new Set(
    Object.entries(MOUNTS)
      .filter(([subjectId]) => declared.has(subjectId))
      .map(([, mount]) => mount.mode),
  );
  const posed = new Set(
    Object.keys(rig.states ?? {})
      .filter((name) => name.includes('/'))
      .map((name) => name.slice(0, name.indexOf('/'))),
  );
  return [...posed].filter((mode) => !claimed.has(mode)).sort();
}

/** Every frame a part can resolve to under a plan, over all its slots' options. */
function candidateFrames(rig, plan, part, pinned) {
  const braces = [...new Set([...part.frame.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  let combinations = [{ ...pinned }];
  for (const slot of braces) {
    if (pinned[slot] !== undefined) continue;
    const choice = plan[slot];
    const options =
      choice?.how === 'pinned'
        ? [choice.value]
        : choice?.how === 'covered'
          ? [slotFallback(rig, slot)]
          : slotOptions(rig, slot);
    if (options.length === 0) continue;
    combinations = combinations.flatMap((base) => options.map((value) => ({ ...base, [slot]: value })));
  }
  const frames = [];
  for (const slots of combinations) {
    const frame = resolveFrame(rig, part, slots);
    if (frame) frames.push(frame);
  }
  return frames;
}

/**
 * THE CANVAS A POSED FIGURE NEEDS, MEASURED FROM THE RIG RATHER THAN DECLARED.
 *
 * Character space is 240 x 470 and a rest pose fits it. A POSE DOES NOT, and it
 * misses in every direction at once. Every part's window is rotated about its
 * pivot and moved by the key, so the union of the four poses this table builds
 * is the canvas, and it is computed here from `parts`, `frames` and `states` --
 * the same three tables the picture is drawn from.
 *
 * WHAT WAS PROPOSED AND WHAT MEASURES. The hand-off spec for this builder asked
 * for the canvas to be "anchored at (-12, -12)", because "the skate lift puts
 * the toque crown at y ~ -8 and the trailing blade tip at x ~ -8". Half of that
 * is right, and it is not the half that decides the canvas. Measured on the
 * poses this table actually plays, as the union of the rotated part windows in
 * character space:
 *
 *     skate/walk       t 0     x    0.1 .. 288.7    y   -5.3 .. 468.0
 *     toboggan/walk    t 0     x  -78.2 .. 237.0    y  144.2 .. 477.8
 *     bike/walk        t 0     x    0.0 .. 265.5    y   29.5 .. 472.0
 *     skateboard/walk  t 0     x   32.6 .. 274.4    y    1.3 .. 468.0
 *
 *   - THE CROWN. Right, and for the reason given: the toque is the topmost part
 *     of the skating figure and the pitch does lift it off the top edge. -5.3 as
 *     the window and -2 as the first non-transparent pixel, so "~ -8" is a
 *     rounding of a real number in the right direction.
 *   - THE TRAILING BLADE. Wrong at this frame, and right about a different one.
 *     At `skate/walk` t 0 the trailing skate is the FAR one and its blade tip
 *     reaches x = +4 -- inside character space, with 4 px to spare. The blade
 *     that reaches x = -15 is the NEAR one at t 0.5, the other half of the
 *     stroke cycle, which is not the pose the contract measures and not the pose
 *     this builds. So -8 is neither the number nor the frame; +4 is.
 *   - AND NEITHER IS THE BINDING EDGE. A canvas 240 wide anchored at x = -12
 *     ends at 228, and the skater's leading hand is at 289 and the toboggan's
 *     prow at 237. The anchor that matters most is the one nobody proposed: the
 *     toboggan's trailing hands reach x = -78, six times the -12 that was asked
 *     for, because a reclined rider's arms trail 148 px behind the hips.
 *
 * AND IT MATTERS ONLY HERE. A negative character-space coordinate is not a
 * defect and does not clip at runtime: the engine draws each part at
 * `(worldX - 120 + frame.x, worldY - 460 + frame.y)`, which has no left edge to
 * fall off. The 240 x 470 box is a COMPOSITE's canvas, and this file is the only
 * thing in the project that makes one. That is the whole reason the number had
 * to be checked here and the whole reason it is not a finding against the art.
 *
 * ONE WINDOW FOR ALL FOUR, not one each. They are the same character in four
 * modes; a shared window puts the sole line, the crown and the shadow on the
 * same rows in all four renders, so a verifier comparing them is comparing the
 * figures and not the framing. It costs the skateboard render some empty matte
 * on the left, which the uniform run canvas would have added anyway.
 */
const poseWindows = new WeakMap();
function mountedWindow(rig, plan) {
  // Memoised on the RIG alone, which is safe only while every mounted subject
  // uses one plan - they all use `PLAYER_PLAN`, because their recipes all say to
  // build the player composite exactly as the player's recipe does. A second
  // plan here would need a second key, and would also mean two framings, which
  // is the thing the shared window exists to avoid.
  if (poseWindows.has(rig)) return poseWindows.get(rig);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { mode, state, t } of Object.values(MOUNTS)) {
    const pose = poseAt(rig.states[state], t);
    for (const part of rig.parts) {
      const [dx, dy, degrees] = pose[part.name] ?? [0, 0, 0];
      for (const frame of candidateFrames(rig, plan, part, { mode })) {
        const x = part.mirrorX === true ? rig.characterSpace.width - frame.x - frame.w : frame.x;
        const y = frame.y;
        for (const [cx, cy] of [
          [x, y],
          [x + frame.w, y],
          [x, y + frame.h],
          [x + frame.w, y + frame.h],
        ]) {
          const [rx, ry] = rotateVector(cx - part.pivot[0], cy - part.pivot[1], degrees);
          minX = Math.min(minX, part.pivot[0] + rx + dx);
          maxX = Math.max(maxX, part.pivot[0] + rx + dx);
          minY = Math.min(minY, part.pivot[1] + ry + dy);
          maxY = Math.max(maxY, part.pivot[1] + ry + dy);
        }
      }
    }
  }
  // MARGIN, and it is not decoration. sharp's rotated canvas is the CEILING of
  // the rotated bounding box and the composite takes integer offsets, so a part
  // can land up to a pixel outside the arithmetic above. 4 px absorbs that and
  // leaves the assertion in `place` (crop: false) doing its job rather than
  // firing on a rounding.
  const margin = 4;
  const window = {
    x: Math.floor(minX) - margin,
    y: Math.floor(minY) - margin,
    width: Math.ceil(maxX) - Math.floor(minX) + 2 * margin,
    height: Math.ceil(maxY) - Math.floor(minY) + 2 * margin,
  };
  poseWindows.set(rig, window);
  return window;
}

/**
 * THE SIZE LADDER DOES NOT APPLY TO A POSE, AND THIS IS WHERE THAT IS DECIDED.
 *
 * `LADDER_WIDTHS` is [300, 140], and it was derived on a landmark. The verifier
 * that ran it wrote down what it measured and what it did not
 * (docs/art-verification.json, `findings.sizeLadderMeasuresRetentionNotRecognition`):
 *
 *     "The landmark silhouettes survive the ladder and the ACTIVITY does not. At
 *     140 px the Peace Tower, the Chateau, the CN Tower, the Town Clock and the
 *     officer were all still named. At the same rung the skaters are 6-8 px
 *     ticks whose glide pose has gone ... 0/2 diagnostic probes matched for
 *     dufferin-terrace-toboggan-run and 0/2 for halifax-quayside"
 *
 * and the conclusion, in its own words: "A subject whose identity is a VERB
 * cannot inherit a landmark's placement floor ... the 300 px floor that
 * peace-tower measured and that town-clock, pier-21 and cn-tower ADOPTED without
 * re-deriving is a floor for landmarks only."
 *
 * These four subjects are that case exactly. So the ladder is not inherited, for
 * two reasons and the second is the one that would have been missed:
 *
 *   1. THE ANSWER IS ALREADY KNOWN. A pose is limb angles a few pixels wide and
 *      it is the first thing a reduction destroys. Emitting a rung whose result
 *      was measured a level ago spends a verifier's judgement re-confirming it.
 *   2. THE RUNGS ARE ABSOLUTE WIDTHS AND THE SUBJECTS ARE NOT THE SAME SIZE. On
 *      an 1800 px parallax tile, `w300` is a sixth of full size. On this
 *      builder's window it is about four fifths -- a rung that reduces almost
 *      nothing and measures nothing -- and `w140` is about a third, a ratio
 *      nobody chose for this subject. Inheriting the numbers would have been
 *      inheriting a SCALE by way of a WIDTH, which is not the same quantity.
 *
 * WHAT REPLACES IT: ONE RUNG, AT THE SIZE A PLAYER SEES. The question worth
 * asking about a pose is not where it dies, which is known, but whether it
 * survives to the phone. That size is derivable from numbers this project owns
 * and not from any prose: `designResolution.width` is 1080 in the rig contract
 * and the portrait phone is 390 CSS px wide (tests/e2e/playwright.config.ts,
 * tests/unit/ui/viewport-mode.test.ts -- iPhone 13 portrait). So the whole
 * window is reduced by 390/1080 and handed over at that.
 *
 * IT LANDS NEAR 140 AND IT IS NOT 140. On today's window that is about 136 px,
 * four pixels from the rung this deliberately does not inherit. Worth stating
 * plainly, because the coincidence is exactly what a later reader would take as
 * evidence that the re-derivation was unnecessary: 140 is a fixed width that
 * means a different reduction on every subject it is applied to, and this is a
 * fixed RATIO that follows the window. They agree on one subject by accident and
 * will not agree on the next.
 *
 * STILL DIAGNOSTIC, NOT GATING. The contract's recipes ask for these to be
 * judged at 390 px, and that is an argument for handing the rung over, not for
 * letting it decide: "DERIVED PROBES ARE DIAGNOSTIC, NEVER GATING" is a property
 * of this harness, and a device-scale artefact must not be able to fail an art
 * verdict. If the art agent wants the reduced render to gate, that is a change
 * to `references.json`, made by the contract's owner, and not a decision for the
 * thing being verified.
 *
 * WORST CASE ON PURPOSE: 390 CSS px at one device pixel per CSS pixel. A phone
 * at DPR 3 shows the same figure with three times the samples. The conservative
 * number is the one the art's own reasoning uses ("a scale blade is 3 px at
 * design resolution and 1.1 px at 390 px").
 */
const PHONE_CSS_WIDTH = 390;
const onScreenProbe = (rig, window) => {
  const scale = PHONE_CSS_WIDTH / rig.designResolution.width;
  return [{ probe: `onscreen${PHONE_CSS_WIDTH}`, width: Math.max(1, Math.round(window.width * scale)) }];
};

/**
 * The player artboard, with a locomotion mode pinned and a state played.
 *
 * The plan is `PLAYER_PLAN` verbatim, because the contract's recipes for all
 * four say to "build the player composite exactly as the `player` subject's
 * recipe says". What differs is the mode and the pose, and reusing the plan is
 * what makes that true rather than claimed.
 *
 * ONE FIGURE PER SUBJECT, NOT `--variants` OF THEM. `characterFigure` renders
 * several because its recipes demand that the skin ramp and the hair options be
 * exercised -- "a subject that only ever renders with one tone is a subject
 * nobody checked the others of". That demand belongs to the `player` subject and
 * `player` still carries it, on the same artboard, the same costume and the same
 * parts. What is new HERE is a mount and a pose, and a second skin tone checks
 * neither. So the slots are still drawn from the run salt -- a different figure
 * every run, recorded in the keymap -- and the run hands over one of them.
 *
 * THE RIG CONTRACT IS A SOURCE OF THIS PICTURE, and it is recorded as one. Every
 * other render's `sourceSha256` covers the SVG bytes it was drawn from, which is
 * enough when the SVGs decide the picture. Here they do not: the pose lives in
 * `rig-contract.json`, and re-timing `skate/walk` changes what the verifier is
 * looking at while every SVG digest holds. So the contract file is listed beside
 * the parts, and a verdict about a pose goes stale when the pose moves. It also
 * goes stale when anything else in that file moves, which is a false stale in
 * the safe direction -- "go and look again" -- and the same trade `sourceSha256`
 * already documents.
 *
 * THE SAME GAP IS STILL OPEN FOR THE REST-POSE FIGURES and is deliberately not
 * closed here: `characterFigure` reads `parts`, `frames` and `atlas` out of the
 * same file, so a z-order or window change moves those pictures with no digest
 * moving either. It is a smaller hole -- those tables change far less often than
 * a pose -- and closing it touches three subjects that already have verdicts on
 * file. Written down rather than fixed quietly.
 */
const RIG_CONTRACT_SOURCE = 'style/rig-contract.json';

const mountedCharacter = (subjectId) => {
  const build = async ({ assets, rig, subject, failures, rng, memo }) => {
    const mount = MOUNTS[subjectId];
    const state = rig.states?.[mount.state];
    if (!state) {
      failures.push(
        `${subject.id}: this harness plays rig state "${mount.state}" and the rig contract has ` +
          `no state by that name. A mounted subject posed on a state the rig does not carry ` +
          `cannot be built, and building it on the base state instead would hand over a ` +
          `walking figure wearing the equipment - the defect the state exists to fix.`,
      );
      return null;
    }
    const plan = {
      ...PLAYER_PLAN,
      mode: pinned(
        mount.mode,
        "the level's locomotion mode. Not a slot: the rig's own comment puts `mode` beside " +
          '`expression` as "a brace naming something the character does not choose", which is ' +
          'what keeps the slot-independence product a statement about player choices.',
      ),
    };
    const sequences = memo.has(subject.id)
      ? memo.get(subject.id)
      : memo.set(subject.id, sequencesFor(rig, plan, rng)).get(subject.id);
    const { slots, notApplicable, coveredBy } = slotsForVariant({
      rig,
      plan,
      variantIndex: 0,
      sequences,
    });
    checkCoveredSlots({ rig, subjectId: subject.id, plan, slots, failures });

    const window = mountedWindow(rig, plan);
    const made = await composeFigure({
      assets,
      rig,
      slots,
      failures,
      pose: poseAt(state, mount.t),
      window,
    });
    if (!made) return null;
    return {
      png: await flatten(sharp(made.png)),
      sources: [...made.sources, RIG_CONTRACT_SOURCE],
      sizeProbes: onScreenProbe(rig, window),
      slots: {
        ...slots,
        variantIndex: 0,
        inertSlots: notApplicable,
        coveredBy,
        // What the verdict is about, in the keymap the identifier never reads:
        // which state was played, at which frame, on which canvas.
        pose: { state: mount.state, t: mount.t },
        window,
      },
    };
  };
  // `renders: []` on these subjects is NOT "unrendered by decision": it is the
  // deadlock this builder breaks. See `checkContract`.
  build.rigDriven = true;
  return build;
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

  /** A single source, rasterised on its own at 1x. One of two POI heroes on its
   * level, which is the first level to carry two: the shape of the builder does
   * not change, only the count of entries. */
  'town-clock': singleSource(),

  /** The level's second POI hero, and the same builder. */
  'pier-21': singleSource(),

  /**
   * Halifax's third and fourth heroes, added when every level in the game had
   * exactly one thing to stop at and eight of them had it at the dead centre.
   * Neither is a landmark — a market stall and a harbour tug are ordinary
   * objects — and that is the point: a point of interest is whatever teaches a
   * sourced fact at a spot, and a level with one of them is a corridor.
   */
  'market-stall': singleSource(),
  'harbour-tug': singleSource(),

  /**
   * Peggy's Cove's three. This level draws no figure at any scale, so every one
   * of them is a thing rather than a person, and `granite-erratic` carries the
   * strongest `neverAdd` clause in the repository: no cairn, inuksuk, stone
   * marker or stacked arrangement, and no object a viewer could read as one.
   * An identifier who names one has found a defect, not a likeness.
   */
  'granite-erratic': singleSource(),
  'fish-store': singleSource(),
  'fishermans-house': singleSource(),

  /**
   * Québec City's two. `terrace-kiosk` is a drawing recovered rather than
   * invented: a blind verifier named Terrasse Dufferin off a kiosk drawn into
   * the repeating terrace tile, which was right about the kiosk and wrong about
   * where it belonged. A building that names its city is drawn once, at one
   * world x, which is what a POI hero is.
   */
  'city-wall': singleSource(),
  'terrace-kiosk': singleSource(),

  /**
   * Ottawa's three. `warming-hut` is the first hero in the game standing on a
   * surface the player skates over rather than walks on, which is why its base
   * band is ice and not a snow bank — the builder is unchanged, the contract is
   * not.
   */
  'canal-lock': singleSource(),
  'library-of-parliament': singleSource(),
  'warming-hut': singleSource(),

  /**
   * "The quayside placed 160 px below the town tile's top edge (world y 860
   * against 700)."
   *
   * A DIFFERENT OFFSET FROM THE OTHER TWO COMPOSITES, AND THE ONE THING WORTH
   * CHECKING RATHER THAN COPYING. The canal and the toboggan run both sit at
   * 580 because both far tiles are 700 px of world above a near tile at 1280.
   * These do not: the town tile is 260 px tall, and 160 puts the quayside's
   * first FULLY OPAQUE row (its row 100) at composite y 260 -- exactly the town
   * tile's bottom edge. The seam closes to the pixel, with the boardwalk's lamp
   * standards, gables and gulls, which occupy the tile's transparent top 100
   * rows, standing in front of the town rather than above it. Measured, not
   * assumed: at 580 the two tiles would not touch at all and the subject would
   * be a boardwalk floating under a strip of unrelated houses.
   */
  'halifax-quayside': twoParallaxTiles({
    farMatch: 'uptown',
    nearMatch: 'quayside',
    nearTop: 160,
    what: 'a town tile and a quayside tile',
  }),

  /** A single source, rasterised on its own at 1x. */
  'cn-tower': singleSource(),

  /**
   * "The boulevard placed 340 px below the skyline tile's top edge (world y 900
   * against 560)."
   *
   * THE SEAM HERE IS NOT MEANT TO CLOSE, and that is the difference from the
   * quayside above. The two tiles overlap by 80 px, so the boulevard's tree
   * canopies, lamp arms and sign panels cross in front of the skyline's haze
   * band; below that the composite shows matte between the haze band and the
   * planted verge. That gap is SKY, and it is sky in the shipped level too --
   * the street wall that stands in it is a third tile this subject does not
   * list, because `renders[]` is the art agent's statement of which files the
   * subject IS. Adding a tile to close a hole would be this harness deciding
   * what the verdict is about. Checked against the picture: every `mustBeRight`
   * entry (the green and blue lines, the bicycle marks and arrows, the verge and
   * kerb, the young trees, the riders, the towers behind) is legible in the
   * composite as built.
   */
  'toronto-trail': twoParallaxTiles({
    farMatch: 'skyline',
    nearMatch: 'boulevard',
    nearTop: 340,
    what: 'a skyline tile and a boulevard tile',
  }),

  /** A single source, rasterised on its own at 1x. Its level's ONLY anchor that
   * may be named: the two tiles beside it repeat, so `winnipeg-riverwalk` is
   * asked for a promenade and never for a city, and the city rests here. */
  'human-rights-museum': singleSource(),

  /**
   * "The promenade placed 180 px below the skyline tile's top edge (world y 800
   * against 620)." Confirmed against content/levels/winnipeg.json: layer-20
   * offset.y 620, layer-40 offset.y 800.
   *
   * THE SAME SHAPE AS `toronto-trail`, INCLUDING THE HOLE, and the hole is the
   * part worth reading. The tiles overlap by 80 px, so the promenade's parapet
   * posts, lamp standards and trees cross in front of the skyline's base band;
   * below that the composite shows matte from composite y 260 down to y 530,
   * where the paving becomes solid. That gap is not a defect and it is not sky
   * either -- in the shipped level the riverbank tile stands in it, and the
   * contract's own recipe puts that tile explicitly out of this subject "so the
   * parapet reads as a parapet and not as a riverbank". Composing it in to
   * close the gap would be this harness deciding what the verdict is about.
   */
  'winnipeg-riverwalk': twoParallaxTiles({
    farMatch: 'skyline',
    nearMatch: 'plaza',
    nearTop: 180,
    what: 'a skyline tile and a promenade tile',
  }),

  /** A single source, rasterised on its own at 1x. Its level's only
   * non-repeating anchor, for the same reason as the museum above. */
  'grain-elevator': singleSource(),

  /**
   * Winnipeg's two. `cable-stayed-bridge` is a prohibition read the right way
   * round: `winnipeg-riverwalk`'s `neverAdd` has banned a bridge with a single
   * inclined pylon on the repeating tiles since the level shipped, *because the
   * real structure is recognisable* — which is a reason to draw it once as a
   * hero, not a reason to leave it out. The tiling was the problem, never the
   * building; Québec's kiosk was the same finding a batch earlier.
   *
   * `autumn-maple` is the only object in the game that can teach the maple-leaf
   * fact without drawing the flag, which `OQ-ART-04` has kept open since slice 1.
   * Its references make the flag and a maple-leaf logo explicit failures.
   */
  'cable-stayed-bridge': singleSource(),
  'autumn-maple': singleSource(),

  /**
   * The Prairies' three, on the longest level in the game, which had one point
   * at its exact centre. `grain-bins` took four builds and the first three are
   * the finding: bins on the ground under a cone read as a row of gabled
   * houses, and no amount of cel shading fixed it, because a triangle on a
   * rectangle standing on the ground *is* a house. Build four put them on legs
   * over hopper funnels with daylight underneath — what the reference shows and
   * what no building has — and the read changed at once.
   */
  'grain-bins': singleSource(),
  'combine-harvester': singleSource(),
  'container-car': singleSource(),

  /**
   * The foothills' two. `beef-cattle` is the first animal drawn since the llama
   * that was meant to be a horse, so its subject is written as guards rather
   * than as description: body depth to clear leg 1.4 : 1, neck a fifth of body
   * length running forward, head no higher than the withers, back level, and a
   * llama, an alpaca, a horse, a deer and a goat named as explicit failures.
   */
  'log-rail-gate': singleSource(),
  'beef-cattle': singleSource(),

  /** Vancouver's two. Both carry section 0's totem-pole and inuksuk
   * prohibition verbatim, applied before anything was drawn. */
  'marina-boats': singleSource(),
  'bulk-carrier': singleSource(),

  /**
   * The North's two. `driftwood-pile`'s first build drew the root wad as an even
   * radial fan, which read at 390 px as a sunburst device — a drawn emblem, on
   * the one level where that is worst. Four uneven roots on one side now.
   */
  'spruce-stand': singleSource(),
  'driftwood-pile': singleSource(),

  /**
   * THE ONE NEGATIVE OFFSET IN THE TABLE, AND IT IS NOT A TYPO.
   *
   * "In world coordinates the railbed tile's top edge is 210 px ABOVE the
   * fields tile's top edge (world y 800 against 1010), so the offset is
   * NEGATIVE." Confirmed against content/levels/prairie-rail.json: layer-30
   * offset.y 1010, layer-40 offset.y 800. 800 - 1010 = -210.
   *
   * The reflex reading -- nearer means lower, so the sign must be wrong -- is
   * what makes this the entry to check rather than copy. It is wrong here, and
   * the picture says why: the railbed tile is 520 px tall and spends its top 428
   * rows on telegraph poles, wire and rail furniture that stand UP into the sky,
   * at 3-25% column coverage. Only from its row 428 is it solid ballast. So the
   * foreground layer BEGINS higher than the middle-distance farmland and is
   * nearly all air where it does. Measured on the composite this builds:
   *
   *     y   0-210   railbed alone -- poles and wire against the matte
   *     y 210-320   the fields tile's fading horizon behind them
   *     y 320-428   solid farmland, seen between the poles
   *     y 428-470   ballast, covering the fields tile's last 42 rows
   *     y 470-520   ballast alone
   *
   * A positive 210 would have put the ballast below the farmland's bottom edge
   * and the poles growing out of a field that ends above them, which is a
   * picture of nothing. `twoParallaxTiles` shifts rather than clamps, so both
   * signs mean the same thing: the separation between the two tops is 210 px.
   */
  'prairie-rail-line': twoParallaxTiles({
    farMatch: 'fields',
    nearMatch: 'railbed',
    nearTop: -210,
    what: 'a fields tile and a railbed tile',
  }),

  /** A single source, rasterised on its own at 1x. Level 8's only non-repeating
   * anchor, and the only render on it that names anything: the contract asks the
   * two tiles beside it for a LANDFORM and refuses a province, so the level's
   * identity rests on this file and never on a repeating layer. */
  'ranch-barn': singleSource(),

  /**
   * THE SECOND NEGATIVE OFFSET IN THE TABLE, AND THE ONE WHERE THE NAIVE
   * BUILDER WOULD HAVE GOT AWAY WITH IT.
   *
   * "In world coordinates the rangeland tile's top edge is 60 px ABOVE the
   * foothills tile's top edge (world y 880 against 940), so the offset is
   * NEGATIVE." Confirmed against content/levels/alberta-foothills.json: layer-30
   * offset.y 940, layer-40 offset.y 880. 880 - 940 = -60.
   *
   * THE SIGN IS RIGHT AND THE STATED REASON IS NOT THE ONE THAT MEASURES.
   * `prairie-rail-line`'s reason -- the foreground tile's ink STANDS UP into the
   * sky above the far tile's top edge -- does not hold here, and the recipe's
   * "top 250 rows on fence posts and wire" describes what is not SOLID rather
   * than what is drawn. Measured on today's tiles:
   *
   *     foothills  1800x200. First ink row 23, solid ground from row 69.
   *     rangeland  1920x410. Rows 0-189 ENTIRELY EMPTY. Fence posts from row
   *                190, about 9% column coverage, and the contract's three
   *                wires show here as two full-width rows, 202-205 and 224-227
   *                -- the third falls at or below the solid line and cannot be
   *                counted this way. Solid ground from row 246.
   *
   * So the fence rises above nothing: at -60 its first ink lands at composite
   * y 190, which is 130 px BELOW the far tile's top edge at y 60. What the
   * negative sign buys is THE SEAM. At -60 the foothills occupy composite 60-259
   * and the rangeland is solid from 246, so they overlap by 14 rows and no matte
   * shows between the ridge foot and the grass. A POSITIVE 60 puts the foothills
   * at 0-199 and the rangeland's first fence post at 250: fifty rows of bare
   * matte under the ridges, and 106 rows between the hills' last row and the
   * first solid one. That is a hole this level does not have, and it is the
   * whole of what the sign decides here.
   *
   * AND THE CROP BUG DOES NOT BITE THIS ONE, WHICH IS WHY IT IS WRITTEN DOWN.
   * The naive `top: nearTop` builder deletes the near tile's top `-nearTop`
   * rows, and on this art those 60 rows are EMPTY -- measured on the shipped
   * render: 0 non-matte pixels in 115200. Run both ways rather than reasoned
   * about, and the run needed two steps because the first one lands on the same
   * accident prairie-rail did:
   *
   *   - on TODAY'S tiles the naive builder THROWS, and not as a guard.
   *     `Math.max(fm.height, nearTop + nm.height)` gives 350 and the near tile
   *     is 410, so sharp refuses an input taller than the canvas. Identical luck,
   *     one level later, which is how much that luck is worth.
   *   - given a canvas with the room the naive arithmetic denies it, sharp
   *     crops and draws, and the result's top 350 rows are BYTE-IDENTICAL to the
   *     shifted composite's rows 60-409.
   *
   * So this entry does not re-prove what prairie-rail proved; it proves the other
   * half of it. The crop was harmless HERE, and only because of where this tile
   * happens to start drawing -- which is a fact about one SVG and not a property
   * of the builder. The picture is right because `twoParallaxTiles` SHIFTS. The
   * next negative offset will not be so lucky, and nothing in the output would
   * say so.
   */
  'alberta-foothills-rangeland': twoParallaxTiles({
    farMatch: 'foothills',
    nearMatch: 'rangeland',
    nearTop: -60,
    what: 'a foothills tile and a rangeland tile',
  }),

  /**
   * A single source, rasterised on its own at 1x, and its level's only render
   * that may be asked for a place at all: the two seawall tiles repeat.
   *
   * ITS BOTTOM 280 ROWS ARE EMPTY AND THAT IS PART OF THE SUBJECT. The file is
   * 1000x800 and its last ink is on row 519, because `mustBeRight` says "the
   * building stands on piles over open water ... its base does not touch the
   * bottom of the frame". `singleSource()` flattens the whole 1000x800 onto the
   * matte and never trims to the ink, so the pier is handed over floating, which
   * is the picture the contract is about. Worth stating rather than leaving to
   * be noticed: a builder that cropped to the drawn extent would render a
   * building standing ON something, which is the one reading this subject's own
   * `why` rules out.
   *
   * THE ANSWER THIS SUBJECT CANNOT BE SCORED ON is not a property of the
   * builder; see the note above BRIEFING, which is where it was fixed.
   */
  'five-sails': singleSource(),

  /**
   * "The seawall tile's top edge is 40 px BELOW the inlet tile's top edge (world
   * y 900 against 860)." Confirmed against content/levels/vancouver.json:
   * layer-30 offset.y 860, layer-40 offset.y 900. 900 - 860 = 40.
   *
   * THE ONLY COMPOSITE IN THIS TABLE WITH NO MATTE IN IT, and the recipe's
   * claim is measured rather than taken on trust:
   *
   *     inlet    1800x300. EVERY row at 100% coverage -- opaque from its own top
   *              edge, which halifax's town tile and toronto's skyline are not.
   *     seawall  1920x430. Ink from row 0 at 1-34% coverage (cedar tops, lamp
   *              heads, gulls), solid paving from row 250.
   *
   * At 40 the inlet fills composite 0-299 and the seawall is solid from 290, so
   * the two overlap by 10 rows and no matte shows between them. Measured on the
   * shipped render, the claim is stronger than the recipe makes it: THIS
   * COMPOSITE CONTAINS NO MATTE AT ALL -- not one matte pixel in 902400. The far
   * tile reaches the top edge and the near tile reaches the bottom, so the
   * seawall's sparse top 250 rows -- cedar tops, lamp heads, gulls -- read
   * against WATER rather than against grey, which is also what the level shows:
   * the inlet spans world y 860-1160 and every one of those cedars stands in
   * front of it. Several other seams close; this is the only picture with no
   * grey in it anywhere.
   *
   * ONE CORRECTION TO THE RECIPE'S OWN WORDS, since a later reader will compare
   * them: "the 40 px above the inlet's top edge carries the cedar tops" is not
   * what a positive offset does. At +40 the NEAR tile starts 40 px below the far
   * one, so there is nothing above the inlet's top edge in this composite at all.
   * The offset and the seam arithmetic in that recipe are right; that sentence
   * describes the level's sky band rather than this render.
   *
   * EIGHT COMPOSITES AND THREE KINDS OF SEAM, and which one a subject gets is a
   * property of the FAR TILE rather than of a better offset. Measured across the
   * table as the worst matte fraction of any row BELOW the far tile going solid:
   *
   *     halifax-quayside              0.0%   meets to the pixel, zero overlap
   *     prairie-rail-line             0.0%   overlaps
   *     rideau-canal-skateway         0.1%   overlaps
   *     alberta-foothills-rangeland   4.8%   overlaps by 14 rows
   *     dufferin-terrace-toboggan-run 57.9%  a band of matte at y 318
   *     toronto-trail                 82.4%  a band of matte at y 477
   *     winnipeg-riverwalk            94.3%  a band of matte at y 475
   *     vancouver-seawall             0.0%   overlaps by 10 rows
   *
   * Five of the eight close and three leave a band. Only this one has no grey
   * ANYWHERE, which is the distinction worth keeping and is not a better offset:
   * it reads that way because open water is opaque from its own top edge and a
   * skyline with sky in it is not.
   */
  'vancouver-seawall': twoParallaxTiles({
    farMatch: 'inlet',
    nearMatch: 'seawall',
    nearTop: 40,
    what: 'an inlet tile and a seawall tile',
  }),

  /** A single source, rasterised on its own at 1x. Its recipe's one distinction
   * from `five-sails` is measured and holds: that file is 1000x800 with its last
   * ink on row 519, because the building stands on piles over open water; this
   * one is 480x900 with the tower on rows 26..866 and only ground-contact shading
   * below, because it stands on rock. `singleSource()` never trims to the ink, so
   * both arrive framed the way their own contracts describe. */
  'peggys-cove-light': singleSource(),

  /**
   * THE FIRST COMPOSITE WHOSE OFFSET THE LEVEL DOCUMENT DISPUTES, and the number
   * here is the contract's rather than the level's. Both are written down
   * because the disagreement is the finding.
   *
   * The recipe: "The barrens tile's top edge is 80 px BELOW the cove tile's top
   * edge (world y 960 against 880)". content/levels/peggys-cove.json puts
   * `peggys-cove-layer-30-cove` at y 880 and `peggys-cove-layer-40-granite-barrens`
   * at y 1000, which is 120. Somebody's 40 px is wrong and it is not this file's
   * to settle; what this file can do is measure which number draws the picture
   * the contract describes, and say so. Measured on today's tiles:
   *
   *     cove     1760x280. Ink from row 0, opaque full width from row 26 down.
   *     barrens  1920x320. Rows 0-131 ENTIRELY EMPTY, rock crest against
   *              transparency from 132 at 11-60% coverage, opaque full width
   *              from row 190 - exactly the number the recipe states.
   *
   *   at 80   the composite is 400 rows, the cove occupies 0-279 and the barrens
   *           80-399, and the barrens goes solid at 270 - ten rows above the
   *           cove's last. The seam closes. Every number in the recipe's own
   *           description ("400 rows ... cove 0..280 and the barrens 80..400,
   *           overlapping by 200") is reproduced.
   *   at 120  the composite is 440 rows and the barrens goes solid at 310, which
   *           is 30 rows BELOW the cove's last. A band opens where neither tile
   *           is opaque, showing matte through the crests.
   *
   * Counted on the built pixels rather than argued: rows containing ANY matte
   * come to 26 at nearTop 80 and 56 at 120. The 26 are the cove tile's own top
   * edge - sky above the far tile, which every composite in this table has - and
   * the extra 30 are the band.
   *
   * The 30-row band is not an artefact of this composite: the same arithmetic
   * over the level document puts it at world y 1160-1190, where no other layer
   * of that level reaches - the open sea ends at 960 and the sky at 900. If the
   * level's 1000 is right, the level has a hole in it. That is a level defect
   * rather than a render choice, which is the other reason this builds the
   * contract's number: a render drawn to match a suspected defect would hand a
   * verifier the defect and ask them to identify it.
   *
   * THE DISAGREEMENT IS PRINTED ON EVERY RUN, not just here. See
   * `levelOffsetDrift`: eight of these entries assert in a comment that they
   * were confirmed against a level document, and a comment is not re-read.
   */
  'paddlewheel-riverboat': singleSource(),
  'northern-river-bar': twoParallaxTiles({
    farMatch: 'bank',
    nearMatch: 'bar',
    nearTop: 140,
    what: 'a spruce bank and a river bar',
  }),
  'peggys-cove-barrens': twoParallaxTiles({
    farMatch: 'cove',
    nearMatch: 'barrens',
    nearTop: 160,
    what: 'a cove tile and a granite barrens tile',
  }),

  /**
   * THE THREE CHARACTER ARTBOARDS, one builder, three plans.
   *
   * "A CHARACTER IS NEVER JUDGED FROM ONE FILE." Every part is unidentifiable
   * alone -- a sleeve is a coloured capsule -- so each subject is the rig
   * assembled, and what differs between them is the plan above and nothing
   * else. That is deliberate: the identical-proportions entry these three
   * subjects share is only answerable if they are built by the same code, and
   * three copies of a figure builder would drift into three canons.
   *
   * `--variants` emits more than one figure per run for each of them, because
   * every one of the three recipes says some version of "a subject that only
   * ever renders with one tone is a subject nobody checked the others of".
   */
  officer: characterFigure(OFFICER_PLAN),
  player: characterFigure(PLAYER_PLAN),
  guide: characterFigure(GUIDE_PLAN),

  /**
   * THE FOUR MOUNTED SUBJECTS. One builder, four entries in `MOUNTS`, and the
   * per-subject decision -- which mode, which state, which frame -- lives there
   * beside the measurement that settles it.
   *
   * WHAT THIS BUILDER CANNOT ANSWER, and it is on the record rather than in the
   * picture. Three of the four carry a `mustBeRight` entry that compares the
   * figure to the LEVEL it stands on: "the player matches the skaters already on
   * the level", "the riders already on the level", "the frame is not the colour
   * of the level's own bicycles". A figure on a matte cannot answer any of them,
   * for exactly the reason the proportions entry could not be answered from one
   * figure. The contract already has the mechanism -- `requiresComparisonFigure`
   * makes an entry UNCHECKABLE until the hand-off carries the picture that
   * answers it -- and none of these three entries sets it, so today they will be
   * audited against a render that cannot show them.
   *
   * THIS HARNESS DOES NOT CLOSE THAT BY COMPOSITING THE LEVEL IN. The backdrop
   * tiles it would need are named only in `renderRecipe` prose -- the same prose
   * that names four rig states which do not exist -- and `renders[]`, which is
   * the art agent's statement of which files a subject IS, does not list them.
   * Choosing a tile out of stale prose and drawing the figure on it would be
   * this harness deciding what the verdict is about, which is the one thing the
   * table above refuses at every other seam. It is a contract change: name the
   * backdrop in `renders[]` and flag the entry.
   */
  'player-on-skates': mountedCharacter('player-on-skates'),
  'player-on-a-toboggan': mountedCharacter('player-on-a-toboggan'),
  'player-on-a-bicycle': mountedCharacter('player-on-a-bicycle'),
  'player-on-a-skateboard': mountedCharacter('player-on-a-skateboard'),
};

/**
 * One figure on one character-space canvas, from `rig-contract.json` alone.
 *
 * Everything this needs is in that file: `parts` in `z` order, `{brace}`
 * templates resolved against the slot choices, each part drawn at its own
 * viewBox origin, and the `mirrorX` parts flopped about the centre line. No
 * knowledge of the rig lives here that the contract does not state.
 */
async function composeFigure({ assets, rig, slots, failures, pose = null, window = null }) {
  const space = rig.characterSpace;
  const frameWindow = window ?? { x: 0, y: 0, width: space.width, height: space.height };
  const parts = [...rig.parts].sort((a, b) => a.z - b.z);
  const layers = [];
  const sources = [];

  for (const part of parts) {
    // atlas.rule: "A part whose resolved template is not in `frames` draws
    // nothing. That is how every `none` option works." Not an error. ONE
    // resolver, shared with `checkCoveredSlots`: a second copy of the template
    // substitution would eventually disagree with this one, and the exemption
    // check would then be vouching for a frame this never draws.
    const frame = resolveFrame(rig, part, slots);
    if (!frame) continue;
    const buf = await rasterise(assets, frame.source, failures);
    if (!buf) continue;
    sources.push(frame.source);
    const posed = await poseOnePart(buf, { rig, part, frame, pose });
    layers.push(
      await place(posed.png, {
        left: Math.round(posed.x - frameWindow.x),
        top: Math.round(posed.y - frameWindow.y),
        canvasW: frameWindow.width,
        canvasH: frameWindow.height,
        // A rest-pose figure keeps the old asymmetry (the toque frame starts at
        // y = 1 and its ink is allowed to be clipped by the canvas it has always
        // been drawn on). A POSED figure does not: see `place`.
        crop: pose === null,
      }),
    );
  }

  if (layers.length === 0) {
    failures.push('the character rig resolved to zero parts');
    return null;
  }
  return {
    png: await canvas(frameWindow.width, frameWindow.height).composite(layers).png().toBuffer(),
    sources,
  };
}

/**
 * ONE PART, MIRRORED, ROTATED ABOUT ITS PIVOT AND MOVED -- the whole of what a
 * pose does to a part, and the only place this file knows how a keyframe is
 * applied.
 *
 * THE CONVENTION, DERIVED FROM THE RIG'S OWN NUMBERS RATHER THAN ASSUMED. A key
 * gives each part `[dx, dy, rotationDegrees]`, and neither half is what a reader
 * first expects:
 *
 *   - `rotationDegrees` is the part's ABSOLUTE rotation in character space, not
 *     a rotation relative to its parent. The rig "parents nothing"
 *     (`foot-gear-l`'s own note), so there is no chain to accumulate.
 *   - `dx, dy` is the ABSOLUTE displacement of the part's PIVOT, with the parent
 *     chain already solved into it.
 *   - positive `rotationDegrees` is CLOCKWISE on screen, which is what sharp's
 *     `.rotate(+d)` does, in a space whose y points down.
 *
 * Checked against the contract instead of taken from prose, because the prose
 * does not state it. `walk` t 0 gives `leg-upper-l` a rotation of 10 and
 * `leg-lower-l` a displacement of (-17.02, -1.49); the knee sits 98 px below the
 * hip pivot, and rotating (0, 98) by 10 degrees clockwise lands at
 * (-17.02, +96.51), a displacement of (-17.02, -1.49). To the hundredth, on the
 * part the chain runs through. `foot-l`'s (-39.88, -5.11) falls out of the same
 * two rotations carried one joint further. A convention that reproduces the
 * contract's own numbers is the convention the contract was authored in.
 *
 * SHARP ROTATES ABOUT THE IMAGE CENTRE and expands the canvas to the rotated
 * bounding box, so the pivot has to be tracked through that: the old centre maps
 * to the new centre, and the pivot moves with it. Sub-pixel: the expanded size is
 * a ceiling and the composite takes integer offsets, so a part lands within a
 * pixel of where the keyframe puts it. Said out loud because the keys are given
 * to two decimal places and this is not that precise -- it is a picture for a
 * person to look at, not a geometry test.
 */
const RAD = Math.PI / 180;
const rotateVector = (x, y, degrees) => {
  const cos = Math.cos(degrees * RAD);
  const sin = Math.sin(degrees * RAD);
  return [x * cos - y * sin, x * sin + y * cos];
};

async function poseOnePart(buf, { rig, part, frame, pose }) {
  const mirrorX = part.mirrorX === true;
  const png = mirrorX ? await sharp(buf).flop().toBuffer() : buf;
  const x = mirrorX ? rig.characterSpace.width - frame.x - frame.w : frame.x;
  const y = frame.y;
  const key = pose?.[part.name];
  if (!key) return { png, x, y };

  const [dx, dy, degrees] = key;
  if (Math.abs(degrees) < 1e-9) return { png, x: x + dx, y: y + dy };

  const rotated = await sharp(png)
    .rotate(degrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(rotated).metadata();
  const [px, py] = rotateVector(
    part.pivot[0] - x - frame.w / 2,
    part.pivot[1] - y - frame.h / 2,
    degrees,
  );
  return {
    png: rotated,
    x: part.pivot[0] + dx - (meta.width / 2 + px),
    y: part.pivot[1] + dy - (meta.height / 2 + py),
  };
}

/** A state's per-part `[dx, dy, rotationDegrees]` at `t`, linearly between keys. */
function poseAt(state, t) {
  const keys = state.keys;
  let before = keys[0];
  let after = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      before = keys[i];
      after = keys[i + 1];
      break;
    }
  }
  const span = after.t - before.t;
  const f = span === 0 ? 0 : (t - before.t) / span;
  const out = {};
  for (const [name, from] of Object.entries(before.parts)) {
    const to = after.parts[name] ?? from;
    out[name] = [
      from[0] + (to[0] - from[0]) * f,
      from[1] + (to[1] - from[1]) * f,
      from[2] + (to[2] - from[2]) * f,
    ];
  }
  return out;
}

/**
 * TWO FIGURES SIDE BY SIDE ON ONE CANVAS, built the same way and differing in
 * everything the rig can vary.
 *
 * One `mustBeRight` entry on each character subject is "cartoon proportions
 * identical to every other character", and a hand-off holding a single figure
 * CANNOT ANSWER IT. On the first run through this harness it was scored present
 * anyway -- confirmed from `rig-contract.json` rather than from the picture,
 * which the verifier itself called "a code-level check wearing an art verifier's
 * clothes". That is a right answer arrived at by accident, and the contract now
 * says so: the entry carries `requiresComparisonFigure` and the recipe requires
 * two figures built the same way.
 *
 * They differ in SKIN, HAIR SHAPE, HAIR COLOUR AND EXPRESSION as well as
 * costume, drawn without replacement so they really are different. That is the
 * point: if everything varies except the proportions and the proportions still
 * match, the entry is answered visually, in the way the rule intends. Two
 * figures identical but for costume would prove far less.
 *
 * `against` NAMES THE PARTNER rather than deriving it. Each contract entry
 * names the figure it wants beside the subject, in words, and there are three
 * artboards now: "the one that is not this one" describes a set, not a figure.
 *
 * BOTH SIDES DROP `headCovering` AND `feature`. A comparison canvas exists to
 * make the crown line, the sole line, the eye line and the hand and foot sizes
 * readable side by side, and a hat sits above the crown. Pinning them off is
 * not a variation the pair is skipping; it is the pair's own requirement, and
 * it keeps this canvas comparing the two things it is about.
 *
 * Which side the subject stands on is drawn from the run salt, so an identifier
 * cannot learn "the left one is the answer" across runs.
 */
const figurePair = ({ plan, against }) =>
  async ({ assets, rig, subject, failures, rng }) => {
    const mine = drawSlots({ rig, plan, rng });
    const theirs = drawSlots({ rig, plan: against, rng, avoid: mine.slots });
    for (const side of [mine.slots, theirs.slots]) {
      if (side.headCovering !== undefined) side.headCovering = 'none';
      if (side.feature !== undefined) side.feature = 'none';
    }
    checkCoveredSlots({ rig, subjectId: subject.id, plan, slots: mine.slots, failures });

    const subjectFirst = rng() < 0.5;
    const [first, second] = subjectFirst ? [mine.slots, theirs.slots] : [theirs.slots, mine.slots];
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
      slots: {
        subjectSide: subjectFirst ? 'left' : 'right',
        subject: mine.slots,
        comparison: theirs.slots,
        inertSlots: mine.notApplicable,
        coveredBy: mine.coveredBy,
      },
    };
  };

/**
 * Keyed like RECIPES and for the same reason: a subject whose contract asks for
 * a comparison figure and has no builder here FAILS, rather than quietly
 * handing over a picture that cannot answer the entry it was added for.
 */
const COMPARISONS = {
  /** "the officer (costume=serge) and the player (costume=parka)". */
  officer: figurePair({ plan: OFFICER_PLAN, against: PLAYER_PLAN }),

  /** "the player (costume=parka) and the officer (costume=serge)". */
  player: figurePair({ plan: PLAYER_PLAN, against: OFFICER_PLAN }),

  /**
   * "THE HAND-OFF MUST CONTAIN THE PLAYER BESIDE THE GUIDE on one canvas, for
   * the same reason the officer's does: identical proportions cannot be judged
   * from one figure." The partner is the player rather than the officer because
   * the contract says so, and because the entry's own `detail` is measured
   * against it: "same crown, sole, eye line, hand and foot sizes and stroke
   * weights as the player and the officer".
   *
   * This is also the pair where the not-applicable slots are visible as a
   * difference between the two halves: the subject's skin and hair are the rig
   * fallbacks under a shell that hides them, and the partner's are drawn
   * without replacement against those fallbacks, so the partner is a person
   * with a different tone and a different hair shape and the canvas still
   * compares the only thing it is for.
   */
  guide: figurePair({ plan: GUIDE_PLAN, against: PLAYER_PLAN }),
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
async function probesFor({ subjectId, base, sizeLadder, masks, sizeProbes = null }) {
  const probes = [{ probe: 'full', gating: true, png: base }];
  const meta = await sharp(base).metadata();

  // `sizeProbes` IS A BUILDER'S OWN LADDER, not a tweak to this one. A subject
  // whose identity is a verb does not inherit the landmark rungs; see
  // `onScreenProbe`. `--no-ladder` drops both, because both are size probes and
  // a flag that dropped one of them would leave the run with a ladder it did not
  // ask for.
  const rungs = sizeProbes ?? LADDER_WIDTHS.map((width) => ({ probe: `w${width}`, width }));
  if (sizeLadder) {
    for (const { probe, width } of rungs) {
      if (width >= meta.width) continue;
      probes.push({
        probe,
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
/**
 * WHERE A SUBJECT'S PICTURE COMES FROM, and the one place the answer is "not
 * from `renders[]`".
 *
 * `renders[]` is the art agent's statement of which FILES a subject is, and for
 * a landmark or a parallax pair it is also the builder's input: `singleSource()`
 * rasterises `renders[0]` and `twoParallaxTiles` matches two of them by name. A
 * CHARACTER SUBJECT'S BUILDER READS NONE OF IT. `characterFigure` and
 * `mountedCharacter` compose from `rig-contract.json` -- `parts` in z order,
 * `{brace}` templates against the slot choices, `states` for the pose -- and the
 * thirteen paths `player` lists have never been an input to a single pixel of
 * it. They are documentation of what that artboard draws from.
 *
 * WHICH IS WHY AN EMPTY `renders` MEANS TWO DIFFERENT THINGS, and the harness
 * had been reading both as the first:
 *
 *   - ON A FILE-DRIVEN SUBJECT it is a DECISION: `parliament-hill-skyline` and
 *     `quebec-city-riverfront` have candidate sources and the art bible forbids
 *     putting an identifying feature on the droppable repeating tile that is all
 *     they could be built from, so there is deliberately nothing to hand over.
 *     Neither a pass nor a failure, and that is unchanged.
 *
 *   - ON A RIG-DRIVEN SUBJECT it was a DEADLOCK. The four mounted subjects
 *     arrived with full `mustBeRight` lists and `renders: []`, and their recipes
 *     say why in their first line: "UNBUILT, AND NOT BY DECISION - THE HARNESS
 *     CANNOT BUILD IT YET ... A subject with sources and no builder FAILS the
 *     hand-off build, which is why it is not listed with them". The art agent
 *     could not declare the sources without turning the build red, and the
 *     builder could not be reached without the sources. The harness reported the
 *     result as "UNRENDERED by decision - not a pass and not a failure", which
 *     was the one reading that was false: nobody decided not to render them.
 *
 * So the builder decides, not the array. A rig-driven builder makes its subject
 * renderable whatever `renders` says; a file-driven one still needs its files,
 * and a subject with renders and no builder still fails. Nothing is skipped
 * quietly in either direction -- which is the property, not the four subjects.
 */
export const buildsFromRig = (id) => RECIPES[id]?.rigDriven === true;

/**
 * Does the contract render this subject at all? The predicate the hand-off, the
 * scorer and the tests all have to agree on. They did not have to before, because
 * `renders.length > 0` was written out three times and meant the same thing in
 * all three; the day it stopped meaning the same thing, the scorer's
 * NEVER CHECKED list would have quietly dropped exactly the subjects that had
 * just started being handed over.
 */
export const isRendered = (subject) =>
  (Array.isArray(subject?.renders) && subject.renders.length > 0) || buildsFromRig(subject?.id);

/**
 * IS A PARALLAX COMPOSITE'S OFFSET STILL THE LEVEL'S OFFSET?
 *
 * Eight entries in `RECIPES` carry a sentence of the form "Confirmed against
 * content/levels/X.json: layer-30 offset.y 940, layer-40 offset.y 880". Every
 * one of those sentences was true when it was written, and NO BUILD HAS EVER
 * RE-READ ONE. A level document that moves a layer leaves the comment standing,
 * the composite unchanged, and the render describing an arrangement the game
 * does not use -- while the summary prints the same line it always printed. The
 * same shape as `sourceSha256`, one file over: a claim that quietly stops being
 * true, with nothing in the output that changes when it does.
 *
 * So it is derived rather than asserted, and from names the two files already
 * share. A render source is `src/svg/<level>/<file>.svg`; a level document is
 * `content/levels/<level>.json`; and its layer keys are `<level>-<file>`. That
 * is the whole join, and it needed no new field in either file.
 *
 * REPORTED, NOT FAILED, AND THE REASON IS THE ONE THE DEADLOCK TAUGHT. A hard
 * refusal here would go red on art's or content's work in progress, and the
 * four mounted subjects are what that costs: faced with a gate that fails on an
 * incomplete state, the sensible response is to withhold the thing that trips
 * it, and the harness then reports the withholding as a decision. There is also
 * a narrower reason: WHICH FILE IS WRONG IS NOT KNOWABLE HERE. A composite whose
 * offset no longer matches its level may be a stale recipe or a mistyped level,
 * and this can tell you the two numbers and not which to keep.
 *
 * MISSING IS NOT DRIFT. A subject with no level document, or a layer key the
 * document does not carry, is silent: the fixtures under tests/unit/infra are
 * `assets/`-only trees with no `content/` at all, and a check that reported drift
 * for every one of them would be noise that teaches a reader to skip the line.
 */
export function levelOffsetDrift({ root, references }) {
  const drift = [];
  for (const subject of references.subjects ?? []) {
    const parallax = RECIPES[subject.id]?.parallax;
    if (!parallax || !Array.isArray(subject.renders)) continue;

    const offsetOf = (match) => {
      const rel = subject.renders.find((r) => r.includes(match));
      if (!rel) return null;
      const parts = rel.split('/');
      const level = parts[parts.length - 2];
      const doc = join(root, 'content', 'levels', `${level}.json`);
      if (!existsSync(doc)) return null;
      const key = `${level}-${basename(rel).replace(/(@1x)?\.[a-z0-9]+$/i, '')}`;
      const layer = (readJson(doc).layers ?? []).find((l) => l.key === key);
      return layer?.offset?.y ?? null;
    };

    const far = offsetOf(parallax.farMatch);
    const near = offsetOf(parallax.nearMatch);
    if (far === null || near === null) continue;
    if (near - far === parallax.nearTop) continue;
    drift.push({
      subjectId: subject.id,
      built: parallax.nearTop,
      level: near - far,
      detail: `the level puts the far tile at y ${far} and the near tile at y ${near}`,
    });
  }
  return drift;
}

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

    if (subject.renders.length === 0 && !buildsFromRig(id)) {
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
  //
  /*
   * AND THERE IS STILL NO STOP-WORD LIST. ASKED AND ANSWERED, so that the next
   * reader does not have to re-derive it.
   *
   * The narrowing above did not end the collisions. An accepted answer reading
   * "a paved path with a stone wall" made "with" a token, "with" is in the
   * briefing, and the gate went red on a hand-off that leaked nothing. The
   * obvious fix is to stop looking for the twenty commonest English words.
   * It is refused, on four grounds:
   *
   *   1. THE WORDS ARE NOT SEPARABLE. Today's tokens include "city", "north",
   *      "park", "path", "line", "stone", "walk", "public" and "single". Every
   *      one is ordinary English and every one is also a word that would narrow
   *      a candidate set if it appeared in a briefing. There is no list that
   *      drops "with" and keeps "city", except a list someone maintains by
   *      hand, forever, against a contract that grows a level at a time.
   *   2. THE ALLOWANCE WOULD BE PERMANENT AND UNREVIEWED. Every other
   *      exception in this file is proved at the point of use -- the hex skip
   *      applies ONLY where `OPAQUE_NAME` has just proved the name carries no
   *      semantic content at all, and searches the token everywhere else. A
   *      stop-word list proves nothing at the point of use; it is a standing
   *      promise that a class of words can never be a leak, which is exactly
   *      the shape of promise this file exists to distrust.
   *   3. AND THE SELF-REFERENTIAL VERSION IS WORSE THAN THE HAND-WRITTEN ONE.
   *      "Exempt the words the briefing already contains" is the tempting
   *      automatic version, and it makes the check vacuous: paste a subject
   *      name into the briefing and its words become exempt BECAUSE they were
   *      pasted in. The scan would go green on the leak it exists to catch.
   *   4. THE MEASURED RATE DOES NOT JUSTIFY IT. One collision, across five
   *      levels of content, fixed by the author in one edit and costing the
   *      contract nothing -- the matcher tolerates two inserted words, so
   *      splitting a candidate in two loses no vocabulary. Compare the hex
   *      skip, which was taken because sha256 spells "cafe" about once in
   *      2400 names, NOBODY CAN AUTHOR AROUND IT, and the false positive was
   *      provably uninformative. None of those three holds here.
   *
   * So the answer is: leave it, and let authors phrase around it. What was
   * changed instead is the FAILURE MESSAGE, which used to read as "the briefing
   * leaks" and invited the wrong repair -- editing the briefing, which is the
   * constant, rather than the answer, which is the thing that moved.
   */
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
 * and is refused outright. `padded` and `padNonZero` check the one chunk this
 * pipeline adds on purpose: the `paDx` length padding that breaks the file-size
 * side channel. The padding is only defensible if it is THERE and if it provably
 * carries nothing, so both are CHECKED rather than asserted in a comment above
 * the code that writes it.
 */
function pngChunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  const text = [];
  let padded = false;
  let padNonZero = false;
  let at = 8;
  while (at + 8 <= buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    if (TEXT_CHUNKS.has(type)) text.push(type);
    if (type === PAD_CHUNK) {
      padded = true;
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
  return { text, padded, padNonZero };
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
  /** Filled per render below; read after the walk, where the sizes are compared. */
  const renderLengths = new Map();

  for (const path of walk(dir)) {
    const name = basename(path);
    const buf = readFileSync(path);
    const chunks = pngChunks(buf);

    if (chunks !== null) {
      // A render.
      const opaque = OPAQUE_NAME.test(name);
      if (!opaque) {
        failures.push(`${name}: not an opaque render name (expected 16 hex characters + .png)`);
      }
      for (const token of lowered) {
        /*
         * A TOKEN THAT IS ITSELF HEX CANNOT BE FOUND IN A HEX NAME, and looking
         * for it is the same false-positive trap this file already refuses when
         * it declines to grep PNG bytes for words.
         *
         * Sixteen hex characters spell "face", "cafe", "beef" and "decade" by
         * arithmetic, about once in every 2400 names for a four-letter one. The
         * contract has no such token today; "cafe" in one candidate answer on a
         * Quebec City subject is all it would take, and the result would be a
         * gate that fails a clean run a few times a year with a leak report
         * about a name that carries nothing. A FLAKY GATE GETS DISABLED, AND A
         * DISABLED GATE LEAKS SILENTLY, which is the argument this whole file
         * is built on.
         *
         * SKIPPED ONLY WHERE THE NAME IS PROVED OPAQUE. `OPAQUE_NAME` is the
         * stronger statement and it was checked one line above: a name of
         * sixteen hex characters and nothing else cannot carry semantic content
         * at all. On a name that FAILED that test the token is meaningful again
         * and is still searched for, so a render called `cafe-frontenac.png`
         * is caught by both halves.
         */
        if (opaque && /^[0-9a-f]+$/.test(token)) continue;
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
      if (!chunks.padded) {
        failures.push(
          `${name}: carries no ${PAD_CHUNK} length padding. Without it the render is handed ` +
            `over at its natural encoded length, which is the same number in every run and ` +
            `relinks the picture by file size alone.`,
        );
      }
      if (chunks.padNonZero) {
        failures.push(
          `${name}: its ${PAD_CHUNK} length padding is not all zeros. The padding exists ` +
            `to break the file-size side channel and is only harmless while it says nothing.`,
        );
      }
      renderLengths.set(name, buf.length);
      continue;
    }

    // Anything else handed over is text we wrote, and is scanned in full.
    const text = buf.toString('utf8').toLowerCase();
    for (const token of lowered) {
      if (text.includes(token)) {
        failures.push(
          `${relative(dir, path)}: contains the leaking token "${token}". TWO CAUSES AND ` +
            `DIFFERENT FIXES: either this text was written from the contract, which is the ` +
            `leak and the fix is here; or the contract has since accepted an answer built ` +
            `from an ordinary English word that this text has always contained, which is not ` +
            `a leak and the fix is to reword the answer. Text that PREDATES the answer cannot ` +
            `have come from it. This does not decide between them, on purpose -- see ` +
            `\`leakTokens\` for why there is no list of words it declines to look for.`,
        );
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * EVERY RENDER IS THE SAME NUMBER OF BYTES
   * ---------------------------------------------------------------- */
  /*
   * THE SENTENCE THE GATE PRINTS, TURNED INTO A CHECK. `verify-art` has always
   * said "every render is length-padded so file size cannot relink it" and
   * nothing here looked. It was not true when it was written: the pad was a
   * random 0-4096 bytes, so a render more than 4 KB from its nearest neighbour
   * in encoded size was still relinked across runs by `ls -l`, which measured
   * out at 5 of 113 with certainty and a 14% hit rate by nearest-size guessing.
   *
   * The rule now is one length for the whole run, and this is where a regression
   * to anything else is caught -- a per-file pad, a pad that gets skipped on one
   * branch, a second run's file copied in beside this one. Reported as ONE
   * failure naming the spread rather than one per file, because the interesting
   * number is how many distinct lengths there are, not which file has which.
   *
   * NOT VACUOUS ON A SMALL RUN, and that matters (ADR-0024): a directory with no
   * renders at all would satisfy "all lengths equal" by holding no lengths, so
   * the empty case is a failure in its own right. One render passes, correctly:
   * there is nothing to tell it apart FROM.
   */
  if (renderLengths.size === 0) {
    failures.push(
      `${dir} holds no renders. An empty hand-off satisfies every check in this scan by ` +
        `having nothing to check, which is the one way a leak scan can report a clean run ` +
        `without having looked at anything.`,
    );
  } else {
    const lengths = new Set(renderLengths.values());
    if (lengths.size > 1) {
      const sorted = [...lengths].sort((a, b) => a - b);
      failures.push(
        `the ${renderLengths.size} renders come in ${lengths.size} different byte lengths ` +
          `(${sorted[0]} to ${sorted[sorted.length - 1]}). Every render in a hand-off must be ` +
          `padded to one length: a length that varies is the same number in the next run too, ` +
          `and it relinks the picture without the identifier opening a single file.`,
      );
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
 *
 * AND THE ASK NAMES NO CATEGORY, WHICH IS A REPAIR AND NOT A STYLE CHOICE.
 *
 * It read "if you believe it is a real, named place or thing, name it", and one
 * subject in the contract could not be scored on its own name because of it. The
 * right unprompted answer to `five-sails` is the building's name; that name ends
 * in the noun the ask used; and `leakTokens` takes every word of four letters or
 * more out of `expectedBlindAnswer` and refuses any handed-over text that
 * contains one. So writing the correct answer into the contract would have
 * turned `make verify-art` red on a hand-off that leaks nothing. The subject id
 * is `five-sails` for the same reason, and the contract states the residual risk
 * in as many words: a verifier who writes the building's name AND NOTHING ELSE
 * is scored a miss while being exactly right.
 *
 * THE PROPOSED FIX WAS "a real, named building or landmark", AND IT IS WORSE ON
 * BOTH COUNTS, which is why it is not the wording that shipped:
 *
 *   1. IT COLLIDES TODAY, BEFORE ANYBODY ADDS ANYTHING. `land` is already a leak
 *      token -- it is a word of `alberta-foothills-rangeland`'s accepted answer
 *      "grazing land", which arrived in the same commit as the proposal -- and
 *      the scan is a SUBSTRING match, so "landmark" contains it. Measured: that
 *      wording puts one collision into a set that has none.
 *   2. IT NARROWS THE ASK. This hand-off carries landscape tiles, a canal, a
 *      hill and three character figures as well as buildings. Telling the
 *      identifier that a named answer is expected to be architecture is a hint
 *      about the contents, printed on the one text the identifier is meant to
 *      read. "place or thing" was very nearly categoryless; "building or
 *      landmark" is not.
 *
 * So the noun is GONE rather than swapped. A category noun in the ask is a
 * standing collision with the accepted answers, because accepted answers ARE
 * category nouns -- swapping one for another buys a level or two and lands back
 * here. "has a name of its own" asks for exactly what "named place or thing"
 * asked for, of a wider set of things, and takes no word out of the contract's
 * vocabulary. Checked mechanically rather than read over: 796 tokens across 22
 * subjects, zero collisions, and still zero with the building's name added to
 * `expectedBlindAnswer` -- which is what makes this a fix for `five-sails`
 * rather than a rewording next to it.
 *
 * AND NOTHING ELSE IS RELAXED. No token is exempted, no scan is narrowed, no
 * answer matches more loosely, no subject is skipped. The only thing that
 * changed is the question the identifier is asked, and it got MORE open, not
 * less -- which is the opposite direction from the two proposals this file has
 * declined.
 */
const BRIEFING = `You have been handed a directory of images and nothing else.

Do not go looking for where they came from. Reading the source tree, the
contract they are judged against, or the keymap turns this from an open
question into a multiple-choice one, and the result is then worth much less
than it appears to be -- which is the failure this hand-off exists to prevent.

For EVERY image in answers.json, before you read anything else, write:
  answer      - what it is, as specifically as you can honestly be. If you
                believe it is real and has a name of its own, give that name.
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
  rasterCache = new Map();
  const { assets, references, rig } = loadContract({ root });
  const { renderable, unrendered } = checkContract({ references, failures });

  const salt = seed ?? randomBytes(16).toString('hex');
  const rng = rngFrom(salt);
  const runId = createHash('sha256').update(`run:${salt}`).digest('hex').slice(0, 16);

  const built = [];
  /**
   * Per-run, per-subject state a builder needs to keep BETWEEN its variants --
   * today, the shuffled option sequences that make `--variants N` produce N
   * DISTINCT figures rather than N independent draws that may collide. Created
   * here and thrown away with the run, because it is derived from the run salt
   * and must not survive into another run under a different salt.
   */
  const memo = new Map();

  for (const subject of renderable) {
    /**
     * HOW MANY FIGURES OF THIS SUBJECT, and it is no longer a subject id.
     *
     * `subject.id === 'officer'` was here, which was true and became wrong the
     * moment a second and third character artboard landed: the new subjects
     * would have been rendered once each, their recipes' "must be VARIED
     * between runs" quietly unmet, and the summary would have looked the same.
     * A builder that can produce more than one distinct figure says so, and
     * says how many -- capped, because asking for more variants than a plan has
     * distinct appearances produces two byte-identical renders, which this
     * harness (rightly) refuses as one verdict answering both.
     */
    const builder = RECIPES[subject.id];
    const copies = builder.distinctFigures
      ? Math.min(Math.max(1, variants), builder.distinctFigures(rig))
      : 1;

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
      const made = await builder({ assets, rig, subject, failures, rng, variantIndex, memo });
      if (!made) continue;

      const masks = (subject.mustBeRight ?? [])
        .filter((entry) => entry?.maskRegion)
        .map((entry) => ({ feature: entry.feature, region: entry.maskRegion }));

      for (const probe of await probesFor({
        subjectId: subject.id,
        base: made.png,
        sizeLadder,
        masks,
        sizeProbes: made.sizeProbes ?? null,
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

  /* ------------------------------------------------------------------ *
   * ONE FILE LENGTH FOR THE WHOLE RUN
   * ------------------------------------------------------------------ */
  /*
   * TWO PASSES, AND THE SECOND ONE CANNOT START EARLY. How much the first render
   * is padded by depends on how long the LAST one encoded to, so everything is
   * composited and encoded first and nothing is named or written until the
   * longest is known. See `PAD_CHUNK` for the measurement that replaced a random
   * pad with a constant one, and for what the constant costs.
   */
  const encoded = [];
  for (const [index, item] of ordered.entries()) {
    encoded.push(
      await flatten(
        canvas(canvasWidth, canvasHeight).composite([
          {
            input: item.png,
            left: Math.floor((canvasWidth - natural[index].width) / 2),
            top: Math.floor((canvasHeight - natural[index].height) / 2),
          },
        ]),
      ),
    );
  }
  const target = uniformByteLength(encoded.map((png) => png.length));

  const entries = [];
  const seen = new Set();
  const readDigest = sourceDigestReader({ assets });
  for (const [index, item] of ordered.entries()) {
    const uniform = encoded[index];
    // Padded BEFORE naming, so the name is the hash of the bytes that are
    // written and the two cannot drift apart.
    const png = padPng(uniform, target - uniform.length - 12);
    const meta = await sharp(png).metadata();
    const name = `${createHash('sha256')
      .update(salt)
      .update(png)
      .digest('hex')
      .slice(0, 16)}.png`;
    /*
     * AND THIS CHECK ONLY STARTED WORKING WHEN THE PAD BECAME A CONSTANT. Two
     * identical pictures used to be handed over as two different lengths and
     * therefore two different names, so the duplicate they are was invisible
     * here; the jitter that was meant to hide the size channel was hiding this
     * too. Now identical pixels give identical bytes and identical bytes give
     * one name, which is the condition this refuses.
     */
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
      // The digest of the SVG bytes this render was drawn from, so a later run
      // can tell a verdict that still describes today's art from one whose art
      // has been redrawn underneath it. See `sourceDigestReader` for why this is
      // the input's hash and not the render's.
      sourceSha256: digestSources({ assets, sources: item.sources, read: readDigest }),
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
    /**
     * SUBJECTS WHOSE PICTURE THIS RUN BUILT AND WHOSE CONTRACT ENTRY STILL SAYS
     * IT CANNOT BE BUILT.
     *
     * `renders: []` on a rig-driven subject is no longer read as "unrendered by
     * decision", which is the fix. What it must not become is silence: an art
     * agent reading `references.json` finds four recipes that open "UNBUILT, AND
     * NOT BY DECISION - THE HARNESS CANNOT BUILD IT YET", and nothing in a
     * successful run would tell them that sentence has stopped being true. The
     * harness and the contract disagree, the harness is the one that is right,
     * and the run says so out loud until the contract catches up.
     */
    builtFromRig: renderable
      .filter((subject) => subject.renders.length === 0)
      .map((subject) => subject.id),
    /** See `posedModesWithoutSubject`: a gap in the contract, not a build error. */
    posedModesWithoutSubject: posedModesWithoutSubject(rig, references),
    /** See `levelOffsetDrift`: a composite built to an offset the level no longer uses. */
    levelOffsetDrift: levelOffsetDrift({ root, references }),
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
