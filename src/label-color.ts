import type { ConfiguredLabel } from './index.js';

export function normalizeColor(color: string): string {
  const stripped = color.startsWith('#') ? color.slice(1) : color;
  return stripped.toLowerCase();
}

export function normalizeConfiguredLabel(label: ConfiguredLabel): ConfiguredLabel {
  if (typeof label.color !== 'string') {
    return label;
  }
  const color = normalizeColor(label.color);
  if (color === label.color) {
    return label;
  }
  return { ...label, color };
}
