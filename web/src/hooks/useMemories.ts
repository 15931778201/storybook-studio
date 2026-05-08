import { useCallback } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export function useMemories() {
  const { activeWorkspaceId } = useChatContext();

  const extractAndSave = useCallback(
    async (messages: any[]) => {
      if (messages.length < 4) return;
      try {
        await fetch('/api/memory/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeWorkspaceId,
            messages: messages.slice(-10),
          }),
        });
      } catch {}
    },
    [activeWorkspaceId]
  );

  return { extractAndSave };
}