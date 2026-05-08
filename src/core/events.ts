import { EventEmitter } from 'events';
export class AgentEventBus extends EventEmitter {
  private static instance: AgentEventBus;
  static getInstance() { if (!this.instance) this.instance = new AgentEventBus(); return this.instance; }
}
