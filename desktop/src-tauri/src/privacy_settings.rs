use tauri::{command, AppHandle};

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

/// Current macOS TCC status for camera and/or microphone.
/// Returns `authorized`, `denied`, `restricted`, `notDetermined`, or `unsupported`.
#[command]
pub fn os_media_permission_status(kind: String) -> String {
  #[cfg(target_os = "macos")]
  {
    macos::combined_status(&kind)
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = kind;
    "unsupported".into()
  }
}

/// Ask macOS for camera/mic access on the main thread so the native
/// Allow / Don't Allow alert can appear (same as iOS).
#[command]
pub async fn request_os_media_access(app: AppHandle, kind: String) -> Result<String, String> {
  #[cfg(target_os = "macos")]
  {
    macos::request(app, &kind).await
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = (app, kind);
    Ok("unsupported".into())
  }
}

#[cfg(target_os = "macos")]
mod macos {
  use block2::RcBlock;
  use objc2::runtime::Bool;
  use objc2_av_foundation::{
    AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio, AVMediaTypeVideo,
  };
  use std::sync::{mpsc, Mutex};
  use std::time::Duration;
  use tauri::AppHandle;

  fn wants_camera(kind: &str) -> bool {
    let k = kind.to_lowercase();
    k == "video" || k == "camera"
  }

  fn status_label(status: AVAuthorizationStatus) -> &'static str {
    match status {
      AVAuthorizationStatus::Authorized => "authorized",
      AVAuthorizationStatus::Denied => "denied",
      AVAuthorizationStatus::Restricted => "restricted",
      _ => "notDetermined",
    }
  }

  fn media_audio() -> &'static objc2_av_foundation::AVMediaType {
    unsafe { AVMediaTypeAudio }.expect("AVMediaTypeAudio")
  }

  fn media_video() -> &'static objc2_av_foundation::AVMediaType {
    unsafe { AVMediaTypeVideo }.expect("AVMediaTypeVideo")
  }

  fn read_status(media_type: &objc2_av_foundation::AVMediaType) -> AVAuthorizationStatus {
    unsafe { AVCaptureDevice::authorizationStatusForMediaType(media_type) }
  }

  pub fn combined_status(kind: &str) -> String {
    let mic = read_status(media_audio());
    if !wants_camera(kind) {
      return status_label(mic).into();
    }
    let cam = read_status(media_video());
    if cam == AVAuthorizationStatus::Denied || mic == AVAuthorizationStatus::Denied {
      return "denied".into();
    }
    if cam == AVAuthorizationStatus::Restricted || mic == AVAuthorizationStatus::Restricted {
      return "restricted".into();
    }
    if cam == AVAuthorizationStatus::Authorized && mic == AVAuthorizationStatus::Authorized {
      return "authorized".into();
    }
    "notDetermined".into()
  }

  /// Must run on the main thread — otherwise macOS never shows the system alert.
  async fn request_type(app: AppHandle, video: bool) -> Result<String, String> {
    let (tx, rx) = mpsc::channel::<String>();
    app
      .run_on_main_thread(move || {
        let media_type = if video { media_video() } else { media_audio() };
        let current = read_status(media_type);
        if current == AVAuthorizationStatus::Authorized
          || current == AVAuthorizationStatus::Denied
          || current == AVAuthorizationStatus::Restricted
        {
          let _ = tx.send(status_label(current).to_string());
          return;
        }

        let tx = Mutex::new(Some(tx));
        let handler = RcBlock::new(move |granted: Bool| {
          if let Some(sender) = tx.lock().ok().and_then(|mut g| g.take()) {
            let _ = sender.send(if granted.as_bool() {
              "authorized".into()
            } else {
              "denied".into()
            });
          }
        });
        unsafe {
          AVCaptureDevice::requestAccessForMediaType_completionHandler(media_type, &*handler);
        }
        // Apple copies the block; keep ours until the copy is retained.
        std::mem::forget(handler);
      })
      .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
      rx.recv_timeout(Duration::from_secs(120))
        .map_err(|_| "Timed out waiting for camera/microphone permission".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
  }

  pub async fn request(app: AppHandle, kind: &str) -> Result<String, String> {
    let mic = request_type(app.clone(), false).await?;
    if !wants_camera(kind) {
      return Ok(mic);
    }
    let cam = request_type(app, true).await?;
    if cam == "denied" || mic == "denied" {
      return Ok("denied".into());
    }
    if cam == "restricted" || mic == "restricted" {
      return Ok("restricted".into());
    }
    if cam == "authorized" && mic == "authorized" {
      return Ok("authorized".into());
    }
    Ok("notDetermined".into())
  }
}
