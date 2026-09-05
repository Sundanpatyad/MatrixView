use serde::Serialize;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DockX</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e8ecf4;
  display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{text-align:center;padding:2rem}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{color:#9aa3b5;margin:0}
</style></head>
<body><div class="card">
  <h1>Signed in to DockX</h1>
  <p>You can close this tab and return to the app.</p>
</div></body></html>"#;

const ERROR_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DockX</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e8ecf4;
  display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{text-align:center;padding:2rem}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{color:#9aa3b5;margin:0}
</style></head>
<body><div class="card">
  <h1>Google sign-in failed</h1>
  <p>Close this tab and try again in DockX.</p>
</div></body></html>"#;

pub struct OAuthLoopbackState {
  listener: Mutex<Option<TcpListener>>,
  redirect_uri: Mutex<Option<String>>,
}

impl Default for OAuthLoopbackState {
  fn default() -> Self {
    Self {
      listener: Mutex::new(None),
      redirect_uri: Mutex::new(None),
    }
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackStart {
  pub redirect_uri: String,
  pub port: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackResult {
  pub code: Option<String>,
  pub error: Option<String>,
}

fn parse_query(target: &str) -> (Option<String>, Option<String>) {
  let path_query = target.split_whitespace().nth(1).unwrap_or("/");
  let query = path_query.split('?').nth(1).unwrap_or("");
  let mut code = None;
  let mut error = None;
  for pair in query.split('&') {
    let mut parts = pair.splitn(2, '=');
    let key = parts.next().unwrap_or("");
    let value = parts.next().unwrap_or("");
    let decoded = urlencoding_decode(value);
    match key {
      "code" => code = Some(decoded),
      "error" => error = Some(decoded),
      _ => {}
    }
  }
  (code, error)
}

fn urlencoding_decode(value: &str) -> String {
  let bytes = value.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    match bytes[i] {
      b'+' => {
        out.push(b' ');
        i += 1;
      }
      b'%' if i + 2 < bytes.len() => {
        let hex = &value[i + 1..i + 3];
        if let Ok(b) = u8::from_str_radix(hex, 16) {
          out.push(b);
          i += 3;
        } else {
          out.push(bytes[i]);
          i += 1;
        }
      }
      b => {
        out.push(b);
        i += 1;
      }
    }
  }
  String::from_utf8_lossy(&out).into_owned()
}

fn write_response(stream: &mut std::net::TcpStream, ok: bool) {
  let body = if ok { SUCCESS_HTML } else { ERROR_HTML };
  let response = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
    body.len(),
    body
  );
  let _ = stream.write_all(response.as_bytes());
  let _ = stream.flush();
}

fn is_callback_request(first_line: &str) -> bool {
  let upper = first_line.to_ascii_uppercase();
  if upper.starts_with("OPTIONS ") || upper.starts_with("HEAD ") {
    return false;
  }
  first_line.contains("code=") || first_line.contains("error=")
}

fn wait_for_callback(listener: TcpListener, timeout_ms: u64) -> Result<LoopbackResult, String> {
  let deadline = Instant::now() + Duration::from_millis(timeout_ms.max(5_000));
  loop {
    if Instant::now() >= deadline {
      return Err("Google sign-in timed out. Try again.".into());
    }

    match listener.accept() {
      Ok((mut stream, _)) => {
        let mut buf = [0u8; 8192];
        let _ = stream.set_nonblocking(false);
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let n = stream.read(&mut buf).unwrap_or(0);
        let req = String::from_utf8_lossy(&buf[..n]);
        let first_line = req.lines().next().unwrap_or("");
        // Chrome may probe 127.0.0.1 (OPTIONS / empty connect / favicon) before
        // the real OAuth redirect. Keep listening until we see code or error.
        if !is_callback_request(first_line) {
          write_response(&mut stream, true);
          continue;
        }
        let (code, error) = parse_query(first_line);
        let ok = code.is_some() && error.is_none();
        write_response(&mut stream, ok);
        return Ok(LoopbackResult { code, error });
      }
      Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
        std::thread::sleep(Duration::from_millis(50));
      }
      Err(e) => return Err(format!("loopback accept failed: {e}")),
    }
  }
}

#[tauri::command]
pub fn google_oauth_loopback_start(state: State<'_, OAuthLoopbackState>) -> Result<LoopbackStart, String> {
  {
    let mut slot = state.listener.lock().map_err(|e| e.to_string())?;
    *slot = None;
  }
  {
    let mut uri = state.redirect_uri.lock().map_err(|e| e.to_string())?;
    *uri = None;
  }

  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("loopback bind failed: {e}"))?;
  listener
    .set_nonblocking(true)
    .map_err(|e| format!("loopback nonblocking failed: {e}"))?;
  let port = listener
    .local_addr()
    .map_err(|e| format!("loopback addr failed: {e}"))?
    .port();
  let redirect_uri = format!("http://127.0.0.1:{port}/");

  *state.listener.lock().map_err(|e| e.to_string())? = Some(listener);
  *state.redirect_uri.lock().map_err(|e| e.to_string())? = Some(redirect_uri.clone());

  Ok(LoopbackStart {
    redirect_uri,
    port,
  })
}

#[tauri::command]
pub async fn google_oauth_loopback_wait(
  state: State<'_, OAuthLoopbackState>,
  timeout_ms: u64,
) -> Result<LoopbackResult, String> {
  let listener = {
    let mut slot = state.listener.lock().map_err(|e| e.to_string())?;
    slot
      .take()
      .ok_or_else(|| "Google loopback listener is not running".to_string())?
  };

  let result = tauri::async_runtime::spawn_blocking(move || wait_for_callback(listener, timeout_ms))
    .await
    .map_err(|e| format!("loopback wait failed: {e}"))?;

  {
    let mut uri = state.redirect_uri.lock().map_err(|e| e.to_string())?;
    *uri = None;
  }

  result
}

#[tauri::command]
pub fn google_oauth_loopback_cancel(state: State<'_, OAuthLoopbackState>) -> Result<(), String> {
  let mut slot = state.listener.lock().map_err(|e| e.to_string())?;
  *slot = None;
  let mut uri = state.redirect_uri.lock().map_err(|e| e.to_string())?;
  *uri = None;
  Ok(())
}
