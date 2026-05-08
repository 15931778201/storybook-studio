import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export class WebFetchTool extends Tool {
  name = 'web_fetch';
  description = '获取指定 URL 的网页内容并提取文本（自动清理 HTML）';
  parameters = z.object({
    url: z.string().url().describe('完整的网页 URL (https://...)'),
    extractText: z.boolean().optional().default(true).describe('是否仅提取文本'),
    timeout: z.coerce.number().int().min(1000).max(30000).optional().default(15000),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { url, extractText, timeout } = validatedParams as z.infer<typeof this.parameters>;
    return safeExecute(
      this.name,
      async () => {
        const res = await fetch(url, { timeout, headers: { 'User-Agent': 'AgentKit/1.0' } });
        const html = await res.text();
        let output: string;
        if (extractText) {
          const $ = cheerio.load(html);
          $('script, style, nav, footer, header').remove();
          output = $('body').text().replace(/\s+/g, ' ').trim();
        } else {
          output = html;
        }
        return { success: true, output: output.slice(0, 5000) };
      },
      { timeout: timeout + 5000, maxOutput: 5000 }
    );
  }
}