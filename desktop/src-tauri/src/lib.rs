mod activity;
mod db;
mod oauth_loopback;
mod privacy_settings;
mod screen_capture;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations(db::DB_URL, db::migrations())
        .build(),
    )
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .manage(oauth_loopback::OAuthLoopbackState::default())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Register deep link scheme in dev (production uses Info.plist / OS install).
      #[cfg(any(windows, target_os = "linux"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        let _ = app.deep_link().register_all();
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      activity::get_foreground_app,
      activity::tracking_available,
      screen_capture::list_capture_targets,
      screen_capture::capture_frame,
      privacy_settings::open_privacy_settings,
      oauth_loopback::google_oauth_loopback_start,
      oauth_loopback::google_oauth_loopback_wait,
      oauth_loopback::google_oauth_loopback_cancel
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
