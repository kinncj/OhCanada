/**
 * Architecture lint for TrueNorth — the machine-readable form of ADR-0005.
 *
 * Every rule below states the boundary it defends in its `comment`. If a rule and
 * ADR-0005 ever disagree, the ADR is the source of truth and the rule is the bug.
 * Run: `npx depcruise app common --config .dependency-cruiser.cjs` (wired into
 * `make lint`). A violation fails CI; it is not a warning.
 *
 * `tsPreCompilationDeps: true` matters here: almost every edge across these layers
 * is an `import type`, which disappears at runtime. Without it a domain file could
 * import a Phaser type and this config would see nothing.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'app/domain holds entities and rules and imports nothing outside domain and common ' +
        '(ADR-0005). No framework, no DOM, no clock, no RNG, no adapter, not even the ' +
        'application layer above it. This is what makes the domain testable with no browser ' +
        'and what earns it the >= 90% coverage gate. Need something from outside? Take it as ' +
        'a parameter (see the Clock and RandomSource ports).',
      severity: 'error',
      from: { path: '^app/domain' },
      to: { pathNot: '^(app/domain|common)' },
    },
    {
      name: 'application-no-frameworks',
      comment:
        'app/application holds use cases and ports and imports domain and common only ' +
        '(ADR-0005). Ports are interfaces; the moment a use case imports Phaser, the DOM or ' +
        'an adapter, the use case can no longer be run in a unit test and the port stopped ' +
        'being a seam. Concretes are wired in app/bootstrap, nowhere else.',
      severity: 'error',
      from: { path: '^app/application' },
      to: { pathNot: '^(app/application|app/domain|common)' },
    },
    {
      name: 'adapters-do-not-import-each-other',
      comment:
        'Adapters never import each other (ADR-0005). Each app/adapters/<name> directory ' +
        'implements application ports and knows only its own technology; the audio adapter ' +
        'must not reach into the Phaser adapter, and the input adapter must not reach into ' +
        'persistence. Adapters that need to cooperate do it over the typed event bus or ' +
        'through a port. This rule is what keeps "swap Rive for sprite sheets" a one-directory ' +
        'change.',
      severity: 'error',
      from: { path: '^app/adapters/([^/]+)/' },
      to: { path: '^app/adapters/', pathNot: '^app/adapters/$1/' },
    },
    {
      name: 'adapters-not-into-ui-or-bootstrap',
      comment:
        'An adapter is driven, never driving. It may not import a DOM screen from app/ui nor ' +
        'reach into app/bootstrap for a wired instance — that inverts the composition root and ' +
        'makes the adapter untestable in isolation. Adapters publish facts on the event bus; ' +
        'the UI listens.',
      severity: 'error',
      from: { path: '^app/adapters' },
      to: { path: '^app/(ui|bootstrap)' },
    },
    {
      name: 'ui-not-into-adapters-or-bootstrap',
      comment:
        'app/ui is DOM only and never imports adapters or scenes (CLAUDE.md, ADR-0005). ' +
        'Question cards, dialogue, menus and settings are accessible DOM with ARIA roles; they ' +
        'talk to the game through ports and the event bus. Importing an adapter would drag ' +
        'Phaser into the DOM bundle and put the a11y layer behind the canvas lifecycle.',
      severity: 'error',
      from: { path: '^app/ui' },
      to: { path: '^app/(adapters|bootstrap)' },
    },
    {
      name: 'outer-layers-use-domain-vocabulary-only',
      comment:
        'app/adapters and app/ui may import the id vocabulary (app/domain/ids) and nothing else ' +
        'from app/domain (ADR-0005). Ids are branded strings that exist precisely so every layer ' +
        'can name the same level, quest or question; the rest of app/domain is *rules*, and a ' +
        'rule executed inside an adapter or a DOM screen is a rule the >= 90% domain coverage ' +
        'gate never runs, because it can only be reached through a canvas or a browser. An ' +
        'adapter that needs domain data takes it as a port type (app/application/ports) or ' +
        'reads it off the event bus; it does not reach past the application layer for an entity. ' +
        'Without this rule the layering only constrains what domain imports, never who imports ' +
        'domain, which is the half that leaks in practice.',
      severity: 'error',
      from: { path: '^app/(adapters|ui)' },
      to: { path: '^app/domain', pathNot: '^app/domain/ids([.]ts$|/)' },
    },
    {
      name: 'adapters-do-not-invoke-use-cases',
      comment:
        'An adapter is driven, never driving (ADR-0005): it implements ports and publishes facts ' +
        'on the typed event bus, and app/bootstrap is what subscribes a use case to those facts. ' +
        'Importing app/application/use-cases from an adapter inverts that — the input adapter ' +
        'starts orchestrating the game, the use case can no longer be unit-tested without the ' +
        'adapter, and "swap the adapter" stops being a one-directory change. Importing a *port* ' +
        'from app/application/ports stays allowed and is the point of the directory; this rule ' +
        'is deliberately narrower than "adapters do not import the application". app/ui is not ' +
        'named here: the UI is the human driving the game, and whether it calls a use case or ' +
        'goes through the bus is a slice-1 decision that needs an ADR, not a rule guessed today.',
      severity: 'error',
      from: { path: '^app/adapters' },
      to: { path: '^app/application/use-cases' },
    },
    {
      name: 'common-is-standalone',
      comment:
        'common/ holds primitives every layer may use (Result, the typed event bus). It is a ' +
        'leaf: it must not import from app/ in any direction. The moment common reaches back ' +
        'into app it becomes the shared grab-bag ADR-0005 rejected, and the layering below it ' +
        'stops meaning anything.',
      severity: 'error',
      from: { path: '^common' },
      to: { path: '^app' },
    },
    {
      name: 'no-frameworks-in-core',
      comment:
        'app/domain and app/application must not depend on phaser, @rive-app/*, howler or ' +
        'i18next (ADR-0005). These are adapter concerns behind ports: ICharacterRenderer hides ' +
        'Rive, AudioPort hides howler, LocalizerPort hides i18next, and the scene adapter hides ' +
        'Phaser. Named explicitly, on top of domain-is-pure and application-no-frameworks, so ' +
        'the failure message says which framework leaked instead of only which layer did.',
      severity: 'error',
      from: { path: '^app/(domain|application)' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg'],
        path: '^node_modules/(phaser|@rive-app/[^/]+|howler|i18next)(/|$)',
      },
    },
    {
      name: 'no-scheduler-library-in-app',
      comment:
        'ts-fsrs is a TEST ORACLE, not a runtime dependency (ADR-0012). The scheduling maths ' +
        'is written out in app/domain/scheduling and pinned against the library by exact ' +
        'equality in tests/unit/domain, which is legal precisely where the import is not. ' +
        'domain-is-pure and application-no-frameworks already stop it reaching the two layers ' +
        'that would want it; this rule closes the remaining door, an adapter importing it and ' +
        'pushing the arithmetic outside the >= 90% coverage gate, which is the outcome ADR-0012 ' +
        'rejected. If you are here because you want the library at runtime, that is an ADR, not ' +
        'an import.',
      severity: 'error',
      from: { path: '^app' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg'],
        path: '^node_modules/ts-fsrs(/|$)',
      },
    },
    {
      name: 'no-circular',
      comment:
        'No cycles, including cycles that only exist in the type graph. A cycle means two ' +
        'modules are one module that has not admitted it yet: it breaks tree-shaking, produces ' +
        'undefined-at-import-time bugs under ESM, and makes a unit test drag in half the app. ' +
        'Break it by moving the shared type down a layer (usually into common/ or domain).',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Shipped code must not import a devDependency. Vitest, Playwright, the asset packers ' +
        'and the build tooling are not in the runtime bundle; importing one from app/ or ' +
        'common/ either bloats the 8 MB initial payload or breaks the production build. This ' +
        'rule carries no test-file exemption on purpose: `depcruise app common` never has a ' +
        'test file in scope (they live under tests/), so a `pathNot` for *.test.ts would only ' +
        'be an exemption that reads as if it applied to something.',
      severity: 'error',
      from: { path: '^(app|common)' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'no-unresolvable',
      comment:
        'Every import must resolve. An unresolvable module means a typo, a missing dependency, ' +
        'or a path alias that is in tsconfig but not in the bundler — and it silently disables ' +
        'every rule above for that edge, because dependency-cruiser cannot classify what it ' +
        'cannot find.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    /** Type-only imports are real architectural edges. Without this, most of ours are invisible. */
    tsPreCompilationDeps: true,
    /** Resolves the @domain/* @application/* @adapters/* @ui/* @common/* @content/* aliases. */
    tsConfig: { fileName: 'tsconfig.json' },
    /**
     * Note: node_modules is NOT excluded here. `exclude` drops modules from the graph
     * entirely, which would make the npm edges invisible and silently disable
     * no-frameworks-in-core and not-to-dev-dep. `doNotFollow` above is the right tool:
     * it keeps the edge and stops the traversal.
     *
     * The dist/coverage patterns are root-anchored on purpose: an unanchored `dist`
     * also matches node_modules/howler/dist/... and node_modules/vitest/dist/...,
     * which would quietly hide exactly the edges no-frameworks-in-core and
     * not-to-dev-dep exist to catch.
     */
    exclude: { path: '^(dist|coverage)/|(^|/)[.]git(/|$)' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
