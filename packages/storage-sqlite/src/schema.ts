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
  {
    version: 12,
    name: "keyword-rank-tracking",
    sql: `
      CREATE TABLE tracked_keywords (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        keyword TEXT NOT NULL,
        -- A SERP position is only meaningful alongside where and how it was
        -- asked. Storing the context with the keyword is what makes a recorded
        -- position reproducible rather than an anecdote.
        locale TEXT NOT NULL,
        location TEXT,
        device TEXT NOT NULL CHECK(device IN ('desktop','mobile')),
        search_engine TEXT NOT NULL DEFAULT 'google',
        created_at TEXT NOT NULL,
        archived_at TEXT,
        UNIQUE(project_id, keyword, locale, location, device, search_engine)
      );
      CREATE INDEX idx_tracked_keywords_project
        ON tracked_keywords(project_id, archived_at);

      CREATE TABLE keyword_positions (
        id TEXT PRIMARY KEY,
        keyword_id TEXT NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
        observed_at TEXT NOT NULL,
        -- Three states that must never collapse into each other:
        --   ranked     the site was found, and position holds where
        --   absent     the site was genuinely not in the results examined
        --   unmeasured no usable answer was obtained at all
        -- Recording "absent" as position 0 or 101 would turn an observation
        -- into a fabricated number, and recording "unmeasured" as absent would
        -- turn a provider outage into a ranking loss.
        outcome TEXT NOT NULL CHECK(outcome IN ('ranked','absent','unmeasured')),
        position INTEGER CHECK(position IS NULL OR position > 0),
        ranking_url TEXT,
        -- How deep the SERP actually went. "Not in the top 10" and "not in the
        -- top 100" are different findings and must stay distinguishable.
        results_examined INTEGER CHECK(results_examined IS NULL OR results_examined > 0),
        provider TEXT NOT NULL,
        provider_cost TEXT NOT NULL
          CHECK(provider_cost IN ('provider-reported','not-reported','free')),
        failure_reason TEXT,
        CHECK(
          (outcome = 'ranked' AND position IS NOT NULL AND results_examined IS NOT NULL)
          OR (outcome = 'absent' AND position IS NULL AND results_examined IS NOT NULL)
          OR (outcome = 'unmeasured' AND position IS NULL)
        ),
        UNIQUE(keyword_id, observed_at)
      );
      CREATE INDEX idx_keyword_positions_history
        ON keyword_positions(keyword_id, observed_at DESC);
    `,
  },
  {
    version: 13,
    name: "optional-project-website",
    foreignKeysOff: true,
    sql: `
      -- A workspace is the unit of work; a website is one optional asset it may
      -- hold. Social, ads, OSINT and keyword research are all useful before a
      -- site exists, and requiring a URL to reach them made the product refuse
      -- work it can actually do. NULL means "no website yet", which is a
      -- different claim from an empty string and must stay distinguishable.
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE projects RENAME TO projects_required_url_legacy;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        canonical_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO projects(id,name,canonical_url,created_at,updated_at)
        SELECT id,name,canonical_url,created_at,updated_at
        FROM projects_required_url_legacy;
      DROP TABLE projects_required_url_legacy;
      CREATE INDEX IF NOT EXISTS idx_projects_canonical_url
        ON projects(canonical_url);
      PRAGMA legacy_alter_table = OFF;
    `,
  },
  {
    version: 14,
    name: "channel-accounts-and-metrics",
    foreignKeysOff: true,
    sql: `
      -- A connection becomes (provider, account) rather than one global row per
      -- provider. One Meta login reaches many ad cabinets, and an agency needs
      -- a different login per client; the vault's CredentialRef has carried an
      -- account discriminator from the start, so only this metadata layer was
      -- holding the product to one credential per provider.
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE integrations RENAME TO integrations_single_account_legacy;
      CREATE TABLE integrations (
        provider TEXT NOT NULL,
        account TEXT NOT NULL DEFAULT 'default',
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
        updated_at TEXT NOT NULL,
        PRIMARY KEY(provider, account)
      );
      INSERT INTO integrations(
        provider,account,label,status,secret_ref,masked_identifier,scopes_json,
        last_sync_at,next_sync_at,expires_at,quota_json,config_json,updated_at)
        SELECT provider,'default',label,status,secret_ref,masked_identifier,
               scopes_json,last_sync_at,next_sync_at,expires_at,quota_json,
               config_json,updated_at
        FROM integrations_single_account_legacy;
      DROP TABLE integrations_single_account_legacy;
      PRAGMA legacy_alter_table = OFF;

      -- Which external entity a workspace reads from. Generalizes
      -- project_integrations, which could express exactly one entity per
      -- provider per project.
      CREATE TABLE channel_accounts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        account TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('search','analytics','ads','social')),
        external_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        -- Ads only, and only when the provider reported one. Never assumed:
        -- a spend figure without its currency is not a number a marketer can
        -- act on, and guessing one is worse than declining to total.
        currency TEXT,
        -- A locally authored bound, independent of any provider-side cap.
        -- A provider cap is set by the same call that could carry the wrong
        -- number, so it cannot also be the check on that number.
        daily_spend_cap REAL CHECK(daily_spend_cap IS NULL OR daily_spend_cap >= 0),
        total_spend_cap REAL CHECK(total_spend_cap IS NULL OR total_spend_cap >= 0),
        created_at TEXT NOT NULL,
        archived_at TEXT,
        UNIQUE(workspace_id, provider, account, external_id)
      );
      CREATE INDEX idx_channel_accounts_workspace
        ON channel_accounts(workspace_id, kind, archived_at);

      -- The cross-channel fact table. value is nullable with a separate state
      -- so "we spent nothing" and "we could not ask" never collapse into one
      -- another. platform records where a paid impression was actually served,
      -- because Meta bills one cabinet across Facebook, Instagram and more, and
      -- an account total cannot answer which of them is expensive. 'all' means
      -- the provider reported the row without a breakdown, which is a
      -- different claim from a row that happened to be Facebook.
      CREATE TABLE channel_metrics (
        workspace_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
        entity_kind TEXT NOT NULL
          CHECK(entity_kind IN ('account','campaign','adset','ad','post','profile')),
        entity_id TEXT NOT NULL,
        entity_name TEXT,
        platform TEXT NOT NULL DEFAULT 'all'
          CHECK(platform IN ('all','facebook','instagram','messenger','audience_network','unknown')),
        date TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        value REAL,
        state TEXT NOT NULL CHECK(state IN ('available','partial','unavailable','failed')),
        currency TEXT,
        source TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        note TEXT,
        -- An available reading must carry a number, and anything else must not
        -- carry one. This is the zero-substitution rule expressed where it
        -- cannot be forgotten by a future writer.
        CHECK(
          (state = 'available' AND value IS NOT NULL)
          OR (state <> 'available' AND value IS NULL)
        ),
        PRIMARY KEY(channel_account_id, entity_kind, entity_id, platform, date, metric_key)
      );
      CREATE INDEX idx_channel_metrics_window
        ON channel_metrics(channel_account_id, date DESC, metric_key);
      CREATE INDEX idx_channel_metrics_workspace
        ON channel_metrics(workspace_id, date DESC);
    `,
  },
  {
    version: 15,
    name: "campaign-staging",
    sql: `
      -- The composer's staging half. Nothing in these tables reaches a
      -- provider: a brief holds intent, deliverables hold copy, and a publish
      -- intent holds the exact payload that would be sent. Approval is the
      -- gate, and the server pins it to the browser's own transport rather
      -- than to a role field a caller could set.
      CREATE TABLE campaign_briefs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        audience TEXT,
        key_message TEXT,
        constraints TEXT,
        status TEXT NOT NULL CHECK(status IN ('draft','in_review','archived')),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_campaign_briefs_project
        ON campaign_briefs(project_id, created_at DESC);

      CREATE TABLE campaign_deliverables (
        id TEXT PRIMARY KEY,
        brief_id TEXT NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK(channel IN (
          'facebook-ad','instagram-ad','instagram-post','instagram-reel',
          'facebook-post','seo-article')),
        headline TEXT,
        body TEXT NOT NULL,
        call_to_action TEXT,
        destination_url TEXT,
        creative_notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_campaign_deliverables_brief
        ON campaign_deliverables(brief_id, created_at);

      CREATE TABLE publish_intents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        deliverable_id TEXT NOT NULL REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
        state TEXT NOT NULL CHECK(state IN ('staged','approved','void','withdrawn')),
        -- The exact request body, stored rather than summarized. When a
        -- campaign misbehaves the question is always "what did we send", and a
        -- reconstruction is not an answer.
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
        daily_budget REAL CHECK(daily_budget IS NULL OR daily_budget >= 0),
        lifetime_budget REAL CHECK(lifetime_budget IS NULL OR lifetime_budget >= 0),
        currency TEXT,
        staged_by TEXT NOT NULL,
        staged_at TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        -- The hash the operator actually read. An approval that does not name
        -- the payload it approved is a record of consent that was not informed.
        approved_payload_hash TEXT
          CHECK(approved_payload_hash IS NULL OR length(approved_payload_hash) = 64),
        note TEXT,
        CHECK(
          (state = 'approved' AND approved_by IS NOT NULL
             AND approved_at IS NOT NULL AND approved_payload_hash IS NOT NULL)
          OR state <> 'approved'
        )
      );
      CREATE INDEX idx_publish_intents_project
        ON publish_intents(project_id, state, staged_at DESC);
      CREATE INDEX idx_publish_intents_deliverable
        ON publish_intents(deliverable_id, staged_at DESC);
    `,
  },
  {
    version: 16,
    name: "media-library",
    sql: `
      -- Uploaded assets live on the operator's disk, content-addressed. The
      -- media type is what the file's own signature says, not what the upload
      -- declared: both the extension and the Content-Type header are supplied
      -- by the caller and neither is evidence about the bytes.
      CREATE TABLE media_assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        media_type TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('image','video')),
        size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
        sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
        path TEXT NOT NULL,
        width INTEGER CHECK(width IS NULL OR width > 0),
        height INTEGER CHECK(height IS NULL OR height > 0),
        created_at TEXT NOT NULL,
        -- Null means the bytes have never left this machine, which is the
        -- default and the state every platform except Instagram publishes
        -- from. A value here is a deliberate act the operator took.
        public_url TEXT,
        public_url_source TEXT,
        public_url_at TEXT,
        CHECK(
          (public_url IS NULL AND public_url_source IS NULL AND public_url_at IS NULL)
          OR (public_url IS NOT NULL AND public_url_source IS NOT NULL AND public_url_at IS NOT NULL)
        ),
        UNIQUE(project_id, sha256)
      );
      CREATE INDEX idx_media_assets_project
        ON media_assets(project_id, created_at DESC);

      -- Which assets a deliverable carries, and in what order. Ordering is
      -- part of the post on every platform that accepts more than one.
      CREATE TABLE deliverable_media (
        deliverable_id TEXT NOT NULL REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
        media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK(position >= 0),
        PRIMARY KEY(deliverable_id, media_id),
        UNIQUE(deliverable_id, position)
      );
    `,
  },
  {
    version: 17,
    name: "scheduled-publishing",
    sql: `
      -- Approval already binds to a payload hash. Scheduling adds a time, and
      -- the time is part of what was consented to: moving a post is a change
      -- to the approved thing, so the runtime voids approval when it moves.
      ALTER TABLE publish_intents ADD COLUMN scheduled_at TEXT;
      ALTER TABLE publish_intents ADD COLUMN timezone TEXT;
      -- Generated at approval and carried by the durable job. No provider here
      -- offers idempotency, so this is the key our own record is written
      -- under, and it is what makes a crashed attempt resolvable.
      ALTER TABLE publish_intents ADD COLUMN idempotency_key TEXT;
      ALTER TABLE publish_intents ADD COLUMN platform TEXT;

      CREATE INDEX idx_publish_intents_due
        ON publish_intents(state, scheduled_at);

      -- Immutable. The exact request and the provider's exact response
      -- identifier, because when a post misbehaves the question is always
      -- "what did we actually send" and a reconstruction is not an answer.
      --
      -- Records outlive the intent, the deliverable and the brief: a row here
      -- is the evidence that something was published under the operator's
      -- name, and deleting the draft must not erase that.
      CREATE TABLE publish_records (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        -- 'attempting' is written before the outbound call. A row left in that
        -- state after a crash is the honest description of what we know: a
        -- request left, and whether it arrived is unknown. It resolves to
        -- 'indeterminate' rather than to either neighbour, because guessing
        -- one way double-posts and the other way silently drops a post.
        state TEXT NOT NULL
          CHECK(state IN ('attempting','published','failed','indeterminate')),
        request_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        provider_id TEXT,
        permalink TEXT,
        error TEXT,
        attempted_at TEXT NOT NULL,
        completed_at TEXT,
        -- One record per idempotency key. This is the constraint that makes a
        -- concurrent second worker fail to insert rather than send again.
        UNIQUE(idempotency_key)
      );
      CREATE INDEX idx_publish_records_intent
        ON publish_records(intent_id, attempted_at DESC);
      CREATE INDEX idx_publish_records_project
        ON publish_records(project_id, attempted_at DESC);
    `,
  },
  {
    version: 18,
    name: "organic-publishing-states",
    foreignKeysOff: true,
    sql: `
      -- The deliverable channels were an ads vocabulary. Organic posting adds
      -- three, of which social-post is the channel-agnostic one: the composer
      -- writes it once and derives the per-platform payload, so a post going
      -- to four places stays one piece of copy rather than four near-duplicates
      -- that drift apart the first time someone edits three of them.
      --
      -- SQLite cannot alter a CHECK constraint, so this is a table rebuild.
      -- deliverable_media references this table, which is why foreign keys are
      -- held off for the swap and re-checked after it.
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE campaign_deliverables RENAME TO campaign_deliverables_ads_only;
      CREATE TABLE campaign_deliverables (
        id TEXT PRIMARY KEY,
        brief_id TEXT NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK(channel IN (
          'facebook-ad','instagram-ad','instagram-post','instagram-reel',
          'facebook-post','seo-article',
          'social-post','telegram-post','x-post')),
        headline TEXT,
        body TEXT NOT NULL,
        call_to_action TEXT,
        destination_url TEXT,
        creative_notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO campaign_deliverables
        SELECT id,brief_id,channel,headline,body,call_to_action,destination_url,
               creative_notes,created_by,created_at,updated_at
        FROM campaign_deliverables_ads_only;
      DROP TABLE campaign_deliverables_ads_only;
      CREATE INDEX idx_campaign_deliverables_brief
        ON campaign_deliverables(brief_id, created_at);

      -- An intent now has a lifecycle rather than two end states. The
      -- publishing state is what a worker claims, conditioned on the row still
      -- being approved, and it is the mechanism that stops two workers sending
      -- the same post. Published and failed are where a send settles.
      ALTER TABLE publish_intents RENAME TO publish_intents_staging_only;
      CREATE TABLE publish_intents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        deliverable_id TEXT NOT NULL REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
        state TEXT NOT NULL CHECK(state IN (
          'staged','approved','publishing','published','failed','void','withdrawn')),
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
        daily_budget REAL CHECK(daily_budget IS NULL OR daily_budget >= 0),
        lifetime_budget REAL CHECK(lifetime_budget IS NULL OR lifetime_budget >= 0),
        currency TEXT,
        staged_by TEXT NOT NULL,
        staged_at TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        approved_payload_hash TEXT
          CHECK(approved_payload_hash IS NULL OR length(approved_payload_hash) = 64),
        note TEXT,
        scheduled_at TEXT,
        timezone TEXT,
        idempotency_key TEXT,
        platform TEXT,
        -- An approval must name who gave it, when, and to which payload. The
        -- later states inherit that record rather than re-asserting it, so the
        -- constraint covers the moment consent is given and every state that
        -- descends from it.
        CHECK(
          state IN ('staged','void','withdrawn')
          OR (approved_by IS NOT NULL AND approved_at IS NOT NULL
              AND approved_payload_hash IS NOT NULL)
        )
      );
      INSERT INTO publish_intents
        SELECT id,project_id,deliverable_id,channel_account_id,state,payload_json,
               payload_hash,daily_budget,lifetime_budget,currency,staged_by,staged_at,
               approved_by,approved_at,approved_payload_hash,note,
               scheduled_at,timezone,idempotency_key,platform
        FROM publish_intents_staging_only;
      DROP TABLE publish_intents_staging_only;
      CREATE INDEX idx_publish_intents_project
        ON publish_intents(project_id, state, staged_at DESC);
      CREATE INDEX idx_publish_intents_deliverable
        ON publish_intents(deliverable_id, staged_at DESC);
      CREATE INDEX idx_publish_intents_due
        ON publish_intents(state, scheduled_at);
      PRAGMA legacy_alter_table = OFF;
    `,
  },
  {
    version: 19,
    name: "brand-kit-and-email-templates",
    sql: `
      -- Versioned like project context, and for the same reason: the brand is
      -- a decision an operator revises, and an email built last quarter should
      -- still say which colours it was built against.
      CREATE TABLE brand_kit_versions (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK(revision > 0),
        profile_json TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(project_id, revision)
      );
      CREATE INDEX idx_brand_kit_versions_project
        ON brand_kit_versions(project_id, revision DESC);

      CREATE TABLE email_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        purpose TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_email_templates_project
        ON email_templates(project_id, updated_at DESC);

      -- Immutable revisions. Both the submitted source and the compiled output
      -- are kept: the source is what a person edits next, and the compiled
      -- document is what was exported and possibly already sent to a list.
      -- Regenerating the second from the first would not reproduce it once the
      -- brand kit or the compiler changes.
      CREATE TABLE email_template_versions (
        template_id TEXT NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK(revision > 0),
        subject TEXT NOT NULL,
        preheader TEXT NOT NULL DEFAULT '',
        source_html TEXT NOT NULL,
        compiled_html TEXT NOT NULL,
        plain_text TEXT NOT NULL,
        report_json TEXT NOT NULL,
        -- Which brand revision this was compiled against, so a later brand
        -- change does not silently rewrite what an old email claimed to be.
        brand_revision INTEGER,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(template_id, revision)
      );
      CREATE INDEX idx_email_template_versions_template
        ON email_template_versions(template_id, revision DESC);
    `,
  },
  {
    version: 20,
    name: "cross-channel-reports",
    sql: `
      -- Immutable snapshots. A report stores its own data rather than a query
      -- to re-run: a client received a specific document on a specific day, and
      -- regenerating it later against changed connectors, a revised brand kit
      -- or restated provider figures would produce something different and
      -- equally titled. Meta alone restates attributed conversions for days
      -- after the fact.
      CREATE TABLE marketing_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        -- The worst state across every section, so the list view can show
        -- coverage without unpacking the whole payload.
        state TEXT NOT NULL
          CHECK(state IN ('available','partial','unavailable','failed')),
        payload_json TEXT NOT NULL,
        -- What the report was rendered against, for the same reason the
        -- payload is frozen.
        brand_revision INTEGER,
        generated_at TEXT NOT NULL
      );
      CREATE INDEX idx_marketing_reports_project
        ON marketing_reports(project_id, generated_at DESC);

      -- Schedules could only ever start an audit: the worker had the workflow
      -- hardcoded. A monthly report is the first thing that needs a schedule
      -- to say what it runs, so the schedule now carries its own workflow and
      -- options. Existing rows default to the audit they already meant.
      ALTER TABLE schedules ADD COLUMN workflow_id TEXT NOT NULL DEFAULT 'audit';
      ALTER TABLE schedules ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 21,
    name: "campaign-links",
    sql: `
      -- Tagged campaign links, and the QR codes made from them.
      --
      -- tagged_url is stored rather than rebuilt from the parts. Once a code
      -- is printed, that string is what exists in the world; recomputing it
      -- later — after a naming convention changed, or after someone corrected
      -- a typo in the campaign name — would produce a record that quietly
      -- disagrees with the paper.
      CREATE TABLE campaign_links (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        utm_source TEXT NOT NULL,
        utm_medium TEXT NOT NULL,
        utm_campaign TEXT NOT NULL,
        utm_term TEXT,
        utm_content TEXT,
        tagged_url TEXT NOT NULL,
        placement TEXT NOT NULL
          CHECK(placement IN
            ('screen','print-handheld','print-poster','packaging','outdoor')),
        style_json TEXT NOT NULL,
        printed_width_mm REAL,
        findings_json TEXT NOT NULL DEFAULT '[]',
        -- Set when the code goes to print. After that the tagged URL is
        -- frozen, because editing it would leave the physical code pointing
        -- somewhere this row no longer describes.
        printed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_campaign_links_project
        ON campaign_links(project_id, created_at DESC);

      -- One tagged URL per project. Two links tagged identically are not two
      -- links: they are the same row in every report, and keeping both means
      -- neither can be attributed to the thing it was printed on.
      CREATE UNIQUE INDEX idx_campaign_links_tagged
        ON campaign_links(project_id, tagged_url);
    `,
  },
  {
    version: 22,
    name: "google-ads",
    // Rebuilds channel_metrics, whose CHECK constraints enumerate the values
    // the Meta connector could produce. Widening them is a rebuild rather than
    // an ALTER because SQLite has no way to alter a CHECK.
    foreignKeysOff: true,
    sql: `
      -- Two vocabularies widen for Google.
      --
      -- entity_kind gains 'keyword': the bid unit, and the level where most
      -- account waste is actually visible.
      --
      -- platform gains Google's networks. Search and Search Partners stay
      -- separate because partner traffic converts differently and is switched
      -- off separately. Performance Max is its own value rather than being
      -- folded into the networks it runs on, because Google reports it as one
      -- opaque surface and calling it 'google_search' would claim a breakdown
      -- that does not exist.
      ALTER TABLE channel_metrics RENAME TO channel_metrics_meta_only;
      CREATE TABLE channel_metrics (
        workspace_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
        entity_kind TEXT NOT NULL
          CHECK(entity_kind IN
            ('account','campaign','adset','ad','keyword','post','profile')),
        entity_id TEXT NOT NULL,
        entity_name TEXT,
        platform TEXT NOT NULL DEFAULT 'all'
          CHECK(platform IN (
            'all','facebook','instagram','messenger','audience_network',
            'google_search','google_search_partners','google_display',
            'google_youtube','google_performance_max','unknown')),
        date TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        value REAL,
        state TEXT NOT NULL CHECK(state IN ('available','partial','unavailable','failed')),
        currency TEXT,
        source TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        note TEXT,
        CHECK(
          (state = 'available' AND value IS NOT NULL)
          OR (state <> 'available' AND value IS NULL)
        ),
        PRIMARY KEY(channel_account_id, entity_kind, entity_id, platform, date, metric_key)
      );
      INSERT INTO channel_metrics
        SELECT workspace_id,channel_account_id,entity_kind,entity_id,entity_name,
               platform,date,metric_key,value,state,currency,source,fetched_at,note
        FROM channel_metrics_meta_only;
      DROP TABLE channel_metrics_meta_only;
      CREATE INDEX idx_channel_metrics_window
        ON channel_metrics(channel_account_id, date DESC, metric_key);
      CREATE INDEX idx_channel_metrics_workspace
        ON channel_metrics(workspace_id, date DESC);

      -- The queries people actually typed.
      --
      -- Aggregated over the sync window rather than per day. A daily row would
      -- multiply the largest table here by the window length for no analytical
      -- gain: the question is whether a query ever earned its cost, and one
      -- day of one query is almost never enough to answer it.
      --
      -- Costs are stored in the account currency, converted from Google's
      -- micros exactly once on the way in.
      CREATE TABLE search_terms (
        workspace_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        channel_account_id TEXT NOT NULL REFERENCES channel_accounts(id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL,
        campaign_name TEXT,
        ad_group_id TEXT NOT NULL,
        ad_group_name TEXT,
        query TEXT NOT NULL,
        matched_keyword TEXT,
        match_type TEXT NOT NULL
          CHECK(match_type IN
            ('exact','phrase','broad','near_exact','near_phrase','unknown')),
        -- Whether the operator already acted on this term, so the audit does
        -- not keep proposing a negative that already exists.
        status TEXT NOT NULL
          CHECK(status IN ('added','excluded','added_excluded','none','unknown')),
        impressions REAL,
        clicks REAL,
        cost REAL,
        -- Fractional on purpose. Google divides a conversion across the clicks
        -- it credits, so 0.5 is a real reading, and rounding it to zero would
        -- turn a converting query into a wasteful one.
        conversions REAL,
        conversion_value REAL,
        currency TEXT,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY(channel_account_id, window_start, window_end, campaign_id, ad_group_id, query)
      );
      CREATE INDEX idx_search_terms_waste
        ON search_terms(channel_account_id, window_end DESC, cost DESC);
      CREATE INDEX idx_search_terms_workspace
        ON search_terms(workspace_id, window_end DESC);
    `,
  },
];
