import { EventEmitter } from 'events';

class LogBus extends EventEmitter {
  private static instance: LogBus;
  static getInstance() {
    if (!this.instance) this.instance = new LogBus();
    return this.instance;
  }
}

export const logBus = LogBus.getInstance();