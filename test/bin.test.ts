import { describe, expect, it } from 'vitest';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isExecutedModule, LabelFileError, merge, readLabels } from '../src/bin';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'github-label-sync-'));
}

describe('CLI label loading', () => {
  it('should read labels.json when no label paths are provided', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.json'), JSON.stringify([{ name: 'foo', color: 'ff0000' }]));

    await expect(readLabels([], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should read YAML label files', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.yml'), '- name: foo\n  color: ff0000\n');

    await expect(readLabels(['labels.yml'], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should read CommonJS JavaScript label files', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ type: 'commonjs' }));
    writeFileSync(join(cwd, 'labels.js'), "module.exports = [{ name: 'foo', color: 'ff0000' }];\n");

    await expect(readLabels(['labels.js'], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should read ESM JavaScript label files', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.mjs'), "export default [{ name: 'foo', color: 'ff0000' }];\n");

    await expect(readLabels(['labels.mjs'], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should reject missing label files with a CLI-friendly error', async () => {
    const cwd = createTempDir();

    await expect(readLabels(['missing.json'], cwd)).rejects.toThrow(LabelFileError);
    await expect(readLabels(['missing.json'], cwd)).rejects.toThrow('No labels were found');
  });
});

describe('CLI label merging', () => {
  it('should combine label files and strip leading color hashes', () => {
    expect(merge([
      [{ name: 'foo', color: '#ff0000' }],
      [{ name: 'bar', color: '00ff00' }],
    ])).toEqual([
      { name: 'foo', color: 'ff0000' },
      { name: 'bar', color: '00ff00' },
    ]);
  });

  it('should reject conflicting duplicate label names', () => {
    expect(() => merge([
      [{ name: 'foo', color: 'ff0000' }],
      [{ name: 'foo', color: '00ff00' }],
    ])).toThrow(LabelFileError);
  });

  it('should ignore non-array label files', () => {
    expect(merge([
      { name: 'ignored', color: 'ff0000' } as unknown as [],
      [{ name: 'foo', color: '00ff00' }],
    ])).toEqual([{ name: 'foo', color: '00ff00' }]);
  });

  it('should accept label names that exist on Object.prototype', () => {
    expect(merge([[
      { name: 'constructor', color: 'ff0000' },
      { name: 'toString', color: '00ff00' },
      { name: '__proto__', color: '0000ff' },
    ]])).toEqual([
      { name: 'constructor', color: 'ff0000' },
      { name: 'toString', color: '00ff00' },
      { name: '__proto__', color: '0000ff' },
    ]);
  });

  it('should still reject conflicting prototype-named labels', () => {
    expect(() => merge([
      [{ name: 'constructor', color: 'ff0000' }],
      [{ name: 'constructor', color: '00ff00' }],
    ])).toThrow(LabelFileError);
  });
});

describe('CLI direct-run detection', () => {
  it('should treat a symlink to the module as the same file', () => {
    const dir = createTempDir();
    const target = join(dir, 'bin.cjs');
    const link = join(dir, 'github-label-sync');
    writeFileSync(target, '');
    symlinkSync(target, link);

    expect(isExecutedModule(pathToFileURL(target).href, link)).toBe(true);
  });

  it('should reject a different file', () => {
    const dir = createTempDir();
    const target = join(dir, 'bin.cjs');
    const other = join(dir, 'other.cjs');
    writeFileSync(target, '');
    writeFileSync(other, '');

    expect(isExecutedModule(pathToFileURL(target).href, other)).toBe(false);
  });

  it('should reject a missing path', () => {
    expect(isExecutedModule('file:///tmp/github-label-sync-missing.cjs', undefined)).toBe(false);
    expect(isExecutedModule('file:///tmp/github-label-sync-missing.cjs', '/tmp/github-label-sync-does-not-exist')).toBe(false);
  });
});
