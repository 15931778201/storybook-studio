import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import {
  AgentLoop,
  FileMemory,
  SlidingWindowContextManager,
  DiffUndoPolicy,
  ReadFileTool,
  WriteFileTool,
  BashTool,
  GrepTool,
} from '../../../src';
import 'dotenv/config';

const agent = new AgentLoop({
  model: process.env.OPENAI_MODEL || 'gpt-5.4', 
  apiKey: process.env.OPENAI_API_KEY,
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

function App() {
  const { exit } = useApp();
  const [output, setOutput] = useState<string[]>(['🤖 Agent 已启动，输入任务后按回车']);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'task' | 'confirm'>('task');
  const [confirmReq, setConfirmReq] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // 设置 Agent 确认回调
  useEffect(() => {
    agent.onConfirm = async (req) => {
      setConfirmReq(req);
      setMode('confirm');
      // 等待用户选择
      return new Promise((resolve) => {
        // 将通过 handleConfirm 来 resolve
        (agent as any).__confirmResolve = resolve;
      });
    };
  }, []);

  const addOutput = (line: string) => setOutput((prev: string[]) => [...prev, line]);

  const handleTaskSubmit = async () => {
    const task = input.trim();
    if (!task) return;
    setInput('');
    addOutput(`👤 ${task}`);
    setRunning(true);
    try {
      const answer = await agent.run(task);
      addOutput(`🤖 ${answer}`);
    } catch (e: any) {
      addOutput(`❌ 错误: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleConfirm = (approved: boolean) => {
    if ((agent as any).__confirmResolve) {
      (agent as any).__confirmResolve(approved);
      delete (agent as any).__confirmResolve;
    }
    addOutput(approved ? '✅ 已执行修改' : '❌ 已拒绝');
    setConfirmReq(null);
    setMode('task');
    setInput('');
  };

  useInput((inputVal, key) => {
    if (mode === 'confirm') {
      if (inputVal.toLowerCase() === 'y') {
        handleConfirm(true);
      } else if (inputVal.toLowerCase() === 'n') {
        handleConfirm(false);
      }
      return;
    }

    if (mode === 'task') {
      if (key.return) {
        handleTaskSubmit();
      } else if (key.backspace || key.delete) {
        setInput((prev: string) => prev.slice(0, -1));
      } else {
        setInput((prev: string) => prev + inputVal);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {output.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {confirmReq && (
        <Box flexDirection="column" borderStyle="round" marginTop={1}>
          <Text>差异预览:</Text>
          <Text>{confirmReq.diff}</Text>
          <Text>确认执行? (y/n)</Text>
        </Box>
      )}
      {mode === 'task' && !running && (
        <Box>
          <Text>{'→ '}</Text>
          <Text>{input}</Text>
        </Box>
      )}
      {running && <Text>⏳ 思考中...</Text>}
    </Box>
  );
}

render(<App />);