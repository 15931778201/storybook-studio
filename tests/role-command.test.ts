import { describe, expect, it } from 'bun:test';
import { BUILTIN_ROLES } from '../web/src/data/builtinRoles';
import { buildRoleSwitchMessage, findRoleByCommandTarget, parseRoleSwitchCommand } from '../web/src/utils/role-command';

describe('role switch commands', () => {
  it('parses current-role change commands and finds the target role', () => {
    const command = parseRoleSwitchCommand('帮我把当前角色改成全栈程序猿');
    expect(command).toEqual({ target: '全栈程序猿' });

    const role = findRoleByCommandTarget(BUILTIN_ROLES, command!.target);
    expect(role?.id).toBe('programmer');
    expect(buildRoleSwitchMessage(role!)).toContain('当前角色已切换为：全栈程序猿');
  });

  it('accepts common aliases such as 全栈程序员', () => {
    const command = parseRoleSwitchCommand('切换角色为全栈程序员');
    const role = findRoleByCommandTarget(BUILTIN_ROLES, command!.target);

    expect(role?.id).toBe('programmer');
  });
});
