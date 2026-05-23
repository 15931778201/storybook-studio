export const WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY = 'workspace-status-collapsed';
export const WORKSPACE_STATUS_PANEL_BREAKPOINT = 1024;

export function getDefaultWorkspaceStatusCollapsed(viewportWidth: number) {
  return viewportWidth < WORKSPACE_STATUS_PANEL_BREAKPOINT;
}

export function loadWorkspaceStatusCollapsed(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  viewportWidth: number,
) {
  try {
    const persisted = storage?.getItem(WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY);
    if (persisted === 'true') return true;
    if (persisted === 'false') return false;
  } catch {}

  return getDefaultWorkspaceStatusCollapsed(viewportWidth);
}

export function saveWorkspaceStatusCollapsed(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  collapsed: boolean,
) {
  try {
    storage?.setItem(WORKSPACE_STATUS_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {}
}
