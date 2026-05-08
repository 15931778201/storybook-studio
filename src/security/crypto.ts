import CryptoJS from 'crypto-js';

// 主密钥来自环境变量，不存在则生成临时密钥（重启后失效）
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || CryptoJS.lib.WordArray.random(256 / 8).toString();

export function encryptApiKey(plaintext: string): string {
  return CryptoJS.AES.encrypt(plaintext, MASTER_KEY).toString();
}

export function decryptApiKey(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, MASTER_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// 随机生成 API Key（供用户创建新 Key 时使用）
export function generateApiKey(): string {
  return `ak-${CryptoJS.lib.WordArray.random(32).toString()}`;
}