export interface RoleProfile {
  id: string;
  name: string;
  title: string;
  description: string;
  tone: string;
  customPrompt: string;
  thinkingFramework?: string;
  preferredTools?: string[];
  outputFormat?: string;
  constraints?: string[];
  examples?: { user: string; assistant: string }[];
  isBuiltin?: boolean;
}
