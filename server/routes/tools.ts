import { Hono } from 'hono';
import { getToolDefinitions } from '../../src/core/tool';

const tools = new Hono();

// 获取所有可用工具的定义
tools.get('/', async (c) => {
  try {
    const toolDefinitions = getToolDefinitions();
    
    // 转换为前端需要的格式
    const toolsData = toolDefinitions.map(toolDef => ({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      example: toolDef.example,
      category: toolDef.category || '通用'
    }));
    
    return c.json({
      success: true,
      data: toolsData
    });
  } catch (error) {
    console.error('Error fetching tools:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch tools'
    }, 500);
  }
});

export default tools;