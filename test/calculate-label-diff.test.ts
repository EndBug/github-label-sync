import { describe, it, expect, beforeEach } from 'vitest';
import calculateLabelDiff from '../src/calculate-label-diff';
import type { ConfiguredLabel, GitHubLabel, LabelDiff } from '../src/index';

describe('calculateLabelDiff', () => {
  it('should return an array', () => {
    expect(calculateLabelDiff([], [])).toBeInstanceOf(Array);
  });

  describe('when a configured label does not exist in the current labels', () => {
    let diff: LabelDiff;

    beforeEach(() => {
      diff = calculateLabelDiff([], [{ name: 'bar', color: '00ff00' }]);
    });

    it('should add a "missing" entry to the returned diff', () => {
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'bar', type: 'missing', actual: null, expected: { name: 'bar', color: '00ff00' } });
    });
  });

  describe('when a configured label set to delete does not exist in the current labels', () => {
    it('should not add a "missing" entry to the returned diff', () => {
      const diff = calculateLabelDiff([], [{ name: 'bar', color: '00ff00', delete: true }]);
      expect(diff).toHaveLength(0);
    });
  });

  describe('when a configured label with description does not exist in the current labels', () => {
    it('should add a "missing" entry with description', () => {
      const diff = calculateLabelDiff([], [{ name: 'bar', color: '00ff00', description: 'foo' }]);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'bar', type: 'missing', actual: null, expected: { name: 'bar', color: '00ff00', description: 'foo' } });
    });
  });

  describe('when a configured label exists with no changes', () => {
    it('should not add an entry to the returned diff', () => {
      const current: GitHubLabel[] = [{ name: 'foo', color: 'ff0000', description: 'bar' }];
      const configured: ConfiguredLabel[] = [{ name: 'foo', color: 'ff0000', description: 'bar' }];
      expect(calculateLabelDiff(current, configured)).toHaveLength(0);
    });
  });

  describe('when a configured label exists but has changes', () => {
    it('should add a "changed" entry to the returned diff', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000' }],
        [{ name: 'foo', color: '00ff00' }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'foo', type: 'changed',
        actual: { name: 'foo', color: 'ff0000' },
        expected: { name: 'foo', color: '00ff00' },
      });
    });
  });

  describe('when a configured label is marked for deletion and exists', () => {
    it('should add an "added" entry for each match', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000' }, { name: 'bar', color: '00ff00' }],
        [{ name: 'foo', delete: true, aliases: ['bar'] }],
      );
      expect(diff).toHaveLength(2);
      expect(diff[0]).toEqual({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000' }, expected: null });
      expect(diff[1]).toEqual({ name: 'bar', type: 'added', actual: { name: 'bar', color: '00ff00' }, expected: null });
    });
  });

  describe('when a configured label with description exists without description', () => {
    it('should add a "changed" entry', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000' }],
        [{ name: 'foo', color: 'ff0000', description: 'bar' }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'foo', type: 'changed',
        actual: { name: 'foo', color: 'ff0000', description: '' },
        expected: { name: 'foo', color: 'ff0000', description: 'bar' },
      });
    });
  });

  describe('when a configured label without description exists with description', () => {
    it('should not add an entry to the returned diff', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000', description: 'bar' }],
        [{ name: 'foo', color: 'ff0000' }],
      );
      expect(diff).toHaveLength(0);
    });
  });

  describe('when a configured label with empty description exists with description', () => {
    it('should add a "changed" entry', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000', description: 'bar' }],
        [{ name: 'foo', color: 'ff0000', description: '' }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'foo', type: 'changed',
        actual: { name: 'foo', color: 'ff0000', description: 'bar' },
        expected: { name: 'foo', color: 'ff0000', description: '' },
      });
    });
  });

  describe('when a configured label exists but has case changes only', () => {
    it('should add a "changed" entry', () => {
      const diff = calculateLabelDiff(
        [{ name: 'FOO', color: 'ff0000' }],
        [{ name: 'foo', color: 'ff0000' }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'FOO', type: 'changed',
        actual: { name: 'FOO', color: 'ff0000' },
        expected: { name: 'foo', color: 'ff0000' },
      });
    });
  });

  describe('when a configured label alias exists in the current labels', () => {
    it('should add a "changed" entry', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000' }],
        [{ name: 'bar', color: '00ff00', aliases: ['foo'] }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'foo', type: 'changed',
        actual: { name: 'foo', color: 'ff0000' },
        expected: { name: 'bar', color: '00ff00' },
      });
    });
  });

  describe('when both the label and an alias exist in current labels', () => {
    it('should add a "changed" entry for the label and a "merge" for the alias', () => {
      const diff = calculateLabelDiff(
        [{ name: 'bar', color: '00ff00' }, { name: 'foo', color: 'ff0000' }],
        [{ name: 'foo', color: '0000ff', aliases: ['bar'] }],
      );
      expect(diff).toHaveLength(2);
      expect(diff).toEqual([
        { name: 'foo', type: 'changed', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'foo', color: '0000ff' } },
        { name: 'bar', type: 'merge', actual: { name: 'bar', color: '00ff00' }, expected: { name: 'foo', color: '0000ff' } },
      ]);
    });
  });

  describe('when multiple aliases exist in current labels', () => {
    it('should add "changed" for the first and "merge" for the rest', () => {
      const diff = calculateLabelDiff(
        [{ name: 'bar', color: '00ff00' }, { name: 'foo', color: 'ff0000' }],
        [{ name: 'baz', color: '0000ff', aliases: ['foo', 'bar'] }],
      );
      expect(diff).toHaveLength(2);
      expect(diff).toEqual([
        { name: 'bar', type: 'changed', actual: { name: 'bar', color: '00ff00' }, expected: { name: 'baz', color: '0000ff' } },
        { name: 'foo', type: 'merge', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'baz', color: '0000ff' } },
      ]);
    });
  });

  describe('when allowAddedLabels is false', () => {
    it('should add an "added" entry for labels not in config', () => {
      const diff = calculateLabelDiff([{ name: 'foo', color: 'ff0000' }], [], false);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000' }, expected: null });
    });

    it('should add an "added" entry for labels with description not in config', () => {
      const diff = calculateLabelDiff([{ name: 'foo', color: 'ff0000', description: 'bar' }], [], false);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000', description: 'bar' }, expected: null });
    });
  });

  describe('when allowAddedLabels is true', () => {
    it('should not add an "added" entry for labels not in config', () => {
      expect(calculateLabelDiff([{ name: 'foo', color: 'ff0000' }], [], true)).toHaveLength(0);
    });

    it('should still add an "added" entry for labels marked for deletion', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000' }],
        [{ name: 'foo', delete: true }],
        true,
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000' }, expected: null });
    });

    it('should add an "added" entry for labels with description marked for deletion', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000', description: 'bar', delete: true } as GitHubLabel],
        [{ name: 'foo', delete: true }],
        true,
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000', description: 'bar' }, expected: null });
    });
  });

  describe('when a configured label with no color is missing', () => {
    it('should add a "missing" entry with empty color', () => {
      const diff = calculateLabelDiff([], [{ name: 'bar' }]);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({ name: 'bar', type: 'missing', actual: null, expected: { name: 'bar', color: '' } });
    });
  });

  describe('when a label changes in color but keeps the same non-empty description', () => {
    it('should add a "changed" entry including the description on both sides', () => {
      const diff = calculateLabelDiff(
        [{ name: 'foo', color: 'ff0000', description: 'bar' }],
        [{ name: 'foo', color: '00ff00', description: 'bar' }],
      );
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        name: 'foo', type: 'changed',
        actual: { name: 'foo', color: 'ff0000', description: 'bar' },
        expected: { name: 'foo', color: '00ff00', description: 'bar' },
      });
    });
  });

  describe('when a range of diffs are expected', () => {
    it('should add all expected entries', () => {
      const current: GitHubLabel[] = [
        { name: 'pub', color: '00ff00' },
        { name: 'baz', color: 'ffffff' },
        { name: 'qux', color: '000000' },
      ];
      const configured: ConfiguredLabel[] = [
        { name: 'foo', color: 'ff0000' },
        { name: 'bar', color: '00ff00', aliases: ['pub'] },
        { name: 'baz', color: '0000ff' },
      ];
      const diff = calculateLabelDiff(current, configured);
      expect(diff).toHaveLength(4);
      expect(diff).toEqual([
        { name: 'foo', type: 'missing', actual: null, expected: { name: 'foo', color: 'ff0000' } },
        { name: 'pub', type: 'changed', actual: { name: 'pub', color: '00ff00' }, expected: { name: 'bar', color: '00ff00' } },
        { name: 'baz', type: 'changed', actual: { name: 'baz', color: 'ffffff' }, expected: { name: 'baz', color: '0000ff' } },
        { name: 'qux', type: 'added', actual: { name: 'qux', color: '000000' }, expected: null },
      ]);
    });
  });
});
