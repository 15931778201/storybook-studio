import { describe, expect, it, mock } from 'bun:test';
import { z } from 'zod';
import { Tool } from '../src/core/tool';
import { CreateSkillTool, UpdateSkillTool } from '../src/tools/skill-creator';
import { ListSkillsTool, SkillCallerTool } from '../src/tools/skill-caller';
import { SkillDistillerTool } from '../src/tools/skill-distiller';
import type { ParsedSkill, SkillStep } from '../src/types/skill';

function parsedSkill(name: string, steps: SkillStep[] = []): ParsedSkill {
  return {
    metadata: {
      name,
      title: `${name} title`,
      description: `${name} description`,
      version: '1.0.0',
      author: 'test',
      tags: ['test'],
      createdAt: '',
      updatedAt: '',
    },
    steps,
    raw: '',
  };
}

class EchoTool extends Tool {
  name = 'echo';
  description = 'echo';
  parameters = z.object({ value: z.string() });

  protected async executeCore(validatedParams: unknown) {
    const { value } = validatedParams as { value: string };
    return { success: true, output: value };
  }
}

describe('skill tools', () => {
  it('ListSkillsTool lists available skill metadata', async () => {
    const manager = {
      listSkills: () => [parsedSkill('demo')],
    };

    const result = await new ListSkillsTool(manager as any).execute({});

    expect(result.success).toBe(true);
    expect(result.output).toContain('demo');
  });

  it('SkillCallerTool executes a saved skill with context variables', async () => {
    const manager = {
      getSkill: () =>
        parsedSkill('demo', [
          {
            id: 'step-1',
            order: 1,
            tool: 'echo',
            params: { value: '{{message}}' },
            description: 'echo message',
          },
        ]),
    };

    const result = await new SkillCallerTool(manager as any, [new EchoTool()]).execute({
      skillName: 'demo',
      context: { message: 'hello skill' },
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('hello skill');
  });

  it('CreateSkillTool normalizes string steps before creating a skill', async () => {
    const createSkill = mock((name: string, title: string, description: string, steps: SkillStep[], tags: string[]) => ({
      ...parsedSkill(name, steps),
      metadata: { ...parsedSkill(name, steps).metadata, title, description, tags },
    }));
    const manager = { createSkill };

    const result = await new CreateSkillTool(manager as any).execute({
      name: 'demo',
      title: 'Demo',
      description: 'Demo skill',
      steps: JSON.stringify([{ tool: 'echo', params: { value: 'hi' }, description: 'say hi' }]),
      tags: ['custom'],
    });

    expect(result.success).toBe(true);
    expect(createSkill).toHaveBeenCalledTimes(1);
    expect(createSkill.mock.calls[0][3][0]).toMatchObject({
      id: 'step-1',
      order: 1,
      tool: 'echo',
      params: { value: 'hi' },
      onError: 'skip',
    });
  });

  it('UpdateSkillTool converts provided step updates to stored skill steps', async () => {
    const updateSkill = mock((_name: string, updates: any) => parsedSkill('demo', updates.steps));
    const manager = { updateSkill };

    const result = await new UpdateSkillTool(manager as any).execute({
      name: 'demo',
      steps: [{ tool: 'echo', params: { value: 'updated' }, onError: 'stop' }],
    });

    expect(result.success).toBe(true);
    expect(updateSkill.mock.calls[0][1].steps[0]).toMatchObject({
      id: 'step-1',
      order: 1,
      tool: 'echo',
      params: { value: 'updated' },
      onError: 'stop',
    });
  });

  it('SkillDistillerTool creates a skill from LLM-extracted steps', async () => {
    const createSkill = mock((name: string, title: string, description: string, steps: SkillStep[], tags: string[]) => ({
      ...parsedSkill(name, steps),
      metadata: { ...parsedSkill(name, steps).metadata, title, description, tags },
    }));
    const manager = { createSkill };
    const openai = {
      chat: {
        completions: {
          create: mock(async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    description: 'extracted',
                    tags: ['custom'],
                    steps: [{ tool: 'echo', params: { value: 'from history' }, description: 'echo history' }],
                  }),
                },
              },
            ],
          })),
        },
      },
    };

    const result = await new SkillDistillerTool(manager as any, openai as any).execute({
      name: 'distilled',
      title: 'Distilled',
      recentMessages: JSON.stringify([{ role: 'user', content: 'save this' }]),
      generalizeParams: false,
    });

    expect(result.success).toBe(true);
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(createSkill.mock.calls[0][3][0]).toMatchObject({
      id: 'step-1',
      tool: 'echo',
      params: { value: 'from history' },
      description: 'echo history',
    });
  });
});
