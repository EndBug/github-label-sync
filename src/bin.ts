#!/usr/bin/env node

import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Command } from 'commander';
import yaml from 'js-yaml';
import { githubLabelSync } from './index.js';
import type { ConfiguredLabel } from './index.js';
import { isRequestError } from './github-label-api.js';

const _require = createRequire(import.meta.url);

interface CliOptions {
  accessToken?: string;
  labels: string[];
  dryRun?: boolean;
  allowAddedLabels?: boolean;
  endpoint?: string;
}

export class LabelFileError extends Error {}

export function getLabelFiles(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

const yamlRegex = /\.ya?ml$/ui;
const jsonRegex = /\.json$/ui;

export async function readLabels(labelPaths: string[] = [], cwd = process.cwd()): Promise<ConfiguredLabel[][]> {
  if (labelPaths.length === 0) {
    labelPaths = ['labels.json'];
  }

  const files = labelPaths.map((file) => readLabelFile(file, cwd));
  return Promise.all(files);
}

async function readLabelFile(file: string, cwd: string): Promise<ConfiguredLabel[]> {
  if (file.startsWith('http://') || file.startsWith('https://')) {
    const isYaml = yamlRegex.test(file);

    try {
      return await import('got').then(({ got }) =>
        isYaml
          ? got(file).text().then(body => yaml.load(body) as ConfiguredLabel[])
          : got(file).json<ConfiguredLabel[]>(),
      );
    } catch {
      throw new LabelFileError(`Downloading labels from ${file} failed`);
    }
  }

  const resolvedFile = resolveLabelPath(file, cwd);

  try {
    if (yamlRegex.test(resolvedFile)) {
      return yaml.load(readFileSync(resolvedFile, 'utf8')) as ConfiguredLabel[];
    }
    if (jsonRegex.test(resolvedFile)) {
      return JSON.parse(readFileSync(resolvedFile, 'utf8')) as ConfiguredLabel[];
    }

    return await loadJavaScriptLabels(resolvedFile);
  } catch {
    throw new LabelFileError(`No labels were found in ${resolvedFile}`);
  }
}

function resolveLabelPath(file: string, cwd: string): string {
  if (isAbsolute(file) || file.startsWith('~')) {
    return file;
  }
  return resolve(cwd, file);
}

async function loadJavaScriptLabels(file: string): Promise<ConfiguredLabel[]> {
  try {
    return unwrapLabelModule(_require(file));
  } catch (error) {
    if (!isRequireEsmError(error)) {
      throw error;
    }
  }

  const moduleValue = await import(pathToFileURL(file).href);
  return unwrapLabelModule(moduleValue);
}

function unwrapLabelModule(moduleValue: unknown): ConfiguredLabel[] {
  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    return (moduleValue as { default: ConfiguredLabel[] }).default;
  }
  return moduleValue as ConfiguredLabel[];
}

function isRequireEsmError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_REQUIRE_ESM'
  );
}

const format = {
  diff: (message: string) => chalk.cyan(' > ') + message,
  success: (message: string) => chalk.green(message),
  warning: (message: string) => chalk.black.bgYellow(message),
};

export function merge(files: ConfiguredLabel[][]): ConfiguredLabel[] {
  const data: Record<string, ConfiguredLabel> = {};
  const labels: ConfiguredLabel[] = [];

  files.forEach((file) => {
    if (!Array.isArray(file)) {
      return;
    }
    file.forEach((label) => {
      const existing = data[label.name];
      if (existing === undefined) {
        data[label.name] = label;
      } else if (JSON.stringify(existing) !== JSON.stringify(label)) {
        throw new LabelFileError(`Conflicting label names were found: ${label.name}`);
      }
    });
  });

  Object.values(data).forEach((label) => {
    const color = String(label.color);
    if (color.startsWith('#')) {
      label.color = color.replace('#', '');
    }
    labels.push(label);
  });

  return labels;
}

function createProgram(): Command {
  return new Command()
    .name('github-label-sync')
    .version(readPackageVersion())
    .usage('[options] <repository>')
    .option(
      '-a, --access-token <token>',
      'a GitHub access token (also settable with a GITHUB_ACCESS_TOKEN environment variable)',
      process.env['GITHUB_ACCESS_TOKEN'],
    )
    .option(
      '-l, --labels <path>',
      'the path or URL to look for the label configuration in. Default: labels.json',
      getLabelFiles,
      [],
    )
    .option(
      '-d, --dry-run',
      'calculate the required label changes but do not apply them',
    )
    .option(
      '-A, --allow-added-labels',
      "allow additional labels in the repo, and don't delete them",
    )
    .option(
      '-e, --endpoint <url>',
      'specify a GitHub enterprise installation',
    );
}

function readPackageVersion(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPaths = [
    resolve(currentDir, '../package.json'),
    resolve(currentDir, '../../package.json'),
  ];

  for (const packageJsonPath of packageJsonPaths) {
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
      return pkg.version ?? 'unknown';
    }
  }

  return 'unknown';
}

async function resolveOptions(program: Command) {
  const opts = program.opts<CliOptions>();
  const files = await readLabels(opts.labels);
  return {
    accessToken: opts.accessToken ?? null,
    allowAddedLabels: opts.allowAddedLabels ?? false,
    dryRun: opts.dryRun ?? false,
    endpoint: opts.endpoint ?? null,
    format,
    labels: merge(files),
    log: console,
    repo: program.args[0]!,
  };
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  program.parse(argv);

  if (program.args.length !== 1) {
    program.help();
  }

  const options = await resolveOptions(program);
  console.log(chalk.cyan.underline(`Syncing labels for "${options.repo}"`));
  await githubLabelSync(options);
}

function handleError(error: unknown): void {
  if (error instanceof LabelFileError) {
    console.error(chalk.red(error.message));
  } else if (isRequestError(error)) {
    console.log(chalk.red(`GitHub Error:\n${error.request.method} ${error.request.url}\n${error.status}: ${error.message}`));
  } else if (error instanceof Error) {
    console.error(chalk.red(error.stack ?? error.message));
  } else {
    console.error(chalk.red(String(error)));
  }
  process.exit(1);
}

function isDirectRun(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectRun()) {
  main().catch(handleError);
}
