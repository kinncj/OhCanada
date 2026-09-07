/** Architecture rules. See docs/architecture.md and ADR-0001. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'domain imports nothing outside domain and common',
      from: { path: '^app/domain' },
      to: { pathNot: '^(app/domain|common)', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'application-no-frameworks',
      severity: 'error',
      comment: 'application imports domain and common only (never three, rapier, DOM adapters)',
      from: { path: '^app/application' },
      to: { pathNot: '^(app/application|app/domain|common)' },
    },
    {
      name: 'adapters-do-not-import-each-other',
      severity: 'error',
      from: { path: '^app/adapters/([^/]+)/' },
      to: { path: '^app/adapters/([^/]+)/', pathNot: '^app/adapters/$1/' },
    },
    {
      name: 'adapters-not-into-ui-or-bootstrap',
      severity: 'error',
      from: { path: '^app/adapters' },
      to: { path: '^app/(ui|bootstrap)' },
    },
    {
      name: 'ui-not-into-adapters-or-bootstrap',
      severity: 'error',
      from: { path: '^app/ui' },
      to: { path: '^app/(adapters|bootstrap)' },
    },
    {
      name: 'common-is-standalone',
      severity: 'error',
      from: { path: '^common' },
      to: { path: '^app' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
