// Generated from packages/server/dist/openapi.json. Do not edit.
export type paths = {
  "/api/v1/actions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          projectId?: string;
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  affectedUrls: string[];
                  confidence: number;
                  /** Format: date-time */
                  createdAt: string;
                  effort: "low" | "medium" | "high";
                  id: string;
                  impact: number;
                  issueFingerprint?: string;
                  moduleId?: string;
                  owner: string | null;
                  priorityScore: number;
                  projectId: string;
                  ruleId?: string;
                  scoreInputs: {
                    confidence: number;
                    conversionExposure: number | null;
                    organicExposure: number | null;
                    severity: number;
                    unavailable: string[];
                    urlReach: number;
                  };
                  /** @enum {string} */
                  scoreVersion: "priority-v1";
                  status: "open" | "acknowledged" | "in_progress" | "resolved";
                  title: string;
                  /** Format: date-time */
                  updatedAt: string;
                  verification: "pending" | "verified" | "regressed";
                  whyNow: string;
                }[]
              | {
                  data: {
                    items: {
                      affectedUrls: number;
                      confidence: number;
                      effort: "small" | "medium" | "large";
                      evidence: {
                        label: string;
                        /** @enum {string} */
                        source: "crawl";
                        /** Format: uri */
                        url: string;
                        /** Format: uri */
                        value: string;
                      }[];
                      id: string;
                      impact: "high" | "medium" | "low";
                      owner: string | null;
                      priority: "critical" | "high" | "medium" | "low";
                      priorityExplanation: string;
                      priorityScore: number;
                      status:
                        "open" | "acknowledged" | "in_progress" | "resolved";
                      summary: string;
                      title: string;
                      whyNow: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/actions/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            owner?: string | null;
            status?: "open" | "acknowledged" | "in_progress" | "resolved";
            verification?: "pending" | "verified" | "regressed";
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              affectedUrls: string[];
              confidence: number;
              /** Format: date-time */
              createdAt: string;
              effort: "low" | "medium" | "high";
              id: string;
              impact: number;
              issueFingerprint?: string;
              moduleId?: string;
              owner: string | null;
              priorityScore: number;
              projectId: string;
              ruleId?: string;
              scoreInputs: {
                confidence: number;
                conversionExposure: number | null;
                organicExposure: number | null;
                severity: number;
                unavailable: string[];
                urlReach: number;
              };
              /** @enum {string} */
              scoreVersion: "priority-v1";
              status: "open" | "acknowledged" | "in_progress" | "resolved";
              title: string;
              /** Format: date-time */
              updatedAt: string;
              verification: "pending" | "verified" | "regressed";
              whyNow: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The action was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/actions/{id}/checkpoints": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": Record<string, never>;
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  actionId: string;
                  baselineRunId: string;
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  projectId: string;
                  state:
                    | "active"
                    | "verification_queued"
                    | "technically_verified"
                    | "regressed"
                    | "inconclusive";
                  /** Format: date-time */
                  updatedAt: string;
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    id: string;
                    /** @enum {string} */
                    state: "active";
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The action was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description A completed audit baseline is required before creating a checkpoint. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/actions/{id}/evidence": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          cursor?: string;
          limit?: number;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  action: {
                    affectedUrls: string[];
                    confidence: number;
                    /** Format: date-time */
                    createdAt: string;
                    effort: "low" | "medium" | "high";
                    id: string;
                    impact: number;
                    issueFingerprint?: string;
                    moduleId?: string;
                    owner: string | null;
                    priorityScore: number;
                    projectId: string;
                    ruleId?: string;
                    scoreInputs: {
                      confidence: number;
                      conversionExposure: number | null;
                      organicExposure: number | null;
                      severity: number;
                      unavailable: string[];
                      urlReach: number;
                    };
                    /** @enum {string} */
                    scoreVersion: "priority-v1";
                    status:
                      "open" | "acknowledged" | "in_progress" | "resolved";
                    title: string;
                    /** Format: date-time */
                    updatedAt: string;
                    verification: "pending" | "verified" | "regressed";
                    whyNow: string;
                  };
                  history: {
                    affectedCount: number;
                    /** Format: date-time */
                    observedAt: string;
                    runId: string;
                    status: "present" | "resolved" | "reappeared";
                  }[];
                  outcomes: {
                    checkpointId: string;
                    confidence: number | null;
                    controlAdjustedChange: number | null;
                    controlChange: number | null;
                    id: string;
                    limitations: string[];
                    observedAt: string | null;
                    period: {
                      /** Format: date */
                      end: string;
                      /** Format: date */
                      start: string;
                    } | null;
                    state:
                      "pending" | "observed" | "inconclusive" | "unavailable";
                    targetChange: number | null;
                    windowDays: 7 | 14 | 28;
                  }[];
                  pageInfo: {
                    nextCursor: string | null;
                    total: number;
                  };
                  sources: {
                    coverage: number | null;
                    note?: string;
                    observedAt: string | null;
                    source: string;
                    state: "available" | "unavailable" | "stale" | "failed";
                    value: number | null;
                  }[];
                  summary: {
                    clicks: number | null;
                    impressions: number | null;
                    issueOccurrences: number;
                    keyEvents: number | null;
                    newOccurrences: number;
                    persistentOccurrences: number;
                    reappearedOccurrences: number;
                    resolvedOccurrences: number;
                    totalUrls: number;
                  };
                  urls: {
                    cwv: {
                      cls: number | null;
                      lcp: number | null;
                      state: "available" | "unavailable" | "stale" | "failed";
                      ttfb: number | null;
                    } | null;
                    ga4: {
                      keyEvents: number;
                      period: {
                        /** Format: date */
                        end: string;
                        /** Format: date */
                        start: string;
                      };
                      sessions: number;
                      state: "available" | "unavailable" | "stale" | "failed";
                    } | null;
                    gsc: {
                      clicks: number;
                      ctr: number;
                      impressions: number;
                      period: {
                        /** Format: date */
                        end: string;
                        /** Format: date */
                        start: string;
                      };
                      position: number;
                      state: "available" | "unavailable" | "stale" | "failed";
                    } | null;
                    indexable: boolean | null;
                    issue: {
                      canonicalUrl: string | null;
                      description: string;
                      evidence: {
                        kind: string;
                        label: string;
                        /** Format: date-time */
                        observedAt?: string;
                        source?: string;
                        value?: unknown;
                      }[];
                      fingerprint: string;
                      /** Format: date-time */
                      firstSeenAt: string;
                      /** Format: date-time */
                      lastSeenAt: string;
                      moduleId: string;
                      ruleId: string;
                      severity: "critical" | "high" | "medium" | "low" | "info";
                      status:
                        "open" | "resolved" | "ignored" | "false_positive";
                      title: string;
                    } | null;
                    lifecycle: "new" | "persistent" | "resolved" | "reappeared";
                    statusCode: number | null;
                    title: string | null;
                    /** Format: uri */
                    url: string;
                  }[];
                  verification: {
                    checkedAt: string | null;
                    checkpointId: string | null;
                    coverage: number | null;
                    reason: string | null;
                    runId: string | null;
                    state:
                      | "not_started"
                      | "queued"
                      | "running"
                      | "verified"
                      | "regressed"
                      | "inconclusive";
                  };
                }
              | {
                  data: {
                    action: {
                      affectedUrlList: string[];
                      affectedUrls: number;
                      confidence: number;
                      /** Format: date-time */
                      createdAt: string;
                      effort: "small" | "medium" | "large";
                      evidence: {
                        label: string;
                        /** @enum {string} */
                        source: "crawl";
                        /** Format: uri */
                        url: string;
                        /** Format: uri */
                        value: string;
                      }[];
                      id: string;
                      impact: "high" | "medium" | "low";
                      moduleId: string;
                      owner: string | null;
                      priority: "critical" | "high" | "medium" | "low";
                      priorityExplanation: string;
                      priorityScore: number;
                      ruleId: string;
                      scoreInputs: {
                        confidence: number;
                        conversionExposure: number | null;
                        organicExposure: number | null;
                        severity: number;
                        unavailable: string[];
                        urlReach: number;
                      };
                      /** @enum {string} */
                      scoreVersion: "priority-v1";
                      status:
                        "open" | "acknowledged" | "in_progress" | "resolved";
                      summary: string;
                      title: string;
                      /** Format: date-time */
                      updatedAt: string;
                      verification: "pending" | "verified" | "regressed";
                      whyNow: string;
                    };
                    history: {
                      affectedCount: number;
                      /** Format: date-time */
                      observedAt: string;
                      runId: string;
                      status: string;
                    }[];
                    pageInfo: {
                      nextCursor: string | null;
                      total: number;
                    };
                    sources: {
                      availability:
                        | "fresh"
                        | "stale"
                        | "missing"
                        | "unavailable"
                        | "unknown";
                      coverage: number | null;
                      id: string;
                      message: string | null;
                      name: string;
                      status: "healthy" | "degraded" | "offline" | "unknown";
                      updatedAt: string | null;
                    }[];
                    summary: {
                      clicks: number | null;
                      impressions: number | null;
                      issueOccurrences: number;
                      keyEvents: number | null;
                      newOccurrences: number;
                      persistentOccurrences: number;
                      reappearedOccurrences: number;
                      resolvedOccurrences: number;
                      totalUrls: number;
                    };
                    urls: {
                      cwv: {
                        cls: number | null;
                        lcp: number | null;
                        state:
                          | "fresh"
                          | "stale"
                          | "missing"
                          | "unavailable"
                          | "unknown"
                          | "available"
                          | "failed";
                        ttfb: number | null;
                      } | null;
                      ga4: {
                        keyEvents: number | null;
                        periodEnd: string | null;
                        periodStart: string | null;
                        sessions: number | null;
                        state:
                          | "fresh"
                          | "stale"
                          | "missing"
                          | "unavailable"
                          | "unknown"
                          | "available"
                          | "failed";
                      } | null;
                      gsc: {
                        clicks: number | null;
                        ctr: number | null;
                        impressions: number | null;
                        periodEnd: string | null;
                        periodStart: string | null;
                        position: number | null;
                        state:
                          | "fresh"
                          | "stale"
                          | "missing"
                          | "unavailable"
                          | "unknown"
                          | "available"
                          | "failed";
                      } | null;
                      indexable: boolean | null;
                      issue: {
                        description: string;
                        evidence: {
                          kind?: string;
                          label: string;
                          observedAt?: string | null;
                          source?: string | null;
                          url?: string | null;
                          value?: unknown;
                        }[];
                        fingerprint: string;
                        /** Format: date-time */
                        firstSeenAt: string;
                        /** Format: date-time */
                        lastSeenAt: string;
                        severity:
                          "critical" | "high" | "medium" | "low" | "info";
                        title: string;
                      } | null;
                      lifecycle:
                        "new" | "persistent" | "resolved" | "reappeared";
                      statusCode: number | null;
                      title: string | null;
                      /** Format: uri */
                      url: string;
                    }[];
                    verification: {
                      checkedAt: string | null;
                      checkpointId: string | null;
                      coverage: number | null;
                      reason: string | null;
                      runId: string | null;
                      state:
                        | "not_started"
                        | "queued"
                        | "running"
                        | "verified"
                        | "regressed"
                        | "inconclusive";
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The action was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/actions/{id}/outcomes": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  checkpointId: string;
                  confidence: number | null;
                  controlAdjustedChange: number | null;
                  controlChange: number | null;
                  id: string;
                  limitations: string[];
                  observedAt: string | null;
                  period: {
                    /** Format: date */
                    end: string;
                    /** Format: date */
                    start: string;
                  } | null;
                  state:
                    "pending" | "observed" | "inconclusive" | "unavailable";
                  targetChange: number | null;
                  windowDays: 7 | 14 | 28;
                }[]
              | {
                  data: {
                    items: {
                      checkpointId: string;
                      confidence: number | null;
                      controlAdjustedChange: number | null;
                      controlChange: number | null;
                      id: string;
                      limitations: string[];
                      observedAt: string | null;
                      period: {
                        /** Format: date */
                        end: string;
                        /** Format: date */
                        start: string;
                      } | null;
                      state:
                        "pending" | "observed" | "inconclusive" | "unavailable";
                      targetChange: number | null;
                      windowDays: 7 | 14 | 28;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/actions/{id}/verify": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: {
          "idempotency-key": string;
          "x-marketingovo-client"?: "dashboard";
        };
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            checkpointId: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  runId: string;
                  /** @enum {string} */
                  verificationState: "queued";
                }
              | {
                  data: {
                    runId: string;
                    /** @enum {string} */
                    verificationState: "queued";
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The action or checkpoint was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The checkpoint belongs to a different action. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The checkpoint has no URL targets available for verification. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                items: ({
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  projectId: string | null;
                  title: string;
                  /** Format: date-time */
                  updatedAt: string;
                } & {
                  presence: {
                    agent: {
                      agentId: string;
                      /** Format: date-time */
                      attachedAt: string;
                      harness: string;
                      label: string;
                      /** Format: date-time */
                      lastSeenAt: string;
                    } | null;
                    attached: boolean;
                    busy: boolean;
                  };
                })[];
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            projectId?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                /** Format: date-time */
                createdAt: string;
                id: string;
                projectId: string | null;
                title: string;
                /** Format: date-time */
                updatedAt: string;
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          since?: number;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                events: {
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  kind: "message" | "thought" | "tool" | "error" | "status";
                  role: "user" | "agent" | "system";
                  seq: number;
                  text: string;
                  tool?: string;
                }[];
                presence: {
                  agent: {
                    agentId: string;
                    /** Format: date-time */
                    attachedAt: string;
                    harness: string;
                    label: string;
                    /** Format: date-time */
                    lastSeenAt: string;
                  } | null;
                  attached: boolean;
                  busy: boolean;
                };
                session: {
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  projectId: string | null;
                  title: string;
                  /** Format: date-time */
                  updatedAt: string;
                };
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/attach": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            harness: string;
            label: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: unknown;
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/detach": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            agentId: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/emit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            agentId: string;
            kind: "message" | "thought" | "tool" | "error";
            text: string;
            tool?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                /** Format: date-time */
                createdAt: string;
                id: string;
                kind: "message" | "thought" | "tool" | "error" | "status";
                role: "user" | "agent" | "system";
                seq: number;
                text: string;
                tool?: string;
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/messages": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            text: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                /** Format: date-time */
                createdAt: string;
                id: string;
                kind: "message" | "thought" | "tool" | "error" | "status";
                role: "user" | "agent" | "system";
                seq: number;
                text: string;
                tool?: string;
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/stream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/agent/sessions/{id}/wait": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            agentId: string;
            waitMs?: number;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                cancelRequested: boolean;
                messages: {
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  kind: "message" | "thought" | "tool" | "error" | "status";
                  role: "user" | "agent" | "system";
                  seq: number;
                  text: string;
                  tool?: string;
                }[];
              };
              meta: unknown;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/brand-presence": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                items: {
                  declaredInSameAs: boolean;
                  id: string;
                  label: string;
                  linkedFrom: string[];
                  linkingPageCount: number;
                  reachability: "reachable" | "unreachable" | "unchecked";
                  reachabilityDetail: string | null;
                  url: string;
                }[];
                total: number;
              };
              meta: {
                /** Format: date-time */
                generatedAt: string;
                state:
                  "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                warnings: string[];
              };
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/calendar": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          end?: string;
          projectId: string;
          start?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  end: string;
                  entries: {
                    accountName: string;
                    attachmentCount: number;
                    briefId: string;
                    briefTitle: string;
                    channelAccountId: string;
                    deliverableId: string;
                    intentId: string;
                    platform: "telegram" | "x" | "facebook-page" | "instagram";
                    preview: string;
                    record: {
                      /** Format: date-time */
                      attemptedAt: string;
                      channelAccountId: string;
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      idempotencyKey: string;
                      intentId: string;
                      permalink: string | null;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      projectId: string;
                      providerId: string | null;
                      request: {
                        [key: string]: unknown;
                      };
                      state:
                        "attempting" | "published" | "failed" | "indeterminate";
                    } | null;
                    scheduledAt: string | null;
                    state: string;
                    timezone: string | null;
                  }[];
                  overdue: {
                    accountName: string;
                    attachmentCount: number;
                    briefId: string;
                    briefTitle: string;
                    channelAccountId: string;
                    deliverableId: string;
                    intentId: string;
                    platform: "telegram" | "x" | "facebook-page" | "instagram";
                    preview: string;
                    record: {
                      /** Format: date-time */
                      attemptedAt: string;
                      channelAccountId: string;
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      idempotencyKey: string;
                      intentId: string;
                      permalink: string | null;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      projectId: string;
                      providerId: string | null;
                      request: {
                        [key: string]: unknown;
                      };
                      state:
                        "attempting" | "published" | "failed" | "indeterminate";
                    } | null;
                    scheduledAt: string | null;
                    state: string;
                    timezone: string | null;
                  }[];
                  projectId: string;
                  /** Format: date-time */
                  start: string;
                  unscheduled: {
                    accountName: string;
                    attachmentCount: number;
                    briefId: string;
                    briefTitle: string;
                    channelAccountId: string;
                    deliverableId: string;
                    intentId: string;
                    platform: "telegram" | "x" | "facebook-page" | "instagram";
                    preview: string;
                    record: {
                      /** Format: date-time */
                      attemptedAt: string;
                      channelAccountId: string;
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      idempotencyKey: string;
                      intentId: string;
                      permalink: string | null;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      projectId: string;
                      providerId: string | null;
                      request: {
                        [key: string]: unknown;
                      };
                      state:
                        "attempting" | "published" | "failed" | "indeterminate";
                    } | null;
                    scheduledAt: string | null;
                    state: string;
                    timezone: string | null;
                  }[];
                }
              | {
                  data: {
                    /** Format: date-time */
                    end: string;
                    entries: {
                      accountName: string;
                      attachmentCount: number;
                      briefId: string;
                      briefTitle: string;
                      channelAccountId: string;
                      deliverableId: string;
                      intentId: string;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      preview: string;
                      record: {
                        /** Format: date-time */
                        attemptedAt: string;
                        channelAccountId: string;
                        completedAt: string | null;
                        error: string | null;
                        id: string;
                        idempotencyKey: string;
                        intentId: string;
                        permalink: string | null;
                        platform:
                          "telegram" | "x" | "facebook-page" | "instagram";
                        projectId: string;
                        providerId: string | null;
                        request: {
                          [key: string]: unknown;
                        };
                        state:
                          | "attempting"
                          | "published"
                          | "failed"
                          | "indeterminate";
                      } | null;
                      scheduledAt: string | null;
                      state: string;
                      timezone: string | null;
                    }[];
                    overdue: {
                      accountName: string;
                      attachmentCount: number;
                      briefId: string;
                      briefTitle: string;
                      channelAccountId: string;
                      deliverableId: string;
                      intentId: string;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      preview: string;
                      record: {
                        /** Format: date-time */
                        attemptedAt: string;
                        channelAccountId: string;
                        completedAt: string | null;
                        error: string | null;
                        id: string;
                        idempotencyKey: string;
                        intentId: string;
                        permalink: string | null;
                        platform:
                          "telegram" | "x" | "facebook-page" | "instagram";
                        projectId: string;
                        providerId: string | null;
                        request: {
                          [key: string]: unknown;
                        };
                        state:
                          | "attempting"
                          | "published"
                          | "failed"
                          | "indeterminate";
                      } | null;
                      scheduledAt: string | null;
                      state: string;
                      timezone: string | null;
                    }[];
                    projectId: string;
                    /** Format: date-time */
                    start: string;
                    unscheduled: {
                      accountName: string;
                      attachmentCount: number;
                      briefId: string;
                      briefTitle: string;
                      channelAccountId: string;
                      deliverableId: string;
                      intentId: string;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      preview: string;
                      record: {
                        /** Format: date-time */
                        attemptedAt: string;
                        channelAccountId: string;
                        completedAt: string | null;
                        error: string | null;
                        id: string;
                        idempotencyKey: string;
                        intentId: string;
                        permalink: string | null;
                        platform:
                          "telegram" | "x" | "facebook-page" | "instagram";
                        projectId: string;
                        providerId: string | null;
                        request: {
                          [key: string]: unknown;
                        };
                        state:
                          | "attempting"
                          | "published"
                          | "failed"
                          | "indeterminate";
                      } | null;
                      scheduledAt: string | null;
                      state: string;
                      timezone: string | null;
                    }[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/campaign-links/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The campaign link was removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign link was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            /** @description A printed code cannot follow an edit. A new destination is a new link. */
            destinationUrl?: unknown;
            label?: string;
            placement?:
              | "screen"
              | "print-handheld"
              | "print-poster"
              | "packaging"
              | "outdoor";
            printedWidthMm?: number | null;
            style?: {
              darkColor?: string;
              errorCorrection?: "L" | "M" | "Q" | "H";
              lightColor?: string;
              quietZone?: number;
              transparent?: boolean;
            };
            /** @description Re-tagging would disagree with any code already printed. Create a new link instead. */
            utm?: unknown;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  /** Format: uri */
                  destinationUrl: string;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  id: string;
                  label: string;
                  placement:
                    | "screen"
                    | "print-handheld"
                    | "print-poster"
                    | "packaging"
                    | "outdoor";
                  printedAt: string | null;
                  printedWidthMm: number | null;
                  projectId: string;
                  style: {
                    darkColor: string;
                    errorCorrection: "L" | "M" | "Q" | "H";
                    lightColor: string;
                    quietZone: number;
                    transparent: boolean;
                  };
                  taggedUrl: string;
                  /** Format: date-time */
                  updatedAt: string;
                  utm: {
                    campaign: string;
                    content: string | null;
                    medium: string;
                    source: string;
                    term: string | null;
                  };
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: uri */
                    destinationUrl: string;
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    id: string;
                    label: string;
                    placement:
                      | "screen"
                      | "print-handheld"
                      | "print-poster"
                      | "packaging"
                      | "outdoor";
                    printedAt: string | null;
                    printedWidthMm: number | null;
                    projectId: string;
                    style: {
                      darkColor: string;
                      errorCorrection: "L" | "M" | "Q" | "H";
                      lightColor: string;
                      quietZone: number;
                      transparent: boolean;
                    };
                    taggedUrl: string;
                    /** Format: date-time */
                    updatedAt: string;
                    utm: {
                      campaign: string;
                      content: string | null;
                      medium: string;
                      source: string;
                      term: string | null;
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign link was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/campaign-links/{id}/printed": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  /** Format: uri */
                  destinationUrl: string;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  id: string;
                  label: string;
                  placement:
                    | "screen"
                    | "print-handheld"
                    | "print-poster"
                    | "packaging"
                    | "outdoor";
                  printedAt: string | null;
                  printedWidthMm: number | null;
                  projectId: string;
                  style: {
                    darkColor: string;
                    errorCorrection: "L" | "M" | "Q" | "H";
                    lightColor: string;
                    quietZone: number;
                    transparent: boolean;
                  };
                  taggedUrl: string;
                  /** Format: date-time */
                  updatedAt: string;
                  utm: {
                    campaign: string;
                    content: string | null;
                    medium: string;
                    source: string;
                    term: string | null;
                  };
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: uri */
                    destinationUrl: string;
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    id: string;
                    label: string;
                    placement:
                      | "screen"
                      | "print-handheld"
                      | "print-poster"
                      | "packaging"
                      | "outdoor";
                    printedAt: string | null;
                    printedWidthMm: number | null;
                    projectId: string;
                    style: {
                      darkColor: string;
                      errorCorrection: "L" | "M" | "Q" | "H";
                      lightColor: string;
                      quietZone: number;
                      transparent: boolean;
                    };
                    taggedUrl: string;
                    /** Format: date-time */
                    updatedAt: string;
                    utm: {
                      campaign: string;
                      content: string | null;
                      medium: string;
                      source: string;
                      term: string | null;
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign link was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/campaign-links/{id}/qr": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          format?: "svg" | "png";
          scale?: number;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The QR code. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign link was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/campaigns": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          projectId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  audience: string | null;
                  constraints: string | null;
                  /** Format: date-time */
                  createdAt: string;
                  createdBy: string;
                  id: string;
                  keyMessage: string | null;
                  objective: string;
                  projectId: string;
                  status: "draft" | "in_review" | "archived";
                  title: string;
                  /** Format: date-time */
                  updatedAt: string;
                }[]
              | {
                  data: {
                    items: {
                      audience: string | null;
                      constraints: string | null;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      id: string;
                      keyMessage: string | null;
                      objective: string;
                      projectId: string;
                      status: "draft" | "in_review" | "archived";
                      title: string;
                      /** Format: date-time */
                      updatedAt: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            audience?: string | null;
            constraints?: string | null;
            keyMessage?: string | null;
            objective: string;
            projectId: string;
            title: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  audience: string | null;
                  constraints: string | null;
                  /** Format: date-time */
                  createdAt: string;
                  createdBy: string;
                  id: string;
                  keyMessage: string | null;
                  objective: string;
                  projectId: string;
                  status: "draft" | "in_review" | "archived";
                  title: string;
                  /** Format: date-time */
                  updatedAt: string;
                }
              | {
                  data: {
                    audience: string | null;
                    constraints: string | null;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    id: string;
                    keyMessage: string | null;
                    objective: string;
                    projectId: string;
                    status: "draft" | "in_review" | "archived";
                    title: string;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/campaigns/{briefId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          briefId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  brief: {
                    audience: string | null;
                    constraints: string | null;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    id: string;
                    keyMessage: string | null;
                    objective: string;
                    projectId: string;
                    status: "draft" | "in_review" | "archived";
                    title: string;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                  deliverables: {
                    body: string;
                    briefId: string;
                    callToAction: string | null;
                    channel:
                      | "facebook-ad"
                      | "instagram-ad"
                      | "instagram-post"
                      | "instagram-reel"
                      | "facebook-post"
                      | "seo-article"
                      | "social-post"
                      | "telegram-post"
                      | "x-post";
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    creativeNotes: string | null;
                    destinationUrl: string | null;
                    headline: string | null;
                    id: string;
                    /** Format: date-time */
                    updatedAt: string;
                  }[];
                  intents: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  }[];
                }
              | {
                  data: {
                    brief: {
                      audience: string | null;
                      constraints: string | null;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      id: string;
                      keyMessage: string | null;
                      objective: string;
                      projectId: string;
                      status: "draft" | "in_review" | "archived";
                      title: string;
                      /** Format: date-time */
                      updatedAt: string;
                    };
                    deliverables: {
                      body: string;
                      briefId: string;
                      callToAction: string | null;
                      channel:
                        | "facebook-ad"
                        | "instagram-ad"
                        | "instagram-post"
                        | "instagram-reel"
                        | "facebook-post"
                        | "seo-article"
                        | "social-post"
                        | "telegram-post"
                        | "x-post";
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      creativeNotes: string | null;
                      destinationUrl: string | null;
                      headline: string | null;
                      id: string;
                      /** Format: date-time */
                      updatedAt: string;
                    }[];
                    intents: {
                      approvedAt: string | null;
                      approvedBy: string | null;
                      approvedPayloadHash: string | null;
                      budget: {
                        currency: string | null;
                        dailyBudget: number | null;
                        lifetimeBudget: number | null;
                      };
                      channelAccountId: string;
                      deliverableId: string;
                      id: string;
                      idempotencyKey: string | null;
                      note: string | null;
                      payload: {
                        [key: string]: unknown;
                      };
                      payloadHash: string;
                      projectId: string;
                      scheduledAt: string | null;
                      /** Format: date-time */
                      stagedAt: string;
                      stagedBy: string;
                      state:
                        | "staged"
                        | "approved"
                        | "publishing"
                        | "published"
                        | "failed"
                        | "void"
                        | "withdrawn";
                      timezone: string | null;
                    }[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign brief was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/campaigns/{briefId}/deliverables": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          briefId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            body: string;
            callToAction?: string | null;
            channel:
              | "facebook-ad"
              | "instagram-ad"
              | "instagram-post"
              | "instagram-reel"
              | "facebook-post"
              | "seo-article"
              | "social-post"
              | "telegram-post"
              | "x-post";
            creativeNotes?: string | null;
            destinationUrl?: string | null;
            headline?: string | null;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  body: string;
                  briefId: string;
                  callToAction: string | null;
                  channel:
                    | "facebook-ad"
                    | "instagram-ad"
                    | "instagram-post"
                    | "instagram-reel"
                    | "facebook-post"
                    | "seo-article"
                    | "social-post"
                    | "telegram-post"
                    | "x-post";
                  /** Format: date-time */
                  createdAt: string;
                  createdBy: string;
                  creativeNotes: string | null;
                  destinationUrl: string | null;
                  headline: string | null;
                  id: string;
                  /** Format: date-time */
                  updatedAt: string;
                }
              | {
                  data: {
                    body: string;
                    briefId: string;
                    callToAction: string | null;
                    channel:
                      | "facebook-ad"
                      | "instagram-ad"
                      | "instagram-post"
                      | "instagram-reel"
                      | "facebook-post"
                      | "seo-article"
                      | "social-post"
                      | "telegram-post"
                      | "x-post";
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    creativeNotes: string | null;
                    destinationUrl: string | null;
                    headline: string | null;
                    id: string;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The campaign brief was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/capabilities": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** @enum {string} */
              apiVersion: "v1";
              /** @enum {string} */
              edition: "community";
              features: string[];
              hosted: {
                available: boolean;
                message: string;
                /** Format: uri */
                url: string;
              };
              limits: {
                audits: null;
                projects: null;
              };
              /** @enum {string} */
              telemetry: "disabled_by_default";
              version: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Capabilities could not be loaded. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/channels/accounts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          includeArchived?: boolean;
          kind?: "search" | "analytics" | "ads" | "social";
          projectId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  account: string;
                  archivedAt: string | null;
                  /** Format: date-time */
                  createdAt: string;
                  currency: string | null;
                  dailySpendCap: number | null;
                  displayName: string;
                  externalId: string;
                  id: string;
                  kind: "search" | "analytics" | "ads" | "social";
                  provider: string;
                  totalSpendCap: number | null;
                  workspaceId: string;
                }[]
              | {
                  data: {
                    items: {
                      account: string;
                      archivedAt: string | null;
                      /** Format: date-time */
                      createdAt: string;
                      currency: string | null;
                      dailySpendCap: number | null;
                      displayName: string;
                      externalId: string;
                      id: string;
                      kind: "search" | "analytics" | "ads" | "social";
                      provider: string;
                      totalSpendCap: number | null;
                      workspaceId: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            account?: string;
            currency?: string | null;
            dailySpendCap?: number | null;
            displayName: string;
            externalId: string;
            kind: "search" | "analytics" | "ads" | "social";
            projectId: string;
            provider: string;
            totalSpendCap?: number | null;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  account: string;
                  archivedAt: string | null;
                  /** Format: date-time */
                  createdAt: string;
                  currency: string | null;
                  dailySpendCap: number | null;
                  displayName: string;
                  externalId: string;
                  id: string;
                  kind: "search" | "analytics" | "ads" | "social";
                  provider: string;
                  totalSpendCap: number | null;
                  workspaceId: string;
                }
              | {
                  data: {
                    account: string;
                    archivedAt: string | null;
                    /** Format: date-time */
                    createdAt: string;
                    currency: string | null;
                    dailySpendCap: number | null;
                    displayName: string;
                    externalId: string;
                    id: string;
                    kind: "search" | "analytics" | "ads" | "social";
                    provider: string;
                    totalSpendCap: number | null;
                    workspaceId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider is not a registered connector. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/channels/accounts/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The cabinet and its recorded facts were removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The cabinet was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            archived?: boolean;
            dailySpendCap?: number | null;
            displayName?: string;
            totalSpendCap?: number | null;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  account: string;
                  archivedAt: string | null;
                  /** Format: date-time */
                  createdAt: string;
                  currency: string | null;
                  dailySpendCap: number | null;
                  displayName: string;
                  externalId: string;
                  id: string;
                  kind: "search" | "analytics" | "ads" | "social";
                  provider: string;
                  totalSpendCap: number | null;
                  workspaceId: string;
                }
              | {
                  data: {
                    account: string;
                    archivedAt: string | null;
                    /** Format: date-time */
                    createdAt: string;
                    currency: string | null;
                    dailySpendCap: number | null;
                    displayName: string;
                    externalId: string;
                    id: string;
                    kind: "search" | "analytics" | "ads" | "social";
                    provider: string;
                    totalSpendCap: number | null;
                    workspaceId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The cabinet was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/channels/accounts/{id}/performance": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          end?: string;
          start?: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  account: {
                    account: string;
                    archivedAt: string | null;
                    /** Format: date-time */
                    createdAt: string;
                    currency: string | null;
                    dailySpendCap: number | null;
                    displayName: string;
                    externalId: string;
                    id: string;
                    kind: "search" | "analytics" | "ads" | "social";
                    provider: string;
                    totalSpendCap: number | null;
                    workspaceId: string;
                  };
                  end: string;
                  lastSyncedAt: string | null;
                  start: string;
                  summaries: {
                    currency: string | null;
                    metricKey:
                      | "impressions"
                      | "clicks"
                      | "spend"
                      | "reach"
                      | "frequency"
                      | "conversions"
                      | "conversion_value"
                      | "cost_per_conversion"
                      | "ctr"
                      | "cpc"
                      | "cpm"
                      | "engagements"
                      | "video_plays"
                      | "link_clicks"
                      | "search_impression_share"
                      | "search_budget_lost_impression_share"
                      | "search_rank_lost_impression_share";
                    note: string | null;
                    observedDays: number;
                    platform:
                      | "all"
                      | "facebook"
                      | "instagram"
                      | "messenger"
                      | "audience_network"
                      | "google_search"
                      | "google_search_partners"
                      | "google_display"
                      | "google_youtube"
                      | "google_performance_max"
                      | "unknown";
                    requestedDays: number;
                    state: "available" | "partial" | "unavailable" | "failed";
                    value: number | null;
                  }[];
                }
              | {
                  data: {
                    account: {
                      account: string;
                      archivedAt: string | null;
                      /** Format: date-time */
                      createdAt: string;
                      currency: string | null;
                      dailySpendCap: number | null;
                      displayName: string;
                      externalId: string;
                      id: string;
                      kind: "search" | "analytics" | "ads" | "social";
                      provider: string;
                      totalSpendCap: number | null;
                      workspaceId: string;
                    };
                    end: string;
                    lastSyncedAt: string | null;
                    start: string;
                    summaries: {
                      currency: string | null;
                      metricKey:
                        | "impressions"
                        | "clicks"
                        | "spend"
                        | "reach"
                        | "frequency"
                        | "conversions"
                        | "conversion_value"
                        | "cost_per_conversion"
                        | "ctr"
                        | "cpc"
                        | "cpm"
                        | "engagements"
                        | "video_plays"
                        | "link_clicks"
                        | "search_impression_share"
                        | "search_budget_lost_impression_share"
                        | "search_rank_lost_impression_share";
                      note: string | null;
                      observedDays: number;
                      platform:
                        | "all"
                        | "facebook"
                        | "instagram"
                        | "messenger"
                        | "audience_network"
                        | "google_search"
                        | "google_search_partners"
                        | "google_display"
                        | "google_youtube"
                        | "google_performance_max"
                        | "unknown";
                      requestedDays: number;
                      state: "available" | "partial" | "unavailable" | "failed";
                      value: number | null;
                    }[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The cabinet was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/channels/accounts/{id}/search-terms": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          actionableOnly?: boolean;
          end?: string;
          limit?: number;
          start?: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  adGroupId: string;
                  adGroupName: string | null;
                  campaignId: string;
                  campaignName: string | null;
                  channelAccountId: string;
                  clicks: number | null;
                  conversions: number | null;
                  conversionValue: number | null;
                  cost: number | null;
                  currency: string | null;
                  /** Format: date-time */
                  fetchedAt: string;
                  impressions: number | null;
                  matchedKeyword: string | null;
                  matchType:
                    | "exact"
                    | "phrase"
                    | "broad"
                    | "near_exact"
                    | "near_phrase"
                    | "unknown";
                  query: string;
                  status:
                    | "added"
                    | "excluded"
                    | "added_excluded"
                    | "none"
                    | "unknown";
                  windowEnd: string;
                  windowStart: string;
                }[]
              | {
                  data: {
                    items: {
                      adGroupId: string;
                      adGroupName: string | null;
                      campaignId: string;
                      campaignName: string | null;
                      channelAccountId: string;
                      clicks: number | null;
                      conversions: number | null;
                      conversionValue: number | null;
                      cost: number | null;
                      currency: string | null;
                      /** Format: date-time */
                      fetchedAt: string;
                      impressions: number | null;
                      matchedKeyword: string | null;
                      matchType:
                        | "exact"
                        | "phrase"
                        | "broad"
                        | "near_exact"
                        | "near_phrase"
                        | "unknown";
                      query: string;
                      status:
                        | "added"
                        | "excluded"
                        | "added_excluded"
                        | "none"
                        | "unknown";
                      windowEnd: string;
                      windowStart: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The ad account was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/channels/discover": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          account?: string;
          projectId: string;
          provider?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  account: string;
                  currency: string | null;
                  displayName: string;
                  externalId: string;
                  kind: "search" | "analytics" | "ads" | "social";
                  linked: boolean;
                  provider: string;
                  status: string | null;
                }[]
              | {
                  data: {
                    items: {
                      account: string;
                      currency: string | null;
                      displayName: string;
                      externalId: string;
                      kind: "search" | "analytics" | "ads" | "social";
                      linked: boolean;
                      provider: string;
                      status: string | null;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider credential is missing or expired. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/competitors": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                contentGapTerms: {
                  referenceDensity: number | null;
                  referencesCovering: number;
                  targetDensity: number | null;
                  term: string;
                }[];
                items: {
                  cadenceDays: number | null;
                  contentGaps: number | null;
                  domain: string;
                  freshnessSeconds: number | null;
                  id: string;
                  keywordGaps: number | null;
                  lastUpdatedAt: string | null;
                  sharedKeywords: number | null;
                  technicalHealth: number | null;
                  technicalHealthChange: number | null;
                }[];
                total: number;
              };
              meta: {
                /** Format: date-time */
                generatedAt: string;
                state:
                  "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                warnings: string[];
              };
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/email-templates": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          projectId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  latestRevision: number;
                  name: string;
                  projectId: string;
                  purpose: string | null;
                  /** Format: date-time */
                  updatedAt: string;
                }[]
              | {
                  data: {
                    items: {
                      /** Format: date-time */
                      createdAt: string;
                      id: string;
                      latestRevision: number;
                      name: string;
                      projectId: string;
                      purpose: string | null;
                      /** Format: date-time */
                      updatedAt: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            name: string;
            projectId: string;
            purpose?: string | null;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  id: string;
                  latestRevision: number;
                  name: string;
                  projectId: string;
                  purpose: string | null;
                  /** Format: date-time */
                  updatedAt: string;
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    id: string;
                    latestRevision: number;
                    name: string;
                    projectId: string;
                    purpose: string | null;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/email-templates/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    brandRevision: number | null;
                    compiledHtml: string;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    plainText: string;
                    preheader: string;
                    report: {
                      counts: {
                        blocking: number;
                        error: number;
                        info: number;
                        warning: number;
                      };
                      findings: {
                        affects: string[];
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "error" | "warning" | "info";
                        where: string | null;
                      }[];
                      gmailClips: boolean;
                      ok: boolean;
                      sizeBytes: number;
                    };
                    revision: number;
                    sourceHtml: string;
                    subject: string;
                    templateId: string;
                  } | null;
                  history: {
                    brandRevision: number | null;
                    compiledHtml: string;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    plainText: string;
                    preheader: string;
                    report: {
                      counts: {
                        blocking: number;
                        error: number;
                        info: number;
                        warning: number;
                      };
                      findings: {
                        affects: string[];
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "error" | "warning" | "info";
                        where: string | null;
                      }[];
                      gmailClips: boolean;
                      ok: boolean;
                      sizeBytes: number;
                    };
                    revision: number;
                    sourceHtml: string;
                    subject: string;
                    templateId: string;
                  }[];
                  template: {
                    /** Format: date-time */
                    createdAt: string;
                    id: string;
                    latestRevision: number;
                    name: string;
                    projectId: string;
                    purpose: string | null;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                }
              | {
                  data: {
                    current: {
                      brandRevision: number | null;
                      compiledHtml: string;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      plainText: string;
                      preheader: string;
                      report: {
                        counts: {
                          blocking: number;
                          error: number;
                          info: number;
                          warning: number;
                        };
                        findings: {
                          affects: string[];
                          message: string;
                          remedy: string | null;
                          rule: string;
                          severity: "blocking" | "error" | "warning" | "info";
                          where: string | null;
                        }[];
                        gmailClips: boolean;
                        ok: boolean;
                        sizeBytes: number;
                      };
                      revision: number;
                      sourceHtml: string;
                      subject: string;
                      templateId: string;
                    } | null;
                    history: {
                      brandRevision: number | null;
                      compiledHtml: string;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      plainText: string;
                      preheader: string;
                      report: {
                        counts: {
                          blocking: number;
                          error: number;
                          info: number;
                          warning: number;
                        };
                        findings: {
                          affects: string[];
                          message: string;
                          remedy: string | null;
                          rule: string;
                          severity: "blocking" | "error" | "warning" | "info";
                          where: string | null;
                        }[];
                        gmailClips: boolean;
                        ok: boolean;
                        sizeBytes: number;
                      };
                      revision: number;
                      sourceHtml: string;
                      subject: string;
                      templateId: string;
                    }[];
                    template: {
                      /** Format: date-time */
                      createdAt: string;
                      id: string;
                      latestRevision: number;
                      name: string;
                      projectId: string;
                      purpose: string | null;
                      /** Format: date-time */
                      updatedAt: string;
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The template was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The template and its revisions were removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The template was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/email-templates/{id}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            html: string;
            preheader?: string;
            subject: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    brandRevision: number | null;
                    compiledHtml: string;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    plainText: string;
                    preheader: string;
                    report: {
                      counts: {
                        blocking: number;
                        error: number;
                        info: number;
                        warning: number;
                      };
                      findings: {
                        affects: string[];
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "error" | "warning" | "info";
                        where: string | null;
                      }[];
                      gmailClips: boolean;
                      ok: boolean;
                      sizeBytes: number;
                    };
                    revision: number;
                    sourceHtml: string;
                    subject: string;
                    templateId: string;
                  } | null;
                  history: {
                    brandRevision: number | null;
                    compiledHtml: string;
                    /** Format: date-time */
                    createdAt: string;
                    createdBy: string;
                    plainText: string;
                    preheader: string;
                    report: {
                      counts: {
                        blocking: number;
                        error: number;
                        info: number;
                        warning: number;
                      };
                      findings: {
                        affects: string[];
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "error" | "warning" | "info";
                        where: string | null;
                      }[];
                      gmailClips: boolean;
                      ok: boolean;
                      sizeBytes: number;
                    };
                    revision: number;
                    sourceHtml: string;
                    subject: string;
                    templateId: string;
                  }[];
                  template: {
                    /** Format: date-time */
                    createdAt: string;
                    id: string;
                    latestRevision: number;
                    name: string;
                    projectId: string;
                    purpose: string | null;
                    /** Format: date-time */
                    updatedAt: string;
                  };
                }
              | {
                  data: {
                    current: {
                      brandRevision: number | null;
                      compiledHtml: string;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      plainText: string;
                      preheader: string;
                      report: {
                        counts: {
                          blocking: number;
                          error: number;
                          info: number;
                          warning: number;
                        };
                        findings: {
                          affects: string[];
                          message: string;
                          remedy: string | null;
                          rule: string;
                          severity: "blocking" | "error" | "warning" | "info";
                          where: string | null;
                        }[];
                        gmailClips: boolean;
                        ok: boolean;
                        sizeBytes: number;
                      };
                      revision: number;
                      sourceHtml: string;
                      subject: string;
                      templateId: string;
                    } | null;
                    history: {
                      brandRevision: number | null;
                      compiledHtml: string;
                      /** Format: date-time */
                      createdAt: string;
                      createdBy: string;
                      plainText: string;
                      preheader: string;
                      report: {
                        counts: {
                          blocking: number;
                          error: number;
                          info: number;
                          warning: number;
                        };
                        findings: {
                          affects: string[];
                          message: string;
                          remedy: string | null;
                          rule: string;
                          severity: "blocking" | "error" | "warning" | "info";
                          where: string | null;
                        }[];
                        gmailClips: boolean;
                        ok: boolean;
                        sizeBytes: number;
                      };
                      revision: number;
                      sourceHtml: string;
                      subject: string;
                      templateId: string;
                    }[];
                    template: {
                      /** Format: date-time */
                      createdAt: string;
                      id: string;
                      latestRevision: number;
                      name: string;
                      projectId: string;
                      purpose: string | null;
                      /** Format: date-time */
                      updatedAt: string;
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The template was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/export": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            projectId: string;
          };
        };
      };
      responses: {
        /** @description A portable Marketingovo project bundle. Credentials and secret references are never included. */
        200: {
          headers: {
            /** @description Attachment filename for the project bundle. */
            "content-disposition"?: unknown;
            [name: string]: unknown;
          };
          content: {
            "application/vnd.marketingovo.project+json": string;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project bundle exceeds the local limit. */
        413: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/extraction-rule-templates": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** @enum {string} */
                  importMode: "review_required";
                  templates: {
                    assumptions: string[];
                    category: "social" | "editorial" | "commerce" | "migration";
                    description: string;
                    id: string;
                    name: string;
                    recommendedPage: string;
                    rules: {
                      attribute: string | null;
                      enabled: boolean;
                      id: string;
                      label: string;
                      regex: string | null;
                      selector: string;
                      type: "text" | "html" | "attribute";
                    }[];
                  }[];
                  /** @enum {string} */
                  version: "extraction-template-catalog-v1";
                }
              | {
                  data: {
                    /** @enum {string} */
                    importMode: "review_required";
                    templates: {
                      assumptions: string[];
                      category:
                        "social" | "editorial" | "commerce" | "migration";
                      description: string;
                      id: string;
                      name: string;
                      recommendedPage: string;
                      rules: {
                        attribute: string | null;
                        enabled: boolean;
                        id: string;
                        label: string;
                        regex: string | null;
                        selector: string;
                        type: "text" | "html" | "attribute";
                      }[];
                    }[];
                    /** @enum {string} */
                    version: "extraction-template-catalog-v1";
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              database: string;
              queue: string;
              status: "ok" | "degraded";
              version: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local health check could not be completed. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/import": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            actions: {
              affectedUrls: string[];
              confidence: number;
              /** Format: date-time */
              createdAt: string;
              effort: "low" | "medium" | "high";
              id: string;
              impact: number;
              issueFingerprint?: string;
              moduleId?: string;
              owner: string | null;
              priorityScore: number;
              projectId: string;
              ruleId?: string;
              scoreInputs: {
                confidence: number;
                conversionExposure: number | null;
                organicExposure: number | null;
                severity: number;
                unavailable: string[];
                urlReach: number;
              };
              /** @enum {string} */
              scoreVersion: "priority-v1";
              status: "open" | "acknowledged" | "in_progress" | "resolved";
              title: string;
              /** Format: date-time */
              updatedAt: string;
              verification: "pending" | "verified" | "regressed";
              whyNow: string;
            }[];
            artifacts: (
              | {
                  contentBase64: string;
                  /** @enum {boolean} */
                  contentIncluded: true;
                  id: string;
                  kind:
                    | "report.json"
                    | "report.html"
                    | "report.csv"
                    | "report.pdf"
                    | "run-evidence.json";
                  mediaType: string;
                  runId: string;
                  sha256: string;
                  sizeBytes: number;
                }
              | {
                  /** @enum {boolean} */
                  contentIncluded: false;
                  id: string;
                  kind:
                    | "report.json"
                    | "report.html"
                    | "report.csv"
                    | "report.pdf"
                    | "run-evidence.json";
                  mediaType: string;
                  omittedReason:
                    "size_limit" | "missing" | "unsafe" | "checksum_mismatch";
                  runId: string;
                  sha256: string | null;
                  sizeBytes: number;
                }
            )[];
            connectors: {
              configuration: {
                [key: string]: unknown;
              };
              provider: string;
            }[];
            customRules: {
              category: string;
              expect?: "present" | "absent";
              fix?: string;
              id: string;
              match: "contains" | "regex" | "css-exists";
              name: string;
              pattern?: string;
              priority: "High" | "Medium" | "Low";
              selector?: string;
              value?: string;
            }[];
            /** Format: date-time */
            exportedAt: string;
            extractionRuleVersions?: {
              actor: string;
              changeSummary: string;
              configurationHash: string;
              /** Format: date-time */
              createdAt: string;
              projectId: string;
              revision: number;
              rules: {
                attribute: string | null;
                enabled: boolean;
                id: string;
                label: string;
                regex: string | null;
                selector: string;
                type: "text" | "html" | "attribute";
              }[];
            }[];
            /** @enum {string} */
            format: "marketingovo-project";
            integrity: {
              /** @enum {string} */
              algorithm: "sha256";
              bundleSha256: string;
              embeddedArtifactBytes: number;
            };
            issueAdjudications?: {
              actor: string;
              /** Format: date-time */
              createdAt: string;
              fingerprint: string;
              note: string | null;
              projectId: string;
              status: "ignored" | "false_positive";
              /** Format: date-time */
              updatedAt: string;
            }[];
            issues: {
              issue: {
                canonicalUrl: string | null;
                description: string;
                evidence: {
                  kind: string;
                  label: string;
                  /** Format: date-time */
                  observedAt?: string;
                  source?: string;
                  value?: unknown;
                }[];
                fingerprint: string;
                /** Format: date-time */
                firstSeenAt: string;
                /** Format: date-time */
                lastSeenAt: string;
                moduleId: string;
                ruleId: string;
                severity: "critical" | "high" | "medium" | "low" | "info";
                status: "open" | "resolved" | "ignored" | "false_positive";
                title: string;
              };
              runId: string;
            }[];
            metrics: {
              key: string;
              metric: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              runId: string | null;
            }[];
            pages: {
              /** Format: uri */
              canonicalUrl: string;
              indexable: boolean | null;
              payload: {
                [key: string]: unknown;
              };
              runId: string;
              statusCode: number | null;
              title: string | null;
            }[];
            project: {
              canonicalUrl: string | null;
              /** Format: date-time */
              createdAt: string;
              id: string;
              name: string;
              /** Format: date-time */
              updatedAt: string;
            };
            projectContext?: {
              journal: {
                actor: string;
                /** Format: date-time */
                createdAt: string;
                detail: string;
                id: string;
                kind: "observation" | "decision" | "constraint" | "experiment";
                projectId: string;
                sequence: number;
                sourceRunId: string | null;
                title: string;
              }[];
              versions: {
                actor: string;
                changeSummary: string;
                /** Format: date-time */
                createdAt: string;
                profile: {
                  audiences: string[];
                  brandProfiles: {
                    label: string;
                    /** Format: uri */
                    url: string;
                  }[];
                  competitors: string[];
                  constraints: string[];
                  conversionGoals: string[];
                  languages: string[];
                  markets: string[];
                  priorityTopics: string[];
                  summary: string | null;
                };
                projectId: string;
                revision: number;
              }[];
            };
            runConfigurations?: {
              options: {
                [key: string]: unknown;
              };
              runId: string;
            }[];
            runModules: {
              completedAt: string | null;
              coverage: number | null;
              durationMs: number | null;
              error: string | null;
              moduleId: string;
              runId: string;
              startedAt: string | null;
              status:
                | "queued"
                | "running"
                | "succeeded"
                | "skipped"
                | "failed"
                | "cancelled";
              version: string;
            }[];
            runs: {
              completedAt: string | null;
              error: string | null;
              id: string;
              issueCount: number;
              progress: number;
              projectId: string;
              /** Format: date-time */
              requestedAt: string;
              startedAt: string | null;
              status:
                | "queued"
                | "running"
                | "succeeded"
                | "partial"
                | "failed"
                | "cancelled";
              workflowId: string;
            }[];
            schedules: {
              /** Format: date-time */
              createdAt: string;
              cron: string;
              enabled: boolean;
              id: string;
              /** Format: date-time */
              nextRunAt: string;
              options?: {
                [key: string]: unknown;
              };
              projectId: string;
              timezone: string;
              /** Format: date-time */
              updatedAt: string;
              workflowId?: string;
            }[];
            /** @enum {boolean} */
            secretsIncluded: false;
            settings: {
              alertEmail: string | null;
              dataRetentionDays: number | null;
              reportingCurrency: string | null;
              timezone: string | null;
              /** Format: date-time */
              updatedAt: string;
              weeklyDigest: boolean;
            } | null;
            /** @enum {number} */
            version: 2;
          };
          "application/vnd.marketingovo.project+json": {
            actions: {
              affectedUrls: string[];
              confidence: number;
              /** Format: date-time */
              createdAt: string;
              effort: "low" | "medium" | "high";
              id: string;
              impact: number;
              issueFingerprint?: string;
              moduleId?: string;
              owner: string | null;
              priorityScore: number;
              projectId: string;
              ruleId?: string;
              scoreInputs: {
                confidence: number;
                conversionExposure: number | null;
                organicExposure: number | null;
                severity: number;
                unavailable: string[];
                urlReach: number;
              };
              /** @enum {string} */
              scoreVersion: "priority-v1";
              status: "open" | "acknowledged" | "in_progress" | "resolved";
              title: string;
              /** Format: date-time */
              updatedAt: string;
              verification: "pending" | "verified" | "regressed";
              whyNow: string;
            }[];
            artifacts: (
              | {
                  contentBase64: string;
                  /** @enum {boolean} */
                  contentIncluded: true;
                  id: string;
                  kind:
                    | "report.json"
                    | "report.html"
                    | "report.csv"
                    | "report.pdf"
                    | "run-evidence.json";
                  mediaType: string;
                  runId: string;
                  sha256: string;
                  sizeBytes: number;
                }
              | {
                  /** @enum {boolean} */
                  contentIncluded: false;
                  id: string;
                  kind:
                    | "report.json"
                    | "report.html"
                    | "report.csv"
                    | "report.pdf"
                    | "run-evidence.json";
                  mediaType: string;
                  omittedReason:
                    "size_limit" | "missing" | "unsafe" | "checksum_mismatch";
                  runId: string;
                  sha256: string | null;
                  sizeBytes: number;
                }
            )[];
            connectors: {
              configuration: {
                [key: string]: unknown;
              };
              provider: string;
            }[];
            customRules: {
              category: string;
              expect?: "present" | "absent";
              fix?: string;
              id: string;
              match: "contains" | "regex" | "css-exists";
              name: string;
              pattern?: string;
              priority: "High" | "Medium" | "Low";
              selector?: string;
              value?: string;
            }[];
            /** Format: date-time */
            exportedAt: string;
            extractionRuleVersions?: {
              actor: string;
              changeSummary: string;
              configurationHash: string;
              /** Format: date-time */
              createdAt: string;
              projectId: string;
              revision: number;
              rules: {
                attribute: string | null;
                enabled: boolean;
                id: string;
                label: string;
                regex: string | null;
                selector: string;
                type: "text" | "html" | "attribute";
              }[];
            }[];
            /** @enum {string} */
            format: "marketingovo-project";
            integrity: {
              /** @enum {string} */
              algorithm: "sha256";
              bundleSha256: string;
              embeddedArtifactBytes: number;
            };
            issueAdjudications?: {
              actor: string;
              /** Format: date-time */
              createdAt: string;
              fingerprint: string;
              note: string | null;
              projectId: string;
              status: "ignored" | "false_positive";
              /** Format: date-time */
              updatedAt: string;
            }[];
            issues: {
              issue: {
                canonicalUrl: string | null;
                description: string;
                evidence: {
                  kind: string;
                  label: string;
                  /** Format: date-time */
                  observedAt?: string;
                  source?: string;
                  value?: unknown;
                }[];
                fingerprint: string;
                /** Format: date-time */
                firstSeenAt: string;
                /** Format: date-time */
                lastSeenAt: string;
                moduleId: string;
                ruleId: string;
                severity: "critical" | "high" | "medium" | "low" | "info";
                status: "open" | "resolved" | "ignored" | "false_positive";
                title: string;
              };
              runId: string;
            }[];
            metrics: {
              key: string;
              metric: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              runId: string | null;
            }[];
            pages: {
              /** Format: uri */
              canonicalUrl: string;
              indexable: boolean | null;
              payload: {
                [key: string]: unknown;
              };
              runId: string;
              statusCode: number | null;
              title: string | null;
            }[];
            project: {
              canonicalUrl: string | null;
              /** Format: date-time */
              createdAt: string;
              id: string;
              name: string;
              /** Format: date-time */
              updatedAt: string;
            };
            projectContext?: {
              journal: {
                actor: string;
                /** Format: date-time */
                createdAt: string;
                detail: string;
                id: string;
                kind: "observation" | "decision" | "constraint" | "experiment";
                projectId: string;
                sequence: number;
                sourceRunId: string | null;
                title: string;
              }[];
              versions: {
                actor: string;
                changeSummary: string;
                /** Format: date-time */
                createdAt: string;
                profile: {
                  audiences: string[];
                  brandProfiles: {
                    label: string;
                    /** Format: uri */
                    url: string;
                  }[];
                  competitors: string[];
                  constraints: string[];
                  conversionGoals: string[];
                  languages: string[];
                  markets: string[];
                  priorityTopics: string[];
                  summary: string | null;
                };
                projectId: string;
                revision: number;
              }[];
            };
            runConfigurations?: {
              options: {
                [key: string]: unknown;
              };
              runId: string;
            }[];
            runModules: {
              completedAt: string | null;
              coverage: number | null;
              durationMs: number | null;
              error: string | null;
              moduleId: string;
              runId: string;
              startedAt: string | null;
              status:
                | "queued"
                | "running"
                | "succeeded"
                | "skipped"
                | "failed"
                | "cancelled";
              version: string;
            }[];
            runs: {
              completedAt: string | null;
              error: string | null;
              id: string;
              issueCount: number;
              progress: number;
              projectId: string;
              /** Format: date-time */
              requestedAt: string;
              startedAt: string | null;
              status:
                | "queued"
                | "running"
                | "succeeded"
                | "partial"
                | "failed"
                | "cancelled";
              workflowId: string;
            }[];
            schedules: {
              /** Format: date-time */
              createdAt: string;
              cron: string;
              enabled: boolean;
              id: string;
              /** Format: date-time */
              nextRunAt: string;
              options?: {
                [key: string]: unknown;
              };
              projectId: string;
              timezone: string;
              /** Format: date-time */
              updatedAt: string;
              workflowId?: string;
            }[];
            /** @enum {boolean} */
            secretsIncluded: false;
            settings: {
              alertEmail: string | null;
              dataRetentionDays: number | null;
              reportingCurrency: string | null;
              timezone: string | null;
              /** Format: date-time */
              updatedAt: string;
              weeklyDigest: boolean;
            } | null;
            /** @enum {number} */
            version: 2;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              counts: {
                actions: number;
                artifacts: number;
                connectors: number;
                contextEntries: number;
                contextVersions: number;
                customRules: number;
                extractionRuleVersions: number;
                issueAdjudications: number;
                issues: number;
                metrics: number;
                pages: number;
                runModules: number;
                runs: number;
                schedules: number;
              };
              /** Format: date-time */
              importedAt: string;
              project: {
                canonicalUrl: string | null;
                /** Format: date-time */
                createdAt: string;
                id: string;
                name: string;
                /** Format: date-time */
                updatedAt: string;
              };
              reconnectProviders: string[];
              /** @enum {boolean} */
              schedulesDisabled: true;
              sourceProjectId: string;
              warnings: string[];
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The bundle conflicts with local state. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project bundle exceeds the local limit. */
        413: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project bundle media type is unsupported. */
        415: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          projectId?: string;
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configuration?: {
                    [key: string]: string | number | boolean | null;
                  };
                  expiresAt: string | null;
                  label: string;
                  lastSyncAt: string | null;
                  maskedIdentifier: string | null;
                  nextSyncAt: string | null;
                  provider: string;
                  quota: {
                    limit: number | null;
                    remaining: number;
                    resetsAt: string | null;
                  } | null;
                  scopes: string[];
                  status:
                    | "connected"
                    | "degraded"
                    | "expired"
                    | "rate_limited"
                    | "failed"
                    | "not_configured";
                }[]
              | {
                  data: {
                    items: {
                      accountLabel: string | null;
                      /** @enum {string} */
                      category: "Data source";
                      configuration: {
                        [key: string]: string | number | boolean | null;
                      };
                      configurationFields: {
                        help: string;
                        key: string;
                        label: string;
                        placeholder: string;
                        required: boolean;
                      }[];
                      credentialFields: {
                        key: string;
                        label: string;
                        required: boolean;
                        type: "text" | "secret";
                      }[];
                      description: string | null;
                      expiresAt: string | null;
                      id: string;
                      lastError: string | null;
                      lastSyncAt: string | null;
                      name: string;
                      permissions: string[];
                      quota: {
                        limit: number | null;
                        remaining: number;
                        resetsAt: string | null;
                      } | null;
                      setupUrl: string | null;
                      status:
                        | "connected"
                        | "degraded"
                        | "expired"
                        | "rate_limited"
                        | "failed"
                        | "not_configured";
                      supportsApiKey: boolean;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations/{provider}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The local credential was revoked and removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The integration was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations/{provider}/auth/callback": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          code?: string;
          error?: string;
          error_description?: string;
          state?: string;
        };
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The fixed callback is not active; desktop OAuth uses a one-time random loopback callback. */
        410: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations/{provider}/auth/start": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Redirect to the provider authorization page. */
        302: {
          headers: {
            /** @description Provider authorization URL. */
            location?: unknown;
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Too many OAuth transactions are active. */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description OAuth is not configured or unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            account?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** Format: uri */
              authorizationUrl: string;
              /** Format: date-time */
              expiresAt: string;
              provider: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Too many OAuth transactions are active. */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description OAuth is not configured or unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations/{provider}/configuration": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            configuration: {
              [key: string]: string | number | boolean | null;
            };
            projectId?: string;
            siteId?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configuration?: {
                    [key: string]: string | number | boolean | null;
                  };
                  expiresAt: string | null;
                  label: string;
                  lastSyncAt: string | null;
                  maskedIdentifier: string | null;
                  nextSyncAt: string | null;
                  provider: string;
                  quota: {
                    limit: number | null;
                    remaining: number;
                    resetsAt: string | null;
                  } | null;
                  scopes: string[];
                  status:
                    | "connected"
                    | "degraded"
                    | "expired"
                    | "rate_limited"
                    | "failed"
                    | "not_configured";
                }
              | {
                  data: {
                    accountLabel: string | null;
                    /** @enum {string} */
                    category: "Data source";
                    configuration: {
                      [key: string]: string | number | boolean | null;
                    };
                    configurationFields: {
                      help: string;
                      key: string;
                      label: string;
                      placeholder: string;
                      required: boolean;
                    }[];
                    credentialFields: {
                      key: string;
                      label: string;
                      required: boolean;
                      type: "text" | "secret";
                    }[];
                    description: string | null;
                    expiresAt: string | null;
                    id: string;
                    lastError: string | null;
                    lastSyncAt: string | null;
                    name: string;
                    permissions: string[];
                    quota: {
                      limit: number | null;
                      remaining: number;
                      resetsAt: string | null;
                    } | null;
                    setupUrl: string | null;
                    status:
                      | "connected"
                      | "degraded"
                      | "expired"
                      | "rate_limited"
                      | "failed"
                      | "not_configured";
                    supportsApiKey: boolean;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The integration or project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/integrations/{provider}/credentials": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            account?: string;
            /** @description Write-only connector credential fields. Values are stored in the local vault and never returned. */
            credentials: {
              [key: string]: string;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configuration?: {
                    [key: string]: string | number | boolean | null;
                  };
                  expiresAt: string | null;
                  label: string;
                  lastSyncAt: string | null;
                  maskedIdentifier: string | null;
                  nextSyncAt: string | null;
                  provider: string;
                  quota: {
                    limit: number | null;
                    remaining: number;
                    resetsAt: string | null;
                  } | null;
                  scopes: string[];
                  status:
                    | "connected"
                    | "degraded"
                    | "expired"
                    | "rate_limited"
                    | "failed"
                    | "not_configured";
                }
              | {
                  data: {
                    accountLabel: string | null;
                    /** @enum {string} */
                    category: "Data source";
                    configuration: {
                      [key: string]: string | number | boolean | null;
                    };
                    configurationFields: {
                      help: string;
                      key: string;
                      label: string;
                      placeholder: string;
                      required: boolean;
                    }[];
                    credentialFields: {
                      key: string;
                      label: string;
                      required: boolean;
                      type: "text" | "secret";
                    }[];
                    description: string | null;
                    expiresAt: string | null;
                    id: string;
                    lastError: string | null;
                    lastSyncAt: string | null;
                    name: string;
                    permissions: string[];
                    quota: {
                      limit: number | null;
                      remaining: number;
                      resetsAt: string | null;
                    } | null;
                    setupUrl: string | null;
                    status:
                      | "connected"
                      | "degraded"
                      | "expired"
                      | "rate_limited"
                      | "failed"
                      | "not_configured";
                    supportsApiKey: boolean;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The integration was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description This provider requires OAuth. */
        405: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/integrations/{provider}/test": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          provider: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            projectId?: string;
            siteId?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configuration?: {
                    [key: string]: string | number | boolean | null;
                  };
                  expiresAt: string | null;
                  label: string;
                  lastSyncAt: string | null;
                  maskedIdentifier: string | null;
                  nextSyncAt: string | null;
                  provider: string;
                  quota: {
                    limit: number | null;
                    remaining: number;
                    resetsAt: string | null;
                  } | null;
                  scopes: string[];
                  status:
                    | "connected"
                    | "degraded"
                    | "expired"
                    | "rate_limited"
                    | "failed"
                    | "not_configured";
                }
              | {
                  data: {
                    accountLabel: string | null;
                    /** @enum {string} */
                    category: "Data source";
                    configuration: {
                      [key: string]: string | number | boolean | null;
                    };
                    configurationFields: {
                      help: string;
                      key: string;
                      label: string;
                      placeholder: string;
                      required: boolean;
                    }[];
                    credentialFields: {
                      key: string;
                      label: string;
                      required: boolean;
                      type: "text" | "secret";
                    }[];
                    description: string | null;
                    expiresAt: string | null;
                    id: string;
                    lastError: string | null;
                    lastSyncAt: string | null;
                    name: string;
                    permissions: string[];
                    quota: {
                      limit: number | null;
                      remaining: number;
                      resetsAt: string | null;
                    } | null;
                    setupUrl: string | null;
                    status:
                      | "connected"
                      | "degraded"
                      | "expired"
                      | "rate_limited"
                      | "failed"
                      | "not_configured";
                    supportsApiKey: boolean;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The integration or project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider rate limit is active. */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider returned an invalid response. */
        502: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The provider is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/issues": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          limit?: number;
          offset?: number;
          projectId?: string;
          search?: string;
          severity?: "critical" | "high" | "medium" | "low" | "info";
          siteId?: string;
          status?: "open" | "resolved" | "ignored" | "false_positive";
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  items: {
                    adjudication: {
                      actor: string;
                      /** Format: date-time */
                      createdAt: string;
                      fingerprint: string;
                      note: string | null;
                      projectId: string;
                      status: "ignored" | "false_positive";
                      /** Format: date-time */
                      updatedAt: string;
                    } | null;
                    issue: {
                      canonicalUrl: string | null;
                      description: string;
                      evidence: {
                        kind: string;
                        label: string;
                        /** Format: date-time */
                        observedAt?: string;
                        source?: string;
                        value?: unknown;
                      }[];
                      fingerprint: string;
                      /** Format: date-time */
                      firstSeenAt: string;
                      /** Format: date-time */
                      lastSeenAt: string;
                      moduleId: string;
                      ruleId: string;
                      severity: "critical" | "high" | "medium" | "low" | "info";
                      status:
                        "open" | "resolved" | "ignored" | "false_positive";
                      title: string;
                    };
                    latestRunId: string;
                    occurrenceCount: number;
                  }[];
                  limit: number;
                  offset: number;
                  total: number;
                }
              | {
                  data: {
                    items: {
                      adjudication: {
                        actor: string;
                        /** Format: date-time */
                        createdAt: string;
                        fingerprint: string;
                        note: string | null;
                        projectId: string;
                        status: "ignored" | "false_positive";
                        /** Format: date-time */
                        updatedAt: string;
                      } | null;
                      issue: {
                        canonicalUrl: string | null;
                        description: string;
                        evidence: {
                          kind: string;
                          label: string;
                          /** Format: date-time */
                          observedAt?: string;
                          source?: string;
                          value?: unknown;
                        }[];
                        fingerprint: string;
                        /** Format: date-time */
                        firstSeenAt: string;
                        /** Format: date-time */
                        lastSeenAt: string;
                        moduleId: string;
                        ruleId: string;
                        severity:
                          "critical" | "high" | "medium" | "low" | "info";
                        status:
                          "open" | "resolved" | "ignored" | "false_positive";
                        title: string;
                      };
                      latestRunId: string;
                      occurrenceCount: number;
                    }[];
                    limit: number;
                    offset: number;
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/issues/{fingerprint}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          fingerprint: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            note?: string | null;
            projectId: string;
            status: "open" | "ignored" | "false_positive";
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  adjudication: {
                    actor: string;
                    /** Format: date-time */
                    createdAt: string;
                    fingerprint: string;
                    note: string | null;
                    projectId: string;
                    status: "ignored" | "false_positive";
                    /** Format: date-time */
                    updatedAt: string;
                  } | null;
                  issue: {
                    canonicalUrl: string | null;
                    description: string;
                    evidence: {
                      kind: string;
                      label: string;
                      /** Format: date-time */
                      observedAt?: string;
                      source?: string;
                      value?: unknown;
                    }[];
                    fingerprint: string;
                    /** Format: date-time */
                    firstSeenAt: string;
                    /** Format: date-time */
                    lastSeenAt: string;
                    moduleId: string;
                    ruleId: string;
                    severity: "critical" | "high" | "medium" | "low" | "info";
                    status: "open" | "resolved" | "ignored" | "false_positive";
                    title: string;
                  };
                  latestRunId: string;
                  occurrenceCount: number;
                }
              | {
                  data: {
                    adjudication: {
                      actor: string;
                      /** Format: date-time */
                      createdAt: string;
                      fingerprint: string;
                      note: string | null;
                      projectId: string;
                      status: "ignored" | "false_positive";
                      /** Format: date-time */
                      updatedAt: string;
                    } | null;
                    issue: {
                      canonicalUrl: string | null;
                      description: string;
                      evidence: {
                        kind: string;
                        label: string;
                        /** Format: date-time */
                        observedAt?: string;
                        source?: string;
                        value?: unknown;
                      }[];
                      fingerprint: string;
                      /** Format: date-time */
                      firstSeenAt: string;
                      /** Format: date-time */
                      lastSeenAt: string;
                      moduleId: string;
                      ruleId: string;
                      severity: "critical" | "high" | "medium" | "low" | "info";
                      status:
                        "open" | "resolved" | "ignored" | "false_positive";
                      title: string;
                    };
                    latestRunId: string;
                    occurrenceCount: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project or issue was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description A safe review reason is required for ignored and false-positive issues. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/keywords": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                clusters: {
                  contentCoverage: number | null;
                  id: string;
                  keywords: number;
                  name: string;
                  recommendedBrief: string;
                }[];
                opportunities: {
                  clicks: number | null;
                  cluster: string | null;
                  difficulty: number | null;
                  id: string;
                  impressions: number | null;
                  intent: string;
                  keyword: string;
                  opportunityScore: number | null;
                  position: number | null;
                  targetUrl: string | null;
                  volume: number | null;
                }[];
                providerUsage: {
                  actualCostUsd: number;
                  billableRequests: number;
                  freeRequests: number;
                  unreportedBillableRequests: number;
                } | null;
              };
              meta: {
                /** Format: date-time */
                generatedAt: string;
                state:
                  "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                warnings: string[];
              };
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/marketing-reports": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          projectId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  generatedAt: string;
                  id: string;
                  periodEnd: string;
                  periodStart: string;
                  projectId: string;
                  state: "available" | "partial" | "unavailable" | "failed";
                  title: string;
                }[]
              | {
                  data: {
                    items: {
                      /** Format: date-time */
                      generatedAt: string;
                      id: string;
                      periodEnd: string;
                      periodStart: string;
                      projectId: string;
                      state: "available" | "partial" | "unavailable" | "failed";
                      title: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            compare?: boolean;
            end?: string;
            narrative?: string | null;
            projectId: string;
            start?: string;
            timezone?: string;
            title?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  brandRevision: number | null;
                  coverageGaps: {
                    reason: string;
                    remedy: string | null;
                    source: string;
                  }[];
                  /** Format: date-time */
                  generatedAt: string;
                  id: string;
                  narrative: string | null;
                  period: {
                    comparisonEnd: string | null;
                    comparisonStart: string | null;
                    end: string;
                    start: string;
                    timezone: string;
                  };
                  projectId: string;
                  sections: {
                    breakdown: {
                      label: string;
                      metrics: {
                        change: number | null;
                        currency: string | null;
                        key: string;
                        label: string;
                        note: string | null;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                        unit: string;
                        value: number | null;
                      }[];
                    }[];
                    id: "paid" | "organic" | "social" | "email" | "actions";
                    metrics: {
                      change: number | null;
                      currency: string | null;
                      key: string;
                      label: string;
                      note: string | null;
                      state: "available" | "partial" | "unavailable" | "failed";
                      unit: string;
                      value: number | null;
                    }[];
                    refusals: {
                      expected: string;
                      explanation: string;
                    }[];
                    sources: {
                      id: string;
                      label: string;
                      observedAt: string | null;
                      reason: string;
                      state: "available" | "partial" | "unavailable" | "failed";
                    }[];
                    state: "available" | "partial" | "unavailable" | "failed";
                    summary: string;
                    title: string;
                  }[];
                  title: string;
                }
              | {
                  data: {
                    brandRevision: number | null;
                    coverageGaps: {
                      reason: string;
                      remedy: string | null;
                      source: string;
                    }[];
                    /** Format: date-time */
                    generatedAt: string;
                    id: string;
                    narrative: string | null;
                    period: {
                      comparisonEnd: string | null;
                      comparisonStart: string | null;
                      end: string;
                      start: string;
                      timezone: string;
                    };
                    projectId: string;
                    sections: {
                      breakdown: {
                        label: string;
                        metrics: {
                          change: number | null;
                          currency: string | null;
                          key: string;
                          label: string;
                          note: string | null;
                          state:
                            "available" | "partial" | "unavailable" | "failed";
                          unit: string;
                          value: number | null;
                        }[];
                      }[];
                      id: "paid" | "organic" | "social" | "email" | "actions";
                      metrics: {
                        change: number | null;
                        currency: string | null;
                        key: string;
                        label: string;
                        note: string | null;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                        unit: string;
                        value: number | null;
                      }[];
                      refusals: {
                        expected: string;
                        explanation: string;
                      }[];
                      sources: {
                        id: string;
                        label: string;
                        observedAt: string | null;
                        reason: string;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                      }[];
                      state: "available" | "partial" | "unavailable" | "failed";
                      summary: string;
                      title: string;
                    }[];
                    title: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The report composer is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/marketing-reports/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  brandRevision: number | null;
                  coverageGaps: {
                    reason: string;
                    remedy: string | null;
                    source: string;
                  }[];
                  /** Format: date-time */
                  generatedAt: string;
                  id: string;
                  narrative: string | null;
                  period: {
                    comparisonEnd: string | null;
                    comparisonStart: string | null;
                    end: string;
                    start: string;
                    timezone: string;
                  };
                  projectId: string;
                  sections: {
                    breakdown: {
                      label: string;
                      metrics: {
                        change: number | null;
                        currency: string | null;
                        key: string;
                        label: string;
                        note: string | null;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                        unit: string;
                        value: number | null;
                      }[];
                    }[];
                    id: "paid" | "organic" | "social" | "email" | "actions";
                    metrics: {
                      change: number | null;
                      currency: string | null;
                      key: string;
                      label: string;
                      note: string | null;
                      state: "available" | "partial" | "unavailable" | "failed";
                      unit: string;
                      value: number | null;
                    }[];
                    refusals: {
                      expected: string;
                      explanation: string;
                    }[];
                    sources: {
                      id: string;
                      label: string;
                      observedAt: string | null;
                      reason: string;
                      state: "available" | "partial" | "unavailable" | "failed";
                    }[];
                    state: "available" | "partial" | "unavailable" | "failed";
                    summary: string;
                    title: string;
                  }[];
                  title: string;
                }
              | {
                  data: {
                    brandRevision: number | null;
                    coverageGaps: {
                      reason: string;
                      remedy: string | null;
                      source: string;
                    }[];
                    /** Format: date-time */
                    generatedAt: string;
                    id: string;
                    narrative: string | null;
                    period: {
                      comparisonEnd: string | null;
                      comparisonStart: string | null;
                      end: string;
                      start: string;
                      timezone: string;
                    };
                    projectId: string;
                    sections: {
                      breakdown: {
                        label: string;
                        metrics: {
                          change: number | null;
                          currency: string | null;
                          key: string;
                          label: string;
                          note: string | null;
                          state:
                            "available" | "partial" | "unavailable" | "failed";
                          unit: string;
                          value: number | null;
                        }[];
                      }[];
                      id: "paid" | "organic" | "social" | "email" | "actions";
                      metrics: {
                        change: number | null;
                        currency: string | null;
                        key: string;
                        label: string;
                        note: string | null;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                        unit: string;
                        value: number | null;
                      }[];
                      refusals: {
                        expected: string;
                        explanation: string;
                      }[];
                      sources: {
                        id: string;
                        label: string;
                        observedAt: string | null;
                        reason: string;
                        state:
                          "available" | "partial" | "unavailable" | "failed";
                      }[];
                      state: "available" | "partial" | "unavailable" | "failed";
                      summary: string;
                      title: string;
                    }[];
                    title: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The report was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The report was removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The report was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/marketing-reports/{id}/render": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          format?: "html" | "text";
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The rendered report. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The report was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/media/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The asset was removed. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The asset was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/media/{id}/public-url": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            /** Format: uri */
            publicUrl: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  filename: string;
                  height: number | null;
                  id: string;
                  kind: "image" | "video";
                  mediaType: string;
                  projectId: string;
                  publicUrl: string | null;
                  publicUrlAt: string | null;
                  publicUrlSource: string | null;
                  sha256: string;
                  sizeBytes: number;
                  width: number | null;
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    filename: string;
                    height: number | null;
                    id: string;
                    kind: "image" | "video";
                    mediaType: string;
                    projectId: string;
                    publicUrl: string | null;
                    publicUrlAt: string | null;
                    publicUrlSource: string | null;
                    sha256: string;
                    sizeBytes: number;
                    width: number | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The asset was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/media/{id}/relay": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  filename: string;
                  height: number | null;
                  id: string;
                  kind: "image" | "video";
                  mediaType: string;
                  projectId: string;
                  publicUrl: string | null;
                  publicUrlAt: string | null;
                  publicUrlSource: string | null;
                  sha256: string;
                  sizeBytes: number;
                  width: number | null;
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    filename: string;
                    height: number | null;
                    id: string;
                    kind: "image" | "video";
                    mediaType: string;
                    projectId: string;
                    publicUrl: string | null;
                    publicUrlAt: string | null;
                    publicUrlSource: string | null;
                    sha256: string;
                    sizeBytes: number;
                    width: number | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The asset was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Object storage is not configured. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/monitoring": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/openapi.json": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              [key: string]: unknown;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/osint": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              data: {
                changes: {
                  after: {
                    claimHash?: string;
                    confidence: number;
                    id: string;
                    kind: string;
                    label: string;
                    /** Format: date-time */
                    observedAt: string;
                    sourceClass:
                      | "public_web"
                      | "first_party"
                      | "licensed_provider"
                      | "user_import";
                    sourceUrl: string | null;
                    state:
                      | "available"
                      | "missing"
                      | "insufficient"
                      | "contradictory";
                    value: unknown;
                  } | null;
                  before: {
                    claimHash?: string;
                    confidence: number;
                    id: string;
                    kind: string;
                    label: string;
                    /** Format: date-time */
                    observedAt: string;
                    sourceClass:
                      | "public_web"
                      | "first_party"
                      | "licensed_provider"
                      | "user_import";
                    sourceUrl: string | null;
                    state:
                      | "available"
                      | "missing"
                      | "insufficient"
                      | "contradictory";
                    value: unknown;
                  } | null;
                  category: string;
                  change: "added" | "removed" | "changed";
                  confidence: number;
                  evidenceIds: string[];
                  id: string;
                  label: string;
                  sourceUrl: string | null;
                  targetUrl: string;
                }[];
                compared: boolean;
                dossier: {
                  coverage: {
                    evidenceAvailable: number;
                    pagesObserved: number;
                    state:
                      | "available"
                      | "missing"
                      | "insufficient"
                      | "contradictory";
                    targetsCompleted: number;
                    targetsRequested: number;
                  };
                  findings: {
                    actionable: boolean;
                    confidence: number;
                    evidenceIds: string[];
                    id: string;
                    severity: "info" | "low" | "medium";
                    statement: string;
                    title: string;
                  }[];
                  /** Format: date-time */
                  generatedAt: string;
                  limitations: string[];
                  policy: {
                    /** @enum {string} */
                    authenticatedCollection: "disabled";
                    /** @enum {string} */
                    collection: "public_web_only";
                    /** @enum {string} */
                    darkWebCollection: "disabled";
                    /** @enum {string} */
                    identityResolution: "disabled";
                    /** @enum {string} */
                    personalData: "disabled";
                  };
                  provenance?: {
                    /** @enum {string} */
                    captureMethod: "same_origin_public_crawl";
                    /** @enum {string} */
                    claimHashAlgorithm: "sha256";
                    evidenceCount: number;
                    evidenceDigest: string;
                    sourceCount: number;
                  };
                  /** @enum {string} */
                  schemaVersion: "osint-dossier.v1";
                  sourceBudget: number;
                  targets: {
                    entities: {
                      exactMatch: boolean;
                      id: string;
                      label: string;
                      type:
                        "organization" | "domain" | "page" | "profile" | "feed";
                      url: string | null;
                    }[];
                    error: string | null;
                    evidence: {
                      claimHash?: string;
                      confidence: number;
                      id: string;
                      kind: string;
                      label: string;
                      /** Format: date-time */
                      observedAt: string;
                      sourceClass:
                        | "public_web"
                        | "first_party"
                        | "licensed_provider"
                        | "user_import";
                      sourceUrl: string | null;
                      state:
                        | "available"
                        | "missing"
                        | "insufficient"
                        | "contradictory";
                      value: unknown;
                    }[];
                    finalUrl: string | null;
                    host: string | null;
                    pagesObserved: number;
                    publishingCadence: {
                      cadence: {
                        cadenceDays: number | null;
                        datedItems: number;
                        /** Format: uri */
                        feedUrl: string;
                        freshnessSeconds: number | null;
                        intervals: number | null;
                        itemsInFeed: number;
                        newestPublishedAt: string | null;
                        oldestPublishedAt: string | null;
                        spanDays: number | null;
                      } | null;
                      detail?: string;
                      /** Format: uri */
                      target: string;
                      unavailable:
                        | "no-feed-discovered"
                        | "blocked-by-robots"
                        | "unsafe-url"
                        | "fetch-failed"
                        | "unparseable"
                        | null;
                    } | null;
                    relationships: {
                      evidenceIds: string[];
                      fromEntityId: string;
                      id: string;
                      toEntityId: string;
                      type: "owns" | "links_to" | "same_as" | "publishes_via";
                    }[];
                    status: "available" | "partial" | "failed";
                    targetUrl: string;
                  }[];
                  /** @enum {string} */
                  workflow: "osint-research";
                } | null;
                previousGeneratedAt: string | null;
              };
              meta: {
                /** Format: date-time */
                generatedAt: string;
                state:
                  "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                warnings: string[];
              };
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/overview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/pages": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              canonicalUrl: string | null;
              /** Format: date-time */
              createdAt: string;
              id: string;
              name: string;
              /** Format: date-time */
              updatedAt: string;
            }[];
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            /** Format: uri */
            canonicalUrl?: string;
            name: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              canonicalUrl: string | null;
              /** Format: date-time */
              createdAt: string;
              id: string;
              name: string;
              /** Format: date-time */
              updatedAt: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description A project already uses this canonical URL. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            confirmation: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  artifactCleanup: "complete" | "scheduled";
                  counts: {
                    actions: number;
                    artifacts: number;
                    campaignBriefs: number;
                    channelAccounts: number;
                    channelMetrics: number;
                    contextEntries: number;
                    contextVersions: number;
                    extractionRuleVersions: number;
                    issueInstances: number;
                    pages: number;
                    publishIntents: number;
                    runs: number;
                    schedules: number;
                  };
                  /** Format: date-time */
                  deletedAt: string;
                  /** @enum {boolean} */
                  globalCredentialsRetained: true;
                  projectId: string;
                }
              | {
                  data: {
                    artifactCleanup: "complete" | "scheduled";
                    counts: {
                      actions: number;
                      artifacts: number;
                      campaignBriefs: number;
                      channelAccounts: number;
                      channelMetrics: number;
                      contextEntries: number;
                      contextVersions: number;
                      extractionRuleVersions: number;
                      issueInstances: number;
                      pages: number;
                      publishIntents: number;
                      runs: number;
                      schedules: number;
                    };
                    /** Format: date-time */
                    deletedAt: string;
                    /** @enum {boolean} */
                    globalCredentialsRetained: true;
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description An active project job is still stopping. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project-name confirmation does not match. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/capabilities": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  available: (
                    | "website"
                    | "search-console"
                    | "analytics"
                    | "serp"
                    | "ads"
                    | "social"
                  )[];
                  projectId: string;
                  states: {
                    available: boolean;
                    capability:
                      | "website"
                      | "search-console"
                      | "analytics"
                      | "serp"
                      | "ads"
                      | "social";
                    reason: string;
                    remedy: {
                      href: string;
                      label: string;
                    } | null;
                  }[];
                }
              | {
                  data: {
                    available: (
                      | "website"
                      | "search-console"
                      | "analytics"
                      | "serp"
                      | "ads"
                      | "social"
                    )[];
                    projectId: string;
                    states: {
                      available: boolean;
                      capability:
                        | "website"
                        | "search-console"
                        | "analytics"
                        | "serp"
                        | "ads"
                        | "social";
                      reason: string;
                      remedy: {
                        href: string;
                        label: string;
                      } | null;
                    }[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/context": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      audiences: string[];
                      brandProfiles: {
                        label: string;
                        /** Format: uri */
                        url: string;
                      }[];
                      competitors: string[];
                      constraints: string[];
                      conversionGoals: string[];
                      languages: string[];
                      markets: string[];
                      priorityTopics: string[];
                      summary: string | null;
                    };
                    projectId: string;
                    revision: number;
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      audiences: string[];
                      brandProfiles: {
                        label: string;
                        /** Format: uri */
                        url: string;
                      }[];
                      competitors: string[];
                      constraints: string[];
                      conversionGoals: string[];
                      languages: string[];
                      markets: string[];
                      priorityTopics: string[];
                      summary: string | null;
                    };
                    projectId: string;
                    revision: number;
                  }[];
                  journal: {
                    actor: string;
                    /** Format: date-time */
                    createdAt: string;
                    detail: string;
                    id: string;
                    kind:
                      "observation" | "decision" | "constraint" | "experiment";
                    projectId: string;
                    sequence: number;
                    sourceRunId: string | null;
                    title: string;
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        audiences: string[];
                        brandProfiles: {
                          label: string;
                          /** Format: uri */
                          url: string;
                        }[];
                        competitors: string[];
                        constraints: string[];
                        conversionGoals: string[];
                        languages: string[];
                        markets: string[];
                        priorityTopics: string[];
                        summary: string | null;
                      };
                      projectId: string;
                      revision: number;
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        audiences: string[];
                        brandProfiles: {
                          label: string;
                          /** Format: uri */
                          url: string;
                        }[];
                        competitors: string[];
                        constraints: string[];
                        conversionGoals: string[];
                        languages: string[];
                        markets: string[];
                        priorityTopics: string[];
                        summary: string | null;
                      };
                      projectId: string;
                      revision: number;
                    }[];
                    journal: {
                      actor: string;
                      /** Format: date-time */
                      createdAt: string;
                      detail: string;
                      id: string;
                      kind:
                        | "observation"
                        | "decision"
                        | "constraint"
                        | "experiment";
                      projectId: string;
                      sequence: number;
                      sourceRunId: string | null;
                      title: string;
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            changeSummary: string;
            profile: {
              audiences: string[];
              brandProfiles: {
                label: string;
                /** Format: uri */
                url: string;
              }[];
              competitors: string[];
              constraints: string[];
              conversionGoals: string[];
              languages: string[];
              markets: string[];
              priorityTopics: string[];
              summary: string | null;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      audiences: string[];
                      brandProfiles: {
                        label: string;
                        /** Format: uri */
                        url: string;
                      }[];
                      competitors: string[];
                      constraints: string[];
                      conversionGoals: string[];
                      languages: string[];
                      markets: string[];
                      priorityTopics: string[];
                      summary: string | null;
                    };
                    projectId: string;
                    revision: number;
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      audiences: string[];
                      brandProfiles: {
                        label: string;
                        /** Format: uri */
                        url: string;
                      }[];
                      competitors: string[];
                      constraints: string[];
                      conversionGoals: string[];
                      languages: string[];
                      markets: string[];
                      priorityTopics: string[];
                      summary: string | null;
                    };
                    projectId: string;
                    revision: number;
                  }[];
                  journal: {
                    actor: string;
                    /** Format: date-time */
                    createdAt: string;
                    detail: string;
                    id: string;
                    kind:
                      "observation" | "decision" | "constraint" | "experiment";
                    projectId: string;
                    sequence: number;
                    sourceRunId: string | null;
                    title: string;
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        audiences: string[];
                        brandProfiles: {
                          label: string;
                          /** Format: uri */
                          url: string;
                        }[];
                        competitors: string[];
                        constraints: string[];
                        conversionGoals: string[];
                        languages: string[];
                        markets: string[];
                        priorityTopics: string[];
                        summary: string | null;
                      };
                      projectId: string;
                      revision: number;
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        audiences: string[];
                        brandProfiles: {
                          label: string;
                          /** Format: uri */
                          url: string;
                        }[];
                        competitors: string[];
                        constraints: string[];
                        conversionGoals: string[];
                        languages: string[];
                        markets: string[];
                        priorityTopics: string[];
                        summary: string | null;
                      };
                      projectId: string;
                      revision: number;
                    }[];
                    journal: {
                      actor: string;
                      /** Format: date-time */
                      createdAt: string;
                      detail: string;
                      id: string;
                      kind:
                        | "observation"
                        | "decision"
                        | "constraint"
                        | "experiment";
                      projectId: string;
                      sequence: number;
                      sourceRunId: string | null;
                      title: string;
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project context is invalid or contains unsafe material. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/context/journal": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            detail: string;
            kind: "observation" | "decision" | "constraint" | "experiment";
            sourceRunId?: string | null;
            title: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  actor: string;
                  /** Format: date-time */
                  createdAt: string;
                  detail: string;
                  id: string;
                  kind:
                    "observation" | "decision" | "constraint" | "experiment";
                  projectId: string;
                  sequence: number;
                  sourceRunId: string | null;
                  title: string;
                }
              | {
                  data: {
                    actor: string;
                    /** Format: date-time */
                    createdAt: string;
                    detail: string;
                    id: string;
                    kind:
                      "observation" | "decision" | "constraint" | "experiment";
                    projectId: string;
                    sequence: number;
                    sourceRunId: string | null;
                    title: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The context journal entry is invalid or contains unsafe material. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/extraction-rules": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    configurationHash: string;
                    /** Format: date-time */
                    createdAt: string;
                    projectId: string;
                    revision: number;
                    rules: {
                      attribute: string | null;
                      enabled: boolean;
                      id: string;
                      label: string;
                      regex: string | null;
                      selector: string;
                      type: "text" | "html" | "attribute";
                    }[];
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    configurationHash: string;
                    /** Format: date-time */
                    createdAt: string;
                    projectId: string;
                    revision: number;
                    rules: {
                      attribute: string | null;
                      enabled: boolean;
                      id: string;
                      label: string;
                      regex: string | null;
                      selector: string;
                      type: "text" | "html" | "attribute";
                    }[];
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      configurationHash: string;
                      /** Format: date-time */
                      createdAt: string;
                      projectId: string;
                      revision: number;
                      rules: {
                        attribute: string | null;
                        enabled: boolean;
                        id: string;
                        label: string;
                        regex: string | null;
                        selector: string;
                        type: "text" | "html" | "attribute";
                      }[];
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      configurationHash: string;
                      /** Format: date-time */
                      createdAt: string;
                      projectId: string;
                      revision: number;
                      rules: {
                        attribute: string | null;
                        enabled: boolean;
                        id: string;
                        label: string;
                        regex: string | null;
                        selector: string;
                        type: "text" | "html" | "attribute";
                      }[];
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            changeSummary: string;
            rules: {
              attribute: string | null;
              enabled: boolean;
              id: string;
              label: string;
              regex: string | null;
              selector: string;
              type: "text" | "html" | "attribute";
            }[];
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    configurationHash: string;
                    /** Format: date-time */
                    createdAt: string;
                    projectId: string;
                    revision: number;
                    rules: {
                      attribute: string | null;
                      enabled: boolean;
                      id: string;
                      label: string;
                      regex: string | null;
                      selector: string;
                      type: "text" | "html" | "attribute";
                    }[];
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    configurationHash: string;
                    /** Format: date-time */
                    createdAt: string;
                    projectId: string;
                    revision: number;
                    rules: {
                      attribute: string | null;
                      enabled: boolean;
                      id: string;
                      label: string;
                      regex: string | null;
                      selector: string;
                      type: "text" | "html" | "attribute";
                    }[];
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      configurationHash: string;
                      /** Format: date-time */
                      createdAt: string;
                      projectId: string;
                      revision: number;
                      rules: {
                        attribute: string | null;
                        enabled: boolean;
                        id: string;
                        label: string;
                        regex: string | null;
                        selector: string;
                        type: "text" | "html" | "attribute";
                      }[];
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      configurationHash: string;
                      /** Format: date-time */
                      createdAt: string;
                      projectId: string;
                      revision: number;
                      rules: {
                        attribute: string | null;
                        enabled: boolean;
                        id: string;
                        label: string;
                        regex: string | null;
                        selector: string;
                        type: "text" | "html" | "attribute";
                      }[];
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The extraction rules are invalid or contain unsafe material. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/extraction-rules/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            allowPrivateHost?: boolean;
            renderMode?: "static" | "js";
            rules: {
              attribute: string | null;
              enabled: boolean;
              id: string;
              label: string;
              regex: string | null;
              selector: string;
              type: "text" | "html" | "attribute";
            }[];
            /** Format: uri */
            url: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configurationHash: string;
                  contentType: string;
                  fields: {
                    label: string;
                    ruleId: string;
                    truncated: boolean;
                    value: string | null;
                  }[];
                  /** Format: uri */
                  finalUrl: string;
                  projectId: string;
                  renderMode: "static" | "js";
                  /** Format: uri */
                  requestedUrl: string;
                  responseTimeMs: number;
                  statusCode: number;
                }
              | {
                  data: {
                    configurationHash: string;
                    contentType: string;
                    fields: {
                      label: string;
                      ruleId: string;
                      truncated: boolean;
                      value: string | null;
                    }[];
                    /** Format: uri */
                    finalUrl: string;
                    projectId: string;
                    renderMode: "static" | "js";
                    /** Format: uri */
                    requestedUrl: string;
                    responseTimeMs: number;
                    statusCode: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The preview target or extraction rules are invalid. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{id}/overview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              criticalRegressions: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              cwvPassRate: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              gscClicks: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              gscImpressions: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              healthChange: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              indexableCoverage: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              lastRun: {
                completedAt: string | null;
                error: string | null;
                id: string;
                issueCount: number;
                progress: number;
                projectId: string;
                /** Format: date-time */
                requestedAt: string;
                startedAt: string | null;
                status:
                  | "queued"
                  | "running"
                  | "succeeded"
                  | "partial"
                  | "failed"
                  | "cancelled";
                workflowId: string;
              } | null;
              organicKeyEvents: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              project: {
                canonicalUrl: string | null;
                /** Format: date-time */
                createdAt: string;
                id: string;
                name: string;
                /** Format: date-time */
                updatedAt: string;
              };
              seoHealth: {
                coverage: number | null;
                note?: string;
                observedAt: string | null;
                source: string;
                state: "available" | "unavailable" | "stale" | "failed";
                value: number | null;
              };
              topActions: {
                affectedUrls: string[];
                confidence: number;
                /** Format: date-time */
                createdAt: string;
                effort: "low" | "medium" | "high";
                id: string;
                impact: number;
                issueFingerprint?: string;
                moduleId?: string;
                owner: string | null;
                priorityScore: number;
                projectId: string;
                ruleId?: string;
                scoreInputs: {
                  confidence: number;
                  conversionExposure: number | null;
                  organicExposure: number | null;
                  severity: number;
                  unavailable: string[];
                  urlReach: number;
                };
                /** @enum {string} */
                scoreVersion: "priority-v1";
                status: "open" | "acknowledged" | "in_progress" | "resolved";
                title: string;
                /** Format: date-time */
                updatedAt: string;
                verification: "pending" | "verified" | "regressed";
                whyNow: string;
              }[];
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/brand-kit": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      buttonRadiusPx: number;
                      colors: {
                        name: string;
                        usage: string | null;
                        value: string;
                      }[];
                      contentWidthPx: number;
                      footer: {
                        companyName: string;
                        legalNotes: string | null;
                        postalAddress: string;
                        unsubscribePlaceholder: string;
                      };
                      logoAltText: string | null;
                      logoMediaId: string | null;
                      prohibitions: string[];
                      referenceMediaId: string | null;
                      referenceNotes: string | null;
                      typefaces: {
                        lineHeight: number;
                        role: "heading" | "body" | "mono";
                        sizePx: number;
                        stack: string;
                        weight: number;
                      }[];
                      voice: string | null;
                    };
                    projectId: string;
                    revision: number;
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      buttonRadiusPx: number;
                      colors: {
                        name: string;
                        usage: string | null;
                        value: string;
                      }[];
                      contentWidthPx: number;
                      footer: {
                        companyName: string;
                        legalNotes: string | null;
                        postalAddress: string;
                        unsubscribePlaceholder: string;
                      };
                      logoAltText: string | null;
                      logoMediaId: string | null;
                      prohibitions: string[];
                      referenceMediaId: string | null;
                      referenceNotes: string | null;
                      typefaces: {
                        lineHeight: number;
                        role: "heading" | "body" | "mono";
                        sizePx: number;
                        stack: string;
                        weight: number;
                      }[];
                      voice: string | null;
                    };
                    projectId: string;
                    revision: number;
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        buttonRadiusPx: number;
                        colors: {
                          name: string;
                          usage: string | null;
                          value: string;
                        }[];
                        contentWidthPx: number;
                        footer: {
                          companyName: string;
                          legalNotes: string | null;
                          postalAddress: string;
                          unsubscribePlaceholder: string;
                        };
                        logoAltText: string | null;
                        logoMediaId: string | null;
                        prohibitions: string[];
                        referenceMediaId: string | null;
                        referenceNotes: string | null;
                        typefaces: {
                          lineHeight: number;
                          role: "heading" | "body" | "mono";
                          sizePx: number;
                          stack: string;
                          weight: number;
                        }[];
                        voice: string | null;
                      };
                      projectId: string;
                      revision: number;
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        buttonRadiusPx: number;
                        colors: {
                          name: string;
                          usage: string | null;
                          value: string;
                        }[];
                        contentWidthPx: number;
                        footer: {
                          companyName: string;
                          legalNotes: string | null;
                          postalAddress: string;
                          unsubscribePlaceholder: string;
                        };
                        logoAltText: string | null;
                        logoMediaId: string | null;
                        prohibitions: string[];
                        referenceMediaId: string | null;
                        referenceNotes: string | null;
                        typefaces: {
                          lineHeight: number;
                          role: "heading" | "body" | "mono";
                          sizePx: number;
                          stack: string;
                          weight: number;
                        }[];
                        voice: string | null;
                      };
                      projectId: string;
                      revision: number;
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            changeSummary: string;
            profile: {
              buttonRadiusPx: number;
              colors: {
                name: string;
                usage: string | null;
                value: string;
              }[];
              contentWidthPx: number;
              footer: {
                companyName: string;
                legalNotes: string | null;
                postalAddress: string;
                unsubscribePlaceholder: string;
              };
              logoAltText: string | null;
              logoMediaId: string | null;
              prohibitions: string[];
              referenceMediaId: string | null;
              referenceNotes: string | null;
              typefaces: {
                lineHeight: number;
                role: "heading" | "body" | "mono";
                sizePx: number;
                stack: string;
                weight: number;
              }[];
              voice: string | null;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  current: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      buttonRadiusPx: number;
                      colors: {
                        name: string;
                        usage: string | null;
                        value: string;
                      }[];
                      contentWidthPx: number;
                      footer: {
                        companyName: string;
                        legalNotes: string | null;
                        postalAddress: string;
                        unsubscribePlaceholder: string;
                      };
                      logoAltText: string | null;
                      logoMediaId: string | null;
                      prohibitions: string[];
                      referenceMediaId: string | null;
                      referenceNotes: string | null;
                      typefaces: {
                        lineHeight: number;
                        role: "heading" | "body" | "mono";
                        sizePx: number;
                        stack: string;
                        weight: number;
                      }[];
                      voice: string | null;
                    };
                    projectId: string;
                    revision: number;
                  } | null;
                  history: {
                    actor: string;
                    changeSummary: string;
                    /** Format: date-time */
                    createdAt: string;
                    profile: {
                      buttonRadiusPx: number;
                      colors: {
                        name: string;
                        usage: string | null;
                        value: string;
                      }[];
                      contentWidthPx: number;
                      footer: {
                        companyName: string;
                        legalNotes: string | null;
                        postalAddress: string;
                        unsubscribePlaceholder: string;
                      };
                      logoAltText: string | null;
                      logoMediaId: string | null;
                      prohibitions: string[];
                      referenceMediaId: string | null;
                      referenceNotes: string | null;
                      typefaces: {
                        lineHeight: number;
                        role: "heading" | "body" | "mono";
                        sizePx: number;
                        stack: string;
                        weight: number;
                      }[];
                      voice: string | null;
                    };
                    projectId: string;
                    revision: number;
                  }[];
                  projectId: string;
                }
              | {
                  data: {
                    current: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        buttonRadiusPx: number;
                        colors: {
                          name: string;
                          usage: string | null;
                          value: string;
                        }[];
                        contentWidthPx: number;
                        footer: {
                          companyName: string;
                          legalNotes: string | null;
                          postalAddress: string;
                          unsubscribePlaceholder: string;
                        };
                        logoAltText: string | null;
                        logoMediaId: string | null;
                        prohibitions: string[];
                        referenceMediaId: string | null;
                        referenceNotes: string | null;
                        typefaces: {
                          lineHeight: number;
                          role: "heading" | "body" | "mono";
                          sizePx: number;
                          stack: string;
                          weight: number;
                        }[];
                        voice: string | null;
                      };
                      projectId: string;
                      revision: number;
                    } | null;
                    history: {
                      actor: string;
                      changeSummary: string;
                      /** Format: date-time */
                      createdAt: string;
                      profile: {
                        buttonRadiusPx: number;
                        colors: {
                          name: string;
                          usage: string | null;
                          value: string;
                        }[];
                        contentWidthPx: number;
                        footer: {
                          companyName: string;
                          legalNotes: string | null;
                          postalAddress: string;
                          unsubscribePlaceholder: string;
                        };
                        logoAltText: string | null;
                        logoMediaId: string | null;
                        prohibitions: string[];
                        referenceMediaId: string | null;
                        referenceNotes: string | null;
                        typefaces: {
                          lineHeight: number;
                          role: "heading" | "body" | "mono";
                          sizePx: number;
                          stack: string;
                          weight: number;
                        }[];
                        voice: string | null;
                      };
                      projectId: string;
                      revision: number;
                    }[];
                    projectId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/campaign-links": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  /** Format: uri */
                  destinationUrl: string;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  id: string;
                  label: string;
                  placement:
                    | "screen"
                    | "print-handheld"
                    | "print-poster"
                    | "packaging"
                    | "outdoor";
                  printedAt: string | null;
                  printedWidthMm: number | null;
                  projectId: string;
                  style: {
                    darkColor: string;
                    errorCorrection: "L" | "M" | "Q" | "H";
                    lightColor: string;
                    quietZone: number;
                    transparent: boolean;
                  };
                  taggedUrl: string;
                  /** Format: date-time */
                  updatedAt: string;
                  utm: {
                    campaign: string;
                    content: string | null;
                    medium: string;
                    source: string;
                    term: string | null;
                  };
                }[]
              | {
                  data: {
                    items: {
                      /** Format: date-time */
                      createdAt: string;
                      /** Format: uri */
                      destinationUrl: string;
                      findings: {
                        field: string | null;
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "warning" | "advice";
                      }[];
                      id: string;
                      label: string;
                      placement:
                        | "screen"
                        | "print-handheld"
                        | "print-poster"
                        | "packaging"
                        | "outdoor";
                      printedAt: string | null;
                      printedWidthMm: number | null;
                      projectId: string;
                      style: {
                        darkColor: string;
                        errorCorrection: "L" | "M" | "Q" | "H";
                        lightColor: string;
                        quietZone: number;
                        transparent: boolean;
                      };
                      taggedUrl: string;
                      /** Format: date-time */
                      updatedAt: string;
                      utm: {
                        campaign: string;
                        content: string | null;
                        medium: string;
                        source: string;
                        term: string | null;
                      };
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            /** Format: uri */
            destinationUrl: string;
            label: string;
            placement?:
              | "screen"
              | "print-handheld"
              | "print-poster"
              | "packaging"
              | "outdoor";
            printedWidthMm?: number;
            style?: {
              darkColor?: string;
              errorCorrection?: "L" | "M" | "Q" | "H";
              lightColor?: string;
              quietZone?: number;
              transparent?: boolean;
            };
            utm: {
              campaign: string;
              content: string | null;
              medium: string;
              source: string;
              term: string | null;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  /** Format: uri */
                  destinationUrl: string;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  id: string;
                  label: string;
                  placement:
                    | "screen"
                    | "print-handheld"
                    | "print-poster"
                    | "packaging"
                    | "outdoor";
                  printedAt: string | null;
                  printedWidthMm: number | null;
                  projectId: string;
                  style: {
                    darkColor: string;
                    errorCorrection: "L" | "M" | "Q" | "H";
                    lightColor: string;
                    quietZone: number;
                    transparent: boolean;
                  };
                  taggedUrl: string;
                  /** Format: date-time */
                  updatedAt: string;
                  utm: {
                    campaign: string;
                    content: string | null;
                    medium: string;
                    source: string;
                    term: string | null;
                  };
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: uri */
                    destinationUrl: string;
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    id: string;
                    label: string;
                    placement:
                      | "screen"
                      | "print-handheld"
                      | "print-poster"
                      | "packaging"
                      | "outdoor";
                    printedAt: string | null;
                    printedWidthMm: number | null;
                    projectId: string;
                    style: {
                      darkColor: string;
                      errorCorrection: "L" | "M" | "Q" | "H";
                      lightColor: string;
                      quietZone: number;
                      transparent: boolean;
                    };
                    taggedUrl: string;
                    /** Format: date-time */
                    updatedAt: string;
                    utm: {
                      campaign: string;
                      content: string | null;
                      medium: string;
                      source: string;
                      term: string | null;
                    };
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description A link with this exact tagging exists. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The tagging would lose data. The findings name what to change. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              findings: {
                field: string | null;
                message: string;
                remedy: string | null;
                rule: string;
                severity: "blocking" | "warning" | "advice";
              }[];
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description QR generation is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/campaign-links/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            destinationUrl: string;
            placement?:
              | "screen"
              | "print-handheld"
              | "print-poster"
              | "packaging"
              | "outdoor";
            printedWidthMm?: number;
            style?: {
              darkColor?: string;
              errorCorrection?: "L" | "M" | "Q" | "H";
              lightColor?: string;
              quietZone?: number;
              transparent?: boolean;
            };
            utm: {
              campaign: string;
              content: string | null;
              medium: string;
              source: string;
              term: string | null;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  advice: {
                    contrastRatio: number;
                    errorCorrection: "L" | "M" | "Q" | "H";
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    maxScanDistanceMm: number;
                    moduleCount: number;
                    moduleSizeMm: number;
                    printedWidthMm: number;
                    recommendedWidthMm: number;
                    verdict: "comfortable" | "tight" | "unscannable";
                    version: number;
                  } | null;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  normalizedUtm: {
                    campaign: string;
                    content: string | null;
                    medium: string;
                    source: string;
                    term: string | null;
                  };
                  svg: string | null;
                  taggedUrl: string;
                }
              | {
                  data: {
                    advice: {
                      contrastRatio: number;
                      errorCorrection: "L" | "M" | "Q" | "H";
                      findings: {
                        field: string | null;
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "warning" | "advice";
                      }[];
                      maxScanDistanceMm: number;
                      moduleCount: number;
                      moduleSizeMm: number;
                      printedWidthMm: number;
                      recommendedWidthMm: number;
                      verdict: "comfortable" | "tight" | "unscannable";
                      version: number;
                    } | null;
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    normalizedUtm: {
                      campaign: string;
                      content: string | null;
                      medium: string;
                      source: string;
                      term: string | null;
                    };
                    svg: string | null;
                    taggedUrl: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description QR generation is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/campaign-links/redirect-config": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            expiresAt?: string | null;
            fallbackUrl?: string | null;
            linkIds?: string[];
            shortHost?: string | null;
            target:
              "cloudflare-worker" | "netlify" | "vercel" | "nginx" | "apache";
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  contents: string;
                  enforcesExpiry: boolean;
                  filename: string;
                  findings: {
                    field: string | null;
                    message: string;
                    remedy: string | null;
                    rule: string;
                    severity: "blocking" | "warning" | "advice";
                  }[];
                  notes: string[];
                }
              | {
                  data: {
                    contents: string;
                    enforcesExpiry: boolean;
                    filename: string;
                    findings: {
                      field: string | null;
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "warning" | "advice";
                    }[];
                    notes: string[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Redirect configuration is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/email-preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            html: string;
            preheader?: string;
            subject: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  compiledHtml: string;
                  plainText: string;
                  preheader: string;
                  report: {
                    counts: {
                      blocking: number;
                      error: number;
                      info: number;
                      warning: number;
                    };
                    findings: {
                      affects: string[];
                      message: string;
                      remedy: string | null;
                      rule: string;
                      severity: "blocking" | "error" | "warning" | "info";
                      where: string | null;
                    }[];
                    gmailClips: boolean;
                    ok: boolean;
                    sizeBytes: number;
                  };
                  subject: string;
                }
              | {
                  data: {
                    compiledHtml: string;
                    plainText: string;
                    preheader: string;
                    report: {
                      counts: {
                        blocking: number;
                        error: number;
                        info: number;
                        warning: number;
                      };
                      findings: {
                        affects: string[];
                        message: string;
                        remedy: string | null;
                        rule: string;
                        severity: "blocking" | "error" | "warning" | "info";
                        where: string | null;
                      }[];
                      gmailClips: boolean;
                      ok: boolean;
                      sizeBytes: number;
                    };
                    subject: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The email compiler is unavailable. */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/email-starter": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  html: string;
                }
              | {
                  data: {
                    html: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/media": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  filename: string;
                  height: number | null;
                  id: string;
                  kind: "image" | "video";
                  mediaType: string;
                  projectId: string;
                  publicUrl: string | null;
                  publicUrlAt: string | null;
                  publicUrlSource: string | null;
                  sha256: string;
                  sizeBytes: number;
                  width: number | null;
                }[]
              | {
                  data: {
                    items: {
                      /** Format: date-time */
                      createdAt: string;
                      filename: string;
                      height: number | null;
                      id: string;
                      kind: "image" | "video";
                      mediaType: string;
                      projectId: string;
                      publicUrl: string | null;
                      publicUrlAt: string | null;
                      publicUrlSource: string | null;
                      sha256: string;
                      sizeBytes: number;
                      width: number | null;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: {
          "x-marketingovo-filename"?: string;
        };
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  createdAt: string;
                  filename: string;
                  height: number | null;
                  id: string;
                  kind: "image" | "video";
                  mediaType: string;
                  projectId: string;
                  publicUrl: string | null;
                  publicUrlAt: string | null;
                  publicUrlSource: string | null;
                  sha256: string;
                  sizeBytes: number;
                  width: number | null;
                }
              | {
                  data: {
                    /** Format: date-time */
                    createdAt: string;
                    filename: string;
                    height: number | null;
                    id: string;
                    kind: "image" | "video";
                    mediaType: string;
                    projectId: string;
                    publicUrl: string | null;
                    publicUrlAt: string | null;
                    publicUrlSource: string | null;
                    sha256: string;
                    sizeBytes: number;
                    width: number | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The file exceeds the upload limit. */
        413: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The file format is not supported. */
        415: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/projects/{projectId}/publish-intents": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          projectId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            budget?: {
              currency?: string | null;
              dailyBudget?: number | null;
              lifetimeBudget?: number | null;
            };
            channelAccountId: string;
            deliverableId: string;
            payload: {
              [key: string]: unknown;
            };
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  approvedAt: string | null;
                  approvedBy: string | null;
                  approvedPayloadHash: string | null;
                  budget: {
                    currency: string | null;
                    dailyBudget: number | null;
                    lifetimeBudget: number | null;
                  };
                  channelAccountId: string;
                  deliverableId: string;
                  id: string;
                  idempotencyKey: string | null;
                  note: string | null;
                  payload: {
                    [key: string]: unknown;
                  };
                  payloadHash: string;
                  projectId: string;
                  scheduledAt: string | null;
                  /** Format: date-time */
                  stagedAt: string;
                  stagedBy: string;
                  state:
                    | "staged"
                    | "approved"
                    | "publishing"
                    | "published"
                    | "failed"
                    | "void"
                    | "withdrawn";
                  timezone: string | null;
                }
              | {
                  data: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The deliverable or cabinet was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The budget exceeds the cabinet's locally set spend cap. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-intents": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          projectId: string;
          state?:
            | "staged"
            | "approved"
            | "publishing"
            | "published"
            | "failed"
            | "void"
            | "withdrawn";
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  approvedAt: string | null;
                  approvedBy: string | null;
                  approvedPayloadHash: string | null;
                  budget: {
                    currency: string | null;
                    dailyBudget: number | null;
                    lifetimeBudget: number | null;
                  };
                  channelAccountId: string;
                  deliverableId: string;
                  id: string;
                  idempotencyKey: string | null;
                  note: string | null;
                  payload: {
                    [key: string]: unknown;
                  };
                  payloadHash: string;
                  projectId: string;
                  scheduledAt: string | null;
                  /** Format: date-time */
                  stagedAt: string;
                  stagedBy: string;
                  state:
                    | "staged"
                    | "approved"
                    | "publishing"
                    | "published"
                    | "failed"
                    | "void"
                    | "withdrawn";
                  timezone: string | null;
                }[]
              | {
                  data: {
                    items: {
                      approvedAt: string | null;
                      approvedBy: string | null;
                      approvedPayloadHash: string | null;
                      budget: {
                        currency: string | null;
                        dailyBudget: number | null;
                        lifetimeBudget: number | null;
                      };
                      channelAccountId: string;
                      deliverableId: string;
                      id: string;
                      idempotencyKey: string | null;
                      note: string | null;
                      payload: {
                        [key: string]: unknown;
                      };
                      payloadHash: string;
                      projectId: string;
                      scheduledAt: string | null;
                      /** Format: date-time */
                      stagedAt: string;
                      stagedBy: string;
                      state:
                        | "staged"
                        | "approved"
                        | "publishing"
                        | "published"
                        | "failed"
                        | "void"
                        | "withdrawn";
                      timezone: string | null;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-intents/{id}/approve": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            payloadHash: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  approvedAt: string | null;
                  approvedBy: string | null;
                  approvedPayloadHash: string | null;
                  budget: {
                    currency: string | null;
                    dailyBudget: number | null;
                    lifetimeBudget: number | null;
                  };
                  channelAccountId: string;
                  deliverableId: string;
                  id: string;
                  idempotencyKey: string | null;
                  note: string | null;
                  payload: {
                    [key: string]: unknown;
                  };
                  payloadHash: string;
                  projectId: string;
                  scheduledAt: string | null;
                  /** Format: date-time */
                  stagedAt: string;
                  stagedBy: string;
                  state:
                    | "staged"
                    | "approved"
                    | "publishing"
                    | "published"
                    | "failed"
                    | "void"
                    | "withdrawn";
                  timezone: string | null;
                }
              | {
                  data: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The publish intent was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The intent is no longer staged, or its payload changed since it was rendered. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The budget exceeds the cabinet's locally set spend cap. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-intents/{id}/publish-now": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  intent: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  };
                  reason: string | null;
                  record: {
                    /** Format: date-time */
                    attemptedAt: string;
                    channelAccountId: string;
                    completedAt: string | null;
                    error: string | null;
                    id: string;
                    idempotencyKey: string;
                    intentId: string;
                    permalink: string | null;
                    platform: "telegram" | "x" | "facebook-page" | "instagram";
                    projectId: string;
                    providerId: string | null;
                    request: {
                      [key: string]: unknown;
                    };
                    state:
                      "attempting" | "published" | "failed" | "indeterminate";
                  } | null;
                  state: "published" | "failed" | "indeterminate" | "skipped";
                }
              | {
                  data: {
                    intent: {
                      approvedAt: string | null;
                      approvedBy: string | null;
                      approvedPayloadHash: string | null;
                      budget: {
                        currency: string | null;
                        dailyBudget: number | null;
                        lifetimeBudget: number | null;
                      };
                      channelAccountId: string;
                      deliverableId: string;
                      id: string;
                      idempotencyKey: string | null;
                      note: string | null;
                      payload: {
                        [key: string]: unknown;
                      };
                      payloadHash: string;
                      projectId: string;
                      scheduledAt: string | null;
                      /** Format: date-time */
                      stagedAt: string;
                      stagedBy: string;
                      state:
                        | "staged"
                        | "approved"
                        | "publishing"
                        | "published"
                        | "failed"
                        | "void"
                        | "withdrawn";
                      timezone: string | null;
                    };
                    reason: string | null;
                    record: {
                      /** Format: date-time */
                      attemptedAt: string;
                      channelAccountId: string;
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      idempotencyKey: string;
                      intentId: string;
                      permalink: string | null;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      projectId: string;
                      providerId: string | null;
                      request: {
                        [key: string]: unknown;
                      };
                      state:
                        "attempting" | "published" | "failed" | "indeterminate";
                    } | null;
                    state: "published" | "failed" | "indeterminate" | "skipped";
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The publish intent was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-intents/{id}/schedule": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            /** Format: date-time */
            scheduledAt: string;
            timezone: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  approvedAt: string | null;
                  approvedBy: string | null;
                  approvedPayloadHash: string | null;
                  budget: {
                    currency: string | null;
                    dailyBudget: number | null;
                    lifetimeBudget: number | null;
                  };
                  channelAccountId: string;
                  deliverableId: string;
                  id: string;
                  idempotencyKey: string | null;
                  note: string | null;
                  payload: {
                    [key: string]: unknown;
                  };
                  payloadHash: string;
                  projectId: string;
                  scheduledAt: string | null;
                  /** Format: date-time */
                  stagedAt: string;
                  stagedBy: string;
                  state:
                    | "staged"
                    | "approved"
                    | "publishing"
                    | "published"
                    | "failed"
                    | "void"
                    | "withdrawn";
                  timezone: string | null;
                }
              | {
                  data: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The publish intent was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The post is already publishing or published. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The scheduled time is in the past. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-intents/{id}/withdraw": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            note: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  approvedAt: string | null;
                  approvedBy: string | null;
                  approvedPayloadHash: string | null;
                  budget: {
                    currency: string | null;
                    dailyBudget: number | null;
                    lifetimeBudget: number | null;
                  };
                  channelAccountId: string;
                  deliverableId: string;
                  id: string;
                  idempotencyKey: string | null;
                  note: string | null;
                  payload: {
                    [key: string]: unknown;
                  };
                  payloadHash: string;
                  projectId: string;
                  scheduledAt: string | null;
                  /** Format: date-time */
                  stagedAt: string;
                  stagedBy: string;
                  state:
                    | "staged"
                    | "approved"
                    | "publishing"
                    | "published"
                    | "failed"
                    | "void"
                    | "withdrawn";
                  timezone: string | null;
                }
              | {
                  data: {
                    approvedAt: string | null;
                    approvedBy: string | null;
                    approvedPayloadHash: string | null;
                    budget: {
                      currency: string | null;
                      dailyBudget: number | null;
                      lifetimeBudget: number | null;
                    };
                    channelAccountId: string;
                    deliverableId: string;
                    id: string;
                    idempotencyKey: string | null;
                    note: string | null;
                    payload: {
                      [key: string]: unknown;
                    };
                    payloadHash: string;
                    projectId: string;
                    scheduledAt: string | null;
                    /** Format: date-time */
                    stagedAt: string;
                    stagedBy: string;
                    state:
                      | "staged"
                      | "approved"
                      | "publishing"
                      | "published"
                      | "failed"
                      | "void"
                      | "withdrawn";
                    timezone: string | null;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The publish intent was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/publish-records": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          intentId?: string;
          projectId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  /** Format: date-time */
                  attemptedAt: string;
                  channelAccountId: string;
                  completedAt: string | null;
                  error: string | null;
                  id: string;
                  idempotencyKey: string;
                  intentId: string;
                  permalink: string | null;
                  platform: "telegram" | "x" | "facebook-page" | "instagram";
                  projectId: string;
                  providerId: string | null;
                  request: {
                    [key: string]: unknown;
                  };
                  state:
                    "attempting" | "published" | "failed" | "indeterminate";
                }[]
              | {
                  data: {
                    items: {
                      /** Format: date-time */
                      attemptedAt: string;
                      channelAccountId: string;
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      idempotencyKey: string;
                      intentId: string;
                      permalink: string | null;
                      platform:
                        "telegram" | "x" | "facebook-page" | "instagram";
                      projectId: string;
                      providerId: string | null;
                      request: {
                        [key: string]: unknown;
                      };
                      state:
                        "attempting" | "published" | "failed" | "indeterminate";
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/reports": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          projectId?: string;
          siteId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  completedAt: string | null;
                  error: string | null;
                  id: string;
                  issueCount: number;
                  progress: number;
                  projectId: string;
                  /** Format: date-time */
                  requestedAt: string;
                  startedAt: string | null;
                  status:
                    | "queued"
                    | "running"
                    | "succeeded"
                    | "partial"
                    | "failed"
                    | "cancelled";
                  workflowId: string;
                }[]
              | {
                  data: {
                    items: {
                      completedAt: string | null;
                      healthScore: number | null;
                      id: string;
                      issuesFound: number;
                      message: string | null;
                      pagesCrawled: number | null;
                      progress: number;
                      /** Format: date-time */
                      startedAt: string;
                      status:
                        | "queued"
                        | "running"
                        | "completed"
                        | "partial"
                        | "failed"
                        | "cancelled";
                      /** @enum {string} */
                      trigger: "manual";
                      workflowId: string;
                    }[];
                    total: number;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: {
          "idempotency-key": string;
          "x-marketingovo-client"?: "dashboard";
        };
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json":
            | {
                goal?: string;
                options?: {
                  [key: string]: unknown;
                };
                projectId: string;
                workflowId?:
                  | "audit"
                  | "compare"
                  | "keyword-research"
                  | "content-plan"
                  | "osint-research"
                  | "ads-audit"
                  | "marketing-report";
              }
            | {
                mode?: "full" | "incremental";
                privateHostAllowlist?: string[];
                siteId: string;
              };
        };
      };
      responses: {
        /** @description Default Response */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  completedAt: string | null;
                  error: string | null;
                  id: string;
                  issueCount: number;
                  progress: number;
                  projectId: string;
                  /** Format: date-time */
                  requestedAt: string;
                  startedAt: string | null;
                  status:
                    | "queued"
                    | "running"
                    | "succeeded"
                    | "partial"
                    | "failed"
                    | "cancelled";
                  workflowId: string;
                }
              | {
                  data: {
                    completedAt: string | null;
                    healthScore: number | null;
                    id: string;
                    issuesFound: number;
                    message: string | null;
                    pagesCrawled: number | null;
                    progress: number;
                    /** Format: date-time */
                    startedAt: string;
                    status:
                      | "queued"
                      | "running"
                      | "completed"
                      | "partial"
                      | "failed"
                      | "cancelled";
                    /** @enum {string} */
                    trigger: "manual";
                    workflowId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request conflicts with the current run. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  completedAt: string | null;
                  error: string | null;
                  id: string;
                  issueCount: number;
                  progress: number;
                  projectId: string;
                  /** Format: date-time */
                  requestedAt: string;
                  startedAt: string | null;
                  status:
                    | "queued"
                    | "running"
                    | "succeeded"
                    | "partial"
                    | "failed"
                    | "cancelled";
                  workflowId: string;
                }
              | {
                  data: {
                    completedAt: string | null;
                    healthScore: number | null;
                    id: string;
                    issueBreakdown: {
                      count: number;
                      severity: string;
                    }[];
                    issuesFound: number;
                    log: {
                      /** Format: date-time */
                      at: string;
                      level: "info" | "error";
                      message: string;
                    }[];
                    message: string | null;
                    pagesCrawled: number | null;
                    progress: number;
                    /** Format: date-time */
                    startedAt: string;
                    status:
                      | "queued"
                      | "running"
                      | "completed"
                      | "partial"
                      | "failed"
                      | "cancelled";
                    summary: string;
                    /** @enum {string} */
                    trigger: "manual";
                    workflowId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              completedAt: string | null;
              error: string | null;
              id: string;
              issueCount: number;
              progress: number;
              projectId: string;
              /** Format: date-time */
              requestedAt: string;
              startedAt: string | null;
              status:
                | "queued"
                | "running"
                | "succeeded"
                | "partial"
                | "failed"
                | "cancelled";
              workflowId: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run can no longer be cancelled. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/comparison": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          baselineRunId: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  baselineRun: {
                    completedAt: string | null;
                    error: string | null;
                    id: string;
                    issueCount: number;
                    progress: number;
                    projectId: string;
                    /** Format: date-time */
                    requestedAt: string;
                    startedAt: string | null;
                    status:
                      | "queued"
                      | "running"
                      | "succeeded"
                      | "partial"
                      | "failed"
                      | "cancelled";
                    workflowId: string;
                  };
                  configuration: {
                    baselineHash: string | null;
                    currentHash: string | null;
                    differences: string[];
                    state: "matched" | "different" | "unavailable";
                  };
                  currentRun: {
                    completedAt: string | null;
                    error: string | null;
                    id: string;
                    issueCount: number;
                    progress: number;
                    projectId: string;
                    /** Format: date-time */
                    requestedAt: string;
                    startedAt: string | null;
                    status:
                      | "queued"
                      | "running"
                      | "succeeded"
                      | "partial"
                      | "failed"
                      | "cancelled";
                    workflowId: string;
                  };
                  /** Format: date-time */
                  generatedAt: string;
                  issueImprovements: {
                    baselineSeverity:
                      ("critical" | "high" | "medium" | "low" | "info") | null;
                    canonicalUrl: string | null;
                    change:
                      | "new"
                      | "resolved"
                      | "severity_increased"
                      | "severity_decreased";
                    currentSeverity:
                      ("critical" | "high" | "medium" | "low" | "info") | null;
                    fingerprint: string;
                    moduleId: string;
                    ruleId: string;
                    title: string;
                  }[];
                  issueRegressions: {
                    baselineSeverity:
                      ("critical" | "high" | "medium" | "low" | "info") | null;
                    canonicalUrl: string | null;
                    change:
                      | "new"
                      | "resolved"
                      | "severity_increased"
                      | "severity_decreased";
                    currentSeverity:
                      ("critical" | "high" | "medium" | "low" | "info") | null;
                    fingerprint: string;
                    moduleId: string;
                    ruleId: string;
                    title: string;
                  }[];
                  linkGraph: {
                    baseline: {
                      edgeCount: number;
                      graphPageCount: number;
                      pageCount: number;
                    };
                    changes: {
                      after: {
                        anchorTexts: string[];
                        followOccurrences: number;
                        nofollowOccurrences: number;
                        occurrences: number;
                        placements: (
                          | "header"
                          | "navigation"
                          | "main"
                          | "aside"
                          | "footer"
                          | "body"
                        )[];
                        targetIndexable: boolean | null;
                        targetPageUrl: string | null;
                        targetState:
                          "direct" | "redirected" | "broken" | "uncrawled";
                        targetStatusCode: number | null;
                      } | null;
                      before: {
                        anchorTexts: string[];
                        followOccurrences: number;
                        nofollowOccurrences: number;
                        occurrences: number;
                        placements: (
                          | "header"
                          | "navigation"
                          | "main"
                          | "aside"
                          | "footer"
                          | "body"
                        )[];
                        targetIndexable: boolean | null;
                        targetPageUrl: string | null;
                        targetState:
                          "direct" | "redirected" | "broken" | "uncrawled";
                        targetStatusCode: number | null;
                      } | null;
                      change: "added" | "removed" | "changed";
                      impact: "regression" | "improvement" | "neutral";
                      reasons: (
                        | "target_resolution"
                        | "target_indexability"
                        | "follow_policy"
                        | "occurrences"
                        | "anchor_text"
                        | "placement"
                      )[];
                      /** Format: uri */
                      sourceUrl: string;
                      /** Format: uri */
                      targetUrl: string;
                    }[];
                    current: {
                      edgeCount: number;
                      graphPageCount: number;
                      pageCount: number;
                    };
                    state: "available" | "partial" | "unavailable";
                    summary: {
                      addedEdges: number;
                      changedEdges: number;
                      improvements: number;
                      regressions: number;
                      removedEdges: number;
                    };
                    truncated: boolean;
                    /** @enum {string} */
                    version: "link-delta-v1";
                    warnings: string[];
                  };
                  pageChanges: {
                    after: {
                      indexable: boolean | null;
                      statusCode: number | null;
                      title: string | null;
                    } | null;
                    before: {
                      indexable: boolean | null;
                      statusCode: number | null;
                      title: string | null;
                    } | null;
                    /** Format: uri */
                    canonicalUrl: string;
                    impact: "regression" | "improvement" | "neutral";
                    kind:
                      | "added"
                      | "removed"
                      | "status_changed"
                      | "indexability_changed";
                  }[];
                  projectId: string;
                  /** @enum {string} */
                  scoreVersion: "regression-v1";
                  state: "available" | "partial" | "unavailable";
                  summary: {
                    addedPages: number;
                    baselineHealth: number | null;
                    baselineIssues: number;
                    baselinePages: number;
                    currentHealth: number | null;
                    currentIssues: number;
                    currentPages: number;
                    healthDelta: number | null;
                    indexabilityChanges: number;
                    newIssues: number;
                    persistentIssues: number;
                    regressionScore: number;
                    removedPages: number;
                    resolvedIssues: number;
                    reviewedExcludedBaseline: number;
                    reviewedExcludedCurrent: number;
                    severityDecreases: number;
                    severityIncreases: number;
                    statusChanges: number;
                  };
                  truncated: {
                    issueImprovements: boolean;
                    issueRegressions: boolean;
                    pageChanges: boolean;
                  };
                  warnings: string[];
                }
              | {
                  data: {
                    baselineRun: {
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      issueCount: number;
                      progress: number;
                      projectId: string;
                      /** Format: date-time */
                      requestedAt: string;
                      startedAt: string | null;
                      status:
                        | "queued"
                        | "running"
                        | "succeeded"
                        | "partial"
                        | "failed"
                        | "cancelled";
                      workflowId: string;
                    };
                    configuration: {
                      baselineHash: string | null;
                      currentHash: string | null;
                      differences: string[];
                      state: "matched" | "different" | "unavailable";
                    };
                    currentRun: {
                      completedAt: string | null;
                      error: string | null;
                      id: string;
                      issueCount: number;
                      progress: number;
                      projectId: string;
                      /** Format: date-time */
                      requestedAt: string;
                      startedAt: string | null;
                      status:
                        | "queued"
                        | "running"
                        | "succeeded"
                        | "partial"
                        | "failed"
                        | "cancelled";
                      workflowId: string;
                    };
                    /** Format: date-time */
                    generatedAt: string;
                    issueImprovements: {
                      baselineSeverity:
                        | ("critical" | "high" | "medium" | "low" | "info")
                        | null;
                      canonicalUrl: string | null;
                      change:
                        | "new"
                        | "resolved"
                        | "severity_increased"
                        | "severity_decreased";
                      currentSeverity:
                        | ("critical" | "high" | "medium" | "low" | "info")
                        | null;
                      fingerprint: string;
                      moduleId: string;
                      ruleId: string;
                      title: string;
                    }[];
                    issueRegressions: {
                      baselineSeverity:
                        | ("critical" | "high" | "medium" | "low" | "info")
                        | null;
                      canonicalUrl: string | null;
                      change:
                        | "new"
                        | "resolved"
                        | "severity_increased"
                        | "severity_decreased";
                      currentSeverity:
                        | ("critical" | "high" | "medium" | "low" | "info")
                        | null;
                      fingerprint: string;
                      moduleId: string;
                      ruleId: string;
                      title: string;
                    }[];
                    linkGraph: {
                      baseline: {
                        edgeCount: number;
                        graphPageCount: number;
                        pageCount: number;
                      };
                      changes: {
                        after: {
                          anchorTexts: string[];
                          followOccurrences: number;
                          nofollowOccurrences: number;
                          occurrences: number;
                          placements: (
                            | "header"
                            | "navigation"
                            | "main"
                            | "aside"
                            | "footer"
                            | "body"
                          )[];
                          targetIndexable: boolean | null;
                          targetPageUrl: string | null;
                          targetState:
                            "direct" | "redirected" | "broken" | "uncrawled";
                          targetStatusCode: number | null;
                        } | null;
                        before: {
                          anchorTexts: string[];
                          followOccurrences: number;
                          nofollowOccurrences: number;
                          occurrences: number;
                          placements: (
                            | "header"
                            | "navigation"
                            | "main"
                            | "aside"
                            | "footer"
                            | "body"
                          )[];
                          targetIndexable: boolean | null;
                          targetPageUrl: string | null;
                          targetState:
                            "direct" | "redirected" | "broken" | "uncrawled";
                          targetStatusCode: number | null;
                        } | null;
                        change: "added" | "removed" | "changed";
                        impact: "regression" | "improvement" | "neutral";
                        reasons: (
                          | "target_resolution"
                          | "target_indexability"
                          | "follow_policy"
                          | "occurrences"
                          | "anchor_text"
                          | "placement"
                        )[];
                        /** Format: uri */
                        sourceUrl: string;
                        /** Format: uri */
                        targetUrl: string;
                      }[];
                      current: {
                        edgeCount: number;
                        graphPageCount: number;
                        pageCount: number;
                      };
                      state: "available" | "partial" | "unavailable";
                      summary: {
                        addedEdges: number;
                        changedEdges: number;
                        improvements: number;
                        regressions: number;
                        removedEdges: number;
                      };
                      truncated: boolean;
                      /** @enum {string} */
                      version: "link-delta-v1";
                      warnings: string[];
                    };
                    pageChanges: {
                      after: {
                        indexable: boolean | null;
                        statusCode: number | null;
                        title: string | null;
                      } | null;
                      before: {
                        indexable: boolean | null;
                        statusCode: number | null;
                        title: string | null;
                      } | null;
                      /** Format: uri */
                      canonicalUrl: string;
                      impact: "regression" | "improvement" | "neutral";
                      kind:
                        | "added"
                        | "removed"
                        | "status_changed"
                        | "indexability_changed";
                    }[];
                    projectId: string;
                    /** @enum {string} */
                    scoreVersion: "regression-v1";
                    state: "available" | "partial" | "unavailable";
                    summary: {
                      addedPages: number;
                      baselineHealth: number | null;
                      baselineIssues: number;
                      baselinePages: number;
                      currentHealth: number | null;
                      currentIssues: number;
                      currentPages: number;
                      healthDelta: number | null;
                      indexabilityChanges: number;
                      newIssues: number;
                      persistentIssues: number;
                      regressionScore: number;
                      removedPages: number;
                      resolvedIssues: number;
                      reviewedExcludedBaseline: number;
                      reviewedExcludedCurrent: number;
                      severityDecreases: number;
                      severityIncreases: number;
                      statusChanges: number;
                    };
                    truncated: {
                      issueImprovements: boolean;
                      issueRegressions: boolean;
                      pageChanges: boolean;
                    };
                    warnings: string[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description One of the audit runs was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description One of the audit runs is not ready. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The audit runs cannot be compared. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          after?: number;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description A Server-Sent Events stream of durable run events. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "text/event-stream": string;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/evidence": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          limit?: number;
          offset?: number;
          search?: string;
          section?: "crawl" | "redirects" | "hreflang" | "extractions";
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  generatedAt: string | null;
                  items: (
                    | {
                        crawlDepth: number | null;
                        discoveredFrom: string | null;
                        /** Format: uri */
                        finalUrl: string;
                        indexable: boolean | null;
                        /** @enum {string} */
                        kind: "crawl";
                        /** Format: uri */
                        sourceUrl: string;
                        statusCode: number | null;
                        title: string | null;
                      }
                    | {
                        chain: string[];
                        finalStatusCode: number | null;
                        /** Format: uri */
                        finalUrl: string;
                        hopCount: number;
                        /** @enum {string} */
                        kind: "redirect";
                        /** Format: uri */
                        sourceUrl: string;
                      }
                    | {
                        alternates: {
                          declaredUrl: string;
                          expectedReturnLanguage: string | null;
                          lang: string;
                          observedReturnLanguages: string[];
                          reciprocal:
                            | "matched"
                            | "missing"
                            | "language_mismatch"
                            | "not_applicable"
                            | "unavailable";
                          resolvedUrl: string | null;
                          selfReference: boolean;
                          targetState:
                            "self" | "crawled" | "not_crawled" | "invalid";
                          targetStatusCode: number | null;
                        }[];
                        /** Format: uri */
                        finalUrl: string;
                        hasXDefault: boolean;
                        htmlLang: string | null;
                        /** @enum {string} */
                        kind: "hreflang";
                        selfLanguage: string | null;
                        /** Format: uri */
                        sourceUrl: string;
                      }
                    | {
                        fields: {
                          label: string;
                          truncated: boolean;
                          value: string | null;
                        }[];
                        /** Format: uri */
                        finalUrl: string;
                        /** @enum {string} */
                        kind: "extraction";
                        /** Format: uri */
                        sourceUrl: string;
                      }
                  )[];
                  pageInfo: {
                    limit: number;
                    nextOffset: number | null;
                    offset: number;
                    total: number;
                  };
                  runId: string;
                  section: "crawl" | "redirects" | "hreflang" | "extractions";
                  sitemap: {
                    brokenDeclared: {
                      complete: boolean;
                      total: number | null;
                      urls: string[];
                    };
                    coverage: number | null;
                    declaredNotCrawled: {
                      complete: boolean;
                      total: number | null;
                      urls: string[];
                    };
                    declaredUrls: number | null;
                    discoveredIndexableUrls: number | null;
                    fetchStatusCode: number | null;
                    files: {
                      kind: "urlset" | "sitemapindex" | "unknown";
                      locCount: number;
                      statusCode: number | null;
                      /** Format: uri */
                      url: string;
                    }[];
                    matchedIndexableUrls: number | null;
                    missingIndexable: {
                      complete: boolean;
                      total: number | null;
                      urls: string[];
                    };
                    sourceUrl: string | null;
                    state:
                      | "available"
                      | "not_found"
                      | "fetch_failed"
                      | "invalid"
                      | "not_captured";
                    warnings: string[];
                  };
                  state: "available" | "partial" | "unavailable";
                  warnings: string[];
                }
              | {
                  data: {
                    generatedAt: string | null;
                    items: (
                      | {
                          crawlDepth: number | null;
                          discoveredFrom: string | null;
                          /** Format: uri */
                          finalUrl: string;
                          indexable: boolean | null;
                          /** @enum {string} */
                          kind: "crawl";
                          /** Format: uri */
                          sourceUrl: string;
                          statusCode: number | null;
                          title: string | null;
                        }
                      | {
                          chain: string[];
                          finalStatusCode: number | null;
                          /** Format: uri */
                          finalUrl: string;
                          hopCount: number;
                          /** @enum {string} */
                          kind: "redirect";
                          /** Format: uri */
                          sourceUrl: string;
                        }
                      | {
                          alternates: {
                            declaredUrl: string;
                            expectedReturnLanguage: string | null;
                            lang: string;
                            observedReturnLanguages: string[];
                            reciprocal:
                              | "matched"
                              | "missing"
                              | "language_mismatch"
                              | "not_applicable"
                              | "unavailable";
                            resolvedUrl: string | null;
                            selfReference: boolean;
                            targetState:
                              "self" | "crawled" | "not_crawled" | "invalid";
                            targetStatusCode: number | null;
                          }[];
                          /** Format: uri */
                          finalUrl: string;
                          hasXDefault: boolean;
                          htmlLang: string | null;
                          /** @enum {string} */
                          kind: "hreflang";
                          selfLanguage: string | null;
                          /** Format: uri */
                          sourceUrl: string;
                        }
                      | {
                          fields: {
                            label: string;
                            truncated: boolean;
                            value: string | null;
                          }[];
                          /** Format: uri */
                          finalUrl: string;
                          /** @enum {string} */
                          kind: "extraction";
                          /** Format: uri */
                          sourceUrl: string;
                        }
                    )[];
                    pageInfo: {
                      limit: number;
                      nextOffset: number | null;
                      offset: number;
                      total: number;
                    };
                    runId: string;
                    section: "crawl" | "redirects" | "hreflang" | "extractions";
                    sitemap: {
                      brokenDeclared: {
                        complete: boolean;
                        total: number | null;
                        urls: string[];
                      };
                      coverage: number | null;
                      declaredNotCrawled: {
                        complete: boolean;
                        total: number | null;
                        urls: string[];
                      };
                      declaredUrls: number | null;
                      discoveredIndexableUrls: number | null;
                      fetchStatusCode: number | null;
                      files: {
                        kind: "urlset" | "sitemapindex" | "unknown";
                        locCount: number;
                        statusCode: number | null;
                        /** Format: uri */
                        url: string;
                      }[];
                      matchedIndexableUrls: number | null;
                      missingIndexable: {
                        complete: boolean;
                        total: number | null;
                        urls: string[];
                      };
                      sourceUrl: string | null;
                      state:
                        | "available"
                        | "not_found"
                        | "fetch_failed"
                        | "invalid"
                        | "not_captured";
                      warnings: string[];
                    };
                    state: "available" | "partial" | "unavailable";
                    warnings: string[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/issues": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              canonicalUrl: string | null;
              description: string;
              evidence: {
                kind: string;
                label: string;
                /** Format: date-time */
                observedAt?: string;
                source?: string;
                value?: unknown;
              }[];
              fingerprint: string;
              /** Format: date-time */
              firstSeenAt: string;
              /** Format: date-time */
              lastSeenAt: string;
              moduleId: string;
              ruleId: string;
              severity: "critical" | "high" | "medium" | "low" | "info";
              status: "open" | "resolved" | "ignored" | "false_positive";
              title: string;
            }[];
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/links": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          direction?: "inlinks" | "outlinks";
          limit?: number;
          offset?: number;
          pageUrl: string;
          search?: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  direction: "inlinks" | "outlinks";
                  generatedAt: string | null;
                  items: {
                    anchorTexts: string[];
                    followOccurrences: number;
                    nofollowOccurrences: number;
                    occurrences: number;
                    placements: (
                      | "header"
                      | "navigation"
                      | "main"
                      | "aside"
                      | "footer"
                      | "body"
                    )[];
                    sourceTitle: string | null;
                    /** Format: uri */
                    sourceUrl: string;
                    targetIndexable: boolean | null;
                    targetPageUrl: string | null;
                    targetState:
                      "direct" | "redirected" | "broken" | "uncrawled";
                    targetStatusCode: number | null;
                    targetTitle: string | null;
                    /** Format: uri */
                    targetUrl: string;
                  }[];
                  page: {
                    crawlDepth: number | null;
                    indexable: boolean | null;
                    statusCode: number | null;
                    title: string | null;
                    /** Format: uri */
                    url: string;
                  };
                  pageInfo: {
                    limit: number;
                    nextOffset: number | null;
                    offset: number;
                    total: number;
                  };
                  runId: string;
                  state: "available" | "partial" | "unavailable";
                  summary: {
                    brokenOutlinkTargets: number;
                    followedInlinkOccurrences: number;
                    followedOutlinkOccurrences: number;
                    inlinkOccurrences: number;
                    inlinkSources: number;
                    nofollowInlinkOccurrences: number;
                    nofollowOutlinkOccurrences: number;
                    outlinkOccurrences: number;
                    outlinkTargets: number;
                    redirectedOutlinkTargets: number;
                    uncrawledOutlinkTargets: number;
                  };
                  /** @enum {string} */
                  version: "link-graph-v1";
                  warnings: string[];
                }
              | {
                  data: {
                    direction: "inlinks" | "outlinks";
                    generatedAt: string | null;
                    items: {
                      anchorTexts: string[];
                      followOccurrences: number;
                      nofollowOccurrences: number;
                      occurrences: number;
                      placements: (
                        | "header"
                        | "navigation"
                        | "main"
                        | "aside"
                        | "footer"
                        | "body"
                      )[];
                      sourceTitle: string | null;
                      /** Format: uri */
                      sourceUrl: string;
                      targetIndexable: boolean | null;
                      targetPageUrl: string | null;
                      targetState:
                        "direct" | "redirected" | "broken" | "uncrawled";
                      targetStatusCode: number | null;
                      targetTitle: string | null;
                      /** Format: uri */
                      targetUrl: string;
                    }[];
                    page: {
                      crawlDepth: number | null;
                      indexable: boolean | null;
                      statusCode: number | null;
                      title: string | null;
                      /** Format: uri */
                      url: string;
                    };
                    pageInfo: {
                      limit: number;
                      nextOffset: number | null;
                      offset: number;
                      total: number;
                    };
                    runId: string;
                    state: "available" | "partial" | "unavailable";
                    summary: {
                      brokenOutlinkTargets: number;
                      followedInlinkOccurrences: number;
                      followedOutlinkOccurrences: number;
                      inlinkOccurrences: number;
                      inlinkSources: number;
                      nofollowInlinkOccurrences: number;
                      nofollowOutlinkOccurrences: number;
                      outlinkOccurrences: number;
                      outlinkTargets: number;
                      redirectedOutlinkTargets: number;
                      uncrawledOutlinkTargets: number;
                    };
                    /** @enum {string} */
                    version: "link-graph-v1";
                    warnings: string[];
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The run or selected page was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The audit link graph is not ready. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The link explorer request is invalid. */
        422: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/replay": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: {
          "idempotency-key": string;
          "x-marketingovo-client"?: "dashboard";
        };
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json":
              | {
                  configurationHash: string;
                  /** @enum {number} */
                  configurationVersion: 1;
                  run: {
                    completedAt: string | null;
                    error: string | null;
                    id: string;
                    issueCount: number;
                    progress: number;
                    projectId: string;
                    /** Format: date-time */
                    requestedAt: string;
                    startedAt: string | null;
                    status:
                      | "queued"
                      | "running"
                      | "succeeded"
                      | "partial"
                      | "failed"
                      | "cancelled";
                    workflowId: string;
                  };
                  sourceRunId: string;
                }
              | {
                  data: {
                    configurationHash: string;
                    /** @enum {number} */
                    configurationVersion: 1;
                    run: {
                      completedAt: string | null;
                      healthScore: number | null;
                      id: string;
                      issuesFound: number;
                      message: string | null;
                      pagesCrawled: number | null;
                      progress: number;
                      /** Format: date-time */
                      startedAt: string;
                      status:
                        | "queued"
                        | "running"
                        | "completed"
                        | "partial"
                        | "failed"
                        | "cancelled";
                      /** @enum {string} */
                      trigger: "manual";
                      workflowId: string;
                    };
                    sourceRunId: string;
                  };
                  meta: {
                    /** Format: date-time */
                    generatedAt: string;
                    state:
                      "fresh" | "stale" | "missing" | "unavailable" | "unknown";
                    warnings: string[];
                  };
                };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The source run was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The source run has not finished or its workflow is unavailable. */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/runs/{id}/report": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          format?: "html" | "pdf" | "csv" | "json";
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The generated report artifact. */
        200: {
          headers: {
            /** @description Attachment filename for the report. */
            "content-disposition"?: unknown;
            [name: string]: unknown;
          };
          content: {
            "application/json": string;
            "application/pdf": string;
            "text/csv": string;
            "text/html": string;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The report was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/schedules": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          projectId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** Format: date-time */
              createdAt: string;
              cron: string;
              enabled: boolean;
              id: string;
              /** Format: date-time */
              nextRunAt: string;
              options?: {
                [key: string]: unknown;
              };
              projectId: string;
              timezone: string;
              /** Format: date-time */
              updatedAt: string;
              workflowId?: string;
            }[];
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            cron: string;
            enabled: boolean;
            /** Format: date-time */
            nextRunAt?: string;
            projectId: string;
            timezone: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** Format: date-time */
              createdAt: string;
              cron: string;
              enabled: boolean;
              id: string;
              /** Format: date-time */
              nextRunAt: string;
              options?: {
                [key: string]: unknown;
              };
              projectId: string;
              timezone: string;
              /** Format: date-time */
              updatedAt: string;
              workflowId?: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The project was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/schedules/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description The schedule was deleted. */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": unknown;
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The schedule was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            cron?: string;
            enabled?: boolean;
            /** Format: date-time */
            nextRunAt?: string;
            timezone?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** Format: date-time */
              createdAt: string;
              cron: string;
              enabled: boolean;
              id: string;
              /** Format: date-time */
              nextRunAt: string;
              options?: {
                [key: string]: unknown;
              };
              projectId: string;
              timezone: string;
              /** Format: date-time */
              updatedAt: string;
              workflowId?: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The schedule was not found. */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    trace?: never;
  };
  "/api/v1/session": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              csrf: string;
              /** Format: date-time */
              expiresAt: string;
            };
          };
        };
        /** @description The request is invalid. */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description Authentication is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request failed CSRF or authorization checks. */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The local service could not complete the request. */
        500: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/session/bootstrap": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            token: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              csrf: string;
              /** Format: date-time */
              expiresAt: string;
            };
          };
        };
        /** @description The bootstrap ticket is invalid or expired. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/session/bootstrap-token": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/json": {
              /** Format: date-time */
              expiresAt: string;
              token: string;
            };
          };
        };
        /** @description A valid local service token is required. */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
        /** @description The request Host header is not accepted. */
        421: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            "application/problem+json": {
              code?: string;
              detail?: string;
              instance?: string;
              status: number;
              title: string;
              /** Format: uri-reference */
              type: string;
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/settings": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          "application/json": {
            alertEmail?: string | "" | null;
            dataRetentionDays?: number | null;
            reportingCurrency?: string | "" | null;
            siteName?: string;
            siteUrl?: string | "" | null;
            timezone?: string | null;
            weeklyDigest?: boolean;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    trace?: never;
  };
  "/api/v1/sites": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/system/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
