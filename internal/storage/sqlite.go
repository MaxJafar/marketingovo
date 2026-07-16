package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db   *sql.DB
	path string
}

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("state conflict")
)

const schemaV1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workflow TEXT NOT NULL CHECK(workflow IN ('compare','research')),
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','partial','failed','cancelled')),
  progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
  stage TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  replay_of TEXT REFERENCES runs(id) ON DELETE SET NULL,
  error_code TEXT,
  error_message TEXT,
  report_available INTEGER NOT NULL DEFAULT 0 CHECK(report_available IN (0,1)),
  request_json BLOB NOT NULL,
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
  cancel_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_runs_queue ON runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence >= 1),
  stage TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('debug','info','warning','error')),
  message TEXT NOT NULL,
  progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
  recorded_at TEXT NOT NULL,
  UNIQUE(run_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_run_events_order ON run_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('arrow','parquet','report','raw','manifest')),
  relative_path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  row_count INTEGER NOT NULL DEFAULT 0 CHECK(row_count >= 0),
  schema_id TEXT NOT NULL,
  data_class TEXT NOT NULL CHECK(data_class IN ('public','first_party','licensed_business_contact','restricted')),
  created_at TEXT NOT NULL,
  UNIQUE(run_id, relative_path)
);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_kind ON artifacts(run_id, kind);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('organization','brand','creator','professional_profile','social_account')),
  display_name TEXT NOT NULL,
  resolution_state TEXT NOT NULL CHECK(resolution_state IN ('observed','candidate','confirmed','rejected')),
  identifiers_json BLOB NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(display_name);

CREATE TABLE IF NOT EXISTS run_entities (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY(run_id, entity_id)
);

CREATE TABLE IF NOT EXISTS search_documents (
  document_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('entity','report','claim','observation')),
  item_id TEXT NOT NULL,
  label TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_documents_label ON search_documents(label);
`

const schemaV2 = `
ALTER TABLE runs ADD COLUMN worker_version TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN model_version TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN connector_version TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN parser_version TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN input_relative_path TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN input_sha256 TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN input_schema_id TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN input_size_bytes INTEGER NOT NULL DEFAULT 0;
`

func Open(path string) (*Store, error) {
	if path == "" {
		return nil, fmt.Errorf("database path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	store := &Store{db: db, path: path}
	if err := store.initialize(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := os.Chmod(path, 0o600); err != nil && !errors.Is(err, os.ErrNotExist) {
		_ = db.Close()
		return nil, fmt.Errorf("harden database permissions: %w", err)
	}
	if err := store.RecoverInterruptedRuns(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (store *Store) initialize(ctx context.Context) error {
	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA busy_timeout=8000",
		"PRAGMA synchronous=NORMAL",
	} {
		if _, err := store.db.ExecContext(ctx, pragma); err != nil {
			return fmt.Errorf("configure sqlite (%s): %w", pragma, err)
		}
	}
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	if _, err := transaction.ExecContext(ctx, schemaV1); err != nil {
		return fmt.Errorf("apply schema v1: %w", err)
	}
	if _, err := transaction.ExecContext(ctx,
		"INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,?)",
		time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		return err
	}
	var migratedV2 int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_migrations WHERE version=2").Scan(&migratedV2); err != nil {
		return err
	}
	if migratedV2 == 0 {
		if _, err := transaction.ExecContext(ctx, schemaV2); err != nil {
			return fmt.Errorf("apply schema v2: %w", err)
		}
		if _, err := transaction.ExecContext(ctx,
			"INSERT INTO schema_migrations(version,applied_at) VALUES(2,?)",
			time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
			return err
		}
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	return nil
}

func (store *Store) Close() error { return store.db.Close() }

func (store *Store) Ping(ctx context.Context) error { return store.db.PingContext(ctx) }

func (store *Store) Path() string { return store.path }

func (store *Store) RecoverInterruptedRuns(ctx context.Context) error {
	type interruptedRun struct {
		id              string
		cancelRequested bool
		cancelReason    string
	}
	rows, err := store.db.QueryContext(ctx, "SELECT id,cancel_requested,cancel_reason FROM runs WHERE status='running'")
	if err != nil {
		return err
	}
	var interrupted []interruptedRun
	for rows.Next() {
		var run interruptedRun
		if err := rows.Scan(&run.id, &run.cancelRequested, &run.cancelReason); err != nil {
			rows.Close()
			return err
		}
		interrupted = append(interrupted, run)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, run := range interrupted {
		now := time.Now().UTC()
		transaction, err := store.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if run.cancelRequested {
			result, updateErr := transaction.ExecContext(ctx, `UPDATE runs
SET status='cancelled',stage='cancelled',progress=1,completed_at=?,updated_at=?
WHERE id=? AND status='running'`, formatTime(now), formatTime(now), run.id)
			if updateErr == nil {
				if count, _ := result.RowsAffected(); count == 0 {
					updateErr = ErrConflict
				}
			}
			if updateErr == nil {
				_, updateErr = addEventTx(ctx, transaction, run.id, "cancelled", "warning", cancellationMessage(run.cancelReason), 1, now)
			}
			if updateErr != nil {
				transaction.Rollback()
				return updateErr
			}
		} else {
			result, updateErr := transaction.ExecContext(ctx, `UPDATE runs
SET status='queued',stage='recovered',progress=0,started_at=NULL,updated_at=?
			WHERE id=? AND status='running'`, formatTime(now), run.id)
			if updateErr == nil {
				if count, _ := result.RowsAffected(); count == 0 {
					updateErr = ErrConflict
				}
			}
			if updateErr == nil {
				_, updateErr = addEventTx(ctx, transaction, run.id, "recovered", "warning", "Interrupted run recovered; published evidence will be revalidated before retry", 0, now)
			}
			if updateErr != nil {
				transaction.Rollback()
				return updateErr
			}
		}
		if err := transaction.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func formatTime(value time.Time) string { return value.UTC().Format(time.RFC3339Nano) }

func parseTime(value string) (time.Time, error) { return time.Parse(time.RFC3339Nano, value) }
