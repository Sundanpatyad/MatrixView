import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = '4000';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Host machine that serves the Metro bundle. A physical device or emulator can
 * reach the developer's laptop here without hardcoding a LAN address.
 */
function inferDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    null;
  const host = hostUri?.split(':')[0];
  if (!host || LOOPBACK_HOSTS.has(host)) return null;
  return host;
}

function parseUrl(value: string): { host: string; port: string; protocol: string } | null {
  const match = /^(https?:)\/\/([^:/?#]+)(?::(\d+))?/i.exec(value);
  if (!match) return null;
  return { protocol: match[1].toLowerCase(), host: match[2], port: match[3] ?? '' };
}

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const devHost = inferDevHost();

  if (fromEnv) {
    const parsed = parseUrl(fromEnv);
    // A loopback address resolves to the device itself, not the dev machine, so
    // swap in the Metro host while keeping the configured port.
    if (parsed && devHost && parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.host)) {
      const port = parsed.port || DEFAULT_API_PORT;
      return `http://${devHost}:${port}`;
    }
    return stripTrailingSlash(fromEnv);
  }

  if (devHost) return `http://${devHost}:${DEFAULT_API_PORT}`;

  return Platform.OS === 'android'
    ? `http://10.0.2.2:${DEFAULT_API_PORT}`
    : `http://localhost:${DEFAULT_API_PORT}`;
}

export const API_BASE = resolveApiBase();

export const DEVICE_TYPE = 'mobile' as const;
export const DEVICE_ID = `dockx-${Platform.OS}`;
