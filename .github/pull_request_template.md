## Gates run locally

- [ ] `pnpm check`
- [ ] `go build ./...`
- [ ] `go vet ./...`
- [ ] `go test -race ./...`
- [ ] `uv sync --project workers/intelligence --dev --frozen`
- [ ] `uv run --project workers/intelligence ruff check workers/intelligence`
- [ ] `uv run --project workers/intelligence pytest workers/intelligence/tests`
- [ ] `cargo check --locked --manifest-path apps/desktop/src-tauri/Cargo.toml`
- [ ] `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check`
- [ ] `cargo clippy --locked --all-targets --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings`
- [ ] `BUF_BREAKING_AGAINST=".git#tag=v1.0.0" pnpm contracts:breaking`

## Gate integrity declaration

- [ ] I ran the listed gates relevant to this change.
- [ ] I did not weaken, bypass, or disable any existing gate.
