export interface Migration {
  version: number;
  name: string;
  sql: string;
  /** Needed only for an atomic table rebuild that preserves child FKs. */
  foreignKeysOff?: boolean;
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "local-platform-v1",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        canonical_url TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        canonical_url TEXT NOT NULL,
        private_access INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','partial','failed','cancelled')),
        idempotency_key TEXT,
        requested_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        progress REAL NOT NULL DEFAULT 0,
        issue_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        options_json TEXT NOT NULL DEFAULT '{}',
        UNIQUE(project_id, idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS run_modules (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        duration_ms REAL,
        coverage REAL,
        error TEXT,
        PRIMARY KEY(run_id, module_id)
      );
      CREATE TABLE IF NOT EXISTS pages (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        canonical_url TEXT NOT NULL,
        status_code INTEGER,
        title TEXT,
        indexable INTEGER,
        payload_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY(run_id, canonical_url)
      );
      CREATE TABLE IF NOT EXISTS issues (
        fingerprint TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        module_id TEXT NOT NULL,
        canonical_url TEXT,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS issue_instances (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL REFERENCES issues(fingerprint) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        evidence_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY(run_id, fingerprint)
      );
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        issue_fingerprint TEXT REFERENCES issues(fingerprint) ON DELETE SET NULL,
        title TEXT NOT NULL,
        why_now TEXT NOT NULL,
        impact REAL NOT NULL,
        effort TEXT NOT NULL,
        confidence REAL NOT NULL,
        priority_score REAL NOT NULL,
        score_version TEXT NOT NULL,
        score_inputs_json TEXT NOT NULL,
        affected_urls_json TEXT NOT NULL,
        owner TEXT,
        status TEXT NOT NULL,
        verification TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, issue_fingerprint)
      );
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
        key TEXT NOT NULL,
        value REAL,
        state TEXT NOT NULL,
        source TEXT NOT NULL,
        observed_at TEXT,
        coverage REAL,
        note TEXT,
        UNIQUE(project_id, run_id, key, source)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','leased','succeeded','failed','cancelled','dead_letter')),
        payload_json TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        available_at TEXT NOT NULL,
        lease_owner TEXT,
        lease_expires_at TEXT,
        heartbeat_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS job_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS integrations (
        provider TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        secret_ref TEXT,
        masked_identifier TEXT,
        scopes_json TEXT NOT NULL DEFAULT '[]',
        last_sync_at TEXT,
        next_sync_at TEXT,
        expires_at TEXT,
        quota_json TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        cron TEXT NOT NULL,
        timezone TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        next_run_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        at TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_runs_project_requested ON runs(project_id, requested_at DESC);
      CREATE INDEX IF NOT EXISTS idx_issue_instances_project_status ON issue_instances(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_actions_project_priority ON actions(project_id, priority_score DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_state_available ON jobs(state, available_at);
      CREATE INDEX IF NOT EXISTS idx_events_run_id ON job_events(run_id, id);
      CREATE INDEX IF NOT EXISTS idx_metrics_project_key ON metrics(project_id, key, observed_at DESC);
    `,
  },
  {
    version: 2,
    name: "durable-jobs-and-schedule-leases",
    sql: `
      ALTER TABLE schedules ADD COLUMN lease_owner TEXT;
      ALTER TABLE schedules ADD COLUMN lease_expires_at TEXT;
      ALTER TABLE schedules ADD COLUMN last_run_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_schedules_due
        ON schedules(enabled, next_run_at, lease_expires_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_lease
        ON jobs(state, lease_expires_at);
    `,
  },
  {
    version: 3,
    name: "project-integration-configuration",
    sql: `
      CREATE TABLE IF NOT EXISTS project_integrations (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, provider)
      );
      CREATE INDEX IF NOT EXISTS idx_project_integrations_provider
        ON project_integrations(provider, project_id);
    `,
  },
  {
    version: 4,
    name: "project-settings",
    sql: `
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        timezone TEXT,
        reporting_currency TEXT,
        weekly_digest INTEGER NOT NULL DEFAULT 0 CHECK(weekly_digest IN (0, 1)),
        alert_email TEXT,
        data_retention_days INTEGER CHECK(data_retention_days IS NULL OR data_retention_days > 0),
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: "allow-independent-project-imports",
    foreignKeysOff: true,
    sql: `
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE projects RENAME TO projects_unique_legacy;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO projects(id,name,canonical_url,created_at,updated_at)
        SELECT id,name,canonical_url,created_at,updated_at
        FROM projects_unique_legacy;
      DROP TABLE projects_unique_legacy;
      CREATE INDEX IF NOT EXISTS idx_projects_canonical_url
        ON projects(canonical_url);
      PRAGMA legacy_alter_table = OFF;
    `,
  },
  {
    version: 6,
    name: "action-flight-recorder",
    sql: `
      ALTER TABLE actions ADD COLUMN rule_id TEXT;
      ALTER TABLE actions ADD COLUMN module_id TEXT;
      UPDATE actions
      SET rule_id = (
        SELECT issues.rule_id FROM issues
        WHERE issues.fingerprint = actions.issue_fingerprint
      ),
      module_id = (
        SELECT issues.module_id FROM issues
        WHERE issues.fingerprint = actions.issue_fingerprint
      )
      WHERE issue_fingerprint IS NOT NULL;

      CREATE TABLE action_issue_instances (
        action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL REFERENCES issues(fingerprint) ON DELETE CASCADE,
        lifecycle TEXT NOT NULL CHECK(lifecycle IN ('new','persistent','resolved','reappeared')),
        observed_at TEXT NOT NULL,
        PRIMARY KEY(action_id, run_id, fingerprint)
      );

      CREATE TABLE action_checkpoints (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        baseline_run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        state TEXT NOT NULL CHECK(state IN ('active','verification_queued','technically_verified','regressed','inconclusive')),
        baseline_snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE action_cohorts (
        checkpoint_id TEXT NOT NULL REFERENCES action_checkpoints(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('target','control')),
        urls_json TEXT NOT NULL,
        matching_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY(checkpoint_id, kind)
      );

      CREATE TABLE action_verifications (
        id TEXT PRIMARY KEY,
        checkpoint_id TEXT NOT NULL REFERENCES action_checkpoints(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
        idempotency_key TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('queued','running','verified','regressed','inconclusive')),
        coverage REAL CHECK(coverage IS NULL OR (coverage >= 0 AND coverage <= 1)),
        checked_at TEXT,
        reason TEXT,
        evidence_json TEXT NOT NULL DEFAULT '[]',
        requested_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(checkpoint_id, idempotency_key),
        UNIQUE(run_id)
      );

      CREATE TABLE action_observations (
        id TEXT PRIMARY KEY,
        checkpoint_id TEXT NOT NULL REFERENCES action_checkpoints(id) ON DELETE CASCADE,
        window_days INTEGER NOT NULL CHECK(window_days IN (7,14,28)),
        state TEXT NOT NULL CHECK(state IN ('pending','observed','inconclusive','unavailable')),
        period_start TEXT,
        period_end TEXT,
        target_change REAL,
        control_change REAL,
        control_adjusted_change REAL,
        confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        limitations_json TEXT NOT NULL DEFAULT '[]',
        observed_at TEXT,
        UNIQUE(checkpoint_id, window_days)
      );

      CREATE TABLE performance_windows (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK(source IN ('gsc','ga4')),
        period TEXT NOT NULL CHECK(period IN ('current','previous')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('available','partial','unavailable','failed')),
        row_count INTEGER NOT NULL CHECK(row_count >= 0),
        row_limit INTEGER,
        truncated INTEGER NOT NULL DEFAULT 0 CHECK(truncated IN (0,1)),
        coverage REAL CHECK(coverage IS NULL OR (coverage >= 0 AND coverage <= 1)),
        note TEXT,
        PRIMARY KEY(run_id, source, period)
      );

      CREATE TABLE page_performance (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        period TEXT NOT NULL CHECK(period IN ('current','previous')),
        canonical_url TEXT NOT NULL,
        crawl_matched INTEGER NOT NULL CHECK(crawl_matched IN (0,1)),
        clicks REAL,
        impressions REAL,
        ctr REAL,
        position REAL,
        sessions REAL,
        page_views REAL,
        engagement_rate REAL,
        key_events REAL,
        PRIMARY KEY(run_id, period, canonical_url)
      );

      CREATE TABLE query_performance (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        period TEXT NOT NULL CHECK(period IN ('current','previous')),
        query TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        clicks REAL NOT NULL,
        impressions REAL NOT NULL,
        ctr REAL NOT NULL,
        position REAL NOT NULL,
        PRIMARY KEY(run_id, period, query, canonical_url)
      );

      CREATE INDEX idx_action_issue_instances_action
        ON action_issue_instances(action_id, observed_at DESC);
      CREATE INDEX idx_action_checkpoints_action
        ON action_checkpoints(action_id, created_at DESC);
      CREATE INDEX idx_action_verifications_checkpoint
        ON action_verifications(checkpoint_id, requested_at DESC);
      CREATE INDEX idx_action_observations_checkpoint
        ON action_observations(checkpoint_id, window_days);
      CREATE INDEX idx_page_performance_project_url
        ON page_performance(project_id, canonical_url, period);
      CREATE INDEX idx_query_performance_project_query
        ON query_performance(project_id, query, period);
    `,
  },
  {
    version: 7,
    name: "issue-adjudication-workspace",
    sql: `
      CREATE TABLE issue_adjudications (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL REFERENCES issues(fingerprint) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('ignored','false_positive')),
        note TEXT,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, fingerprint)
      );
      CREATE INDEX idx_issue_adjudications_project_status
        ON issue_adjudications(project_id, status, updated_at DESC);
    `,
  },
  {
    version: 8,
    name: "versioned-project-context",
    sql: `
      CREATE TABLE project_context_versions (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK(revision > 0),
        profile_json TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, revision)
      );
      CREATE TABLE project_context_journal (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL CHECK(sequence > 0),
        kind TEXT NOT NULL CHECK(kind IN ('observation','decision','constraint','experiment')),
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        source_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, sequence)
      );
      CREATE INDEX idx_project_context_versions_project
        ON project_context_versions(project_id, revision DESC);
      CREATE INDEX idx_project_context_journal_project
        ON project_context_journal(project_id, sequence DESC);
    `,
  },
  {
    version: 9,
    name: "versioned-project-extraction-rules",
    sql: `
      CREATE TABLE project_extraction_rule_versions (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK(revision > 0),
        configuration_hash TEXT NOT NULL CHECK(length(configuration_hash) = 64),
        rules_json TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, revision)
      );
      CREATE INDEX idx_project_extraction_rule_versions_project
        ON project_extraction_rule_versions(project_id, revision DESC);
    `,
  },
  {
    version: 10,
    name: "immutable-issue-instance-snapshots",
    sql: `
      ALTER TABLE issue_instances ADD COLUMN severity_snapshot TEXT;
      ALTER TABLE issue_instances ADD COLUMN title_snapshot TEXT;
      ALTER TABLE issue_instances ADD COLUMN description_snapshot TEXT;
      UPDATE issue_instances
      SET severity_snapshot = (
        SELECT issues.severity FROM issues
        WHERE issues.fingerprint = issue_instances.fingerprint
      ),
      title_snapshot = (
        SELECT issues.title FROM issues
        WHERE issues.fingerprint = issue_instances.fingerprint
      ),
      description_snapshot = (
        SELECT issues.description FROM issues
        WHERE issues.fingerprint = issue_instances.fingerprint
      );
    `,
  },
  {
    version: 11,
    name: "immutable-internal-link-graph",
    sql: `
      CREATE TABLE page_links (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL,
        target_url TEXT NOT NULL,
        target_page_url TEXT,
        occurrences INTEGER NOT NULL CHECK(occurrences > 0),
        follow_occurrences INTEGER NOT NULL CHECK(follow_occurrences >= 0),
        nofollow_occurrences INTEGER NOT NULL CHECK(nofollow_occurrences >= 0),
        anchor_texts_json TEXT NOT NULL DEFAULT '[]',
        placements_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY(run_id, source_url, target_url)
      );
      CREATE INDEX idx_page_links_run_source
        ON page_links(run_id, source_url, target_url);
      CREATE INDEX idx_page_links_run_target
        ON page_links(run_id, target_page_url, source_url);
    `,
  },
];
