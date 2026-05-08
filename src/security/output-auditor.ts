
const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY_REDACTED]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL_REDACTED]'],
  [/\b\d{15,19}\b/g, '[CARD_REDACTED]'],
  [/\b\d{6}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{6}\b/g, '[ID_REDACTED]'],
  [/password\s*[:=]\s*\S+/gi, 'password=***'],
  [/Bearer\s+[a-zA-Z0-9\-._~+/]+/g, 'Bearer [TOKEN_REDACTED]'],
];
export function sanitizeOutput(text: string): string { let s = text; for (const [p, r] of SENSITIVE_PATTERNS) s = s.replace(p, r); return s; }
