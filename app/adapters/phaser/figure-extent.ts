/**
 * Where a figure's parts are drawn, as boxes, read from the rig. ADR-0037, ADR-0049.
 *
 * Three rules need the same fact about a figure and each used to guess it:
 *
 *  - a stop rests the player **beside** a character, which needs how wide the
 *    character and the player are (`stand-off.ts`);
 *  - a mark sits **on or just above** a character's head, which needs where the
 *    head actually is, not the top of `characterSpace` — that box is 40 px taller
 *    than the crown, and the mark floated in the gap;
 *  - a mark keeps **off the player's head** while a stop holds them, which needs
 *    where the head is in the pose the player rests in: a seated rider's head is
 *    lower than a walker's, and a leaning one is further forward.
 *
 * All three are the rig's own frame windows (`rig.frames`), placed exactly as
 * `sprite-character-renderer.ts` places them: a mirrored part's window reflected
 * about `characterSpace.centreX`, every choice a template can resolve to, and —
 * when a pose is asked for — each keyframe's `[dx, dy, rotation]` applied about the
 * part's pivot. A box is measured from the figure's feet: `x` from its centre line,
 * `y` from its sole line, so up is negative.
 *
 * Pure: no Phaser, no DOM.
 */

import type { RigDocument, RigKeyframe, RigPart, RigSlot } from '@application/ports';

import { silhouetteFromBoxes, type ArtSilhouette } from './art-silhouette';
import { braceNames, MODE_TEMPLATE_KEY, poseFor } from './locomotion-pose';

/** A rectangle about a figure's feet. `x` from the centre line, `y` from the sole line. */
export interface FigureBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The parts that make a head, as the rig names them (`assets/style/rig-contract.md`).
 *
 * Every one of them turns about the same pivot, the jaw. The neck is left out: a
 * mark above a collar is not over anybody's face.
 */
export const HEAD_PARTS: readonly string[] = [
  'head',
  'hair',
  'head-shell',
  'face',
  'head-covering',
  'hat',
  'feature',
];

/** The parts that stand on the ground, as the rig names them. Mode equipment is not a foot. */
export const FOOT_PARTS: readonly string[] = ['foot-l', 'foot-r'];

/** The brace the renderer resolves from the rig's expression list. */
const EXPRESSION_BRACE = 'expression';

export interface FigureBoxOptions {
  /** Only these parts, by rig part name. Absent is every part. */
  readonly parts?: readonly string[];
  /**
   * A state to pose the parts in — resolved through the mode, as the renderer
   * resolves it — with a box for every keyframe of it. Absent is the rest layout,
   * the windows as authored.
   */
  readonly pose?: string;
}

/** What each brace in a part template can resolve to, for one artboard in one mode. */
function choicesFor(
  rig: RigDocument,
  artboard: RigDocument['artboards'][number],
  mode: string | null,
): Map<string, readonly string[]> {
  const choices = new Map<string, readonly string[]>();
  for (const [name, slot] of Object.entries(rig.slots) as [string, RigSlot][]) {
    if (slot.status === 'reserved') continue;
    if (artboard.playerSelectableSlots.includes(name)) {
      choices.set(name, slot.options);
      continue;
    }
    const chosen = artboard.skins[name] ?? slot.fallback;
    if (chosen !== null && chosen !== undefined && chosen.length > 0) choices.set(name, [chosen]);
  }
  choices.set(EXPRESSION_BRACE, rig.expressions.names);
  if (mode !== null && mode.length > 0) choices.set(MODE_TEMPLATE_KEY, [mode]);
  return choices;
}

/** Every frame key a part template can resolve to, over every choice offered. */
function resolutions(template: string, choices: ReadonlyMap<string, readonly string[]>): readonly string[] {
  let resolved: readonly string[] = [template];
  for (const name of new Set(braceNames(template))) {
    const options = choices.get(name) ?? [];
    resolved = resolved.flatMap((partial) =>
      options.map((option) => partial.replaceAll(`{${name}}`, option)),
    );
  }
  return resolved;
}

/** A part's window, placed and turned as the renderer draws it, about the figure's feet. */
function placedBox(
  rig: RigDocument,
  part: RigPart,
  window: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  transform: readonly [number, number, number],
): FigureBox {
  const centre = rig.characterSpace.centreX;
  const sole = rig.characterSpace.soleY;
  const [dx, dy, rotation] = transform;
  /* Reflected about the centre when the part is, exactly as the renderer places
     a mirrored twin. The pivot is not reflected: each twin declares its own. */
  const left = part.mirrorX ? 2 * centre - (window.x + window.w) : window.x;
  const pivotX = part.pivot[0] - centre + dx;
  const pivotY = part.pivot[1] - sole + dy;
  const corners: readonly (readonly [number, number])[] = [
    [left - part.pivot[0], window.y - part.pivot[1]],
    [left + window.w - part.pivot[0], window.y - part.pivot[1]],
    [left - part.pivot[0], window.y + window.h - part.pivot[1]],
    [left + window.w - part.pivot[0], window.y + window.h - part.pivot[1]],
  ];
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [cx, cy] of corners) {
    /* Screen y grows downward, so a positive angle turns clockwise on the glass,
       as Phaser's `setAngle` does. */
    const x = rotation === 0 ? cx : cx * cos - cy * sin;
    const y = rotation === 0 ? cy : cx * sin + cy * cos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { x: pivotX + minX, y: pivotY + minY, width: maxX - minX, height: maxY - minY };
}

const REST_TRANSFORM: readonly [number, number, number] = [0, 0, 0];

/** The transforms a pose puts one part through: one per keyframe, or the rest layout. */
function transformsOf(keys: readonly RigKeyframe[] | null, part: string): readonly (readonly [number, number, number])[] {
  if (keys === null || keys.length === 0) return [REST_TRANSFORM];
  return keys.map((key) => key.parts[part] ?? REST_TRANSFORM);
}

/**
 * Every box an artboard can draw, facing right.
 *
 * `mode` resolves `{mode}` equipment parts; `null` is a character with no
 * locomotion of its own, which draws none. `null` back when the rig names no such
 * artboard. An artboard that resolves no frame gives an empty list.
 */
export function figureBoxes(
  rig: RigDocument,
  artboardName: string,
  mode: string | null,
  options: FigureBoxOptions = {},
): readonly FigureBox[] | null {
  const artboard = rig.artboards.find((candidate) => candidate.artboard === artboardName);
  if (artboard === undefined) return null;

  const choices = choicesFor(rig, artboard, mode);
  const wanted = options.parts === undefined ? null : new Set(options.parts);
  const keys = options.pose === undefined ? null : (rig.states[poseFor(rig, mode, options.pose)]?.keys ?? null);

  const boxes: FigureBox[] = [];
  for (const part of rig.parts) {
    if (wanted !== null && !wanted.has(part.name)) continue;
    for (const resolved of resolutions(part.frame, choices)) {
      const window = rig.frames[`${rig.atlas.framePrefix}${resolved}`];
      if (window === undefined) continue;
      for (const transform of transformsOf(keys, part.name)) {
        boxes.push(placedBox(rig, part, window, transform));
      }
    }
  }
  return boxes;
}

/**
 * A character's silhouette where it stands: its authored layout, its facing
 * applied, its feet on `(x, groundY)`. What a mark over them points at.
 */
export function figureSilhouette(
  rig: RigDocument,
  artboardName: string,
  placement: { readonly x: number; readonly groundY: number; readonly facing: 'left' | 'right' },
): ArtSilhouette | null {
  const boxes = figureBoxes(rig, artboardName, null);
  if (boxes === null) return null;
  return silhouetteFromBoxes(
    boxes
      .map((box) => (placement.facing === 'left' ? mirrorBox(box) : box))
      .map((box) => ({ ...box, x: placement.x + box.x, y: placement.groundY + box.y })),
  );
}

/** The same box, facing the other way. */
export function mirrorBox(box: FigureBox): FigureBox {
  return { ...box, x: -(box.x + box.width) };
}

/** The smallest box holding every one given, or `null` for none. */
export function unionBox(boxes: readonly FigureBox[]): FigureBox | null {
  if (boxes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
