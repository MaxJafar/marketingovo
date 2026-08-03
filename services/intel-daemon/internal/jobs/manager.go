package jobs

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/connectors"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/domain"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/governance"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/policy"
	"github.com/MaxJafar/marketingovo/services/intel-daemon/internal/storage"
)

const maximumFixtureBytes int64 = 128 << 20

const (
	recoveryEvidenceCorruptCode    = "recovery_evidence_corrupt"
	recoveryEvidencePathCode       = "recovery_evidence_path_violation"
	recoveryEvidenceTooLargeCode   = "recovery_evidence_too_large"
	recoveryProjectionMismatchCode = "recovery_projection_mismatch"

	recoveryEvidenceCorruptMessage    = "Recovered evidence failed integrity validation"
	recoveryEvidencePathMessage       = "Recovered evidence violated filesystem safety policy"
	recoveryEvidenceTooLargeMessage   = "Recovered evidence exceeds the configured safety limit"
	recoveryProjectionMismatchMessage = "Recovered evidence does not support its derived projections"
)

type Config struct {
	Store        *storage.Store
	DataRoot     string
	FixturePath  string
	Worker       connectors.Worker
	Concurrency  int
	PollInterval time.Duration
}

// Manager is a durable, bounded scheduler. SQLite is the queue authority;
// in-memory state exists only to deliver cancellation to active subprocesses.
type Manager struct {
	store        *storage.Store
	dataRoot     string
	fixturePath  string
	worker       connectors.Worker
	concurrency  int
	pollInterval time.Duration

	mu      sync.Mutex
	started bool
	ctx     context.Context
	cancel  context.CancelFunc
	active  map[string]context.CancelFunc
	notify  chan struct{}
	wg      sync.WaitGroup
}

func New(config Config) (*Manager, error) {
	if config.Store == nil || config.Worker == nil {
		return nil, fmt.Errorf("jobs manager requires storage and a worker")
	}
	if config.DataRoot == "" || config.FixturePath == "" {
		return nil, fmt.Errorf("jobs manager requires data root and fixture path")
	}
	dataRoot, err := filepath.Abs(config.DataRoot)
	if err != nil {
		return nil, err
	}
	dataRoot, err = filepath.EvalSymlinks(dataRoot)
	if err != nil {
		return nil, fmt.Errorf("resolve jobs data root: %w", err)
	}
	fixturePath, err := filepath.Abs(config.FixturePath)
	if err != nil {
		return nil, err
	}
	fixturePath, err = filepath.EvalSymlinks(fixturePath)
	if err != nil {
		return nil, fmt.Errorf("resolve fixture path: %w", err)
	}
	concurrency := config.Concurrency
	if concurrency <= 0 {
		concurrency = 2
	}
	if concurrency > 8 {
		concurrency = 8
	}
	poll := config.PollInterval
	if poll <= 0 {
		poll = 250 * time.Millisecond
	}
	return &Manager{
		store: config.Store, dataRoot: dataRoot, fixturePath: fixturePath, worker: config.Worker,
		concurrency: concurrency, pollInterval: poll, active: make(map[string]context.CancelFunc), notify: make(chan struct{}, 1),
	}, nil
}

func (manager *Manager) Start(parent context.Context) error {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if manager.started {
		return fmt.Errorf("jobs manager already started")
	}
	if err := parent.Err(); err != nil {
		return err
	}
	if err := manager.prepareStartupDirectories(); err != nil {
		return err
	}
	if err := manager.cleanupOrphanedSpools(); err != nil {
		return err
	}
	if err := manager.reconcileRecoveredRuns(parent); err != nil {
		return err
	}
	if err := parent.Err(); err != nil {
		return err
	}
	manager.ctx, manager.cancel = context.WithCancel(parent)
	manager.started = true
	for index := 0; index < manager.concurrency; index++ {
		manager.wg.Add(1)
		go manager.workerLoop()
	}
	manager.signal()
	return nil
}

func (manager *Manager) Close() {
	manager.mu.Lock()
	if manager.cancel != nil {
		manager.cancel()
	}
	manager.mu.Unlock()
	manager.wg.Wait()
}

func (manager *Manager) StartComparison(ctx context.Context, request domain.ComparisonStartRequest) (domain.Run, error) {
	if request.DatasetID != "" {
		return manager.StartImportedComparison(ctx, request)
	}
	if err := policy.ValidateComparison(request); err != nil {
		return domain.Run{}, err
	}
	request = policy.NormalizeComparison(request)
	payload, err := json.Marshal(domain.JobRequest{Comparison: &request})
	if err != nil {
		return domain.Run{}, err
	}
	run, err := manager.store.CreateRun(ctx, request.ProjectID, domain.WorkflowCompare, payload, nil)
	if err == nil {
		manager.signal()
	}
	return run, err
}

func (manager *Manager) StartResearch(ctx context.Context, request domain.ResearchStartRequest) (domain.Run, error) {
	if err := policy.ValidateResearch(request); err != nil {
		return domain.Run{}, err
	}
	request = policy.NormalizeResearch(request)
	payload, err := json.Marshal(domain.JobRequest{Research: &request})
	if err != nil {
		return domain.Run{}, err
	}
	run, err := manager.store.CreateRun(ctx, request.ProjectID, domain.WorkflowResearch, payload, nil)
	if err == nil {
		manager.signal()
	}
	return run, err
}

func (manager *Manager) Cancel(ctx context.Context, runID, reason string) (domain.Run, error) {
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) > 500 {
		return domain.Run{}, fmt.Errorf("%w: cancellation reason exceeds 500 characters", policy.ErrInvalidRequest)
	}
	run, err := manager.store.RequestCancel(ctx, runID, reason)
	if err != nil {
		return domain.Run{}, err
	}
	manager.mu.Lock()
	cancel := manager.active[runID]
	manager.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	return run, nil
}

func (manager *Manager) Replay(ctx context.Context, runID string) (domain.Run, error) {
	run, err := manager.store.ReplayRun(ctx, runID)
	if err == nil {
		manager.signal()
	}
	return run, err
}

func (manager *Manager) WorkerID() string      { return manager.worker.ID() }
func (manager *Manager) WorkerAvailable() bool { return manager.worker.Available() }

func (manager *Manager) MonitoringStatus(ctx context.Context) (domain.MonitoringStatus, error) {
	queued, running, err := manager.store.RunCounts(ctx)
	if err != nil {
		return domain.MonitoringStatus{}, err
	}
	workerState := "unavailable"
	if manager.worker.Available() {
		workerState = "available"
	}
	fixtureState := "unavailable"
	if info, statErr := os.Stat(manager.fixturePath); statErr == nil && info.Mode().IsRegular() {
		fixtureState = "available"
	}
	return domain.MonitoringStatus{
		Daemon: "available", Worker: workerState, QueuedRuns: queued, RunningRuns: running,
		Connectors: []domain.ConnectorStatus{{ID: connectors.FixtureID, Status: fixtureState, AcquisitionMode: "offline_fixture", CostState: "free"}},
	}, nil
}

func (manager *Manager) signal() {
	select {
	case manager.notify <- struct{}{}:
	default:
	}
}

func (manager *Manager) prepareStartupDirectories() error {
	for _, path := range []string{manager.dataRoot, filepath.Join(manager.dataRoot, "spool"), filepath.Join(manager.dataRoot, "runs")} {
		if err := ensurePrivateDirectory(path); err != nil {
			return fmt.Errorf("prepare jobs directory: %w", err)
		}
	}
	return nil
}

func ensurePrivateDirectory(path string) error {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		if err := os.Mkdir(path, 0o700); err != nil && !errors.Is(err, os.ErrExist) {
			return err
		}
		info, err = os.Lstat(path)
	}
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("directory must be a real non-symlink directory")
	}
	if err := os.Chmod(path, 0o700); err != nil {
		return err
	}
	return nil
}

// cleanupOrphanedSpools only removes direct job-* directories beneath the
// private spool root. ReadDir and Lstat inspect entries without following
// links; symlinks are deliberately left alone rather than treated as a tree
// to traverse. Committed evidence is under runs/, never spool/.
func (manager *Manager) cleanupOrphanedSpools() error {
	spool := filepath.Join(manager.dataRoot, "spool")
	entries, err := os.ReadDir(spool)
	if err != nil {
		return fmt.Errorf("read private spool: %w", err)
	}
	for _, entry := range entries {
		if !strings.HasPrefix(entry.Name(), "job-") || entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		if !entry.Type().IsDir() {
			entryInfo, err := entry.Info()
			if err != nil {
				return fmt.Errorf("inspect private spool entry: %w", err)
			}
			if !entryInfo.IsDir() || entryInfo.Mode()&os.ModeSymlink != 0 {
				continue
			}
		}
		path := filepath.Join(spool, entry.Name())
		info, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return fmt.Errorf("inspect orphaned private spool: %w", err)
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			continue
		}
		if err := os.RemoveAll(path); err != nil {
			return fmt.Errorf("remove orphaned private spool: %w", err)
		}
	}
	return nil
}

// reconcileRecoveredRuns repairs only evidence that was atomically published
// before the prior process lost its SQLite completion transaction. It runs
// synchronously before worker loops can claim missing-evidence retries.
func (manager *Manager) reconcileRecoveredRuns(ctx context.Context) error {
	runs, err := manager.store.ListRecoveredRuns(ctx)
	if err != nil {
		return fmt.Errorf("list recovered runs: %w", err)
	}
	for _, run := range runs {
		if err := ctx.Err(); err != nil {
			return err
		}
		present, err := manager.committedEvidencePresent(run.ID)
		if err != nil {
			if markErr := manager.markRecoveredFailure(ctx, run.ID, err); markErr != nil {
				return markErr
			}
			continue
		}
		if !present {
			// No published evidence means the durable request may safely follow
			// the existing idempotent worker retry path.
			continue
		}
		commit, err := governance.LoadCommittedEvidence(manager.dataRoot, run.ID, governance.DefaultMaximumArtifactBytes)
		if err != nil {
			if markErr := manager.markRecoveredFailure(ctx, run.ID, err); markErr != nil {
				return markErr
			}
			continue
		}
		entities, documents := deriveCanonicalProjections(run.ID, commit.Observations, commit.Report)
		if err := manager.store.CompleteRecoveredRun(ctx, run.ID, commit.Artifacts, entities, documents, commit.Manifest.Provenance); err != nil {
			if errors.Is(err, storage.ErrConflict) && manager.recoveredRunNoLongerPending(ctx, run.ID) {
				continue
			}
			return fmt.Errorf("complete recovered run %s: %w", run.ID, err)
		}
	}
	return nil
}

func (manager *Manager) committedEvidencePresent(runID string) (bool, error) {
	clean, err := governance.CleanRelativePath(runID)
	if err != nil || clean != runID || filepath.Base(runID) != runID {
		return false, fmt.Errorf("%w: recovered run identifier is unsafe", governance.ErrUnsafePath)
	}
	runsPath := filepath.Join(manager.dataRoot, "runs")
	runsInfo, err := os.Lstat(runsPath)
	if err != nil || !runsInfo.IsDir() || runsInfo.Mode()&os.ModeSymlink != 0 {
		return false, fmt.Errorf("%w: recovered runs directory is unavailable or unsafe", governance.ErrUnsafePath)
	}
	runPath := filepath.Join(runsPath, runID)
	runInfo, err := os.Lstat(runPath)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil || !runInfo.IsDir() || runInfo.Mode()&os.ModeSymlink != 0 {
		return false, fmt.Errorf("%w: recovered run directory is unavailable or unsafe", governance.ErrUnsafePath)
	}
	evidencePath := filepath.Join(runPath, "evidence")
	evidenceInfo, err := os.Lstat(evidencePath)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil || !evidenceInfo.IsDir() || evidenceInfo.Mode()&os.ModeSymlink != 0 {
		return false, fmt.Errorf("%w: recovered evidence directory is unavailable or unsafe", governance.ErrUnsafePath)
	}
	return true, nil
}

func (manager *Manager) markRecoveredFailure(ctx context.Context, runID string, cause error) error {
	code, message := recoveredFailure(cause)
	if err := manager.store.MarkRecoveredFailed(ctx, runID, code, message); err != nil {
		if errors.Is(err, storage.ErrConflict) && manager.recoveredRunNoLongerPending(ctx, runID) {
			return nil
		}
		return fmt.Errorf("mark recovered run %s failed: %w", runID, err)
	}
	return nil
}

func (manager *Manager) recoveredRunNoLongerPending(ctx context.Context, runID string) bool {
	run, err := manager.store.GetRun(ctx, runID)
	return err == nil && (run.Status.Terminal() || run.CancelRequested)
}

func recoveredFailure(err error) (string, string) {
	switch {
	case errors.Is(err, governance.ErrProjectionMismatch):
		return recoveryProjectionMismatchCode, recoveryProjectionMismatchMessage
	case errors.Is(err, governance.ErrUnsafePath):
		return recoveryEvidencePathCode, recoveryEvidencePathMessage
	case errors.Is(err, governance.ErrArtifactTooLarge):
		return recoveryEvidenceTooLargeCode, recoveryEvidenceTooLargeMessage
	default:
		return recoveryEvidenceCorruptCode, recoveryEvidenceCorruptMessage
	}
}

func (manager *Manager) workerLoop() {
	defer manager.wg.Done()
	ticker := time.NewTicker(manager.pollInterval)
	defer ticker.Stop()
	for {
		if manager.ctx.Err() != nil {
			return
		}
		run, err := manager.store.ClaimNextRun(manager.ctx)
		if err == nil {
			manager.execute(run)
			continue
		}
		if !errors.Is(err, storage.ErrNotFound) && manager.ctx.Err() == nil {
			// SQLite remains authoritative. A later poll safely retries transient
			// claim failures without duplicating a claimed run.
		}
		select {
		case <-manager.ctx.Done():
			return
		case <-manager.notify:
		case <-ticker.C:
		}
	}
}

func (manager *Manager) execute(run domain.Run) {
	ctx, cancel := context.WithCancel(manager.ctx)
	manager.mu.Lock()
	manager.active[run.ID] = cancel
	manager.mu.Unlock()
	defer func() {
		cancel()
		manager.mu.Lock()
		delete(manager.active, run.ID)
		manager.mu.Unlock()
	}()
	if current, err := manager.store.GetRun(ctx, run.ID); err == nil && current.CancelRequested {
		cancel()
	}

	var snapshot domain.JobRequest
	if err := json.Unmarshal(run.RequestJSON, &snapshot); err != nil {
		manager.fail(run.ID, "request_snapshot_invalid", "Durable request snapshot could not be decoded")
		return
	}
	targets, options, err := jobParameters(run.Workflow, snapshot)
	if err != nil {
		manager.fail(run.ID, "request_snapshot_invalid", err.Error())
		return
	}
	jobRoot, err := os.MkdirTemp(filepath.Join(manager.dataRoot, "spool"), "job-")
	if err != nil {
		manager.fail(run.ID, "spool_unavailable", "Could not create a private run spool")
		return
	}
	_ = os.Chmod(jobRoot, 0o700)
	defer os.RemoveAll(jobRoot)
	if err := os.Mkdir(filepath.Join(jobRoot, "tmp"), 0o700); err != nil {
		manager.fail(run.ID, "spool_unavailable", "Could not create a private worker temporary directory")
		return
	}
	inputName := "observations.ndjson"
	if run.InputSchemaID == domain.CompetitivePulseImportSchema {
		inputName = "competitive-pulse.csv"
	}
	inputPath := filepath.Join(jobRoot, "input", inputName)
	inputSnapshot, err := manager.prepareInputSnapshot(run, inputPath)
	if err != nil {
		manager.fail(run.ID, connectors.ErrorCode(err), err.Error())
		return
	}
	outputDir := filepath.Join(jobRoot, "output")
	if err := os.MkdirAll(outputDir, 0o700); err != nil {
		manager.fail(run.ID, "spool_unavailable", "Could not create a private output spool")
		return
	}
	analysis := connectors.AnalysisRequest{
		RunID: run.ID, ProjectID: run.ProjectID, WorkspacePath: jobRoot,
		InputPath: inputPath, InputSHA256: inputSnapshot.SHA256, InputSchemaID: inputSnapshot.SchemaID,
		OutputDir: outputDir, TargetIDs: targets, Workflow: run.Workflow, Options: options,
	}
	if snapshot.Research != nil {
		analysis.ResearchQuestion = snapshot.Research.Question
		analysis.SourceBudget = uint32(snapshot.Research.SourceBudget)
	}
	if run.DatasetID != "" {
		dataset, datasetErr := manager.store.GetDataset(ctx, run.DatasetID)
		if datasetErr != nil || dataset.Preview.ValidatedAt == nil {
			manager.fail(run.ID, "input_snapshot_invalid", "Imported dataset metadata is unavailable")
			return
		}
		if dataset.Preview.State != domain.DatasetReady {
			manager.fail(run.ID, "dataset_deleted", "Imported dataset was deleted before analysis started")
			return
		}
		if dataset.Preview.RetentionUntil == nil || !dataset.Preview.RetentionUntil.After(time.Now().UTC()) {
			manager.fail(run.ID, "dataset_expired", "Imported dataset retention expired before analysis started")
			return
		}
		analysis.ImportContext = &connectors.ImportContext{DatasetID: run.DatasetID, ValidatedAt: *dataset.Preview.ValidatedAt,
			InputParserVersion: dataset.InputParserVersion, MetricCatalogVersion: dataset.MetricCatalogVersion}
	}
	// The worker is resolved per run: a live-URL comparison uses the website
	// connector while everything else keeps the fixture/Python path. Provenance
	// below records the worker that actually ran, not the configured one.
	selected := connectors.WorkerFor(manager.worker, analysis)
	result, err := selected.Analyze(ctx, analysis, func(event connectors.ProgressEvent) {
		progressCtx, progressCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer progressCancel()
		progress := 0.1 + event.Progress*0.75
		_ = manager.store.SetProgress(progressCtx, run.ID, event.Stage, event.Level, event.Message, progress)
	})
	if err != nil {
		if errors.Is(err, context.Canceled) || ctx.Err() != nil {
			manager.cancelled(run.ID)
		} else {
			manager.fail(run.ID, connectors.ErrorCode(err), err.Error())
		}
		return
	}
	if err := validateResult(run.ID, result); err != nil {
		manager.fail(run.ID, "worker_protocol_error", err.Error())
		return
	}
	provenance := domain.Provenance{
		WorkerVersion: result.WorkerVersion, ModelVersion: result.ModelVersion,
		ConnectorVersion: selected.ID(), ParserVersion: "marketingovo-go-fixture.v1",
	}
	if provenance.WorkerVersion == "" {
		provenance.WorkerVersion = selected.ID()
	}
	if provenance.ModelVersion == "" {
		provenance.ModelVersion = "none"
	}
	switch selected.ID() {
	case "python.intelligence.protocol.v1":
		provenance.ParserVersion = "marketingovo-go-arrow-parquet.v1"
	case connectors.WebsiteID:
		provenance.ParserVersion = connectors.WebsiteParserVersion
	}
	if run.DatasetID != "" {
		provenance.ConnectorVersion = "local.competitive-pulse-import@1.0.0"
		provenance.ParserVersion = domain.CompetitivePulseParserVersion
	}
	if err := manager.store.SetProvenance(context.Background(), run.ID, provenance); err != nil {
		manager.fail(run.ID, "storage_commit_failed", "Worker provenance could not be recorded")
		return
	}
	if err := verifyAndRemoveControlResult(outputDir, result); err != nil {
		manager.fail(run.ID, "worker_protocol_error", err.Error())
		return
	}
	if current, getErr := manager.store.GetRun(context.Background(), run.ID); getErr == nil && current.CancelRequested {
		manager.cancelled(run.ID)
		return
	}
	_ = manager.setProgress(run.ID, "commit", "Validating hashes and atomically committing the evidence manifest", 0.9)
	commit, err := governance.CommitEvidence(governance.CommitOptions{
		DataRoot: manager.dataRoot, RunID: run.ID, StageDir: outputDir,
		Descriptors: result.Artifacts, MaximumBytes: governance.DefaultMaximumArtifactBytes, Provenance: provenance,
		AllowLegacyFixture: selected.ID() == connectors.FixtureID,
	})
	if err != nil {
		manager.fail(run.ID, artifactErrorCode(err), err.Error())
		return
	}
	provenance = commit.Manifest.Provenance
	entities, documents := result.Entities, result.SearchDocuments
	if len(commit.Observations) > 0 {
		entities, documents = deriveCanonicalProjections(run.ID, commit.Observations, commit.Report)
	} else if len(entities) == 0 || len(documents) == 0 {
		_ = os.RemoveAll(commit.EvidenceDir)
		manager.fail(run.ID, "worker_protocol_error", "Legacy fixture worker omitted its validated search projections")
		return
	}
	if err := manager.store.CompleteRunWithProvenance(context.Background(), run.ID, commit.Artifacts, entities, documents, false, provenance); err != nil {
		_ = os.RemoveAll(commit.EvidenceDir)
		if errors.Is(err, storage.ErrConflict) {
			if current, getErr := manager.store.GetRun(context.Background(), run.ID); getErr == nil && current.CancelRequested {
				manager.cancelled(run.ID)
				return
			}
		}
		manager.fail(run.ID, "storage_commit_failed", "Evidence was not recorded in durable storage")
	}
}

func deriveCanonicalProjections(runID string, observations []domain.Observation, report domain.ComparisonReport) ([]domain.Entity, []domain.SearchDocument) {
	byEntity := make(map[string]domain.Entity)
	for _, observation := range observations {
		entity := byEntity[observation.EntityID]
		if entity.ID == "" {
			entity = domain.Entity{ID: observation.EntityID, Type: "social_account", DisplayName: observation.EntityName,
				ResolutionState: "observed", UpdatedAt: observation.ObservedAt}
		} else if observation.ObservedAt.After(entity.UpdatedAt) {
			entity.UpdatedAt = observation.ObservedAt
		}
		identifier := domain.Identifier{Scheme: observation.Platform, Value: observation.NativeID, Source: observation.SourceURL}
		duplicate := false
		for _, existing := range entity.Identifiers {
			if existing == identifier {
				duplicate = true
				break
			}
		}
		if !duplicate {
			entity.Identifiers = append(entity.Identifiers, identifier)
		}
		byEntity[observation.EntityID] = entity
	}
	// A legacy raw fixture does not carry decoded canonical rows through the
	// existing governance return value. Its validated report still supplies the
	// entity identities needed for safe recovered search projections. Production
	// evidence reaches this path with observations and therefore retains richer
	// identifiers above.
	for _, target := range report.Targets {
		if _, present := byEntity[target.EntityID]; present {
			continue
		}
		byEntity[target.EntityID] = domain.Entity{ID: target.EntityID, Type: "social_account", DisplayName: target.EntityName,
			ResolutionState: "observed", UpdatedAt: report.GeneratedAt}
	}
	entities := make([]domain.Entity, 0, len(byEntity))
	for _, entity := range byEntity {
		entities = append(entities, entity)
	}
	slices.SortFunc(entities, func(left, right domain.Entity) int { return strings.Compare(left.ID, right.ID) })
	documents := []domain.SearchDocument{{Kind: "report", ID: runID, Label: report.Title, Excerpt: report.Summary, Confidence: 1, RunID: &runID}}
	for _, entity := range entities {
		documents = append(documents, domain.SearchDocument{Kind: "entity", ID: entity.ID, Label: entity.DisplayName,
			Excerpt: "Entity derived from authority-validated canonical observations.", Confidence: 1, RunID: &runID})
	}
	for _, observation := range observations {
		documents = append(documents, domain.SearchDocument{Kind: "observation", ID: observation.ObservationID,
			Label: observation.EntityName + " · " + observation.Metric, Excerpt: observation.SourceURL,
			Confidence: observation.Confidence, RunID: &runID})
	}
	return entities, documents
}

func (manager *Manager) prepareInputSnapshot(run domain.Run, destinationPath string) (domain.InputSnapshot, error) {
	const schemaID = "marketingovo.fixture-observations.v1"
	if run.InputSHA256 != "" {
		if run.InputSchemaID == "" || run.InputRelativePath == "" || run.InputSizeBytes <= 0 {
			return domain.InputSnapshot{}, &connectors.WorkerError{Code: "input_snapshot_invalid", Message: "replay input snapshot metadata is incomplete"}
		}
		clean, err := governance.CleanRelativePath(filepath.FromSlash(run.InputRelativePath))
		if err != nil || !strings.HasPrefix(clean, "input-snapshots"+string(filepath.Separator)) {
			return domain.InputSnapshot{}, &connectors.WorkerError{Code: "input_snapshot_invalid", Message: "replay input snapshot path is outside the immutable store"}
		}
		source := filepath.Join(manager.dataRoot, clean)
		digest, err := snapshotFixture(source, destinationPath)
		if err != nil {
			return domain.InputSnapshot{}, &connectors.WorkerError{Code: "input_snapshot_unavailable", Message: "immutable replay input is unavailable", Cause: err}
		}
		info, statErr := os.Stat(destinationPath)
		if statErr != nil || digest != run.InputSHA256 || info.Size() != run.InputSizeBytes {
			_ = os.Remove(destinationPath)
			return domain.InputSnapshot{}, &connectors.WorkerError{Code: "input_snapshot_corrupt", Message: "immutable replay input failed its recorded hash or size"}
		}
		return domain.InputSnapshot{RelativePath: run.InputRelativePath, SHA256: digest, SchemaID: run.InputSchemaID, SizeBytes: info.Size(), DatasetID: run.DatasetID}, nil
	}
	digest, err := snapshotFixture(manager.fixturePath, destinationPath)
	if err != nil {
		return domain.InputSnapshot{}, err
	}
	info, err := os.Stat(destinationPath)
	if err != nil {
		return domain.InputSnapshot{}, err
	}
	relative := filepath.ToSlash(filepath.Join("input-snapshots", digest+".ndjson"))
	snapshot := domain.InputSnapshot{RelativePath: relative, SHA256: digest, SchemaID: schemaID, SizeBytes: info.Size()}
	if err := manager.persistInputSnapshot(destinationPath, snapshot); err != nil {
		return domain.InputSnapshot{}, err
	}
	if err := manager.store.SetInputSnapshot(context.Background(), run.ID, snapshot); err != nil {
		return domain.InputSnapshot{}, err
	}
	return snapshot, nil
}

func (manager *Manager) persistInputSnapshot(sourcePath string, snapshot domain.InputSnapshot) error {
	directory := filepath.Join(manager.dataRoot, "input-snapshots")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return err
	}
	path := filepath.Join(manager.dataRoot, filepath.FromSlash(snapshot.RelativePath))
	if _, err := os.Lstat(path); err == nil {
		return governance.VerifyFile(directory, path, snapshot.SizeBytes, snapshot.SHA256, maximumFixtureBytes)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	temporary, err := os.CreateTemp(directory, ".input-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	if closeErr := temporary.Close(); closeErr != nil {
		_ = os.Remove(temporaryPath)
		return closeErr
	}
	_ = os.Remove(temporaryPath)
	defer os.Remove(temporaryPath)
	digest, err := snapshotFixture(sourcePath, temporaryPath)
	if err != nil || digest != snapshot.SHA256 {
		return &connectors.WorkerError{Code: "input_snapshot_corrupt", Message: "could not persist the immutable input hash", Cause: err}
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		if _, statErr := os.Lstat(path); statErr == nil {
			return governance.VerifyFile(directory, path, snapshot.SizeBytes, snapshot.SHA256, maximumFixtureBytes)
		}
		return err
	}
	return governance.VerifyFile(directory, path, snapshot.SizeBytes, snapshot.SHA256, maximumFixtureBytes)
}

func jobParameters(workflow domain.Workflow, request domain.JobRequest) ([]string, map[string]string, error) {
	options := map[string]string{"workflow": string(workflow), "simulate": "none"}
	switch workflow {
	case domain.WorkflowCompare:
		if request.Comparison == nil || request.Research != nil {
			return nil, nil, fmt.Errorf("comparison snapshot is missing or ambiguous")
		}
		if err := policy.ValidateComparison(*request.Comparison); err != nil {
			return nil, nil, err
		}
		options["simulate"] = request.Comparison.Simulate
		options["goal"] = request.Comparison.Goal
		return append([]string(nil), request.Comparison.TargetIDs...), options, nil
	case domain.WorkflowResearch:
		if request.Research == nil || request.Comparison != nil {
			return nil, nil, fmt.Errorf("research snapshot is missing or ambiguous")
		}
		if err := policy.ValidateResearch(*request.Research); err != nil {
			return nil, nil, err
		}
		return append([]string(nil), request.Research.TargetIDs...), options, nil
	default:
		return nil, nil, fmt.Errorf("unsupported workflow %q", workflow)
	}
}

func snapshotFixture(sourcePath, destinationPath string) (string, error) {
	info, err := os.Lstat(sourcePath)
	if err != nil {
		return "", &connectors.WorkerError{Code: "source_failure", Message: "fixture source is unavailable", Cause: err}
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return "", &connectors.WorkerError{Code: "source_policy_violation", Message: "fixture source must be a regular non-symlink file"}
	}
	input, err := os.Open(sourcePath)
	if err != nil {
		return "", &connectors.WorkerError{Code: "source_failure", Message: "open fixture source", Cause: err}
	}
	defer input.Close()
	openedInfo, err := input.Stat()
	if err != nil || !os.SameFile(info, openedInfo) {
		return "", &connectors.WorkerError{Code: "source_policy_violation", Message: "fixture source changed while opening"}
	}
	if openedInfo.Size() > maximumFixtureBytes {
		return "", &connectors.WorkerError{Code: "source_too_large", Message: "fixture source exceeds the bounded input limit"}
	}
	if err := os.MkdirAll(filepath.Dir(destinationPath), 0o700); err != nil {
		return "", err
	}
	output, err := os.OpenFile(destinationPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", err
	}
	digest := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(output, digest), io.LimitReader(input, maximumFixtureBytes+1))
	if copyErr == nil && written > maximumFixtureBytes {
		copyErr = fmt.Errorf("fixture source exceeds the bounded input limit")
	}
	if copyErr == nil {
		copyErr = output.Sync()
	}
	closeErr := output.Close()
	if copyErr != nil {
		return "", &connectors.WorkerError{Code: "source_failure", Message: "snapshot fixture source", Cause: copyErr}
	}
	if closeErr != nil {
		return "", closeErr
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func validateResult(runID string, result domain.ConnectorResult) error {
	if result.RunID != "" && result.RunID != runID {
		return fmt.Errorf("worker result run id mismatch")
	}
	if !result.Succeeded || len(result.Artifacts) == 0 || result.ReportRelativePath == "" || result.ReportSHA256 == "" {
		return fmt.Errorf("worker returned an incomplete successful result")
	}
	reportCount := 0
	for _, descriptor := range result.Artifacts {
		if descriptor.RelativePath == result.ReportRelativePath {
			reportCount++
			if descriptor.Kind != "report" || descriptor.SHA256 != result.ReportSHA256 {
				return fmt.Errorf("report descriptor does not match the worker result")
			}
		}
	}
	if reportCount != 1 {
		return fmt.Errorf("worker result must identify exactly one report artifact")
	}
	return nil
}

func verifyAndRemoveControlResult(outputDir string, expected domain.ConnectorResult) error {
	path := filepath.Join(outputDir, "artifact-result.json")
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect persisted worker result: %w", err)
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Size() > 4<<20 {
		return fmt.Errorf("persisted worker result violates control-file policy")
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	decoder := json.NewDecoder(bufio.NewReader(io.LimitReader(file, (4<<20)+1)))
	decoder.DisallowUnknownFields()
	var persisted domain.ConnectorResult
	decodeErr := decoder.Decode(&persisted)
	if decodeErr == nil {
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			decodeErr = fmt.Errorf("persisted worker result contains trailing JSON")
		}
	}
	closeErr := file.Close()
	if decodeErr != nil {
		return fmt.Errorf("decode persisted worker result: %w", decodeErr)
	}
	if closeErr != nil {
		return closeErr
	}
	for index := range persisted.Artifacts {
		if persisted.Artifacts[index].Kind == "" {
			persisted.Artifacts[index].Kind = inferKind(persisted.Artifacts[index], persisted.ReportRelativePath)
		}
	}
	if difference := controlResultDifference(persisted, expected); difference != "" {
		return fmt.Errorf("persisted worker result disagrees with protobuf AnalysisResult at %s", difference)
	}
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("remove verified worker control file: %w", err)
	}
	return nil
}

func controlResultDifference(persisted, expected domain.ConnectorResult) string {
	if persisted.ManifestVersion != expected.ManifestVersion {
		return "manifest_version"
	}
	if persisted.RunID != expected.RunID {
		return "run_id"
	}
	if persisted.Succeeded != expected.Succeeded || persisted.ErrorCode != expected.ErrorCode || persisted.ErrorMessage != expected.ErrorMessage {
		return "status"
	}
	if persisted.ReportRelativePath != expected.ReportRelativePath || persisted.ReportSHA256 != expected.ReportSHA256 || persisted.ModelVersion != expected.ModelVersion || persisted.WorkerVersion != expected.WorkerVersion {
		return "report metadata"
	}
	if len(persisted.Artifacts) != len(expected.Artifacts) {
		return "artifact count"
	}
	for index := range persisted.Artifacts {
		left, right := persisted.Artifacts[index], expected.Artifacts[index]
		if left.RelativePath != right.RelativePath || left.Kind != right.Kind || left.MediaType != right.MediaType || left.SHA256 != right.SHA256 || left.SizeBytes != right.SizeBytes || left.RowCount != right.RowCount || left.SchemaID != right.SchemaID || left.DataClass != right.DataClass || optionalString(left.MinimumObservedAt) != optionalString(right.MinimumObservedAt) || optionalString(left.MaximumObservedAt) != optionalString(right.MaximumObservedAt) {
			return fmt.Sprintf("artifact[%d]", index)
		}
	}
	return ""
}

func optionalString(value *string) string {
	if value == nil {
		return "<nil>"
	}
	return *value
}

func inferKind(descriptor domain.ArtifactDescriptor, reportPath string) string {
	if descriptor.RelativePath == reportPath {
		return "report"
	}
	switch strings.ToLower(filepath.Ext(descriptor.RelativePath)) {
	case ".arrow", ".ipc":
		return "arrow"
	case ".parquet":
		return "parquet"
	default:
		return "raw"
	}
}

func artifactErrorCode(err error) string {
	switch {
	case errors.Is(err, governance.ErrArtifactMismatch):
		return "artifact_corrupt"
	case errors.Is(err, governance.ErrArtifactTooLarge):
		return "artifact_too_large"
	case errors.Is(err, governance.ErrUnsafePath):
		return "artifact_path_violation"
	default:
		return "artifact_commit_failed"
	}
}

func (manager *Manager) setProgress(runID, stage, message string, progress float64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return manager.store.SetProgress(ctx, runID, stage, "info", message, progress)
}

func (manager *Manager) fail(runID, code, message string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = manager.store.MarkFailed(ctx, runID, code, message)
}

func (manager *Manager) cancelled(runID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = manager.store.MarkCancelled(ctx, runID, "Run cancelled before evidence commit")
}
