import type { TaskAttachment } from './types';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function filesToAttachments(
  files: FileList | File[],
  uploadedBy: string,
): Promise<{ ok: TaskAttachment[]; skipped: string[] }> {
  const list = Array.from(files);
  const ok: TaskAttachment[] = [];
  const skipped: string[] = [];

  for (const file of list) {
    if (file.size > MAX_FILE_BYTES) {
      skipped.push(`${file.name} (max 2MB)`);
      continue;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    ok.push({
      id: uid('att'),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      createdAt: new Date().toISOString(),
      uploadedBy,
    });
  }

  return { ok, skipped };
}
