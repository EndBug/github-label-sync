import type { ApiClient, GitHubIssue } from './github-label-api.js';
import type { LabelDiff } from './index.js';

export interface ActionOptions {
  apiClient: ApiClient;
  diff: LabelDiff;
  repo: string;
}

export default function actionLabelDiff(options: ActionOptions): Promise<unknown>[] {
  const { apiClient, diff, repo } = options;

  const actions = diff.map((diffEntry): Promise<unknown> | undefined => {
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
  });

  return actions.filter((action): action is Promise<unknown> => action !== undefined);
}
