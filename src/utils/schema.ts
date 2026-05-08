import { z } from 'zod';

// ── Zod → JSON Schema 转换 ──
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  if (typeof (schema as any).toJSONSchema === 'function') {
    return (schema as any).toJSONSchema();
  }
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<any>).shape;
    const properties: Record<string, any> = {};
    for (const key in shape) {
      const field = shape[key];
      let type = 'string';
      if (field instanceof z.ZodString) type = 'string';
      else if (field instanceof z.ZodNumber) type = 'number';
      else if (field instanceof z.ZodBoolean) type = 'boolean';
      properties[key] = {
        type,
        description: (field as any)._def?.description ?? '',
      };
    }
    return { type: 'object', properties, required: Object.keys(shape) };
  }
  return { type: 'object', properties: {} };
}
