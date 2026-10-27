import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { got } from 'got';
import {
  createProgram,
  handleError,
  isExecutedModule,
  LabelFileError,
  main,
  merge,
  readLabels,
  readPackageVersion,
  resolveLabelPath,
} from '../src/bin';
import { githubLabelSync } from '../src/index';

vi.mock('got', () => ({
  got: vi.fn(),
}));

vi.mock('../src/index', () => ({
  githubLabelSync: vi.fn(() => Promise.resolve([])),
}));

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

  it('should reject non-array label files', () => {
    expect(() => merge([
      { name: 'ignored', color: 'ff0000' } as unknown as [],
      [{ name: 'foo', color: '00ff00' }],
    ])).toThrow(LabelFileError);
  });

  it('should treat a leading hash as the same color across files', () => {
    expect(merge([
      [{ name: 'foo', color: '#FF0000' }],
      [{ name: 'foo', color: 'ff0000' }],
    ])).toEqual([{ name: 'foo', color: 'ff0000' }]);
  });

  it('should still reject different colors when one has a hash', () => {
    expect(() => merge([
      [{ name: 'foo', color: '#ff0000' }],
      [{ name: 'foo', color: '00ff00' }],
    ])).toThrow(LabelFileError);
  });

  it('should leave a missing color omitted', () => {
    expect(merge([[{ name: 'foo' }]])).toEqual([{ name: 'foo' }]);
  });

  it('should return labels from a single array file', () => {
    expect(merge([[{ name: 'foo', color: '00ff00' }]])).toEqual([{ name: 'foo', color: '00ff00' }]);
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

describe('CLI label file shape', () => {
  it('should reject a JSON object file', async () => {
    const cwd = createTempDir();
    const file = join(cwd, 'labels.json');
    writeFileSync(file, JSON.stringify({ name: 'foo', color: 'ff0000' }));

    await expect(readLabels([file], cwd)).rejects.toThrow(LabelFileError);
    await expect(readLabels([file], cwd)).rejects.toThrow(file);
  });

  it('should reject a YAML mapping', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.yml'), 'name: foo\ncolor: ff0000\n');

    await expect(readLabels(['labels.yml'], cwd)).rejects.toThrow(LabelFileError);
    await expect(readLabels(['labels.yml'], cwd)).rejects.toThrow('must be an array of labels');
  });

  it('should reject an empty YAML file', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.yml'), '');

    await expect(readLabels(['labels.yml'], cwd)).rejects.toThrow(LabelFileError);
  });

  it('should read a .yaml file', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.yaml'), '- name: foo\n  color: ff0000\n');

    await expect(readLabels(['labels.yaml'], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should accept an explicit empty array', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.json'), '[]');

    await expect(readLabels(['labels.json'], cwd)).resolves.toEqual([[]]);
  });

  it('should reject when any of several files is not an array', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'ok.json'), JSON.stringify([{ name: 'foo', color: '00ff00' }]));
    writeFileSync(join(cwd, 'bad.json'), JSON.stringify({ name: 'bar' }));

    await expect(readLabels(['ok.json', 'bad.json'], cwd)).rejects.toThrow(LabelFileError);
  });

  it('should read an absolute label path', async () => {
    const cwd = createTempDir();
    const other = createTempDir();
    const file = join(other, 'labels.json');
    writeFileSync(file, JSON.stringify([{ name: 'foo', color: 'ff0000' }]));

    await expect(readLabels([file], cwd)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should wrap a JavaScript file that fails to load', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ type: 'commonjs' }));
    writeFileSync(join(cwd, 'labels.js'), 'throw new Error("boom");\n');

    await expect(readLabels(['labels.js'], cwd)).rejects.toThrow(LabelFileError);
    await expect(readLabels(['labels.js'], cwd)).rejects.toThrow('No labels were found');
  });
});

describe('CLI label paths', () => {
  it('should load ~/labels.json from the injected home directory', async () => {
    const home = createTempDir();
    const cwd = createTempDir();
    writeFileSync(join(home, 'labels.json'), JSON.stringify([{ name: 'foo', color: 'ff0000' }]));

    await expect(readLabels(['~/labels.json'], cwd, () => home)).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should report the expanded path when a home file is missing', async () => {
    const home = createTempDir();
    const cwd = createTempDir();

    await expect(readLabels(['~/missing.json'], cwd, () => home)).rejects.toThrow(join(home, 'missing.json'));
  });

  it('should expand a lone tilde to the home directory', () => {
    expect(resolveLabelPath('~', '/tmp/work', () => '/home/tester')).toBe('/home/tester');
  });

  it('should not expand ~foo.json as a home path', () => {
    const cwd = '/tmp/work';
    expect(resolveLabelPath('~foo.json', cwd, () => '/home/tester')).toBe(resolve(cwd, '~foo.json'));
  });

  it('should keep an absolute path unchanged', () => {
    expect(resolveLabelPath('/tmp/labels.json', '/tmp/work', () => '/home/tester')).toBe('/tmp/labels.json');
  });
});

describe('CLI remote label files', () => {
  function mockGot(body: { json?: unknown; text?: string; error?: Error }): void {
    vi.mocked(got).mockImplementation(() => {
      if (body.error) {
        throw body.error;
      }
      return {
        json: () => Promise.resolve(body.json),
        text: () => Promise.resolve(body.text ?? ''),
      } as never;
    });
  }

  it('should read remote JSON', async () => {
    mockGot({ json: [{ name: 'foo', color: 'ff0000' }] });
    await expect(readLabels(['https://example.com/labels.json'])).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should read remote YAML', async () => {
    mockGot({ text: '- name: foo\n  color: ff0000\n' });
    await expect(readLabels(['http://example.com/labels.yml'])).resolves.toEqual([
      [{ name: 'foo', color: 'ff0000' }],
    ]);
  });

  it('should reject a remote file that is not an array', async () => {
    mockGot({ json: { name: 'foo', color: 'ff0000' } });
    await expect(readLabels(['https://example.com/labels.json'])).rejects.toThrow(LabelFileError);
    await expect(readLabels(['https://example.com/labels.json'])).rejects.toThrow('https://example.com/labels.json');
  });

  it('should throw LabelFileError when a download fails and should not exit', async () => {
    mockGot({ error: new Error('network') });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await expect(readLabels(['http://example.com/labels.json'])).rejects.toThrow(LabelFileError);
    await expect(readLabels(['http://example.com/labels.json'])).rejects.toThrow('Downloading labels from http://example.com/labels.json failed');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});

describe('CLI help and version', () => {
  it('should show labels.json as the labels default and not []', () => {
    const help = createProgram().helpInformation();
    expect(help).toContain('labels.json');
    expect(help).not.toContain('[]');
  });

  it('should keep an empty labels list until flags are passed', () => {
    const program = createProgram();
    program.parse(['node', 'github-label-sync', 'owner/repo']);
    expect(program.opts().labels).toEqual([]);

    const repeated = createProgram();
    repeated.parse(['node', 'github-label-sync', '--labels', 'a.yml', '--labels', 'b.yml', 'owner/repo']);
    expect(repeated.opts().labels).toEqual(['a.yml', 'b.yml']);
  });

  it('should read the package version from the nearest package.json', () => {
    expect(readPackageVersion()).toBe('4.0.0');

    const root = createTempDir();
    const nested = join(root, 'dist', 'cjs');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    expect(readPackageVersion(nested)).toBe('9.9.9');

    const missing = createTempDir();
    expect(readPackageVersion(missing)).toBe('unknown');

    const pkgDir = createTempDir();
    writeFileSync(join(pkgDir, 'package.json'), '{}');
    const srcDir = join(pkgDir, 'src');
    mkdirSync(srcDir);
    expect(readPackageVersion(srcDir)).toBe('unknown');
  });
});

describe('CLI handleError', () => {
  afterEach(() => {
    vi.spyOn(console, 'error').mockRestore();
    vi.spyOn(console, 'log').mockRestore();
    vi.spyOn(process, 'exit').mockRestore();
  });

  it('should print a label file error without requiring a stack', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError(new LabelFileError('bad file'));

    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('bad file');
    expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain('at ');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should print a GitHub request error', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError({
      status: 404,
      message: 'Not Found',
      request: { method: 'GET', url: 'https://example.test/labels' },
    });

    const printed = String(logSpy.mock.calls[0]?.[0]);
    expect(printed).toContain('GET');
    expect(printed).toContain('https://example.test/labels');
    expect(printed).toContain('404');
    expect(printed).toContain('Not Found');
  });

  it('should print the stack of a plain Error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const error = new Error('boom');

    handleError(error);

    expect(String(errorSpy.mock.calls[0]?.[0])).toContain(error.stack ?? 'boom');
  });

  it('should print a non-error value', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    handleError('plain failure');

    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('plain failure');
  });
});

describe('CLI main', () => {
  afterEach(() => {
    vi.spyOn(console, 'log').mockRestore();
    vi.spyOn(process, 'cwd').mockRestore();
    vi.spyOn(process, 'exit').mockRestore();
    delete process.env['GITHUB_ACCESS_TOKEN'];
  });

  it('should show help and not sync when the repo is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(main(['node', 'github-label-sync'])).rejects.toThrow('exit');
    expect(githubLabelSync).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalled();
  });

  it('should pass the repo, env token, dry run, and allowAddedLabels', async () => {
    const cwd = createTempDir();
    writeFileSync(join(cwd, 'labels.json'), JSON.stringify([{ name: 'foo', color: '#ff0000' }]));
    process.env['GITHUB_ACCESS_TOKEN'] = 'env-token';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(githubLabelSync).mockClear();

    await main(['node', 'github-label-sync', '--dry-run', '--allow-added-labels', 'owner/repo']);

    expect(githubLabelSync).toHaveBeenCalledWith(expect.objectContaining({
      repo: 'owner/repo',
      accessToken: 'env-token',
      dryRun: true,
      allowAddedLabels: true,
      endpoint: null,
      labels: [{ name: 'foo', color: 'ff0000' }],
    }));
    const options = vi.mocked(githubLabelSync).mock.calls[0]?.[0];
    expect(options?.format.diff('line')).toContain('line');
    expect(options?.format.success('ok')).toContain('ok');
    expect(options?.format.warning('careful')).toContain('careful');
    options?.log.info('info');
    options?.log.warn('warn');
  });
});
