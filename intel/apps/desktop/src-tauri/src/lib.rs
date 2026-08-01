pub mod credentials;

mod bootstrap;
mod manifest;
mod permissions;
mod supervisor;
mod updater;

use bootstrap::{trusted_dashboard_url, BootstrapToken, DashboardOutputParser};
use manifest::{verify_release_bundle, SealedBundle};
use permissions::prepare_private_dir;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use supervisor::ChildSupervisor;
use tauri::{Manager, Runtime};
use zeroize::Zeroize;

const BUILD_TARGET: &str = env!("AGENTINTEL_BUILD_TARGET");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut updater_plugin = tauri_plugin_updater::Builder::new();
    if let Some(public_key) = option_env!("AGENTINTEL_UPDATER_PUBLIC_KEY") {
        updater_plugin = updater_plugin.pubkey(public_key);
    }

    let app = tauri::Builder::default()
        .manage(ChildSupervisor::default())
        // The updater plugin is called only from Rust. The empty capability file
        // denies its invoke commands (and every other privileged command) to both
        // the packaged startup page and the localhost dashboard.
        .plugin(updater_plugin.build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = updater::check_and_install(&handle).await {
                    eprintln!("AGENTintel signed updater: {error}");
                }
                if let Err(error) = launch_verified_runtime(&handle) {
                    eprintln!("AGENTintel desktop launcher: {error}");
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.set_title("AGENTintel — Runtime unavailable");
                    }
                }
            });
            Ok(())
        })
        // Deliberately no JavaScript command dispatcher: shell, filesystem,
        // updater and credentials are not callable from the webview.
        .build(tauri::generate_context!())
        .expect("AGENTintel desktop shell failed to initialize");

    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            handle.state::<ChildSupervisor>().terminate();
        }
    });
}

fn launch_verified_runtime<R: Runtime>(handle: &tauri::AppHandle<R>) -> Result<(), String> {
    let resource_root = handle
        .path()
        .resource_dir()
        .map_err(|error| format!("resolve resource directory: {error}"))?
        .join("runtime");
    let sidecar_public_key = option_env!("AGENTINTEL_SIDECAR_PUBLIC_KEY")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "sidecar signature public key is not compiled into this build".to_string()
        })?;
    let verified = verify_release_bundle(&resource_root, BUILD_TARGET, sidecar_public_key)
        .map_err(|error| format!("verify signed runtime bundle: {error}"))?;

    let data_root = prepare_private_dir(
        &handle
            .path()
            .app_data_dir()
            .map_err(|error| format!("resolve private data directory: {error}"))?
            .join("desktop"),
    )
    .map_err(|error| format!("prepare private data directory: {error}"))?;
    let bundle = verified
        .seal_into(&data_root.join("runtime-snapshots"))
        .map_err(|error| format!("create sealed private runtime snapshot: {error}"))?;

    start_daemon(handle, bundle, data_root)
}

fn start_daemon<R: Runtime>(
    handle: &tauri::AppHandle<R>,
    bundle: SealedBundle,
    data_root: PathBuf,
) -> Result<(), String> {
    bundle
        .verify_for_launch()
        .map_err(|error| format!("revalidate sealed runtime before launch: {error}"))?;
    let token = BootstrapToken::generate();
    let mut command = Command::new(&bundle.daemon);
    command.current_dir(&data_root).args(daemon_arguments(
        &data_root,
        &bundle.python_worker_root,
        &bundle.python_command,
        &bundle.fixture,
        bundle.dashboard_root.as_deref(),
    ));

    let supervisor = handle.state::<ChildSupervisor>();
    let snapshot = bundle.into_snapshot();
    let (pid, mut stdout) = supervisor
        .spawn(&mut command, token.expose(), snapshot)
        .map_err(|error| format!("start signed Go daemon: {error}"))?;
    let thread_handle = handle.clone();
    std::thread::Builder::new()
        .name("agentintel-dashboard-bootstrap".to_string())
        .spawn(move || {
            let mut parser = DashboardOutputParser::default();
            let mut buffer = [0_u8; 8192];
            let mut dashboard_opened = false;
            let mut expected_token = Some(token);

            loop {
                let count = match stdout.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => count,
                    Err(error) => {
                        eprintln!("AGENTintel daemon stdout: {error}");
                        break;
                    }
                };
                if dashboard_opened {
                    continue;
                }
                for mut raw_url in parser.push(&buffer[..count]) {
                    let Some(token) = expected_token.as_ref() else {
                        raw_url.zeroize();
                        continue;
                    };
                    let Some(url) = trusted_dashboard_url(&raw_url, token.expose()) else {
                        raw_url.zeroize();
                        continue;
                    };
                    if let Some(window) = thread_handle.get_webview_window("main") {
                        if window.navigate(url).is_ok() {
                            let _ = window.set_title("AGENTintel");
                            let _ = window.set_focus();
                            dashboard_opened = true;
                            expected_token.take();
                        }
                    }
                    raw_url.zeroize();
                    if dashboard_opened {
                        break;
                    }
                }
            }
            buffer.zeroize();
            thread_handle.state::<ChildSupervisor>().reap_if_exited(pid);
            if !dashboard_opened {
                if let Some(window) = thread_handle.get_webview_window("main") {
                    let _ = window.set_title("AGENTintel — Local service unavailable");
                }
            }
        })
        .map_err(|error| format!("start dashboard bootstrap monitor: {error}"))?;
    Ok(())
}

fn daemon_arguments(
    data_root: &Path,
    python_worker_root: &Path,
    python_command: &Path,
    fixture: &Path,
    dashboard_root: Option<&Path>,
) -> Vec<OsString> {
    let mut arguments = vec![
        "serve".into(),
        "--listen".into(),
        "127.0.0.1:0".into(),
        "--data-dir".into(),
        data_root.as_os_str().to_owned(),
        "--python-worker".into(),
        python_worker_root.as_os_str().to_owned(),
        "--python-command".into(),
        python_command.as_os_str().to_owned(),
        "--fixture".into(),
        fixture.as_os_str().to_owned(),
        "--dashboard-bootstrap-token-stdin".into(),
    ];
    if let Some(dashboard_root) = dashboard_root {
        arguments.push("--dashboard-dir".into());
        arguments.push(dashboard_root.as_os_str().to_owned());
    }
    arguments
}

#[cfg(test)]
mod tests {
    use super::daemon_arguments;
    use std::path::Path;

    const TOKEN: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGH012345678";

    #[test]
    fn daemon_argv_never_contains_the_bootstrap_ticket() {
        let arguments = daemon_arguments(
            Path::new("/private/data"),
            Path::new("/snapshot/worker"),
            Path::new("/snapshot/python/bin/python3"),
            Path::new("/snapshot/fixture.ndjson"),
            Some(Path::new("/snapshot/dashboard")),
        );
        assert!(arguments.iter().all(|argument| argument != TOKEN));
        assert!(arguments
            .iter()
            .any(|argument| argument == "--dashboard-bootstrap-token-stdin"));
        assert!(!arguments
            .iter()
            .any(|argument| argument == "--dashboard-bootstrap-token"));
        assert!(arguments
            .iter()
            .any(|argument| argument == "--python-command"));
        assert!(!arguments.iter().any(|argument| argument == "--uv-command"));
    }
}
