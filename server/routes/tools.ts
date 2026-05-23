import { Hono } from 'hono';
import { getToolDefinitions } from '../../src/core/tool';
import { FileTreeSummaryTool, GitContextTool, RepoMapTool } from '../../src';

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

tools.get('/workspace-context', async (c) => {
  const projectPath = c.req.query('projectPath') || '.';
  try {
    const repoMap = new RepoMapTool({ workspaceRoot: projectPath });
    const fileTree = new FileTreeSummaryTool({ workspaceRoot: projectPath });
    const gitContext = new GitContextTool({ workspaceRoot: projectPath });

    const [repoMapResult, fileTreeResult, gitContextResult] = await Promise.all([
      repoMap.execute({ path: '.', maxFiles: 30, maxDepth: 3 }),
      fileTree.execute({ path: '.', maxDepth: 3, maxEntries: 80 }),
      gitContext.execute({ commits: 3, diffLines: 120 }),
    ]);

    return c.json({
      success: true,
      data: {
        repoMap: repoMapResult.output,
        fileTreeSummary: fileTreeResult.output,
        gitContext: gitContextResult.output,
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || 'Failed to load workspace context',
    }, 500);
  }
});

export default tools;
