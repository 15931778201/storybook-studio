
import { Policy, PolicyResult } from '../core/policy';
export class DefaultPolicy extends Policy {
  async preExecute() { return new PolicyResult(); }
  async postExecute() {}
  async undo() { return 'undo not supported'; }
  async getAuditLog(limit = 20) { return []; }
}
