use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const MAX_PENDING_OUTPUT_BYTES: usize = 64 * 1024;
const UPDATE_CHECK_TIMEOUT: Duration = Duration::from_secs(8);
const UPDATE_PROGRESS_STEP_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Default)]
struct OwnedRuntimeChildren(Mutex<HashMap<u32, CommandChild>>);

impl OwnedRuntimeChildren {
    fn insert(&self, child: CommandChild) -> u32 {
        let pid = child.pid();
        self.0
            .lock()
            .expect("runtime child lock poisoned")
            .insert(pid, child);
        pid
    }

    fn remove_terminated(&self, pid: u32) {
        self.0
            .lock()
            .expect("runtime child lock poisoned")
            .remove(&pid);
    }

    fn kill_all(&self) {
        let children = self
            .0
            .lock()
            .expect("runtime child lock poisoned")
            .drain()
            .map(|(_, child)| child)
            .collect::<Vec<_>>();
        for child in children {
            let _ = child.kill();
        }
    }
}

#[derive(Clone)]
struct DesktopRuntimeLaunch {
    entry: PathBuf,
    data_dir: PathBuf,
    broker: PathBuf,
    public_config: PublicRuntimeConfig,
}

#[derive(Default)]
struct DesktopRuntimeState(Mutex<Option<DesktopRuntimeLaunch>>);

impl DesktopRuntimeState {
    fn set(&self, launch: DesktopRuntimeLaunch) {
        *self.0.lock().expect("desktop runtime state lock poisoned") = Some(launch);
    }

    fn get(&self) -> Option<DesktopRuntimeLaunch> {
        self.0
            .lock()
            .expect("desktop runtime state lock poisoned")
            .clone()
    }
}

#[derive(Default)]
struct PendingForegroundActivation(AtomicBool);

#[derive(Default)]
struct DashboardReady(AtomicBool);

#[derive(Default)]
struct DashboardLaunchInFlight(AtomicBool);

#[derive(Default)]
struct RuntimeStartupInFlight(AtomicBool);

#[derive(Default)]
struct DashboardOutputParser {
    pending: Vec<u8>,
}

impl DashboardOutputParser {
    fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        self.pending.extend_from_slice(bytes);
        let mut dashboard_urls = Vec::new();
        while let Some(newline) = self.pending.iter().position(|byte| *byte == b'\n') {
            let mut line = self.pending.drain(..=newline).collect::<Vec<_>>();
            while matches!(line.last(), Some(b'\n' | b'\r')) {
                line.pop();
            }
            let text = String::from_utf8_lossy(&line);
            if let Some(raw_url) = text.trim().strip_prefix("Dashboard: ") {
                dashboard_urls.push(raw_url.trim().to_string());
            }
        }
        if self.pending.len() > MAX_PENDING_OUTPUT_BYTES {
            self.pending.clear();
        }
        dashboard_urls
    }
}

fn trusted_dashboard_url(raw_url: &str) -> Option<Url> {
    let url = Url::parse(raw_url).ok()?;
    let token = url.fragment()?.strip_prefix("token=")?;
    let port = url.port_or_known_default()?;
    let token_is_valid = token.len() >= 32
        && token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'));
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || !(1024..=65535).contains(&port)
        || url.path() != "/"
        || url.query().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || !token_is_valid
    {
        return None;
    }
    Some(url)
}

fn runtime_entry(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    Ok(app
        .path()
        .resource_dir()?
        .join("runtime")
        .join("app")
        .join("dist")
        .join("cli.js"))
}

fn broker_entry(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let name = if cfg!(target_os = "windows") {
        "agentseo-credential-broker.exe"
    } else {
        "agentseo-credential-broker"
    };
    Ok(app
        .path()
        .resource_dir()?
        .join("runtime")
        .join("broker")
        .join(name))
}

#[derive(Clone)]
struct PublicRuntimeConfig {
    chromium_executable: PathBuf,
    browser_directory: PathBuf,
    google_desktop_client_id: String,
}

fn safe_relative_resource(root: &Path, raw: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let relative = Path::new(raw);
    if raw.is_empty()
        || relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("invalid desktop runtime resource path: {raw}").into());
    }
    Ok(root.join(relative))
}

fn valid_google_desktop_client_id(value: &str) -> bool {
    value.len() <= 255
        && value.ends_with(".apps.googleusercontent.com")
        && !value.contains("..")
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.'))
}

fn public_runtime_config(
    app: &tauri::App,
) -> Result<PublicRuntimeConfig, Box<dyn std::error::Error>> {
    let runtime_root = app.path().resource_dir()?.join("runtime");
    let config_path = runtime_root.join("config").join("public-runtime.json");
    let source = std::fs::read_to_string(&config_path)?;
    let config: serde_json::Value = serde_json::from_str(&source)?;
    if config.get("schemaVersion").and_then(|value| value.as_u64()) != Some(1) {
        return Err("unsupported desktop public runtime configuration".into());
    }
    let chromium_relative = config
        .get("chromiumExecutable")
        .and_then(|value| value.as_str())
        .ok_or("desktop Chromium executable is not configured")?;
    let browser_relative = config
        .get("browserDirectory")
        .and_then(|value| value.as_str())
        .ok_or("desktop browser directory is not configured")?;
    let google_desktop_client_id = config
        .get("googleDesktopClientId")
        .and_then(|value| value.as_str())
        .filter(|value| valid_google_desktop_client_id(value))
        .ok_or("Google Desktop OAuth client ID is not configured")?
        .to_string();
    let chromium_executable = safe_relative_resource(&runtime_root, chromium_relative)?;
    let browser_directory = safe_relative_resource(&runtime_root, browser_relative)?;
    if !chromium_executable.is_file() {
        return Err("bundled Chromium executable is missing".into());
    }
    if !browser_directory.is_dir() {
        return Err("bundled Chromium directory is missing".into());
    }
    Ok(PublicRuntimeConfig {
        chromium_executable,
        browser_directory,
        google_desktop_client_id,
    })
}

fn desktop_daemon_args(
    entry: &Path,
    data_dir: &Path,
    broker: &Path,
    public_config: &PublicRuntimeConfig,
) -> Vec<String> {
    vec![
        entry.to_string_lossy().into_owned(),
        "serve".to_string(),
        "--data-dir".to_string(),
        data_dir.to_string_lossy().into_owned(),
        "--credential-broker".to_string(),
        broker.to_string_lossy().into_owned(),
        "--chromium-executable".to_string(),
        public_config
            .chromium_executable
            .to_string_lossy()
            .into_owned(),
        "--browser-directory".to_string(),
        public_config
            .browser_directory
            .to_string_lossy()
            .into_owned(),
        "--google-desktop-client-id".to_string(),
        public_config.google_desktop_client_id.clone(),
    ]
}

fn requested_background_mode() -> bool {
    std::env::args_os().any(|argument| argument == "--background")
}

fn updates_disabled_by_setting(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "no" | "off" | "disabled"
        )
    })
}

fn should_check_for_updates(
    debug_build: bool,
    arguments: &[std::ffi::OsString],
    setting: Option<&str>,
) -> bool {
    !debug_build
        && !arguments.iter().any(|argument| argument == "--no-update")
        && !updates_disabled_by_setting(setting)
}

fn should_open_dashboard(background_mode: bool, window_opened: bool) -> bool {
    !background_mode && !window_opened
}

fn set_startup_status(handle: &tauri::AppHandle, message: &str, title: &str) {
    let Some(window) = handle.get_webview_window("main") else {
        return;
    };
    let Ok(message) = serde_json::to_string(message) else {
        return;
    };
    let _ = window.eval(format!(
        "const status = document.getElementById('startup-status'); if (status) status.textContent = {message};"
    ));
    let _ = window.set_title(title);
}

fn ensure_startup_window(handle: &tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(false);
    }
    WebviewWindowBuilder::new(handle, "main", WebviewUrl::App("index.html".into()))
        .title("AGENTseo — Starting")
        .inner_size(1440.0, 920.0)
        .min_inner_size(1024.0, 700.0)
        .build()
        .map_err(|error| format!("could not open the startup window: {error}"))?;
    handle
        .state::<DashboardReady>()
        .0
        .store(false, Ordering::Release);
    Ok(true)
}

fn foreground_launch_requested(arguments: &[String]) -> bool {
    !arguments.iter().any(|argument| argument == "--background")
}

fn activate_existing_instance(handle: &tauri::AppHandle, arguments: &[String]) {
    if !foreground_launch_requested(arguments) {
        return;
    }
    handle
        .state::<PendingForegroundActivation>()
        .0
        .store(true, Ordering::Release);
    let created = match ensure_startup_window(handle) {
        Ok(created) => created,
        Err(error) => {
            eprintln!("AGENTseo launcher: {error}");
            return;
        }
    };
    if !created && handle.state::<DashboardReady>().0.load(Ordering::Acquire) {
        handle
            .state::<PendingForegroundActivation>()
            .0
            .store(false, Ordering::Release);
        return;
    }
    if handle
        .state::<RuntimeStartupInFlight>()
        .0
        .load(Ordering::Acquire)
    {
        set_startup_status(
            handle,
            "The existing instance is finishing its signed update check and local startup…",
            "AGENTseo — Starting",
        );
        return;
    }
    let Some(launch) = handle.state::<DesktopRuntimeState>().get() else {
        set_startup_status(
            handle,
            "The existing instance is still preparing the local runtime…",
            "AGENTseo — Starting",
        );
        return;
    };
    if handle
        .state::<DashboardLaunchInFlight>()
        .0
        .swap(true, Ordering::AcqRel)
    {
        return;
    }
    handle
        .state::<PendingForegroundActivation>()
        .0
        .store(false, Ordering::Release);
    let activation_handle = handle.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_packaged_daemon(
            activation_handle.clone(),
            true,
            launch.entry,
            launch.data_dir,
            launch.broker,
            launch.public_config,
        )
        .await
        {
            eprintln!("AGENTseo launcher: {error}");
            set_startup_status(
                &activation_handle,
                "The existing local service could not issue a new dashboard session. Run `agentseo doctor` for diagnostics.",
                "AGENTseo — Local service unavailable",
            );
            activation_handle
                .state::<DashboardLaunchInFlight>()
                .0
                .store(false, Ordering::Release);
        }
    });
}

async fn check_and_install_signed_update(handle: &tauri::AppHandle) -> Result<(), String> {
    set_startup_status(
        handle,
        "Checking the signed release channel…",
        "AGENTseo — Checking for updates",
    );
    let updater = handle
        .updater_builder()
        .timeout(UPDATE_CHECK_TIMEOUT)
        .build()
        .map_err(|error| format!("could not initialize the signed updater: {error}"))?;
    let Some(update) = updater
        .check()
        .await
        .map_err(|error| format!("signed update check failed: {error}"))?
    else {
        set_startup_status(
            handle,
            "AGENTseo is up to date. Starting the local service…",
            "AGENTseo",
        );
        return Ok(());
    };

    let version = update.version.clone();
    set_startup_status(
        handle,
        &format!("Downloading signed AGENTseo {version}…"),
        "AGENTseo — Installing update",
    );
    let progress_handle = handle.clone();
    let finished_handle = handle.clone();
    let progress_version = version.clone();
    let mut downloaded = 0_u64;
    let mut next_status_at = UPDATE_PROGRESS_STEP_BYTES;
    update
        .download_and_install(
            move |chunk_size, total| {
                downloaded = downloaded.saturating_add(chunk_size as u64);
                if downloaded < next_status_at {
                    return;
                }
                next_status_at = downloaded.saturating_add(UPDATE_PROGRESS_STEP_BYTES);
                let progress = total
                    .filter(|total| *total > 0)
                    .map(|total| {
                        format!(
                            "Downloading signed AGENTseo {progress_version}… {}%",
                            downloaded.saturating_mul(100) / total
                        )
                    })
                    .unwrap_or_else(|| {
                        format!(
                            "Downloading signed AGENTseo {progress_version}… {} MiB",
                            downloaded / (1024 * 1024)
                        )
                    });
                set_startup_status(&progress_handle, &progress, "AGENTseo — Installing update");
            },
            move || {
                set_startup_status(
                    &finished_handle,
                    "Download complete. Verifying the release signature…",
                    "AGENTseo — Verifying update",
                );
            },
        )
        .await
        .map_err(|error| format!("signed update installation failed: {error}"))?;

    set_startup_status(
        handle,
        &format!("AGENTseo {version} is installed. Restarting…"),
        "AGENTseo — Restarting",
    );
    handle.restart();
}

async fn run_packaged_daemon(
    handle: tauri::AppHandle,
    open_dashboard: bool,
    entry: PathBuf,
    data_dir: PathBuf,
    broker: PathBuf,
    public_config: PublicRuntimeConfig,
) -> Result<(), String> {
    let args = desktop_daemon_args(&entry, &data_dir, &broker, &public_config);
    let command = handle
        .shell()
        .sidecar("golem-seo-node")
        .map_err(|error| format!("could not initialize the packaged runtime: {error}"))?
        .args(args)
        .env("GOLEM_SEO_CREDENTIAL_BROKER", &broker)
        .env("GOLEMSEO_CHROME_PATH", &public_config.chromium_executable)
        .env("PLAYWRIGHT_BROWSERS_PATH", &public_config.browser_directory)
        .env("PLAYWRIGHT_SKIP_BROWSER_GC", "1")
        .env(
            "GOLEMSEO_GOOGLE_DESKTOP_CLIENT_ID",
            &public_config.google_desktop_client_id,
        );
    let (mut receiver, child) = command
        .spawn()
        .map_err(|error| format!("could not start the packaged runtime: {error}"))?;
    let child_pid = handle.state::<OwnedRuntimeChildren>().insert(child);
    let mut parser = DashboardOutputParser::default();
    let mut window_opened = false;
    while let Some(event) = receiver.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                for raw_url in parser.push(&bytes) {
                    if !should_open_dashboard(!open_dashboard, window_opened) {
                        continue;
                    }
                    let Some(url) = trusted_dashboard_url(&raw_url) else {
                        continue;
                    };
                    let opened = if let Some(window) = handle.get_webview_window("main") {
                        window.navigate(url).is_ok()
                    } else {
                        WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url))
                            .title("AGENTseo")
                            .inner_size(1440.0, 920.0)
                            .min_inner_size(1024.0, 700.0)
                            .build()
                            .is_ok()
                    };
                    if opened {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.set_title("AGENTseo");
                        }
                        handle
                            .state::<DashboardReady>()
                            .0
                            .store(true, Ordering::Release);
                        handle
                            .state::<DashboardLaunchInFlight>()
                            .0
                            .store(false, Ordering::Release);
                        window_opened = true;
                    }
                }
            }
            CommandEvent::Terminated(_) => {
                handle
                    .state::<OwnedRuntimeChildren>()
                    .remove_terminated(child_pid);
                break;
            }
            _ => {}
        }
    }
    handle
        .state::<OwnedRuntimeChildren>()
        .remove_terminated(child_pid);
    if open_dashboard {
        handle
            .state::<DashboardLaunchInFlight>()
            .0
            .store(false, Ordering::Release);
    }
    if open_dashboard && !window_opened {
        handle
            .state::<DashboardReady>()
            .0
            .store(false, Ordering::Release);
        set_startup_status(
            &handle,
            "The local service stopped before the dashboard became ready. Run `agentseo doctor` for diagnostics.",
            "AGENTseo — Local service unavailable",
        );
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(OwnedRuntimeChildren::default())
        .manage(DesktopRuntimeState::default())
        .manage(PendingForegroundActivation::default())
        .manage(DashboardReady::default())
        .manage(DashboardLaunchInFlight::default())
        .manage(RuntimeStartupInFlight::default())
        .plugin(tauri_plugin_single_instance::init(
            |handle, arguments, _working_directory| {
                activate_existing_instance(handle, &arguments);
            },
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let background_mode = requested_background_mode();
            let arguments = std::env::args_os().collect::<Vec<_>>();
            let update_setting = std::env::var("GOLEMSEO_AUTO_UPDATE").ok();
            let check_updates = should_check_for_updates(
                cfg!(debug_assertions),
                &arguments,
                update_setting.as_deref(),
            );
            let entry = runtime_entry(app)?;
            let broker = broker_entry(app)?;
            let public_config = public_runtime_config(app)?;
            if !entry.is_file() {
                return Err("bundled AGENTseo runtime is missing".into());
            }
            if !broker.is_file() {
                return Err("bundled native credential broker is missing".into());
            }
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let launch = DesktopRuntimeLaunch {
                entry,
                data_dir,
                broker,
                public_config,
            };
            app.state::<DesktopRuntimeState>().set(launch.clone());
            app.state::<RuntimeStartupInFlight>()
                .0
                .store(true, Ordering::Release);
            if !background_mode {
                if let Err(error) = ensure_startup_window(app.handle()) {
                    return Err(error.into());
                }
            }
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if check_updates {
                    if let Err(error) = check_and_install_signed_update(&handle).await {
                        eprintln!("AGENTseo updater: {error}");
                        set_startup_status(
                            &handle,
                            "The signed update channel is unavailable. Starting the installed version…",
                            "AGENTseo",
                        );
                    }
                }
                let open_dashboard = !background_mode
                    || handle
                        .state::<PendingForegroundActivation>()
                        .0
                        .swap(false, Ordering::AcqRel);
                if open_dashboard {
                    if let Err(error) = ensure_startup_window(&handle) {
                        eprintln!("AGENTseo launcher: {error}");
                    }
                    handle
                        .state::<DashboardLaunchInFlight>()
                        .0
                        .store(true, Ordering::Release);
                }
                handle
                    .state::<RuntimeStartupInFlight>()
                    .0
                    .store(false, Ordering::Release);
                if let Err(error) = run_packaged_daemon(
                    handle.clone(),
                    open_dashboard,
                    launch.entry,
                    launch.data_dir,
                    launch.broker,
                    launch.public_config,
                )
                .await
                {
                    handle
                        .state::<DashboardLaunchInFlight>()
                        .0
                        .store(false, Ordering::Release);
                    eprintln!("AGENTseo launcher: {error}");
                    set_startup_status(
                        &handle,
                        "The packaged local service could not start. Run `agentseo doctor` for diagnostics.",
                        "AGENTseo — Local service unavailable",
                    );
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("AGENTseo desktop runtime failed");
    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            handle.state::<OwnedRuntimeChildren>().kill_all();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        desktop_daemon_args, foreground_launch_requested, safe_relative_resource,
        should_check_for_updates, should_open_dashboard, trusted_dashboard_url,
        valid_google_desktop_client_id, DashboardOutputParser, PublicRuntimeConfig,
    };
    use std::ffi::OsString;
    use std::path::{Path, PathBuf};

    const TOKEN: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGH012345678";

    #[test]
    fn parses_a_dashboard_line_split_across_stdout_chunks() {
        let mut parser = DashboardOutputParser::default();
        assert!(parser.push(b"AGENTseo\nDash").is_empty());
        assert_eq!(
            parser.push(
                format!("board: http://127.0.0.1:3210/#token={TOKEN}\r\nAPI: local\n").as_bytes()
            ),
            vec![format!("http://127.0.0.1:3210/#token={TOKEN}")]
        );
    }

    #[test]
    fn parses_multiple_complete_lines_without_losing_the_trailing_partial_line() {
        let mut parser = DashboardOutputParser::default();
        let first = format!("http://127.0.0.1:3210/#token={TOKEN}");
        let second_token = "Z".repeat(43);
        let second = format!("http://127.0.0.1:3210/#token={second_token}");
        assert_eq!(
            parser.push(format!("Dashboard: {first}\nnoise\nDashboard: {second}\nDash").as_bytes()),
            vec![first, second]
        );
        assert_eq!(
            parser.push(format!("board: http://127.0.0.1:3210/#token={TOKEN}\n").as_bytes()),
            vec![format!("http://127.0.0.1:3210/#token={TOKEN}")]
        );
    }

    #[test]
    fn accepts_only_the_loopback_dashboard_with_a_bootstrap_fragment() {
        assert!(trusted_dashboard_url(&format!("http://127.0.0.1:3210/#token={TOKEN}")).is_some());
        assert!(trusted_dashboard_url(&format!("http://127.0.0.1:4321/#token={TOKEN}")).is_some());
        assert!(trusted_dashboard_url(&format!("https://example.com/#token={TOKEN}")).is_none());
        assert!(trusted_dashboard_url("http://127.0.0.1:3210/").is_none());
        assert!(trusted_dashboard_url(&format!("http://127.0.0.1:80/#token={TOKEN}")).is_none());
    }

    #[test]
    fn accepts_only_safe_public_runtime_configuration_values() {
        assert!(valid_google_desktop_client_id(
            "123-public.apps.googleusercontent.com"
        ));
        assert!(!valid_google_desktop_client_id("example.com"));
        assert!(safe_relative_resource(Path::new("/runtime"), "browser/chrome").is_ok());
        assert!(safe_relative_resource(Path::new("/runtime"), "../outside").is_err());
        assert!(safe_relative_resource(Path::new("/runtime"), "/outside").is_err());
    }

    #[test]
    fn passes_every_packaged_runtime_input_to_the_daemon_without_a_secret() {
        let config = PublicRuntimeConfig {
            chromium_executable: PathBuf::from("/runtime/browser/chrome"),
            browser_directory: PathBuf::from("/runtime/browser"),
            google_desktop_client_id: "public.apps.googleusercontent.com".to_string(),
        };
        let args = desktop_daemon_args(
            Path::new("/runtime/app/dist/cli.js"),
            Path::new("/user/data"),
            Path::new("/runtime/broker/agentseo-credential-broker"),
            &config,
        );

        assert_eq!(args[1], "serve");
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--data-dir", "/user/data"]));
        assert!(args.windows(2).any(|pair| pair
            == [
                "--credential-broker",
                "/runtime/broker/agentseo-credential-broker"
            ]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--chromium-executable", "/runtime/browser/chrome"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--browser-directory", "/runtime/browser"]));
        assert!(args.windows(2).any(|pair| pair
            == [
                "--google-desktop-client-id",
                "public.apps.googleusercontent.com"
            ]));
        assert!(!args
            .iter()
            .any(|argument| argument.contains("master-password")));
    }

    #[test]
    fn login_start_keeps_the_daemon_headless_while_normal_launch_opens_once() {
        assert!(!should_open_dashboard(true, false));
        assert!(!should_open_dashboard(true, true));
        assert!(should_open_dashboard(false, false));
        assert!(!should_open_dashboard(false, true));
    }

    #[test]
    fn signed_updates_run_once_before_a_release_instance_starts() {
        let normal = vec![OsString::from("agentseo-desktop")];
        let disabled = vec![
            OsString::from("agentseo-desktop"),
            OsString::from("--no-update"),
        ];

        assert!(should_check_for_updates(false, &normal, None));
        assert!(!should_check_for_updates(true, &normal, None));
        assert!(!should_check_for_updates(false, &disabled, None));
        assert!(!should_check_for_updates(false, &normal, Some("off")));
        assert!(should_check_for_updates(false, &normal, Some("1")));
    }

    #[test]
    fn a_second_background_launch_stays_headless_but_a_user_launch_activates() {
        assert!(foreground_launch_requested(&["agentseo-desktop".into()]));
        assert!(!foreground_launch_requested(&[
            "agentseo-desktop".into(),
            "--background".into(),
        ]));
    }
}
