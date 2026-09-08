/**
 * ADR-0017: the character rig satisfies `content/schemas/rig.schema.json`, and
 * the constraints a JSON Schema cannot state.
 *
 * The art agent asked for the schema in the right terms, and the argument is
 * this file's reason for existing:
 *
 *   "a contract test that loads a malformed rig JSON, finds no inputs, and
 *    checks none of them would report a pass"
 *
 * Task 1.11's acceptance is that a contract test loads each rig and asserts the
 * declared inputs exist. Run against an unvalidated document that is a shape
 * check away from empty, that acceptance is satisfiable by a file with no inputs
 * at all — which is the anti-vacuum failure this project has removed repeatedly
 * (ADR-0014). So the schema comes first and this file runs it.
 *
 * The division of labour is the point, and it is ADR-0007's:
 *
 *   - the SCHEMA holds shapes, enums and the local conditionals — a `number`
 *     input carries a range, a `trigger` carries no `fallback`, a `reserved`
 *     slot has zero options and a null fallback;
 *   - THIS FILE holds every constraint that compares a value with a sibling,
 *     because JSON Schema cannot: the head-proportion identity, unique input
 *     names, a fallback that is one of its own options, a dense z-order, every
 *     `{brace}` naming a declared slot or expression, a selector rule naming a
 *     real state, keyframe times running 0 to 1, frame keys carrying the atlas
 *     prefix.
 *
 * A rig that passes one half and fails the other is a broken rig. Neither half
 * is the contract on its own, which is why they are described together in the
 * schema's own `description` rather than left for a reader to discover.
 *
 * The brace check is the one that earns the most. `docs/content-review.md` §8.2
 * makes slot independence the anti-caricature rule — every option in every slot
 * available with every option in every other. `hairShape` and `hairColour` are
 * two slots precisely so that "the coily one only in black" cannot hide inside
 * one combined list of twenty options, and a part template naming two slots that
 * constrain each other is visible in the template. That turns the rule from a
 * promise into something a build can refuse.
 *
 * ajv over the real schema file, configured exactly as `scripts/validate-content.mjs`
 * configures it, for the reason ADR-0014 gives: the shipped validator and the
 * gate must not be two validators.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Where the rig lives, as ONE path.
 *
 * Its home is `content/characters/rig.json` (CLAUDE.md, Characters) and it is
 * authored under `assets/` because `assets/**` is the art agent's boundary and
 * `content/**` is not. Moving it is a copy with no key changes and a one-line
 * edit here. Deliberately not a two-path fallback: two live paths for one
 * document is the drift the art bible's own open-question table exists to catch,
 * and a gate that reads whichever it finds cannot tell you which one is stale.
 */
const RIG_FILE = 'assets/style/rig-contract.json';

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

const schemaFile = (name: string): object =>
  JSON.parse(readFileSync(`${REPO_ROOT}content/schemas/${name}`, 'utf8')) as object;

ajv.addSchema(schemaFile('common.schema.json'));
const validateRig = ajv.compile(schemaFile('rig.schema.json'));

/* -------------------------------------------------------------------------- */
/* the document                                                               */
/* -------------------------------------------------------------------------- */

interface RigInput {
  readonly name: string;
  readonly type: string;
}
interface RigSlot {
  readonly options: readonly string[];
  readonly fallback: string | null;
  readonly playerSelectable: boolean;
  readonly status?: string;
}
interface RigPart {
  readonly name: string;
  readonly z: number;
  readonly frame: string;
}
interface RigKeyframe {
  readonly t: number;
  readonly parts: Readonly<Record<string, readonly number[]>>;
}
interface RigState {
  readonly keys: readonly RigKeyframe[];
}
interface RigArtboard {
  readonly characterId: string;
  readonly skins: Readonly<Record<string, string>>;
  readonly playerSelectableSlots: readonly string[];
}
interface Rig {
  readonly characterSpace: { readonly heightPx: number; readonly headPx: number; readonly heightHeads: number };
  readonly artboards: readonly RigArtboard[];
  readonly stateMachine: { readonly inputs: readonly RigInput[] };
  readonly selector: { readonly rules: readonly { readonly state: string }[] };
  readonly expressions: { readonly names: readonly string[]; readonly fallback: string };
  readonly slots: Readonly<Record<string, RigSlot>>;
  readonly parts: readonly RigPart[];
  readonly atlas: { readonly framePrefix: string };
  readonly states: Readonly<Record<string, RigState>>;
  readonly frames: Readonly<Record<string, unknown>>;
}

const rig = JSON.parse(readFileSync(`${REPO_ROOT}${RIG_FILE}`, 'utf8')) as Rig;

/** The `{brace}` names in a frame template, in order. */
export const braceNames = (template: string): readonly string[] =>
  [...template.matchAll(/\{([^{}]*)\}/gu)].map((match) => match[1] ?? '');

/* -------------------------------------------------------------------------- */

describe('the rig satisfies its schema (ADR-0017)', () => {
  it('validates against content/schemas/rig.schema.json', () => {
    const ok = validateRig(rig);
    expect(ok, ajv.errorsText(validateRig.errors, { separator: '\n  ' })).toBe(true);
  });

  it('is not an empty document that a shape check would wave through', () => {
    // The anti-vacuum floor, and the reason this file exists at all: a rig that
    // lost its inputs, parts, states or frames would satisfy every assertion
    // below by having nothing to check.
    //
    // These were `toBeGreaterThan(0)` and that is decoration, by the standard
    // ADR-0014 sets and ADR-0024 restates: a floor at zero catches a rig that
    // vanished and passes a rig truncated to one part, which is the failure that
    // would actually happen. The numbers below are well under the shipped counts
    // (9 inputs, 20 parts, 8 states, 50 frames, 7 slots, 2 artboards) so honest
    // authoring has room, and well above one so a truncation fails.
    //
    // `slots` is exact: the schema fixes all seven by name because two of them
    // being separate is the anti-caricature mechanism (ADR-0017), so any other
    // number means the contract moved.
    expect(rig.stateMachine.inputs.length, 'the rig declares too few state-machine inputs').toBeGreaterThanOrEqual(5);
    expect(rig.parts.length, 'the rig declares too few parts to be a puppet').toBeGreaterThanOrEqual(10);
    expect(Object.keys(rig.states).length, 'the rig declares too few animation states').toBeGreaterThanOrEqual(4);
    expect(Object.keys(rig.frames).length, 'the rig declares too few atlas frames').toBeGreaterThanOrEqual(20);
    expect(Object.keys(rig.slots).length, 'the rig does not declare exactly the seven named slots').toBe(7);
    expect(rig.artboards.length, 'the rig declares no artboards').toBeGreaterThanOrEqual(2);
  });
});

describe('the constraints a JSON Schema cannot state (ADR-0017)', () => {
  it('keeps the 6-head proportion as one fact: heightPx / headPx === heightHeads', () => {
    const { heightPx, headPx, heightHeads } = rig.characterSpace;
    expect(
      heightPx / headPx,
      `characterSpace says heightPx ${String(heightPx)} / headPx ${String(headPx)} = ` +
        `${String(heightPx / headPx)}, and heightHeads ${String(heightHeads)}. Three numbers ` +
        `describe one fact and they have come apart. Cartoon proportions are identical for all ` +
        `characters (docs/content-review.md), which is an anti-caricature rule, not a style ` +
        `preference — so a rig can move off the canon only by saying so.`,
    ).toBe(heightHeads);
  });

  it('names every state-machine input exactly once', () => {
    const names = rig.stateMachine.inputs.map((input) => input.name);
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect(
      duplicated,
      `duplicate input name(s): ${duplicated.join(', ')}. Both backends address an input BY NAME, ` +
        `so a repeated name is two different meanings behind one setBool call.`,
    ).toEqual([]);
  });

  it('gives every live slot a fallback that is one of its own options', () => {
    const faults = Object.entries(rig.slots).flatMap(([name, slot]) =>
      slot.status === 'reserved' || slot.fallback === null || slot.options.includes(slot.fallback)
        ? []
        : [
            `slot "${name}" falls back to "${String(slot.fallback)}", which is not one of its ` +
              `options (${slot.options.join(', ')}). A fallback outside the option list is what a ` +
              `character gets on save recovery, so it resolves to a frame that does not exist and ` +
              `the part silently draws nothing.`,
          ],
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });

  it('keeps the reserved slots reserved, and says what blocks each', () => {
    // The schema enforces zero options and a null fallback; this restates it over
    // the corpus and names which slots are held shut, so that opening one is a
    // visible event rather than a diff nobody reads. OQ-ART-08 (the officer's
    // gender presentation) is the open question behind `presentation`.
    const reserved = Object.entries(rig.slots).filter(([, slot]) => slot.status === 'reserved');
    for (const [name, slot] of reserved) {
      expect(slot.options, `reserved slot "${name}" has options`).toEqual([]);
      expect(slot.fallback, `reserved slot "${name}" has a fallback`).toBeNull();
      expect(slot.playerSelectable, `reserved slot "${name}" is offered to players`).toBe(false);
    }
  });

  it('orders parts by a dense 1..n permutation of z', () => {
    const zs = [...rig.parts.map((part) => part.z)].sort((a, b) => a - b);
    const expected = rig.parts.map((_part, index) => index + 1);
    expect(
      zs,
      `parts[].z is ${zs.join(', ')} and should be a dense 1..${String(rig.parts.length)}. A GAP is ` +
        `an ambiguity about what was meant to be there; a DUPLICATE leaves two parts' order decided ` +
        `by their position in the array, which is not a contract — a re-ordered file would change ` +
        `what the player sees.`,
    ).toEqual(expected);
  });

  it('resolves every {brace} in a part template to a declared slot or the expression list', () => {
    // The check that makes slot independence mechanical (docs/content-review.md
    // §8.2) instead of a promise: a template naming two slots that constrain each
    // other is visible right here, in the template.
    const known = new Set([...Object.keys(rig.slots), 'expression']);
    const faults = rig.parts.flatMap((part) =>
      braceNames(part.frame)
        .filter((name) => !known.has(name))
        .map(
          (name) =>
            `part "${part.name}" has template "${part.frame}", whose {${name}} names neither a ` +
              `declared slot nor "expression". Known: ${[...known].sort().join(', ')}. An ` +
              `unresolvable brace produces a frame key nothing in the atlas matches, and the part ` +
              `draws nothing — which is indistinguishable from a deliberate "none" option.`,
        ),
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });

  it('keeps hairShape and hairColour as two independent slots', () => {
    // Named explicitly rather than left to the brace check, because this is the
    // anti-caricature guarantee itself and the failure mode is a MERGE: one slot
    // of twenty combined options in which "the coily one only in black" is
    // invisible. The schema requires both keys; this asserts they are actually
    // independent, i.e. that some part template consumes both and neither slot
    // enumerates the other's options.
    expect(Object.keys(rig.slots)).toContain('hairShape');
    expect(Object.keys(rig.slots)).toContain('hairColour');
    const shapes = rig.slots.hairShape?.options ?? [];
    const colours = rig.slots.hairColour?.options ?? [];
    expect(shapes.length, 'hairShape offers no options').toBeGreaterThan(1);
    expect(colours.length, 'hairColour offers no options').toBeGreaterThan(1);
    for (const option of shapes) {
      expect(
        colours,
        `"${option}" appears in both hairShape and hairColour, so the two slots are not ` +
          `independent vocabularies and a coupling could hide in the overlap.`,
      ).not.toContain(option);
    }
    // Every shape must exist in every colour, which is the product rule stated
    // over the frames that actually ship.
    const template = rig.parts.find((part) => braceNames(part.frame).includes('hairShape'));
    expect(template, 'no part template consumes {hairShape}').toBeDefined();
    const missing = shapes.flatMap((shape) =>
      colours
        .map((colour) =>
          (template?.frame ?? '').replace('{hairShape}', shape).replace('{hairColour}', colour),
        )
        .filter((resolved) => !(`${rig.atlas.framePrefix}${resolved}` in rig.frames))
        .map((resolved) => `${rig.atlas.framePrefix}${resolved}`),
    );
    expect(
      missing,
      `every hair shape must exist in every hair colour — that is the product rule the two slots ` +
        `exist to make checkable. Missing frames:\n  ${missing.join('\n  ')}\nA shape available in ` +
        `only some colours is exactly the coupling docs/content-review.md §8.2 forbids.`,
    ).toEqual([]);
  });

  it('selects only states that exist', () => {
    const states = new Set(Object.keys(rig.states));
    const faults = rig.selector.rules
      .filter((rule) => !states.has(rule.state))
      .map(
        (rule) =>
          `selector rule selects "${rule.state}", which is not a state. States: ` +
            `${[...states].sort().join(', ')}`,
      );
    expect(faults, faults.join('\n')).toEqual([]);
  });

  it('runs every state timeline from 0 to 1 in ascending order', () => {
    const faults = Object.entries(rig.states).flatMap(([name, state]) => {
      const ts = state.keys.map((key) => key.t);
      const found: string[] = [];
      if (ts[0] !== 0) found.push(`state "${name}" starts at t ${String(ts[0])}, not 0`);
      if (ts[ts.length - 1] !== 1) found.push(`state "${name}" ends at t ${String(ts[ts.length - 1])}, not 1`);
      for (let i = 1; i < ts.length; i += 1) {
        if ((ts[i] ?? 0) <= (ts[i - 1] ?? 0)) {
          found.push(`state "${name}" has t ${String(ts[i - 1])} then ${String(ts[i])}, not ascending`);
        }
      }
      return found;
    });
    expect(
      faults,
      `${faults.join('\n')}\nNormalised time must run 0 to 1 so a state's timeline does not depend ` +
        `on durationMs being read first — that is what lets reducedMotion hold a key, and what lets ` +
        `both backends agree on where in a state they are.`,
    ).toEqual([]);
  });

  it('animates only parts that exist', () => {
    const parts = new Set(rig.parts.map((part) => part.name));
    const faults = Object.entries(rig.states).flatMap(([name, state]) =>
      state.keys.flatMap((key, index) =>
        Object.keys(key.parts)
          .filter((part) => !parts.has(part))
          .map(
            (part) =>
              `state "${name}" key ${String(index)} transforms "${part}", which is not a declared ` +
                `part. A keyframe naming a part that does not exist animates nothing and looks ` +
                `exactly like a keyframe that animates something.`,
          ),
      ),
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });

  it('prefixes every atlas frame key with the rig prefix', () => {
    const bad = Object.keys(rig.frames).filter((key) => !key.startsWith(rig.atlas.framePrefix));
    expect(
      bad,
      `frame key(s) ${bad.join(', ')} do not start with "${rig.atlas.framePrefix}". The prefix is ` +
        `what keeps rig frames from colliding with a level's in a shared atlas namespace.`,
    ).toEqual([]);
  });

  it('falls back to an expression it declares', () => {
    expect(rig.expressions.names).toContain(rig.expressions.fallback);
  });

  it('gives every artboard skins and selectable slots that exist', () => {
    const slots = rig.slots;
    const faults = rig.artboards.flatMap((artboard) => [
      ...Object.entries(artboard.skins).flatMap(([slot, option]) => {
        const declared = slots[slot];
        if (declared === undefined) return [`${artboard.characterId}: skins names slot "${slot}", which does not exist`];
        return declared.options.includes(option)
          ? []
          : [`${artboard.characterId}: skins sets "${slot}" to "${option}", not one of its options`];
      }),
      ...artboard.playerSelectableSlots.flatMap((slot) => {
        const declared = slots[slot];
        if (declared === undefined) return [`${artboard.characterId}: offers slot "${slot}", which does not exist`];
        return declared.playerSelectable
          ? []
          : [
              `${artboard.characterId}: offers slot "${slot}" to the player, but the slot declares ` +
                `playerSelectable: false. The creator would show a slot the rig says is not the ` +
                `player's, which is how an NPC's costume ends up in the character creator.`,
            ];
      }),
    ]);
    expect(faults, faults.join('\n')).toEqual([]);
  });
});
