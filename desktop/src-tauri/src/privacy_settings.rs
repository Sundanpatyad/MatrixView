use tauri::command;

/// Opens OS privacy settings for camera / microphone so the user can enable DockX.
#[command]
pub fn open_privacy_settings(kind: String) -> Result<(), String> {
  let kind = kind.to_lowercase();
  let want_camera = kind == "video" || kind == "camera";

  #[cfg(target_os = "macos")]
  {
    // Prefer modern System Settings deep links; fall back to legacy pane URLs.
    let urls: Vec<&str> = if want_camera {
      vec![
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Camera",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera",
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
      ]
    } else {
      vec![
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
      ]
    };

    for url in urls {
      let status = std::process::Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| e.to_string())?;
      if status.success() {
        return Ok(());
      }
    }
    // Last resort: open Privacy & Security root
    std::process::Command::new("open")
      .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension")
      .status()
      .map_err(|e| e.to_string())?;
    return Ok(());
  }

  #[cfg(target_os = "windows")]
  {
    let uri = if want_camera {
      "ms-settings:privacy-webcam"
    } else {
      "ms-settings:privacy-microphone"
    };
    std::process::Command::new("cmd")
      .args(["/C", "start", "", uri])
      .status()
      .map_err(|e| e.to_string())?;
    return Ok(());
  }

  #[cfg(target_os = "linux")]
  {
    // Best-effort: open common settings apps
    let candidates = [
      ("gnome-control-center", vec!["privacy"]),
      ("xdg-open", vec!["settings://privacy"]),
    ];
    for (bin, args) in candidates {
      if std::process::Command::new(bin).args(&args).status().map(|s| s.success()).unwrap_or(false) {
        return Ok(());
      }
    }
    return Err("Could not open privacy settings on this system".into());
  }

  #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
  {
    let _ = want_camera;
    Err("Opening privacy settings is not supported on this platform".into())
  }
}
