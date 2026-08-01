from __future__ import annotations

import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any

from .constants import MAX_INPUT_BYTES
from .errors import WorkerError


def ensure_contained(path: Path, root: Path, *, label: str, must_exist: bool) -> Path:
    try:
        root_resolved = root.resolve(strict=True)
    except OSError as exc:
        raise WorkerError("path_policy_violation", f"Workspace path is unavailable: {exc}") from exc
    if not root_resolved.is_dir():
        raise WorkerError("path_policy_violation", "Workspace path must be a directory.")

    try:
        resolved = path.resolve(strict=must_exist)
        resolved.relative_to(root_resolved)
    except (OSError, ValueError) as exc:
        raise WorkerError(
            "path_policy_violation", f"{label} must resolve beneath the workspace."
        ) from exc
    if resolved == root_resolved and label == "output directory":
        raise WorkerError("path_policy_violation", "Output directory cannot be the workspace root.")
    return resolved


def reject_symlink_components(path: Path, root: Path, *, label: str) -> None:
    root_resolved = root.resolve(strict=True)
    lexical_path = Path(os.path.abspath(path))
    try:
        lexical_path.relative_to(root_resolved)
    except ValueError as exc:
        raise WorkerError(
            "path_policy_violation", f"{label} must be lexically beneath the workspace."
        ) from exc
    current = lexical_path
    while current != root_resolved:
        try:
            if current.is_symlink():
                raise WorkerError(
                    "path_policy_violation", f"{label} must not traverse symbolic links."
                )
        except OSError as exc:
            raise WorkerError(
                "path_policy_violation", f"Could not inspect {label} path components."
            ) from exc
        current = current.parent


def validate_input_file(path: Path, workspace: Path) -> Path:
    reject_symlink_components(path, workspace, label="input path")
    resolved = ensure_contained(path, workspace, label="input path", must_exist=True)
    try:
        source_stat = path.lstat()
        resolved_stat = resolved.stat()
    except OSError as exc:
        raise WorkerError("input_unavailable", f"Input file is unavailable: {exc}") from exc
    if stat.S_ISLNK(source_stat.st_mode):
        raise WorkerError("path_policy_violation", "Input file must not be a symbolic link.")
    if not stat.S_ISREG(resolved_stat.st_mode):
        raise WorkerError("input_unavailable", "Input path must be a regular file.")
    if resolved_stat.st_size > MAX_INPUT_BYTES:
        raise WorkerError("input_too_large", f"Input exceeds the {MAX_INPUT_BYTES}-byte limit.")
    return resolved


def prepare_output_directory(path: Path, workspace: Path) -> Path:
    reject_symlink_components(path, workspace, label="output directory")
    resolved = ensure_contained(path, workspace, label="output directory", must_exist=False)
    try:
        resolved.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(resolved, 0o700)
    except OSError as exc:
        raise WorkerError("output_unavailable", f"Cannot prepare output directory: {exc}") from exc
    if not resolved.is_dir():
        raise WorkerError("output_unavailable", "Output path must be a directory.")
    return resolved


def read_verified_input(path: Path, expected_sha256: str) -> bytes:
    try:
        flags = os.O_RDONLY
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(path, flags)
        with os.fdopen(descriptor, "rb") as source:
            source_stat = os.fstat(source.fileno())
            if not stat.S_ISREG(source_stat.st_mode):
                raise WorkerError("input_unavailable", "Input path must be a regular file.")
            payload = source.read(MAX_INPUT_BYTES + 1)
    except WorkerError:
        raise
    except OSError as exc:
        raise WorkerError("input_unavailable", f"Could not read input: {exc}") from exc
    if len(payload) > MAX_INPUT_BYTES:
        raise WorkerError("input_too_large", f"Input exceeds the {MAX_INPUT_BYTES}-byte limit.")
    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected_sha256.lower():
        raise WorkerError(
            "input_hash_mismatch",
            f"Input SHA-256 mismatch: expected {expected_sha256.lower()}, observed {actual}.",
        )
    return payload


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
