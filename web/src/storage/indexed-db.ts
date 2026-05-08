// web/src/storage/indexed-db.ts
import Dexie from 'dexie';

class AgentDB extends Dexie {
  conversations!: Dexie.Table<{ id: string; title: string; messages: any[] }>;
  skills!: Dexie.Table<{ id: string; name: string; title: string; content: string }>;

  constructor() {
    super('AgentKitSolo');
    this.version(1).stores({
      conversations: 'id, title',
      skills: 'id, name',
    });
  }
}

export const soloDB = new AgentDB();