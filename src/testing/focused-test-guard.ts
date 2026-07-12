import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const FOCUSED_TEST_PATTERNS = [
  { label: 'fit', matcher: /(^|\s)fit\s*\(/m },
  { label: 'fdescribe', matcher: /(^|\s)fdescribe\s*\(/m },
  { label: 'fit.each', matcher: /(^|\s)fit\.each\s*\(/m },
  { label: 'it.only', matcher: /(^|\s)it\.only\s*\(/m },
  { label: 'describe.only', matcher: /(^|\s)describe\.only\s*\(/m },
  { label: 'test.only', matcher: /(^|\s)test\.only\s*\(/m },
  { label: 'test.only.each', matcher: /(^|\s)test\.only\.each\s*\(/m },
  { label: 'it.only.each', matcher: /(^|\s)it\.only\.each\s*\(/m },
  {
    label: 'describe.only.each',
    matcher: /(^|\s)describe\.only\.each\s*\(/m,
  },
  {
    label: 'test.concurrent.only',
    matcher: /(^|\s)test\.concurrent\.only\s*\(/m,
  },
  {
    label: 'it.concurrent.only',
    matcher: /(^|\s)it\.concurrent\.only\s*\(/m,
  },
] as const;
const TEST_FILE_EXTENSIONS = new Set(['.ts', '.js']);

function collectTestFiles(entryPath: string): string[] {
  const stats = statSync(entryPath);

  if (stats.isFile()) {
    return TEST_FILE_EXTENSIONS.has(extname(entryPath)) ? [entryPath] : [];
  }

  return readdirSync(entryPath, { withFileTypes: true }).flatMap((entry) =>
    collectTestFiles(join(entryPath, entry.name)),
  );
}

function stripCommentsAndStrings(source: string): string {
  let sanitizedSource = '';
  let index = 0;

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (current === '/' && next === '/') {
      sanitizedSource += '  ';
      index += 2;

      while (index < source.length && source[index] !== '\n') {
        sanitizedSource += ' ';
        index += 1;
      }

      continue;
    }

    if (current === '/' && next === '*') {
      sanitizedSource += '  ';
      index += 2;

      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          sanitizedSource += '  ';
          index += 2;
          break;
        }

        sanitizedSource += source[index] === '\n' ? '\n' : ' ';
        index += 1;
      }

      continue;
    }

    if (current === "'" || current === '"' || current === '`') {
      const quote = current;
      sanitizedSource += ' ';
      index += 1;

      while (index < source.length) {
        const char = source[index];

        if (char === '\\') {
          sanitizedSource += ' ';
          if (index + 1 < source.length) {
            sanitizedSource += source[index + 1] === '\n' ? '\n' : ' ';
          }
          index += 2;
          continue;
        }

        if (char === quote) {
          sanitizedSource += ' ';
          index += 1;
          break;
        }

        sanitizedSource += char === '\n' ? '\n' : ' ';
        index += 1;
      }

      continue;
    }

    sanitizedSource += current;
    index += 1;
  }

  return sanitizedSource;
}

export function ensureNoFocusedTests(paths: string[]): void {
  for (const targetPath of paths.map((pathValue) => resolve(pathValue))) {
    for (const filePath of collectTestFiles(targetPath)) {
      const content = stripCommentsAndStrings(readFileSync(filePath, 'utf8'));

      for (const pattern of FOCUSED_TEST_PATTERNS) {
        if (pattern.matcher.test(content)) {
          throw new Error(`${pattern.label} is not allowed in ${filePath}`);
        }
      }
    }
  }
}

if (require.main === module) {
  ensureNoFocusedTests(process.argv.slice(2));
}
