import { describe, expect, it } from 'bun:test';
import {
  buildWorkModeGuidance,
  routeLocalIntent,
} from '../src/core/local-intent-router';

describe('local intent router', () => {
  it('detects bugfix, optimization, feature, qa and overview requests', () => {
    expect(routeLocalIntent('帮我修复这个 bug').kind).toBe('bugfix');
    expect(routeLocalIntent('帮我优化一下这个页面').kind).toBe('optimization');
    expect(routeLocalIntent('帮我新增一个登录页').kind).toBe('feature');
    expect(routeLocalIntent('帮我补充测试用例').kind).toBe('qa');
    expect(routeLocalIntent('帮我添加测试用例').kind).toBe('qa');
    expect(routeLocalIntent('了解一下当前工作区这个项目').kind).toBe('workspace_overview');
  });

  it('detects role switch requests and builds guidance for work modes', () => {
    expect(routeLocalIntent('帮我把当前角色改成全栈程序猿').kind).toBe('role_switch');

    const guidance = buildWorkModeGuidance(routeLocalIntent('帮我修复这个 bug'));
    expect(guidance).toContain('工作模式：修复');
    expect(guidance).toContain('下一步建议');
  });
});
