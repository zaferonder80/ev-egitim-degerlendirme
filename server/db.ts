import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  assignments,
  criteria,
  evaluationSetCriteria,
  evaluationSets,
  sessions,
  users,
  type InsertUser,
} from "../drizzle/schema";
import { DEFAULT_CRITERIA } from "./defaultCriteria";
import { DEFAULT_EVALUATION_SETS } from "./defaultEvaluationSets";

const sqliteFile = process.env.DATABASE_URL ?? "./data/app.db";

const normalizedSqlitePath = sqliteFile.startsWith("file:")
  ? new URL(sqliteFile).pathname
  : sqliteFile;

if (!normalizedSqlitePath.startsWith(":memory:")) {
  const directory = path.dirname(normalizedSqlitePath);
  fs.mkdirSync(directory, { recursive: true });
}

function ensureSqliteSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      name TEXT,
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

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      controlPoints TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS evaluationSets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rubricScale TEXT NOT NULL,
      passingScore REAL NOT NULL DEFAULT 70,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS evaluationSetCriteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluationSetId INTEGER NOT NULL,
      criterionId INTEGER NOT NULL,
      weight REAL NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(evaluationSetId, criterionId),
      FOREIGN KEY (evaluationSetId) REFERENCES evaluationSets(id) ON DELETE CASCADE,
      FOREIGN KEY (criterionId) REFERENCES criteria(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trainings (
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
      evaluationEndDate INTEGER,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      createdById INTEGER NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (createdById) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
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
      UNIQUE(trainingId, evaluatorId, evaluationSetId),
      FOREIGN KEY (trainingId) REFERENCES trainings(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluatorId) REFERENCES users(id),
      FOREIGN KEY (evaluationSetId) REFERENCES evaluationSets(id) ON DELETE SET NULL,
      FOREIGN KEY (assignedById) REFERENCES users(id),
      FOREIGN KEY (reopenedById) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignmentId INTEGER NOT NULL UNIQUE,
      evaluatorId INTEGER NOT NULL,
      trainingId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      generalComment TEXT,
      totalScore INTEGER,
      averageScore REAL,
      successPercentage REAL,
      successStatus TEXT,
      submittedAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (assignmentId) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluatorId) REFERENCES users(id),
      FOREIGN KEY (trainingId) REFERENCES trainings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluationResponses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluationId INTEGER NOT NULL,
      criterionId INTEGER NOT NULL,
      score INTEGER NOT NULL,
      comment TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(evaluationId, criterionId),
      FOREIGN KEY (evaluationId) REFERENCES evaluations(id) ON DELETE CASCADE,
      FOREIGN KEY (criterionId) REFERENCES criteria(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      relatedEntityType TEXT,
      relatedEntityId INTEGER,
      isRead INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId INTEGER,
      oldValue TEXT,
      newValue TEXT,
      ipAddress TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expiresAt);
    CREATE INDEX IF NOT EXISTS idx_training_status ON trainings (status);
    CREATE INDEX IF NOT EXISTS idx_training_dates ON trainings (evaluationEndDate);
    CREATE INDEX IF NOT EXISTS idx_assignment_evaluator_status ON assignments (evaluatorId, status);
    CREATE INDEX IF NOT EXISTS idx_assignment_due ON assignments (dueDate);
    CREATE INDEX IF NOT EXISTS idx_evaluation_training_status ON evaluations (trainingId, status);
    CREATE INDEX IF NOT EXISTS idx_notification_user_read ON notifications (userId, isRead);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON auditLogs (entityType, entityId);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON auditLogs (createdAt);
  `);
}

let _db: ReturnType<typeof drizzle> | null = null;

export { assignments };

export async function getDb() {
  if (!_db) {
    const sqlite = new Database(normalizedSqlitePath);
    sqlite.pragma("foreign_keys = ON");
    ensureSqliteSchema(sqlite);
    _db = drizzle(sqlite);

    const existingCriteria = await _db.select().from(criteria).limit(1);
    if (existingCriteria.length === 0) {
      await _db.insert(criteria).values(
        DEFAULT_CRITERIA.map((criterion, index) => ({
          orderNumber: index + 1,
          name: criterion.name,
          description: criterion.description,
          controlPoints: criterion.controlPoints,
          isActive: true,
        }))
      );
    }

    const evaluationSetColumns = sqlite.prepare("PRAGMA table_info(evaluationSets)").all() as Array<{ name: string }>;
    if (!evaluationSetColumns.some(column => column.name === "passingScore")) {
      sqlite.exec("ALTER TABLE evaluationSets ADD COLUMN passingScore REAL NOT NULL DEFAULT 70;");
    }

    const assignmentColumns = sqlite.prepare("PRAGMA table_info(assignments)").all() as Array<{ name: string }>;
    if (!assignmentColumns.some(column => column.name === "evaluationSetId")) {
      sqlite.exec("ALTER TABLE assignments ADD COLUMN evaluationSetId INTEGER REFERENCES evaluationSets(id) ON DELETE SET NULL;");
    }

    const hasAssignmentsTable = Boolean(
      sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assignments'").get()
    );
    const hasLegacyTable = Boolean(
      sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assignments_legacy'")
        .get()
    );

    const assignmentSql = sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'assignments'")
      .get() as { sql: string } | undefined;
    const hasLegacyAssignmentConstraint = Boolean(
      assignmentSql?.sql?.includes("UNIQUE(trainingId, evaluatorId)") &&
      !assignmentSql.sql.includes("UNIQUE(trainingId, evaluatorId, evaluationSetId)")
    );

    if (hasLegacyTable) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS assignments_new (
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
          UNIQUE(trainingId, evaluatorId, evaluationSetId),
          FOREIGN KEY (trainingId) REFERENCES trainings(id) ON DELETE CASCADE,
          FOREIGN KEY (evaluatorId) REFERENCES users(id),
          FOREIGN KEY (evaluationSetId) REFERENCES evaluationSets(id) ON DELETE SET NULL,
          FOREIGN KEY (assignedById) REFERENCES users(id),
          FOREIGN KEY (reopenedById) REFERENCES users(id)
        );
        INSERT OR IGNORE INTO assignments_new (
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        )
        SELECT
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        FROM assignments_legacy;
        INSERT OR IGNORE INTO assignments_new (
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        )
        SELECT
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        FROM assignments;
        DROP TABLE assignments_legacy;
        DROP TABLE assignments;
        ALTER TABLE assignments_new RENAME TO assignments;
        PRAGMA foreign_keys = ON;
      `);
    } else if (hasLegacyAssignmentConstraint && hasAssignmentsTable) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        ALTER TABLE assignments RENAME TO assignments_legacy;
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
          UNIQUE(trainingId, evaluatorId, evaluationSetId),
          FOREIGN KEY (trainingId) REFERENCES trainings(id) ON DELETE CASCADE,
          FOREIGN KEY (evaluatorId) REFERENCES users(id),
          FOREIGN KEY (evaluationSetId) REFERENCES evaluationSets(id) ON DELETE SET NULL,
          FOREIGN KEY (assignedById) REFERENCES users(id),
          FOREIGN KEY (reopenedById) REFERENCES users(id)
        );
        INSERT INTO assignments (
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        )
        SELECT
          id, trainingId, evaluatorId, evaluationSetId, assignedById, assignedAt, dueDate, status, completedAt, reopenedAt, reopenedById, createdAt, updatedAt
        FROM assignments_legacy;
        DROP TABLE assignments_legacy;
        PRAGMA foreign_keys = ON;
      `);
    }

    const existingEvaluationSets = await _db.select().from(evaluationSets).limit(1);
    if (existingEvaluationSets.length === 0) {
      const criterionRows = await _db.select().from(criteria);
      const criterionMap = new Map(criterionRows.map(criterion => [criterion.name, criterion]));
      for (const setTemplate of DEFAULT_EVALUATION_SETS) {
        const setResult = await _db.insert(evaluationSets).values({
          name: setTemplate.name,
          description: setTemplate.description,
          rubricScale: setTemplate.rubricScale,
          passingScore: setTemplate.passingScore,
          isActive: true,
        });
        const setId = Number(setResult.lastInsertRowid ?? 0);
        const items = setTemplate.criteria.map(item => {
          const criterion = criterionMap.get(item.name);
          if (!criterion) return null;
          return {
            evaluationSetId: setId,
            criterionId: criterion.id,
            weight: item.weight,
            sortOrder: 0,
          };
        }).filter(Boolean) as Array<{ evaluationSetId: number; criterionId: number; weight: number; sortOrder: number }>;
        if (items.length > 0) {
          await _db.insert(evaluationSetCriteria).values(items);
        }
      }
    }
  }
  return _db;
}

/** Uyumluluk için korunur; uygulamanın e-posta/şifre hesabını günceller. */
export async function upsertUser(user: Partial<InsertUser> & Pick<InsertUser, "openId">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const generatedEmail = user.email ?? `oauth-${user.openId}@local.invalid`;
  const values: InsertUser = {
    openId: user.openId,
    firstName: user.firstName ?? "Sistem",
    lastName: user.lastName ?? "Kullanıcısı",
    name: user.name ?? "Sistem Kullanıcısı",
    email: generatedEmail,
    passwordHash: user.passwordHash ?? "!oauth-only!",
    loginMethod: user.loginMethod ?? "oauth",
    role: user.role ?? "EVALUATOR",
    isActive: user.isActive ?? true,
    mustChangePassword: user.mustChangePassword ?? true,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    lastLoginAt: user.lastLoginAt,
  };
  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.email,
    set: {
      name: values.name,
      email: values.email,
      lastSignedIn: user.lastSignedIn ?? new Date(),
      lastLoginAt: user.lastLoginAt ?? new Date(),
    },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getActiveSessionUser(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result[0] ?? null;
}
