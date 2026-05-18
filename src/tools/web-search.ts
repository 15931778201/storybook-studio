import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import * as duckduckgoSearch from 'duckduckgo-search';

export class WebSearchTool extends Tool {
  name = 'web_search';
  description = '通过 DuckDuckGo 搜索网页（无需 API Key）';
  parameters = z.object({
    query: z.string().describe('搜索关键词'),
    maxResults: z.coerce.number().int().min(1).max(5).optional().default(3),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { query, maxResults } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(this.name, async () => {
      const results: string[] = [];
      for await (const result of getSearchIterator(query)) {
        results.push(`${result.title}\n${result.link}\n${result.snippet}`);
        if (results.length >= maxResults) break;
      }
      return { success: true, output: results.join('\n\n') || '未找到结果' };
    }, { timeout: 20000, maxOutput: 4000 });
  }
}

function getSearchIterator(query: string) {
  const searchFn = (duckduckgoSearch as any).search
    || (duckduckgoSearch as any).default?.search
    || (duckduckgoSearch as any).default;
  if (typeof searchFn !== 'function') {
    throw new Error('duckduckgo-search does not expose a compatible search function');
  }
  return searchFn(query);
}
