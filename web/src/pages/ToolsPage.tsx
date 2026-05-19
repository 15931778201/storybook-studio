import { useState, useEffect } from 'react';
import { Card, Table, Typography, Divider, Tag, Space } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ToolInfo {
  name: string;
  description: string;
  parameters: any;
  example?: string;
  category: string;
}

// 安全的字符串比较函数
const safeStringCompare = (a: string | undefined, b: string | undefined): number => {
  const strA = a ?? '';
  const strB = b ?? '';
  return strA.localeCompare(strB);
};

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tools');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
          // 过滤掉无效工具并排序
          const validTools = data.data
            .filter((tool: ToolInfo) => tool && tool.name && tool.category)
            .sort((a: ToolInfo, b: ToolInfo) => 
              safeStringCompare(a.category, b.category) || safeStringCompare(a.name, b.name)
            );
          setTools(validTools);
        } else {
          setError(data.error || 'Failed to fetch tools');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  const renderParameters = (parameters: any) => {
    if (!parameters) {
      return <Text type="secondary">无参数</Text>;
    }

    // 检查是否是简化结构（后端正确处理的情况）
    const firstParam = Object.values(parameters)[0];
    if (Object.keys(parameters).length > 0 && 
        firstParam && 
        typeof firstParam === 'object' &&
        'description' in firstParam) {
      
      return (
        <Space direction="vertical" size="small">
          {Object.entries(parameters).map(([key, paramInfo]: [string, any]) => {
            if (!paramInfo) {
              return <div key={key}><Text strong>{key}</Text></div>;
            }
            
            const description = paramInfo.description || key;
            const type = paramInfo.type || 'any';
            const required = paramInfo.required !== false;

            return (
              <div key={key}>
                <Text strong>{description}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({type}{required ? '' : ', 可选'})
                </Text>
              </div>
            );
          })}
        </Space>
      );
    }

    // 处理原始Zod对象结构（后端未正确处理的情况）
    let shapeObj: Record<string, any> = {};
    
    // 尝试从不同位置获取shape
    if (parameters.shape && typeof parameters.shape === 'object') {
      shapeObj = parameters.shape;
    } else if (parameters._def?.shape) {
      if (typeof parameters._def.shape === 'function') {
        shapeObj = parameters._def.shape();
      } else if (typeof parameters._def.shape === 'object') {
        shapeObj = parameters._def.shape;
      }
    }
    
    const keys = Object.keys(shapeObj);
    if (keys.length === 0) {
      return <Text type="secondary">无参数</Text>;
    }

    return (
      <Space direction="vertical" size="small">
        {keys.map(key => {
          const param = shapeObj[key];
          let type = 'any';
          let required = true;
          let description = key;
          
          if (!param || !param._def) {
            return <div key={key}><Text strong>{key}</Text></div>;
          }
          
          // 处理可选参数
          if (param._def.typeName === 'ZodOptional') {
            required = false;
            if (param._def.innerType?._def) {
              const innerDef = param._def.innerType._def;
              if (innerDef.typeName === 'ZodString') {
                type = 'string';
              } else if (innerDef.typeName === 'ZodNumber') {
                type = 'number';
              } else if (innerDef.typeName === 'ZodBoolean') {
                type = 'boolean';
              } else if (innerDef.typeName === 'ZodObject') {
                type = 'object';
              } else if (innerDef.typeName === 'ZodArray') {
                type = 'array';
              }
              description = innerDef.description || key;
            }
          } else {
            required = true;
            if (param._def.typeName === 'ZodString') {
              type = 'string';
            } else if (param._def.typeName === 'ZodNumber') {
              type = 'number';
            } else if (param._def.typeName === 'ZodBoolean') {
              type = 'boolean';
            } else if (param._def.typeName === 'ZodObject') {
              type = 'object';
            } else if (param._def.typeName === 'ZodArray') {
              type = 'array';
            }
            description = param._def.description || key;
          }
          
          return (
            <div key={key}>
              <Text strong>{description}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({type}{required ? '' : ', 可选'})
              </Text>
            </div>
          );
        })}
      </Space>
    );
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text: string, record: ToolInfo) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag color="blue">{record.category}</Tag>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
    },
    {
      title: '参数',
      dataIndex: 'parameters',
      key: 'parameters',
      width: '30%',
      render: (parameters: any) => renderParameters(parameters),
    },
    {
      title: '示例',
      dataIndex: 'example',
      key: 'example',
      width: '20%',
      render: (example: string) => 
        example ? (
          <div style={{ position: 'relative' }}>
            <Paragraph 
              copyable
              style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '13px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                maxHeight: '120px',
                overflow: 'auto'
              }}
            >
              {example}
            </Paragraph>
          </div>
        ) : <Text type="secondary">无示例</Text>,
    },

  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <LoadingOutlined style={{ fontSize: 24 }} />
        <Text style={{ marginLeft: 8 }}>加载工具信息...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <Text type="danger">加载失败: {error}</Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <Title level={2}>工具管理</Title>
      <Text>以下列出了所有可用的工具，包括它们的名称、描述、参数和使用示例。</Text>
      
      <Divider />
      
      <Card>
        <Table
          dataSource={tools}
          columns={columns}
          rowKey={(record) => `${record.category}-${record.name}`}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}