import { useEffect, useRef } from 'react';
import { Spin, Empty } from 'antd';
import { Network } from 'vis-network';

interface Entity {
  id: string;
  label: string;
  type: string;
  chunkIds: string[];
}

interface Edge {
  from: string;
  to: string;
  type: string;
}

interface GraphData {
  entities: Entity[];
  edges: Edge[];
}

const TYPE_COLORS: Record<string, string> = {
  class: '#1677ff',
  function: '#52c41a',
  variable: '#fa8c16',
  interface: '#722ed1',
  concept: '#eb2f96',
  file: '#13c2c2',
};

export default function KnowledgeGraphView({ data, loading }: { data: GraphData | null; loading: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.entities.length === 0) return;

    const nodes: any[] = data.entities.map(e => ({
      id: e.id,
      label: e.label,
      title: `${e.type}: ${e.label}`,
      color: { background: TYPE_COLORS[e.type] || '#666', border: '#333' },
      font: { color: '#333', size: e.type === 'file' ? 14 : 12 },
      shape: e.type === 'file' ? 'square' : 'dot',
      size: e.type === 'file' ? 25 : e.type === 'class' ? 20 : 15,
      borderWidth: 1,
    }));

    const edges: any[] = data.edges.map(e => ({
      from: e.from,
      to: e.to,
      color: { color: '#d9d9d9' },
      width: e.type === 'co_occur' ? 1 : 1.5,
      dashes: e.type !== 'co_occur',
      title: e.type,
    }));

    networkRef.current = new Network(containerRef.current, { nodes, edges }, {
      layout: { improvedLayout: true },
      physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -40 } as any },
      interaction: { hover: true, tooltipDelay: 200 },
      edges: { smooth: { enabled: true, type: 'continuous', roundness: 0.5 } as any },
    });

    return () => {
      if (networkRef.current) networkRef.current.destroy();
    };
  }, [data]);

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 40 }}><Spin /></div>;
  if (!data || data.entities.length === 0) return <Empty description="No graph data. Reindex the knowledge base to build the graph." />;

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {type}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
          {data.entities.length} nodes, {data.edges.length} edges
        </span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 500, border: '1px solid #e8e8e8', borderRadius: 8 }} />
    </div>
  );
}
