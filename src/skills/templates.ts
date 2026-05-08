// src/skills/templates.ts
import { SkillTemplate } from '../types/skill';

export const BUILTIN_TEMPLATES: SkillTemplate[] = [
  {
    name: 'code-review',
    title: '代码审查',
    description: '对指定文件执行代码审查，检查常见问题',
    category: 'review',
    steps: [
      {
        id: 'step-1', order: 1,
        tool: 'read_file',
        params: { filePath: '{{targetFile}}' },
        description: '读取目标文件',
      },
      {
        id: 'step-2', order: 2,
        tool: 'grep',
        params: { pattern: 'console\\.(log|warn|error)', path: '{{targetFile}}' },
        description: '检查遗留的 console 调用',
      },
      {
        id: 'step-3', order: 3,
        tool: 'bash',
        params: { command: 'npx eslint {{targetFile}} --format json 2>/dev/null || echo "{\\"issues\\":[]}"' },
        description: '运行 ESLint 检查',
      },
      {
        id: 'step-4', order: 4,
        tool: 'bash',
        params: { command: 'npx tsc --noEmit {{targetFile}} 2>&1 | head -20' },
        description: 'TypeScript 类型检查',
      },
    ],
    requiredTools: ['read_file', 'grep', 'bash'],
  },
  {
    name: 'component-scaffold',
    title: '组件脚手架',
    description: '快速生成 React 组件及其测试文件',
    category: 'setup',
    steps: [
      {
        id: 'step-1', order: 1,
        tool: 'write_file',
        params: {
          filePath: '{{componentPath}}.tsx',
          content: 'import React from \'react\';\n\nexport interface {{componentName}}Props {}\n\nexport const {{componentName}}: React.FC<{{componentName}}Props> = () => {\n  return <div>{{componentName}}</div>;\n};\n',
        },
        description: '创建组件文件',
      },
      {
        id: 'step-2', order: 2,
        tool: 'write_file',
        params: {
          filePath: '{{componentPath}}.test.tsx',
          content: 'import { render, screen } from \'@testing-library/react\';\nimport { {{componentName}} } from \'./{{componentName}}\';\n\ndescribe(\'{{componentName}}\', () => {\n  it(\'renders\', () => {\n    render(<{{componentName}} />);\n  });\n});\n',
        },
        description: '创建测试文件',
      },
    ],
    requiredTools: ['write_file'],
  },
  {
    name: 'frontend-deploy',
    title: '前端部署',
    description: '构建并部署前端应用到服务器',
    category: 'deploy',
    steps: [
      {
        id: 'step-1', order: 1,
        tool: 'bash',
        params: { command: 'cd {{projectPath}} && npm run build' },
        description: '构建项目',
        onError: 'stop',
      },
      {
        id: 'step-2', order: 2,
        tool: 'bash',
        params: { command: 'cd {{projectPath}} && rsync -avz dist/ {{deployTarget}}/' },
        description: '同步文件到服务器',
        onError: 'retry',
      },
      {
        id: 'step-3', order: 3,
        tool: 'bash',
        params: { command: 'echo "部署完成: $(date)"' },
        description: '记录部署日志',
      },
    ],
    requiredTools: ['bash'],
  },
];