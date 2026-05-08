export class AgentKitError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'AgentKitError';
    }
}
