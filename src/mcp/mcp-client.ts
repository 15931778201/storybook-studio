// src/mcp/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool, ToolResult } from '../core/tool';
import { z } from 'zod';

export class MCPClient {
  private clients: Map<string, Client> = new Map();

  // 连接到一个 MCP 服务器
  async connectServer(name: string, command: string, args: string[] = []) {
    const transport = new StdioClientTransport({ command, args });
    const client = new Client({ name: `agentkit-${name}`, version: '1.0.0' });
    await client.connect(transport);
    this.clients.set(name, client);
  }

  // 获取所有 MCP 服务器的工具列表
  async listAllTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    for (const [serverName, client] of this.clients.entries()) {
      const toolsResult = await client.listTools();
      for (const toolDef of toolsResult.tools) {
        // 将 MCP 工具定义转换为我们的 Tool 子类（动态包装）
        const dynamicTool = new DynamicMCPTool(serverName, toolDef, client);
        allTools.push(dynamicTool);
      }
    }
    return allTools;
  }

  // 获取单个 MCP 工具执行
  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server ${serverName} not connected`);
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  }
}

// 动态生成的 MCP 工具包装器（符合 Agent 框架的 Tool 接口）
export class DynamicMCPTool extends Tool {
  public name: string;
  public description: string;
  public parameters: z.ZodTypeAny;

  constructor(
    private serverName: string,
    toolDef: any,
    private client: Client
  ) {
    super();
    this.name = `${serverName}_${toolDef.name}`;
    this.description = toolDef.description || `MCP tool: ${toolDef.name}`;
    // 将 MCP 的 inputSchema 转换为 Zod schema
    this.parameters = convertInputSchemaToZod(toolDef.inputSchema);
  }

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    try {
      const result = await this.client.callTool({
        name: this.name.replace(`${this.serverName}_`, ''),
        arguments: validatedParams as any,
      });
      return { success: true, output: JSON.stringify(result) };
    } catch (err: any) {
      return { success: false, output: err.message };
    }
  }
}

// 将 JSON Schema 转换为 Zod schema 的简化版
function convertInputSchemaToZod(schema: any): z.ZodTypeAny {
  if (schema.type === 'object' && schema.properties) {
    const shape: any = {};
    for (const key in schema.properties) {
      const prop = schema.properties[key];
      switch (prop.type) {
        case 'string': shape[key] = z.string().optional(); break;
        case 'number': shape[key] = z.number().optional(); break;
        case 'boolean': shape[key] = z.boolean().optional(); break;
        default: shape[key] = z.any().optional();
      }
    }
    return z.object(shape);
  }
  return z.any();
}