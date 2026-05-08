// src/market/market-service.ts
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SkillMarketItem {
  name: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  stepsCount: number;
  installCount: number;
}

export interface McpMarketItem {
  name: string;
  package: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface PluginMarketItem {
  name: string;
  description: string;
  author: string;
  version: string;
  type: string; // 如 'tool', 'skill', 'mcp'
  downloadUrl?: string;
}

// 模拟技能市场数据（实际可从 GitHub API 获取）
const SKILLS_REPO_URL = 'https://api.github.com/repos/agentkit-community/skills/contents';

export async function fetchSkillMarket(): Promise<SkillMarketItem[]> {
  try {
    const response = await fetch(SKILLS_REPO_URL);
    const data = await response.json();
    // 解析目录列表，每个目录即一个技能
    const skills: SkillMarketItem[] = [];
    for (const item of data) {
      if (item.type === 'dir') {
        // 尝试获取该技能目录下的 skill.md 进行解析
        skills.push({
          name: item.name,
          title: item.name,
          description: '社区技能',
          author: 'community',
          tags: [],
          stepsCount: 0,
          installCount: 0,
        });
      }
    }
    return skills;
  } catch {
    // 返回本地缓存或示例数据
    return [
      {
        name: 'frontend-deploy',
        title: '前端部署',
        description: '构建并部署前端应用到服务器',
        author: 'agentkit',
        tags: ['deploy', 'frontend'],
        stepsCount: 3,
        installCount: 42,
      },
      {
        name: 'code-review',
        title: '代码审查',
        description: '对指定文件执行 ESLint + TypeScript 检查',
        author: 'agentkit',
        tags: ['review', 'quality'],
        stepsCount: 4,
        installCount: 38,
      },
    ];
  }
}

// MCP 市场：从 npm 搜索或预置列表
export async function fetchMcpMarket(): Promise<McpMarketItem[]> {
  // 通常从 npm registry 搜索，这里用预设推荐列表
  return [
    {
      name: 'filesystem',
      package: '@modelcontextprotocol/server-filesystem',
      description: '访问本地文件系统',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
    },
    {
      name: 'github',
      package: '@modelcontextprotocol/server-github',
      description: '管理 GitHub 仓库、Issues 和 PR',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-token>' },
    },
    {
      name: 'postgres',
      package: '@modelcontextprotocol/server-postgres',
      description: '查询 PostgreSQL 数据库',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      env: { DATABASE_URL: 'postgresql://...' },
    },
  ];
}

// 安装技能：从市场下载 skill.md 并保存到本地
export async function installSkill(skillName: string): Promise<boolean> {
  const skillsDir = path.join(process.cwd(), '.agent/skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const targetPath = path.join(skillsDir, `${skillName}.md`);

  try {
    const response = await fetch(`${SKILLS_REPO_URL}/${skillName}/skill.md`);
    const content = await response.text();
    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`✅ 技能安装成功: ${skillName}`);
    return true;
  } catch (e) {
    console.error(`安装技能失败: ${skillName}`, e);
    return false;
  }
}

// 安装 MCP 服务器：执行 npm install 并返回配置
export async function installMcpServer(packageName: string): Promise<boolean> {
  try {
    await execAsync(`bun add ${packageName}`);
    console.log(`✅ MCP 服务器安装成功: ${packageName}`);
    return true;
  } catch (e) {
    console.error(`安装 MCP 失败: ${packageName}`, e);
    return false;
  }
}


// 模拟插件市场数据
const PLUGINS: PluginMarketItem[] = [
  {
    name: 'web-scraper',
    description: '网页爬虫工具，支持 CSS 选择器提取数据',
    author: 'agentkit',
    version: '1.0.0',
    type: 'tool',
  },
  {
    name: 'jira-connector',
    description: 'Jira API 连接器，管理 Issues 和 Sprint',
    author: 'agentkit',
    version: '1.0.0',
    type: 'tool',
  },
  {
    name: 'slack-notifier',
    description: '发送 Slack 消息通知',
    author: 'agentkit',
    version: '1.0.0',
    type: 'tool',
  },
];

export async function fetchPluginMarket(): Promise<PluginMarketItem[]> {
  // 实际可从 GitHub 插件仓库获取
  return PLUGINS;
}

export async function installPlugin(pluginName: string): Promise<boolean> {
  // 模拟安装：下载插件文件到 .agent/plugins/ 目录
  const pluginsDir = path.join(process.cwd(), '.agent/plugins');
  fs.mkdirSync(pluginsDir, { recursive: true });
  const targetPath = path.join(pluginsDir, `${pluginName}.ts`);

  // 实际可下载对应文件
  const dummyContent = `// Plugin: ${pluginName}\nexport default class ${pluginName} { /* ... */ }`;
  fs.writeFileSync(targetPath, dummyContent, 'utf-8');

  console.log(`✅ 插件安装成功: ${pluginName}`);
  return true;
}