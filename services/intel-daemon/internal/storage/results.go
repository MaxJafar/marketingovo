package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
)

func (store *Store) CompleteRun(ctx context.Context, runID string, artifacts []domain.Artifact, entities []domain.Entity, documents []domain.SearchDocument, partial bool) error {
	return store.CompleteRunWithProvenance(ctx, runID, artifacts, entities, documents, partial, domain.Provenance{})
}

func (store *Store) CompleteRunWithProvenance(ctx context.Context, runID string, artifacts []domain.Artifact, entities []domain.Entity, documents []domain.SearchDocument, partial bool, provenance domain.Provenance) error {
	return store.completeRun(ctx, runID, artifacts, entities, documents, partial, provenance, domain.RunRunning, "", "Evidence manifest and report committed")
}

// CompleteRecoveredRun finalizes evidence that was atomically published before
// the previous daemon could commit its SQLite result transaction. Callers must
// physically revalidate the committed manifest and every artifact first.
func (store *Store) CompleteRecoveredRun(ctx context.Context, runID string, artifacts []domain.Artifact, entities []domain.Entity, documents []domain.SearchDocument, provenance domain.Provenance) error {
	return store.completeRun(ctx, runID, artifacts, entities, documents, false, provenance, domain.RunQueued, "recovered", "Recovered and revalidated an interrupted evidence commit")
}

func (store *Store) completeRun(ctx context.Context, runID string, artifacts []domain.Artifact, entities []domain.Entity, documents []domain.SearchDocument, partial bool, provenance domain.Provenance, expectedStatus domain.RunStatus, expectedStage, eventMessage string) error {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	var currentStatus domain.RunStatus
	var currentStage string
	var cancelRequested int
	if err := transaction.QueryRowContext(ctx, "SELECT status,stage,cancel_requested FROM runs WHERE id=?", runID).Scan(&currentStatus, &currentStage, &cancelRequested); errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if currentStatus != expectedStatus || cancelRequested != 0 || expectedStage != "" && currentStage != expectedStage {
		return ErrConflict
	}
	for _, artifact := range artifacts {
		if _, err := transaction.ExecContext(ctx, `INSERT INTO artifacts(
id,run_id,kind,relative_path,media_type,sha256,size_bytes,row_count,schema_id,data_class,created_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?)`, artifact.ID, runID, artifact.Kind, artifact.RelativePath, artifact.MediaType,
			artifact.SHA256, artifact.SizeBytes, artifact.RowCount, artifact.SchemaID, artifact.DataClass, formatTime(artifact.CreatedAt)); err != nil {
			return fmt.Errorf("insert artifact: %w", err)
		}
	}
	for _, entity := range entities {
		identifiers, err := json.Marshal(entity.Identifiers)
		if err != nil {
			return err
		}
		if _, err := transaction.ExecContext(ctx, `INSERT INTO entities(id,type,display_name,resolution_state,identifiers_json,updated_at)
VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,display_name=excluded.display_name,
resolution_state=excluded.resolution_state,identifiers_json=excluded.identifiers_json,updated_at=excluded.updated_at`,
			entity.ID, entity.Type, entity.DisplayName, entity.ResolutionState, identifiers, formatTime(entity.UpdatedAt)); err != nil {
			return fmt.Errorf("upsert entity: %w", err)
		}
		if _, err := transaction.ExecContext(ctx, "INSERT OR IGNORE INTO run_entities(run_id,entity_id) VALUES(?,?)", runID, entity.ID); err != nil {
			return err
		}
	}
	now := time.Now().UTC()
	for _, document := range documents {
		documentID := searchDocumentID(document)
		if _, err := transaction.ExecContext(ctx, `INSERT INTO search_documents(document_id,kind,item_id,label,excerpt,confidence,run_id,updated_at)
VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(document_id) DO UPDATE SET label=excluded.label,excerpt=excluded.excerpt,
confidence=excluded.confidence,updated_at=excluded.updated_at`, documentID, document.Kind, document.ID,
			document.Label, document.Excerpt, document.Confidence, nullableString(document.RunID), formatTime(now)); err != nil {
			return fmt.Errorf("upsert search document: %w", err)
		}
	}
	status := domain.RunSucceeded
	if partial {
		status = domain.RunPartial
	}
	result, err := transaction.ExecContext(ctx, `UPDATE runs SET status=?,stage='complete',progress=1,completed_at=?,updated_at=?,
report_available=1,error_code=NULL,error_message=NULL,worker_version=?,model_version=?,connector_version=?,parser_version=?
WHERE id=? AND status=? AND stage=? AND cancel_requested=0`, status, formatTime(now), formatTime(now), provenance.WorkerVersion,
		provenance.ModelVersion, provenance.ConnectorVersion, provenance.ParserVersion, runID, expectedStatus, currentStage)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	if _, err := addEventTx(ctx, transaction, runID, "complete", "info", eventMessage, 1, now); err != nil {
		return err
	}
	return transaction.Commit()
}

func (store *Store) ListRecoveredRuns(ctx context.Context) ([]domain.Run, error) {
	rows, err := store.db.QueryContext(ctx, "SELECT "+runColumns+" FROM runs WHERE status='queued' AND stage='recovered' ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	runs := make([]domain.Run, 0)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

func (store *Store) MarkRecoveredFailed(ctx context.Context, runID, code, message string) error {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	now := time.Now().UTC()
	// A recovered run normally has no SQLite projections because its original
	// completion transaction never committed. Clear any anomalous leftovers as
	// well, so a failed recovery can never expose a stale report or search hit.
	for _, statement := range []string{
		"DELETE FROM artifacts WHERE run_id=?",
		"DELETE FROM run_entities WHERE run_id=?",
		"DELETE FROM search_documents WHERE run_id=?",
	} {
		if _, err := transaction.ExecContext(ctx, statement, runID); err != nil {
			return err
		}
	}
	result, err := transaction.ExecContext(ctx, `UPDATE runs SET status='failed',stage='recovery_failed',progress=1,
completed_at=?,updated_at=?,error_code=?,error_message=?,report_available=0
WHERE id=? AND status='queued' AND stage='recovered'`, formatTime(now), formatTime(now), code, message, runID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	if _, err := addEventTx(ctx, transaction, runID, "recovery_failed", "error", message, 1, now); err != nil {
		return err
	}
	return transaction.Commit()
}

func (store *Store) RunDetail(ctx context.Context, runID string) (domain.RunDetail, error) {
	run, err := store.GetRun(ctx, runID)
	if err != nil {
		return domain.RunDetail{}, err
	}
	events, err := store.ListEventsAfter(ctx, runID, 0, 500)
	if err != nil {
		return domain.RunDetail{}, err
	}
	artifacts, err := store.ListArtifacts(ctx, runID)
	if err != nil {
		return domain.RunDetail{}, err
	}
	return domain.RunDetail{Run: run, Events: events, Artifacts: artifacts}, nil
}

func (store *Store) ListArtifacts(ctx context.Context, runID string) ([]domain.Artifact, error) {
	rows, err := store.db.QueryContext(ctx, `SELECT id,run_id,kind,relative_path,media_type,sha256,size_bytes,row_count,schema_id,data_class,created_at
FROM artifacts WHERE run_id=? ORDER BY created_at,id`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	artifacts := make([]domain.Artifact, 0)
	for rows.Next() {
		artifact, err := scanArtifact(rows)
		if err != nil {
			return nil, err
		}
		artifacts = append(artifacts, artifact)
	}
	return artifacts, rows.Err()
}

func (store *Store) ReportArtifact(ctx context.Context, runID string) (domain.Artifact, error) {
	row := store.db.QueryRowContext(ctx, `SELECT id,run_id,kind,relative_path,media_type,sha256,size_bytes,row_count,schema_id,data_class,created_at
FROM artifacts WHERE run_id=? AND kind='report' ORDER BY created_at DESC LIMIT 1`, runID)
	artifact, err := scanArtifact(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Artifact{}, ErrNotFound
	}
	return artifact, err
}

func scanArtifact(row scanner) (domain.Artifact, error) {
	var artifact domain.Artifact
	var created string
	if err := row.Scan(&artifact.ID, &artifact.RunID, &artifact.Kind, &artifact.RelativePath, &artifact.MediaType,
		&artifact.SHA256, &artifact.SizeBytes, &artifact.RowCount, &artifact.SchemaID, &artifact.DataClass, &created); err != nil {
		return domain.Artifact{}, err
	}
	var err error
	artifact.CreatedAt, err = parseTime(created)
	return artifact, err
}

func (store *Store) GetEntity(ctx context.Context, entityID string) (domain.Entity, error) {
	var entity domain.Entity
	var identifiers []byte
	var updated string
	err := store.db.QueryRowContext(ctx, `SELECT id,type,display_name,resolution_state,identifiers_json,updated_at
FROM entities WHERE id=?`, entityID).Scan(&entity.ID, &entity.Type, &entity.DisplayName, &entity.ResolutionState, &identifiers, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Entity{}, ErrNotFound
	}
	if err != nil {
		return domain.Entity{}, err
	}
	if err := json.Unmarshal(identifiers, &entity.Identifiers); err != nil {
		return domain.Entity{}, err
	}
	entity.UpdatedAt, err = parseTime(updated)
	return entity, err
}

func (store *Store) Search(ctx context.Context, query string, limit int) ([]domain.SearchResult, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}
	pattern := "%" + escapeLike(strings.ToLower(query)) + "%"
	rows, err := store.db.QueryContext(ctx, `SELECT kind,item_id,label,excerpt,confidence,run_id
FROM search_documents WHERE lower(label) LIKE ? ESCAPE '\' OR lower(excerpt) LIKE ? ESCAPE '\'
ORDER BY confidence DESC,updated_at DESC LIMIT ?`, pattern, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := make([]domain.SearchResult, 0)
	for rows.Next() {
		var result domain.SearchResult
		var runID sql.NullString
		if err := rows.Scan(&result.Kind, &result.ID, &result.Label, &result.Excerpt, &result.Confidence, &runID); err != nil {
			return nil, err
		}
		if runID.Valid {
			result.RunID = &runID.String
		}
		results = append(results, result)
	}
	return results, rows.Err()
}

func (store *Store) RunCounts(ctx context.Context) (queued, running int, err error) {
	rows, err := store.db.QueryContext(ctx, "SELECT status,COUNT(*) FROM runs WHERE status IN ('queued','running') GROUP BY status")
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return 0, 0, err
		}
		if status == "queued" {
			queued = count
		} else if status == "running" {
			running = count
		}
	}
	return queued, running, rows.Err()
}

func searchDocumentID(document domain.SearchDocument) string {
	run := "global"
	if document.RunID != nil {
		run = *document.RunID
	}
	return document.Kind + ":" + document.ID + ":" + run
}

func escapeLike(value string) string {
	replacer := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_")
	return replacer.Replace(value)
}
