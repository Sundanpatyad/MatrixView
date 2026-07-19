import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from './constants.js';

export const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

export function fileToAttachment(
  file: Express.Multer.File,
  uploadedBy: string,
): {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: Date;
  uploadedBy: string;
} {
  return {
    id: `att_${crypto.randomBytes(6).toString('hex')}`,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype || 'application/octet-stream',
    url: `/uploads/${file.filename}`,
    createdAt: new Date(),
    uploadedBy,
  };
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}
