
const THREAT_PATTERNS = [
  /ignore (all )?(previous|above) (instructions?|prompts?)/i,
  /forget (all )?(previous|above|your) (instructions?|prompts?|rules?)/i,
  /pretend (you are|to be)/i,
  /system:\s*you are now/i,
  /DAN mode/i,
  /developer mode/i,
  /\b(SELECT|DROP|INSERT|DELETE|UPDATE|ALTER)\b.*\b(FROM|TABLE)\b/i,
  /'.*--/,
  /\$\(.*\)/,
  /`.*`/,
  /\|\s*(sh|bash|curl|wget)/,
];
const SAFE_MAX_LENGTH = 32000;
export function filterInput(input: string): { safe: boolean; threatLevel: 0|1|2|3; warnings: string[]; sanitized: string } {
  if (input.length > SAFE_MAX_LENGTH) return { safe: false, threatLevel: 3, warnings: ['输入过长'], sanitized: input.slice(0, SAFE_MAX_LENGTH) };
  const warnings: string[] = []; let level: 0|1|2|3 = 0;
  for (const p of THREAT_PATTERNS) { if (p.test(input)) { warnings.push(`威胁: ${p.source}`); level = Math.max(level, 2) as any; } }
  const sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\n{3,}/g, '\n\n');
  return { safe: level < 3, threatLevel: level, warnings, sanitized };
}
