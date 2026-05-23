import type { RoleProfile } from '../types/roles';

export interface RoleSwitchCommand {
  target: string;
}

export function parseRoleSwitchCommand(input: string): RoleSwitchCommand | null {
  const text = input.trim();
  const match = text.match(/^(?:帮我|请)?(?:把|将)?(?:当前)?角色(?:改成|改为|切换成|切换到|设置为|设为|换成|变成)(.+)$/)
    || text.match(/^(?:切换|设置|修改|更改)(?:当前)?角色(?:为|到|成)?(.+)$/)
    || text.match(/^使用(.+?)(?:角色)?$/);

  const target = match?.[1]?.replace(/[。.!！?？\s]+$/g, '').trim();
  return target ? { target } : null;
}

export function findRoleByCommandTarget(roles: RoleProfile[], target: string): RoleProfile | null {
  const normalizedTarget = normalizeRoleText(target);
  if (!normalizedTarget) return null;

  return roles.find((role) => {
    const candidates = [role.id, role.name, role.title, role.description].filter(Boolean).map(normalizeRoleText);
    return candidates.some((candidate) =>
      candidate === normalizedTarget
      || candidate.includes(normalizedTarget)
      || normalizedTarget.includes(candidate)
    );
  }) || null;
}

export function buildRoleSwitchMessage(role: RoleProfile): string {
  return `当前角色已切换为：${role.name}${role.title ? `（${role.title}）` : ''}`;
}

export function loadCustomRoles(storage: Pick<Storage, 'getItem'> | null | undefined): RoleProfile[] {
  try {
    const parsed = JSON.parse(storage?.getItem('customRoles') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRoleText(value: string) {
  return value
    .toLowerCase()
    .replace(/程序员/g, '程序猿')
    .replace(/[\s\-_/（）()【】\[\]:：,，.。!！?？]/g, '')
    .trim();
}
