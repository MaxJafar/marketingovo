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

// CreateDataset persists only an opaque projection and a daemon-created
// immutable snapshot reference. The uploaded filename and private spool path
// are intentionally never stored here.
func (store *Store) CreateDataset(ctx context.Context, preview domain.ImportPreview, snapshot domain.InputSnapshot) (domain.Dataset, error) {
	if !preview.Valid || preview.DatasetID == "" || preview.ValidatedAt == nil || preview.RetentionUntil == nil ||
		snapshot.RelativePath == "" || snapshot.SHA256 == "" || snapshot.SchemaID == "" || snapshot.SizeBytes < 0 {
		return domain.Dataset{}, fmt.Errorf("invalid dataset record")
	}
	payload, err := json.Marshal(preview)
	if err != nil {
		return domain.Dataset{}, err
	}
	now := time.Now().UTC()
	_, err = store.db.ExecContext(ctx, `INSERT INTO datasets(
id,state,preview_json,input_relative_path,input_sha256,input_schema_id,input_size_bytes,
validated_at,retention_until,input_parser_version,metric_catalog_version,created_at,updated_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, preview.DatasetID, preview.State, payload, snapshot.RelativePath, snapshot.SHA256,
		snapshot.SchemaID, snapshot.SizeBytes, formatTime(*preview.ValidatedAt), formatTime(*preview.RetentionUntil),
		domain.CompetitivePulseParserVersion, domain.CompetitivePulseMetricCatalog, formatTime(now), formatTime(now))
	if err != nil {
		return domain.Dataset{}, fmt.Errorf("insert dataset: %w", err)
	}
	return store.GetDataset(ctx, preview.DatasetID)
}

func (store *Store) GetDataset(ctx context.Context, id string) (domain.Dataset, error) {
	row := store.db.QueryRowContext(ctx, `SELECT state,preview_json,input_relative_path,input_sha256,input_schema_id,input_size_bytes,
validated_at,retention_until,input_parser_version,metric_catalog_version,deletion_reason,created_at
FROM datasets WHERE id=?`, id)
	return scanDataset(row, id)
}

func (store *Store) MarkDatasetDeleted(ctx context.Context, id, reason string) (domain.Dataset, error) {
	current, err := store.GetDataset(ctx, id)
	if err != nil {
		return domain.Dataset{}, err
	}
	if current.Preview.State == domain.DatasetDeleted {
		return current, nil
	}
	current.Preview.State = domain.DatasetDeleted
	payload, err := json.Marshal(current.Preview)
	if err != nil {
		return domain.Dataset{}, err
	}
	now := time.Now().UTC()
	result, err := store.db.ExecContext(ctx, `UPDATE datasets SET state='deleted',preview_json=?,deletion_reason=?,updated_at=?
WHERE id=? AND state IN ('ready','deleting')`, payload, reason, formatTime(now), id)
	if err != nil {
		return domain.Dataset{}, err
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return store.GetDataset(ctx, id)
	}
	return store.GetDataset(ctx, id)
}

func scanDataset(row scanner, id string) (domain.Dataset, error) {
	var record domain.Dataset
	var state string
	var payload []byte
	var validated, retention, created string
	if err := row.Scan(&state, &payload, &record.Snapshot.RelativePath, &record.Snapshot.SHA256, &record.Snapshot.SchemaID,
		&record.Snapshot.SizeBytes, &validated, &retention, &record.InputParserVersion, &record.MetricCatalogVersion,
		&record.DeletionReason, &created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Dataset{}, ErrNotFound
		}
		return domain.Dataset{}, err
	}
	if err := json.Unmarshal(payload, &record.Preview); err != nil {
		return domain.Dataset{}, fmt.Errorf("decode dataset preview: %w", err)
	}
	if record.Preview.DatasetID != id || record.Preview.State != domain.DatasetState(state) {
		return domain.Dataset{}, fmt.Errorf("dataset projection does not match durable identity")
	}
	var err error
	if record.CreatedAt, err = parseTime(created); err != nil {
		return domain.Dataset{}, err
	}
	// The JSON projection is authority output, but these fields are also checked
	// from relational values so a corrupt row cannot lengthen retention.
	validatedAt, err := parseTime(validated)
	if err != nil {
		return domain.Dataset{}, err
	}
	retentionUntil, err := parseTime(retention)
	if err != nil {
		return domain.Dataset{}, err
	}
	record.Preview.ValidatedAt = &validatedAt
	record.Preview.RetentionUntil = &retentionUntil
	record.Snapshot.DatasetID = id
	return record, nil
}
