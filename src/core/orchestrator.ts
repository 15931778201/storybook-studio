import { AgentLoop } from './agent-loop';

export class Orchestrator {
  constructor(private subAgents: Map<string, AgentLoop>) {}

  async delegate(task: string, toAgentName: string): Promise<string> {
    const agent = this.subAgents.get(toAgentName);
    if (!agent) throw new Error(`Agent ${toAgentName} not found`);
    return await agent.run(task);
  }
}
