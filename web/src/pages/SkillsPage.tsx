import SkillPanel from '../components/SkillPanel'; // 假设你将 SkillPanel 改为纯内容组件
export default function SkillsPage() {
  return <div style={{ padding: 24 }}>
    <SkillPanel open={true} onClose={() => {}} />
  </div>;
}