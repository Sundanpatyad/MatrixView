import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

export type CompressedMedia = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
};

const IMAGE_MAX_EDGE = 2048;
const AVATAR_MAX_EDGE = 1024;
/** High visual quality — WebP ~88 is near-original for photos, much smaller files */
const IMAGE_QUALITY = 88;

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function isVideo(mime: string) {
  return mime.startsWith('video/');
}

function isAvatarFolder(folder: string) {
  return folder === 'avatars' || folder === 'chat-avatars';
}

/** Skip formats that shouldn't be re-encoded */
function shouldSkipImage(mime: string) {
  return (
    mime === 'image/svg+xml' ||
    mime === 'image/gif' || // keep animation
    mime === 'image/x-icon' ||
    mime === 'image/vnd.microsoft.icon'
  );
}

async function compressImage(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<CompressedMedia | null> {
  if (shouldSkipImage(mimeType)) return null;

  const maxEdge = isAvatarFolder(folder) ? AVATAR_MAX_EDGE : IMAGE_MAX_EDGE;

  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    let pipeline = sharp(buffer, { failOn: 'none', animated: false }).rotate();
    if (width > maxEdge || height > maxEdge) {
      pipeline = pipeline.resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const out = await pipeline
      .webp({
        quality: IMAGE_QUALITY,
        alphaQuality: 90,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();

    // Keep original if compression didn't help
    if (out.length >= buffer.length * 0.98) return null;

    return {
      buffer: out,
      mimeType: 'image/webp',
      extension: '.webp',
      size: out.length,
    };
  } catch (err) {
    console.warn('[compress] image failed, using original', err);
    return null;
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `ffmpeg exited ${code}`));
    });
  });
}

async function compressVideo(buffer: Buffer): Promise<CompressedMedia | null> {
  const tmp = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(tmp, `tt-in-${id}.bin`);
  const outputPath = path.join(tmp, `tt-out-${id}.mp4`);

  try {
    await fs.writeFile(inputPath, buffer);
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-vf',
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
      outputPath,
    ]);

    const out = await fs.readFile(outputPath);
    if (out.length >= buffer.length * 0.98) return null;

    return {
      buffer: out,
      mimeType: 'video/mp4',
      extension: '.mp4',
      size: out.length,
    };
  } catch (err) {
    console.warn('[compress] video failed, using original', err);
    return null;
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
}

/**
 * Compress images/videos with high visual quality.
 * Returns null when compression is skipped or not beneficial.
 */
export async function compressMedia(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<CompressedMedia | null> {
  if (isImage(mimeType)) return compressImage(buffer, mimeType, folder);
  if (isVideo(mimeType)) return compressVideo(buffer);
  return null;
}

export function withNewExtension(originalName: string, extension: string): string {
  const base = path.basename(originalName, path.extname(originalName)) || 'file';
  return `${base}${extension}`;
}
