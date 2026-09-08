import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat config. The architecture rules of CLAUDE.md / ADR-0005 are enforced
 * twice: structurally by dependency-cruiser, and at the source level by the
 * `no-restricted-imports` / `no-restricted-globals` block below, so a domain
 * or application file can never reach a framework or the DOM.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'assets/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      // `error`, not `warn`: `npm run lint` runs with --max-warnings 0, so a
      // warning already fails the build - but a rule that reports at `warn`
      // level reads as advisory to anyone opening this file. Say what we mean.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    // Pure layers: no framework, no DOM, no adapters, no UI.
    files: ['app/domain/**', 'app/application/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'domain/application must not import Phaser.' },
            { name: 'howler', message: 'domain/application must not import howler.' },
            { name: 'i18next', message: 'domain/application must not import i18next.' },
          ],
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message: 'domain/application must not import Phaser.',
            },
            {
              group: ['@rive-app/*'],
              message: 'domain/application must not import Rive.',
            },
            {
              group: ['@adapters/*', '**/adapters/*'],
              message: 'domain/application must not import adapters; depend on ports.',
            },
            {
              group: ['@ui/*', '**/ui/*'],
              message: 'domain/application must not import UI.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'domain/application must not touch the DOM.' },
        { name: 'document', message: 'domain/application must not touch the DOM.' },
        { name: 'localStorage', message: 'Use a persistence port, not localStorage.' },
        { name: 'navigator', message: 'domain/application must not touch the DOM.' },
      ],
    },
  },
);
