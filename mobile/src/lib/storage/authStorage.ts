import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthUser } from '../api/types';

const ACCESS_KEY = 'dockx.accessToken';
const REFRESH_KEY = 'dockx.refreshToken';
const USER_KEY = 'dockx.user';

const secureAvailable = Platform.OS !== 'web';

async function setSecret(key: string, value: string) {
  if (secureAvailable) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function getSecret(key: string): Promise<string | null> {
  if (secureAvailable) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

async function deleteSecret(key: string) {
  if (secureAvailable) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Promise.all([
    setSecret(ACCESS_KEY, session.accessToken),
    setSecret(REFRESH_KEY, session.refreshToken),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([setSecret(ACCESS_KEY, accessToken), setSecret(REFRESH_KEY, refreshToken)]);
}

export async function saveUser(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const [accessToken, refreshToken, rawUser] = await Promise.all([
      getSecret(ACCESS_KEY),
      getSecret(REFRESH_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    if (!accessToken || !refreshToken || !rawUser) return null;
    return { accessToken, refreshToken, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteSecret(ACCESS_KEY),
    deleteSecret(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY),
  ]);
}
