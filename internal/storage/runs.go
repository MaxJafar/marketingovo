package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/domain"
)

const runColumns = `id,project_id,workflow,status,progress,stage,created_at,started_at,
completed_at,updated_at,replay_of,error_code,error_message,report_available,request_json,
cancel_requested,cancel_reason,worker_version,model_version,connector_version,parser_version,
input_relative_path,input_sha256,input_schema_id,input_size_bytes`

type scanner interface{ Scan(...any) error }

func (store *Store) CreateRun(ctx context.Context, projectID string, workflow domain.Workflow, requestJSON []byte, replayOf *string) (domain.Run, error) {
	return store.createRun(ctx, projectID, workflow, requestJSON, replayOf, domain.InputSnapshot{})
}

func (store *Store) createRun(ctx context.Context, projectID string, workflow domain.Workflow, requestJSON []byte, replayOf *string, snapshot domain.InputSnapshot) (domain.Run, error) {
	if !json.Valid(requestJSON) {
		return domain.Run{}, fmt.Errorf("request snapshot is not valid JSON")
	}
	id, err := domain.NewID("run")
	if err != nil {
		return domain.Run{}, err
	}
	now := time.Now().UTC()
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Run{}, err
	}
	defer transaction.Rollback()
	_, err = transaction.ExecContext(ctx, `INSERT INTO runs(
id,project_id,workflow,status,progress,stage,created_at,updated_at,replay_of,request_json,
input_relative_path,input_sha256,input_schema_id,input_size_bytes)
VALUES(?,?,?,'queued',0,'queued',?,?,?,?,?,?,?,?)`, id, projectID, workflow, formatTime(now), formatTime(now), nullableString(replayOf), requestJSON,
		snapshot.RelativePath, snapshot.SHA256, snapshot.SchemaID, snapshot.SizeBytes)
	if err != nil {
		return domain.Run{}, fmt.Errorf("insert run: %w", err)
	}
	if _, err := addEventTx(ctx, transaction, id, "queued", "info", "Run accepted into the durable queue", 0, now); err != nil {
		return domain.Run{}, err
	}
	if err := transaction.Commit(); err != nil {
		return domain.Run{}, err
	}
	return store.GetRun(ctx, id)
}

func (store *Store) SetInputSnapshot(ctx context.Context, runID string, snapshot domain.InputSnapshot) error {
	if snapshot.RelativePath == "" || len(snapshot.SHA256) != 64 || snapshot.SchemaID == "" || snapshot.SizeBytes <= 0 {
		return fmt.Errorf("invalid input snapshot metadata")
	}
	result, err := store.db.ExecContext(ctx, `UPDATE runs SET input_relative_path=?,input_sha256=?,input_schema_id=?,input_size_bytes=?,updated_at=?
WHERE id=? AND status='running' AND (input_sha256='' OR input_sha256=?)`, snapshot.RelativePath, snapshot.SHA256,
		snapshot.SchemaID, snapshot.SizeBytes, formatTime(time.Now().UTC()), runID, snapshot.SHA256)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	return nil
}

func (store *Store) SetProvenance(ctx context.Context, runID string, provenance domain.Provenance) error {
	result, err := store.db.ExecContext(ctx, `UPDATE runs SET worker_version=?,model_version=?,connector_version=?,parser_version=?,updated_at=?
WHERE id=? AND status='running'`, provenance.WorkerVersion, provenance.ModelVersion, provenance.ConnectorVersion,
		provenance.ParserVersion, formatTime(time.Now().UTC()), runID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	return nil
}

func (store *Store) GetRun(ctx context.Context, id string) (domain.Run, error) {
	row := store.db.QueryRowContext(ctx, "SELECT "+runColumns+" FROM runs WHERE id=?", id)
	run, err := scanRun(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Run{}, ErrNotFound
	}
	return run, err
}

func (store *Store) ListRuns(ctx context.Context, projectID string, limit int) ([]domain.Run, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	query := "SELECT " + runColumns + " FROM runs"
	arguments := []any{}
	if projectID != "" {
		query += " WHERE project_id=?"
		arguments = append(arguments, projectID)
	}
	query += " ORDER BY created_at DESC LIMIT ?"
	arguments = append(arguments, limit)
	rows, err := store.db.QueryContext(ctx, query, arguments...)
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

func (store *Store) ClaimNextRun(ctx context.Context) (domain.Run, error) {
	now := time.Now().UTC()
	row := store.db.QueryRowContext(ctx, `UPDATE runs
SET status='running',stage='starting',progress=0.02,started_at=?,updated_at=?
WHERE id=(SELECT id FROM runs WHERE status='queued' ORDER BY created_at LIMIT 1)
RETURNING `+runColumns, formatTime(now), formatTime(now))
	run, err := scanRun(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Run{}, ErrNotFound
	}
	if err != nil {
		return domain.Run{}, err
	}
	if _, err := store.AddEvent(ctx, run.ID, "starting", "info", "Run worker started", 0.02); err != nil {
		return domain.Run{}, err
	}
	return store.GetRun(ctx, run.ID)
}

func (store *Store) AddEvent(ctx context.Context, runID, stage, level, message string, progress float64) (domain.RunEvent, error) {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.RunEvent{}, err
	}
	defer transaction.Rollback()
	event, err := addEventTx(ctx, transaction, runID, stage, level, message, progress, time.Now().UTC())
	if err != nil {
		return domain.RunEvent{}, err
	}
	if err := transaction.Commit(); err != nil {
		return domain.RunEvent{}, err
	}
	return event, nil
}

func addEventTx(ctx context.Context, transaction *sql.Tx, runID, stage, level, message string, progress float64, recordedAt time.Time) (domain.RunEvent, error) {
	id, err := domain.NewID("event")
	if err != nil {
		return domain.RunEvent{}, err
	}
	var sequence int64
	if err := transaction.QueryRowContext(ctx, "SELECT COALESCE(MAX(sequence),0)+1 FROM run_events WHERE run_id=?", runID).Scan(&sequence); err != nil {
		return domain.RunEvent{}, err
	}
	if _, err := transaction.ExecContext(ctx, `INSERT INTO run_events(id,run_id,sequence,stage,level,message,progress,recorded_at)
VALUES(?,?,?,?,?,?,?,?)`, id, runID, sequence, stage, level, message, clampProgress(progress), formatTime(recordedAt)); err != nil {
		return domain.RunEvent{}, err
	}
	return domain.RunEvent{ID: id, RunID: runID, Sequence: sequence, Stage: stage, Level: level, Message: message, Progress: clampProgress(progress), RecordedAt: recordedAt}, nil
}

func (store *Store) SetProgress(ctx context.Context, runID, stage, level, message string, progress float64) error {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	now := time.Now().UTC()
	result, err := transaction.ExecContext(ctx, "UPDATE runs SET stage=?,progress=?,updated_at=? WHERE id=? AND status='running'", stage, clampProgress(progress), formatTime(now), runID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	if _, err := addEventTx(ctx, transaction, runID, stage, level, message, progress, now); err != nil {
		return err
	}
	return transaction.Commit()
}

func (store *Store) RequestCancel(ctx context.Context, runID, reason string) (domain.Run, error) {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Run{}, err
	}
	defer transaction.Rollback()
	var status domain.RunStatus
	if err := transaction.QueryRowContext(ctx, "SELECT status FROM runs WHERE id=?", runID).Scan(&status); errors.Is(err, sql.ErrNoRows) {
		return domain.Run{}, ErrNotFound
	} else if err != nil {
		return domain.Run{}, err
	}
	if status.Terminal() {
		return domain.Run{}, ErrConflict
	}
	now := time.Now().UTC()
	if status == domain.RunQueued {
		_, err = transaction.ExecContext(ctx, `UPDATE runs SET status='cancelled',stage='cancelled',progress=0,
cancel_requested=1,cancel_reason=?,completed_at=?,updated_at=? WHERE id=?`, reason, formatTime(now), formatTime(now), runID)
		if err == nil {
			_, err = addEventTx(ctx, transaction, runID, "cancelled", "warning", cancellationMessage(reason), 0, now)
		}
	} else {
		_, err = transaction.ExecContext(ctx, `UPDATE runs SET cancel_requested=1,cancel_reason=?,stage='cancelling',updated_at=? WHERE id=?`, reason, formatTime(now), runID)
		if err == nil {
			_, err = addEventTx(ctx, transaction, runID, "cancelling", "warning", cancellationMessage(reason), 0, now)
		}
	}
	if err != nil {
		return domain.Run{}, err
	}
	if err := transaction.Commit(); err != nil {
		return domain.Run{}, err
	}
	return store.GetRun(ctx, runID)
}

func (store *Store) MarkFailed(ctx context.Context, runID, code, message string) error {
	return store.finish(ctx, runID, domain.RunFailed, "failed", "error", message, code, message, false)
}

func (store *Store) MarkCancelled(ctx context.Context, runID, message string) error {
	return store.finish(ctx, runID, domain.RunCancelled, "cancelled", "warning", message, "", "", false)
}

func (store *Store) finish(ctx context.Context, runID string, status domain.RunStatus, stage, level, eventMessage, code, message string, report bool) error {
	transaction, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer transaction.Rollback()
	now := time.Now().UTC()
	var errorCode, errorMessage any
	if code != "" {
		errorCode = code
	}
	if message != "" {
		errorMessage = message
	}
	result, err := transaction.ExecContext(ctx, `UPDATE runs SET status=?,stage=?,progress=1,completed_at=?,updated_at=?,error_code=?,error_message=?,report_available=? WHERE id=? AND status='running'`, status, stage, formatTime(now), formatTime(now), errorCode, errorMessage, boolInt(report), runID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return ErrConflict
	}
	if _, err := addEventTx(ctx, transaction, runID, stage, level, eventMessage, 1, now); err != nil {
		return err
	}
	return transaction.Commit()
}

func (store *Store) ReplayRun(ctx context.Context, sourceID string) (domain.Run, error) {
	source, err := store.GetRun(ctx, sourceID)
	if err != nil {
		return domain.Run{}, err
	}
	if !source.Status.Terminal() {
		return domain.Run{}, ErrConflict
	}
	snapshot := domain.InputSnapshot{RelativePath: source.InputRelativePath, SHA256: source.InputSHA256, SchemaID: source.InputSchemaID, SizeBytes: source.InputSizeBytes}
	if snapshot.RelativePath == "" || snapshot.SHA256 == "" {
		return domain.Run{}, fmt.Errorf("source run has no immutable input snapshot")
	}
	return store.createRun(ctx, source.ProjectID, source.Workflow, source.RequestJSON, &sourceID, snapshot)
}

func (store *Store) ListEventsAfter(ctx context.Context, runID string, after int64, limit int) ([]domain.RunEvent, error) {
	if limit < 1 || limit > 500 {
		limit = 200
	}
	rows, err := store.db.QueryContext(ctx, `SELECT id,run_id,sequence,stage,level,message,progress,recorded_at
FROM run_events WHERE run_id=? AND sequence>? ORDER BY sequence LIMIT ?`, runID, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]domain.RunEvent, 0)
	for rows.Next() {
		var event domain.RunEvent
		var recorded string
		if err := rows.Scan(&event.ID, &event.RunID, &event.Sequence, &event.Stage, &event.Level, &event.Message, &event.Progress, &recorded); err != nil {
			return nil, err
		}
		event.RecordedAt, err = parseTime(recorded)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func scanRun(row scanner) (domain.Run, error) {
	var run domain.Run
	var workflow, status string
	var created, updated string
	var started, completed, replayOf, errorCode, errorMessage sql.NullString
	var reportAvailable, cancelRequested int
	if err := row.Scan(
		&run.ID, &run.ProjectID, &workflow, &status, &run.Progress, &run.Stage, &created, &started,
		&completed, &updated, &replayOf, &errorCode, &errorMessage, &reportAvailable, &run.RequestJSON,
		&cancelRequested, &run.CancelReason,
		&run.WorkerVersion, &run.ModelVersion, &run.ConnectorVersion, &run.ParserVersion,
		&run.InputRelativePath, &run.InputSHA256, &run.InputSchemaID, &run.InputSizeBytes,
	); err != nil {
		return domain.Run{}, err
	}
	run.Workflow, run.Status = domain.Workflow(workflow), domain.RunStatus(status)
	var err error
	if run.CreatedAt, err = parseTime(created); err != nil {
		return domain.Run{}, err
	}
	if run.UpdatedAt, err = parseTime(updated); err != nil {
		return domain.Run{}, err
	}
	run.StartedAt, err = nullableTime(started)
	if err != nil {
		return domain.Run{}, err
	}
	run.CompletedAt, err = nullableTime(completed)
	if err != nil {
		return domain.Run{}, err
	}
	if replayOf.Valid {
		run.ReplayOf = &replayOf.String
	}
	if errorCode.Valid {
		run.ErrorCode = &errorCode.String
	}
	if errorMessage.Valid {
		run.ErrorMessage = &errorMessage.String
	}
	run.ReportAvailable = reportAvailable == 1
	run.CancelRequested = cancelRequested == 1
	return run, nil
}

func nullableTime(value sql.NullString) (*time.Time, error) {
	if !value.Valid {
		return nil, nil
	}
	parsed, err := parseTime(value.String)
	return &parsed, err
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func clampProgress(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func cancellationMessage(reason string) string {
	if reason == "" {
		return "Cancellation requested"
	}
	return "Cancellation requested: " + reason
}
