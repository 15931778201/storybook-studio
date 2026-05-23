export type LocalIntentKind =
  | 'workspace_overview'
  | 'role_switch'
  | 'bugfix'
  | 'optimization'
  | 'feature'
  | 'qa'
  | 'chat';

export interface LocalIntent {
  kind: LocalIntentKind;
  confidence: number;
  target?: string;
  reason: string;
}

export function routeLocalIntent(input: string): LocalIntent {
  const normalized = normalize(input);

  if (isWorkspaceOverviewText(input, normalized)) {
    return { kind: 'workspace_overview', confidence: 0.95, reason: '请求需要读取当前工作区信息' };
  }

  const roleTarget = parseRoleTarget(input);
  if (roleTarget) {
    return { kind: 'role_switch', confidence: 0.95, target: roleTarget, reason: '请求修改当前角色状态' };
  }

  if (/(修复|修一下|解决|排查|定位|报错|错误|失败|异常|bug|BUG|超时|timeout|429|5\d{2})/.test(input)) {
    return { kind: 'bugfix', confidence: 0.9, reason: '请求包含故障、错误或修复语义' };
  }

  if (/(优化|重构|改进|提升|提速|性能|perf|refactor|简化|整理代码)/i.test(input)) {
    return { kind: 'optimization', confidence: 0.85, reason: '请求包含优化或重构语义' };
  }

  if (/(测试|验证|回归|用例|覆盖率|test|spec|检查是否通过)/i.test(input)) {
    return { kind: 'qa', confidence: 0.85, reason: '请求包含测试或验证语义' };
  }

  if (/(新增|添加|实现|开发|做一个|加一个|创建|支持|接入|需求|功能|页面|接口|模块)/.test(input)) {
    return { kind: 'feature', confidence: 0.85, reason: '请求包含新增需求或功能实现语义' };
  }

  return { kind: 'chat', confidence: 0.5, reason: '未命中本地工作模式规则' };
}

export function isWorkspaceOverviewText(original: string, normalized = normalize(original)): boolean {
  const overviewIntent = /(了解|介绍|概览|看一下|分析|熟悉).{0,16}(当前)?(工作区|项目|仓库|代码库)|项目(概览|介绍|定位|结构)|当前项目/.test(normalized);
  const projectDocIntent = /(完善|更新|补充|生成|改进|重写|整理).{0,16}(readme|项目文档|说明文档)|readme\.?md/.test(normalized);
  return overviewIntent || projectDocIntent;
}

export function parseRoleTarget(input: string): string | null {
  const text = input.trim();
  const match = text.match(/^(?:帮我|请)?(?:把|将)?(?:当前)?角色(?:改成|改为|切换成|切换到|设置为|设为|换成|变成)(.+)$/)
    || text.match(/^(?:切换|设置|修改|更改)(?:当前)?角色(?:为|到|成)?(.+)$/)
    || text.match(/^使用(.+?)(?:角色)?$/);
  const target = match?.[1]?.replace(/[。.!！?？\s]+$/g, '').trim();
  return target || null;
}

export function buildWorkModeGuidance(intent: LocalIntent): string {
  switch (intent.kind) {
    case 'bugfix':
      return [
        '工作模式：修复',
        '下一步建议：先复现或读取错误信息，再定位相关代码，形成最小修复，最后运行针对性验证。',
      ].join('\n');
    case 'optimization':
      return [
        '工作模式：优化',
        '下一步建议：先确认当前实现和性能/体验瓶颈，再做小范围改进，最后验证行为不回退。',
      ].join('\n');
    case 'feature':
      return [
        '工作模式：需求实现',
        '下一步建议：先理解现有架构和入口，再拆分实现步骤，完成后运行相关测试或构建。',
      ].join('\n');
    case 'qa':
      return [
        '工作模式：测试验证',
        '下一步建议：先确认验证范围，再运行或补充测试，最后汇总失败点和修复建议。',
      ].join('\n');
    default:
      return '';
  }
}

function normalize(input: string) {
  return input.toLowerCase().replace(/\s+/g, '');
}
