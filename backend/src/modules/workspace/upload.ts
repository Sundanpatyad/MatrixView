import crypto from 'node:crypto';
import multer from 'multer';
import { storeUploadedFile } from '../../storage/media.js';
import { uploadsDir } from '../../storage/paths.js';
import { MAX_UPLOAD_BYTES } from './constants.js';

export { uploadsDir };

/** Memory storage — files are persisted to R2 (or local disk) after the request. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

export async function fileToAttachment(
  file: Express.Multer.File,
  uploadedBy: string,
): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: Date;
  uploadedBy: string;
  storageProvider: string;
  storageKey: string;
}> {
  const stored = await storeUploadedFile(file, 'attachments');
  return {
    id: `att_${crypto.randomBytes(6).toString('hex')}`,
    name: stored.name || file.originalname,
    size: stored.size,
    mimeType: stored.mimeType,
    url: stored.url,
    createdAt: new Date(),
    uploadedBy,
    storageProvider: stored.provider,
    storageKey: stored.storageKey,
  };
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}
