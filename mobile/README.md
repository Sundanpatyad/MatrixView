# DockX Mobile

The Expo (React Native) client for DockX. It talks to the same backend as the
desktop app — the same REST API, the same Socket.IO gateway, the same auth —
so a user can move between desktop and phone with no loss of state.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19 |
| Language | TypeScript (strict) |
| Navigation | React Navigation native stack + bottom tabs |
| Realtime | `socket.io-client` against the backend's `/socket.io` path |
| State | React Context (auth, workspace, chat, calls, notifications, toast, theme) |
| Storage | `expo-secure-store` for tokens, `AsyncStorage` for profile and preferences |
| Media | `expo-image-picker`, `expo-document-picker`, `expo-image`, `expo-sharing` |
| Calls | `react-native-webrtc` (mesh peer connections, Google STUN) |
| Surfaces | `expo-blur` for the glass tab bar and headers |

## Getting started

```bash
cd mobile
npm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at your backend
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with
Expo Go.

The backend must be running (`cd ../backend && npm run dev`, port 4000 by
default).

### Expo Go vs. a development build

Everything except audio and video calling runs in Expo Go. Calling needs
`react-native-webrtc`, whose native module Expo Go does not bundle, so it
requires a development build:

```bash
npx expo run:android      # or: npx expo run:ios
```

The app detects this at runtime rather than crashing: in Expo Go the call
buttons report that a development build is needed, and incoming calls are
declined automatically so the caller is not left ringing.

> Expo Go must match the project's SDK. If Metro logs *"Project is incompatible
> with this version of Expo Go"*, update Expo Go from the App Store or Play
> Store.

### Pointing the app at a backend

`EXPO_PUBLIC_API_URL` drives both REST and the socket connection. Pick the value
that matches how you run the app:

| Target | Value |
| --- | --- |
| Any local setup | `http://localhost:4000` |
| Deployed | `https://your-api-host` |

`localhost` works everywhere in development: on a device or emulator a loopback
address would point at the phone itself, so `resolveApiBase` in
`src/lib/config.ts` substitutes the machine serving the Metro bundle and keeps
the port you configured. Set an explicit host, or any `https://` URL, to opt out
of that behaviour.

Because the backend allows requests without an `Origin` header, no extra CORS
configuration is needed for the mobile client.

## Project layout

```
mobile/
├── App.tsx                     # Provider tree + navigation root
├── src/
│   ├── theme/                  # Design tokens and light/dark ThemeProvider
│   ├── lib/
│   │   ├── api/                # fetch client + one module per backend area
│   │   ├── socket/             # Shared Socket.IO client and handler registry
│   │   ├── webrtc/             # Guarded native loader + mesh call session
│   │   ├── storage/            # Secure token/session persistence
│   │   ├── config.ts           # API base resolution
│   │   ├── format.ts           # Date, byte and initials formatting
│   │   ├── mediaUrl.ts         # Resolves relative /uploads paths
│   │   ├── attachments.ts      # Download + share sheet for chat files
│   │   └── pickers.ts          # Image, camera and document pickers
│   ├── context/                # Auth, Workspace, Chat, Call, Notification, Toast
│   ├── navigation/             # Root stack, tab navigator, route types
│   ├── components/
│   │   ├── ui/                 # Button, Input, Sheet, GlassSurface, …
│   │   ├── auth/               # Shared auth screen chrome
│   │   ├── board/              # Task card
│   │   ├── calls/              # Full-screen call overlay
│   │   └── chat/               # Message bubble, typing indicator
│   └── screens/                # One folder per feature area
```

## Features

**Auth** — email/password sign in, sign up (including invite-link registration
via `dockx://register?inviteToken=…`), session restore on launch, silent access
token refresh, sign out, and sign out everywhere.

**Dashboard** — greeting, project filter, KPI tiles (open, completed, due this
week, overdue), completion progress with a per-column breakdown, unassigned
backlog, and a filterable task list.

**Board** — project switcher, column strip with live counts, team filter,
search, task creation, and moving tasks between columns. Column adds are
available to project admins.

**Task detail** — status, priority and assignee changes; description, labels and
hours; attachment upload, download and removal; threaded comments with
attachments.

**Chat** — conversation list with presence and unread counts, DM and group
creation, message history with pagination, optimistic sending with retry,
replies, edits, deletes, read receipts, and group management (rename, photo,
members, leave).

**Typing indicators** — an animated three-dot bubble above the composer naming
who is typing, the same state in the thread header subtitle, and a live
"typing…" line replacing the preview in the conversation list. Outbound typing
is throttled and stops on send, blur, or 2.2s of inactivity.

**Document sharing** — photos, camera captures, and documents (up to 5 files,
25 MB each). Picked files render in the bubble immediately while the upload runs
rather than showing an empty placeholder. Tapping a non-image attachment
downloads it to a cache directory and opens the system share sheet, so it can be
previewed, opened in another app, or saved; repeat opens reuse the cached copy.

**Audio and video calls** — one-to-one and group calls over WebRTC, reusing the
backend's existing `call:*` signaling, so mobile and desktop interoperate.
Includes a full-screen call overlay with a video grid and floating self-view,
mute, camera on/off, camera flip, call duration, vibrating incoming ring with
accept/decline, and a "call in progress" banner for joining a group call
already under way. Group calls are a full mesh (one peer connection per
participant), matching the desktop client and the server's 8-participant cap.

**Appearance** — light and dark themes following the system by default, with a
manual override in Settings and a quick toggle on the profile screen. The tab
bar and the headers on Chats, Notifications, Profile, and the chat thread are
blurred glass panes that content scrolls beneath.

**Notifications** — filterable inbox, deep links into the relevant task or
conversation, mark one/all read, dismiss.

**Profile and settings** — avatar upload, name and phone editing, theme
preference (light/dark/system), connection status with manual resync, and both
sign-out paths.

## How the client talks to the backend

**REST** goes through `src/lib/api/client.ts`. It attaches
`Authorization: Bearer <accessToken>` when a call opts into `auth: true`, and on
a `401` it refreshes the token once and replays the request. Refreshes are
deduplicated in `AuthContext` — the backend revokes an entire session family if
a rotated refresh token is reused, so parallel 401s must not each trigger a
rotation.

**Sockets** go through `src/lib/socket/socket.ts`, a single shared connection
that authenticates with `{ token: accessToken }` in the handshake. Features
register named callbacks (`patchSocketHandlers`) rather than attaching their own
listeners, so navigating between screens never tears down the connection. The
module tracks which conversation and project rooms have been joined and replays
them on every reconnect, and it reconnects when the app returns from the
background.

**Calls** are signalled over that same socket. `callSocket` in the socket module
wraps the handshake events (`call:invite`, `call:join`, `call:accept`,
`call:reject`, `call:hangup`) as promises that resolve on the server's
acknowledgement, because the reply carries the peer id, the participant roster,
and busy/full errors that the media setup depends on. The SDP and ICE relays
stay fire-and-forget.

`CallSession` (`src/lib/webrtc/callSession.ts`) is a single mesh implementation
used by both call types — a direct call is simply a mesh with one peer. It
applies perfect-negotiation rules so simultaneous offers resolve, and it queues
ICE candidates that arrive before their peer connection has a remote
description, which is common on mobile networks and which the desktop client
does not do.

## Scripts

```bash
npm start            # Metro dev server
npm run ios          # iOS simulator
npm run android      # Android emulator
npx tsc --noEmit     # Typecheck
npx expo export      # Production bundle smoke test
```

## Notes and limitations

- **Calls need a development build.** See the section above. `getWebRTC()` in
  `src/lib/webrtc/webrtcModule.ts` loads the native module lazily behind a
  guard, so the rest of the app stays usable in Expo Go.
- **No speaker/earpiece toggle.** `react-native-webrtc` exposes no audio-routing
  API — its `RTCAudioSession` is only CallKit hooks — so audio follows the
  platform default. Adding `react-native-incall-manager` would provide speaker
  selection and proximity handling.
- **`react-native-webrtc` is a legacy-architecture module.** It ships no
  TurboModule/codegen config, so under Expo SDK 57's New Architecture it runs
  through RN's interop layer. React Native Directory lists it as untested there;
  the `expo.doctor.reactNativeDirectoryCheck.exclude` entry in `package.json`
  acknowledges that warning. If `RTCView` misbehaves in your build, that
  interop layer is the first thing to check.
- **No TURN server.** Only Google's public STUN servers are configured, matching
  the desktop client. Calls between restrictive mobile networks may fail to
  connect until a TURN server is added to `ICE_SERVERS` in `callSession.ts`.
- **Screen sharing is receive-only.** Incoming `call:screen` announcements are
  tracked per participant, but the mobile client cannot start a share.
- **Activity tracking is desktop-only.** The backend restricts session
  start/stop and sample submission to sessions created with
  `deviceType: 'desktop'`, so the mobile client reads attendance but does not
  write it.
- **Offline caching is not ported.** The desktop app uses Tauri SQLite; mobile
  currently keeps state in memory with optimistic sends and retry.
