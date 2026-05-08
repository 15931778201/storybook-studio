export interface RoleProfile {
  id: string; 
  name: string; 
  title: string; 
  description: string; 
  tone: string; 
  customPrompt: string;
  thinkingFramework?: string;
  constraints?: string[];
  preferredTools?: string[];
  outputFormat?: string;
  examples?: { user: string; assistant: string }[];  
}