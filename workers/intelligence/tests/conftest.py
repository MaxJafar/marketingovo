from __future__ import annotations

import hashlib
from pathlib import Path

import pytest


@pytest.fixture
def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]


@pytest.fixture
def fixture_path(repository_root: Path) -> Path:
    return repository_root / "fixtures/competitive-pulse/raw/observations.ndjson"


@pytest.fixture
def fixture_sha256(fixture_path: Path) -> str:
    return hashlib.sha256(fixture_path.read_bytes()).hexdigest()


@pytest.fixture
def target_ids() -> list[str]:
    return ["northstar-labs", "orbit-coffee", "vertex-studio"]
