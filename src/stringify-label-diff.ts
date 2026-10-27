import type { LabelDiff } from './index.js';

function descriptionSuffix(description: string | undefined): string {
  if (description === undefined) {
    return '';
  }
  if (description === '') {
    return ' and the description will be removed';
  }
  return ` and description "${description}"`;
}

export default function stringifyLabelDiff(labelDiff: LabelDiff): string[] {
  const result = labelDiff.map((diffEntry): string | undefined => {
    if (diffEntry.type === 'missing') {
      return `Missing: the "${diffEntry.name}" label is missing from the repo. It will be created.`;
    }
    if (diffEntry.type === 'changed') {
      const description = diffEntry.expected?.description;
      return (
        `Changed: the "${diffEntry.name}" label in the repo is out of date.` +
        ` It will be updated to "${diffEntry.expected?.name}" with color "#${diffEntry.expected?.color}"` +
        descriptionSuffix(description) +
        '.'
      );
    }
    if (diffEntry.type === 'merge') {
      const description = diffEntry.expected?.description;
      return (
        `Merge: issues and pull requests using the "${diffEntry.name}" label will be moved to "${diffEntry.expected?.name}" with color "#${diffEntry.expected?.color}"` +
        descriptionSuffix(description) +
        `, and the "${diffEntry.name}" label will be deleted.`
      );
    }
    if (diffEntry.type === 'added') {
      return `Added: the "${diffEntry.name}" label in the repo is not expected. It will be deleted.`;
    }
    return undefined;
  });
  return result.filter((s): s is string => s !== undefined);
}
