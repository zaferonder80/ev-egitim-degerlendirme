import {
  boolean,
  datetime,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = ["ADMIN", "EVALUATOR"] as const;
export const trainingStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const assignmentStatuses = ["PENDING", "DRAFT", "COMPLETED", "OVERDUE", "REOPENED"] as const;
export const evaluationStatuses = ["DRAFT", "COMPLETED"] as const;
export const successStatuses = ["SUCCESSFUL", "UNSUCCESSFUL"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 100 }).notNull().unique(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  name: varchar("name", { length: 201 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }).default("password").notNull(),
  role: mysqlEnum("role", userRoles).default("EVALUATOR").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: datetime("lockedUntil", { mode: "date" }),
  lastLoginAt: datetime("lastLoginAt", { mode: "date" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: datetime("expiresAt", { mode: "date" }).notNull(),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: varchar("userAgent", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("idx_sessions_user").on(table.userId), index("idx_sessions_expiry").on(table.expiresAt)],
);

export const criteria = mysqlTable("criteria", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: int("orderNumber").notNull().unique(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  controlPoints: json("controlPoints").$type<string[]>().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const trainings = mysqlTable(
  "trainings",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    trainingType: varchar("trainingType", { length: 120 }),
    targetAudience: varchar("targetAudience", { length: 500 }),
    learningObjectives: text("learningObjectives"),
    durationMinutes: int("durationMinutes"),
    contentOwner: varchar("contentOwner", { length: 200 }),
    trainingUrl: varchar("trainingUrl", { length: 2048 }),
    fileUrl: varchar("fileUrl", { length: 2048 }),
    imageUrl: varchar("imageUrl", { length: 2048 }),
    version: varchar("version", { length: 64 }).default("1.0").notNull(),
    publishDate: datetime("publishDate", { mode: "date" }),
    lastUpdatedDate: datetime("lastUpdatedDate", { mode: "date" }),
    evaluationStartDate: datetime("evaluationStartDate", { mode: "date" }),
    evaluationEndDate: datetime("evaluationEndDate", { mode: "date" }),
    status: mysqlEnum("status", trainingStatuses).default("DRAFT").notNull(),
    createdById: int("createdById").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("idx_training_status").on(table.status), index("idx_training_dates").on(table.evaluationEndDate)],
);

export const assignments = mysqlTable(
  "assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    trainingId: int("trainingId").notNull().references(() => trainings.id, { onDelete: "cascade" }),
    evaluatorId: int("evaluatorId").notNull().references(() => users.id),
    assignedById: int("assignedById").notNull().references(() => users.id),
    assignedAt: datetime("assignedAt", { mode: "date" }).notNull(),
    dueDate: datetime("dueDate", { mode: "date" }).notNull(),
    status: mysqlEnum("status", assignmentStatuses).default("PENDING").notNull(),
    completedAt: datetime("completedAt", { mode: "date" }),
    reopenedAt: datetime("reopenedAt", { mode: "date" }),
    reopenedById: int("reopenedById").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("uq_assignment_training_evaluator").on(table.trainingId, table.evaluatorId),
    index("idx_assignment_evaluator_status").on(table.evaluatorId, table.status),
    index("idx_assignment_due").on(table.dueDate),
  ],
);

export const evaluations = mysqlTable(
  "evaluations",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull().unique().references(() => assignments.id, { onDelete: "cascade" }),
    evaluatorId: int("evaluatorId").notNull().references(() => users.id),
    trainingId: int("trainingId").notNull().references(() => trainings.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", evaluationStatuses).default("DRAFT").notNull(),
    generalComment: text("generalComment"),
    totalScore: int("totalScore"),
    averageScore: double("averageScore"),
    successPercentage: double("successPercentage"),
    successStatus: mysqlEnum("successStatus", successStatuses),
    submittedAt: datetime("submittedAt", { mode: "date" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("idx_evaluation_training_status").on(table.trainingId, table.status)],
);

export const evaluationResponses = mysqlTable(
  "evaluationResponses",
  {
    id: int("id").autoincrement().primaryKey(),
    evaluationId: int("evaluationId").notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    criterionId: int("criterionId").notNull().references(() => criteria.id),
    score: int("score").notNull(),
    comment: text("comment"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("uq_response_evaluation_criterion").on(table.evaluationId, table.criterionId)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    message: text("message").notNull(),
    link: varchar("link", { length: 500 }),
    relatedEntityType: varchar("relatedEntityType", { length: 64 }),
    relatedEntityId: int("relatedEntityId"),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("idx_notification_user_read").on(table.userId, table.isRead)],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    oldValue: json("oldValue"),
    newValue: json("newValue"),
    ipAddress: varchar("ipAddress", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("idx_audit_entity").on(table.entityType, table.entityId), index("idx_audit_created").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Training = typeof trainings.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
