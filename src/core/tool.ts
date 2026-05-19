import { z } from 'zod';
export interface ToolResult { success: boolean; output: string; metadata?: Record<string, unknown>; }
export class ToolError extends Error {
  constructor(message: string, public toolName: string, public params: Record<string, any>, public isRetryable: boolean = false) { super(message); this.name = 'ToolError'; }
}
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodTypeAny;
  async execute(rawParams: Record<string, unknown>): Promise<ToolResult> {
    const parsed = this.parameters.safeParse(rawParams);
    if (!parsed.success) return { success: false, output: `[${this.name}] 参数校验失败: ${parsed.error.issues.map(i => i.message).join('; ')}` };
    return this.executeCore(parsed.data);
  }
  protected abstract executeCore(validatedParams: unknown): Promise<ToolResult>;
}
export async function safeExecute(toolName: string, fn: () => Promise<ToolResult>, options?: { timeout?: number; maxOutput?: number; fallback?: () => Promise<ToolResult> }): Promise<ToolResult> {
  const maxOutput = options?.maxOutput ?? 10000;
  let timeoutMs = options?.timeout ?? 30000;
  if (typeof timeoutMs !== 'number' || isNaN(timeoutMs) || timeoutMs <= 0) timeoutMs = 30000;
  if (timeoutMs > 2147483647) timeoutMs = 2147483647;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error(`工具 ${toolName} 执行超时(${timeoutMs}ms)`)), timeoutMs))
    ]);
    return { ...result, output: result.output.slice(0, maxOutput) };
  } catch (err: any) {
    if (options?.fallback) return options.fallback();
    return { success: false, output: `[${toolName} 执行失败] ${err.message}` };
  }
}

// 提取Zod参数的描述信息 - 重新实现
function extractParameterInfo(zodSchema: any) {
  const paramInfo: Record<string, { description: string; type: string; required: boolean }> = {};
  
  try {
    // 检查是否是ZodObject
    if (!zodSchema || !zodSchema._def || zodSchema._def.typeName !== 'ZodObject') {
      return paramInfo;
    }

    // 获取shape - 可能是函数或对象
    let shapeObj: Record<string, any> = {};
    if (typeof zodSchema._def.shape === 'function') {
      shapeObj = zodSchema._def.shape();
    } else if (typeof zodSchema._def.shape === 'object') {
      shapeObj = zodSchema._def.shape;
    }

    // 遍历每个参数
    for (const [key, paramSchema] of Object.entries(shapeObj)) {
      if (!paramSchema || typeof paramSchema !== 'object') {
        continue;
      }

      let actualSchema = paramSchema as any;
      let required = true;

      // 处理可选参数 (ZodOptional)
      if (actualSchema._def?.typeName === 'ZodOptional') {
        required = false;
        actualSchema = actualSchema._def.innerType;
      }

      // 获取类型名称
      let typeName = 'any';
      if (actualSchema._def?.typeName) {
        typeName = actualSchema._def.typeName.replace('Zod', '').toLowerCase();
      }

      // 获取描述 - 这是最关键的部分
      let description = key; // 默认使用key作为描述
      if (actualSchema._def?.description) {
        description = actualSchema._def.description;
      }

      paramInfo[key] = {
        description,
        type: typeName,
        required
      };
    }
  } catch (error) {
    console.warn('Failed to extract parameter info from Zod schema:', error);
  }

  return paramInfo;
}

// 获取所有工具的定义（元数据）
export function getToolDefinitions() {
  // 直接导入所有工具类并获取其静态属性
  // 注意：这里使用 require 而不是 import，因为我们需要同步获取
  const tools = [];
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ReadFileTool = require('../tools/read-file').ReadFileTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WriteFileTool = require('../tools/write-file').WriteFileTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BashTool = require('../tools/bash').BashTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GrepTool = require('../tools/grep').GrepTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GlobTool = require('../tools/glob').GlobTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebFetchTool = require('../tools/web-fetch').WebFetchTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebSearchTool = require('../tools/web-search').WebSearchTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EditFileTool = require('../tools/edit-file').EditFileTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JsonQueryTool = require('../tools/json-query').JsonQueryTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const GitTool = require('../tools/git').GitTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NotificationTool = require('../tools/notification').NotificationTool;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ArchiveTool = require('../tools/archive').ArchiveTool;
    
    const toolClasses = [
      ReadFileTool, WriteFileTool, BashTool, GrepTool, GlobTool,
      WebFetchTool, WebSearchTool, EditFileTool, JsonQueryTool,
      GitTool, NotificationTool, ArchiveTool
    ];
    
    for (const ToolClass of toolClasses) {
      if (ToolClass) {
        // 创建一个实例来获取元数据（不执行实际功能）
        const instance = new ToolClass();
        
        // 提取参数信息
        const parameterInfo = extractParameterInfo(instance.parameters);
        
        tools.push({
          name: instance.name,
          description: instance.description,
          parameters: parameterInfo,
          example: (instance as any).example || '',
          category: (instance as any).category || '通用'
        });
      }
    }
  } catch (error) {
    console.warn('Failed to load tool definitions:', error);
  }
  
  return tools;
}