use active_win_pos_rs::get_active_window;
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundApp {
  pub app_name: String,
  pub process_name: String,
  pub window_title: String,
  pub url: Option<String>,
  pub host: Option<String>,
  pub excluded: bool,
  /// Screen lock / login window / screensaver
  pub locked: bool,
}

/// Never record TaskTrack itself (dev binary is often named "app").
fn is_excluded(app_name: &str, process_name: &str, window_title: &str, process_path: &Path) -> bool {
  let app = app_name.to_lowercase();
  let proc = process_name.to_lowercase();
  let title = window_title.to_lowercase();
  let path = process_path.to_string_lossy().to_lowercase();

  if app.contains("tasktrack")
    || proc.contains("tasktrack")
    || path.contains("tasktrack")
    || path.contains("com.tasktrack")
  {
    return true;
  }

  // Dev / debug Tauri: process "app", window title "TaskTrack"
  let generic_self = matches!(app.as_str(), "app" | "app_lib" | "tasktrack")
    || matches!(proc.as_str(), "app" | "app_lib");
  if generic_self && title.contains("tasktrack") {
    return true;
  }

  // Exact product window title on our binary
  if title == "tasktrack" && (generic_self || path.contains("/desktop/src-tauri/")) {
    return true;
  }

  false
}

fn is_lock_screen(app_name: &str, process_name: &str, window_title: &str) -> bool {
  let hay = format!("{} {} {}", app_name, process_name, window_title).to_lowercase();
  hay.contains("loginwindow")
    || hay.contains("screensaver")
    || hay.contains("screen saver")
    || hay.contains("lockscreen")
    || hay.contains("lock screen")
    || hay.contains("com.apple.loginwindow")
}

fn process_label(process_path: &Path) -> String {
  process_path
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or("unknown")
    .to_string()
}

fn host_from_url(url: &str) -> Option<String> {
  let trimmed = url.trim();
  if trimmed.is_empty() {
    return None;
  }
  if trimmed.starts_with("file:") {
    return None;
  }
  let without_scheme = trimmed
    .strip_prefix("https://")
    .or_else(|| trimmed.strip_prefix("http://"))
    .unwrap_or(trimmed);
  let mut host = without_scheme
    .split('/')
    .next()
    .unwrap_or("")
    .split('@')
    .next_back()
    .unwrap_or("")
    .trim()
    .to_lowercase();
  if let Some((h, port)) = host.rsplit_once(':') {
    if !port.is_empty() && port.chars().all(|c| c.is_ascii_digit()) {
      host = h.to_string();
    }
  }
  host = host.trim_start_matches("www.").to_string();
  host = host
    .trim_start_matches("m.")
    .trim_start_matches("mobile.")
    .to_string();
  if host.is_empty() || host == "localhost" || host.ends_with(".local") {
    return None;
  }
  Some(host)
}

fn url_from_title(title: &str) -> Option<String> {
  for part in title.split_whitespace() {
    let candidate = part.trim_matches(|c: char| {
      !c.is_ascii_alphanumeric()
        && c != ':'
        && c != '/'
        && c != '.'
        && c != '-'
        && c != '_'
        && c != '?'
        && c != '='
        && c != '&'
        && c != '%'
    });
    if candidate.starts_with("http://") || candidate.starts_with("https://") {
      return Some(candidate.to_string());
    }
    if candidate.starts_with("www.") && candidate.contains('.') {
      return Some(format!("https://{candidate}"));
    }
  }
  None
}

fn is_known_browser(app_name: &str, process_name: &str) -> bool {
  browser_applescript_name(app_name, process_name).is_some()
}

fn browser_applescript_name(app_name: &str, process_name: &str) -> Option<(&'static str, &'static str)> {
  let hay = format!("{} {}", app_name, process_name).to_lowercase();
  // (AppleScript / process name, family: chromium | safari | firefox)
  if hay.contains("firefox") || hay.contains("firefox developer") {
    return Some(("Firefox", "firefox"));
  }
  if hay.contains("google chrome")
    || (hay.contains("chrome") && !hay.contains("chromecast") && !hay.contains("chrome helper"))
  {
    if hay.contains("canary") {
      return Some(("Google Chrome Canary", "chromium"));
    }
    return Some(("Google Chrome", "chromium"));
  }
  if hay.contains("brave") {
    return Some(("Brave Browser", "chromium"));
  }
  if hay.contains("microsoft edge") || hay.contains("msedge") {
    return Some(("Microsoft Edge", "chromium"));
  }
  if hay.contains("arc") {
    return Some(("Arc", "chromium"));
  }
  if hay.contains("vivaldi") {
    return Some(("Vivaldi", "chromium"));
  }
  if hay.contains("opera") {
    return Some(("Opera", "chromium"));
  }
  if hay.contains("safari") && !hay.contains("safaridriver") {
    return Some(("Safari", "safari"));
  }
  if hay.contains("orion") {
    return Some(("Orion", "safari"));
  }
  None
}

#[cfg(target_os = "macos")]
fn fetch_browser_url(app_name: &str, process_name: &str) -> Option<String> {
  let (script_app, family) = browser_applescript_name(app_name, process_name)?;
  let script = match family {
    "safari" => format!(
      r#"tell application "{script_app}" to get URL of front document as string"#
    ),
    "firefox" => r#"
      tell application "System Events"
        if not (exists process "Firefox") then return ""
        tell process "Firefox"
          if (count of windows) is 0 then return ""
          set frontWin to front window
          try
            return value of UI element 1 of combo box 1 of toolbar 1 of frontWin
          on error
            try
              return value of text field 1 of toolbar 1 of frontWin
            on error
              try
                return value of text field 1 of group 1 of toolbar 1 of frontWin
              on error
                return ""
              end try
            end try
          end try
        end tell
      end tell
    "#
    .to_string(),
    _ => format!(
      r#"tell application "{script_app}" to get URL of active tab of front window as string"#
    ),
  };

  let output = Command::new("osascript")
    .arg("-e")
    .arg(&script)
    .output()
    .ok()?;

  if !output.status.success() {
    return None;
  }
  let mut url = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if url.is_empty() || url.eq_ignore_ascii_case("missing value") {
    return None;
  }
  // Firefox address bar may omit the scheme
  if !url.contains("://") && url.contains('.') && !url.contains(' ') {
    url = format!("https://{url}");
  }
  if !(url.starts_with("http://") || url.starts_with("https://")) {
    return None;
  }
  Some(url)
}

#[cfg(not(target_os = "macos"))]
fn fetch_browser_url(_app_name: &str, _process_name: &str) -> Option<String> {
  None
}

#[tauri::command]
pub fn get_foreground_app() -> Result<ForegroundApp, String> {
  match get_active_window() {
    Ok(window) => {
      let process_name = process_label(window.process_path.as_path());
      let app_name = if window.app_name.trim().is_empty() {
        process_name.clone()
      } else {
        window.app_name
      };
      let window_title = window.title;
      let excluded = is_excluded(
        &app_name,
        &process_name,
        &window_title,
        window.process_path.as_path(),
      );
      let locked = is_lock_screen(&app_name, &process_name, &window_title);

      let known_browser = is_known_browser(&app_name, &process_name);
      let mut url = if !excluded && !locked && known_browser {
        fetch_browser_url(&app_name, &process_name)
      } else {
        None
      };
      // Title scrape only for browsers — avoids fake site samples from IDE titles.
      if url.is_none() && known_browser {
        url = url_from_title(&window_title);
      }
      let host = url.as_deref().and_then(host_from_url);

      Ok(ForegroundApp {
        app_name,
        process_name,
        window_title,
        url,
        host,
        excluded,
        locked,
      })
    }
    Err(_) => Err(
      "Unable to read the active window. On macOS, grant Accessibility access to TaskTrack in System Settings → Privacy & Security → Accessibility."
        .into(),
    ),
  }
}

#[tauri::command]
pub fn tracking_available() -> bool {
  get_active_window().is_ok()
}
