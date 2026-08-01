use std::env;

fn required_release_key(name: &str) {
    let value = env::var(name).unwrap_or_default();
    if value.trim().is_empty() || value.contains("__AGENTINTEL_") {
        panic!("release desktop builds require {name} to contain the production public key");
    }
}

fn main() {
    println!("cargo:rerun-if-env-changed=AGENTINTEL_SIDECAR_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=AGENTINTEL_UPDATER_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");

    let target = env::var("TARGET").expect("Cargo did not provide TARGET");
    println!("cargo:rustc-env=AGENTINTEL_BUILD_TARGET={target}");

    if env::var("PROFILE").as_deref() == Ok("release") {
        required_release_key("AGENTINTEL_SIDECAR_PUBLIC_KEY");
        required_release_key("AGENTINTEL_UPDATER_PUBLIC_KEY");
    }

    tauri_build::build();
}
