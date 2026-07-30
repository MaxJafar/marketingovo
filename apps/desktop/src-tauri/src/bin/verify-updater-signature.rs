use base64::{engine::general_purpose::STANDARD, Engine as _};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs::File, io::Read, path::PathBuf};

fn decode_armored(value: &[u8], label: &str) -> Result<String, String> {
    let encoded = std::str::from_utf8(value)
        .map_err(|_| format!("{label} is not UTF-8"))?
        .trim();
    let decoded = STANDARD
        .decode(encoded)
        .map_err(|_| format!("{label} is not valid base64"))?;
    String::from_utf8(decoded).map_err(|_| format!("decoded {label} is not UTF-8"))
}

fn verify(payload: PathBuf, signature_path: PathBuf) -> Result<(), String> {
    let public_key = env::var("MARKETINGOVO_TAURI_UPDATER_PUBLIC_KEY")
        .map_err(|_| "MARKETINGOVO_TAURI_UPDATER_PUBLIC_KEY is required".to_string())?;
    let public_key = decode_armored(public_key.as_bytes(), "updater public key")?;
    let public_key = PublicKey::decode(&public_key)
        .map_err(|error| format!("invalid updater public key: {error}"))?;

    let encoded_signature = std::fs::read(&signature_path)
        .map_err(|error| format!("cannot read {}: {error}", signature_path.display()))?;
    let signature = decode_armored(&encoded_signature, "updater signature")?;
    let signature = Signature::decode(&signature)
        .map_err(|error| format!("invalid updater signature: {error}"))?;
    let mut verifier = public_key
        .verify_stream(&signature)
        .map_err(|error| format!("cannot initialize updater verification: {error}"))?;
    let mut payload_file = File::open(&payload)
        .map_err(|error| format!("cannot open {}: {error}", payload.display()))?;
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = payload_file
            .read(&mut buffer)
            .map_err(|error| format!("cannot read {}: {error}", payload.display()))?;
        if count == 0 {
            break;
        }
        verifier.update(&buffer[..count]);
    }
    verifier
        .finalize()
        .map_err(|error| format!("updater signature verification failed: {error}"))?;
    Ok(())
}

fn main() {
    let mut args = env::args_os().skip(1).map(PathBuf::from);
    let payload = args.next();
    let signature = args.next();
    let (Some(payload), Some(signature)) = (payload, signature) else {
        eprintln!("usage: verify-updater-signature <payload> <payload.sig>");
        std::process::exit(2);
    };
    if args.next().is_some() {
        eprintln!("usage: verify-updater-signature <payload> <payload.sig>");
        std::process::exit(2);
    }
    if let Err(error) = verify(payload, signature) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
