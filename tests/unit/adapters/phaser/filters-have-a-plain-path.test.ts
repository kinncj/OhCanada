/**
 * Phaser's Filter API may only be reached from inside an effect's `filtered`
 * callback, and every effect that has one also has a `plain` one.
 *
 * ### The failure this prevents
 *
 * Filters are WebGL-only. On Phaser 4's Canvas renderer a Filter is not an
 * error, not a warning and not a no-op you can detect — the call succeeds and
 * the pixels never change. So an effect built directly on a Filter does not fail
 * on a Canvas device, it renders the level *wrong*, and the report arrives
 * months later as "the ice looks flat on my laptop". Our e2e and perf suites
 * both run Chromium with `--use-angle=swiftshader`, which is a WebGL device, so
 * they would not catch it either.
 *
 * `visual-effects.ts` makes the honest mistake impossible: `plain` is a required
 * member, so a Filter-only effect will not typecheck. This file closes the other
 * door — a scene that never declares an effect at all and simply calls
 * `camera.filters.internal.addBlur()` where it draws. That is the way Filters
 * actually become load-bearing, and neither the type checker nor a unit test of
 * the registry can see it.
 *
 * ### Why it is not vacuous today
 *
 * There are no effects yet, so "every registered effect has a fallback" would
 * currently be a loop over nothing. Instead the detector is a function, and it
 * is proven against two fixtures — a raw Filter call, which must be reported,
 * and the same call inside a `defineEffect({ filtered })`, which must not be —
 * before it is pointed at the real adapter. The fixtures mean this file fails
 * loudly if the detector ever stops detecting, which is the way a source gate
 * usually rots.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ADAPTER_DIR = `${REPO_ROOT}app/adapters/phaser`;

/**
 * Property and method names that only exist because Phaser has a Filter
 * pipeline. `filters` is the `FilterList` component on cameras and game objects
 * (`camera.filters.internal.addBlur()`); `enableFilters` is how a game object
 * gets one; `Phaser.Filters.*` is the controller namespace; `postFX`/`preFX` are
 * the Phaser 3 spelling, listed so a copied snippet is caught too.
 */
const FILTER_MEMBERS: readonly string[] = [
  'filters',
  'enableFilters',
  'Filters',
  'FilterList',
  'postFX',
  'preFX',
  'setPostPipeline',
  'addPostPipeline',
];

/**
 * Reads that are named like the Phaser API and are not it.
 *
 * Whole expressions, including the receiver, because `profile.filters` (this
 * adapter's own boolean, "may this device use Filters at all") and
 * `camera.filters` (Phaser's `FilterList`) are only distinguishable by what they
 * hang off. Every entry is an explicit, reviewable exception: adding a `.filters`
 * read means adding a line here, which is the friction this gate is for.
 *
 * `every allowed expression is still needed` below asserts each entry would
 * otherwise be reported, so a stale exemption cannot quietly widen the hole.
 */
const ALLOWED_EXPRESSIONS: readonly string[] = ['profile.filters'];

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly expression: string;
}

/**
 * Report every reference to the Filter API that is not inside the `filtered`
 * callback of a `defineEffect(...)` call.
 *
 * Walks the AST rather than the text so that "inside a `filtered` callback" is a
 * structural question and not a guess about braces.
 */
function findUnguardedFilterUse(sourceText: string, fileLabel: string): readonly Violation[] {
  const source = ts.createSourceFile(
    fileLabel,
    sourceText,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
  );
  const violations: Violation[] = [];

  const insideFilteredCallback = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
      if (!ts.isPropertyAssignment(parent)) continue;
      if (ts.isIdentifier(parent.name) && parent.name.text === 'filtered') return true;
    }
    return false;
  };

  /**
   * Declaring a member called `filters` is not using Phaser's. `RenderProfile`
   * has a `filters` boolean and `resolveRenderProfile` sets it; those are
   * declarations, not reads, and a gate that flagged them would be a gate people
   * learn to silence.
   */
  const isDeclarationName = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (parent === undefined) return false;
    return (
      (ts.isPropertySignature(parent) ||
        ts.isPropertyDeclaration(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isShorthandPropertyAssignment(parent) ||
        ts.isMethodSignature(parent) ||
        ts.isMethodDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isVariableDeclaration(parent) ||
        ts.isBindingElement(parent) ||
        ts.isEnumMember(parent)) &&
      parent.name === node
    );
  };

  const visit = (node: ts.Node): void => {
    const name = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent)
        ? node.text
        : null;

    if (name !== null && FILTER_MEMBERS.includes(name) && !isDeclarationName(node)) {
      const expression = node.getText(source);
      if (!ALLOWED_EXPRESSIONS.includes(expression) && !insideFilteredCallback(node)) {
        violations.push({
          file: fileLabel,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          expression,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return violations;
}

const adapterFiles = readdirSync(ADAPTER_DIR)
  .filter((name) => name.endsWith('.ts'))
  .sort();

describe('the detector detects', () => {
  it('reports a Filter reached for directly in a scene', () => {
    const found = findUnguardedFilterUse(
      `
        class IceScene {
          create(): void {
            this.cameras.main.filters.internal.addBlur();
          }
        }
      `,
      'fixture-raw.ts',
    );

    expect(found.map((violation) => violation.expression)).toContain(
      'this.cameras.main.filters',
    );
  });

  it('reports the Phaser 3 spelling too, in case a snippet is pasted in', () => {
    expect(
      findUnguardedFilterUse('sprite.postFX.addGlow();', 'fixture-legacy.ts'),
    ).toHaveLength(1);
  });

  it('does not report the same call inside an effect that also has a plain path', () => {
    const found = findUnguardedFilterUse(
      `
        const ice = defineEffect({
          id: 'canal-ice',
          intent: 'the canal reads as ice, not as painted concrete',
          minTier: 'high',
          motion: 'still',
          plain: (target) => target.setTint(0xcfe8f5),
          filtered: (target) => target.enableFilters().filters.internal.addBlur(),
        });
      `,
      'fixture-guarded.ts',
    );

    expect(found).toEqual([]);
  });

  it('does not report the render profile’s own `filters` boolean', () => {
    expect(findUnguardedFilterUse('if (profile.filters) draw();', 'fixture-profile.ts')).toEqual(
      [],
    );
  });

  it('does not report a *declaration* of a member called `filters`', () => {
    expect(
      findUnguardedFilterUse(
        'interface P { readonly filters: boolean }\nconst p = { filters: true };',
        'fixture-declaration.ts',
      ),
    ).toEqual([]);
  });

  it.each(ALLOWED_EXPRESSIONS)('the exemption for `%s` is still used by real source', (expression) => {
    /* An exemption for an expression nobody writes any more is a hole held open
       for nothing, and it is how an allowlist stops describing the code. */
    const users = adapterFiles.filter((fileName) =>
      readFileSync(`${ADAPTER_DIR}/${fileName}`, 'utf8').includes(expression),
    );

    expect(
      users,
      `no file under app/adapters/phaser contains "${expression}" any more — delete the exemption`,
    ).not.toEqual([]);
  });
});

describe('app/adapters/phaser never reaches a Filter outside an effect', () => {
  it('has files to scan, so the gate below cannot pass by scanning nothing', () => {
    expect(adapterFiles.length).toBeGreaterThanOrEqual(5);
    expect(adapterFiles).toContain('visual-effects.ts');
    expect(adapterFiles).toContain('game-renderer.ts');
  });

  it.each(adapterFiles)('%s', (fileName) => {
    const violations = findUnguardedFilterUse(
      readFileSync(`${ADAPTER_DIR}/${fileName}`, 'utf8'),
      `app/adapters/phaser/${fileName}`,
    );

    expect(
      violations,
      violations
        .map(
          (violation) =>
            `${violation.file}:${violation.line} uses \`${violation.expression}\`. ` +
            `Phaser's Filters are WebGL-only and do nothing at all on the Canvas renderer, ` +
            `so a Filter reached for directly renders the level wrong instead of failing. ` +
            `Declare it with defineEffect() from visual-effects.ts: put the Filter in ` +
            `\`filtered\` and the version everyone else sees in \`plain\`.`,
        )
        .join('\n'),
    ).toEqual([]);
  });
});
