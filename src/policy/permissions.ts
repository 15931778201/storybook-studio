export const PermissionLevel = {
  Default: 'default',
  AcceptEdits: 'acceptEdits',
  BypassPermissions: 'bypassPermissions',
  ReadOnly: 'readOnly',
} as const;
export type PermissionLevel = typeof PermissionLevel[keyof typeof PermissionLevel];
