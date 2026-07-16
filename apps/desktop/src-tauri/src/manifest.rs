use crate::permissions::prepare_private_dir;
use minisign_verify::{PublicKey, Signature};
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{self, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;

#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt};

const MANIFEST_NAME: &str = "sidecars.manifest.json";
const SIGNATURE_NAME: &str = "sidecars.manifest.json.minisig";
const MAX_MANIFEST_BYTES: u64 = 2 * 1024 * 1024;
const MAX_SIGNATURE_BYTES: u64 = 16 * 1024;
const MAX_FILES: usize = 50_000;
const MAX_TOTAL_BYTES: u64 = 8 * 1024 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum ManifestError {
    #[error("runtime bundle I/O failed: {0}")]
    Io(#[from] io::Error),
    #[error("runtime bundle manifest is invalid: {0}")]
    Invalid(String),
    #[error("runtime bundle manifest signature is invalid: {0}")]
    Signature(String),
    #[error("runtime bundle manifest JSON is invalid: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Clone, Debug)]
struct VerifiedArtifact {
    relative: PathBuf,
    source: PathBuf,
    sha256: String,
    size_bytes: u64,
    executable: bool,
}

#[derive(Clone, Debug)]
pub struct VerifiedBundle {
    daemon_relative: PathBuf,
    python_command_relative: PathBuf,
    python_worker_relative: PathBuf,
    dashboard_relative: Option<PathBuf>,
    fixture_relative: PathBuf,
    artifacts: Vec<VerifiedArtifact>,
}

pub struct SealedBundle {
    pub daemon: PathBuf,
    pub python_command: PathBuf,
    pub python_worker_root: PathBuf,
    pub dashboard_root: Option<PathBuf>,
    pub fixture: PathBuf,
    artifacts: Vec<SealedArtifact>,
    snapshot: RuntimeSnapshot,
}

#[derive(Clone)]
struct SealedArtifact {
    path: PathBuf,
    sha256: String,
    size_bytes: u64,
    executable: bool,
}

pub struct RuntimeSnapshot {
    root: PathBuf,
}

impl RuntimeSnapshot {
    #[cfg(test)]
    pub(crate) fn for_test(root: &Path) -> Self {
        fs::create_dir_all(root).expect("test snapshot root");
        Self {
            root: root.to_path_buf(),
        }
    }
}

impl Drop for RuntimeSnapshot {
    fn drop(&mut self) {
        make_tree_removable(&self.root);
        let _ = fs::remove_dir_all(&self.root);
    }
}

impl SealedBundle {
    /// Re-hash the private read-only snapshot immediately before process
    /// creation. The packaged resource tree is never used after this point.
    pub fn verify_for_launch(&self) -> Result<(), ManifestError> {
        for artifact in &self.artifacts {
            let metadata = fs::symlink_metadata(&artifact.path)?;
            if metadata.file_type().is_symlink()
                || !metadata.is_file()
                || metadata.len() != artifact.size_bytes
            {
                return Err(ManifestError::Invalid(format!(
                    "sealed runtime file changed type or size: {}",
                    artifact.path.display()
                )));
            }
            verify_sealed_file_mode(&metadata, artifact.executable, &artifact.path)?;
            if sha256_file_no_follow(&artifact.path)? != artifact.sha256 {
                return Err(ManifestError::Invalid(format!(
                    "sealed runtime file changed after verification: {}",
                    artifact.path.display()
                )));
            }
        }
        Ok(())
    }

    pub fn into_snapshot(self) -> RuntimeSnapshot {
        self.snapshot
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SidecarManifest {
    schema_version: u32,
    target_triple: String,
    daemon: String,
    python_command: String,
    python_environment_root: String,
    python_worker_root: String,
    python_generated_root: String,
    #[serde(default)]
    dashboard_root: Option<String>,
    fixture: String,
    files: Vec<ManifestFile>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ManifestFile {
    path: String,
    sha256: String,
    size_bytes: u64,
    #[serde(default)]
    executable: bool,
}

pub fn verify_release_bundle(
    runtime_root: &Path,
    target_triple: &str,
    public_key_source: &str,
) -> Result<VerifiedBundle, ManifestError> {
    let runtime_root = canonical_directory(runtime_root, "runtime root")?;
    let manifest_bytes =
        read_bounded_regular_file(&runtime_root.join(MANIFEST_NAME), MAX_MANIFEST_BYTES)?;
    let signature_bytes =
        read_bounded_regular_file(&runtime_root.join(SIGNATURE_NAME), MAX_SIGNATURE_BYTES)?;

    let public_key = if public_key_source.contains('\n') {
        PublicKey::decode(public_key_source)
    } else {
        PublicKey::from_base64(public_key_source.trim())
    }
    .map_err(|error| ManifestError::Signature(error.to_string()))?;
    let signature_source = std::str::from_utf8(&signature_bytes)
        .map_err(|_| ManifestError::Signature("signature is not UTF-8".to_string()))?;
    let signature = Signature::decode(signature_source)
        .map_err(|error| ManifestError::Signature(error.to_string()))?;
    public_key
        .verify(&manifest_bytes, &signature, false)
        .map_err(|error| ManifestError::Signature(error.to_string()))?;

    verify_manifest_bytes(&runtime_root, target_triple, &manifest_bytes)
}

fn verify_manifest_bytes(
    runtime_root: &Path,
    target_triple: &str,
    manifest_bytes: &[u8],
) -> Result<VerifiedBundle, ManifestError> {
    let runtime_root = canonical_directory(runtime_root, "runtime root")?;
    let manifest: SidecarManifest = serde_json::from_slice(manifest_bytes)?;
    if manifest.schema_version != 2 {
        return Err(ManifestError::Invalid(format!(
            "unsupported schema version {}; the sealed Python runtime requires version 2",
            manifest.schema_version
        )));
    }
    if manifest.target_triple != target_triple {
        return Err(ManifestError::Invalid(format!(
            "bundle target {} does not match launcher target {target_triple}",
            manifest.target_triple
        )));
    }
    if manifest.files.is_empty() || manifest.files.len() > MAX_FILES {
        return Err(ManifestError::Invalid(
            "manifest file count is outside policy".to_string(),
        ));
    }

    let daemon_relative = safe_relative_path(&manifest.daemon)?;
    let python_command_relative = safe_relative_path(&manifest.python_command)?;
    let python_environment_relative = safe_relative_path(&manifest.python_environment_root)?;
    let python_worker_relative = safe_relative_path(&manifest.python_worker_root)?;
    let python_generated_relative = safe_relative_path(&manifest.python_generated_root)?;
    let dashboard_relative = manifest
        .dashboard_root
        .as_deref()
        .map(safe_relative_path)
        .transpose()?;
    let fixture_relative = safe_relative_path(&manifest.fixture)?;

    if !python_command_relative.starts_with(&python_environment_relative)
        || python_command_relative == python_environment_relative
    {
        return Err(ManifestError::Invalid(
            "python_command must be contained by python_environment_root".to_string(),
        ));
    }

    let mut declared = HashMap::<String, &ManifestFile>::new();
    let mut canonical_paths = HashSet::<PathBuf>::new();
    let mut artifacts = Vec::with_capacity(manifest.files.len());
    let mut total_bytes = 0_u64;

    for artifact in &manifest.files {
        let relative = safe_relative_path(&artifact.path)?;
        validate_sha256(&artifact.sha256)?;
        if declared.insert(artifact.path.clone(), artifact).is_some() {
            return Err(ManifestError::Invalid(format!(
                "duplicate manifest path {}",
                artifact.path
            )));
        }
        total_bytes = total_bytes
            .checked_add(artifact.size_bytes)
            .ok_or_else(|| ManifestError::Invalid("manifest size overflow".to_string()))?;
        if total_bytes > MAX_TOTAL_BYTES {
            return Err(ManifestError::Invalid(
                "runtime bundle exceeds the maximum declared size".to_string(),
            ));
        }

        let source = resolve_without_symlinks(&runtime_root, &relative)?;
        if !canonical_paths.insert(source.clone()) {
            return Err(ManifestError::Invalid(format!(
                "multiple manifest paths resolve to {}",
                source.display()
            )));
        }
        let metadata = fs::metadata(&source)?;
        if !metadata.is_file() || metadata.len() != artifact.size_bytes {
            return Err(ManifestError::Invalid(format!(
                "size or type mismatch for {}",
                artifact.path
            )));
        }
        verify_file_mode(&metadata, artifact.executable, &artifact.path)?;
        if sha256_file_no_follow(&source)? != artifact.sha256 {
            return Err(ManifestError::Invalid(format!(
                "SHA-256 mismatch for {}",
                artifact.path
            )));
        }
        artifacts.push(VerifiedArtifact {
            relative,
            source,
            sha256: artifact.sha256.clone(),
            size_bytes: artifact.size_bytes,
            executable: artifact.executable,
        });
    }

    require_declared_file(&declared, &daemon_relative, true, "daemon")?;
    require_declared_file(
        &declared,
        &python_command_relative,
        true,
        "Python interpreter",
    )?;
    require_declared_file(&declared, &fixture_relative, false, "fixture")?;
    require_declared_file(
        &declared,
        &python_environment_relative.join("pyvenv.cfg"),
        false,
        "Python environment marker",
    )?;
    require_declared_file(
        &declared,
        &python_worker_relative.join("pyproject.toml"),
        false,
        "Python worker pyproject",
    )?;
    require_declared_file(
        &declared,
        &python_worker_relative.join("uv.lock"),
        false,
        "Python worker lockfile",
    )?;

    let manifest_paths = declared.keys().cloned().collect::<HashSet<_>>();
    require_complete_nonempty_tree(
        &runtime_root,
        &python_environment_relative,
        &manifest_paths,
        "Python environment",
    )?;
    require_complete_nonempty_tree(
        &runtime_root,
        &python_worker_relative,
        &manifest_paths,
        "Python worker",
    )?;
    require_complete_nonempty_tree(
        &runtime_root,
        &python_worker_relative.join("src"),
        &manifest_paths,
        "Python worker source",
    )?;
    require_complete_nonempty_tree(
        &runtime_root,
        &python_generated_relative,
        &manifest_paths,
        "generated Python contracts",
    )?;
    if let Some(relative) = &dashboard_relative {
        require_declared_file(
            &declared,
            &relative.join("index.html"),
            false,
            "dashboard index",
        )?;
        require_complete_nonempty_tree(&runtime_root, relative, &manifest_paths, "dashboard")?;
    }

    Ok(VerifiedBundle {
        daemon_relative,
        python_command_relative,
        python_worker_relative,
        dashboard_relative,
        fixture_relative,
        artifacts,
    })
}

impl VerifiedBundle {
    /// Copies only signed files into a fresh private directory, hashes every
    /// destination, and removes write permission before returning launch paths.
    /// A resource changed after initial verification cannot reach execution.
    pub fn seal_into(self, parent: &Path) -> Result<SealedBundle, ManifestError> {
        let parent = prepare_private_dir(parent)?;
        let mut random = [0_u8; 16];
        OsRng.fill_bytes(&mut random);
        let snapshot_root = parent.join(format!(
            "runtime-{:016x}{:016x}",
            u64::from_ne_bytes(random[..8].try_into().expect("eight bytes")),
            u64::from_ne_bytes(random[8..].try_into().expect("eight bytes"))
        ));
        random.fill(0);
        create_private_directory(&snapshot_root)?;
        let snapshot = RuntimeSnapshot {
            root: snapshot_root.clone(),
        };
        let mut sealed_artifacts = Vec::with_capacity(self.artifacts.len());

        for artifact in &self.artifacts {
            let destination = snapshot_root.join(&artifact.relative);
            if let Some(parent) = destination.parent() {
                create_private_directories(&snapshot_root, parent)?;
            }
            copy_and_verify_artifact(artifact, &destination)?;
            sealed_artifacts.push(SealedArtifact {
                path: destination,
                sha256: artifact.sha256.clone(),
                size_bytes: artifact.size_bytes,
                executable: artifact.executable,
            });
        }

        seal_directories(&snapshot_root)?;
        let sealed = SealedBundle {
            daemon: snapshot_root.join(&self.daemon_relative),
            python_command: snapshot_root.join(&self.python_command_relative),
            python_worker_root: snapshot_root.join(&self.python_worker_relative),
            dashboard_root: self
                .dashboard_relative
                .as_ref()
                .map(|relative| snapshot_root.join(relative)),
            fixture: snapshot_root.join(&self.fixture_relative),
            artifacts: sealed_artifacts,
            snapshot,
        };
        sealed.verify_for_launch()?;
        Ok(sealed)
    }
}

fn copy_and_verify_artifact(
    artifact: &VerifiedArtifact,
    destination: &Path,
) -> Result<(), ManifestError> {
    let metadata = fs::symlink_metadata(&artifact.source)?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() != artifact.size_bytes
    {
        return Err(ManifestError::Invalid(format!(
            "source changed before snapshot: {}",
            artifact.source.display()
        )));
    }
    verify_file_mode(
        &metadata,
        artifact.executable,
        &portable_relative_string(&artifact.relative),
    )?;

    let mut source_options = OpenOptions::new();
    source_options.read(true);
    #[cfg(unix)]
    source_options.custom_flags(libc::O_NOFOLLOW);
    let source = source_options.open(&artifact.source)?;
    let opened_metadata = source.metadata()?;
    if !opened_metadata.is_file() || opened_metadata.len() != artifact.size_bytes {
        return Err(ManifestError::Invalid(format!(
            "source changed while opening snapshot input: {}",
            artifact.source.display()
        )));
    }

    let mut destination_options = OpenOptions::new();
    destination_options.write(true).create_new(true);
    #[cfg(unix)]
    destination_options
        .mode(0o600)
        .custom_flags(libc::O_NOFOLLOW);
    let mut destination_file = destination_options.open(destination)?;
    let copied = io::copy(
        &mut source.take(artifact.size_bytes.saturating_add(1)),
        &mut destination_file,
    )?;
    destination_file.flush()?;
    destination_file.sync_all()?;
    if copied != artifact.size_bytes || sha256_file_no_follow(destination)? != artifact.sha256 {
        return Err(ManifestError::Invalid(format!(
            "source changed while creating sealed snapshot: {}",
            artifact.source.display()
        )));
    }
    set_sealed_file_permissions(destination, artifact.executable)?;
    Ok(())
}

fn canonical_directory(path: &Path, label: &str) -> Result<PathBuf, ManifestError> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ManifestError::Invalid(format!(
            "{label} is not a real directory"
        )));
    }
    path.canonicalize().map_err(ManifestError::Io)
}

fn read_bounded_regular_file(path: &Path, maximum: u64) -> Result<Vec<u8>, ManifestError> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() > maximum {
        return Err(ManifestError::Invalid(format!(
            "{} failed signed-manifest file policy",
            path.display()
        )));
    }
    fs::read(path).map_err(ManifestError::Io)
}

fn safe_relative_path(raw: &str) -> Result<PathBuf, ManifestError> {
    if raw.is_empty()
        || raw.len() > 1024
        || raw.starts_with('/')
        || raw.ends_with('/')
        || raw.contains('\\')
        || raw.contains(':')
        || raw.chars().any(char::is_control)
    {
        return Err(ManifestError::Invalid(format!(
            "unsafe relative path {raw:?}"
        )));
    }
    let segments = raw.split('/').collect::<Vec<_>>();
    if segments
        .iter()
        .any(|segment| segment.is_empty() || matches!(*segment, "." | ".."))
    {
        return Err(ManifestError::Invalid(format!(
            "unsafe relative path {raw:?}"
        )));
    }
    Ok(segments.iter().collect())
}

fn resolve_without_symlinks(root: &Path, relative: &Path) -> Result<PathBuf, ManifestError> {
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        cursor.push(component.as_os_str());
        let metadata = fs::symlink_metadata(&cursor)?;
        if metadata.file_type().is_symlink() {
            return Err(ManifestError::Invalid(format!(
                "runtime path traverses a symbolic link: {}",
                cursor.display()
            )));
        }
    }
    let canonical = cursor.canonicalize()?;
    if !canonical.starts_with(root) {
        return Err(ManifestError::Invalid(
            "runtime path escaped the bundle root".to_string(),
        ));
    }
    Ok(canonical)
}

fn validate_sha256(value: &str) -> Result<(), ManifestError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
    {
        return Err(ManifestError::Invalid(
            "SHA-256 values must be 64 lowercase hexadecimal characters".to_string(),
        ));
    }
    Ok(())
}

fn sha256_file_no_follow(path: &Path) -> Result<String, ManifestError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW);
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(ManifestError::Invalid(format!(
            "hash input is not a regular file: {}",
            path.display()
        )));
    }
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_file_mode(
    metadata: &fs::Metadata,
    executable: bool,
    path: &str,
) -> Result<(), ManifestError> {
    #[cfg(unix)]
    {
        let mode = metadata.permissions().mode();
        if mode & 0o022 != 0 || mode & 0o6000 != 0 {
            return Err(ManifestError::Invalid(format!(
                "runtime file {path} is writable by another principal or has set-id bits"
            )));
        }
        if executable && mode & 0o111 == 0 {
            return Err(ManifestError::Invalid(format!(
                "runtime file {path} is not executable"
            )));
        }
        if !executable && mode & 0o111 != 0 {
            return Err(ManifestError::Invalid(format!(
                "non-executable runtime file {path} has executable bits"
            )));
        }
    }
    #[cfg(not(unix))]
    let _ = (metadata, executable, path);
    Ok(())
}

fn verify_sealed_file_mode(
    metadata: &fs::Metadata,
    executable: bool,
    path: &Path,
) -> Result<(), ManifestError> {
    #[cfg(unix)]
    {
        let expected = if executable { 0o500 } else { 0o400 };
        if metadata.permissions().mode() & 0o777 != expected {
            return Err(ManifestError::Invalid(format!(
                "sealed runtime permissions changed: {}",
                path.display()
            )));
        }
    }
    #[cfg(not(unix))]
    let _ = (metadata, executable, path);
    Ok(())
}

fn require_declared_file(
    declared: &HashMap<String, &ManifestFile>,
    relative: &Path,
    executable: bool,
    label: &str,
) -> Result<(), ManifestError> {
    let key = portable_relative_string(relative);
    let artifact = declared
        .get(&key)
        .ok_or_else(|| ManifestError::Invalid(format!("{label} is not a declared file")))?;
    if artifact.executable != executable {
        return Err(ManifestError::Invalid(format!(
            "{label} executable policy does not match"
        )));
    }
    Ok(())
}

fn require_complete_nonempty_tree(
    runtime_root: &Path,
    relative_root: &Path,
    manifest_paths: &HashSet<String>,
    label: &str,
) -> Result<(), ManifestError> {
    let component_root = resolve_without_symlinks(runtime_root, relative_root)?;
    if !component_root.is_dir() {
        return Err(ManifestError::Invalid(format!(
            "{label} is not a directory"
        )));
    }
    let mut regular_files = 0_usize;
    for entry in WalkDir::new(&component_root).follow_links(false) {
        let entry = entry
            .map_err(|error| ManifestError::Invalid(format!("could not walk {label}: {error}")))?;
        if entry.path() == component_root || entry.file_type().is_dir() {
            continue;
        }
        if entry.file_type().is_symlink() || !entry.file_type().is_file() {
            return Err(ManifestError::Invalid(format!(
                "{label} contains a link or special file: {}",
                entry.path().display()
            )));
        }
        regular_files += 1;
        let relative = entry
            .path()
            .strip_prefix(runtime_root)
            .map_err(|_| ManifestError::Invalid(format!("{label} escaped the bundle root")))?;
        let key = portable_relative_string(relative);
        if !manifest_paths.contains(&key) {
            return Err(ManifestError::Invalid(format!(
                "{label} contains unlisted file {key}"
            )));
        }
    }
    if regular_files == 0 {
        return Err(ManifestError::Invalid(format!("{label} is empty")));
    }
    Ok(())
}

fn create_private_directory(path: &Path) -> Result<(), ManifestError> {
    let mut options = fs::DirBuilder::new();
    #[cfg(unix)]
    options.mode(0o700);
    options.create(path)?;
    Ok(())
}

fn create_private_directories(root: &Path, target: &Path) -> Result<(), ManifestError> {
    let relative = target.strip_prefix(root).map_err(|_| {
        ManifestError::Invalid("snapshot destination escaped private root".to_string())
    })?;
    let mut cursor = root.to_path_buf();
    for component in relative.components() {
        cursor.push(component.as_os_str());
        if !cursor.exists() {
            create_private_directory(&cursor)?;
        }
        let metadata = fs::symlink_metadata(&cursor)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(ManifestError::Invalid(
                "snapshot directory was replaced".to_string(),
            ));
        }
    }
    Ok(())
}

fn set_sealed_file_permissions(path: &Path, executable: bool) -> Result<(), ManifestError> {
    #[cfg(unix)]
    fs::set_permissions(
        path,
        fs::Permissions::from_mode(if executable { 0o500 } else { 0o400 }),
    )?;
    #[cfg(windows)]
    {
        let mut permissions = fs::metadata(path)?.permissions();
        permissions.set_readonly(true);
        fs::set_permissions(path, permissions)?;
    }
    Ok(())
}

fn seal_directories(root: &Path) -> Result<(), ManifestError> {
    #[cfg(unix)]
    {
        let mut directories = WalkDir::new(root)
            .contents_first(true)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_dir())
            .map(|entry| entry.into_path())
            .collect::<Vec<_>>();
        directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
        for directory in directories {
            fs::set_permissions(directory, fs::Permissions::from_mode(0o500))?;
        }
    }
    #[cfg(not(unix))]
    let _ = root;
    Ok(())
}

fn make_tree_removable(root: &Path) {
    if !root.exists() {
        return;
    }
    for entry in WalkDir::new(root)
        .contents_first(true)
        .into_iter()
        .flatten()
    {
        #[cfg(unix)]
        {
            let mode = if entry.file_type().is_dir() {
                0o700
            } else {
                0o600
            };
            let _ = fs::set_permissions(entry.path(), fs::Permissions::from_mode(mode));
        }
        #[cfg(windows)]
        if let Ok(metadata) = entry.metadata() {
            let mut permissions = metadata.permissions();
            permissions.set_readonly(false);
            let _ = fs::set_permissions(entry.path(), permissions);
        }
    }
}

fn portable_relative_string(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::{safe_relative_path, sha256_file_no_follow, verify_manifest_bytes};
    use serde_json::json;
    use std::fs;
    use std::path::Path;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    fn write_file(path: &Path, contents: &[u8], executable: bool) -> serde_json::Value {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent");
        }
        fs::write(path, contents).expect("write fixture");
        #[cfg(unix)]
        fs::set_permissions(
            path,
            fs::Permissions::from_mode(if executable { 0o755 } else { 0o644 }),
        )
        .expect("fixture mode");
        json!({
            "path": path.file_name().unwrap().to_string_lossy(),
            "sha256": sha256_file_no_follow(path).expect("hash"),
            "size_bytes": contents.len(),
            "executable": executable
        })
    }

    fn valid_manifest(root: &Path) -> Vec<u8> {
        let entries = [
            ("bin/golem-inteld", b"daemon".as_slice(), true),
            ("python-runtime/bin/python3", b"python".as_slice(), true),
            (
                "python-runtime/pyvenv.cfg",
                b"home = bundled\n".as_slice(),
                false,
            ),
            (
                "python-runtime/lib/site-packages/golem_intel.pth",
                b"sealed-worker\n".as_slice(),
                false,
            ),
            (
                "python-worker/pyproject.toml",
                b"[project]\nname='worker'\n".as_slice(),
                false,
            ),
            ("python-worker/uv.lock", b"version = 1\n".as_slice(), false),
            (
                "python-worker/src/golem_intel_worker/__init__.py",
                b"VERSION='test'\n".as_slice(),
                false,
            ),
            (
                "python-generated/golem/intel/v1/worker_pb2.py",
                b"# generated\n".as_slice(),
                false,
            ),
            ("fixtures/observations.ndjson", b"{}\n".as_slice(), false),
        ];
        let files = entries
            .into_iter()
            .map(|(relative, contents, executable)| {
                let mut value = write_file(&root.join(relative), contents, executable);
                value["path"] = json!(relative);
                value
            })
            .collect::<Vec<_>>();
        serde_json::to_vec(&json!({
            "schema_version": 2,
            "target_triple": "test-target",
            "daemon": "bin/golem-inteld",
            "python_command": "python-runtime/bin/python3",
            "python_environment_root": "python-runtime",
            "python_worker_root": "python-worker",
            "python_generated_root": "python-generated",
            "fixture": "fixtures/observations.ndjson",
            "files": files
        }))
        .expect("manifest")
    }

    #[test]
    fn accepts_a_complete_pinned_python_environment() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        let verified = verify_manifest_bytes(temporary.path(), "test-target", &manifest)
            .expect("verified bundle");
        let snapshot_parent = temporary.path().join("snapshots");
        let sealed = verified.seal_into(&snapshot_parent).expect("sealed bundle");
        assert!(sealed.daemon.ends_with("bin/golem-inteld"));
        assert!(sealed
            .python_command
            .ends_with("python-runtime/bin/python3"));
        sealed.verify_for_launch().expect("launch verification");
    }

    #[test]
    fn rejects_traversal_and_non_portable_paths() {
        for path in [
            "../daemon",
            "/daemon",
            "worker\\run.py",
            "C:/daemon",
            "a//b",
        ] {
            assert!(safe_relative_path(path).is_err(), "accepted {path}");
        }
        assert!(safe_relative_path("python-worker/src/run.py").is_ok());
    }

    #[test]
    fn rejects_missing_lockfile_and_unlisted_environment_code() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        fs::remove_file(temporary.path().join("python-worker/uv.lock")).expect("remove lock");
        assert!(verify_manifest_bytes(temporary.path(), "test-target", &manifest).is_err());

        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        fs::write(
            temporary
                .path()
                .join("python-runtime/lib/site-packages/unlisted.py"),
            b"unlisted",
        )
        .expect("unlisted");
        assert!(verify_manifest_bytes(temporary.path(), "test-target", &manifest).is_err());
    }

    #[test]
    fn source_tampering_between_verify_and_snapshot_is_rejected() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        let verified = verify_manifest_bytes(temporary.path(), "test-target", &manifest)
            .expect("verified bundle");
        fs::write(temporary.path().join("bin/golem-inteld"), b"badbin").expect("tamper source");
        assert!(verified
            .seal_into(&temporary.path().join("snapshots"))
            .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn sealed_tampering_is_rejected_before_launch() {
        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        let verified = verify_manifest_bytes(temporary.path(), "test-target", &manifest)
            .expect("verified bundle");
        let sealed = verified
            .seal_into(&temporary.path().join("snapshots"))
            .expect("snapshot");
        fs::set_permissions(&sealed.daemon, fs::Permissions::from_mode(0o700))
            .expect("make mutable");
        fs::write(&sealed.daemon, b"badbin").expect("tamper snapshot");
        fs::set_permissions(&sealed.daemon, fs::Permissions::from_mode(0o500))
            .expect("restore sealed mode");
        assert!(sealed.verify_for_launch().is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_inside_the_worker_tree() {
        use std::os::unix::fs::symlink;

        let temporary = tempfile::tempdir().expect("tempdir");
        let manifest = valid_manifest(temporary.path());
        let outside = temporary.path().join("outside.py");
        fs::write(&outside, b"outside").expect("outside");
        symlink(&outside, temporary.path().join("python-worker/src/link.py")).expect("symlink");
        assert!(verify_manifest_bytes(temporary.path(), "test-target", &manifest).is_err());
    }
}
