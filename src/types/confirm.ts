export type ConfirmRequest = {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  args: any;
  diff: string;
  files?: Array<{
    filePath: string;
    changeType: 'added' | 'deleted' | 'modified';
    accepted: boolean;
  }>;
  summary?: {
    total: number;
    accepted: number;
    added: number;
    deleted: number;
    modified: number;
  };
};
