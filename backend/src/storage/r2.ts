import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { uploadsDir } from './paths.js';

let client: S3Client | null = null;

export function isR2Enabled(): boolean {
  return Boolean(
    config.r2.accountId &&
      config.r2.accessKeyId &&
      config.r2.secretAccessKey &&
      config.r2.bucket &&
      config.r2.publicUrl,
  );
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return client;
}

function extFromName(originalName: string): string {
  const ext = path.extname(originalName).slice(0, 16);
  return ext || '';
}

function buildKey(folder: string, fileName: string): string {
  const safeFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads';
  return `${safeFolder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extFromName(fileName)}`;
}

export function isR2Url(url: string): boolean {
  const base = config.r2.publicUrl.replace(/\/$/, '');
  if (!base) return false;
  return url.startsWith(base + '/') || url === base;
}

/** Strip codec params — `audio/webm;codecs=opus` breaks some players. */
function cleanContentType(contentType: string): string {
  const base = contentType.split(';')[0]?.trim();
  return base || 'application/octet-stream';
}

export async function uploadToR2(
  buffer: Buffer,
  opts: { folder: string; fileName: string; contentType: string },
): Promise<{ url: string; size: number; key: string }> {
  const key = buildKey(opts.folder, opts.fileName);
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: cleanContentType(opts.contentType),
    }),
  );
  return {
    url: `${config.r2.publicUrl}/${key}`,
    size: buffer.length,
    key,
  };
}

export async function storeLocalFile(
  buffer: Buffer,
  fileName: string,
): Promise<{ url: string; size: number }> {
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extFromName(fileName)}`;
  const dest = path.join(uploadsDir, filename);
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(dest, buffer);
  return { url: `/uploads/${filename}`, size: buffer.length };
}

function keyFromPublicUrl(url: string): string | null {
  const base = config.r2.publicUrl.replace(/\/$/, '');
  if (!base || (!url.startsWith(base + '/') && url !== base)) return null;
  try {
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    return key || null;
  } catch {
    const key = url.slice(base.length).replace(/^\//, '');
    return key || null;
  }
}

export async function deleteFromR2ByKey(key: string): Promise<boolean> {
  if (!isR2Enabled() || !key) return false;
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    console.warn('[r2] delete failed', key, err);
    return false;
  }
}

export async function deleteFromR2(url: string): Promise<boolean> {
  if (!isR2Enabled()) return false;
  const key = keyFromPublicUrl(url);
  if (!key) return false;
  return deleteFromR2ByKey(key);
}

export async function deleteLocalUpload(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return;
  const filename = path.basename(url);
  if (!filename || filename === '.' || filename === '..') return;
  await fs.unlink(path.join(uploadsDir, filename)).catch(() => undefined);
}
