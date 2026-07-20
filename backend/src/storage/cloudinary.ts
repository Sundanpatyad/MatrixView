import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import crypto from 'node:crypto';
import { config } from '../config.js';

let configured = false;

export function isCloudinaryEnabled(): boolean {
  return Boolean(
    config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret,
  );
}

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
}

function resourceTypeForMime(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('video/') ? 'video' : 'image';
}

export function isCloudinaryUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname.includes('cloudinary.com')) return true;
    if (config.cloudinary.cloudName && u.pathname.includes(`/${config.cloudinary.cloudName}/`)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function uploadToCloudinary(
  buffer: Buffer,
  opts: {
    folder: string;
    mimeType: string;
    fileName: string;
  },
): Promise<{ url: string; publicId: string; bytes: number; mimeType: string }> {
  ensureConfigured();
  const resourceType = resourceTypeForMime(opts.mimeType);
  const safeFolder = `dockx/${opts.folder.replace(/^\/+|\/+$/g, '') || 'media'}`;
  const publicId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: safeFolder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error('Cloudinary upload failed'));
        else resolve(res);
      },
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes ?? buffer.length,
    mimeType: opts.mimeType,
  };
}

/** Parse public_id + resource_type from a Cloudinary delivery URL. */
export function parseCloudinaryUrl(
  url: string,
): { publicId: string; resourceType: 'image' | 'video' | 'raw' } | null {
  try {
    if (!isCloudinaryUrl(url)) return null;
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx < 1) return null;

    const resourceType = (parts[uploadIdx - 1] || 'image') as 'image' | 'video' | 'raw';
    let after = parts.slice(uploadIdx + 1);
    if (after[0]?.match(/^v\d+$/)) after = after.slice(1);
    // Only skip transformation segments (contain , or typical transform prefixes)
    while (
      after.length > 1 &&
      (after[0]!.includes(',') || /^(c_|w_|h_|q_|f_|e_|l_|t_)/.test(after[0]!))
    ) {
      after = after.slice(1);
    }

    const withExt = after.join('/');
    if (!withExt) return null;
    const publicId = withExt.replace(/\.[^/.]+$/, '');
    return { publicId, resourceType };
  } catch {
    return null;
  }
}

async function destroyOnce(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw',
): Promise<boolean> {
  ensureConfigured();
  try {
    const result = (await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    })) as { result?: string };
    if (result?.result === 'ok' || result?.result === 'not found') {
      return result.result === 'ok';
    }
    // Some SDK versions return different shapes
    return Boolean(result);
  } catch (err) {
    console.warn('[cloudinary] destroy failed', publicId, resourceType, err);
    return false;
  }
}

export async function deleteFromCloudinaryByKey(
  publicId: string,
  resourceHint?: 'image' | 'video' | 'raw',
): Promise<boolean> {
  if (!isCloudinaryEnabled() || !publicId) return false;
  const order: Array<'image' | 'video' | 'raw'> = resourceHint
    ? [resourceHint, resourceHint === 'video' ? 'image' : 'video', 'raw']
    : ['image', 'video', 'raw'];
  for (const type of order) {
    if (await destroyOnce(publicId, type)) return true;
  }
  return false;
}

export async function deleteFromCloudinary(
  url: string,
  resourceHint?: 'image' | 'video' | 'raw',
): Promise<boolean> {
  if (!isCloudinaryEnabled()) return false;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return false;
  const hint = resourceHint ?? parsed.resourceType;
  if (await deleteFromCloudinaryByKey(parsed.publicId, hint)) return true;
  // Last attempt with parsed type if hint differed
  if (hint !== parsed.resourceType) {
    return deleteFromCloudinaryByKey(parsed.publicId, parsed.resourceType);
  }
  return false;
}
