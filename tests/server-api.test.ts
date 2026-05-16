import { afterEach, describe, expect, it } from 'bun:test';
import app from '../server/api';

const originalToken = process.env.API_SECRET_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.API_SECRET_TOKEN;
  } else {
    process.env.API_SECRET_TOKEN = originalToken;
  }
});

function request(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

describe('server api auth and route mounting', () => {
  it('leaves health checks outside api auth', async () => {
    process.env.API_SECRET_TOKEN = 'secret';

    const response = await request('/health');

    expect(response.status).toBe(200);
  });

  it('allows api requests without auth when API_SECRET_TOKEN is unset', async () => {
    delete process.env.API_SECRET_TOKEN;

    const response = await request('/api/skills');

    expect(response.status).toBe(200);
  });

  it('rejects api requests without bearer auth when API_SECRET_TOKEN is set', async () => {
    process.env.API_SECRET_TOKEN = 'secret';

    const response = await request('/api/skills');

    expect(response.status).toBe(403);
  });

  it('allows api requests with matching bearer auth when API_SECRET_TOKEN is set', async () => {
    process.env.API_SECRET_TOKEN = 'secret';

    const response = await request('/api/skills', {
      headers: { Authorization: 'Bearer secret' },
    });

    expect(response.status).toBe(200);
  });

  it('mounts additional api routes from the active api setup', async () => {
    delete process.env.API_SECRET_TOKEN;

    const response = await request('/api/keys');

    expect(response.status).toBe(200);
    expect(await response.json()).toBeArray();
  });
});
