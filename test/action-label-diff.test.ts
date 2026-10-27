import { describe, it, expect, beforeEach, vi } from 'vitest';
import actionLabelDiff from '../src/action-label-diff';
import type { ApiClient, GitHubIssue } from '../src/github-label-api';
import type { LabelDiff } from '../src/index';

function makeApiClient(): ApiClient {
  return {
    getLabels: vi.fn(),
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    getLabeledIssues: vi.fn(),
    labelIssue: vi.fn(),
    deleteLabel: vi.fn(),
  } as unknown as ApiClient;
}

describe('actionLabelDiff', () => {
  let apiClient: ReturnType<typeof makeApiClient>;
  let options: { apiClient: ApiClient; diff: LabelDiff; repo: string };

  beforeEach(() => {
    apiClient = makeApiClient();
    options = { apiClient, diff: [], repo: 'foo/bar' };
  });

  it('should return an array', () => {
    expect(actionLabelDiff(options)).toBeInstanceOf(Array);
  });

  it('should convert "missing" diff entries to create promises', () => {
    const createPromise = Promise.resolve({ name: 'foo', color: '00ff00' });
    vi.mocked(apiClient.createLabel).mockReturnValue(createPromise);
    options.diff.push({ name: 'foo', type: 'missing', actual: null, expected: { name: 'foo', color: '00ff00', description: 'baz' } });

    const actions = actionLabelDiff(options);
    expect(actions).toHaveLength(1);
    expect(apiClient.createLabel).toHaveBeenCalledOnce();
    expect(apiClient.createLabel).toHaveBeenCalledWith(options.repo, options.diff[0]!.expected);
    expect(actions[0]).toBe(createPromise);
  });

  it('should convert "changed" diff entries to update promises', () => {
    const updatePromise = Promise.resolve({ name: 'foo', color: '00ff00' });
    vi.mocked(apiClient.updateLabel).mockReturnValue(updatePromise);
    options.diff.push({
      name: 'foo', type: 'changed',
      actual: { name: 'foo', color: 'ff0000', description: 'bar' },
      expected: { name: 'foo', color: '00ff00', description: 'baz' },
    });

    const actions = actionLabelDiff(options);
    expect(actions).toHaveLength(1);
    expect(apiClient.updateLabel).toHaveBeenCalledOnce();
    expect(apiClient.updateLabel).toHaveBeenCalledWith(options.repo, options.diff[0]!.name, options.diff[0]!.expected);
    expect(actions[0]).toBe(updatePromise);
  });

  it('should convert "merge" diff entries to a chain of issue relabeling then delete', () => {
    const issues: GitHubIssue[] = [
      { number: 11, labels: [{ name: 'bar' }] },
      { number: 42, labels: [{ name: 'bar' }, { name: 'baz' }] },
    ];
    vi.mocked(apiClient.getLabeledIssues).mockResolvedValue(issues);
    vi.mocked(apiClient.labelIssue).mockResolvedValue(undefined);
    vi.mocked(apiClient.deleteLabel).mockResolvedValue(undefined);

    options.diff.push({
      name: 'foo', type: 'merge',
      actual: { name: 'bar', color: 'ff0000', description: 'baz' },
      expected: { name: 'foo', color: '00ff00', description: 'baz' },
    });

    const actions = actionLabelDiff(options);
    expect(actions).toHaveLength(1);

    return actions[0]!.then(() => {
      expect(apiClient.getLabeledIssues).toHaveBeenCalledWith(options.repo, options.diff[0]!.name);
      expect(apiClient.labelIssue).toHaveBeenCalledTimes(2);
      expect(apiClient.labelIssue).toHaveBeenCalledWith(options.repo, 11, options.diff[0]!.expected!.name);
      expect(apiClient.labelIssue).toHaveBeenCalledWith(options.repo, 42, options.diff[0]!.expected!.name);
      expect(apiClient.deleteLabel).toHaveBeenCalledWith(options.repo, options.diff[0]!.name);
    });
  });

  it('should not attempt redundant issue labeling for "merge" entries', () => {
    const issues: GitHubIssue[] = [
      { number: 11, labels: [{ name: 'bar' }] },
      { number: 42, labels: [{ name: 'bar' }, { name: 'foo' }] }, // already has expected label
      { number: 123, labels: [{ name: 'bar' }, { name: 'baz' }] },
    ];
    vi.mocked(apiClient.getLabeledIssues).mockResolvedValue(issues);
    vi.mocked(apiClient.labelIssue).mockResolvedValue(undefined);
    vi.mocked(apiClient.deleteLabel).mockResolvedValue(undefined);

    options.diff.push({
      name: 'foo', type: 'merge',
      actual: { name: 'bar', color: 'ff0000', description: 'baz' },
      expected: { name: 'foo', color: '00ff00', description: 'baz' },
    });

    const actions = actionLabelDiff(options);
    return actions[0]!.then(() => {
      expect(apiClient.labelIssue).toHaveBeenCalledTimes(2);
      expect(apiClient.labelIssue).toHaveBeenCalledWith(options.repo, 11, 'foo');
      expect(apiClient.labelIssue).toHaveBeenCalledWith(options.repo, 123, 'foo');
    });
  });

  it('should convert "added" diff entries to delete promises', async () => {
    vi.mocked(apiClient.deleteLabel).mockResolvedValue(undefined);
    options.diff.push({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000', description: 'bar' }, expected: null });

    const actions = actionLabelDiff(options);
    expect(actions).toHaveLength(1);
    await actions[0];
    expect(apiClient.deleteLabel).toHaveBeenCalledWith(options.repo, 'foo');
  });

  it('should create or rename the destination label before a merge adds it', async () => {
    let renamed = false;
    let releaseUpdate: () => void = () => {};
    const updateStarted = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    vi.mocked(apiClient.updateLabel).mockImplementation(() => updateStarted.then(() => {
      renamed = true;
      return { name: 'type: feature', color: '00ff00' };
    }));
    vi.mocked(apiClient.getLabeledIssues).mockResolvedValue([{ number: 1, labels: [{ name: 'feature' }] }]);
    vi.mocked(apiClient.labelIssue).mockImplementation(async () => {
      if (!renamed) {
        throw new Error('destination label does not exist yet');
      }
    });
    vi.mocked(apiClient.deleteLabel).mockResolvedValue(undefined);

    options.diff.push(
      {
        name: 'enhancement',
        type: 'changed',
        actual: { name: 'enhancement', color: '00ff00' },
        expected: { name: 'type: feature', color: '00ff00' },
      },
      {
        name: 'feature',
        type: 'merge',
        actual: { name: 'feature', color: '00ff00' },
        expected: { name: 'type: feature', color: '00ff00' },
      },
    );

    const actions = actionLabelDiff(options);
    expect(apiClient.labelIssue).not.toHaveBeenCalled();
    releaseUpdate();
    await Promise.all(actions);

    expect(apiClient.updateLabel).toHaveBeenCalled();
    expect(apiClient.labelIssue).toHaveBeenCalledWith(options.repo, 1, 'type: feature');
    const updateOrder = vi.mocked(apiClient.updateLabel).mock.invocationCallOrder[0];
    const labelOrder = vi.mocked(apiClient.labelIssue).mock.invocationCallOrder[0];
    const deleteOrder = vi.mocked(apiClient.deleteLabel).mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(labelOrder!);
    expect(labelOrder).toBeLessThan(deleteOrder!);
  });

  it('should filter out invalid entries', () => {
    options.diff.push({ type: 'invalid' } as unknown as LabelDiff[number]);
    expect(actionLabelDiff(options)).toHaveLength(0);
  });
});
