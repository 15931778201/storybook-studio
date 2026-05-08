
import { createPatch } from 'diff';
export function generateUnifiedDiff(oldStr: string, newStr: string, filePath: string): string {
  return createPatch(filePath, oldStr, newStr, 'a', 'b');
}
