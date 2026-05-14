import { z } from 'zod';

// ── Zod → JSON Schema 转换 ──
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  return convertSchema(schema).schema;
}

function convertSchema(schema: z.ZodTypeAny): { schema: Record<string, any>; optional: boolean } {
  const description = (schema as any)._def?.description;

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const inner = convertSchema((schema as any)._def.innerType);
    return { schema: withDescription(inner.schema, description), optional: true };
  }

  if (schema instanceof z.ZodDefault) {
    const inner = convertSchema((schema as any)._def.innerType);
    return { schema: withDescription(inner.schema, description), optional: true };
  }

  if (schema instanceof z.ZodEffects) {
    const inner = convertSchema((schema as any)._def.schema);
    return { schema: withDescription(inner.schema, description), optional: inner.optional };
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const key in shape) {
      const converted = convertSchema(shape[key]);
      properties[key] = converted.schema;
      if (!converted.optional) required.push(key);
    }

    return {
      schema: withDescription({
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      schema: withDescription({
        type: 'array',
        items: convertSchema((schema as any)._def.type).schema,
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodUnion) {
    return {
      schema: withDescription({
        anyOf: (schema as any)._def.options.map((option: z.ZodTypeAny) => convertSchema(option).schema),
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodRecord) {
    const valueType = (schema as any)._def.valueType;
    return {
      schema: withDescription({
        type: 'object',
        additionalProperties: valueType ? convertSchema(valueType).schema : true,
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      schema: withDescription({
        type: 'string',
        enum: (schema as any)._def.values,
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodLiteral) {
    const value = (schema as any)._def.value;
    return {
      schema: withDescription({
        type: typeof value,
        const: value,
      }, description),
      optional: false,
    };
  }

  if (schema instanceof z.ZodNumber) {
    return { schema: withDescription({ type: 'number' }, description), optional: false };
  }
  if (schema instanceof z.ZodBoolean) {
    return { schema: withDescription({ type: 'boolean' }, description), optional: false };
  }
  if (schema instanceof z.ZodString) {
    return { schema: withDescription({ type: 'string' }, description), optional: false };
  }
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return { schema: withDescription({}, description), optional: false };
  }

  return { schema: withDescription({ type: 'string' }, description), optional: false };
}

function withDescription(schema: Record<string, any>, description?: string): Record<string, any> {
  if (!description) return schema;
  return { ...schema, description };
}
