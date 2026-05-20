import type { LabelDiff } from './index.js';

export default function stringifyLabelDiff(labelDiff: LabelDiff): string[] {
  const result = labelDiff.map((diffEntry): string | undefined => {
    if (diffEntry.type === 'missing') {
      return `Missing: the "${diffEntry.name}" label is missing from the repo. It will be created.`;
    }
    if (diffEntry.type === 'changed' || diffEntry.type === 'merge') {
      const description = diffEntry.expected?.description;
      return (
        `Changed: the "${diffEntry.name}" label in the repo is out of date.` +
        ` It will be updated to "${diffEntry.expected?.name}" with color "#${diffEntry.expected?.color}"` +
        (description ? ` and description "${description}"` : '') + '.'
      );
    }
    if (diffEntry.type === 'added') {
      return `Added: the "${diffEntry.name}" label in the repo is not expected. It will be deleted.`;
    }
    return undefined;
  });
  return result.filter((s): s is string => s !== undefined);
}
