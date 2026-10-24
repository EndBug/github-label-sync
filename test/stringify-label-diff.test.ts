import { describe, it, expect, beforeEach } from 'vitest';
import stringifyLabelDiff from '../src/stringify-label-diff';
import type { LabelDiff } from '../src/index';

describe('stringifyLabelDiff', () => {
  let labelDiff: LabelDiff;

  beforeEach(() => {
    labelDiff = [];
  });

  it('should return an array', () => {
    expect(stringifyLabelDiff(labelDiff)).toBeInstanceOf(Array);
  });

  it('should stringify "missing" diff entries', () => {
    labelDiff.push({ name: 'foo', type: 'missing', actual: null, expected: { name: 'foo', color: '00ff00' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Missing: the "foo" label is missing from the repo. It will be created.');
  });

  it('should stringify "changed" diff entries', () => {
    labelDiff.push({ name: 'foo', type: 'changed', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'bar', color: '00ff00' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Changed: the "foo" label in the repo is out of date. It will be updated to "bar" with color "#00ff00".');
  });

  it('should include description in "changed" entries when present', () => {
    labelDiff.push({ name: 'foo', type: 'changed', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'bar', color: '00ff00', description: 'my desc' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result[0]).toContain('and description "my desc"');
  });

  it('should stringify "merge" diff entries', () => {
    labelDiff.push({ name: 'foo', type: 'merge', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'bar', color: '00ff00' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Changed: the "foo" label in the repo is out of date. It will be updated to "bar" with color "#00ff00".');
  });

  it('should stringify "added" diff entries', () => {
    labelDiff.push({ name: 'foo', type: 'added', actual: { name: 'foo', color: 'ff0000' }, expected: null });
    const result = stringifyLabelDiff(labelDiff);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Added: the "foo" label in the repo is not expected. It will be deleted.');
  });

  it('should filter out invalid entries', () => {
    labelDiff.push({ type: 'invalid' } as unknown as LabelDiff[number]);
    expect(stringifyLabelDiff(labelDiff)).toHaveLength(0);
  });
});
