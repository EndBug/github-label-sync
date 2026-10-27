import { describe, expect, it } from 'vitest';
import validateLabelFormat from '../src/validate-label-format';

describe('validateLabelFormat', () => {
  it('should reject a missing name', () => {
    expect(validateLabelFormat({})).toBe(false);
    expect(validateLabelFormat.errors?.[0]).toMatchObject({
      instancePath: '',
      message: expect.any(String),
    });
  });

  it('should accept a 50 character name and reject 51', () => {
    const name = 'a'.repeat(50);
    expect(validateLabelFormat({ name })).toBe(true);
    expect(validateLabelFormat({ name: `${name}a` })).toBe(false);
  });

  it('should reject an emoji-only name and accept text with an emoji', () => {
    expect(validateLabelFormat({ name: '🐛', color: 'ff0000' })).toBe(false);
    expect(validateLabelFormat({ name: 'bug 🐛', color: 'ff0000' })).toBe(true);
  });

  it('should accept a missing color and both hex cases', () => {
    expect(validateLabelFormat({ name: 'bug' })).toBe(true);
    const upper = { name: 'bug', color: 'FF0000' };
    expect(validateLabelFormat(upper)).toBe(true);
    expect(upper.color).toBe('ff0000');
    expect(validateLabelFormat({ name: 'bug', color: 'ff0000' })).toBe(true);
  });

  it('should strip one leading hash before checking the color pattern', () => {
    const label = { name: 'bug', color: '#ff0000' };
    expect(validateLabelFormat(label)).toBe(true);
    expect(label.color).toBe('ff0000');
  });

  it('should reject colors that are not 6 hex digits', () => {
    expect(validateLabelFormat({ name: 'bug', color: 'fff' })).toBe(false);
    expect(validateLabelFormat.errors?.[0]).toMatchObject({
      instancePath: '/color',
      message: expect.stringContaining('pattern'),
    });
    expect(validateLabelFormat({ name: 'bug', color: 'gggggg' })).toBe(false);
    expect(validateLabelFormat({ name: 'bug', color: '##ff0000' })).toBe(false);
  });

  it('should accept a 100 character description and reject 101', () => {
    expect(validateLabelFormat({ name: 'bug', description: 'a'.repeat(100) })).toBe(true);
    expect(validateLabelFormat({ name: 'bug', description: 'a'.repeat(101) })).toBe(false);
  });

  it('should reject a description that contains an emoji', () => {
    expect(validateLabelFormat({ name: 'bug', description: 'hello 🐛' })).toBe(false);
  });

  it('should accept boolean delete values and reject a string', () => {
    expect(validateLabelFormat({ name: 'bug', delete: true })).toBe(true);
    expect(validateLabelFormat({ name: 'bug', delete: false })).toBe(true);
    expect(validateLabelFormat({ name: 'bug', delete: 'true' })).toBe(false);
  });

  it('should accept aliases and reject an emoji-only alias', () => {
    expect(validateLabelFormat({ name: 'bug', aliases: ['old'] })).toBe(true);
    expect(validateLabelFormat({ name: 'bug', aliases: ['🐛'] })).toBe(false);
  });

  it('should reject an unknown property', () => {
    expect(validateLabelFormat({ name: 'bug', color: 'ff0000', url: 'x' })).toBe(false);
    expect(validateLabelFormat.errors?.some((error) => error.keyword === 'additionalProperties')).toBe(true);
  });

  it('should expose instancePath and message when validation fails', () => {
    expect(validateLabelFormat({ name: 'bug', color: 'zzz' })).toBe(false);
    expect(Array.isArray(validateLabelFormat.errors)).toBe(true);
    expect(validateLabelFormat.errors?.[0]?.instancePath).toBe('/color');
    expect(validateLabelFormat.errors?.[0]?.message).toEqual(expect.any(String));
  });
});
