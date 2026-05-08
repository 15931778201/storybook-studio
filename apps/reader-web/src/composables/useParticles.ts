// 归一化的形状坐标（0～1，相对于中心区域）
const houseShape = [
  // 屋顶三角形
  { x: 0.50, y: 0.15 }, { x: 0.46, y: 0.20 }, { x: 0.42, y: 0.25 },
  { x: 0.38, y: 0.30 }, { x: 0.62, y: 0.30 }, { x: 0.58, y: 0.25 },
  { x: 0.54, y: 0.20 },
  // 屋体矩形
  { x: 0.35, y: 0.30 }, { x: 0.35, y: 0.45 }, { x: 0.65, y: 0.45 },
  { x: 0.65, y: 0.30 }, { x: 0.35, y: 0.45 }, { x: 0.65, y: 0.45 },
  // 门
  { x: 0.47, y: 0.35 }, { x: 0.53, y: 0.35 }, { x: 0.53, y: 0.45 },
  { x: 0.47, y: 0.45 },
  // 窗户左
  { x: 0.38, y: 0.35 }, { x: 0.42, y: 0.35 }, { x: 0.42, y: 0.39 },
  { x: 0.38, y: 0.39 },
  // 窗户右
  { x: 0.58, y: 0.35 }, { x: 0.62, y: 0.35 }, { x: 0.62, y: 0.39 },
  { x: 0.58, y: 0.39 },
];

const beautyShape = [
  // 头部（圆形）
  { x: 0.50, y: 0.20 },
  // 脖子
  { x: 0.50, y: 0.25 },
  // 身体
  { x: 0.45, y: 0.30 }, { x: 0.55, y: 0.30 },
  { x: 0.55, y: 0.45 }, { x: 0.45, y: 0.45 },
  // 左手臂
  { x: 0.40, y: 0.32 }, { x: 0.45, y: 0.32 },
  // 右手臂
  { x: 0.60, y: 0.32 }, { x: 0.55, y: 0.32 },
  // 左腿
  { x: 0.47, y: 0.45 }, { x: 0.47, y: 0.50 },
  // 右腿
  { x: 0.53, y: 0.45 }, { x: 0.53, y: 0.50 },
];

export function useParticles(canvasRef: { value: HTMLCanvasElement | null }) {
  type ShapePoint = { x: number; y: number };
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetX: number | null;
    targetY: number | null;
    color: string;
    size: number;
  };

  const particles: Particle[] = [];
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number | null = null;
  let WIDTH = 0;
  let HEIGHT = 0;

  // 将归一化坐标转为画布坐标
  function getShapePoints(shape: ShapePoint[], scale = 0.7): ShapePoint[] {
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    return shape.map(p => ({
      x: centerX + (p.x - 0.5) * scale * WIDTH,
      y: centerY + (p.y - 0.5) * scale * HEIGHT,
    }));
  }

  // 初始化粒子
  function initParticles(count = 500): void {
    particles.length = 0;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        targetX: null,
        targetY: null,
        color: `hsl(${45 + Math.random() * 20}, 90%, ${60 + Math.random() * 20}%)`,
        size: Math.random() * 3 + 1,
      });
    }
  }

  // 移动所有粒子到指定坐标组
  function moveToTarget(points: ShapePoint[]): void {
    particles.forEach((p, i) => {
      const target = points[i % points.length];
      p.targetX = target.x;
      p.targetY = target.y;
      // 清除随机速度，让路径更干净
      p.vx = 0;
      p.vy = 0;
    });
  }

  // 粒子飞散
  function scatter(): void {
    particles.forEach(p => {
      p.targetX = Math.random() * WIDTH;
      p.targetY = Math.random() * HEIGHT;
      p.vx = (Math.random() - 0.5) * 2;
      p.vy = (Math.random() - 0.5) * 2;
    });
  }

  // 动画循环
  function animate(): void {
    const context = ctx;
    if (!context) {
      return;
    }

    context.clearRect(0, 0, WIDTH, HEIGHT);
    particles.forEach(p => {
      // 向目标移动（缓动）
      if (p.targetX !== null && p.targetY !== null) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.5) {
          p.x = p.targetX;
          p.y = p.targetY;
          p.targetX = null;
          p.targetY = null;
        } else {
          p.x += dx * 0.05;
          p.y += dy * 0.05;
        }
      } else {
        // 如果没有目标，做微小的随机漂移
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > WIDTH) p.vx *= -1;
        if (p.y < 0 || p.y > HEIGHT) p.vy *= -1;
      }
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    });
    animationId = requestAnimationFrame(animate);
  }

  // 启动粒子系统（背景漂移状态）
  function start() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const setSize = () => {
      WIDTH = canvas.width = window.innerWidth;
      HEIGHT = canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener('resize', setSize);
    ctx = canvas.getContext("2d");
    if (!ctx) {
      window.removeEventListener("resize", setSize);
      return;
    }
    initParticles();
    animate();

    // 返回清理函数
    return () => window.removeEventListener('resize', setSize);
  }

  // 停止动画
  function stop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // 执行序列：汇聚黄金屋 → 停留 → 汇聚颜如玉 → 停留 → 飞散
  function playSequence() {
    const housePoints = getShapePoints(houseShape, 0.8);
    const beautyPoints = getShapePoints(beautyShape, 0.7);

    // 0s: 汇聚成黄金屋
    moveToTarget(housePoints);

    // 1.5s后：切换为颜如玉
    setTimeout(() => {
      moveToTarget(beautyPoints);
    }, 1800);

    // 3.5s后：粒子飞散
    setTimeout(() => {
      scatter();
      // 再等一会儿让粒子彻底散开，之后可以用 stop() 节省资源
    }, 3800);
  }

  return { start, stop, playSequence };
}
