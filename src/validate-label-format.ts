import Ajv from 'ajv/dist/ajv.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from './label-formats.js';
import { normalizeColor } from './label-color.js';
import type { ConfiguredLabel } from './index.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 50, format: 'must contain more than native emoji' },
    color: { type: 'string', pattern: '^[a-fA-F0-9]{6}$' },
    description: { type: 'string', maxLength: 100, format: "doesn't accept 4-byte Unicode" },
    delete: { type: 'boolean', default: false },
    aliases: {
      type: 'array',
      items: { type: 'string', maxLength: 50, format: 'must contain more than native emoji' },
    },
  },
  required: ['name'],
  additionalProperties: false,
};

const compiled: ValidateFunction<ConfiguredLabel> = ajv.compile(schema);

interface LabelValidator {
  (data: unknown): data is ConfiguredLabel;
  errors: ErrorObject[] | null | undefined;
}

const validateLabelFormat = function validateLabelFormat(data: unknown): data is ConfiguredLabel {
  if (data !== null && typeof data === 'object' && 'color' in data) {
    const record = data as { color?: unknown };
    if (typeof record.color === 'string') {
      record.color = normalizeColor(record.color);
    }
  }
  const valid = compiled(data);
  (validateLabelFormat as LabelValidator).errors = compiled.errors;
  return valid;
} as LabelValidator;

validateLabelFormat.errors = compiled.errors ?? null;

export default validateLabelFormat as ValidateFunction<ConfiguredLabel>;
