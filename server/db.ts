import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sessions, users, type InsertUser } from "../drizzle/schema";

const sqliteFile = process.env.DATABASE_URL ?? "./data/app.db";

const normalizedSqlitePath = sqliteFile.startsWith("file:")
  ? new URL(sqliteFile).pathname
  : sqliteFile;

if (!normalizedSqlitePath.startsWith(":memory:")) {
  const directory = path.dirname(normalizedSqlitePath);
  fs.mkdirSync(directory, { recursive: true });
}

function ensureSqliteSchema(sqlite: Database.Database) {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  const existing = new Set(tables.map(table => table.name));

  if (existing.has("users") && existing.has("sessions") && existing.has("criteria")) {
    return;
  }

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
      evaluationStartDate INTEGER,
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
      assignedById INTEGER NOT NULL,
      assignedAt INTEGER NOT NULL,
      dueDate INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      completedAt INTEGER,
      reopenedAt INTEGER,
      reopenedById INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      UNIQUE(trainingId, evaluatorId),
      FOREIGN KEY (trainingId) REFERENCES trainings(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluatorId) REFERENCES users(id),
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

export async function getDb() {
  if (!_db) {
    const sqlite = new Database(normalizedSqlitePath);
    sqlite.pragma("foreign_keys = ON");
    ensureSqliteSchema(sqlite);
    _db = drizzle(sqlite);
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
