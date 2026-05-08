export default function EmptyState() {
  return (
    <div style={{ textAlign: 'center', opacity: 0.6 }}>
      <h2>👋 准备开始新任务</h2>
      <p>试试这些：</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li>创建一个「代码审查」技能</li>
        <li>把 login.ts 中的 SQL 查询改为参数化</li>
        <li>解释当前项目的架构</li>
      </ul>
    </div>
  );
}