/**
 * A level's `locomotion[].animation` binding names only inputs the rig declares,
 * of the type its field drives.
 *
 * Every level used to bind `airborneInput: "airborne"` and `brakeTrigger:
 * "brake"`, and `content/characters/rig.json` declares neither: the rig has
 * `grounded`, not its negation, and no brake. Nothing joined the two documents,
 * so the only symptom was `[level] this level's locomotion animation binding
 * names airborne, brake` on the console of every level, from
 * `character-cast.ts#unboundAnimationInputs` — a runtime report of a content
 * defect CI could have refused. ADR-0017 gives the rig the vocabulary; this is
 * the gate that holds a level document to it.
 *
 * The expected type of each field is a table, and the table is checked against
 * the schema's own property list, so a binding field added to
 * `level.schema.json#/$defs/locomotionAnimationBinding` fails here until
 * somebody says what kind of input it names. Two suites, as
 * `locomotion-tuning-is-coherent.test.ts` has: fixtures prove each fault is
 * caught today, and the corpus is what ships.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LEVELS_DIR = `${REPO_ROOT}content/levels`;

type InputType = 'bool' | 'number' | 'trigger';

interface RigInput {
  readonly name: string;
  readonly type: string;
}

/** What kind of rig input each binding field drives. */
const EXPECTED_TYPE: Readonly<Record<string, InputType>> = {
  /* Fed the normalised 0-1 speed every frame. */
  speedInput: 'number',
  /* Fired at take-off and on ground contact. */
  jumpTrigger: 'trigger',
  landTrigger: 'trigger',
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(`${REPO_ROOT}${path}`, 'utf8')) as T;

const RIG_INPUTS = readJson<{ readonly stateMachine: { readonly inputs: readonly RigInput[] } }>(
  'content/characters/rig.json',
).stateMachine.inputs;

const BINDING_FIELDS = Object.keys(
  readJson<{
    readonly $defs: { readonly locomotionAnimationBinding: { readonly properties: Readonly<Record<string, unknown>> } };
  }>('content/schemas/level.schema.json').$defs.locomotionAnimationBinding.properties,
);

/** Every way one binding fails to join the rig, as messages. Empty means it joins. */
const bindingFaults = (
  binding: Readonly<Record<string, unknown>>,
  inputs: readonly RigInput[],
  where: string,
): readonly string[] => {
  const found: string[] = [];
  for (const [field, name] of Object.entries(binding)) {
    const wanted = EXPECTED_TYPE[field];
    if (wanted === undefined) {
      found.push(`${where}.${field}: this test knows no input type for the field, so nothing checks what it names.`);
      continue;
    }
    const input = inputs.find((candidate) => candidate.name === name);
    if (input === undefined) {
      found.push(
        `${where}.${field} names ${JSON.stringify(name)}, which content/characters/rig.json does not declare ` +
          'as a state-machine input. A binding to an input the rig does not have drives a state nothing can ' +
          'enter, and the level logs it at every open (ADR-0017).',
      );
    } else if (input.type !== wanted) {
      found.push(
        `${where}.${field} names "${input.name}", a ${input.type} input; ${field} drives a ${wanted}.`,
      );
    }
  }
  return found;
};

describe('the binding table is the schema', () => {
  it('knows an input type for exactly the fields the schema declares', () => {
    expect(Object.keys(EXPECTED_TYPE).sort()).toEqual([...BINDING_FIELDS].sort());
  });

  it('expects only types the rig declares inputs of', () => {
    const declaredTypes = RIG_INPUTS.map((input) => input.type);
    for (const type of Object.values(EXPECTED_TYPE)) expect(declaredTypes).toContain(type);
  });
});

describe('the check catches each way a binding misses the rig', () => {
  const whole = { speedInput: 'speed', jumpTrigger: 'jump', landTrigger: 'land' };

  it('passes a binding every name of which the rig declares, at its type', () => {
    expect(bindingFaults(whole, RIG_INPUTS, 'fixture')).toEqual([]);
    expect(bindingFaults({ speedInput: 'speed' }, RIG_INPUTS, 'fixture')).toEqual([]);
  });

  it.each([
    ['a name the rig does not declare', { ...whole, jumpTrigger: 'brake' }],
    ['a bool where a number is driven', { ...whole, speedInput: 'grounded' }],
    ['a number where a trigger is fired', { ...whole, landTrigger: 'speed' }],
    ['a trigger where a number is driven', { ...whole, speedInput: 'jump' }],
    ['the removed airborne binding', { ...whole, airborneInput: 'airborne' }],
    ['the removed brake binding', { ...whole, brakeTrigger: 'brake' }],
  ])('refuses %s', (_label, binding) => {
    expect(bindingFaults(binding, RIG_INPUTS, 'fixture')).toHaveLength(1);
  });
});

describe("every level's animation binding joins the rig", () => {
  const levelFiles = readdirSync(LEVELS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  it('there are levels, so this suite is not measuring an empty directory', () => {
    expect(levelFiles.length).toBeGreaterThan(0);
  });

  it.each(levelFiles)('%s', (file) => {
    const level = readJson<{ readonly locomotion: readonly { readonly animation: Readonly<Record<string, unknown>> }[] }>(
      `content/levels/${file}`,
    );
    expect(level.locomotion.length, `content/levels/${file} declares no locomotion to check`).toBeGreaterThan(0);
    const faults = level.locomotion.flatMap((tuning, index) =>
      bindingFaults(tuning.animation, RIG_INPUTS, `content/levels/${file} locomotion[${String(index)}].animation`),
    );
    expect(faults, faults.join('\n')).toEqual([]);
  });
});
