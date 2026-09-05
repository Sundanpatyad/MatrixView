#!/usr/bin/env bash
# cargo runner for `tauri:dev` on macOS.
# WKWebView reports "0 devices" unless the process runs inside a real .app
# with Info.plist usage strings and an ad-hoc signature.
set -euo pipefail

BIN="${1:?missing binary}"
shift

SRC_TAURI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$SRC_TAURI/target/debug/macos/DockX.app"
CONTENTS="$APP/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

mkdir -p "$MACOS_DIR" "$RESOURCES"
cp -f "$SRC_TAURI/Info.dev.plist" "$CONTENTS/Info.plist"
if [[ -f "$SRC_TAURI/icons/icon.icns" ]]; then
  cp -f "$SRC_TAURI/icons/icon.icns" "$RESOURCES/icon.icns"
fi
cp -f "$BIN" "$MACOS_DIR/DockX"
chmod +x "$MACOS_DIR/DockX"

ENTITLEMENTS="$SRC_TAURI/Entitlements.plist"
if [[ -f "$ENTITLEMENTS" ]]; then
  codesign --force --sign - --entitlements "$ENTITLEMENTS" "$MACOS_DIR/DockX" >/dev/null
  codesign --force --sign - --entitlements "$ENTITLEMENTS" "$APP" >/dev/null
else
  codesign --force --sign - "$MACOS_DIR/DockX" >/dev/null
  codesign --force --sign - "$APP" >/dev/null
fi

exec "$MACOS_DIR/DockX" "$@"
