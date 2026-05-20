import actionLabelDiff from './action-label-diff.js';
import calculateLabelDiff from './calculate-label-diff.js';
import { createApiClient } from './github-label-api.js';
import stringifyLabelDiff from './stringify-label-diff.js';
import validateLabelFormat from './validate-label-format.js';

export interface GitHubLabel {
  name: string;
  color: string;
  description?: string;
}

export interface ConfiguredLabel {
  name: string;
  color?: string;
  description?: string;
  aliases?: string[];
  delete?: boolean;
}

export type LabelDiffType = 'missing' | 'changed' | 'added' | 'merge';

export interface LabelDiffEntry {
  type: LabelDiffType;
  name: string;
  actual: GitHubLabel | null;
  expected: GitHubLabel | null;
}

export type LabelDiff = LabelDiffEntry[];

export interface SyncOptions {
  accessToken: string | null;
  allowAddedLabels: boolean;
  dryRun: boolean;
  endpoint: string | null;
  format: {
    diff: (message: string) => string;
    success: (message: string) => string;
    warning: (message: string) => string;
  };
  labels: ConfiguredLabel[];
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
  repo: string | null;
}

function noop(): void {}
function echo(arg: string): string { return arg; }

export function githubLabelSync(options: Partial<SyncOptions>): Promise<LabelDiff> {
  const resolvedOptions: SyncOptions = {
    ...githubLabelSync.defaults,
    ...options,
    format: { ...githubLabelSync.defaults.format, ...options.format },
    log: { ...githubLabelSync.defaults.log, ...options.log },
  };

  const apiClient = createApiClient(resolvedOptions.accessToken, resolvedOptions.endpoint);
  const format = resolvedOptions.format;
  const log = resolvedOptions.log;
  let labelDiff: LabelDiff;

  if (resolvedOptions.labels.length) {
    const validationErrors: Array<{ label: ConfiguredLabel; errors: NonNullable<typeof validateLabelFormat.errors> }> = [];

    log.info('Validating provided labels');
    for (const label of resolvedOptions.labels) {
      if (!validateLabelFormat(label)) {
        if (validateLabelFormat.errors) {
          validationErrors.push({ label, errors: validateLabelFormat.errors });
        }
      }
    }

    if (validationErrors.length) {
      const messages = validationErrors.map(({ label, errors }) => {
        const lines: string[] = [];
        lines.push('Invalid label:');
        lines.push(`  ${JSON.stringify(label)}`);
        for (const error of errors) {
          const message = `${error.instancePath} ${error.message ?? ''}`.trim().replace(/^\//, '');
          lines.push(`  - ${message}`);
        }
        return lines.join('\n');
      });

      return Promise.reject(new Error(messages.join('\n\n')));
    }
  }

  log.info('Fetching labels from GitHub');

  return apiClient.getLabels(resolvedOptions.repo ?? '')
    .then((currentLabels) => {
      labelDiff = calculateLabelDiff(currentLabels, resolvedOptions.labels, resolvedOptions.allowAddedLabels);
      stringifyLabelDiff(labelDiff).forEach((diffLine) => {
        log.info(format.diff(diffLine));
      });
      return labelDiff;
    })
    .then((diff) => {
      if (resolvedOptions.dryRun) {
        return diff;
      }
      if (diff.length) {
        log.info('Applying label changes, please wait…');
      }
      const diffActions = actionLabelDiff({
        apiClient,
        diff,
        repo: resolvedOptions.repo ?? '',
      });
      return Promise.all(diffActions);
    })
    .then((results) => {
      if (results.length === 0) {
        log.info(format.success('Labels are already up to date'));
      } else if (resolvedOptions.dryRun) {
        log.warn(format.warning('This is a dry run. No changes have been made on GitHub'));
      } else {
        log.info(format.success('Labels updated'));
      }
      return labelDiff;
    });
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace githubLabelSync {
  export const defaults: SyncOptions = {
    accessToken: null,
    allowAddedLabels: false,
    dryRun: false,
    endpoint: null,
    format: {
      diff: echo,
      success: echo,
      warning: echo,
    },
    labels: [],
    log: {
      info: noop,
      warn: noop,
    },
    repo: null,
  };
}

export default githubLabelSync;
