/**
 * ADR-0007 enforcement: `content/schemas/*.schema.json` is the authority on the
 * shape of authored content, and the matching document interface in
 * `app/application/ports` must mirror it exactly — same property names, same
 * set, and TypeScript-optional if and only if the property is absent from the
 * schema's `required`.
 *
 * The ADR recorded that nothing enforced this. dependency-cruiser reasons about
 * imports, not shapes, and no lint rule spans a `.ts` file and a `.json` file,
 * which is how `levelOrder`/`levels` plus five missing properties survived a
 * whole slice. This file is that gate.
 *
 * How it works: the schema side is read with `JSON.parse`; the type side is read
 * with the TypeScript compiler API, which is the only way to get a property set
 * that includes inherited members (`LevelDocument extends LevelSummary`) and
 * knows the difference between `theme?: T` and `theme: T`. A textual check —
 * "the file mentions every schema key" — would pass on a comment, and comments
 * are exactly what drifted last time.
 *
 * Bindings are derived by convention so a schema written in a later slice is
 * picked up without touching this file:
 *   - a schema file `<name>.schema.json` binds its root object to the exported
 *     interface `<Name>Document` (`game.config.schema.json` -> `GameConfigDocument`,
 *     `level.schema.json` -> `LevelDocument`);
 *   - a `$defs` entry binds to the interface named by its `title`
 *     (`"title": "Exam rules"` -> `ExamRules`), or by its key when it has no title.
 * Where the two names were chosen independently before this rule existed, an
 * entry in `TYPE_NAME_OVERRIDES` records the pairing explicitly. A schema or a
 * `$defs` object that maps to no exported type fails the run: the only way to
 * opt out is a named entry in one of the skip tables below, with a reason.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCHEMA_DIR = `${REPO_ROOT}content/schemas`;
const PORTS_DIR = `${REPO_ROOT}app/application/ports/`;
const PORTS_INDEX = `${PORTS_DIR}index.ts`;
const PORTS_INDEX_LABEL = 'app/application/ports/index.ts';

/**
 * Schema files whose **root** intentionally has no port type. The skip is
 * root-only on purpose: a file-level skip also hid every object under that
 * file's `$defs`, and cross-file `$ref`s into `$defs` (`common.schema.json#/$defs/localizedText`)
 * are how slice 1's schemas share shapes — hiding them would reopen the hole
 * this gate exists to close. Their `$defs` are still bound and must be skipped
 * one at a time in `SKIPPED_DEFS`.
 *
 * A name here that no longer exists on disk fails the run, and so does a name
 * here whose port type has since been written, so the list cannot go stale in
 * either direction.
 */
const SKIPPED_SCHEMAS: Readonly<Record<string, string>> = {
  // Shared `$defs` only (ids, locales, colours, vectors). It declares no root
  // shape and is referenced, never validated against, so there is nothing for a
  // document interface to mirror.
  'common.schema.json':
    'shared $defs, no root document shape — referenced by other schemas, never validated against',
  // ADR-0004: credits are a build-time artefact produced and checked by the
  // asset pipeline (`scripts/verify-art.mjs`, `make assets`), never read by the
  // application at runtime, so no port declares them. ADR-0007 says that if the
  // game ever shows a credits screen, that screen reads a document, this rule
  // applies to it, and this entry must be deleted.
  'credits.schema.json':
    'build-time artefact (ADR-0004) — never read by the application at runtime, so no port type exists',
};

/**
 * `$defs` objects that intentionally have no port type, keyed by
 * `<schema file>#<json pointer>`. Same staleness rules as `SKIPPED_SCHEMAS`: the
 * pointer must exist, and the type it would bind to must not.
 */
const SKIPPED_DEFS: Readonly<Record<string, string>> = {
  // Slice 1's schemas will `$ref` this for every player-facing string, but no
  // port re-declares the `{ en, fr }` pair today and ADR-0008 forbids adding a
  // port type before something reads it. The moment a port declares
  // `LocalizedText`, this entry fails and the binding is checked.
  'common.schema.json#/$defs/localizedText':
    'no port re-declares the EN/FR pair yet — the type must not be written before a consumer exists (ADR-0008)',
  // Same reasoning: design-resolution points and sizes are numbers in the port
  // types that use them, and no `Vec2` interface exists to mirror.
  'common.schema.json#/$defs/vec2':
    'no port re-declares a 2D vector yet — the type must not be written before a consumer exists (ADR-0008)',
  // The item shape of the credits artefact above; it inherits that entry's
  // reason and disappears with it.
  'credits.schema.json#/$defs/creditedAsset':
    'item of the build-time credits artefact (ADR-0004) — never read by the application at runtime',
};

/**
 * Pairings the naming convention cannot derive, keyed by
 * `<schema file>#<json pointer>`. An entry naming a pointer that no schema
 * declares fails the run: an override that pairs nothing protects nothing.
 */
const TYPE_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  // The `$def` is titled "Colour theme"; the exported interface is `ThemeColours`
  // because it is the palette block of a document, not a document itself.
  'game.config.schema.json#/$defs/theme': 'ThemeColours',
};

/* -------------------------------------------------------------------------- */
/* schema side                                                                */
/* -------------------------------------------------------------------------- */

interface JsonSchemaObject {
  readonly title?: string;
  readonly type?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: unknown;
  readonly $defs?: Readonly<Record<string, JsonSchemaObject>>;
  readonly $ref?: string;
}

/**
 * Every keyword whose value is a subschema, or a map/array of them, in JSON
 * Schema 2020-12. The walker below uses this to reach *every* node in a schema
 * document, which is what makes "no object is declared inline" a statement about
 * the whole file rather than about the two places we happened to look.
 */
const SUBSCHEMA_MAP_KEYWORDS = [
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
  'dependentSchemas',
] as const;

const SUBSCHEMA_LIST_KEYWORDS = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;

const SUBSCHEMA_KEYWORDS = [
  'items',
  'contains',
  'additionalProperties',
  'unevaluatedProperties',
  'unevaluatedItems',
  'propertyNames',
  'not',
  'if',
  'then',
  'else',
] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `#/$defs/theme` etc. Keys in our schemas need no JSON-pointer escaping, but do it anyway. */
const pointerSegment = (key: string): string => key.replace(/~/gu, '~0').replace(/\//gu, '~1');

/** Visits the whole schema document, node by node, with each node's JSON pointer. */
const walkSubschemas = (
  root: JsonSchemaObject,
  visit: (pointer: string, node: JsonSchemaObject) => void,
): void => {
  const step = (pointer: string, node: unknown): void => {
    if (!isRecord(node)) return;
    visit(pointer, node as JsonSchemaObject);

    for (const keyword of SUBSCHEMA_MAP_KEYWORDS) {
      const map = node[keyword];
      if (!isRecord(map)) continue;
      for (const [key, child] of Object.entries(map)) {
        step(`${pointer}/${keyword}/${pointerSegment(key)}`, child);
      }
    }
    for (const keyword of SUBSCHEMA_LIST_KEYWORDS) {
      const list = node[keyword];
      if (!Array.isArray(list)) continue;
      list.forEach((child, index) => step(`${pointer}/${keyword}/${String(index)}`, child));
    }
    for (const keyword of SUBSCHEMA_KEYWORDS) {
      step(`${pointer}/${keyword}`, node[keyword]);
    }
  };

  step('#', root);
};

/** One schema object that must have a mirror type: the root, or one `$def`. */
interface Binding {
  /** File name, e.g. `game.config.schema.json`. */
  readonly file: string;
  /** JSON pointer inside that file: `#` for the root, `#/$defs/<key>` otherwise. */
  readonly pointer: string;
  /** Exported interface name in `app/application/ports/index.ts`. */
  readonly typeName: string;
  readonly schema: JsonSchemaObject;
}

const pascalCase = (raw: string): string =>
  raw
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');

/** `game.config.schema.json` -> `GameConfigDocument`, `level.schema.json` -> `LevelDocument`. */
const rootTypeNameFor = (file: string): string =>
  `${pascalCase(file.replace(/\.schema\.json$/u, ''))}Document`;

/**
 * An object schema is one that closes over a named property set. `properties` is
 * the test, not `"type": "object"`: a node that lists properties without
 * declaring its type is still a shape a port would have to mirror, and reading
 * the type keyword would let it hide.
 */
const isObjectSchema = (schema: JsonSchemaObject): boolean => schema.properties !== undefined;

/** The two pointers a bindable object may live at: the root, or one `$def`. */
const isBindablePointer = (pointer: string): boolean =>
  pointer === '#' || /^#\/\$defs\/[^/]+$/u.test(pointer);

const schemaFiles = readdirSync(SCHEMA_DIR)
  .filter((name) => name.endsWith('.schema.json'))
  .sort();

const readSchema = (file: string): JsonSchemaObject =>
  JSON.parse(readFileSync(`${SCHEMA_DIR}/${file}`, 'utf8')) as JsonSchemaObject;

/**
 * Every object schema in a file, whether or not it is skipped, paired with the
 * type name it would bind to. Skips are applied afterwards so a skip entry can
 * be checked against the set of pointers that actually exist.
 */
const candidatesFor = (file: string): readonly Binding[] => {
  const schema = readSchema(file);
  const candidates: Binding[] = [];

  walkSubschemas(schema, (pointer, node) => {
    if (!isObjectSchema(node)) return;
    if (!isBindablePointer(pointer)) return;
    if (pointer === '#' && SKIPPED_SCHEMAS[file] !== undefined) return;
    const derived =
      pointer === '#'
        ? rootTypeNameFor(file)
        : pascalCase(node.title ?? pointer.slice('#/$defs/'.length));
    candidates.push({
      file,
      pointer,
      typeName: TYPE_NAME_OVERRIDES[`${file}${pointer}`] ?? derived,
      schema: node,
    });
  });

  return candidates;
};

/**
 * Object schemas written somewhere other than the root or a top-level `$def`.
 *
 * This is the load-bearing half of ADR-0007's "sub-objects belong in `$defs`".
 * An inline object contributes one property *name* to its parent and its own
 * shape is then compared with nothing at all — which is how a schema saying
 * `camera: { minZoom, maxZoom }` and a port saying `camera: { zoom }` can both
 * be green. Every object shape has to sit at a pointer a type can be bound to.
 */
const inlineObjectsIn = (file: string): readonly string[] => {
  const found: string[] = [];
  walkSubschemas(readSchema(file), (pointer, node) => {
    if (!isObjectSchema(node)) return;
    if (isBindablePointer(pointer)) return;
    found.push(pointer);
  });
  return found;
};

const allCandidates = schemaFiles.flatMap(candidatesFor);
const candidateKeys = allCandidates.map((binding) => `${binding.file}${binding.pointer}`);
const allBindings = allCandidates.filter(
  (binding) => SKIPPED_DEFS[`${binding.file}${binding.pointer}`] === undefined,
);
const checkedFiles = [...new Set(allBindings.map((binding) => binding.file))].sort();

/* -------------------------------------------------------------------------- */
/* type side — TypeScript compiler API                                        */
/* -------------------------------------------------------------------------- */

interface TypeShape {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

const buildPortsProgram = (): ts.Program => {
  const configPath = `${REPO_ROOT}tsconfig.json`;
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    throw new Error(
      `cannot read tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, ' ')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, REPO_ROOT);

  // Same module resolution and `paths` as the build, but only the ports graph is
  // loaded and nothing is emitted. `types: []` keeps the ambient @types packages
  // out: this program is used to enumerate members, never to typecheck (that is
  // `make typecheck`'s job).
  return ts.createProgram([PORTS_INDEX], {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
};

const program = buildPortsProgram();
const checker = program.getTypeChecker();
const portsIndexSource = program.getSourceFile(PORTS_INDEX);

if (portsIndexSource === undefined) {
  throw new Error(`the TypeScript program did not load ${PORTS_INDEX_LABEL}`);
}

const syntaxErrors = program.getSyntacticDiagnostics(portsIndexSource);
if (syntaxErrors.length > 0) {
  throw new Error(
    `${PORTS_INDEX_LABEL} does not parse: ${syntaxErrors
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))
      .join('; ')}`,
  );
}

const portsModuleSymbol = checker.getSymbolAtLocation(portsIndexSource);
if (portsModuleSymbol === undefined) {
  throw new Error(`${PORTS_INDEX_LABEL} is not a module`);
}

const exportedSymbols = new Map<string, ts.Symbol>(
  checker.getExportsOfModule(portsModuleSymbol).map((symbol) => [symbol.getName(), symbol]),
);

const exportedTypeNames = [...exportedSymbols.keys()].sort();

/* -------------------------------------------------------------------------- */
/* the reverse walk: document types with no schema must say so                */
/* -------------------------------------------------------------------------- */

/**
 * The walk above runs schema -> type, so it cannot see a type that no schema
 * backs; ADR-0007 recorded that and left the `SPECULATIVE` marker to review.
 * This is the type -> schema half.
 *
 * A *document type* is one that describes something authored or persisted, and
 * ADR-0007 names them: `<Thing>Document`, plus the two shapes that are documents
 * under another word — a `<Thing>Snapshot` (the save file) and a `<Thing>Bundle`
 * (a locale file). Everything those types reach through their properties or
 * their bases is part of the same document, so the closure below is derived, not
 * listed: `LevelDocument.locomotion: readonly LocomotionTuning[]` drags
 * `LocomotionTuning`, `JumpAffordance` and `LocomotionMode` into the set without
 * anyone remembering to add them.
 *
 * Every member of that closure is then either bound to a schema by the walk
 * above, or carries `SPECULATIVE`. A bound type carrying `SPECULATIVE` fails
 * too, so the marker cannot outlive the schema that answers it.
 */
const DOCUMENT_ROOT_PATTERN = /(?:Document|Snapshot|Bundle)$/u;

const isDeclaredInPorts = (symbol: ts.Symbol): boolean =>
  (symbol.getDeclarations() ?? []).some((declaration) =>
    declaration.getSourceFile().fileName.startsWith(PORTS_DIR),
  );

const aliasedSymbolOf = (symbol: ts.Symbol): ts.Symbol =>
  (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;

const typeArgumentsOf = (type: ts.Type): readonly ts.Type[] => {
  if ((type.flags & ts.TypeFlags.Object) === 0) return [];
  const objectType = type as ts.ObjectType;
  if ((objectType.objectFlags & ts.ObjectFlags.Reference) === 0) return [];
  return checker.getTypeArguments(objectType as ts.TypeReference);
};

/** Names of port-declared types reachable from `type`, including `type` itself. */
const reachablePortTypes = (type: ts.Type, seen: Set<ts.Type>, found: Set<string>): void => {
  if (seen.has(type)) return;
  seen.add(type);

  for (const part of type.isUnionOrIntersection() ? type.types : []) {
    reachablePortTypes(part, seen, found);
  }
  for (const argument of typeArgumentsOf(type)) reachablePortTypes(argument, seen, found);

  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (symbol === undefined || !isDeclaredInPorts(symbol)) return;

  const name = symbol.getName();
  if (name === '__type' || name === '__object') return;
  found.add(name);

  // Only descend through types this repo declares: descending into lib or
  // framework types would walk the whole standard library.
  if (type.isClassOrInterface()) {
    for (const base of checker.getBaseTypes(type)) reachablePortTypes(base, seen, found);
  }
  for (const property of type.getProperties()) {
    const declaration = property.valueDeclaration ?? property.getDeclarations()?.[0];
    if (declaration === undefined) continue;
    reachablePortTypes(
      checker.getTypeOfSymbolAtLocation(property, declaration),
      seen,
      found,
    );
  }
};

const documentTypeClosure = (): readonly string[] => {
  const found = new Set<string>();
  const seen = new Set<ts.Type>();
  for (const [name, exported] of exportedSymbols) {
    if (!DOCUMENT_ROOT_PATTERN.test(name)) continue;
    reachablePortTypes(checker.getDeclaredTypeOfSymbol(aliasedSymbolOf(exported)), seen, found);
  }
  return [...found].sort();
};

/**
 * Does the declaration of `typeName` carry `SPECULATIVE` in its own doc comment?
 *
 * Only the *last* leading comment counts. `getLeadingCommentRanges` returns every
 * comment back to the previous declaration, which includes any section banner
 * above it — and `content-repository.ts` has a banner that explains the marker.
 * Accepting those would let one banner vouch for every type under it, which is
 * how a marker ends up describing a type nobody looked at.
 */
const isMarkedSpeculative = (typeName: string): boolean => {
  const exported = exportedSymbols.get(typeName);
  if (exported === undefined) return false;
  return (aliasedSymbolOf(exported).getDeclarations() ?? []).some((declaration) => {
    const source = declaration.getSourceFile();
    const ranges = ts.getLeadingCommentRanges(source.text, declaration.getFullStart()) ?? [];
    const own = ranges.at(-1);
    return own !== undefined && source.text.slice(own.pos, own.end).includes('SPECULATIVE');
  });
};

const boundTypeNames = new Set(allBindings.map((binding) => binding.typeName));

/**
 * The property set of an exported interface, with inherited members resolved and
 * `?` read from the symbol rather than from the source text.
 */
const shapeOfExportedType = (typeName: string): TypeShape => {
  const exported = exportedSymbols.get(typeName);
  if (exported === undefined) {
    throw new Error(
      `${PORTS_INDEX_LABEL} exports no type named \`${typeName}\`.\n` +
        `Write the interface and export it, or record a skip with a reason in\n` +
        `SKIPPED_SCHEMAS / SKIPPED_DEFS, or add a TYPE_NAME_OVERRIDES entry if the\n` +
        `type exists under another name.\n` +
        `Exported from the ports index today: ${exportedTypeNames.join(', ')}`,
    );
  }

  const symbol =
    (exported.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(exported) : exported;
  const declared = checker.getDeclaredTypeOfSymbol(symbol);
  const properties = declared.getProperties();

  if (properties.length === 0) {
    throw new Error(
      `\`${typeName}\` declares no properties, so it cannot mirror an object schema. ` +
        `It is probably a union or an alias to a primitive.`,
    );
  }

  const required: string[] = [];
  const optional: string[] = [];
  for (const property of properties) {
    const name = property.getName();
    if ((property.flags & ts.SymbolFlags.Optional) !== 0) optional.push(name);
    else required.push(name);
  }

  return { required: required.sort(), optional: optional.sort() };
};

const shapeOfSchema = (schema: JsonSchemaObject): TypeShape => {
  const names = Object.keys(schema.properties ?? {});
  const requiredNames = new Set(schema.required ?? []);
  return {
    required: names.filter((name) => requiredNames.has(name)).sort(),
    optional: names.filter((name) => !requiredNames.has(name)).sort(),
  };
};

/** A human-readable, sorted `name` / `name?` listing, used for the failure diff. */
const flatten = (shape: TypeShape): readonly string[] =>
  [...shape.required, ...shape.optional.map((name) => `${name}?`)].sort();

const difference = (left: readonly string[], right: readonly string[]): readonly string[] =>
  left.filter((value) => !right.includes(value));

const explain = (binding: Binding, schemaShape: TypeShape, typeShape: TypeShape): string => {
  const schemaNames = [...schemaShape.required, ...schemaShape.optional];
  const typeNames = [...typeShape.required, ...typeShape.optional];
  const lines = [
    `ADR-0007: \`${binding.typeName}\` does not mirror content/schemas/${binding.file}${binding.pointer}.`,
    `  schema: content/schemas/${binding.file}${binding.pointer}`,
    `  type:   ${binding.typeName} (${PORTS_INDEX_LABEL})`,
  ];
  const report = (label: string, names: readonly string[]): void => {
    if (names.length > 0) lines.push(`  ${label}: ${names.join(', ')}`);
  };

  report('missing from the type (the schema has them)', difference(schemaNames, typeNames));
  report('extra in the type (the schema rejects them)', difference(typeNames, schemaNames));
  report(
    'required by the schema but optional in the type',
    difference(schemaShape.required, typeShape.required).filter((name) => typeNames.includes(name)),
  );
  report(
    'optional in the schema but required in the type',
    difference(schemaShape.optional, typeShape.optional).filter((name) => typeNames.includes(name)),
  );
  lines.push(
    '  The schema wins: fix the type, or change the schema first and then the type (ADR-0007).',
  );
  return lines.join('\n');
};

/* -------------------------------------------------------------------------- */
/* the gate                                                                   */
/* -------------------------------------------------------------------------- */

describe('content schemas are the port contract (ADR-0007)', () => {
  it('checks every schema in content/schemas that is not explicitly skipped', () => {
    expect(schemaFiles.length, 'content/schemas holds no *.schema.json files').toBeGreaterThan(0);

    // A skip is a decision about a file that exists. If a skipped schema is
    // renamed or deleted, this fails rather than silently protecting nothing.
    for (const [file, reason] of Object.entries(SKIPPED_SCHEMAS)) {
      expect(
        schemaFiles,
        `SKIPPED_SCHEMAS names ${file} (${reason}) but content/schemas has no such file — ` +
          `delete the entry or fix the name`,
      ).toContain(file);

      // ...and a decision that is still true. If the port type it says does not
      // exist has since been written, the skip is now hiding a real binding.
      const wouldBind = rootTypeNameFor(file);
      expect(
        exportedTypeNames,
        `SKIPPED_SCHEMAS names ${file} (${reason}) but the ports index now exports ` +
          `\`${wouldBind}\` — delete the entry so the root is checked against it`,
      ).not.toContain(wouldBind);
    }

    expect(checkedFiles.length, 'every schema is skipped; the gate would check nothing').toBeGreaterThan(
      0,
    );
    expect(allBindings.length).toBeGreaterThan(0);
  });

  it('keeps SKIPPED_DEFS and TYPE_NAME_OVERRIDES pinned to pointers that exist', () => {
    // Same staleness contract as SKIPPED_SCHEMAS, which had one and these two did
    // not: an entry keyed on a pointer no schema declares protects nothing and
    // renames nothing, while still reading like a decision.
    for (const [key, reason] of Object.entries(SKIPPED_DEFS)) {
      expect(
        candidateKeys,
        `SKIPPED_DEFS names ${key} (${reason}) but no schema declares an object at that ` +
          `pointer — delete the entry or fix the pointer.\n` +
          `Object schemas found today: ${candidateKeys.join(', ')}`,
      ).toContain(key);

      const skipped = allCandidates.find(
        (candidate) => `${candidate.file}${candidate.pointer}` === key,
      );
      const wouldBind = skipped?.typeName;
      if (wouldBind !== undefined) {
        expect(
          exportedTypeNames,
          `SKIPPED_DEFS names ${key} (${reason}) but the ports index now exports ` +
            `\`${wouldBind}\` — delete the entry so the two are checked against each other`,
        ).not.toContain(wouldBind);
      }
    }

    for (const [key, typeName] of Object.entries(TYPE_NAME_OVERRIDES)) {
      expect(
        candidateKeys,
        `TYPE_NAME_OVERRIDES maps ${key} to \`${typeName}\` but no schema declares an object ` +
          `at that pointer, so the override renames nothing — delete it or fix the pointer.\n` +
          `Object schemas found today: ${candidateKeys.join(', ')}`,
      ).toContain(key);
    }
  });

  it('marks every document type that no schema backs as SPECULATIVE (ADR-0007)', () => {
    const closure = documentTypeClosure();
    expect(
      closure.length,
      'no *Document / *Snapshot / *Bundle type is exported from the ports index, so this ' +
        'check would walk nothing',
    ).toBeGreaterThan(0);

    const unmarked = closure.filter(
      (name) => !boundTypeNames.has(name) && !isMarkedSpeculative(name),
    );
    const staleMarkers = closure.filter(
      (name) => boundTypeNames.has(name) && isMarkedSpeculative(name),
    );

    expect(
      unmarked,
      `ADR-0007: these types describe an authored or persisted document, no schema in ` +
        `content/schemas backs them, and they do not say so. A type nothing validates reads ` +
        `exactly like a type something validates — write the schema, or mark the declaration ` +
        `SPECULATIVE naming the schema file that does not exist yet.\n` +
        `Reached from the exported *Document / *Snapshot / *Bundle types: ${closure.join(', ')}`,
    ).toEqual([]);

    expect(
      staleMarkers,
      `these types are bound to a schema and still carry SPECULATIVE. The marker means "no ` +
        `validator backs this"; the schema now does, so delete the marker (ADR-0007).`,
    ).toEqual([]);
  });

  describe.each(schemaFiles.map((file) => [file] as const))('%s', (file) => {
    it('declares every object shape at the root or in $defs, never inline (ADR-0007)', () => {
      expect(
        inlineObjectsIn(file),
        `content/schemas/${file} declares an object schema inline. An inline object binds to no ` +
          `port type: it contributes one property name to its parent and its own shape is compared ` +
          `with nothing, so a schema saying { minZoom, maxZoom } and a port saying { zoom } are ` +
          `both green and the level ships reading undefined. Move it to "$defs" and "$ref" it; the ` +
          `$def then gets its own interface and its own check (ADR-0007).`,
      ).toEqual([]);
    });
  });

  describe.each(allBindings.map((binding) => [`${binding.file}${binding.pointer}`, binding] as const))(
    '%s',
    (_label, binding) => {
      it(`has exactly the properties of ${binding.typeName}, with the same required/optional split`, () => {
        const schemaShape = shapeOfSchema(binding.schema);
        const typeShape = shapeOfExportedType(binding.typeName);

        expect(flatten(typeShape), explain(binding, schemaShape, typeShape)).toEqual(
          flatten(schemaShape),
        );
      });

      it('is a closed statement (additionalProperties: false), so the type can mirror it exactly', () => {
        expect(
          binding.schema.additionalProperties,
          `content/schemas/${binding.file}${binding.pointer} must set "additionalProperties": false ` +
            `(ADR-0007): an open schema is a lower bound and ${binding.typeName} cannot mirror it.`,
        ).toBe(false);
      });
    },
  );
});
