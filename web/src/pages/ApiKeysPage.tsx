
import { useState, useEffect } from 'react'; import { Table, Button, Modal, Input, Form, Popconfirm, Space, Tag, message } from 'antd'; import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [modal, setModal] = useState(false); const [form] = Form.useForm();
  const fetchKeys = async () => { setLoading(true); try { const r = await window.fetch('/api/keys'); setKeys(await r.json()); } catch {} finally { setLoading(false); } };
  useEffect(() => { fetchKeys(); }, []);
  const create = async (v: any) => { await window.fetch('/api/keys', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(v) }); message.success('创建成功'); setModal(false); form.resetFields(); fetchKeys(); };
  const del = async (id: string) => { await window.fetch('/api/keys/'+id, { method:'DELETE' }); fetchKeys(); };
  const cols = [ { title:'名称', dataIndex:'name' }, { title:'Key', dataIndex:'masked', render: (v:string)=><Tag>{v}</Tag> }, { title:'创建时间', dataIndex:'createdAt', render: (v:string)=>new Date(v).toLocaleString() }, { title:'操作', render: (_:any, r:any)=><Space><Popconfirm title="删除？" onConfirm={()=>del(r.id)}><Button size="small" danger icon={<DeleteOutlined/>}/></Popconfirm></Space> } ];
  return <div style={{padding:24}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}><h3>🔑 API Keys</h3><Button type="primary" icon={<PlusOutlined/>} onClick={()=>setModal(true)}>新建</Button></div><Table dataSource={keys} columns={cols} rowKey="id" loading={loading}/>
    <Modal title="新建 Key" open={modal} onCancel={()=>setModal(false)} onOk={()=>form.submit()}><Form form={form} layout="vertical" onFinish={create}><Form.Item name="name" label="名称" rules={[{required:true}]}><Input placeholder="如：我的 Key"/></Form.Item><Form.Item name="plainKey" label="API Key" rules={[{required:true}]}><Input.Password placeholder="sk-..."/></Form.Item></Form></Modal></div>;
}
