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
    const baseUrl = resolveEndpointBaseUrl(apiEndpoint);
    this.octokit = new Octokit({
      auth: accessToken ?? undefined,
      ...(baseUrl ? { baseUrl } : {}),
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

function resolveEndpointBaseUrl(apiEndpoint?: string | null): string | undefined {
  if (!apiEndpoint) {
    return undefined;
  }
  const baseUrl = resolveGitHubBaseUrl(apiEndpoint);
  if (baseUrl === 'https://api.github.com') {
    return undefined;
  }
  return baseUrl;
}

export function resolveGitHubBaseUrl(apiEndpoint: string): string {
  const trimmed = apiEndpoint.trim();
  if (!trimmed) {
    throw invalidEndpoint(apiEndpoint);
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw invalidEndpoint(apiEndpoint);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw invalidEndpoint(apiEndpoint);
  }

  let pathname = url.pathname.replace(/\/+$/, '');
  if (pathname === '') {
    pathname = '/api/v3';
  } else if (pathname.toLowerCase() === '/api/v3') {
    pathname = '/api/v3';
  } else {
    throw invalidEndpoint(apiEndpoint);
  }

  if (url.hostname.toLowerCase() === 'api.github.com') {
    return 'https://api.github.com';
  }

  return `${url.protocol}//${url.host}${pathname}`;
}

function invalidEndpoint(value: string): Error {
  return new Error(`Invalid GitHub endpoint: "${value}"`);
}
