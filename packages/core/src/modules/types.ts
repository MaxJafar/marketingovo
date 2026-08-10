// Module interface — the contract every marketingovo module must satisfy.
//
// A module is a self-contained, independently testable, independently
// composable unit of SEO work. The composer (src/core/composer.ts,
// planned Sprint 3) runs modules in parallel where dependencies allow
// and chains them in order otherwise. The deep-research mode re-runs
// modules that produced weak signals (see signal-eval.ts).
//
// Backward compat note: existing CheckFn-based checks (see
// src/checks/index.ts) are wrapped by modules. A module may expose
// its underlying CheckFns via the `checks` field so the existing
// single-purpose run-all path (runAllChecks in src/checks/index-all.ts)
// keeps working unchanged for as long as v0.x is supported.

import type { CheckFn, Issue } from "../checks/index.js";
import type { Limits } from "../core/limits.js";
import type { ProjectStore } from "../core/store.js";
import type { CrawlOutcome } from "../orchestrator.js";
import type { Logger } from "../core/logger.js";

declare const moduleIdBrand: unique symbol;
declare const workflowIdBrand: unique symbol;

/**
 * Stable, lowercase-kebab identifier for executable leaf modules. Used in
 * CLI subcommands, store keys, and dependency declarations. Workflow ids are
 * deliberately a separate type so a workflow cannot recursively enter the
 * leaf-module registry.
 */
export type ModuleId =
  | "crawl"
  | "onpage"
  | "technical"
  | "performance"
  | "content-quality"
  | "link-analysis"
  | "integrations:gsc"
  | "integrations:ga4"
  | "integrations:trends"
  | "integrations:lighthouse"
  | "integrations:psi"
  | "integrations:meta-ads"
  | "integrations:bwt"
  | "integrations:keyword-research"
  | "integrations:change-detection"
  | "integrations:topic-clusters"
  | "compare"
  | "offpage"
  | "serp"
  | "keyword-research"
  | "content-gap"
  | "content-brief"
  | "content-optimization"
  | "tech-fix-prioritization"
  | "change-monitoring"
  | "topic-clusters"
  | "audit-history"
  | "audit-diff"
  | "audit-report"
  | "audit-schedule"
  | "export-cms"
  | "export-pdf"
  | "export-notion"
  | "export-sheets"
  | "github-pr"
  | "image-optimization"
  | "schema-validation"
  | "redirect-audit"
  | "pagination-audit"
  | "amp-validation"
  | "search-intent"
  | "share-of-voice"
  | "brand-mentions"
  | "competitor-deep-dive"
  | (string & { readonly [moduleIdBrand]: true });

/** Stable identifier for orchestration workflows (never a leaf ModuleId). */
export type WorkflowId =
  "audit-full" | (string & { readonly [workflowIdBrand]: true });

/**
 * The four categories used in project.md. A module's category tells
 * the operator what kind of capability it provides and what existing
 * tool/integration/research/process it competes with.
 */
export type ModuleCategory = "tool" | "integration" | "research" | "process";

/**
 * A minimal JSON Schema subset. We don't pull in a full draft-07 type
 * to keep the surface small; full validation can be added in Sprint 15
 * (enterprise hardening) via ajv or similar.
 */
export interface JSONSchemaSubset {
  readonly type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  readonly properties?: Record<string, JSONSchemaSubset>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JSONSchemaSubset;
  readonly enum?: readonly unknown[];
  readonly description?: string;
  readonly default?: unknown;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly pattern?: string;
}

/** Input to a module's invoke(). Shape constrained by inputSchema. */
export type ModuleInput = Record<string, unknown>;

/** Output from a module's invoke(). Shape constrained by outputSchema. */
export type ModuleOutput = Record<string, unknown>;

/**
 * A prerequisite that must be available before a leaf module is invoked.
 * `configKeys` remains descriptive (many of those settings have defaults);
 * only entries in `requirements` are treated as mandatory by the executor.
 */
export type ModuleRequirement =
  | {
      readonly kind: "environment";
      readonly keys: readonly string[];
      /** Require every key (default) or at least one key. */
      readonly mode?: "all" | "any";
      readonly description?: string;
    }
  | {
      readonly kind: "capability";
      readonly id: string;
      /** A deterministic local check; it must not perform network I/O. */
      readonly available: () => boolean;
      readonly description?: string;
    };

/**
 * Per-invocation context provided by the composer.
 *
 * - `moduleResults` contains outputs from modules that ran earlier
 *   (either dependency modules, or earlier passes in deep-research mode).
 * - `crawlOutcome` is populated for any module that depends on `crawl`.
 * - `signal` is used by the composer to record weak signals and
 *   schedule follow-up passes.
 */
export interface ModuleContext {
  readonly projectRoot: string;
  readonly limits: Limits;
  readonly store?: ProjectStore;
  readonly logger: Logger;
  readonly crawlOutcome?: CrawlOutcome;
  readonly moduleResults: ReadonlyMap<ModuleId, ModuleOutput>;
  /** Ephemeral, vault-sourced credentials for this invocation only. */
  readonly integrationCredentials?: Readonly<
    Record<string, Readonly<Record<string, string | number | undefined>>>
  >;
  /**
   * Optional provider-only transport supplied by the host. Production modules
   * use their exact-host pinned default when this test/host seam is absent.
   */
  readonly providerFetch?: typeof fetch;
  readonly signal: ModuleSignalContext;
}

export interface ModuleSignalContext {
  /**
   * Record that this module produced a weak signal. The composer uses
   * this to schedule a follow-up pass with deeper settings.
   */
  markWeak(reason: string): void;
  /**
   * Record that this module produced a strong signal. The composer
   * can use this to skip follow-up passes for the same module.
   */
  markStrong(reason: string): void;
  /** True if this is a follow-up pass (i.e. the module ran before). */
  readonly isFollowUp: boolean;
}

export interface ModuleSelfTestResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly checkedAt: string;
}

/**
 * The module contract. Every module must export a constant that
 * satisfies this interface. The loader (src/modules/loader.ts) walks
 * the modules directory, imports each module, and validates the
 * exported object against this contract.
 *
 * Stability: this interface is part of the v1 public API. Breaking
 * changes require a major version bump.
 */
export interface Module {
  /**
   * Modules in this registry are leaf executors. The field is optional for
   * v0.x compatibility and defaults to `leaf`.
   */
  readonly kind?: "leaf";
  readonly id: ModuleId;
  readonly version: string; // semver
  readonly displayName: string;
  readonly category: ModuleCategory;
  readonly description: string;
  readonly inputSchema: JSONSchemaSubset;
  readonly outputSchema: JSONSchemaSubset;
  /** Module ids that must run before this one. The composer uses this
   *  to build a DAG and topologically order execution. */
  readonly dependsOn: readonly ModuleId[];
  /** Env var names this module reads. Used by the operator-facing
   *  config validator to surface missing keys before a run. */
  readonly configKeys: readonly string[];
  /** Mandatory, explicitly checkable prerequisites. */
  readonly requirements?: readonly ModuleRequirement[];
  /** Run the module. May be sync or async. */
  invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput>;
  /** Verify the module can run in this environment. Should not
   *  actually fetch external resources — just check config, auth,
   *  and binary availability. */
  selfTest(): Promise<ModuleSelfTestResult>;
  /**
   * Underlying CheckFn functions, if the module wraps the existing
   * check system. Optional — modules without per-page checks (e.g.
   * integrations, research) can omit this.
   */
  readonly checks?: readonly CheckFn[];
  /**
   * Issues from the last invoke() call. Populated by the composer
   * after a run. The composer reads this to build the unified report.
   * Optional for modules that produce non-issue output (e.g. GSC
   * data, Lighthouse scores, content-gap term lists).
   */
  readonly lastIssues?: readonly Issue[];
}

/** A leaf-only registry supplied to workflow planning. */
export type LeafModuleRegistry = ReadonlyMap<ModuleId, Module>;

/**
 * Immutable plan produced by a workflow before any side effects begin.
 * Executors may add runtime scheduling detail, but can only schedule the
 * leaf module ids captured here.
 */
export interface WorkflowExecutionPlan {
  readonly workflowId: WorkflowId;
  readonly input: ModuleInput;
  readonly moduleIds: readonly ModuleId[];
}

/**
 * Workflows plan orchestration and live in a registry separate from Module.
 * They intentionally have no invoke method, dependency list, or self-test,
 * making recursive workflow scheduling impossible by type and registry.
 */
export interface Workflow {
  readonly kind: "workflow";
  readonly id: WorkflowId;
  readonly version: string;
  readonly displayName: string;
  readonly category: "process";
  readonly description: string;
  readonly inputSchema: JSONSchemaSubset;
  readonly outputSchema: JSONSchemaSubset;
  createPlan(
    input: ModuleInput,
    registry: LeafModuleRegistry,
  ): WorkflowExecutionPlan;
}
