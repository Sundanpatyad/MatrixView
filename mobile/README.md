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
| State | React Context (auth, workspace, chat, notifications, toast, theme) |
| Storage | `expo-secure-store` for tokens, `AsyncStorage` for profile and preferences |
| Media | `expo-image-picker`, `expo-document-picker`, `expo-image` |

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

### Pointing the app at a backend

`EXPO_PUBLIC_API_URL` drives both REST and the socket connection. Pick the value
that matches how you run the app:

| Target | Value |
| --- | --- |
| iOS simulator | `http://localhost:4000` |
| Android emulator | `http://10.0.2.2:4000` |
| Physical device | `http://<your-lan-ip>:4000` |
| Deployed | `https://your-api-host` |

If the variable is unset, the app falls back to the machine serving the Metro
bundle on port 4000, which covers most local setups automatically.

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
│   │   ├── storage/            # Secure token/session persistence
│   │   ├── config.ts           # API base resolution
│   │   ├── format.ts           # Date, byte and initials formatting
│   │   ├── mediaUrl.ts         # Resolves relative /uploads paths
│   │   └── pickers.ts          # Image, camera and document pickers
│   ├── context/                # Auth, Workspace, Chat, Notification, Toast
│   ├── navigation/             # Root stack, tab navigator, route types
│   ├── components/
│   │   ├── ui/                 # Button, Input, Sheet, Avatar, Card, …
│   │   ├── auth/               # Shared auth screen chrome
│   │   ├── board/              # Task card
│   │   └── chat/               # Message bubble
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
replies, edits, deletes, image/document/camera attachments, typing indicators,
read receipts, and group management (rename, photo, members, leave).

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

## Scripts

```bash
npm start            # Metro dev server
npm run ios          # iOS simulator
npm run android      # Android emulator
npx tsc --noEmit     # Typecheck
npx expo export      # Production bundle smoke test
```

## Notes and limitations

- **Calls are not implemented.** The desktop client uses WebRTC via Tauri; on
  mobile this needs `react-native-webrtc`, which requires a development build
  rather than Expo Go. Call history messages still render in the chat thread.
- **Activity tracking is desktop-only.** The backend restricts session
  start/stop and sample submission to sessions created with
  `deviceType: 'desktop'`, so the mobile client reads attendance but does not
  write it.
- **Offline caching is not ported.** The desktop app uses Tauri SQLite; mobile
  currently keeps state in memory with optimistic sends and retry.
