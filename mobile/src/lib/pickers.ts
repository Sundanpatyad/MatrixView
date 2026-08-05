import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { PickedFile } from './api/types';

function fileNameFromUri(uri: string, fallback: string): string {
  const cleaned = uri.split('?')[0] ?? uri;
  const last = cleaned.split('/').pop();
  return last && last.includes('.') ? decodeURIComponent(last) : fallback;
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'application/pdf': 'pdf',
  };
  return map[mimeType] ?? 'bin';
}

function ensureNamedFile(
  name: string | null | undefined,
  uri: string,
  mimeType: string,
  fallbackBase: string,
): string {
  const candidate = name?.trim() || fileNameFromUri(uri, '');
  if (candidate && candidate.includes('.')) return candidate;
  return `${fallbackBase}.${extensionForMime(mimeType)}`;
}

function guessMime(name: string, fallback: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/x-m4v';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return fallback;
  }
}

function asciiFileName(name: string, mimeType: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  if (cleaned.includes('.')) return cleaned;
  return `upload.${extensionForMime(mimeType)}`;
}

/**
 * Copy picker assets into the app cache as plain `file://` paths.
 * Photo-library / content URIs often cannot be read for upload.
 */
export async function prepareFileForUpload(file: PickedFile): Promise<PickedFile> {
  const mimeType = file.mimeType || guessMime(file.name, 'application/octet-stream');
  const name = asciiFileName(
    ensureNamedFile(file.name, file.uri, mimeType, `upload-${Date.now()}`),
    mimeType,
  );

  const base = FileSystem.cacheDirectory;
  if (!base) {
    return { ...file, name, mimeType };
  }

  const folder = `${base}chat-uploads`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const dest = `${folder}/${Date.now()}-${name}`;

  try {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (info.exists) {
      await FileSystem.copyAsync({ from: file.uri, to: dest });
      const copied = await FileSystem.getInfoAsync(dest);
      return {
        uri: dest,
        name,
        mimeType,
        size: copied.exists && 'size' in copied ? copied.size : file.size,
      };
    }
  } catch {
    // Fall through and try the original URI.
  }

  return {
    uri: file.uri.startsWith('file://') ? encodeURI(decodeURI(file.uri)) : file.uri,
    name,
    mimeType,
    size: file.size,
  };
}

/**
 * Expo 57 winter fetch rejects RN `{ uri, name, type }` parts. It also cannot
 * build Blobs from ArrayBuffer. Append an expo-file-system `File` instead —
 * convertFormData reads it via `.bytes()`.
 */
export async function appendUploadFile(form: FormData, field: string, file: PickedFile): Promise<void> {
  const ready = await prepareFileForUpload(file);
  const expoFile = new File(ready.uri);
  if (!expoFile.exists) {
    throw new Error(`Could not read "${ready.name}" for upload.`);
  }
  // Do not pass a 3rd filename arg — File.name is read-only and Expo's FormData
  // patch would try to assign it. prepareFileForUpload already uses a clean name.
  form.append(field, expoFile as unknown as Blob);
}

export async function pickImages(options: { multiple?: boolean } = {}): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to attach media.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: options.multiple ?? true,
    selectionLimit: options.multiple === false ? 1 : 5,
    quality: 0.7,
    exif: false,
    videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return [];

  const picked = result.assets.map((asset, index) => {
    const isVideo = asset.type === 'video';
    const mimeType =
      asset.mimeType ??
      (isVideo ? 'video/mp4' : Platform.OS === 'ios' ? 'image/jpeg' : 'image/jpeg');
    const name = ensureNamedFile(
      asset.fileName,
      asset.uri,
      mimeType,
      `${isVideo ? 'video' : 'image'}-${Date.now()}-${index}`,
    );
    return {
      uri: asset.uri,
      name,
      mimeType,
      size: asset.fileSize,
    };
  });

  return Promise.all(picked.map(prepareFileForUpload));
}

export async function captureImage(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is required to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    exif: false,
  });
  if (result.canceled) return [];

  const picked = result.assets.map((asset, index) => {
    const mimeType = asset.mimeType ?? 'image/jpeg';
    return {
      uri: asset.uri,
      name: ensureNamedFile(asset.fileName, asset.uri, mimeType, `capture-${Date.now()}-${index}`),
      mimeType,
      size: asset.fileSize,
    };
  });

  return Promise.all(picked.map(prepareFileForUpload));
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (result.canceled) return [];

  const picked = result.assets.map((asset, index) => {
    const mimeType = asset.mimeType || guessMime(asset.name ?? '', 'application/octet-stream');
    return {
      uri: asset.uri,
      name: ensureNamedFile(asset.name, asset.uri, mimeType, `document-${Date.now()}-${index}`),
      mimeType,
      size: asset.size ?? undefined,
    };
  });

  return Promise.all(picked.map(prepareFileForUpload));
}
