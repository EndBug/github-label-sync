import type { ApiClient, GitHubIssue } from './github-label-api.js';
import type { LabelDiff, LabelDiffEntry } from './index.js';

export interface ActionOptions {
  apiClient: ApiClient;
  diff: LabelDiff;
  repo: string;
}

export default function actionLabelDiff(options: ActionOptions): Promise<unknown>[] {
  const { apiClient, diff, repo } = options;

  const start = (diffEntry: LabelDiffEntry): Promise<unknown> | undefined => {
    if (diffEntry.type === 'missing') {
      return apiClient.createLabel(repo, diffEntry.expected!);
    }
    if (diffEntry.type === 'changed') {
      return apiClient.updateLabel(repo, diffEntry.name, diffEntry.expected!);
    }
    if (diffEntry.type === 'merge') {
      return apiClient.getLabeledIssues(repo, diffEntry.name)
        .then((issues: GitHubIssue[]) => {
          const mergeIssues = issues.filter((issue) =>
            !issue.labels.some((label) => label.name === diffEntry.expected!.name),
          );
          const issueActions = mergeIssues.map((issue) =>
            apiClient.labelIssue(repo, issue.number, diffEntry.expected!.name),
          );
          return Promise.all(issueActions);
        })
        .then(() => apiClient.deleteLabel(repo, diffEntry.name));
    }
    if (diffEntry.type === 'added') {
      return apiClient.deleteLabel(repo, diffEntry.name);
    }
    return undefined;
  };

  const phase0: Promise<unknown>[] = [];
  const phase1Entries: LabelDiffEntry[] = [];
  const phase2Entries: LabelDiffEntry[] = [];

  for (const diffEntry of diff) {
    if (diffEntry.type === 'missing' || diffEntry.type === 'changed') {
      const action = start(diffEntry);
      if (action) {
        phase0.push(action);
      }
    } else if (diffEntry.type === 'merge') {
      phase1Entries.push(diffEntry);
    } else if (diffEntry.type === 'added') {
      phase2Entries.push(diffEntry);
    }
  }

  // Creates and renames must exist before a merge can add the destination label.
  // Unexpected labels are deleted only after merges have copied issues off them.
  const phase0Done = Promise.all(phase0);
  const phase1 = phase1Entries.map((entry) => phase0Done.then(() => start(entry)!));
  const phase1Done = phase0Done.then(() => Promise.all(phase1));
  const phase2 = phase2Entries.map((entry) => phase1Done.then(() => start(entry)!));

  return [...phase0, ...phase1, ...phase2];
}
