type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const STUN: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function callIceServers(): IceServer[] {
  const urls = (process.env.EXPO_PUBLIC_TURN_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const username = (process.env.EXPO_PUBLIC_TURN_USERNAME ?? '').trim();
  const credential = (process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? '').trim();
  if (!urls.length || !username || !credential) return STUN;
  return [...STUN, { urls, username, credential }];
}
