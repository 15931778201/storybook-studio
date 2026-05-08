import { Tool, safeExecute, ToolResult } from '../core/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class NotificationTool extends Tool {
  name = 'send_notification';
  description = '发送桌面通知（macOS 使用 osascript，Linux 使用 notify-send）';
  parameters = z.object({
    title: z.string().describe('通知标题'),
    message: z.string().describe('通知内容'),
  });

  protected async executeCore(validatedParams: unknown): Promise<ToolResult> {
    const { title, message } = validatedParams as z.infer<typeof this.parameters>;
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'darwin') {
      command = 'osascript';
      args = ['-e', `display notification "${message}" with title "${title}"`];
    } else if (platform === 'linux') {
      command = 'notify-send';
      args = [title, message];
    } else {
      return { success: false, output: '当前操作系统不支持通知' };
    }

    return safeExecute(this.name, async () => {
      await execFileAsync(command, args, { timeout: 5000 });
      return { success: true, output: '通知已发送' };
    });
  }
}