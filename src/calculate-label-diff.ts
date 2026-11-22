import type { ConfiguredLabel, GitHubLabel, LabelDiff, LabelDiffEntry } from './index.js';
import { normalizeColor } from './label-color.js';

export default function calculateLabelDiff(
  currentLabels: GitHubLabel[],
  configuredLabels: ConfiguredLabel[],
  allowAddedLabels = false,
): LabelDiff {
  const diff: LabelDiff = [];
  const resolvedLabels: GitHubLabel[] = [];

  configuredLabels.forEach((configuredLabel) => {
    const nameMatches = currentLabels.filter((currentLabel) =>
      currentLabel.name.toLowerCase() === configuredLabel.name.toLowerCase(),
    );

    const aliasMatches = currentLabels.filter((currentLabel) =>
      nameMatches.indexOf(currentLabel) === -1 &&
      (configuredLabel.aliases?.map(label => label.toLowerCase()) ?? []).indexOf(currentLabel.name.toLowerCase()) !== -1,
    );

    const matches = [...nameMatches, ...aliasMatches];
    resolvedLabels.push(...matches);

    if (matches.length === 0 && !configuredLabel.delete) {
      diff.push(createMissingEntry(configuredLabel));
      return;
    }

    matches.forEach((matchedLabel, index) => {
      if (configuredLabel.delete) {
        diff.push(createAddedEntry(matchedLabel));
        return;
      }

      const matchedDescription = getLabelDescription(matchedLabel);
      const configuredDescription = getLabelDescription(configuredLabel, matchedDescription);

      if (
        configuredLabel.name !== matchedLabel.name ||
        colorsDiffer(configuredLabel, matchedLabel) ||
        configuredDescription !== matchedDescription
      ) {
        if (index === 0) {
          diff.push(createChangedEntry(matchedLabel, configuredLabel));
          return;
        }
        diff.push(createMergeEntry(matchedLabel, configuredLabel));
      }
    });
  });

  currentLabels
    .filter(label => resolvedLabels.indexOf(label) === -1)
    .forEach((currentLabel) => {
      if (!allowAddedLabels) {
        diff.push(createAddedEntry(currentLabel));
      }
    });

  return diff;
}

function colorsDiffer(configuredLabel: ConfiguredLabel, matchedLabel: GitHubLabel): boolean {
  // Color is optional. An omitted value means "leave the repo color alone",
  // matching the way an omitted description keeps the current description.
  if (!configuredLabel.color) {
    return false;
  }
  return normalizeColor(configuredLabel.color) !== matchedLabel.color.toLowerCase();
}

function configuredColor(label: ConfiguredLabel, fallback: string): string {
  if (!label.color) {
    return fallback;
  }
  return normalizeColor(label.color);
}

function getLabelDescription(label: GitHubLabel | ConfiguredLabel, fallback = ''): string {
  if (label.description === undefined) {
    return fallback;
  }
  return (label.description && label.description.trim()) || '';
}

function createMissingEntry(expectedLabel: ConfiguredLabel): LabelDiffEntry {
  const entry: LabelDiffEntry = {
    name: expectedLabel.name,
    type: 'missing',
    actual: null,
    expected: {
      name: expectedLabel.name,
      color: configuredColor(expectedLabel, ''),
    },
  };
  const expectedDescription = getLabelDescription(expectedLabel);
  if (expectedDescription) {
    entry.expected!.description = expectedDescription;
  }
  return entry;
}

function createChangedEntry(actualLabel: GitHubLabel, expectedLabel: ConfiguredLabel): LabelDiffEntry {
  const entry: LabelDiffEntry = {
    name: actualLabel.name,
    type: 'changed',
    actual: {
      name: actualLabel.name,
      color: actualLabel.color,
    },
    expected: {
      name: expectedLabel.name,
      color: configuredColor(expectedLabel, actualLabel.color),
    },
  };

  const actualDescription = getLabelDescription(actualLabel);
  const expectedDescription = getLabelDescription(expectedLabel, actualDescription);

  if (actualDescription === expectedDescription && !actualDescription) {
    return entry;
  }

  entry.actual!.description = actualDescription;
  entry.expected!.description = expectedDescription;
  return entry;
}

function createMergeEntry(actualLabel: GitHubLabel, expectedLabel: ConfiguredLabel): LabelDiffEntry {
  return { ...createChangedEntry(actualLabel, expectedLabel), type: 'merge' };
}

function createAddedEntry(actualLabel: GitHubLabel): LabelDiffEntry {
  const entry: LabelDiffEntry = {
    name: actualLabel.name,
    type: 'added',
    actual: {
      name: actualLabel.name,
      color: actualLabel.color,
    },
    expected: null,
  };
  const actualDescription = getLabelDescription(actualLabel);
  if (actualDescription) {
    entry.actual!.description = actualDescription;
  }
  return entry;
}
