export interface TextSplitterConfig {
  chunkSize: number;
  chunkOverlap: number;
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

export class RecursiveTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(config: Partial<TextSplitterConfig> = {}) {
    this.chunkSize = config.chunkSize ?? 1500;
    this.chunkOverlap = config.chunkOverlap ?? 200;
  }

  splitText(text: string): string[] {
    const segments = this.extractProtectedSegments(text);
    const chunks: string[] = [];
    for (const seg of segments) {
      if (seg.protected) {
        chunks.push(seg.text);
      } else {
        const split = this.recursiveSplit(seg.text, DEFAULT_SEPARATORS, 0);
        chunks.push(...split);
      }
    }
    return this.mergeWithOverlap(chunks);
  }

  private extractProtectedSegments(text: string): { text: string; protected: boolean }[] {
    const result: { text: string; protected: boolean }[] = [];
    const regex = /(```[\s\S]*?```)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), protected: false });
      }
      result.push({ text: match[1], protected: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), protected: false });
    }
    return result;
  }

  private recursiveSplit(text: string, separators: string[], depth: number): string[] {
    if (text.length <= this.chunkSize || depth >= separators.length) {
      return text.length > 0 ? [text] : [];
    }
    const sep = separators[depth];
    if (sep === '') {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += this.chunkSize) {
        chunks.push(text.slice(i, i + this.chunkSize));
      }
      return chunks;
    }
    const parts = text.split(sep);
    const result: string[] = [];
    let current = '';
    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length <= this.chunkSize) {
        current = candidate;
      } else {
        if (current) result.push(current);
        const subParts = this.recursiveSplit(part, separators, depth + 1);
        for (const sub of subParts) {
          const last = result[result.length - 1];
          if (last && (last + sep + sub).length <= this.chunkSize) {
            result[result.length - 1] = last + sep + sub;
          } else {
            result.push(sub);
          }
        }
        current = '';
      }
    }
    if (current) result.push(current);
    return result;
  }

  private mergeWithOverlap(chunks: string[]): string[] {
    if (chunks.length <= 1 || this.chunkOverlap <= 0) return chunks;
    const result: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      if (i > 0 && this.chunkOverlap > 0) {
        const prev = result[result.length - 1];
        const overlap = prev.slice(-this.chunkOverlap);
        chunk = overlap + chunk;
      }
      result.push(chunk);
    }
    return result;
  }
}
