export async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  options: { 
    maxRetries?: number; 
    initialDelayMs?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, retryableErrors = [] } = options;
  let lastErr: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      
      // 检查错误是否应该重试
      const shouldRetry = retryableErrors.length === 0 || 
        retryableErrors.some(errorType => {
          const errStr = String(e);
          return errStr.includes(errorType) || 
                 (e.status && String(e.status).includes(errorType)) ||
                 (e.code && String(e.code).includes(errorType));
        });
      
      // 如果应该重试且未达到最大重试次数，则等待后继续
      if (shouldRetry && i < maxRetries) {
        await new Promise(r => setTimeout(r, initialDelayMs * Math.pow(2, i)));
      } else if (!shouldRetry) {
        // 如果错误不在可重试列表中，直接抛出
        throw e;
      }
    }
  }
  
  throw lastErr;
}
