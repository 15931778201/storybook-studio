import { useCallback } from 'react';
import { useChatContext } from '../providers/ChatProvider';

export function useConfirm(_sessionId?: string) {
  const { confirmRequest, resolveConfirm } = useChatContext();
  const handleConfirm = useCallback((selectedFiles?: Record<string, boolean>) => resolveConfirm(true, selectedFiles), [resolveConfirm]);
  const handleReject = useCallback(() => resolveConfirm(false), [resolveConfirm]);
  return { confirmRequest, handleConfirm, handleReject };
}
