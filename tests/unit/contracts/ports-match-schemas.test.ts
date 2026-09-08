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
 *
 * Since slice 1 task 1.2 it also compares **value types**, not only property
 * names. ADR-0007 recorded that gap honestly and deferred it: with one schema and
 * zero branded properties the mapping would have been guessed rather than tested.
 * The half that made it worth waiting for is the branded ids: a `$ref` to
 * `common.schema.json#/$defs/levelId` must be satisfied by `LevelId`, not by
 * `string`, or the check either rejects every id in the game or accepts every
 * string — and branded ids are the one thing ADR-0007 gave up code generation to
 * keep. The rule is bidirectional and derived from the `$ref` itself: a `$def`
 * whose name pascal-cases to a branded alias in `app/domain/ids.ts` demands that
 * brand, and every other scalar `$ref` demands the *absence* of one, so
 * `titleKey: LevelId` fails just as loudly as `id: string`.
 *
 * What the value check covers, per property, recursively: branded vs plain
 * scalars; `string` / `integer` / `number` / `boolean` / `null`; `enum` against a
 * union of literals, in both directions; arrays against `readonly T[]`;
 * `prefixItems` against a fixed-length tuple; `anyOf` against a TypeScript union
 * (which is how `IsoInstant | null` and `JumpAffordance | null` are stated); a
 * string-keyed map (`additionalProperties: { … }`) against an index signature;
 * and a `$ref` to an object `$def` against *that `$def`'s* bound interface, so
 * `camera: CameraTuning` cannot quietly become `camera: ParallaxLayer`.
 *
 * What it still does not cover is listed at the bottom of ADR-0007.
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
  // Same class as credits, and settled the same way: the palette is an input to
  // `make assets` and `make verify-art`, authored by the art agent and read by
  // nothing under `app/`. ADR-0004 (amended) draws the line — `content/` is what
  // the game loads at runtime, `assets/` is what the pipeline reads at build
  // time — so the file stays at `assets/style/palette.json` and only its schema
  // lives here.
  'palette.schema.json':
    'build-time artefact (ADR-0004) — an asset-pipeline and verify-art input, never read by the application at runtime',
  // The register of documents the question bank was written against. It is what
  // `verify-content` re-fetches and re-hashes; the game reads questions, never
  // the sources behind them, and `ContentRepository` exposes no way to ask for
  // one. If a screen ever cites a source to a player, that screen reads a
  // document, ADR-0007 applies to it, and this entry is deleted.
  'source.schema.json':
    'verification-time register (ADR-0003) — read by verify-content, never by the application at runtime',
};

/**
 * `$defs` objects that intentionally have no port type, keyed by
 * `<schema file>#<json pointer>`. Same staleness rules as `SKIPPED_SCHEMAS`: the
 * pointer must exist, and the type it would bind to must not.
 */
const SKIPPED_DEFS: Readonly<Record<string, string>> = {
  // The item shape of the build-time credits artefact above; it inherits that
  // entry's reason and disappears with it.
  //
  // The `localizedText` and `vec2` entries that stood here through slice 0 are
  // gone, deleted by the rule that put them there: slice 1's documents read both
  // shapes, so `LocalizedText` and `Vec2` are now port types with consumers, and
  // this table's staleness check fails on an entry whose type has been written.
  'credits.schema.json#/$defs/creditedAsset':
    'item of the build-time credits artefact (ADR-0004) — never read by the application at runtime',
  'palette.schema.json#/$defs/paletteRamp':
    'part of the build-time palette artefact (ADR-0004) — never read by the application at runtime',
  'palette.schema.json#/$defs/designResolution':
    'part of the build-time palette artefact (ADR-0004) — never read by the application at runtime',
  'source.schema.json#/$defs/sourceChapter':
    'part of the verification-time source register (ADR-0003) — never read by the application at runtime',
  'source.schema.json#/$defs/knownStaleness':
    'part of the verification-time source register (ADR-0003) — never read by the application at runtime',
  'source.schema.json#/$defs/liveCheck':
    'the live-source check record (ADR-0016) — read by verify-content, never by the application at runtime',
  'source.schema.json#/$defs/liveCheckPage':
    'one page of a live-source check (ADR-0016) — read by verify-content, never by the application at runtime',
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
  // Two roots whose port types were named before this convention existed, and
  // whose names are better than the ones the convention would derive. Both use a
  // reserved document suffix (ADR-0007), so both are still walked as document
  // roots; only the derivation `<file> -> <Name>Document` needed the pairing.
  'locale.schema.json#': 'LocaleBundle',
  'progress.schema.json#': 'ProgressSnapshot',
};

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
/* branded ids — the half of the value check that had to wait for slice 1     */
/* -------------------------------------------------------------------------- */

/**
 * `Brand<string, 'LevelId'>` is `string & { readonly [brand]: 'LevelId' }`. The
 * brand is read *structurally* — an intersection member that is an object with
 * exactly one property whose type is a string literal — rather than by matching
 * the mangled `__@brand@n` symbol name, so renaming the `unique symbol` in
 * `app/domain/ids.ts` cannot silently turn this check off.
 */
const brandOf = (type: ts.Type): string | null => {
  if (!type.isIntersection()) return null;
  for (const part of type.types) {
    if ((part.flags & ts.TypeFlags.Object) === 0) continue;
    const properties = part.getProperties();
    if (properties.length !== 1) continue;
    const only = checker.getTypeOfSymbol(properties[0]!);
    if (only.isStringLiteral()) return only.value;
  }
  return null;
};

const IDS_FILE = `${REPO_ROOT}app/domain/ids.ts`;

/**
 * Every branded alias the id vocabulary exports, keyed by its own name.
 *
 * This is what makes the `$ref`-to-brand rule derived rather than listed: a
 * `$def` named `levelId` demands `LevelId` because `LevelId` is here, and a new
 * branded id is covered the day `ids.ts` declares it. Reading the *set* from the
 * source is safe — the brand identity itself is still checked through the type
 * system, so a `LevelId` that had lost its brand would not be in here at all.
 */
const brandedIdNames = ((): ReadonlySet<string> => {
  const source = program.getSourceFile(IDS_FILE);
  if (source === undefined) throw new Error(`the TypeScript program did not load ${IDS_FILE}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) throw new Error('app/domain/ids.ts is not a module');
  const names = new Set<string>();
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    if (brandOf(declared) === symbol.getName()) names.add(symbol.getName());
  }
  return names;
})();

/* -------------------------------------------------------------------------- */
/* schema side                                                                */
/* -------------------------------------------------------------------------- */

interface JsonSchemaObject {
  readonly $id?: string;
  readonly title?: string;
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: unknown;
  readonly propertyNames?: unknown;
  readonly items?: unknown;
  readonly prefixItems?: readonly unknown[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly anyOf?: readonly JsonSchemaObject[];
  readonly oneOf?: readonly JsonSchemaObject[];
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

/**
 * One schema node that must have a mirror type: the root, or one `$def`.
 *
 * `kind` is `object` for a named property set and `enum` for a closed list of
 * literals. Enum `$defs` are bound too, because otherwise a union like
 * `LocomotionMode` could never be schema-backed and would have to carry a
 * `SPECULATIVE` marker for ever — a marker claiming "nothing validates this"
 * about a value `make validate-content` does in fact check.
 */
interface Binding {
  /** File name, e.g. `game.config.schema.json`. */
  readonly file: string;
  /** JSON pointer inside that file: `#` for the root, `#/$defs/<key>` otherwise. */
  readonly pointer: string;
  /** Exported type name in `app/application/ports/index.ts`. */
  readonly typeName: string;
  readonly kind: 'object' | 'enum';
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

/**
 * A closed list of literals. A `$def` that is a *branded scalar* — `levelId`,
 * `isoInstant` — is deliberately not one of these even when it carries an `enum`
 * (`localeCode` does): its port-side counterpart is a branded alias in
 * `app/domain/ids.ts`, not an exported union, and the brand rule checks it.
 */
const isEnumSchema = (schema: JsonSchemaObject): boolean =>
  Array.isArray(schema.enum) && schema.properties === undefined;

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
    if (!isBindablePointer(pointer)) return;
    const derived =
      pointer === '#'
        ? rootTypeNameFor(file)
        : pascalCase(node.title ?? pointer.slice('#/$defs/'.length));
    const typeName = TYPE_NAME_OVERRIDES[`${file}${pointer}`] ?? derived;

    if (isObjectSchema(node)) {
      if (pointer === '#' && SKIPPED_SCHEMAS[file] !== undefined) return;
      candidates.push({ file, pointer, typeName, kind: 'object', schema: node });
      return;
    }
    if (isEnumSchema(node) && pointer !== '#' && !brandedIdNames.has(typeName)) {
      candidates.push({ file, pointer, typeName, kind: 'enum', schema: node });
    }
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
/**
 * The one exemption, and the reason it is narrow.
 *
 * A conditional — `if` / `then` / `else` / `not`, reached through `allOf`,
 * `anyOf` or `oneOf` — is a *constraint*, not a shape. `question`'s "a verified
 * status must quote its evidence" and `quest`'s "only an `answer` step carries a
 * subject and a count" are both stated that way, and both have to list
 * `properties` to name the property they constrain. Banning that would either
 * lose the constraints or force each one into a `$def` demanding a port
 * interface of its own, which is worse than the defect the rule prevents.
 *
 * So the exemption holds only when the conditional cannot introduce a shape:
 * every property name it lists must already be declared by the nearest enclosing
 * bindable object. A conditional that names a property the parent does not have
 * is exactly the "compared with nothing" case and still fails.
 */
const CONDITIONAL_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']);

/** The root, or the `$def`, that a pointer sits under, plus the path down to it. */
const bindableAncestorOf = (pointer: string): { pointer: string; tail: readonly string[] } => {
  if (pointer.startsWith('#/$defs/')) {
    const segments = pointer.slice('#/$defs/'.length).split('/');
    return { pointer: `#/$defs/${segments[0] ?? ''}`, tail: segments.slice(1) };
  }
  return { pointer: '#', tail: pointer === '#' ? [] : pointer.slice(2).split('/') };
};

const inlineObjectsIn = (file: string): readonly string[] => {
  const nodes = new Map<string, JsonSchemaObject>();
  walkSubschemas(readSchema(file), (pointer, node) => nodes.set(pointer, node));

  const found: string[] = [];
  for (const [pointer, node] of nodes) {
    if (!isObjectSchema(node)) continue;
    if (isBindablePointer(pointer)) continue;

    const ancestor = bindableAncestorOf(pointer);
    const onlyConditionals = ancestor.tail.every(
      (segment) => CONDITIONAL_KEYWORDS.has(segment) || /^\d+$/u.test(segment),
    );
    const parent = nodes.get(ancestor.pointer);
    const declared = new Set(Object.keys(parent?.properties ?? {}));
    const namesOnlyDeclared = Object.keys(node.properties ?? {}).every((name) =>
      declared.has(name),
    );
    if (onlyConditionals && parent !== undefined && namesOnlyDeclared) continue;

    found.push(pointer);
  }
  return found;
};

const allCandidates = schemaFiles.flatMap(candidatesFor);
const candidateKeys = allCandidates.map((binding) => `${binding.file}${binding.pointer}`);
const allBindings = allCandidates.filter(
  (binding) => SKIPPED_DEFS[`${binding.file}${binding.pointer}`] === undefined,
);
const checkedFiles = [...new Set(allBindings.map((binding) => binding.file))].sort();


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
/* value types — the gap ADR-0007 recorded in slice 0 and deferred to 1.2      */
/* -------------------------------------------------------------------------- */

/** `$id` -> file, so a cross-file `$ref` resolves without a network fetch. */
const fileBySchemaId = new Map<string, string>(
  schemaFiles.flatMap((file) => {
    const id = readSchema(file).$id;
    return id === undefined ? [] : [[id, file] as const];
  }),
);

const rootByFile = new Map<string, JsonSchemaObject>(
  schemaFiles.map((file) => [file, readSchema(file)] as const),
);

interface ResolvedRef {
  readonly file: string;
  readonly pointer: string;
  readonly node: JsonSchemaObject;
}

/** Follows `#/$defs/x` and `https://…/common.schema.json#/$defs/x` alike. */
const resolveRef = (ref: string, fromFile: string): ResolvedRef | null => {
  const hash = ref.indexOf('#');
  const base = hash === -1 ? ref : ref.slice(0, hash);
  const fragment = hash === -1 ? '' : ref.slice(hash + 1);
  const file = base === '' ? fromFile : fileBySchemaId.get(base);
  if (file === undefined) return null;

  let node = rootByFile.get(file);
  if (node === undefined) return null;
  for (const raw of fragment.split('/').filter((part) => part.length > 0)) {
    const key = raw.replace(/~1/gu, '/').replace(/~0/gu, '~');
    const next = (node as unknown as Record<string, unknown>)[key];
    if (!isRecord(next)) return null;
    node = next as JsonSchemaObject;
  }
  return { file, pointer: fragment === '' ? '#' : `#${fragment}`, node };
};

const bindingAt = new Map<string, Binding>(
  allBindings.map((binding) => [`${binding.file}${binding.pointer}`, binding] as const),
);

/** The last segment of a pointer, pascal-cased: `#/$defs/levelId` -> `LevelId`. */
const refNameOf = (pointer: string): string =>
  pascalCase(pointer.slice(pointer.lastIndexOf('/') + 1));

const typeNameOf = (type: ts.Type): string | undefined =>
  type.aliasSymbol?.getName() ?? type.getSymbol()?.getName();

const show = (type: ts.Type): string => checker.typeToString(type);

const describeNode = (node: JsonSchemaObject): string => {
  if (node.$ref !== undefined) return `$ref ${node.$ref}`;
  const json = JSON.stringify(node);
  return json.length > 90 ? `${json.slice(0, 87)}...` : json;
};

/**
 * `boolean` is a union of `true | false` inside the compiler, so it must not be
 * split the way a real union is; everything else splits normally.
 */
const constituentsOf = (type: ts.Type): readonly ts.Type[] => {
  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) return [type];
  return type.isUnion() ? type.types : [type];
};

const withoutUndefined = (type: ts.Type): ts.Type => {
  if (!type.isUnion()) return type;
  const kept = type.types.filter((part) => (part.flags & ts.TypeFlags.Undefined) === 0);
  return kept.length === 1 ? kept[0]! : type;
};

/** The primitive under a brand: `LevelId` is `string`, `EpochMillis` is `number`. */
const scalarFlagsOf = (type: ts.Type): ts.TypeFlags => {
  if (!type.isIntersection()) return type.flags;
  let flags = ts.TypeFlags.Never;
  for (const part of type.types) {
    if ((part.flags & ts.TypeFlags.Object) === 0) flags |= part.flags;
  }
  return flags;
};

const literalValueOf = (type: ts.Type): string | number | boolean | null | undefined => {
  if (type.isStringLiteral()) return type.value;
  if (type.isNumberLiteral()) return type.value;
  if ((type.flags & ts.TypeFlags.BooleanLiteral) !== 0) return show(type) === 'true';
  if ((type.flags & ts.TypeFlags.Null) !== 0) return null;
  return undefined;
};

/** `readonly T[]` and `T[]` both; a tuple is handled separately. */
const arrayElementOf = (type: ts.Type): ts.Type | null => {
  if (checker.isTupleType(type)) return null;
  const name = type.getSymbol()?.getName();
  if (name !== 'Array' && name !== 'ReadonlyArray') return null;
  return typeArgumentsOf(type)[0] ?? null;
};

/**
 * Compares one schema node with one TypeScript type, recursively.
 *
 * `brand` carries a demand down through a `$ref` chain: a property that `$ref`s
 * `common.schema.json#/$defs/levelId` must be `LevelId`, and the string check at
 * the bottom of that chain is the place that can say so. `brand === null` is the
 * opposite demand and is just as load-bearing: a plain `"type": "string"` must
 * *not* be satisfied by a branded id, or `titleKey: LevelId` would pass.
 */
const valueMismatches = (
  node: JsonSchemaObject,
  file: string,
  type: ts.Type,
  path: string,
  brand: string | null,
): readonly string[] => {
  if (node.$ref !== undefined) {
    const target = resolveRef(node.$ref, file);
    if (target === null) return [`${path}: cannot resolve "$ref": "${node.$ref}"`];

    const refName = refNameOf(target.pointer);
    if (brandedIdNames.has(refName)) {
      return valueMismatches(target.node, target.file, type, path, refName);
    }

    const bound = bindingAt.get(`${target.file}${target.pointer}`);
    if (bound !== undefined) {
      if (typeNameOf(type) !== bound.typeName) {
        return [
          `${path}: the schema $refs ${target.file}${target.pointer}, which binds to ` +
            `\`${bound.typeName}\`; the type is \`${show(type)}\``,
        ];
      }
      return bound.kind === 'enum'
        ? enumMismatches(target.node, type, path, brand)
        : [];
    }
    return valueMismatches(target.node, target.file, type, path, brand);
  }

  const branches = node.anyOf ?? node.oneOf;
  if (branches !== undefined) return unionMismatches(branches, file, type, path, brand);

  if (Array.isArray(node.type) && node.type.length > 1) {
    return unionMismatches(
      node.type.map((one) => ({ ...node, type: one }) as JsonSchemaObject),
      file,
      type,
      path,
      brand,
    );
  }

  if (node.enum !== undefined) return enumMismatches(node, type, path, brand);
  if (node.const !== undefined) return [];

  const kind = Array.isArray(node.type) ? node.type[0] : node.type;
  if (kind === undefined) return [];

  if (kind === 'array') {
    if (node.prefixItems !== undefined) {
      if (!checker.isTupleType(type)) {
        return [
          `${path}: the schema is a fixed-length tuple of ${String(node.prefixItems.length)}; ` +
            `the type is \`${show(type)}\`, which is not a tuple`,
        ];
      }
      const elements = checker.getTypeArguments(type as ts.TypeReference);
      if (elements.length !== node.prefixItems.length) {
        return [
          `${path}: the schema has ${String(node.prefixItems.length)} prefixItems; ` +
            `\`${show(type)}\` has ${String(elements.length)} elements`,
        ];
      }
      return node.prefixItems.flatMap((item, index) =>
        isRecord(item)
          ? valueMismatches(
              item as JsonSchemaObject,
              file,
              elements[index]!,
              `${path}[${String(index)}]`,
              null,
            )
          : [],
      );
    }
    const element = arrayElementOf(type);
    if (element === null) {
      return [`${path}: the schema is an array; the type is \`${show(type)}\``];
    }
    return isRecord(node.items)
      ? valueMismatches(node.items as JsonSchemaObject, file, element, `${path}[]`, null)
      : [];
  }

  if (kind === 'object') {
    // A named property set is bound and compared by the property-set test; the
    // only thing left here is the free-form map, which must be an index signature.
    if (node.properties !== undefined) return [];
    if (!isRecord(node.additionalProperties)) return [];
    const index = checker.getIndexInfoOfType(type, ts.IndexKind.String);
    if (index === undefined) {
      return [
        `${path}: the schema is a string-keyed map; \`${show(type)}\` has no string index signature`,
      ];
    }
    return valueMismatches(
      node.additionalProperties as JsonSchemaObject,
      file,
      index.type,
      `${path}[key]`,
      null,
    );
  }

  return scalarMismatches(kind, type, path, brand);
};

const SCALAR_FLAGS: Readonly<Record<string, ts.TypeFlags>> = {
  string: ts.TypeFlags.StringLike,
  integer: ts.TypeFlags.NumberLike,
  number: ts.TypeFlags.NumberLike,
  boolean: ts.TypeFlags.BooleanLike,
  null: ts.TypeFlags.Null,
};

const scalarMismatches = (
  kind: string,
  type: ts.Type,
  path: string,
  brand: string | null,
): readonly string[] => {
  const expected = SCALAR_FLAGS[kind];
  if (expected === undefined) return [];

  const found: string[] = [];
  if ((scalarFlagsOf(type) & expected) === 0) {
    found.push(`${path}: the schema says "${kind}"; the type is \`${show(type)}\``);
  }

  const actualBrand = brandOf(type);
  if (brand !== null && actualBrand !== brand) {
    found.push(
      `${path}: the schema $refs the branded id \`${brand}\`; the type is \`${show(type)}\`` +
        (actualBrand === null
          ? ' — a plain string here would accept any string, which is what the id vocabulary exists to prevent'
          : ` (branded \`${actualBrand}\`)`),
    );
  }
  if (brand === null && actualBrand !== null) {
    found.push(
      `${path}: the schema says "${kind}" with no branded $ref; the type is branded ` +
        `\`${actualBrand}\` — $ref the branded def, or drop the brand`,
    );
  }
  return found;
};

const enumMismatches = (
  node: JsonSchemaObject,
  type: ts.Type,
  path: string,
  brand: string | null,
): readonly string[] => {
  // A branded scalar keeps its brand rather than becoming a literal union, so the
  // brand rule answers for it and the literal comparison would always fail.
  if (brand !== null) {
    const kind = Array.isArray(node.type) ? node.type[0] : node.type;
    return scalarMismatches(kind ?? 'string', type, path, brand);
  }

  const expected = new Set((node.enum ?? []).map((value) => JSON.stringify(value)));
  const actual = new Set<string>();
  for (const part of constituentsOf(type)) {
    if ((part.flags & ts.TypeFlags.BooleanLike) !== 0 && !part.isLiteral()) {
      actual.add(JSON.stringify(true));
      actual.add(JSON.stringify(false));
      continue;
    }
    const value = literalValueOf(part);
    if (value === undefined) {
      return [
        `${path}: the schema is an enum of ${[...expected].join(', ')}; the type is ` +
          `\`${show(type)}\`, which is not a union of literals`,
      ];
    }
    actual.add(JSON.stringify(value));
  }

  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length === 0 && extra.length === 0) return [];
  return [
    `${path}: enum mismatch against \`${show(type)}\`` +
      (missing.length > 0 ? ` — missing from the type: ${missing.join(', ')}` : '') +
      (extra.length > 0 ? ` — not in the schema: ${extra.join(', ')}` : ''),
  ];
};

const unionMismatches = (
  branches: readonly JsonSchemaObject[],
  file: string,
  type: ts.Type,
  path: string,
  brand: string | null,
): readonly string[] => {
  const parts = constituentsOf(type);
  const found: string[] = [];
  const matched = new Set<ts.Type>();

  for (const branch of branches) {
    const hit = parts.find(
      (part) => valueMismatches(branch, file, part, path, brand).length === 0,
    );
    if (hit === undefined) {
      found.push(
        `${path}: no member of \`${show(type)}\` satisfies the schema branch ${describeNode(branch)}`,
      );
    } else {
      matched.add(hit);
    }
  }
  for (const part of parts) {
    if (matched.has(part)) continue;
    const satisfied = branches.some(
      (branch) => valueMismatches(branch, file, part, path, brand).length === 0,
    );
    if (!satisfied) {
      found.push(`${path}: \`${show(part)}\` satisfies no branch the schema offers`);
    }
  }
  return found;
};

/** Every property of one bound object schema, compared value-type by value-type. */
const valueMismatchesFor = (binding: Binding): readonly string[] => {
  const exported = exportedSymbols.get(binding.typeName);
  if (exported === undefined) return [];
  const declared = checker.getDeclaredTypeOfSymbol(aliasedSymbolOf(exported));
  const properties = new Map(
    declared.getProperties().map((property) => [property.getName(), property] as const),
  );

  const found: string[] = [];
  for (const [name, raw] of Object.entries(binding.schema.properties ?? {})) {
    if (!isRecord(raw)) continue;
    const property = properties.get(name);
    if (property === undefined) continue; // the property-set test reports this
    found.push(
      ...valueMismatches(
        raw as JsonSchemaObject,
        binding.file,
        withoutUndefined(checker.getTypeOfSymbol(property)),
        `${binding.typeName}.${name}`,
        null,
      ),
    );
  }
  return found;
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

  describe.each(
    allBindings
      .filter((binding) => binding.kind === 'object')
      .map((binding) => [`${binding.file}${binding.pointer}`, binding] as const),
  )('%s', (_label, binding) => {
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

    it(`holds the same value types as ${binding.typeName}, branded ids included`, () => {
      expect(
        valueMismatchesFor(binding),
        `ADR-0007: \`${binding.typeName}\` and content/schemas/${binding.file}${binding.pointer} ` +
          `agree on every property name and disagree about what the properties hold. Until slice 1 ` +
          `task 1.2 this was invisible: the two sides could agree on every key while one said ` +
          `\`readonly LevelId[]\` and the other said \`number\`. The schema wins.`,
      ).toEqual([]);
    });
  });

  describe.each(
    allBindings
      .filter((binding) => binding.kind === 'enum')
      .map((binding) => [`${binding.file}${binding.pointer}`, binding] as const),
  )('%s', (_label, binding) => {
    it(`is exactly the union \`${binding.typeName}\` declares`, () => {
      const exported = exportedSymbols.get(binding.typeName);
      expect(
        exported,
        `content/schemas/${binding.file}${binding.pointer} is a closed list of literals and ` +
          `${PORTS_INDEX_LABEL} exports no type named \`${binding.typeName}\`. An enum $def is ` +
          `bound like an object one, so a union such as \`LocomotionMode\` is schema-backed rather ` +
          `than permanently SPECULATIVE — write the union, or rename the $def.`,
      ).toBeDefined();
      if (exported === undefined) return;

      const declared = checker.getDeclaredTypeOfSymbol(aliasedSymbolOf(exported));
      expect(
        enumMismatches(binding.schema, declared, binding.typeName, null),
        `ADR-0007: \`${binding.typeName}\` and content/schemas/${binding.file}${binding.pointer} ` +
          `do not offer the same values. Adding a locomotion mode to one and not the other is how ` +
          `a level ships naming a mode nothing can create.`,
      ).toEqual([]);
    });
  });
});
