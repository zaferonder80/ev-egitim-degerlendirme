import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const userRoles = ["ADMIN", "EVALUATOR"] as const;
export const trainingStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const assignmentStatuses = ["PENDING", "DRAFT", "COMPLETED", "OVERDUE", "REOPENED"] as const;
export const evaluationStatuses = ["DRAFT", "COMPLETED"] as const;
export const successStatuses = ["SUCCESSFUL", "UNSUCCESSFUL"] as const;

export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  openId: text("openId", { length: 100 }).notNull().unique(),
  firstName: text("firstName", { length: 100 }).notNull(),
  lastName: text("lastName", { length: 100 }).notNull(),
  name: text("name", { length: 201 }),
  email: text("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash", { length: 255 }).notNull(),
  loginMethod: text("loginMethod", { length: 64 }).default("password").notNull(),
  role: text("role", { enum: userRoles }).default("EVALUATOR").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  mustChangePassword: integer("mustChangePassword", { mode: "boolean" }).default(true).notNull(),
  failedLoginAttempts: integer("failedLoginAttempts").default(0).notNull(),
  lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
  lastLoginAt: integer("lastLoginAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).defaultNow().notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress", { length: 64 }),
    userAgent: text("userAgent", { length: 512 }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [index("idx_sessions_user").on(table.userId), index("idx_sessions_expiry").on(table.expiresAt)],
);

export const criteria = sqliteTable("criteria", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  orderNumber: integer("orderNumber").notNull().unique(),
  name: text("name", { length: 500 }).notNull(),
  description: text("description"),
  controlPoints: text("controlPoints", { mode: "json" }).$type<string[]>().notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
});

export const evaluationSets = sqliteTable("evaluationSets", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name", { length: 200 }).notNull(),
  description: text("description"),
  rubricScale: text("rubricScale", { mode: "json" }).$type<Record<string, string>>().notNull(),
  passingScore: real("passingScore").default(70).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
});

export const evaluationSetCriteria = sqliteTable(
  "evaluationSetCriteria",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    evaluationSetId: integer("evaluationSetId").notNull().references(() => evaluationSets.id, { onDelete: "cascade" }),
    criterionId: integer("criterionId").notNull().references(() => criteria.id, { onDelete: "cascade" }),
    weight: real("weight").notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("uq_evaluation_set_criterion").on(table.evaluationSetId, table.criterionId),
    index("idx_evaluation_set_criteria_set").on(table.evaluationSetId),
  ],
);

export const trainings = sqliteTable(
  "trainings",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    code: text("code", { length: 64 }).notNull().unique(),
    title: text("title", { length: 300 }).notNull(),
    description: text("description"),
    trainingType: text("trainingType", { length: 120 }),
    targetAudience: text("targetAudience", { length: 500 }),
    learningObjectives: text("learningObjectives"),
    durationMinutes: integer("durationMinutes"),
    contentOwner: text("contentOwner", { length: 200 }),
    trainingUrl: text("trainingUrl", { length: 2048 }),
    fileUrl: text("fileUrl", { length: 2048 }),
    imageUrl: text("imageUrl", { length: 2048 }),
    version: text("version", { length: 64 }).default("1.0").notNull(),
    publishDate: integer("publishDate", { mode: "timestamp_ms" }),
    lastUpdatedDate: integer("lastUpdatedDate", { mode: "timestamp_ms" }),
    evaluationStartDate: integer("evaluationStartDate", { mode: "timestamp_ms" }),
    evaluationEndDate: integer("evaluationEndDate", { mode: "timestamp_ms" }),
    status: text("status", { enum: trainingStatuses }).default("DRAFT").notNull(),
    createdById: integer("createdById").notNull().references(() => users.id),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [index("idx_training_status").on(table.status), index("idx_training_dates").on(table.evaluationEndDate)],
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    trainingId: integer("trainingId").notNull().references(() => trainings.id, { onDelete: "cascade" }),
    evaluatorId: integer("evaluatorId").notNull().references(() => users.id),
    evaluationSetId: integer("evaluationSetId").references(() => evaluationSets.id, { onDelete: "set null" }),
    assignedById: integer("assignedById").notNull().references(() => users.id),
    assignedAt: integer("assignedAt", { mode: "timestamp_ms" }).notNull(),
    dueDate: integer("dueDate", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: assignmentStatuses }).default("PENDING").notNull(),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
    reopenedAt: integer("reopenedAt", { mode: "timestamp_ms" }),
    reopenedById: integer("reopenedById").references(() => users.id),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex("uq_assignment_training_evaluator_set").on(table.trainingId, table.evaluatorId, table.evaluationSetId),
    index("idx_assignment_evaluator_status").on(table.evaluatorId, table.status),
    index("idx_assignment_due").on(table.dueDate),
  ],
);

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    assignmentId: integer("assignmentId").notNull().unique().references(() => assignments.id, { onDelete: "cascade" }),
    evaluatorId: integer("evaluatorId").notNull().references(() => users.id),
    trainingId: integer("trainingId").notNull().references(() => trainings.id, { onDelete: "cascade" }),
    status: text("status", { enum: evaluationStatuses }).default("DRAFT").notNull(),
    generalComment: text("generalComment"),
    totalScore: integer("totalScore"),
    averageScore: real("averageScore"),
    successPercentage: real("successPercentage"),
    successStatus: text("successStatus", { enum: successStatuses }),
    submittedAt: integer("submittedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [index("idx_evaluation_training_status").on(table.trainingId, table.status)],
);

export const evaluationResponses = sqliteTable(
  "evaluationResponses",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    evaluationId: integer("evaluationId").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    criterionId: integer("criterionId").notNull().references(() => criteria.id),
    score: integer("score").notNull(),
    comment: text("comment"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [uniqueIndex("uq_response_evaluation_criterion").on(table.evaluationId, table.criterionId)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { length: 64 }).notNull(),
    title: text("title", { length: 300 }).notNull(),
    message: text("message").notNull(),
    link: text("link", { length: 500 }),
    relatedEntityType: text("relatedEntityType", { length: 64 }),
    relatedEntityId: integer("relatedEntityId"),
    isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [index("idx_notification_user_read").on(table.userId, table.isRead)],
);

export const auditLogs = sqliteTable(
  "auditLogs",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: integer("userId").references(() => users.id),
    action: text("action", { length: 120 }).notNull(),
    entityType: text("entityType", { length: 80 }).notNull(),
    entityId: integer("entityId"),
    oldValue: text("oldValue", { mode: "json" }),
    newValue: text("newValue", { mode: "json" }),
    ipAddress: text("ipAddress", { length: 64 }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).defaultNow().notNull(),
  },
  table => [index("idx_audit_entity").on(table.entityType, table.entityId), index("idx_audit_created").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type EvaluationSet = typeof evaluationSets.$inferSelect;
export type InsertEvaluationSet = typeof evaluationSets.$inferInsert;
export type EvaluationSetCriterion = typeof evaluationSetCriteria.$inferSelect;
export type Training = typeof trainings.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
