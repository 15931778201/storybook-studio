import { Hono } from 'hono';
import { roleStore } from '../context';

const roles = new Hono();

roles.get('/', (c) => {
  return c.json(roleStore.list());
});

roles.get('/:id', (c) => {
  const role = roleStore.get(c.req.param('id'));
  if (!role) return c.json({ error: 'Role not found' }, 404);
  return c.json(role);
});

roles.post('/', async (c) => {
  const body = await c.req.json();
  try {
    const created = roleStore.create(body);
    return c.json(created, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

roles.put('/:id', async (c) => {
  try {
    roleStore.update(c.req.param('id'), await c.req.json());
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

roles.delete('/:id', (c) => {
  try {
    roleStore.delete(c.req.param('id'));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export { roles };
