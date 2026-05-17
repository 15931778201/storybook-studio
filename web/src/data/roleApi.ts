import type { RoleProfile } from '../types/roles';

const BASE = '/api/roles';

export async function listRoles(): Promise<RoleProfile[]> {
  const res = await fetch(BASE);
  return res.json();
}

export async function createRole(data: Omit<RoleProfile, 'id'>): Promise<RoleProfile> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateRole(id: string, data: Partial<RoleProfile>): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error);
}

export async function deleteRole(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}
