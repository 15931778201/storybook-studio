import { describe, expect, it } from 'bun:test';
import { zodToJsonSchema } from '../src/utils/schema';
import { CreateSkillTool } from '../src/tools/skill-creator';
import { SkillManager } from '../src/skills/skill-manager';
import { FileVectorStore } from '../src/vector/file-vector-store';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('zodToJsonSchema', () => {
  it('converts create_skill parameters into a valid tool schema', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-schema-'));
    const manager = new SkillManager(tempDir, new FileVectorStore(path.join(tempDir, 'vectors.json')));
    const tool = new CreateSkillTool(manager);

    const schema = zodToJsonSchema(tool.parameters);

    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['name', 'title', 'description', 'steps']);
    expect(schema.properties.tags.type).toBe('array');
    expect(schema.properties.tags.items.type).toBe('string');
    expect(schema.properties.steps.anyOf).toBeArray();
    expect(schema.properties.steps.anyOf[0].type).toBe('array');
    expect(schema.properties.steps.anyOf[0].items.properties.tool.type).toBe('string');
    expect(schema.properties.steps.anyOf[0].items.properties.params.type).toBe('object');
    expect(schema.properties.steps.anyOf[0].items.properties.params.additionalProperties).toEqual({});
    expect(schema.properties.steps.anyOf[1].type).toBe('string');
  });
});
