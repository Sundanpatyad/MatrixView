fn main() {
  println!("cargo:rerun-if-changed=icons/icon.png");
  println!("cargo:rerun-if-changed=icons/icon.icns");
  println!("cargo:rerun-if-changed=icons/32x32.png");
  println!("cargo:rerun-if-changed=icons/128x128.png");
  println!("cargo:rerun-if-changed=icons/128x128@2x.png");
  embed_macos_info_plist();
  tauri_build::build()
}

/// Embed Info.plist in the debug/release binary so macOS can show the native
/// Allow / Don't Allow camera-mic dialog even when `tauri dev` runs a raw
/// executable instead of DockX.app.
fn embed_macos_info_plist() {
  if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
    return;
  }
  println!("cargo:rerun-if-changed=Info.plist");
  let src = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("Info.plist");
  // Volume paths may contain spaces; ld -Wl comma-splitting breaks on those.
  let dest = std::env::temp_dir().join("dockx-com.dockx.desktop-Info.plist");
  std::fs::copy(&src, &dest).unwrap_or_else(|e| panic!("copy Info.plist for embed: {e}"));
  println!(
    "cargo:rustc-link-arg-bins=-Wl,-sectcreate,__TEXT,__info_plist,{}",
    dest.display()
  );
}
