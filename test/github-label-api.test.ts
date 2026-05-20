import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiClient, isRequestError } from '../src/github-label-api';

const mockIssues = {
  listLabelsForRepo: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  listForRepo: vi.fn(),
  addLabels: vi.fn(),
  deleteLabel: vi.fn(),
};

const mockOctokit = {
  paginate: vi.fn(),
  rest: { issues: mockIssues },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

const repo = 'foo/bar';
const accessToken = 'mock-token';

describe('createApiClient', () => {
  it('should return an object with all expected methods', () => {
    const client = createApiClient(accessToken);
    expect(client).toBeTypeOf('object');
    expect(client.getLabels).toBeTypeOf('function');
    expect(client.createLabel).toBeTypeOf('function');
    expect(client.updateLabel).toBeTypeOf('function');
    expect(client.getLabeledIssues).toBeTypeOf('function');
    expect(client.labelIssue).toBeTypeOf('function');
    expect(client.deleteLabel).toBeTypeOf('function');
  });

  it('should create a client with a custom endpoint', async () => {
    const { Octokit } = await import('@octokit/rest');
    createApiClient(accessToken, 'github.example.com');
    expect(Octokit).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://github.example.com/api/v3' }),
    );
  });
});

describe('ApiClient', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createApiClient(accessToken);
  });

  describe('.getLabels(repo)', () => {
    it('should resolve with label data from paginate', async () => {
      mockOctokit.paginate.mockResolvedValue([{ name: 'foo', color: 'ff0000', description: 'bar' }]);
      const result = await client.getLabels(repo);
      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockIssues.listLabelsForRepo,
        { owner: 'foo', repo: 'bar', per_page: 100 },
      );
      expect(result).toEqual([{ name: 'foo', color: 'ff0000', description: 'bar' }]);
    });

    it('should omit description when label has no description', async () => {
      mockOctokit.paginate.mockResolvedValue([{ name: 'foo', color: 'ff0000', description: null }]);
      const result = await client.getLabels(repo);
      expect(result).toEqual([{ name: 'foo', color: 'ff0000' }]);
    });

    it('should throw when given an invalid repo format', async () => {
      await expect(client.getLabels('invalidrepo')).rejects.toThrow('Invalid repo format');
    });

    it('should reject when paginate rejects', async () => {
      mockOctokit.paginate.mockRejectedValue(new Error('API error'));
      await expect(client.getLabels(repo)).rejects.toThrow('API error');
    });
  });

  describe('.createLabel(repo, label)', () => {
    const label = { name: 'foo', color: 'ff0000' };
    const createdLabel = { name: 'foo', color: 'ff0000', description: null };

    it('should call issues.createLabel and resolve with the created label', async () => {
      mockIssues.createLabel.mockResolvedValue({ data: createdLabel });
      const result = await client.createLabel(repo, label);
      expect(mockIssues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'foo', repo: 'bar', name: 'foo', color: 'ff0000' }),
      );
      expect(result).toEqual({ name: 'foo', color: 'ff0000' });
    });

    it('should send an empty description when provided', async () => {
      mockIssues.createLabel.mockResolvedValue({ data: createdLabel });
      await client.createLabel(repo, { name: 'foo', color: 'ff0000', description: '' });
      expect(mockIssues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
      );
    });

    it('should reject when the API call rejects', async () => {
      mockIssues.createLabel.mockRejectedValue(new Error('API error'));
      await expect(client.createLabel(repo, label)).rejects.toThrow('API error');
    });
  });

  describe('.updateLabel(repo, labelName, label)', () => {
    const label = { name: 'foo', color: 'ff0000' };
    const labelName = 'baz qux';

    it('should call issues.updateLabel and resolve with the updated label', async () => {
      mockIssues.updateLabel.mockResolvedValue({ data: { name: 'foo', color: 'ff0000' } });
      const result = await client.updateLabel(repo, labelName, label);
      expect(mockIssues.updateLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'foo', repo: 'bar', name: labelName, new_name: 'foo', color: 'ff0000' }),
      );
      expect(result).toEqual({ name: 'foo', color: 'ff0000' });
    });

    it('should not include new_name when name is unchanged', async () => {
      mockIssues.updateLabel.mockResolvedValue({ data: { name: 'foo', color: 'ff0000' } });
      await client.updateLabel(repo, 'foo', { name: 'foo', color: 'ff0000' });
      expect(mockIssues.updateLabel).toHaveBeenCalledWith(
        expect.not.objectContaining({ new_name: expect.anything() }),
      );
    });

    it('should send an empty description so existing descriptions can be cleared', async () => {
      mockIssues.updateLabel.mockResolvedValue({ data: { name: 'foo', color: 'ff0000', description: null } });
      await client.updateLabel(repo, 'foo', { name: 'foo', color: 'ff0000', description: '' });
      expect(mockIssues.updateLabel).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
      );
    });

    it('should reject when the API call rejects', async () => {
      mockIssues.updateLabel.mockRejectedValue(new Error('API error'));
      await expect(client.updateLabel(repo, labelName, label)).rejects.toThrow('API error');
    });
  });

  describe('.getLabeledIssues(repo, labelName)', () => {
    it('should resolve with issues from paginate', async () => {
      const issues = [{ number: 1, labels: [{ name: 'foo' }] }];
      mockOctokit.paginate.mockResolvedValue(issues);
      const result = await client.getLabeledIssues(repo, 'foo');
      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        'GET /repos/{owner}/{repo}/issues',
        { owner: 'foo', repo: 'bar', labels: 'foo', state: 'all', per_page: 100 },
      );
      expect(result).toEqual(issues);
    });

    it('should reject when paginate rejects', async () => {
      mockOctokit.paginate.mockRejectedValue(new Error('API error'));
      await expect(client.getLabeledIssues(repo, 'foo')).rejects.toThrow('API error');
    });
  });

  describe('.labelIssue(repo, issueNumber, labelName)', () => {
    it('should call issues.addLabels and resolve with no value', async () => {
      mockIssues.addLabels.mockResolvedValue({});
      const result = await client.labelIssue(repo, 42, 'foo');
      expect(mockIssues.addLabels).toHaveBeenCalledWith(
        { owner: 'foo', repo: 'bar', issue_number: 42, labels: ['foo'] },
      );
      expect(result).toBeUndefined();
    });

    it('should reject when the API call rejects', async () => {
      mockIssues.addLabels.mockRejectedValue(new Error('API error'));
      await expect(client.labelIssue(repo, 42, 'foo')).rejects.toThrow('API error');
    });
  });

  describe('.deleteLabel(repo, labelName)', () => {
    it('should call issues.deleteLabel and resolve with no value', async () => {
      mockIssues.deleteLabel.mockResolvedValue({});
      const result = await client.deleteLabel(repo, 'foo');
      expect(mockIssues.deleteLabel).toHaveBeenCalledWith({ owner: 'foo', repo: 'bar', name: 'foo' });
      expect(result).toBeUndefined();
    });

    it('should reject when the API call rejects', async () => {
      mockIssues.deleteLabel.mockRejectedValue(new Error('API error'));
      await expect(client.deleteLabel(repo, 'foo')).rejects.toThrow('API error');
    });
  });
});

describe('isRequestError', () => {
  it('should return true for an object with status and request', () => {
    expect(isRequestError({ status: 404, request: { method: 'GET', url: '/', headers: {} } })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isRequestError(null)).toBe(false);
  });

  it('should return false for a non-object', () => {
    expect(isRequestError('error string')).toBe(false);
  });

  it('should return false for an object missing status', () => {
    expect(isRequestError({ request: {} })).toBe(false);
  });

  it('should return false for an object missing request', () => {
    expect(isRequestError({ status: 404 })).toBe(false);
  });
});
