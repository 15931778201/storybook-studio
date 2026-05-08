import 'dotenv/config';
import * as readline from 'readline';
import {
  AgentLoop,
  FileMemory,
  SlidingWindowContextManager,
  DiffUndoPolicy,
  ReadFileTool,
  WriteFileTool,
  BashTool,
  GrepTool,
} from '../src/index';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY 未设置');
  process.exit(1);
}
if (!model) {
  console.error('❌ OPENAI_MODEL 未设置');
  process.exit(1);
}

console.log('✅ API Key 已加载:', apiKey.slice(0, 8) + '...');

const agent = new AgentLoop({
  model,
  apiKey,
  tools: [new ReadFileTool(), new WriteFileTool(), new BashTool(), new GrepTool()],
  memory: new FileMemory({ path: '.agent/memory.json' }),
  contextMgr: new SlidingWindowContextManager({
    maxTokens: 8000,
    keepRecentTurns: 6,
    compressionThreshold: 0.9,
  }),
  policy: new DiffUndoPolicy({ backupDir: '.agent/backups', autoConfirm: false }),
  maxIterations: 15,
});

// 设置确认回调
agent.onConfirm = async (req) => {
  console.log(`\n🔎 确认修改文件: ${req.args.filePath}`);
  console.log(`差异:\n${req.diff}`);
  const answer = await askUser('确认执行? (y/n): ');
  return answer.toLowerCase() === 'y';
};

function askUser(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

(async () => {
  while (true) {
    const task = await askUser('\n请输入任务 (或 exit 退出): ');
    if (task.toLowerCase() === 'exit') break;
    console.log(`\n🚀 任务: "${task}"\n`);
    const startTime = Date.now();
    try {
      const answer = await agent.run(task);
      console.log(`\n⏱  ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log('🤖 回答:\n' + answer);
    } catch (e: any) {
      console.error('❌ 执行失败:', e.message);
    }
  }
  process.exit(0);
})();