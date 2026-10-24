import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LabelDiff, SyncOptions } from '../src/index';

// These mocks are hoisted before imports by Vitest
vi.mock('../src/action-label-diff');
vi.mock('../src/calculate-label-diff');
vi.mock('../src/github-label-api');
vi.mock('../src/stringify-label-diff');
vi.mock('../src/validate-label-format');

import { githubLabelSync } from '../src/index';
import actionLabelDiff from '../src/action-label-diff';
import calculateLabelDiff from '../src/calculate-label-diff';
import { createApiClient } from '../src/github-label-api';
import stringifyLabelDiff from '../src/stringify-label-diff';
import validateLabelFormat from '../src/validate-label-format';

const mockActionLabelDiff = vi.mocked(actionLabelDiff);
const mockCalculateLabelDiff = vi.mocked(calculateLabelDiff);
const mockCreateApiClient = vi.mocked(createApiClient);
const mockStringifyLabelDiff = vi.mocked(stringifyLabelDiff);
const mockValidateLabelFormat = vi.mocked(validateLabelFormat);

describe('githubLabelSync', () => {
  it('should be a function', () => {
    expect(githubLabelSync).toBeTypeOf('function');
  });

  it('should have a defaults object', () => {
    expect(githubLabelSync.defaults).toBeTypeOf('object');
  });

  describe('.defaults', () => {
    const { defaults } = githubLabelSync;

    it('should have accessToken: null', () => { expect(defaults.accessToken).toBeNull(); });
    it('should have allowAddedLabels: false', () => { expect(defaults.allowAddedLabels).toBe(false); });
    it('should have dryRun: false', () => { expect(defaults.dryRun).toBe(false); });
    it('should have a format object', () => { expect(defaults.format).toBeTypeOf('object'); });
    it('should have a format.diff function', () => { expect(defaults.format.diff).toBeTypeOf('function'); });
    it('should have a format.success function', () => { expect(defaults.format.success).toBeTypeOf('function'); });
    it('should have a format.warning function', () => { expect(defaults.format.warning).toBeTypeOf('function'); });
    it('should have labels: []', () => { expect(defaults.labels).toBeInstanceOf(Array); });
    it('should have a log object', () => { expect(defaults.log).toBeTypeOf('object'); });
    it('should have a log.info function', () => { expect(defaults.log.info).toBeTypeOf('function'); });
    it('should have a log.warn function', () => { expect(defaults.log.warn).toBeTypeOf('function'); });
    it('should have repo: null', () => { expect(defaults.repo).toBeNull(); });
  });

  describe('githubLabelSync(options)', () => {
    const mockApiClient = {
      getLabels: vi.fn(),
      createLabel: vi.fn(),
      updateLabel: vi.fn(),
      getLabeledIssues: vi.fn(),
      labelIssue: vi.fn(),
      deleteLabel: vi.fn(),
    };

    const labelsFromApi = [{ name: 'foo', color: 'ff0000' }];
    const labelDiff: LabelDiff = [{ name: 'foo', type: 'missing', actual: null, expected: { name: 'foo', color: 'ff0000' } }];
    const labelDiffActions = [Promise.resolve()];
    const labelDiffStringified = ['foo stringified', 'bar stringified'];

    const log = { info: vi.fn(), warn: vi.fn() };

    let options: Partial<SyncOptions>;
    let returnedPromise: Promise<LabelDiff>;

    beforeEach(() => {
      vi.clearAllMocks();

      mockCreateApiClient.mockReturnValue(mockApiClient as any);
      mockApiClient.getLabels.mockResolvedValue(labelsFromApi);
      mockCalculateLabelDiff.mockReturnValue(labelDiff);
      mockActionLabelDiff.mockReturnValue(labelDiffActions);
      mockStringifyLabelDiff.mockReturnValue(labelDiffStringified);

      options = {
        accessToken: 'mock-github-access-token',
        labels: [{ name: 'bar', color: '00ff00' }],
        log,
        repo: 'foo/bar',
      };

      returnedPromise = githubLabelSync(options);
    });

    it('should return a promise', () => {
      expect(returnedPromise).toBeInstanceOf(Promise);
    });

    it('should create a GitHub API client with accessToken and endpoint', () => {
      expect(mockCreateApiClient).toHaveBeenCalledWith(options.accessToken, null);
    });

    describe('when resolved', () => {
      let resolvedValue: LabelDiff;

      beforeEach(async () => {
        resolvedValue = await returnedPromise;
      });

      it('should fetch labels for the repo', () => {
        expect(mockApiClient.getLabels).toHaveBeenCalledWith(options.repo);
      });

      it('should diff the labels against options.labels', () => {
        expect(mockCalculateLabelDiff).toHaveBeenCalledWith(labelsFromApi, options.labels, false);
      });

      it('should stringify and log the diff', () => {
        expect(mockStringifyLabelDiff).toHaveBeenCalledWith(labelDiff);
        expect(log.info).toHaveBeenCalledWith('foo stringified');
        expect(log.info).toHaveBeenCalledWith('bar stringified');
      });

      it('should call actionLabelDiff with the correct args', () => {
        expect(mockActionLabelDiff).toHaveBeenCalledWith(
          expect.objectContaining({ apiClient: mockApiClient, diff: labelDiff, repo: options.repo }),
        );
      });

      it('should log success', () => {
        expect(log.info).toHaveBeenCalledWith('Labels updated');
        expect(log.info).not.toHaveBeenCalledWith('Labels are already up to date');
      });

      it('should resolve with the label diff', () => {
        expect(resolvedValue).toEqual(labelDiff);
      });
    });

    describe('when no labels need updating', () => {
      it('should log that labels are up to date', async () => {
        const freshLog = { info: vi.fn(), warn: vi.fn() };
        mockCalculateLabelDiff.mockReturnValue([]);
        mockActionLabelDiff.mockReturnValue([]);
        mockStringifyLabelDiff.mockReturnValue([]);
        await githubLabelSync({ ...options, log: freshLog });
        expect(freshLog.info).toHaveBeenCalledWith('Labels are already up to date');
        expect(freshLog.info).not.toHaveBeenCalledWith('Labels updated');
      });
    });

    describe('when dryRun is true', () => {
      beforeEach(() => {
        options.dryRun = true;
        mockActionLabelDiff.mockReset();
        returnedPromise = githubLabelSync(options);
      });

      it('should not call actionLabelDiff', async () => {
        await returnedPromise;
        expect(mockActionLabelDiff).not.toHaveBeenCalled();
      });
    });

    describe('when allowAddedLabels is true', () => {
      beforeEach(() => {
        options.allowAddedLabels = true;
        mockCalculateLabelDiff.mockReset();
        mockCalculateLabelDiff.mockReturnValue([]);
        mockActionLabelDiff.mockReturnValue([]);
        returnedPromise = githubLabelSync(options);
      });

      it('should pass allowAddedLabels=true to calculateLabelDiff', async () => {
        await returnedPromise;
        expect(mockCalculateLabelDiff).toHaveBeenCalledWith(labelsFromApi, options.labels, true);
      });
    });

    describe('when a label fails validation', () => {
      it('should reject with a validation error message', async () => {
        mockValidateLabelFormat.mockReturnValue(false as unknown as ReturnType<typeof mockValidateLabelFormat>);
        (mockValidateLabelFormat as unknown as Record<string, unknown>).errors = [
          { instancePath: '/color', message: 'must match pattern' },
        ];
        await expect(githubLabelSync({ ...options, labels: [{ name: 'bad', color: 'zzz' }] })).rejects.toThrow('Invalid label');
        (mockValidateLabelFormat as unknown as Record<string, unknown>).errors = undefined;
        mockValidateLabelFormat.mockReset();
      });
    });

    describe('when no log option is provided', () => {
      it('should use the default noop logger without throwing', async () => {
        mockCalculateLabelDiff.mockReturnValue([]);
        mockActionLabelDiff.mockReturnValue([]);
        mockStringifyLabelDiff.mockReturnValue([]);
        const optionsWithoutLog = { ...options };
        delete optionsWithoutLog.log;
        await expect(githubLabelSync(optionsWithoutLog)).resolves.toEqual([]);
      });
    });
  });
});
