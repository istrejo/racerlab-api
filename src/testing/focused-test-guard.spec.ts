import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureNoFocusedTests } from './focused-test-guard';

describe('ensureNoFocusedTests', () => {
  it('allows test files when no focused-only markers are present', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'focused-guard-'));

    writeFileSync(
      join(sandbox, 'safe.spec.ts'),
      "describe('safe', () => { it('works', () => expect(true).toBe(true)); });",
    );

    expect(() => ensureNoFocusedTests([sandbox])).not.toThrow();

    rmSync(sandbox, { recursive: true, force: true });
  });

  it.each(['it.only', 'describe.only', 'test.only'])(
    'fails fast when %s is present',
    (focusedMarker) => {
      const sandbox = mkdtempSync(join(tmpdir(), 'focused-guard-'));

      writeFileSync(
        join(sandbox, 'focused.spec.ts'),
        `${focusedMarker}('focused', () => {});`,
      );

      expect(() => ensureNoFocusedTests([sandbox])).toThrow(
        `${focusedMarker} is not allowed`,
      );

      rmSync(sandbox, { recursive: true, force: true });
    },
  );

  it.each([
    'test.only.each([[1]])("focused", () => {});',
    'it.only.each([[1]])("focused", () => {});',
    'describe.only.each([[1]])("focused", () => {});',
    'test.concurrent.only("focused", async () => {});',
    'it.concurrent.only("focused", async () => {});',
    "fit('focused', () => {});",
    "fdescribe('focused', () => {});",
    'fit.each([[1]])("focused", () => {});',
  ])('fails fast when the Jest focused variant is present: %s', (source) => {
    const sandbox = mkdtempSync(join(tmpdir(), 'focused-guard-'));

    writeFileSync(join(sandbox, 'focused-variant.spec.ts'), source);

    expect(() => ensureNoFocusedTests([sandbox])).toThrow('is not allowed');

    rmSync(sandbox, { recursive: true, force: true });
  });

  it('ignores focused markers that only appear inside comments or strings', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'focused-guard-'));

    writeFileSync(
      join(sandbox, 'safe-comments.spec.ts'),
      [
        "describe('safe', () => {",
        "  // test.only.each([[1]])('commented', () => {});",
        "  const label = 'describe.only(each should stay text)';",
        '  const tpl = `test.concurrent.only should stay text`;',
        "  const focusedAlias = 'fit and fdescribe should stay text';",
        "  it('works', () => expect(label + tpl).toContain('text'));",
        '});',
      ].join('\n'),
    );

    expect(() => ensureNoFocusedTests([sandbox])).not.toThrow();

    rmSync(sandbox, { recursive: true, force: true });
  });
});
