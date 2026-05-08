// start-cluster.ts
import { spawn } from 'bun';

let child: ReturnType<typeof spawn>;

function start() {
  child = spawn({
    cmd: ['bun', 'run', '--env-file', '.env', 'server/main.ts'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  child.exited.then((exitCode) => {
    console.log(`[Cluster] 子进程退出, 退出码 ${exitCode}`);
  });
}

// 捕获 reload 信号，启动新进程并优雅关闭旧进程
process.on('SIGUSR2', () => {
  console.log('[Cluster] 收到 reload 信号，启动新进程...');
  const oldChild = child;
  start(); // 新进程启动
  // 给旧进程 5 秒时间处理完现有请求
  setTimeout(() => {
    console.log('[Cluster] 关闭旧进程');
    oldChild.kill('SIGTERM');
  }, 5000);
});

start();