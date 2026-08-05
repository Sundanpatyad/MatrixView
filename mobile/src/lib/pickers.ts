import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from './api/types';

function fileNameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.includes('.') ? decodeURIComponent(last) : fallback;
}

export async function pickImages(options: { multiple?: boolean } = {}): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to attach images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: options.multiple ?? true,
    selectionLimit: options.multiple === false ? 1 : 5,
    quality: 0.8,
  });
  if (result.canceled) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? fileNameFromUri(asset.uri, `upload-${Date.now()}-${index}.jpg`),
    mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    size: asset.fileSize,
  }));
}

export async function captureImage(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is required to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? `capture-${Date.now()}-${index}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize,
  }));
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.name ?? fileNameFromUri(asset.uri, `document-${Date.now()}-${index}`),
    mimeType: asset.mimeType ?? 'application/octet-stream',
    size: asset.size ?? undefined,
  }));
}
