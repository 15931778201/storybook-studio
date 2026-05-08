// src/rag/file-parser.ts
// 补充缺失的类型声明
declare module 'adm-zip';
declare module 'pdf-parse' {
  const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string; numpages?: number }>;
  export default pdfParse;
}
declare module 'officeparser' {
  const parseOffice: (filePath: string) => Promise<string>;
  export default parseOffice;
}

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';        // 默认导入
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import parseOffice from 'officeparser';  // 现在可调用

const PARSERS: Record<string, (filePath: string) => Promise<string>> = {
  '.pdf': parsePdf,
  '.docx': parseDocx,
  '.doc': parseDoc,
  '.xlsx': parseXlsx,
  '.xls': parseXls,
  '.pptx': parsePptx,
  '.ppt': parsePpt,
  '.zip': parseZip,
  '.txt': parseText,
  '.md': parseText,
  '.csv': parseText,
  '.json': parseText,
  '.xml': parseText,
  '.yaml': parseText,
  '.yml': parseText,
  '.ts': parseCode,
  '.tsx': parseCode,
  '.js': parseCode,
  '.jsx': parseCode,
  '.py': parseCode,
  '.java': parseCode,
  '.c': parseCode,
  '.cpp': parseCode,
  '.h': parseCode,
  '.go': parseCode,
  '.rs': parseCode,
  '.vue': parseCode,
  '.css': parseCode,
  '.html': parseCode,
  '.sh': parseCode,
  '.sql': parseCode,
};

async function parsePdf(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parseDoc(filePath: string): Promise<string> {
  try {
    return await parseOffice(filePath);
  } catch {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

async function parseXlsx(filePath: string): Promise<string> {
  const workbook = XLSX.readFile(filePath);
  let text = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    text += `\n--- Sheet: ${sheetName} ---\n`;
    text += XLSX.utils.sheet_to_csv(sheet);
  }
  return text;
}

async function parseXls(filePath: string): Promise<string> {
  return parseXlsx(filePath);
}

async function parsePptx(filePath: string): Promise<string> {
  try {
    return await parseOffice(filePath);
  } catch {
    const zip = new AdmZip(filePath);
    let text = '';
    for (const entry of zip.getEntries()) {
      if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
        text += entry.getData().toString('utf8') + '\n';
      }
    }
    return stripXmlTags(text);
  }
}

async function parsePpt(filePath: string): Promise<string> {
  try {
    return await parseOffice(filePath);
  } catch {
    return '';
  }
}

async function parseZip(filePath: string): Promise<string> {
  const zip = new AdmZip(filePath);
  let allText = '';
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory) {
      const ext = path.extname(entry.entryName).toLowerCase();
      const supported = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.vue', '.css', '.html', '.sh', '.sql'];
      if (supported.includes(ext)) {
        allText += `\n--- ${entry.entryName} ---\n`;
        allText += entry.getData().toString('utf8');
      }
    }
  }
  return allText;
}

async function parseText(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}

async function parseCode(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}

function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, ' ');
}

export async function parseFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const parser = PARSERS[ext];
  if (!parser) {
    return parseText(filePath);
  }
  return await parser(filePath);
}