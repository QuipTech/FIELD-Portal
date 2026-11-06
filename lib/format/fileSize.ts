const KB = 1024;
const MB = KB * 1024;

// "840 KB", "2.4 MB". Small files round up, so nothing shows as 0 KB.
export const formatFileSize = (bytes: number): string =>
  bytes < MB ? `${Math.max(1, Math.round(bytes / KB))} KB` : `${(bytes / MB).toFixed(1)} MB`;
