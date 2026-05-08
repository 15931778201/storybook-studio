export interface RoleProfile {
  id: string;
  name: string;           // 显示名称
  title: string;          // 职业称谓
  description: string;    // 角色简述
  tone: string;           // 语气风格
  customPrompt: string;   // 附加提示词

  // 🔥 新增字段
  thinkingFramework?: string;     // 思考框架（如“先分析后回答”、“分三步推理”）
  preferredTools?: string[];      // 偏好工具（如 ["read_file", "bash"]）
  outputFormat?: string;         // 输出格式要求（如“JSON”、“Markdown 表格”）
  constraints?: string[];        // 约束条件（如“不提供代码”、“仅回答中文”）
  examples?: { user: string; assistant: string }[];  // Few-shot 示例
}