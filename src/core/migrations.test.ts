import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import { applyMigrations, type Migration } from "./migrations.js";

describe("applyMigrations", () => {
  test("returns applied migration ids in order on first run", () => {
    const db = new DatabaseSync(":memory:");
    const migrations: Migration[] = [
      { id: "a", up: "CREATE TABLE a1 (x INTEGER)" },
      { id: "b", up: "CREATE TABLE b1 (x INTEGER)" },
    ];
    const applied = applyMigrations(db, migrations);
    expect(applied).toEqual(["a", "b"]);
    db.close();
  });

  test("idempotent — second run is a no-op", () => {
    const db = new DatabaseSync(":memory:");
    const migrations: Migration[] = [
      { id: "a", up: "CREATE TABLE a1 (x INTEGER)" },
    ];
    applyMigrations(db, migrations);
    const second = applyMigrations(db, migrations);
    expect(second).toEqual([]);
    db.close();
  });

  test("rolls back failed migration without applying its work or marking it applied", () => {
    const db = new DatabaseSync(":memory:");
    const migrations: Migration[] = [
      {
        id: "001_good",
        up: "CREATE TABLE good (x INTEGER)",
      },
      {
        id: "002_broken",
        up: `
          CREATE TABLE bad (x INTEGER);
          CREATE TABLE bad (x INTEGER);
        `,
      },
    ];

    expect(() => applyMigrations(db, migrations)).toThrow();

    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);

    expect(tables).toContain("good");
    expect(tables).not.toContain("bad");

    const applied = (
      db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]
    ).map((r) => r.id);
    expect(applied).toEqual(["001_good"]);

    db.close();
  });

  test("after a rollback, fixing the migration and re-running picks up where it left off", () => {
    const db = new DatabaseSync(":memory:");
    const broken: Migration[] = [
      { id: "001_good", up: "CREATE TABLE good (x INTEGER)" },
      {
        id: "002_broken",
        up: "CREATE TABLE bad (x INTEGER); CREATE TABLE bad (x INTEGER);",
      },
    ];
    expect(() => applyMigrations(db, broken)).toThrow();

    const fixed: Migration[] = [
      { id: "001_good", up: "CREATE TABLE good (x INTEGER)" },
      { id: "002_broken", up: "CREATE TABLE bad (x INTEGER)" },
    ];
    const applied = applyMigrations(db, fixed);
    expect(applied).toEqual(["002_broken"]);

    db.close();
  });
});
