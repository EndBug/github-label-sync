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

  it('should say when a changed label clears its description', () => {
    labelDiff.push({ name: 'foo', type: 'changed', actual: { name: 'foo', color: 'ff0000', description: 'bar' }, expected: { name: 'foo', color: 'ff0000', description: '' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result[0]).toContain('description will be removed');
    expect(result[0]).not.toContain('and description ""');
  });

  it('should not mention description when a changed label has none', () => {
    labelDiff.push({ name: 'foo', type: 'changed', actual: { name: 'foo', color: 'ff0000' }, expected: { name: 'foo', color: '00ff00' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result[0]).not.toContain('description');
  });

  it('should stringify "merge" diff entries', () => {
    labelDiff.push({ name: 'enhancement', type: 'merge', actual: { name: 'enhancement', color: '00ff00' }, expected: { name: 'type: feature', color: '00ff00' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('enhancement');
    expect(result[0]).toContain('type: feature');
    expect(result[0]).toContain('#00ff00');
    expect(result[0]).toMatch(/deleted|removed/);
    expect(result[0]).not.toContain('will be updated');
  });

  it('should include a non-empty description on merge entries', () => {
    labelDiff.push({ name: 'enhancement', type: 'merge', actual: { name: 'enhancement', color: '00ff00' }, expected: { name: 'type: feature', color: '00ff00', description: 'my desc' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result[0]).toContain('and description "my desc"');
    expect(result[0]).toMatch(/deleted|removed/);
  });

  it('should say when a merge clears the description', () => {
    labelDiff.push({ name: 'enhancement', type: 'merge', actual: { name: 'enhancement', color: '00ff00', description: 'old' }, expected: { name: 'type: feature', color: '00ff00', description: '' } });
    const result = stringifyLabelDiff(labelDiff);
    expect(result[0]).toContain('description will be removed');
    expect(result[0]).not.toContain('and description ""');
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
