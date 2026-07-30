use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};
use zeroize::Zeroize;

const SERVICE: &str = "com.golemworkers.agentseo";

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
enum Request {
    Put {
        request_id: String,
        key: String,
        secret_base64: String,
    },
    Get {
        request_id: String,
        key: String,
    },
    Delete {
        request_id: String,
        key: String,
    },
    Status {
        request_id: String,
        key: String,
    },
}

#[derive(Serialize)]
struct Response {
    request_id: String,
    ok: bool,
    exists: Option<bool>,
    secret_base64: Option<String>,
    error: Option<&'static str>,
}

fn response(
    request_id: String,
    result: Result<(Option<bool>, Option<String>), &'static str>,
) -> Response {
    match result {
        Ok((exists, secret_base64)) => Response {
            request_id,
            ok: true,
            exists,
            secret_base64,
            error: None,
        },
        Err(error) => Response {
            request_id,
            ok: false,
            exists: None,
            secret_base64: None,
            error: Some(error),
        },
    }
}

fn entry(key: &str) -> Result<keyring::Entry, &'static str> {
    if key.is_empty() || key.len() > 512 || key.chars().any(char::is_control) {
        return Err("invalid_key");
    }
    keyring::Entry::new(SERVICE, key).map_err(|_| "backend_unavailable")
}

fn get_secret(value: &keyring::Entry) -> Result<Vec<u8>, &'static str> {
    match value.get_secret() {
        Ok(secret) => Ok(secret),
        Err(keyring::Error::NoEntry) => Err("not_found"),
        Err(_) => Err("read_failed"),
    }
}

fn delete_secret(value: &keyring::Entry) -> Result<(), &'static str> {
    match value.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("delete_failed"),
    }
}

fn execute(request: Request) -> Response {
    match request {
        Request::Put {
            request_id,
            key,
            mut secret_base64,
        } => {
            let result = (|| {
                let mut secret = BASE64
                    .decode(secret_base64.as_bytes())
                    .map_err(|_| "invalid_secret")?;
                if secret.is_empty() || secret.len() > 1024 * 1024 {
                    secret.zeroize();
                    return Err("invalid_secret");
                }
                let saved = entry(&key)?.set_secret(&secret).map_err(|_| "write_failed");
                secret.zeroize();
                saved.map(|_| (Some(true), None))
            })();
            secret_base64.zeroize();
            response(request_id, result)
        }
        Request::Get { request_id, key } => {
            let result = match entry(&key).and_then(|value| get_secret(&value)) {
                Ok(mut secret) => {
                    let encoded = BASE64.encode(&secret);
                    secret.zeroize();
                    Ok((Some(true), Some(encoded)))
                }
                Err("not_found") => Ok((Some(false), None)),
                Err(error) => Err(error),
            };
            response(request_id, result)
        }
        Request::Delete { request_id, key } => {
            let result = entry(&key)
                .and_then(|value| delete_secret(&value))
                .map(|_| (Some(false), None));
            response(request_id, result)
        }
        Request::Status { request_id, key } => {
            let result = match entry(&key).and_then(|value| get_secret(&value)) {
                Ok(mut secret) => {
                    secret.zeroize();
                    Ok((Some(true), None))
                }
                Err("not_found") => Ok((Some(false), None)),
                Err(error) => Err(error),
            };
            response(request_id, result)
        }
    }
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let output = match line {
            Ok(line) if line.len() <= 2 * 1024 * 1024 => {
                match serde_json::from_str::<Request>(&line) {
                    Ok(request) => execute(request),
                    Err(_) => response("unknown".to_string(), Err("invalid_request")),
                }
            }
            _ => response("unknown".to_string(), Err("invalid_request")),
        };
        if serde_json::to_writer(&mut stdout, &output).is_err() || writeln!(&mut stdout).is_err() {
            break;
        }
        let _ = stdout.flush();
    }
}
