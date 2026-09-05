/** STUN always; TURN from env so mobile↔desktop can connect across NATs. */

const STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function callIceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const username = (import.meta.env.VITE_TURN_USERNAME ?? '').trim();
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL ?? '').trim();
  if (!urls.length || !username || !credential) return STUN;
  return [...STUN, { urls, username, credential }];
}
