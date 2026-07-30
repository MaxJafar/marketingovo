use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

const UPDATE_CHECK_TIMEOUT: Duration = Duration::from_secs(8);

pub fn should_check() -> bool {
    !cfg!(debug_assertions)
        && !std::env::args_os().any(|argument| argument == "--no-update")
        && !std::env::var("AGENTINTEL_AUTO_UPDATE")
            .ok()
            .is_some_and(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off" | "disabled"
                )
            })
}

pub async fn check_and_install(handle: &AppHandle) -> Result<(), String> {
    if !should_check() {
        return Ok(());
    }
    set_title(handle, "AGENTintel — Checking signed updates");
    let updater = handle
        .updater_builder()
        .timeout(UPDATE_CHECK_TIMEOUT)
        .build()
        .map_err(|error| format!("initialize signed updater: {error}"))?;
    let Some(update) = updater
        .check()
        .await
        .map_err(|error| format!("check signed updater channel: {error}"))?
    else {
        return Ok(());
    };

    set_title(handle, "AGENTintel — Installing signed update");
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| format!("verify or install signed update: {error}"))?;
    handle.restart();
}

fn set_title(handle: &AppHandle, title: &str) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.set_title(title);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn updater_is_never_implicitly_enabled_in_debug_tests() {
        assert!(!super::should_check());
    }
}
