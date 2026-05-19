export function shouldPromoteWriteToPatch(before: string, after: string): boolean {
  if (before === after) return false;
  if (before.length === 0) return false;
  return true;
}

export function buildPatchArgsForWrite(filePath: string, before: string, after: string) {
  return {
    patches: [
      {
        filePath,
        search: before,
        replace: after,
        expectedMatches: 1,
      },
    ],
  };
}
