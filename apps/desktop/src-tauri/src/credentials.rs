//! Native credential storage with an encrypted master-password fallback.
//!
//! This module is a Rust-only boundary. It intentionally has no Tauri command
//! wrappers and must never be registered with the webview invoke dispatcher.

use crate::permissions::{prepare_private_dir, read_private_file, write_private_atomic};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    Key, XChaCha20Poly1305, XNonce,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use thiserror::Error;
use zeroize::{Zeroize, Zeroizing};

const SERVICE: &str = "io.github.maxjafar.agentintel";
const VAULT_FILE: &str = "credentials.v1.json";
const VAULT_AAD: &[u8] = b"agentintel/master-password-vault/v1";
const MAX_VAULT_BYTES: u64 = 16 * 1024 * 1024;
const MAX_SECRET_BYTES: usize = 1024 * 1024;
const MINIMUM_MASTER_PASSWORD_BYTES: usize = 16;
const ARGON2_MEMORY_KIB: u32 = 64 * 1024;
const ARGON2_ITERATIONS: u32 = 3;
const ARGON2_LANES: u32 = 1;

#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("credential key is invalid")]
    InvalidKey,
    #[error("credential value exceeds the one-megabyte boundary")]
    SecretTooLarge,
    #[error("native credential store failed: {0}")]
    Native(String),
    #[error("native credential store is unavailable and no master password was supplied: {0}")]
    NativeUnavailable(String),
    #[error("master password must contain at least 16 UTF-8 bytes")]
    WeakMasterPassword,
    #[error("encrypted credential store failed authentication or is corrupt")]
    AuthenticationFailed,
    #[error("encrypted credential store format is invalid: {0}")]
    InvalidVault(String),
    #[error("credential store I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("credential store serialization failed: {0}")]
    Json(#[from] serde_json::Error),
}

pub enum CredentialVault {
    Native(NativeKeychain),
    MasterPassword(EncryptedFileStore),
}

impl CredentialVault {
    /// Prefer the operating-system credential store. The fallback is selected
    /// only after a real write/read/delete probe fails and only when a master
    /// password was supplied through a trusted native flow.
    pub fn prefer_native(
        fallback_directory: &Path,
        master_password: Option<Zeroizing<String>>,
    ) -> Result<Self, CredentialError> {
        let native = NativeKeychain;
        match native.probe() {
            Ok(()) => Ok(Self::Native(native)),
            Err(native_error) => {
                let Some(password) = master_password else {
                    return Err(CredentialError::NativeUnavailable(native_error.to_string()));
                };
                EncryptedFileStore::open(fallback_directory, password).map(Self::MasterPassword)
            }
        }
    }

    pub fn backend_name(&self) -> &'static str {
        match self {
            Self::Native(_) => "native-keychain",
            Self::MasterPassword(_) => "argon2id-xchacha20poly1305",
        }
    }

    pub fn set(&self, key: &str, secret: &[u8]) -> Result<(), CredentialError> {
        match self {
            Self::Native(store) => store.set(key, secret),
            Self::MasterPassword(store) => store.set(key, secret),
        }
    }

    pub fn get(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>, CredentialError> {
        match self {
            Self::Native(store) => store.get(key),
            Self::MasterPassword(store) => store.get(key),
        }
    }

    pub fn delete(&self, key: &str) -> Result<(), CredentialError> {
        match self {
            Self::Native(store) => store.delete(key),
            Self::MasterPassword(store) => store.delete(key),
        }
    }
}

pub struct NativeKeychain;

impl NativeKeychain {
    fn entry(key: &str) -> Result<keyring::Entry, CredentialError> {
        validate_key(key)?;
        let digest = Sha256::digest(key.as_bytes());
        let account = format!("credential/{digest:x}");
        keyring::Entry::new(SERVICE, &account)
            .map_err(|error| CredentialError::Native(error.to_string()))
    }

    fn probe(&self) -> Result<(), CredentialError> {
        let mut random = [0_u8; 32];
        OsRng.fill_bytes(&mut random);
        let key = format!("desktop-keychain-probe/{}", std::process::id());
        let entry = Self::entry(&key)?;
        let operation = (|| {
            entry
                .set_secret(&random)
                .map_err(|error| CredentialError::Native(error.to_string()))?;
            let returned = entry
                .get_secret()
                .map_err(|error| CredentialError::Native(error.to_string()))?;
            if returned != random {
                return Err(CredentialError::Native(
                    "keychain probe returned different bytes".to_string(),
                ));
            }
            Ok(())
        })();
        random.zeroize();
        let cleanup = entry
            .delete_credential()
            .map_err(|error| CredentialError::Native(error.to_string()));
        operation.and(cleanup)
    }

    fn set(&self, key: &str, secret: &[u8]) -> Result<(), CredentialError> {
        validate_secret(secret)?;
        Self::entry(key)?
            .set_secret(secret)
            .map_err(|error| CredentialError::Native(error.to_string()))
    }

    fn get(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>, CredentialError> {
        match Self::entry(key)?.get_secret() {
            Ok(secret) => Ok(Some(Zeroizing::new(secret))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(CredentialError::Native(error.to_string())),
        }
    }

    fn delete(&self, key: &str) -> Result<(), CredentialError> {
        match Self::entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(CredentialError::Native(error.to_string())),
        }
    }
}

pub struct EncryptedFileStore {
    path: PathBuf,
    master_password: Zeroizing<String>,
}

impl EncryptedFileStore {
    pub fn open(
        directory: &Path,
        master_password: Zeroizing<String>,
    ) -> Result<Self, CredentialError> {
        if master_password.len() < MINIMUM_MASTER_PASSWORD_BYTES {
            return Err(CredentialError::WeakMasterPassword);
        }
        let directory = prepare_private_dir(directory)?;
        let store = Self {
            path: directory.join(VAULT_FILE),
            master_password,
        };
        // Authenticate an existing vault immediately. A wrong password must not
        // look like an empty store that could overwrite the original ciphertext.
        if store.path.exists() {
            drop(store.load()?);
        }
        Ok(store)
    }

    fn set(&self, key: &str, secret: &[u8]) -> Result<(), CredentialError> {
        validate_key(key)?;
        validate_secret(secret)?;
        let mut payload = self.load()?;
        payload
            .entries
            .insert(key.to_string(), STANDARD_NO_PAD.encode(secret));
        self.save(&payload)
    }

    fn get(&self, key: &str) -> Result<Option<Zeroizing<Vec<u8>>>, CredentialError> {
        validate_key(key)?;
        let payload = self.load()?;
        payload
            .entries
            .get(key)
            .map(|encoded| {
                STANDARD_NO_PAD
                    .decode(encoded)
                    .map(Zeroizing::new)
                    .map_err(|_| {
                        CredentialError::InvalidVault(
                            "stored secret is not valid base64".to_string(),
                        )
                    })
            })
            .transpose()
    }

    fn delete(&self, key: &str) -> Result<(), CredentialError> {
        validate_key(key)?;
        let mut payload = self.load()?;
        if payload.entries.remove(key).is_some() {
            self.save(&payload)?;
        }
        Ok(())
    }

    fn load(&self) -> Result<VaultPayload, CredentialError> {
        let Some(bytes) = read_private_file(&self.path, MAX_VAULT_BYTES)? else {
            return Ok(VaultPayload::default());
        };
        let envelope: EncryptedEnvelope = serde_json::from_slice(&bytes)?;
        if envelope.schema_version != 1
            || envelope.kdf != "argon2id-v19-m65536-t3-p1"
            || envelope.cipher != "xchacha20poly1305"
        {
            return Err(CredentialError::InvalidVault(
                "unsupported schema, KDF or cipher".to_string(),
            ));
        }
        let salt = decode_fixed::<16>(&envelope.salt, "salt")?;
        let nonce = decode_fixed::<24>(&envelope.nonce, "nonce")?;
        let ciphertext = STANDARD_NO_PAD
            .decode(&envelope.ciphertext)
            .map_err(|_| CredentialError::InvalidVault("invalid ciphertext".to_string()))?;
        let key = derive_key(self.master_password.as_bytes(), &salt)?;
        let cipher = XChaCha20Poly1305::new(Key::from_slice(&key[..]));
        let plaintext = cipher
            .decrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &ciphertext,
                    aad: VAULT_AAD,
                },
            )
            .map_err(|_| CredentialError::AuthenticationFailed)?;
        let plaintext = Zeroizing::new(plaintext);
        serde_json::from_slice(&plaintext).map_err(CredentialError::Json)
    }

    fn save(&self, payload: &VaultPayload) -> Result<(), CredentialError> {
        let plaintext = Zeroizing::new(serde_json::to_vec(payload)?);
        let mut salt = [0_u8; 16];
        let mut nonce = [0_u8; 24];
        OsRng.fill_bytes(&mut salt);
        OsRng.fill_bytes(&mut nonce);
        let key = derive_key(self.master_password.as_bytes(), &salt)?;
        let cipher = XChaCha20Poly1305::new(Key::from_slice(&key[..]));
        let ciphertext = cipher
            .encrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &plaintext,
                    aad: VAULT_AAD,
                },
            )
            .map_err(|_| CredentialError::AuthenticationFailed)?;
        let envelope = EncryptedEnvelope {
            schema_version: 1,
            kdf: "argon2id-v19-m65536-t3-p1".to_string(),
            cipher: "xchacha20poly1305".to_string(),
            salt: STANDARD_NO_PAD.encode(salt),
            nonce: STANDARD_NO_PAD.encode(nonce),
            ciphertext: STANDARD_NO_PAD.encode(ciphertext),
        };
        let encoded = serde_json::to_vec(&envelope)?;
        write_private_atomic(&self.path, &encoded)?;
        salt.zeroize();
        nonce.zeroize();
        Ok(())
    }
}

#[derive(Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct VaultPayload {
    entries: BTreeMap<String, String>,
}

impl Drop for VaultPayload {
    fn drop(&mut self) {
        for value in self.entries.values_mut() {
            value.zeroize();
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct EncryptedEnvelope {
    schema_version: u32,
    kdf: String,
    cipher: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}

fn validate_key(key: &str) -> Result<(), CredentialError> {
    if key.is_empty()
        || key.len() > 512
        || key.chars().any(char::is_control)
        || key.starts_with('/')
        || key.ends_with('/')
        || key.split('/').any(|part| part.is_empty() || part == "..")
    {
        return Err(CredentialError::InvalidKey);
    }
    Ok(())
}

fn validate_secret(secret: &[u8]) -> Result<(), CredentialError> {
    if secret.len() > MAX_SECRET_BYTES {
        return Err(CredentialError::SecretTooLarge);
    }
    Ok(())
}

fn derive_key(password: &[u8], salt: &[u8; 16]) -> Result<Zeroizing<[u8; 32]>, CredentialError> {
    let params = Params::new(ARGON2_MEMORY_KIB, ARGON2_ITERATIONS, ARGON2_LANES, Some(32))
        .map_err(|error| CredentialError::InvalidVault(error.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0_u8; 32]);
    argon2
        .hash_password_into(password, salt, key.as_mut())
        .map_err(|error| CredentialError::InvalidVault(error.to_string()))?;
    Ok(key)
}

fn decode_fixed<const N: usize>(encoded: &str, label: &str) -> Result<[u8; N], CredentialError> {
    let decoded = STANDARD_NO_PAD
        .decode(encoded)
        .map_err(|_| CredentialError::InvalidVault(format!("invalid {label}")))?;
    decoded
        .try_into()
        .map_err(|_| CredentialError::InvalidVault(format!("invalid {label} length")))
}

#[cfg(test)]
mod tests {
    use super::{CredentialError, EncryptedFileStore, VAULT_FILE};
    use zeroize::Zeroizing;

    #[test]
    fn rejects_a_short_master_password_before_touching_disk() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let result =
            EncryptedFileStore::open(temporary.path(), Zeroizing::new("too-short".to_string()));
        assert!(matches!(result, Err(CredentialError::WeakMasterPassword)));
    }

    #[test]
    fn encrypted_fallback_round_trips_without_plaintext_at_rest() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let password = "correct horse battery staple";
        let store =
            EncryptedFileStore::open(temporary.path(), Zeroizing::new(password.to_string()))
                .expect("open vault");
        store
            .set("connector/reddit", b"not-a-real-secret")
            .expect("set");
        assert_eq!(
            store
                .get("connector/reddit")
                .expect("get")
                .expect("present")
                .as_slice(),
            b"not-a-real-secret"
        );
        let ciphertext = std::fs::read(temporary.path().join(VAULT_FILE)).expect("vault bytes");
        assert!(!ciphertext
            .windows(b"not-a-real-secret".len())
            .any(|window| window == b"not-a-real-secret"));
        drop(store);

        let wrong_password = EncryptedFileStore::open(
            temporary.path(),
            Zeroizing::new("this is definitely the wrong password".to_string()),
        );
        assert!(matches!(
            wrong_password,
            Err(CredentialError::AuthenticationFailed)
        ));
    }
}
