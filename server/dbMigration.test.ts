import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assignments } from "../drizzle/schema";

describe("assignment schema migration", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  it("legacy training+evaluator unique constraint is migrated to training+evaluator+set", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-set-migration-"));
    const dbPath = path.join(tempDir, "legacy.db");

    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openId TEXT NOT NULL UNIQUE,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        loginMethod TEXT NOT NULL DEFAULT 'password',
        role TEXT NOT NULL DEFAULT 'EVALUATOR',
        isActive INTEGER NOT NULL DEFAULT 1,
        mustChangePassword INTEGER NOT NULL DEFAULT 1,
        failedLoginAttempts INTEGER NOT NULL DEFAULT 0,
        lockedUntil INTEGER,
        lastLoginAt INTEGER,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        lastSignedIn INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        trainingType TEXT,
        targetAudience TEXT,
        learningObjectives TEXT,
        durationMinutes INTEGER,
        contentOwner TEXT,
        trainingUrl TEXT,
        fileUrl TEXT,
        imageUrl TEXT,
        version TEXT NOT NULL DEFAULT '1.0',
        publishDate INTEGER,
        lastUpdatedDate INTEGER,
        evaluationStartDate INTEGER,
        evaluationEndDate INTEGER,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        createdById INTEGER NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE evaluationSets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        rubricScale TEXT NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainingId INTEGER NOT NULL,
        evaluatorId INTEGER NOT NULL,
        evaluationSetId INTEGER,
        assignedById INTEGER NOT NULL,
        assignedAt INTEGER NOT NULL,
        dueDate INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        completedAt INTEGER,
        reopenedAt INTEGER,
        reopenedById INTEGER,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        UNIQUE(trainingId, evaluatorId)
      );

      INSERT INTO users (openId, firstName, lastName, email, passwordHash, loginMethod, role, isActive, mustChangePassword, failedLoginAttempts, lastSignedIn, lastLoginAt, createdAt, updatedAt)
      VALUES ('user-1', 'Test', 'User', 'test@example.com', 'hash', 'password', 'EVALUATOR', 1, 0, 0, 0, 0, 0, 0);

      INSERT INTO evaluationSets (id, name, rubricScale, isActive, createdAt, updatedAt)
      VALUES (10, 'Set A', '5', 1, 0, 0), (20, 'Set B', '5', 1, 0, 0);

      INSERT INTO trainings (code, title, version, status, createdById, createdAt, updatedAt)
      VALUES ('T-001', 'Test Training', '1.0', 'ACTIVE', 1, 0, 0);
    `);
    sqlite.close();

    process.env.DATABASE_URL = dbPath;

    const { getDb } = await import("./db");
    const db = await getDb();

    await expect(
      db.insert(assignments).values({
        trainingId: 1,
        evaluatorId: 1,
        evaluationSetId: 10,
        assignedById: 1,
        assignedAt: new Date(),
        dueDate: new Date(Date.now() + 86400000),
        status: "PENDING",
      })
    ).resolves.toBeDefined();

    await expect(
      db.insert(assignments).values({
        trainingId: 1,
        evaluatorId: 1,
        evaluationSetId: 20,
        assignedById: 1,
        assignedAt: new Date(),
        dueDate: new Date(Date.now() + 86400000),
        status: "PENDING",
      })
    ).resolves.toBeDefined();

    await expect(
      db.insert(assignments).values({
        trainingId: 1,
        evaluatorId: 1,
        evaluationSetId: 10,
        assignedById: 1,
        assignedAt: new Date(),
        dueDate: new Date(Date.now() + 86400000),
        status: "PENDING",
      })
    ).rejects.toThrow();
  });

  it("partial legacy migration is repaired when only assignments_legacy remains", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-set-migration-"));
    const dbPath = path.join(tempDir, "legacy-partial.db");

    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openId TEXT NOT NULL UNIQUE,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        loginMethod TEXT NOT NULL DEFAULT 'password',
        role TEXT NOT NULL DEFAULT 'EVALUATOR',
        isActive INTEGER NOT NULL DEFAULT 1,
        mustChangePassword INTEGER NOT NULL DEFAULT 1,
        failedLoginAttempts INTEGER NOT NULL DEFAULT 0,
        lockedUntil INTEGER,
        lastLoginAt INTEGER,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        lastSignedIn INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        trainingType TEXT,
        targetAudience TEXT,
        learningObjectives TEXT,
        durationMinutes INTEGER,
        contentOwner TEXT,
        trainingUrl TEXT,
        fileUrl TEXT,
        imageUrl TEXT,
        version TEXT NOT NULL DEFAULT '1.0',
        publishDate INTEGER,
        lastUpdatedDate INTEGER,
        evaluationStartDate INTEGER,
        evaluationEndDate INTEGER,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        createdById INTEGER NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE evaluationSets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        rubricScale TEXT NOT NULL,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE TABLE assignments_legacy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainingId INTEGER NOT NULL,
        evaluatorId INTEGER NOT NULL,
        evaluationSetId INTEGER,
        assignedById INTEGER NOT NULL,
        assignedAt INTEGER NOT NULL,
        dueDate INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        completedAt INTEGER,
        reopenedAt INTEGER,
        reopenedById INTEGER,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        UNIQUE(trainingId, evaluatorId)
      );

      INSERT INTO users (openId, firstName, lastName, email, passwordHash, loginMethod, role, isActive, mustChangePassword, failedLoginAttempts, lastSignedIn, lastLoginAt, createdAt, updatedAt)
      VALUES ('user-2', 'Partial', 'Migration', 'partial@example.com', 'hash', 'password', 'EVALUATOR', 1, 0, 0, 0, 0, 0, 0);

      INSERT INTO evaluationSets (id, name, rubricScale, isActive, createdAt, updatedAt)
      VALUES (99, 'Set C', '5', 1, 0, 0);

      INSERT INTO trainings (code, title, version, status, createdById, createdAt, updatedAt)
      VALUES ('T-002', 'Legacy Training', '1.0', 'ACTIVE', 1, 0, 0);

      INSERT INTO assignments_legacy (trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, createdAt, updatedAt)
      VALUES (1, 1, 99, 1, 0, 86400000, 'PENDING', 0, 0);
    `);
    sqlite.close();

    process.env.DATABASE_URL = dbPath;

    const { getDb } = await import("./db");
    const db = await getDb();

    const rows = await db.select().from(assignments);
    expect(rows).toHaveLength(1);
    expect(rows[0].evaluationSetId).toBe(99);
  });
});
