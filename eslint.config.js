import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'assets/**', 'git@github.com:kinncj/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['app/domain/**/*.ts', 'app/application/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', { patterns: ['three', 'three/*', '@dimforge/*', 'yuka', 'howler', 'i18next', '@adapters/*', '@ui/*'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'commonjs' },
  },
);
