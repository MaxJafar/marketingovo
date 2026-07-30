package jobs

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/MaxJafar/AGENTintel/internal/connectors"
	"github.com/MaxJafar/AGENTintel/internal/domain"
	"github.com/MaxJafar/AGENTintel/internal/policy"
)

const (
	maximumImportBytes       int64 = 8_388_608
	minimumImportRunLifetime       = 15 * time.Minute
	importAttestationVersion       = "public-permitted-brand-competitive-research.v1"
)

type ImportError struct {
	Code string
	Err  error
}

func (err *ImportError) Error() string { return err.Code }
func (err *ImportError) Unwrap() error { return err.Err }

type importValidator interface {
	ValidateImport(context.Context, connectors.ImportValidationRequest) (connectors.ImportValidationResult, error)
}

// PreviewImport accepts bytes from an already-authenticated client. It creates
// every private path itself, hashes while copying, and never receives a client
// pathname or URL.
func (manager *Manager) PreviewImport(ctx context.Context, source io.Reader, validatedAt time.Time) (domain.ImportPreview, error) {
	if source == nil {
		return domain.ImportPreview{}, &ImportError{Code: "input_read_failed"}
	}
	validator, ok := manager.worker.(importValidator)
	if !ok {
		return domain.ImportPreview{}, &ImportError{Code: "worker_unavailable"}
	}
	jobRoot, err := os.MkdirTemp(filepath.Join(manager.dataRoot, "spool"), "import-")
	if err != nil {
		return domain.ImportPreview{}, &ImportError{Code: "input_read_failed", Err: err}
	}
	defer os.RemoveAll(jobRoot)
	if err := os.Chmod(jobRoot, 0o700); err != nil {
		return domain.ImportPreview{}, &ImportError{Code: "input_read_failed", Err: err}
	}
	if err := os.Mkdir(filepath.Join(jobRoot, "tmp"), 0o700); err != nil {
		return domain.ImportPreview{}, &ImportError{Code: "input_read_failed", Err: err}
	}
	inputPath := filepath.Join(jobRoot, "input.csv")
	digest, size, err := copyBoundedImport(source, inputPath)
	if err != nil {
		return domain.ImportPreview{}, err
	}
	if size == 0 {
		return domain.ImportPreview{}, &ImportError{Code: "input_empty"}
	}
	requestID, err := domain.NewID("import")
	if err != nil {
		return domain.ImportPreview{}, err
	}
	result, err := validator.ValidateImport(ctx, connectors.ImportValidationRequest{RequestID: requestID, WorkspacePath: jobRoot,
		InputPath: inputPath, InputSHA256: digest, InputSchemaID: domain.CompetitivePulseImportSchema, ValidatedAt: validatedAt.UTC().Truncate(time.Second)})
	if err != nil {
		return domain.ImportPreview{}, &ImportError{Code: connectors.ErrorCode(err), Err: err}
	}
	preview := domain.ImportPreview{SchemaVersion: "agentintel.import-preview.v1", Valid: result.Valid, Input: result.Input,
		Policy: result.Policy, Platform: result.Platform, Targets: result.Targets, Diagnostics: result.Diagnostics, DiagnosticsTruncated: result.DiagnosticsTruncated}
	if err := validateImportProposal(preview, requestID, digest, size); err != nil {
		return domain.ImportPreview{}, &ImportError{Code: "worker_protocol_error", Err: err}
	}
	if !preview.Valid {
		return preview, nil
	}
	// This is a Go-owned acknowledgement of the authenticated HTTP
	// attestation. The worker never receives or decides it.
	preview.Policy.AttestationVersion = importAttestationVersion
	validated := validatedAt.UTC().Truncate(time.Second)
	retention := validated.Add(time.Duration(preview.Policy.RetentionDays) * 24 * time.Hour)
	datasetID, err := domain.NewID("dataset")
	if err != nil {
		return domain.ImportPreview{}, err
	}
	preview.DatasetID, preview.State, preview.ValidatedAt, preview.RetentionUntil = datasetID, domain.DatasetReady, &validated, &retention
	snapshot := domain.InputSnapshot{RelativePath: filepath.ToSlash(filepath.Join("input-snapshots", digest+".csv")), SHA256: digest,
		SchemaID: domain.CompetitivePulseImportSchema, SizeBytes: size, DatasetID: datasetID}
	if err := manager.persistInputSnapshot(inputPath, snapshot); err != nil {
		return domain.ImportPreview{}, &ImportError{Code: "input_read_failed", Err: err}
	}
	if _, err := manager.store.CreateDataset(ctx, preview, snapshot); err != nil {
		return domain.ImportPreview{}, err
	}
	return preview, nil
}

func (manager *Manager) Dataset(ctx context.Context, id string) (domain.ImportPreview, error) {
	dataset, err := manager.store.GetDataset(ctx, id)
	return dataset.Preview, err
}

func (manager *Manager) DeleteDataset(ctx context.Context, id string) (domain.ImportPreview, error) {
	dataset, err := manager.store.MarkDatasetDeleted(ctx, id, "manual_delete")
	if err != nil {
		return domain.ImportPreview{}, err
	}
	return dataset.Preview, nil
}

func (manager *Manager) StartImportedComparison(ctx context.Context, request domain.ComparisonStartRequest) (domain.Run, error) {
	if err := policy.ValidateImportedComparison(request); err != nil {
		return domain.Run{}, err
	}
	// Imported runs never permit simulation, but the protocol still requires an
	// explicit supported arm rather than an empty map value.
	request.Simulate = "none"
	dataset, err := manager.store.GetDataset(ctx, request.DatasetID)
	if err != nil {
		return domain.Run{}, err
	}
	now := time.Now().UTC()
	if dataset.Preview.State != domain.DatasetReady {
		return domain.Run{}, &ImportError{Code: "dataset_deleted"}
	}
	if dataset.Preview.RetentionUntil == nil || !dataset.Preview.RetentionUntil.After(now) {
		return domain.Run{}, &ImportError{Code: "dataset_expired"}
	}
	if dataset.Preview.RetentionUntil.Sub(now) < minimumImportRunLifetime {
		return domain.Run{}, &ImportError{Code: "dataset_retention_too_short"}
	}
	targets := make(map[string]domain.ImportTargetSummary, len(dataset.Preview.Targets))
	for _, target := range dataset.Preview.Targets {
		targets[target.TargetID] = target
	}
	commonAvailable := false
	for _, id := range request.TargetIDs {
		if _, present := targets[id]; !present {
			return domain.Run{}, &ImportError{Code: "target_not_in_dataset"}
		}
	}
	for _, metric := range requiredImportMetrics {
		all := true
		for _, id := range request.TargetIDs {
			if targets[id].MetricAvailability[metric] != "available" {
				all = false
				break
			}
		}
		commonAvailable = commonAvailable || all
	}
	if !commonAvailable {
		return domain.Run{}, &ImportError{Code: "no_comparable_metric"}
	}
	payload, err := json.Marshal(domain.JobRequest{Comparison: &request})
	if err != nil {
		return domain.Run{}, err
	}
	run, err := manager.store.CreateRunWithSnapshot(ctx, request.ProjectID, domain.WorkflowCompare, payload, dataset.Snapshot)
	if err == nil {
		manager.signal()
	}
	return run, err
}

var requiredImportMetrics = []string{"followers.delta", "public-engagement-by-followers.median", "posting-cadence", "content-format-mix"}

func copyBoundedImport(source io.Reader, destination string) (string, int64, error) {
	output, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", 0, &ImportError{Code: "input_read_failed", Err: err}
	}
	hash := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(output, hash), io.LimitReader(source, maximumImportBytes+1))
	if copyErr == nil && written > maximumImportBytes {
		copyErr = &ImportError{Code: "input_too_large"}
	}
	if copyErr == nil {
		copyErr = output.Sync()
	}
	closeErr := output.Close()
	if copyErr != nil {
		return "", 0, copyErr
	}
	if closeErr != nil {
		return "", 0, &ImportError{Code: "input_read_failed", Err: closeErr}
	}
	return hex.EncodeToString(hash.Sum(nil)), written, nil
}

func validateImportProposal(preview domain.ImportPreview, requestID, hash string, size int64) error {
	if preview.Input.SchemaID != domain.CompetitivePulseImportSchema || preview.Input.SHA256 != hash || preview.Input.SizeBytes != size || preview.Input.RowCount == nil {
		return errors.New("input summary does not bind the supplied snapshot")
	}
	if !preview.Valid {
		return nil
	}
	if preview.Policy == nil || preview.Platform == nil || *preview.Platform == "" || preview.Policy.TargetScope != "brand" ||
		preview.Policy.DataClass != "public" || preview.Policy.PermittedPurpose != "competitive_research" || preview.Policy.RightsState != "permitted" ||
		preview.Policy.RetentionDays < 1 || preview.Policy.RetentionDays > 365 || len(preview.Targets) < 2 || len(preview.Targets) > 5 {
		return errors.New("valid import proposal is incomplete")
	}
	seen := map[string]struct{}{}
	for index, target := range preview.Targets {
		if target.TargetID == "" || target.TargetName == "" || target.RowCount < 1 || (index > 0 && preview.Targets[index-1].TargetID >= target.TargetID) {
			return errors.New("target summaries are invalid or unordered")
		}
		if _, duplicate := seen[target.TargetID]; duplicate {
			return errors.New("target summaries are duplicated")
		}
		seen[target.TargetID] = struct{}{}
		if len(target.MetricAvailability) != len(requiredImportMetrics) {
			return errors.New("target metric availability is incomplete")
		}
		for _, metric := range requiredImportMetrics {
			if !slices.Contains([]string{"missing", "insufficient", "contradictory", "available"}, target.MetricAvailability[metric]) {
				return errors.New("target metric availability is invalid")
			}
		}
	}
	_ = requestID // correlation is verified by the connector before this projection is returned.
	return nil
}
