import { describe, expect, it, mock } from 'bun:test';

const fetchMock = mock(async () => ({
  text: async () => '<html><body><header>skip</header><main>Hello <b>world</b></main><script>skip()</script></body></html>',
}));

async function* searchMock(_query: string) {
  yield { title: 'Result A', link: 'https://example.com/a', snippet: 'first' };
  yield { title: 'Result B', link: 'https://example.com/b', snippet: 'second' };
}

mock.module('node-fetch', () => ({ default: fetchMock }));
mock.module('duckduckgo-search', () => ({ search: searchMock }));

describe('network and notification tools', () => {
  it('WebFetchTool extracts visible text from fetched HTML', async () => {
    const { WebFetchTool } = await import('../src/tools/web-fetch');

    const result = await new WebFetchTool().execute({
      url: 'https://example.com',
      extractText: true,
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello world');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('WebSearchTool formats search results up to maxResults', async () => {
    const { WebSearchTool } = await import('../src/tools/web-search');

    const result = await new WebSearchTool().execute({
      query: 'agentkit',
      maxResults: 1,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Result A');
    expect(result.output).not.toContain('Result B');
  });

  it('NotificationTool reports unsupported platforms without invoking a command', async () => {
    const { NotificationTool } = await import('../src/tools/notification');
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      const result = await new NotificationTool().execute({
        title: 'Title',
        message: 'Message',
      });

      expect(result.success).toBe(false);
      expect(result.output).toBe('当前操作系统不支持通知');
    } finally {
      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
    }
  });
});
