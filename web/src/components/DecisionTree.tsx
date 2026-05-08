import { Tree, Tag, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';

export interface DecisionNode {
  id: string; label: string; type: 'router' | 'plan' | 'thought' | 'action' | 'observation' | 'validation';
  detail?: string; confidence?: number; children?: DecisionNode[];
}

function toTreeData(nodes: DecisionNode[]): DataNode[] {
  return nodes.map(n => ({
    key: n.id, title: <span><Tag color={typeColor(n.type)}>{n.type}</Tag>{n.label}{n.confidence != null && ` (${(n.confidence*100).toFixed(0)}%)`}{n.detail && <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{n.detail}</Typography.Text>}</span>,
    children: n.children ? toTreeData(n.children) : [],
  }));
}

function typeColor(type: string): string {
  switch (type) {
    case 'router': return 'purple'; case 'plan': return 'blue'; case 'thought': return 'geekblue';
    case 'action': return 'green'; case 'observation': return 'orange'; case 'validation': return 'red';
    default: return 'default';
  }
}

export default function DecisionTree({ nodes }: { nodes: DecisionNode[] }) {
  return <Tree treeData={toTreeData(nodes)} defaultExpandAll showLine style={{ background: 'transparent' }} />;
}
