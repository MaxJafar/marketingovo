import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketingovoDatabase } from "./database.js";

function db() {
  const dir = mkdtempSync(join(tmpdir(), "marketingovo-rank-"));
  return new MarketingovoDatabase({ path: join(dir, "test.sqlite3") });
}

function seedKeyword(database: MarketingovoDatabase): string {
  const raw = (database as unknown as { db: any }).db;
  raw
    .prepare(
      `INSERT INTO projects (id, name, canonical_url, created_at, updated_at)
     VALUES ('p1','Test','https://example.com/','2026-07-01T00:00:00Z','2026-07-01T00:00:00Z')`,
    )
    .run();
  raw
    .prepare(
      `INSERT INTO tracked_keywords
       (id, project_id, keyword, locale, location, device, search_engine, created_at)
     VALUES ('k1','p1','running shoes','en-US','Austin, Texas','desktop','google','2026-07-01T00:00:00Z')`,
    )
    .run();
  return "k1";
}

function insertPosition(
  database: MarketingovoDatabase,
  row: Record<string, unknown>,
) {
  const raw = (database as unknown as { db: any }).db;
  raw
    .prepare(
      `INSERT INTO keyword_positions
       (id, keyword_id, observed_at, outcome, position, ranking_url,
        results_examined, provider, provider_cost, failure_reason)
     VALUES (@id,@keyword_id,@observed_at,@outcome,@position,@ranking_url,
             @results_examined,@provider,@provider_cost,@failure_reason)`,
    )
    .run({
      ranking_url: null,
      position: null,
      results_examined: null,
      failure_reason: null,
      ...row,
    });
}

describe("rank tracking schema", () => {
  it("stores the query context that makes a position reproducible", () => {
    const database = db();
    seedKeyword(database);
    const raw = (database as unknown as { db: any }).db;
    const row = raw.prepare("SELECT * FROM tracked_keywords").get();
    expect(row.locale).toBe("en-US");
    expect(row.device).toBe("desktop");
    expect(row.location).toBe("Austin, Texas");
    database.close();
  });

  it("accepts the three legitimate observation shapes", () => {
    const database = db();
    const keyword = seedKeyword(database);
    expect(() => {
      insertPosition(database, {
        id: "o1",
        keyword_id: keyword,
        observed_at: "2026-07-01T00:00:00Z",
        outcome: "ranked",
        position: 4,
        results_examined: 100,
        provider: "serpapi",
        provider_cost: "provider-reported",
      });
      insertPosition(database, {
        id: "o2",
        keyword_id: keyword,
        observed_at: "2026-07-02T00:00:00Z",
        outcome: "absent",
        results_examined: 100,
        provider: "serpapi",
        provider_cost: "provider-reported",
      });
      insertPosition(database, {
        id: "o3",
        keyword_id: keyword,
        observed_at: "2026-07-03T00:00:00Z",
        outcome: "unmeasured",
        provider: "serpapi",
        provider_cost: "not-reported",
        failure_reason: "timeout",
      });
    }).not.toThrow();
    database.close();
  });

  // The schema, not the calling code, is what guarantees an absence can never
  // be stored as a number.
  it("refuses an absence that carries a position", () => {
    const database = db();
    const keyword = seedKeyword(database);
    expect(() =>
      insertPosition(database, {
        id: "bad",
        keyword_id: keyword,
        observed_at: "2026-07-01T00:00:00Z",
        outcome: "absent",
        position: 101,
        results_examined: 100,
        provider: "serpapi",
        provider_cost: "free",
      }),
    ).toThrow();
    database.close();
  });

  it("refuses a ranked observation with no position or no examined depth", () => {
    const database = db();
    const keyword = seedKeyword(database);
    for (const row of [
      { outcome: "ranked", position: null, results_examined: 100 },
      { outcome: "ranked", position: 5, results_examined: null },
    ]) {
      expect(() =>
        insertPosition(database, {
          id: `bad-${row.position}-${row.results_examined}`,
          keyword_id: keyword,
          observed_at: `2026-07-0${Math.random()}`,
          provider: "serpapi",
          provider_cost: "free",
          ...row,
        }),
      ).toThrow();
    }
    database.close();
  });

  it("refuses position zero, which is never a real rank", () => {
    const database = db();
    const keyword = seedKeyword(database);
    expect(() =>
      insertPosition(database, {
        id: "zero",
        keyword_id: keyword,
        observed_at: "2026-07-01T00:00:00Z",
        outcome: "ranked",
        position: 0,
        results_examined: 100,
        provider: "serpapi",
        provider_cost: "free",
      }),
    ).toThrow();
    database.close();
  });

  it("keeps one observation per keyword per timestamp", () => {
    const database = db();
    const keyword = seedKeyword(database);
    insertPosition(database, {
      id: "a",
      keyword_id: keyword,
      observed_at: "2026-07-01T00:00:00Z",
      outcome: "ranked",
      position: 3,
      results_examined: 100,
      provider: "serpapi",
      provider_cost: "free",
    });
    expect(() =>
      insertPosition(database, {
        id: "b",
        keyword_id: keyword,
        observed_at: "2026-07-01T00:00:00Z",
        outcome: "ranked",
        position: 4,
        results_examined: 100,
        provider: "serpapi",
        provider_cost: "free",
      }),
    ).toThrow();
    database.close();
  });
});
