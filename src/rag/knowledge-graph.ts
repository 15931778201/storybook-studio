import fs from 'fs';
import path from 'path';

const TOKENIZE_REGEX = /[a-zA-Z0-9_\u4e00-\u9fff]+/g;

interface Entity {
  id: string;
  label: string;
  type: 'class' | 'function' | 'variable' | 'interface' | 'concept' | 'file';
  chunkIds: string[];
}

interface Edge {
  from: string;
  to: string;
  type: 'co_occur' | 'imports' | 'hierarchy';
}

interface GraphData {
  entities: Entity[];
  edges: Edge[];
}

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private edges: Edge[] = [];
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = path.resolve(storagePath);
    this.load();
  }

  addFileEntities(filePath: string, content: string): void {
    const fileName = path.basename(filePath);
    const fileId = this.entityId('file', filePath);
    this.addEntity({ id: fileId, label: fileName, type: 'file', chunkIds: [] });

    const codeEntities = this.extractCodeEntities(content);
    for (const { label, type } of codeEntities) {
      const eid = this.entityId(type, label);
      this.addEntity({ id: eid, label, type, chunkIds: [] });
      this.edges.push({ from: fileId, to: eid, type: 'hierarchy' });
    }

    const conceptEntities = this.extractConceptEntities(content);
    for (const label of conceptEntities) {
      const eid = this.entityId('concept', label);
      this.addEntity({ id: eid, label, type: 'concept', chunkIds: [] });
    }
  }

  addChunkAssociations(chunkId: string, filePath: string, content: string): void {
    const fileId = this.entityId('file', filePath);
    this.addChunkToEntity(fileId, chunkId);

    const codeEntities = this.extractCodeEntities(content);
    for (const { label, type } of codeEntities) {
      const eid = this.entityId(type, label);
      this.addChunkToEntity(eid, chunkId);
    }

    const conceptEntities = this.extractConceptEntities(content);
    for (const label of conceptEntities) {
      const eid = this.entityId('concept', label);
      this.addChunkToEntity(eid, chunkId);
    }

    const entityIds = [fileId, ...codeEntities.map(e => this.entityId(e.type, e.label)), ...conceptEntities.map(l => this.entityId('concept', l))];
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        if (entityIds[i] !== entityIds[j]) {
          this.addEdge(entityIds[i], entityIds[j], 'co_occur');
        }
      }
    }
  }

  search(query: string): string[] {
    const tokens = this.tokenize(query);
    const matchedEntityIds = new Set<string>();

    for (const token of tokens) {
      for (const [eid, entity] of this.entities) {
        if (entity.label.toLowerCase().includes(token)) {
          matchedEntityIds.add(eid);
        }
      }
    }

    const relatedEntityIds = new Set(matchedEntityIds);
    for (const eid of matchedEntityIds) {
      for (const edge of this.edges) {
        if (edge.from === eid) relatedEntityIds.add(edge.to);
        if (edge.to === eid) relatedEntityIds.add(edge.from);
      }
    }

    const chunkIds = new Set<string>();
    for (const eid of relatedEntityIds) {
      const entity = this.entities.get(eid);
      if (entity) {
        for (const cid of entity.chunkIds) {
          chunkIds.add(cid);
        }
      }
    }

    return Array.from(chunkIds);
  }

  getGraphData(): GraphData {
    return {
      entities: Array.from(this.entities.values()),
      edges: this.edges,
    };
  }

  persist(): void {
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(this.getGraphData()), 'utf-8');
  }

  clear(): void {
    this.entities.clear();
    this.edges = [];
    if (fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
  }

  private addEntity(entity: Entity): void {
    if (!this.entities.has(entity.id)) {
      this.entities.set(entity.id, entity);
    }
  }

  private addChunkToEntity(entityId: string, chunkId: string): void {
    const entity = this.entities.get(entityId);
    if (entity && !entity.chunkIds.includes(chunkId)) {
      entity.chunkIds.push(chunkId);
    }
  }

  private addEdge(from: string, to: string, type: Edge['type']): void {
    const exists = this.edges.some(e => e.from === from && e.to === to || e.from === to && e.to === from);
    if (!exists) {
      this.edges.push({ from, to, type });
    }
  }

  private entityId(type: string, label: string): string {
    return `${type}::${label}`;
  }

  private extractCodeEntities(content: string): { label: string; type: Entity['type'] }[] {
    const entities: { label: string; type: Entity['type'] }[] = [];
    const patterns: { regex: RegExp; type: Entity['type'] }[] = [
      { regex: /class\s+(\w+)/g, type: 'class' },
      { regex: /interface\s+(\w+)/g, type: 'interface' },
      { regex: /function\s+(\w+)/g, type: 'function' },
      { regex: /const\s+(\w+)\s*[:=]/g, type: 'variable' },
      { regex: /let\s+(\w+)\s*[:=]/g, type: 'variable' },
      { regex: /var\s+(\w+)\s*[:=]/g, type: 'variable' },
      { regex: /type\s+(\w+)\s*=/g, type: 'interface' },
      { regex: /enum\s+(\w+)/g, type: 'class' },
      { regex: /import\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g, type: 'concept' },
      { regex: /export\s+(?:default\s+)?(?:class|function|interface|type|const|enum)\s+(\w+)/g, type: 'class' },
    ];
    for (const { regex, type } of patterns) {
      const matches = content.matchAll(regex);
      for (const m of matches) {
        const label = type === 'concept' ? (m[1].split('/').pop() || m[1]) : m[1];
        if (label && label.length >= 2) {
          entities.push({ label, type });
        }
      }
    }
    return entities;
  }

  private extractConceptEntities(content: string): string[] {
    const freq = new Map<string, number>();
    const tokens = this.tokenize(content);
    for (const token of tokens) {
      if (token.length >= 4) {
        freq.set(token, (freq.get(token) || 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);
  }

  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(TOKENIZE_REGEX.source, 'g');
    while ((match = regex.exec(text.toLowerCase())) !== null) {
      const token = match[0];
      if (token.length >= 2) tokens.push(token);
    }
    return tokens;
  }

  private load(): void {
    if (!fs.existsSync(this.storagePath)) return;
    try {
      const data: GraphData = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
      for (const entity of data.entities) {
        this.entities.set(entity.id, entity);
      }
      this.edges = data.edges || [];
    } catch {
      this.entities.clear();
      this.edges = [];
    }
  }
}
