import Ajv from 'ajv/dist/ajv.js';
import type { ValidateFunction } from 'ajv';
import addFormats from './label-formats.js';
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

const validateLabelFormat: ValidateFunction<ConfiguredLabel> = ajv.compile(schema);

export default validateLabelFormat;
