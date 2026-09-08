/**
 * The boot parser must *derive* its types from `@application/ports`, never
 * restate them.
 *
 * `app/adapters/phaser/boot-config.ts` hand-parses `content/game.config.json`
 * instead of running ajv, because boot is on the 6 s time-to-play budget and a
 * JSON Schema validator has no business in the initial chunk. That decision is
 * sound and this file does not challenge it. What it guards is the consequence:
 * a hand parser that also *declares* the config's shape makes
 * `content/game.config.json` a document described in two places, and the second
 * description is invisible to whoever edits the first. That is exactly how the
 * `levelOrder`/`levels` defect survived a whole slice — the port could be wrong
 * for free because nothing downstream depended on it.
 *
 * So `BootConfig` is expressed in terms of `GameConfigDocument` and
 * `FeatureFlags`, and the palette is the port's `ThemeColours`. The gate below
 * asserts that mechanically: every property of `BootConfig` must be *declared*
 * in `app/application/ports`, unless it is named in `LOCAL_PROPERTIES` with a
 * reason. `Pick<T, K>` keeps the original declaration site, so a property that
 * came through the port is distinguishable from one retyped by hand even though
 * the two are structurally identical.
 *
 * With this in place, `tests/unit/contracts/ports-match-schemas.test.ts` — which
 * pins the port types to `content/schemas/*.schema.json` — transitively protects
 * this adapter too: rename a property in the schema and the port test fails; fix
 * the port and this adapter stops compiling. Nobody has to notice.
 *
 * The imports are checked to be `import type` as well: the derivation is allowed
 * to cost nothing at runtime, and if it ever stops being type-only it has put
 * the application layer (and, one import later, ajv) on the boot path.
 */

import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const BOOT_CONFIG = `${REPO_ROOT}app/adapters/phaser/boot-config.ts`;
const BOOT_CONFIG_LABEL = 'app/adapters/phaser/boot-config.ts';
const PORTS_DIR = 'app/application/ports/';

/**
 * Properties of `BootConfig` that are genuinely the renderer's own and cannot be
 * lifted from a port type. Each needs a reason: an entry here is a statement
 * that `content/game.config.json` has no such property, not a shortcut around a
 * property it does have.
 */
const LOCAL_PROPERTIES: Readonly<Record<string, string>> = {
  // Not a config property. It is `palette.sky` under the name Phaser wants for
  // its clear colour, computed by the parser after the theme merge.
  backgroundColor: "derived, not read: Phaser's clear colour, equal to palette.sky",
  // The config's block is `theme` and it is optional; this is the same five
  // colours after the per-key merge over DEFAULT_PALETTE, so it is always
  // present and the renderer can draw from it unconditionally. The *type* is
  // still the port's `ThemeColours` — asserted separately below.
  palette: 'the config theme is optional; this is the merged, always-complete result',
};

/** Value exports whose annotated type must also come from the port. */
const PORT_TYPED_VALUES: readonly string[] = ['DEFAULT_PALETTE'];

const buildProgram = (): ts.Program => {
  const configPath = `${REPO_ROOT}tsconfig.json`;
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    throw new Error(
      `cannot read tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, ' ')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, REPO_ROOT);

  // Same `paths` resolution as the build; nothing is emitted and nothing is
  // typechecked here — this program exists to read declaration sites.
  return ts.createProgram([BOOT_CONFIG], {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
};

const program = buildProgram();
const checker = program.getTypeChecker();
const source = program.getSourceFile(BOOT_CONFIG);

if (source === undefined) {
  throw new Error(`the TypeScript program did not load ${BOOT_CONFIG_LABEL}`);
}

const moduleSymbol = checker.getSymbolAtLocation(source);
if (moduleSymbol === undefined) {
  throw new Error(`${BOOT_CONFIG_LABEL} is not a module`);
}

const exportedSymbols = new Map<string, ts.Symbol>(
  checker.getExportsOfModule(moduleSymbol).map((symbol) => [symbol.getName(), symbol]),
);

/** Repository-relative files a symbol is declared in, `[]` for synthesised ones. */
const declarationFiles = (symbol: ts.Symbol | undefined): readonly string[] =>
  (symbol?.declarations ?? []).map((declaration) =>
    declaration.getSourceFile().fileName.replace(REPO_ROOT, ''),
  );

const isFromPorts = (files: readonly string[]): boolean =>
  files.length > 0 && files.every((file) => file.startsWith(PORTS_DIR));

const declaredTypeOf = (typeName: string): ts.Type => {
  const exported = exportedSymbols.get(typeName);
  if (exported === undefined) {
    throw new Error(
      `${BOOT_CONFIG_LABEL} exports no type named \`${typeName}\`. ` +
        `Exported today: ${[...exportedSymbols.keys()].sort().join(', ')}`,
    );
  }
  const symbol =
    (exported.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(exported) : exported;
  return checker.getDeclaredTypeOfSymbol(symbol);
};

/** The symbol naming a property's type: `ThemeColours` for `palette`, none for `string`. */
const typeSymbolOfProperty = (property: ts.Symbol): ts.Symbol | undefined => {
  const at = property.declarations?.[0] ?? source;
  const type = checker.getTypeOfSymbolAtLocation(property, at);
  return type.aliasSymbol ?? type.getSymbol();
};

const bootConfigProperties = declaredTypeOf('BootConfig').getProperties();

describe('BootConfig derives its shape from @application/ports', () => {
  it('describes a non-empty shape, so the checks below cannot pass vacuously', () => {
    expect(bootConfigProperties.length).toBeGreaterThan(4);
  });

  it.each(bootConfigProperties.map((property) => [property.getName(), property] as const))(
    '`%s` is declared by the port, not restated here',
    (name, property) => {
      const reason = LOCAL_PROPERTIES[name];
      if (reason !== undefined) {
        expect(reason.length, `LOCAL_PROPERTIES["${name}"] needs a reason`).toBeGreaterThan(0);
        return;
      }

      const files = declarationFiles(property);
      expect(
        isFromPorts(files),
        `BootConfig.${name} is declared in ${files.join(', ') || '(nowhere)'} rather than in ` +
          `${PORTS_DIR}. Express it in terms of the port — e.g. ` +
          `\`Pick<GameConfigDocument, '${name}'>\` — so a rename in ` +
          `content/schemas/game.config.schema.json breaks the build here instead of at runtime. ` +
          `If content/game.config.json genuinely has no such property, add it to ` +
          `LOCAL_PROPERTIES with the reason.`,
      ).toBe(true);
    },
  );

  it('keeps at least the four properties the port and the schema share', () => {
    const derived = bootConfigProperties
      .filter((property) => isFromPorts(declarationFiles(property)))
      .map((property) => property.getName())
      .sort();

    expect(derived).toEqual(
      expect.arrayContaining([
        'debugOverlay',
        'defaultLocale',
        'designHeight',
        'designWidth',
        'title',
        'version',
      ]),
    );
  });

  it('does not name a local property that BootConfig no longer has', () => {
    const names = bootConfigProperties.map((property) => property.getName());
    for (const name of Object.keys(LOCAL_PROPERTIES)) {
      expect(
        names,
        `LOCAL_PROPERTIES names "${name}" but BootConfig has no such property — delete the entry`,
      ).toContain(name);
    }
  });

  it('takes the palette type from the port instead of declaring five colours twice', () => {
    const palette = bootConfigProperties.find((property) => property.getName() === 'palette');
    expect(palette, 'BootConfig has no `palette`').toBeDefined();
    if (palette === undefined) return;

    const files = declarationFiles(typeSymbolOfProperty(palette));
    expect(
      isFromPorts(files),
      `BootConfig.palette is typed by something declared in ${files.join(', ') || '(nowhere)'}. ` +
        `Use ThemeColours from @application/ports: the config theme block and the renderer ` +
        `palette are the same five colours, and declaring them twice is the drift this gate exists for.`,
    ).toBe(true);
  });

  it.each(PORT_TYPED_VALUES)('types the exported `%s` with a port type', (valueName) => {
    const exported = exportedSymbols.get(valueName);
    expect(exported, `${BOOT_CONFIG_LABEL} exports no \`${valueName}\``).toBeDefined();
    if (exported === undefined) return;

    const type = checker.getTypeOfSymbolAtLocation(exported, exported.declarations?.[0] ?? source);
    const files = declarationFiles(type.aliasSymbol ?? type.getSymbol());
    expect(
      isFromPorts(files),
      `${valueName} is typed by something declared in ${files.join(', ') || '(nowhere)'} rather ` +
        `than by a port type. Annotate it with the port's type so the fallback cannot drift from ` +
        `the shape the config declares.`,
    ).toBe(true);
  });
});

describe('the derivation stays free at runtime', () => {
  const portImports = source.statements
    .filter(ts.isImportDeclaration)
    .filter(
      (node) =>
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.startsWith('@application/'),
    );

  it('imports the ports at all', () => {
    expect(
      portImports.length,
      `${BOOT_CONFIG_LABEL} imports nothing from @application/ports, so it is describing ` +
        `content/game.config.json on its own again`,
    ).toBeGreaterThan(0);
  });

  it.each(portImports.map((node) => [node.moduleSpecifier.getText(), node] as const))(
    'imports %s as types only, so no application code reaches the boot path',
    (_label, node) => {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const everySpecifierIsTypeOnly =
        bindings !== undefined &&
        ts.isNamedImports(bindings) &&
        bindings.elements.every((element) => element.isTypeOnly);

      expect(
        clause?.isTypeOnly === true || everySpecifierIsTypeOnly,
        `${BOOT_CONFIG_LABEL} imports ${node.moduleSpecifier.getText()} as a value. Boot is on ` +
          `the 6 s time-to-play budget: use \`import type\` so the edge is erased and ajv stays ` +
          `off the initial chunk.`,
      ).toBe(true);
    },
  );
});
