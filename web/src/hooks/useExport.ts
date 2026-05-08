import { ChatMessage } from "../types/messages";

export function useExport() {
  const exportToMarkdown = (messages: ChatMessage[]) => {
    let md = '# Agent 对话记录\n\n';
    messages.forEach(msg => {
      if (msg.role === 'user') md += `**👤 用户**：${msg.content}\n\n`;
      else if (msg.role === 'assistant') md += `**🤖 助手**：${msg.content}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportToMarkdown };
}