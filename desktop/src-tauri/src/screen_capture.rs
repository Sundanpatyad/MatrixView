use image::{imageops::FilterType, DynamicImage, ImageFormat};
use serde::Serialize;
use std::io::Cursor;
use xcap::{Monitor, Window};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureTarget {
  pub id: u32,
  pub kind: String,
  pub name: String,
  pub width: u32,
  pub height: u32,
}

#[tauri::command]
pub fn list_capture_targets() -> Result<Vec<CaptureTarget>, String> {
  let mut out = Vec::new();

  for m in Monitor::all().map_err(|e| e.to_string())? {
    let id = m.id().map_err(|e| e.to_string())?;
    let name = m.name().unwrap_or_else(|_| format!("Display {id}"));
    out.push(CaptureTarget {
      id,
      kind: "monitor".into(),
      name: format!(
        "Screen · {}",
        if name.trim().is_empty() {
          format!("Display {id}")
        } else {
          name
        }
      ),
      width: m.width().unwrap_or(0),
      height: m.height().unwrap_or(0),
    });
  }

  for w in Window::all().map_err(|e| e.to_string())? {
    let width = w.width().unwrap_or(0);
    let height = w.height().unwrap_or(0);
    if width < 80 || height < 80 {
      continue;
    }
    let title = w.title().unwrap_or_default();
    if title.trim().is_empty() {
      continue;
    }
    // Sharing DockX itself causes a recursive “hall of mirrors” preview.
    let lower = title.to_lowercase();
    if lower == "dockx" || lower.starts_with("dockx ") || lower == "app" {
      continue;
    }
    let app = w.app_name().unwrap_or_default().to_lowercase();
    if app.contains("dockx") || app == "app" {
      continue;
    }
    out.push(CaptureTarget {
      id: w.id().map_err(|e| e.to_string())?,
      kind: "window".into(),
      name: title,
      width,
      height,
    });
  }

  Ok(out)
}

fn encode_jpeg(img: DynamicImage, max_w: u32) -> Result<Vec<u8>, String> {
  let img = if img.width() > max_w {
    let h = ((img.height() as f32) * (max_w as f32 / img.width() as f32)).round() as u32;
    img.resize(max_w, h.max(1), FilterType::Triangle)
  } else {
    img
  };

  let mut buf = Vec::new();
  let mut cursor = Cursor::new(&mut buf);
  img
    .write_to(&mut cursor, ImageFormat::Jpeg)
    .map_err(|e| e.to_string())?;
  Ok(buf)
}

#[tauri::command]
pub fn capture_frame(kind: String, id: u32) -> Result<Vec<u8>, String> {
  let rgba = match kind.as_str() {
    "monitor" => {
      let monitor = Monitor::all()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|m| m.id().ok() == Some(id))
        .ok_or_else(|| "Monitor not found".to_string())?;
      monitor.capture_image().map_err(|e| e.to_string())?
    }
    "window" => {
      let window = Window::all()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|w| w.id().ok() == Some(id))
        .ok_or_else(|| "Window not found".to_string())?;
      window.capture_image().map_err(|e| e.to_string())?
    }
    _ => return Err("Invalid capture kind".into()),
  };

  encode_jpeg(DynamicImage::ImageRgba8(rgba), 1600)
}
