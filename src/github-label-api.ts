import { Octokit } from '@octokit/rest';
import type { RequestError } from '@octokit/request-error';
import type { GitHubLabel } from './index.js';

export interface GitHubIssue {
  number: number;
  labels: Array<{ name?: string }>;
}

export class ApiClient {
  private octokit: Octokit;

  constructor(accessToken: string | null, apiEndpoint?: string | null) {
    this.octokit = new Octokit({
      auth: accessToken ?? undefined,
      ...(apiEndpoint ? { baseUrl: `https://${apiEndpoint}/api/v3` } : {}),
    });
  }

  async getLabels(repo: string): Promise<GitHubLabel[]> {
    const [owner, repoName] = splitRepo(repo);
    const labels = await this.octokit.paginate(this.octokit.rest.issues.listLabelsForRepo, {
      owner,
      repo: repoName,
      per_page: 100,
    });
    return labels.map(l => ({
      name: l.name,
      color: l.color,
      ...(l.description ? { description: l.description } : {}),
    }));
  }

  async createLabel(repo: string, label: GitHubLabel): Promise<GitHubLabel> {
    const [owner, repoName] = splitRepo(repo);
    const { data } = await this.octokit.rest.issues.createLabel({
      owner,
      repo: repoName,
      name: label.name,
      // An omitted config color is stored as ''. Sending that rejects the request;
      // leaving it out lets GitHub apply its default.
      ...(label.color ? { color: label.color } : {}),
      ...(label.description !== undefined ? { description: label.description } : {}),
    });
    return toGitHubLabel(data);
  }

  async updateLabel(repo: string, labelName: string, label: GitHubLabel): Promise<GitHubLabel> {
    const [owner, repoName] = splitRepo(repo);
    const { data } = await this.octokit.rest.issues.updateLabel({
      owner,
      repo: repoName,
      name: labelName,
      // An empty color is the diff's stand-in for "not configured". Omitting it
      // keeps the color already on the label instead of failing validation.
      ...(label.color ? { color: label.color } : {}),
      ...(label.name !== labelName ? { new_name: label.name } : {}),
      ...(label.description !== undefined ? { description: label.description } : {}),
    });
    return toGitHubLabel(data);
  }

  async getLabeledIssues(repo: string, labelName: string): Promise<GitHubIssue[]> {
    const [owner, repoName] = splitRepo(repo);
    return this.octokit.paginate(
      'GET /repos/{owner}/{repo}/issues',
      { owner, repo: repoName, labels: labelName, state: 'all', per_page: 100 },
    ) as Promise<GitHubIssue[]>;
  }

  async labelIssue(repo: string, issueNumber: number, labelName: string): Promise<void> {
    const [owner, repoName] = splitRepo(repo);
    await this.octokit.rest.issues.addLabels({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      labels: [labelName],
    });
  }

  async deleteLabel(repo: string, labelName: string): Promise<void> {
    const [owner, repoName] = splitRepo(repo);
    await this.octokit.rest.issues.deleteLabel({
      owner,
      repo: repoName,
      name: labelName,
    });
  }
}

function splitRepo(repo: string): [string, string] {
  const parts = repo.split('/');
  const owner = parts[0];
  const repoName = parts[1];
  // Extra segments used to be discarded, so "owner/repo/extra" synced owner/repo.
  if (parts.length !== 2 || !owner || !repoName) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }
  return [owner, repoName];
}

function toGitHubLabel(data: { name: string; color: string; description?: string | null }): GitHubLabel {
  return {
    name: data.name,
    color: data.color,
    ...(data.description ? { description: data.description } : {}),
  };
}

export function isRequestError(error: unknown): error is RequestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'request' in error
  );
}

export function createApiClient(accessToken: string | null, apiEndpoint?: string | null): ApiClient {
  return new ApiClient(accessToken, apiEndpoint);
}
