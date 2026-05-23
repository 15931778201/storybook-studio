export interface UploadedImageResponse {
  success?: boolean;
  dataUri?: string;
  tempPath?: string;
}

export interface UploadedImageAttachment {
  previewUrl: string;
  tempPath: string;
}

export function buildUploadedImageAttachment(response: UploadedImageResponse): UploadedImageAttachment | null {
  if (!response?.success || !response.dataUri || !response.tempPath) return null;
  return {
    previewUrl: response.dataUri,
    tempPath: response.tempPath,
  };
}

export function buildImageStreamParams(attachment: UploadedImageAttachment | null): Record<string, string> {
  return attachment?.tempPath ? { imageRef: attachment.tempPath } : {};
}
