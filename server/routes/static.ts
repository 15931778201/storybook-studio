// server/routes/static.ts
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const statics = new Hono();

statics.use('/public/*', serveStatic({ root: './' }));
statics.get('/', (c) => c.redirect('/public/index.html'));

export { statics };