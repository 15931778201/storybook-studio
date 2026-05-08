export type ConfirmRequest = {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: any;
  diff: string;
};