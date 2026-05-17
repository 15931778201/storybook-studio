import { ChangelogStore } from '../../src/changelog/changelog-store';
import { Hono } from 'hono';

const changelogStore = new ChangelogStore();
const changelog = new Hono();

const VALID_TYPES = ['requirement', 'optimization', 'bug'] as const;

changelog.get('/', async (c) => {
  const { type, trigger, startTime, endTime, page, pageSize } = c.req.query();
  const result = await changelogStore.list({
    type,
    trigger,
    startTime,
    endTime,
    page: page ? parseInt(page, 10) : 1,
    pageSize: pageSize ? parseInt(pageSize, 10) : 50,
  });
  return c.json(result);
});

changelog.post('/', async (c) => {
  const body = await c.req.json();
  const { type, title, description, trigger, commitHash } = body;

  if (!type || !VALID_TYPES.includes(type)) {
    return c.json({ success: false, message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, 400);
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return c.json({ success: false, message: 'title is required' }, 400);
  }

  const entry = await changelogStore.create({
    type,
    title,
    description: description || undefined,
    trigger: trigger || 'manual',
    commitHash: commitHash || undefined,
  });

  return c.json(entry);
});

changelog.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const ok = await changelogStore.delete(id);
  if (!ok) {
    return c.json({ success: false, message: 'Entry not found' }, 404);
  }
  return c.json({ success: true });
});

export { changelog };
