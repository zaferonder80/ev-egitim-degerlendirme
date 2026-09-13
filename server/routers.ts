import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  assignments,
  auditLogs,
  criteria,
  evaluationResponses,
  evaluationSetCriteria,
  evaluationSets,
  evaluations,
  notifications,
  trainings,
  users,
} from "../drizzle/schema";
import {
  clearSessionCookie,
  createSession,
  loginWithPassword,
  setSessionCookie,
  setUserPassword,
  validateStrongPassword,
} from "./auth";
import { getDb } from "./db";
import { emailService } from "./emailService";
import {
  aggregateCompletedEvaluations,
  calculateEvaluationScores,
  calculateWeightedEvaluationScores,
} from "./evaluationMath";
import {
  createCriteriaChartData,
  filterActiveTrainingIds,
  filterDashboardRecordsForActiveTrainings,
} from "./dashboardChartData";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  trainingManagerProcedure,
} from "./_core/trpc";

const scoreScale = [1, 2, 3, 4, 5] as const;
function getRubricMaxScore(rubricScale?: Record<string, string> | null) {
  if (!rubricScale) return 5;

  const scores = Object.keys(rubricScale)
    .map(key => Number(key))
    .filter(value => Number.isInteger(value) && value > 0);

  return scores.length > 0 ? Math.max(...scores) : 5;
}
const trainingStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const assignmentStatus = z.enum([
  "PENDING",
  "DRAFT",
  "COMPLETED",
  "OVERDUE",
  "REOPENED",
]);

export function normalizeEvaluatorIds(ids: number[]) {
  return Array.from(new Set(ids));
}

function safeUser(user: typeof users.$inferSelect) {
  const { passwordHash, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

function asError(error: unknown, fallback: string) {
  if (error instanceof TRPCError) throw error;
  const message = error instanceof Error ? error.message : fallback;
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function assertNoForcedPasswordChange(user: typeof users.$inferSelect) {
  if (user.mustChangePassword)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "İşleme devam etmek için önce şifrenizi değiştirmelisiniz.",
    });
}

async function audit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId?: number,
  newValue?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    userId,
    action,
    entityType,
    entityId,
    newValue: newValue ?? null,
  });
}

async function notify(
  userId: number,
  type: string,
  title: string,
  message: string,
  link?: string,
  relatedEntityId?: number
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    link,
    relatedEntityType: relatedEntityId ? "assignment" : null,
    relatedEntityId,
  });
  const recipient = (
    await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0];
  if (recipient?.email && emailService.isConfigured()) {
    await emailService.send({
      to: recipient.email,
      subject: `[E/V] ${title}`,
      text: message,
    });
  }
}

async function getOwnedAssignment(
  assignmentId: number,
  user: typeof users.$inferSelect,
  editable = false
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Veritabanı bağlantısı kurulamadı.",
    });
  const record = (
    await db
      .select({
        assignment: assignments,
        training: trainings,
        evaluationSet: evaluationSets,
      })
      .from(assignments)
      .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
      .leftJoin(
        evaluationSets,
        eq(assignments.evaluationSetId, evaluationSets.id)
      )
      .where(eq(assignments.id, assignmentId))
      .limit(1)
  )[0];
  if (!record)
    throw new TRPCError({ code: "NOT_FOUND", message: "Atama bulunamadı." });
  if (user.role !== "ADMIN" && record.assignment.evaluatorId !== user.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bu atamaya erişim yetkiniz bulunmuyor.",
    });
  if (
    editable &&
    user.role !== "ADMIN" &&
    record.assignment.status === "COMPLETED"
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tamamlanmış değerlendirme kilitlidir.",
    });
  return record;
}

const trainingInput = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Eğitim kodu yalnızca harf, rakam, tire ve alt çizgi içerebilir."
    ),
  title: z.string().trim().min(2).max(300),
  description: z.string().max(10000).optional().nullable(),
  trainingType: z
    .string()
    .trim()
    .max(120)
    .refine(value => ["Ürün", "Üretim", "Destek"].includes(value), {
      message: "Eğitim Müdürlüğü alanı zorunludur.",
    }),
  targetAudience: z.string().max(500).optional().nullable(),
  learningObjectives: z.string().max(10000).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(100000).optional().nullable(),
  contentOwner: z.string().max(200).optional().nullable(),
  trainingUrl: z.string().max(2048).optional().nullable(),
  fileUrl: z.string().url().max(2048).optional().nullable(),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  version: z.string().trim().min(1).max(64),
  publishDate: z.date().optional().nullable(),
  lastUpdatedDate: z.date().optional().nullable(),
  evaluationEndDate: z.date().optional().nullable(),
  status: trainingStatus,
});

function validateTrainingDates(input: z.infer<typeof trainingInput>) {
  if (
    input.evaluationEndDate &&
    input.publishDate &&
    input.publishDate > input.evaluationEndDate
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Yayın tarihi değerlendirme bitiş tarihinden sonra olamaz.",
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) =>
      ctx.user ? safeUser(ctx.user) : null
    ),
    login: publicProcedure
      .input(
        z.object({ email: z.string().email(), password: z.string().min(1) })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await loginWithPassword(
            input.email,
            input.password,
            ctx.req
          );
          const token = await createSession(user.id, ctx.req);
          setSessionCookie(ctx.req, ctx.res, token);
          return {
            user: safeUser({
              ...user,
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastSignedIn: new Date(),
            }),
            mustChangePassword: user.mustChangePassword,
            previewSessionToken: token,
          };
        } catch (error) {
          asError(error, "Giriş işlemi tamamlanamadı.");
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true };
    }),
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          !(await bcrypt.compare(input.currentPassword, ctx.user.passwordHash))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mevcut şifre hatalı.",
          });
        try {
          await setUserPassword(ctx.user.id, input.newPassword);
        } catch (error) {
          asError(error, "Şifre güncellenemedi.");
        }
        await audit(ctx.user.id, "PASSWORD_CHANGED", "USER", ctx.user.id);
        return { success: true };
      }),
  }),

  criteria: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(criteria)
        .where(eq(criteria.isActive, true))
        .orderBy(criteria.orderNumber);
    }),
  }),

  files: router({
    upload: adminProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(180),
          contentType: z.enum([
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
          ]),
          kind: z.enum(["material", "image"]),
          base64Data: z.string().min(1).max(14_000_000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const content = Buffer.from(input.base64Data, "base64");
        if (!content.length || content.length > 10 * 1024 * 1024)
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Dosya boyutu en fazla 10 MB olabilir.",
          });
        if (input.kind === "image" && !input.contentType.startsWith("image/"))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Görsel alanına yalnızca PNG, JPEG veya WebP yüklenebilir.",
          });
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(
          `training-assets/${ctx.user.id}/${input.kind}/${safeName}`,
          content,
          input.contentType
        );
        await audit(ctx.user.id, "FILE_UPLOADED", "FILE", undefined, {
          kind: input.kind,
          fileName: safeName,
        });
        return stored;
      }),
  }),

  admin: router({
    criteria: router({
      list: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(criteria).orderBy(criteria.orderNumber);
      }),
      create: adminProcedure
        .input(
          z.object({
            name: z.string().trim().min(2).max(200),
            description: z.string().trim().max(1000).optional().nullable(),
            controlPoints: z
              .array(z.string().trim().min(1).max(500))
              .min(1)
              .max(10),
          })
        )
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          const allCriteria = await db.select().from(criteria);
          const nextOrder =
            Math.max(...allCriteria.map(item => item.orderNumber), 0) + 1;
          const result = await db.insert(criteria).values({
            orderNumber: nextOrder,
            name: input.name,
            description: input.description?.trim() || null,
            controlPoints: input.controlPoints.map(point => point.trim()),
            isActive: true,
          });

          const id = Number(result.lastInsertRowid ?? 0);
          await audit(ctx.user.id, "CRITERION_CREATED", "CRITERION", id, {
            name: input.name,
          });
          return { id };
        }),
      update: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            name: z.string().trim().min(2).max(200),
            description: z.string().trim().max(1000).optional().nullable(),
            controlPoints: z
              .array(z.string().trim().min(1).max(500))
              .min(1)
              .max(10),
          })
        )
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          await db
            .update(criteria)
            .set({
              name: input.name,
              description: input.description?.trim() || null,
              controlPoints: input.controlPoints.map(point => point.trim()),
              updatedAt: new Date(),
            })
            .where(eq(criteria.id, input.id));

          await audit(ctx.user.id, "CRITERION_UPDATED", "CRITERION", input.id, {
            name: input.name,
          });
          return { success: true };
        }),
      remove: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          await db
            .update(criteria)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(criteria.id, input.id));

          await audit(ctx.user.id, "CRITERION_REMOVED", "CRITERION", input.id, {
            removed: true,
          });
          return { success: true };
        }),
      restore: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          await db
            .update(criteria)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(criteria.id, input.id));

          await audit(
            ctx.user.id,
            "CRITERION_RESTORED",
            "CRITERION",
            input.id,
            {
              restored: true,
            }
          );
          return { success: true };
        }),
    }),
    evaluationSets: router({
      list: trainingManagerProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        const sets = await db
          .select()
          .from(evaluationSets)
          .orderBy(desc(evaluationSets.createdAt));
        const assignments = await db
          .select({
            evaluationSetId: evaluationSetCriteria.evaluationSetId,
            criterionId: evaluationSetCriteria.criterionId,
            weight: evaluationSetCriteria.weight,
            name: criteria.name,
            description: criteria.description,
          })
          .from(evaluationSetCriteria)
          .innerJoin(
            criteria,
            eq(evaluationSetCriteria.criterionId, criteria.id)
          )
          .orderBy(
            asc(evaluationSetCriteria.sortOrder),
            asc(evaluationSetCriteria.id)
          );
        const bySet = new Map<
          number,
          Array<{
            criterionId: number;
            weight: number;
            name: string;
            description: string | null;
          }>
        >();
        for (const item of assignments) {
          const list = bySet.get(item.evaluationSetId) ?? [];
          list.push({
            criterionId: item.criterionId,
            weight: Number(item.weight),
            name: item.name,
            description: item.description ?? null,
          });
          bySet.set(item.evaluationSetId, list);
        }
        return sets.map(set => ({
          ...set,
          criteria: bySet.get(set.id) ?? [],
          rubricScale: set.rubricScale ?? {},
          passingScore: Number(set.passingScore ?? 70),
        }));
      }),
      create: adminProcedure
        .input(
          z.object({
            name: z.string().trim().min(2).max(200),
            description: z.string().trim().max(1000).optional().nullable(),
            rubricScale: z.record(z.string(), z.string()).default({}),
            passingScore: z.number().min(0).max(100).default(70),
            criteria: z
              .array(
                z.object({
                  criterionId: z.number().int().positive(),
                  weight: z.number().min(0).max(100),
                })
              )
              .min(1),
          })
        )
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const totalWeight = input.criteria.reduce(
            (sum, item) => sum + item.weight,
            0
          );
          if (Math.abs(totalWeight - 100) > 0.0001) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Toplam ağırlık 100 olmalıdır.",
            });
          }
          const result = await db.insert(evaluationSets).values({
            name: input.name,
            description: input.description?.trim() || null,
            rubricScale: input.rubricScale,
            passingScore: input.passingScore,
            isActive: true,
          });
          const setId = Number(result.lastInsertRowid ?? 0);
          await db.insert(evaluationSetCriteria).values(
            input.criteria.map((criterion, index) => ({
              evaluationSetId: setId,
              criterionId: criterion.criterionId,
              weight: criterion.weight,
              sortOrder: index,
            }))
          );
          await audit(
            ctx.user.id,
            "EVALUATION_SET_CREATED",
            "EVALUATION_SET",
            setId,
            {
              name: input.name,
            }
          );
          return { id: setId };
        }),
      update: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            name: z.string().trim().min(2).max(200),
            description: z.string().trim().max(1000).optional().nullable(),
            rubricScale: z.record(z.string(), z.string()).default({}),
            passingScore: z.number().min(0).max(100).default(70),
            criteria: z
              .array(
                z.object({
                  criterionId: z.number().int().positive(),
                  weight: z.number().min(0).max(100),
                })
              )
              .min(1),
          })
        )
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const totalWeight = input.criteria.reduce(
            (sum, item) => sum + item.weight,
            0
          );
          if (Math.abs(totalWeight - 100) > 0.0001) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Toplam ağırlık 100 olmalıdır.",
            });
          }
          await db
            .update(evaluationSets)
            .set({
              name: input.name,
              description: input.description?.trim() || null,
              rubricScale: input.rubricScale,
              passingScore: input.passingScore,
              updatedAt: new Date(),
            })
            .where(eq(evaluationSets.id, input.id));
          const setEvaluations = await db
            .select({
              id: evaluations.id,
              successPercentage: evaluations.successPercentage,
            })
            .from(evaluations)
            .innerJoin(
              assignments,
              eq(evaluations.assignmentId, assignments.id)
            )
            .where(eq(assignments.evaluationSetId, input.id));
          for (const evaluation of setEvaluations) {
            if (evaluation.successPercentage === null) continue;
            await db
              .update(evaluations)
              .set({
                successStatus:
                  evaluation.successPercentage >= input.passingScore
                    ? "SUCCESSFUL"
                    : "UNSUCCESSFUL",
                updatedAt: new Date(),
              })
              .where(eq(evaluations.id, evaluation.id));
          }
          await db
            .delete(evaluationSetCriteria)
            .where(eq(evaluationSetCriteria.evaluationSetId, input.id));
          await db.insert(evaluationSetCriteria).values(
            input.criteria.map((criterion, index) => ({
              evaluationSetId: input.id,
              criterionId: criterion.criterionId,
              weight: criterion.weight,
              sortOrder: index,
            }))
          );
          await audit(
            ctx.user.id,
            "EVALUATION_SET_UPDATED",
            "EVALUATION_SET",
            input.id,
            {
              name: input.name,
            }
          );
          return { success: true };
        }),
      remove: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await db
            .update(evaluationSets)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(evaluationSets.id, input.id));
          await audit(
            ctx.user.id,
            "EVALUATION_SET_REMOVED",
            "EVALUATION_SET",
            input.id,
            {
              removed: true,
            }
          );
          return { success: true };
        }),
      restore: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await db
            .update(evaluationSets)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(evaluationSets.id, input.id));
          await audit(
            ctx.user.id,
            "EVALUATION_SET_RESTORED",
            "EVALUATION_SET",
            input.id,
            {
              restored: true,
            }
          );
          return { success: true };
        }),
    }),
    dashboard: trainingManagerProcedure
      .input(
        z
          .object({
            period: z
              .enum(["ALL", "30_DAYS", "90_DAYS", "YEAR"])
              .default("ALL"),
            evaluationSetId: z.number().int().positive().nullable().optional(),
            trainingType: z.string().trim().max(120).nullable().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [allTrainings, allAssignments, allCompleted, allUsers] =
          await Promise.all([
            db.select().from(trainings),
            db.select().from(assignments),
            db
              .select()
              .from(evaluations)
              .where(eq(evaluations.status, "COMPLETED")),
            db.select().from(users),
          ]);
        const filteredTrainings = input?.trainingType
          ? allTrainings.filter(
              training => training.trainingType === input.trainingType
            )
          : allTrainings;
        const days =
          input?.period === "30_DAYS"
            ? 30
            : input?.period === "90_DAYS"
              ? 90
              : input?.period === "YEAR"
                ? 365
                : null;
        const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
        const activeTrainingIds = filterActiveTrainingIds(filteredTrainings);
        const activeAssignments = allAssignments.filter(
          assignment =>
            activeTrainingIds.has(assignment.trainingId) &&
            (!input?.evaluationSetId ||
              assignment.evaluationSetId === input.evaluationSetId)
        );
        const filteredCompleted = filterDashboardRecordsForActiveTrainings(
          cutoff
            ? allCompleted.filter(
                item => item.submittedAt && item.submittedAt >= cutoff
              )
            : allCompleted,
          activeTrainingIds
        ).filter(item => {
          const assignment = allAssignments.find(
            row => row.id === item.assignmentId
          );
          return (
            !input?.evaluationSetId ||
            assignment?.evaluationSetId === input.evaluationSetId
          );
        });
        const completedAssignmentIds = new Set(
          filteredCompleted.map(item => item.assignmentId)
        );
        const selectedSetCriteria = input?.evaluationSetId
          ? await db
              .select({
                id: criteria.id,
                orderNumber: criteria.orderNumber,
                name: criteria.name,
                description: criteria.description,
              })
              .from(evaluationSetCriteria)
              .innerJoin(
                criteria,
                eq(evaluationSetCriteria.criterionId, criteria.id)
              )
              .where(
                and(
                  eq(
                    evaluationSetCriteria.evaluationSetId,
                    input.evaluationSetId
                  ),
                  eq(criteria.isActive, true)
                )
              )
              .orderBy(
                asc(evaluationSetCriteria.sortOrder),
                asc(evaluationSetCriteria.id)
              )
          : await db
              .select()
              .from(criteria)
              .where(eq(criteria.isActive, true))
              .orderBy(asc(criteria.orderNumber));
        const criterionScores = await Promise.all(
          filteredCompleted.map(async evaluation => {
            const responses = await db
              .select({
                criterionId: evaluationResponses.criterionId,
                score: evaluationResponses.score,
              })
              .from(evaluationResponses)
              .where(eq(evaluationResponses.evaluationId, evaluation.id));
            const byCriterion = new Map(
              responses.map(response => [response.criterionId, response.score])
            );
            return selectedSetCriteria.map(
              criterion => byCriterion.get(criterion.id) ?? 0
            );
          })
        );
        const criterionAverages = selectedSetCriteria.length
          ? Array.from({ length: selectedSetCriteria.length }, (_, index) => {
              const count = criterionScores.filter(
                scores => scores[index] !== undefined
              ).length;
              if (!count) return 0;
              return (
                criterionScores.reduce(
                  (sum, scores) => sum + (scores[index] ?? 0),
                  0
                ) / count
              );
            })
          : [];
        const successfulTrainings = new Set(
          filteredCompleted
            .filter(item => item.successStatus === "SUCCESSFUL")
            .map(item => item.trainingId)
        );
        const unsuccessfulTrainings = new Set(
          filteredCompleted
            .filter(item => item.successStatus === "UNSUCCESSFUL")
            .map(item => item.trainingId)
        );
        const evaluatorUsers = allUsers.filter(user =>
          activeAssignments.some(item => item.evaluatorId === user.id)
        );
        const evaluatorCompletion = evaluatorUsers
          .map(user => {
            const assigned = activeAssignments.filter(
              item => item.evaluatorId === user.id
            );
            const completedCount = assigned.filter(item =>
              completedAssignmentIds.has(item.id)
            ).length;
            return {
              name: `${user.firstName} ${user.lastName}`,
              assignedCount: assigned.length,
              completedCount,
              completionRate: assigned.length
                ? (completedCount / assigned.length) * 100
                : 0,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
        const activeTrainings = filteredTrainings.filter(training =>
          activeTrainingIds.has(training.id)
        );
        return {
          cards: {
            totalTrainings: activeTrainings.length,
            activeAssignments: activeAssignments.filter(
              item => !completedAssignmentIds.has(item.id)
            ).length,
            completedEvaluations: filteredCompleted.length,
            pendingEvaluations: activeAssignments.filter(
              item => !completedAssignmentIds.has(item.id)
            ).length,
            successfulTrainings: successfulTrainings.size,
            unsuccessfulTrainings: unsuccessfulTrainings.size,
            completionRate: activeAssignments.length
              ? (filteredCompleted.length / activeAssignments.length) * 100
              : 0,
          },
          charts: {
            success: [
              { name: "Başarılı", value: successfulTrainings.size },
              { name: "Başarısız", value: unsuccessfulTrainings.size },
            ],
            criteria: createCriteriaChartData(
              selectedSetCriteria,
              criterionAverages
            ),
            evaluators: evaluatorCompletion,
          },
        };
      }),
    users: router({
      list: trainingManagerProcedure
        .input(z.object({ activeOnly: z.boolean().optional() }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          const rows = input?.activeOnly
            ? await db
                .select()
                .from(users)
                .where(eq(users.isActive, true))
                .orderBy(desc(users.createdAt))
            : await db.select().from(users).orderBy(desc(users.createdAt));
          return rows.map(safeUser);
        }),
      create: adminProcedure
        .input(
          z.object({
            firstName: z.string().trim().min(2).max(100),
            lastName: z.string().trim().min(2).max(100),
            email: z.string().email(),
            role: z.enum(["ADMIN", "TRAINING_MANAGER", "EVALUATOR"]),
            password: z.string().min(1),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const passwordRule = validateStrongPassword(input.password);
          if (!passwordRule.valid)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: passwordRule.message,
            });
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const existing = (
            await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, input.email.toLowerCase()))
              .limit(1)
          )[0];
          if (existing)
            throw new TRPCError({
              code: "CONFLICT",
              message: "Bu e-posta adresi zaten kullanılıyor.",
            });
          const passwordHash = await bcrypt.hash(input.password, 12);
          const result = await db.insert(users).values({
            openId: `local:${nanoid(21)}`,
            firstName: input.firstName,
            lastName: input.lastName,
            name: `${input.firstName} ${input.lastName}`,
            email: input.email.toLowerCase(),
            passwordHash,
            role: input.role,
            isActive: true,
            mustChangePassword: true,
            loginMethod: "password",
          });
          const id = Number(result.lastInsertRowid ?? 0);
          await audit(ctx.user.id, "USER_CREATED", "USER", id, {
            email: input.email,
            role: input.role,
          });
          return { id };
        }),
      update: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            firstName: z.string().trim().min(2).max(100),
            lastName: z.string().trim().min(2).max(100),
            email: z.string().email(),
            role: z.enum(["ADMIN", "TRAINING_MANAGER", "EVALUATOR"]),
            isActive: z.boolean(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          if (input.id === ctx.user.id && !input.isActive)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Kendi hesabınızı pasifleştiremezsiniz.",
            });
          const normalizedEmail = input.email.toLowerCase();
          const existing = (
            await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1)
          )[0];
          if (existing && existing.id !== input.id)
            throw new TRPCError({
              code: "CONFLICT",
              message: "Bu e-posta adresi zaten kullanılıyor.",
            });
          await db
            .update(users)
            .set({
              firstName: input.firstName,
              lastName: input.lastName,
              name: `${input.firstName} ${input.lastName}`,
              email: normalizedEmail,
              role: input.role,
              isActive: input.isActive,
            })
            .where(eq(users.id, input.id));
          await audit(ctx.user.id, "USER_UPDATED", "USER", input.id, {
            email: normalizedEmail,
            role: input.role,
            isActive: input.isActive,
          });
          return { success: true };
        }),
      resetPassword: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            temporaryPassword: z.string().min(1),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const passwordRule = validateStrongPassword(input.temporaryPassword);
          if (!passwordRule.valid)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: passwordRule.message,
            });
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await db
            .update(users)
            .set({
              passwordHash: await bcrypt.hash(input.temporaryPassword, 12),
              mustChangePassword: true,
              failedLoginAttempts: 0,
              lockedUntil: null,
            })
            .where(eq(users.id, input.id));
          await audit(ctx.user.id, "PASSWORD_RESET", "USER", input.id);
          return { success: true };
        }),
      userAssignments: trainingManagerProcedure
        .input(z.object({ userId: z.number().int().positive() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          const rows = await db
            .select({
              assignment: assignments,
              training: trainings,
              evaluationSet: evaluationSets,
              evaluation: evaluations,
            })
            .from(assignments)
            .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
            .leftJoin(
              evaluationSets,
              eq(assignments.evaluationSetId, evaluationSets.id)
            )
            .leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id))
            .where(eq(assignments.evaluatorId, input.userId))
            .orderBy(desc(assignments.createdAt));

          const now = new Date();
          return rows.map(row => ({
            id: row.assignment.id,
            trainingId: row.assignment.trainingId,
            trainingTitle: row.training.title,
            trainingCode: row.training.code,
            trainingType: row.training.trainingType ?? "Eğitim",
            evaluationSetName: row.evaluationSet?.name ?? "Varsayılan set",
            dueDate: row.assignment.dueDate,
            status:
              row.assignment.status !== "COMPLETED" &&
              row.assignment.dueDate < now
                ? "OVERDUE"
                : row.assignment.status,
            completedAt: row.assignment.completedAt,
            createdAt: row.assignment.createdAt,
            evaluation: row.evaluation
              ? {
                  id: row.evaluation.id,
                  status: row.evaluation.status,
                  successPercentage: row.evaluation.successPercentage,
                  successStatus: row.evaluation.successStatus,
                }
              : null,
          }));
        }),
      convertToDraft: adminProcedure
        .input(z.object({ assignmentId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const assignmentRows = await db
            .select()
            .from(assignments)
            .where(eq(assignments.id, input.assignmentId))
            .limit(1);
          const record = assignmentRows[0];
          if (!record)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Atama bulunamadı.",
            });

          await db
            .update(assignments)
            .set({
              status: "DRAFT",
              completedAt: null,
              reopenedAt: new Date(),
              reopenedById: ctx.user.id,
            })
            .where(eq(assignments.id, input.assignmentId));

          await db
            .update(evaluations)
            .set({
              status: "DRAFT",
              submittedAt: null,
            })
            .where(eq(evaluations.assignmentId, input.assignmentId));

          await audit(
            ctx.user.id,
            "EVALUATION_CONVERTED_TO_DRAFT",
            "ASSIGNMENT",
            input.assignmentId,
            {
              evaluatorId: record.evaluatorId,
              trainingId: record.trainingId,
            }
          );

          return { success: true };
        }),
      deleteAssignment: adminProcedure
        .input(z.object({ assignmentId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const assignmentRows = await db
            .select()
            .from(assignments)
            .where(eq(assignments.id, input.assignmentId))
            .limit(1);
          const record = assignmentRows[0];
          if (!record)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Atama bulunamadı.",
            });

          const evaluationRows = await db
            .select({ id: evaluations.id })
            .from(evaluations)
            .where(eq(evaluations.assignmentId, input.assignmentId));

          for (const ev of evaluationRows) {
            await db
              .delete(evaluationResponses)
              .where(eq(evaluationResponses.evaluationId, ev.id));
            await db.delete(evaluations).where(eq(evaluations.id, ev.id));
          }

          await db
            .delete(assignments)
            .where(eq(assignments.id, input.assignmentId));

          await audit(
            ctx.user.id,
            "ASSIGNMENT_DELETED",
            "ASSIGNMENT",
            input.assignmentId,
            {
              evaluatorId: record.evaluatorId,
              trainingId: record.trainingId,
            }
          );

          return { success: true };
        }),
    }),
    reports: router({
      list: trainingManagerProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            assignment: assignments,
            training: trainings,
            evaluationSet: evaluationSets,
            evaluation: evaluations,
          })
          .from(assignments)
          .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
          .leftJoin(
            evaluationSets,
            eq(assignments.evaluationSetId, evaluationSets.id)
          )
          .leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id));
        const grouped = new Map<
          string,
          {
            id: string;
            trainingId: number;
            title: string;
            code: string;
            version: string;
            contentOwner: string;
            trainingType: string;
            evaluationSetId: number | null;
            evaluationSetName: string;
            assignedCount: number;
            completedCount: number;
            totalScore: number;
          }
        >();
        for (const row of rows) {
          const evaluationSetId = row.assignment.evaluationSetId ?? null;
          const key = `${row.training.id}-${evaluationSetId ?? "none"}`;
          const current = grouped.get(key) ?? {
            id: key,
            trainingId: row.training.id,
            title: row.training.title,
            code: row.training.code,
            version: row.training.version,
            contentOwner: row.training.contentOwner ?? "Belirtilmemiş",
            trainingType: row.training.trainingType ?? "Belirtilmemiş",
            evaluationSetId,
            evaluationSetName:
              row.evaluationSet?.name ?? "Değerlendirme seti belirtilmemiş",
            assignedCount: 0,
            completedCount: 0,
            totalScore: 0,
          };
          current.assignedCount += 1;
          if (
            row.evaluation?.status === "COMPLETED" &&
            row.evaluation.totalScore !== null
          ) {
            current.completedCount += 1;
            current.totalScore += row.evaluation.totalScore;
          }
          grouped.set(key, current);
        }
        return Array.from(grouped.values()).map(row => {
          const averageTotal = row.completedCount
            ? row.totalScore / row.completedCount
            : null;
          return {
            ...row,
            averageTotal,
            successStatus:
              averageTotal === null
                ? null
                : averageTotal >= 70
                  ? ("SUCCESSFUL" as const)
                  : ("UNSUCCESSFUL" as const),
          };
        });
      }),
      detailedList: trainingManagerProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        const evaluatorUser = alias(users, "evaluatorUser");
        const assignerUser = alias(users, "assignerUser");

        const rows = await db
          .select({
            assignment: assignments,
            training: trainings,
            evaluationSet: evaluationSets,
            evaluator: evaluatorUser,
            assignedBy: assignerUser,
            evaluation: evaluations,
          })
          .from(assignments)
          .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
          .leftJoin(
            evaluationSets,
            eq(assignments.evaluationSetId, evaluationSets.id)
          )
          .innerJoin(evaluatorUser, eq(assignments.evaluatorId, evaluatorUser.id))
          .innerJoin(assignerUser, eq(assignments.assignedById, assignerUser.id))
          .leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id))
          .orderBy(desc(assignments.assignedAt));

        const evaluationIds = rows
          .map(row => row.evaluation?.id)
          .filter((id): id is number => typeof id === "number");
        const evaluationSetIds = Array.from(
          new Set(
            rows
              .map(row => row.assignment.evaluationSetId)
              .filter((id): id is number => typeof id === "number")
          )
        );
        const [responseRows, setCriterionRows] = await Promise.all([
          evaluationIds.length
            ? db
                .select()
                .from(evaluationResponses)
                .where(inArray(evaluationResponses.evaluationId, evaluationIds))
            : Promise.resolve([]),
          evaluationSetIds.length
            ? db
                .select()
                .from(evaluationSetCriteria)
                .where(inArray(evaluationSetCriteria.evaluationSetId, evaluationSetIds))
            : Promise.resolve([]),
        ]);
        const responsesByEvaluation = new Map<number, typeof responseRows>();
        for (const response of responseRows) {
          const responses = responsesByEvaluation.get(response.evaluationId) ?? [];
          responses.push(response);
          responsesByEvaluation.set(response.evaluationId, responses);
        }
        const criteriaBySet = new Map<number, typeof setCriterionRows>();
        for (const criterion of setCriterionRows) {
          const criteria = criteriaBySet.get(criterion.evaluationSetId) ?? [];
          criteria.push(criterion);
          criteriaBySet.set(criterion.evaluationSetId, criteria);
        }

        return rows.map(row => {
          const evaluation = row.evaluation;
          const responses = evaluation?.id
            ? responsesByEvaluation.get(evaluation.id) ?? []
            : [];
          const setCriteria = row.assignment.evaluationSetId
            ? criteriaBySet.get(row.assignment.evaluationSetId) ?? []
            : [];
          const weightedCriteria = setCriteria.length
            ? setCriteria.map(criterion => ({
                score:
                  responses.find(response => response.criterionId === criterion.criterionId)
                    ?.score ?? 0,
                weight: criterion.weight,
              }))
            : responses.map(response => ({
                score: response.score,
                weight: 100 / Math.max(responses.length, 1),
              }));
          const calculatedPercentage =
            evaluation?.status === "COMPLETED" && weightedCriteria.length
              ? calculateWeightedEvaluationScores(
                  weightedCriteria,
                  Number(row.evaluationSet?.passingScore ?? 70),
                  getRubricMaxScore(row.evaluationSet?.rubricScale ?? null)
                ).successPercentage
              : evaluation?.successPercentage ?? null;

          return {
          assignmentId: row.assignment.id,
          assignedAt: row.assignment.assignedAt,
          dueDate: row.assignment.dueDate,
          completedAt: row.assignment.completedAt,
          status: row.assignment.status,
          trainingId: row.training.id,
          trainingTitle: row.training.title,
          trainingCode: row.training.code,
          trainingType: row.training.trainingType ?? "Belirtilmemiş",
          contentOwner: row.training.contentOwner ?? "Belirtilmemiş",
          trainingStatus: row.training.status,
          evaluationSetId: row.assignment.evaluationSetId,
          evaluationSetName: row.evaluationSet?.name ?? "Set Belirtilmemiş",
          assignedById: row.assignedBy.id,
          assignedByName: row.assignedBy.name ?? `${row.assignedBy.firstName} ${row.assignedBy.lastName}`,
          assignedByEmail: row.assignedBy.email,
          evaluatorId: row.evaluator.id,
          evaluatorName: row.evaluator.name ?? `${row.evaluator.firstName} ${row.evaluator.lastName}`,
          evaluatorEmail: row.evaluator.email,
          evaluatorIsActive: row.evaluator.isActive,
          evaluationId: row.evaluation?.id ?? null,
          evaluationStatus: row.evaluation?.status ?? null,
          totalScore: row.evaluation?.totalScore ?? null,
          averageScore: row.evaluation?.averageScore ?? null,
          successPercentage: calculatedPercentage,
          successStatus: row.evaluation?.successStatus ?? null,
          generalComment: row.evaluation?.generalComment ?? null,
          submittedAt: row.evaluation?.submittedAt ?? null,
          };
        });
      }),
    }),
    trainings: router({
      list: trainingManagerProcedure
        .input(z.object({ status: trainingStatus.optional() }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          const rows = input?.status
            ? await db
                .select()
                .from(trainings)
                .where(eq(trainings.status, input.status))
                .orderBy(desc(trainings.createdAt))
            : await db
                .select()
                .from(trainings)
                .orderBy(desc(trainings.createdAt));
          const allAssignments = await db.select().from(assignments);
          const complete = await db
            .select()
            .from(evaluations)
            .where(eq(evaluations.status, "COMPLETED"));
          return rows.map(training => {
            const matches = allAssignments.filter(
              assignment => assignment.trainingId === training.id
            );
            const assignedEvaluatorIdsBySet = matches.reduce<
              Record<string, number[]>
            >((acc, assignment) => {
              if (!assignment.evaluationSetId) return acc;
              const key = String(assignment.evaluationSetId);
              acc[key] = [...(acc[key] ?? []), assignment.evaluatorId];
              return acc;
            }, {});
            const evaluationSetSummaryBySet = Object.fromEntries(
              Object.entries(assignedEvaluatorIdsBySet).map(([setId]) => {
                const setAssignments = matches.filter(
                  assignment => String(assignment.evaluationSetId) === setId
                );
                const setAssignmentIds = new Set(
                  setAssignments.map(assignment => assignment.id)
                );
                const setCompleted = complete.filter(item =>
                  setAssignmentIds.has(item.assignmentId)
                );
                const averageTotal = setCompleted.length
                  ? setCompleted.reduce(
                      (sum, item) => sum + (item.totalScore ?? 0),
                      0
                    ) / setCompleted.length
                  : null;
                return [
                  setId,
                  {
                    assignedCount: setAssignments.length,
                    completedCount: setCompleted.length,
                    pendingCount: setAssignments.length - setCompleted.length,
                    averageTotal,
                    successStatus:
                      averageTotal === null
                        ? null
                        : averageTotal >= 70
                          ? "SUCCESSFUL"
                          : "UNSUCCESSFUL",
                    dueDate: setAssignments.reduce<Date | null>(
                      (latest, assignment) =>
                        !latest || assignment.dueDate > latest
                          ? assignment.dueDate
                          : latest,
                      null
                    ),
                  },
                ];
              })
            );
            const completed = complete.filter(
              item => item.trainingId === training.id
            );
            const averageTotal = completed.length
              ? completed.reduce(
                  (sum, item) => sum + (item.totalScore ?? 0),
                  0
                ) / completed.length
              : null;
            return {
              ...training,
              evaluatorIds: matches.map(assignment => assignment.evaluatorId),
              assignedEvaluatorIdsBySet,
              evaluationSetSummaryBySet,
              completedEvaluatorIds: matches
                .filter(assignment => assignment.status === "COMPLETED")
                .map(assignment => assignment.evaluatorId),
              assignedCount: matches.length,
              completedCount: completed.length,
              pendingCount: matches.length - completed.length,
              averageTotal,
              successPercentage: averageTotal === null ? null : averageTotal,
              successStatus:
                averageTotal === null
                  ? null
                  : averageTotal >= 70
                    ? "SUCCESSFUL"
                    : "UNSUCCESSFUL",
            };
          });
        }),
      create: trainingManagerProcedure
        .input(
          trainingInput.extend({
            evaluatorIds: z.array(z.number().int().positive()).default([]),
          })
        )
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          validateTrainingDates(input);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const existing = (
            await db
              .select({ id: trainings.id })
              .from(trainings)
              .where(eq(trainings.code, input.code))
              .limit(1)
          )[0];
          if (existing)
            throw new TRPCError({
              code: "CONFLICT",
              message: "Bu eğitim kodu zaten kullanılıyor.",
            });
          const { evaluatorIds, ...data } = input;
          const result = await db
            .insert(trainings)
            .values({ ...data, createdById: ctx.user.id });
          const trainingId = Number(result.lastInsertRowid ?? 0);
          if (evaluatorIds.length) {
            const validEvaluators = await db
              .select()
              .from(users)
              .where(
                and(
                  inArray(users.id, evaluatorIds),
                  eq(users.role, "EVALUATOR"),
                  eq(users.isActive, true)
                )
              );
            if (validEvaluators.length !== evaluatorIds.length)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Atanan değerlendiriciler aktif olmalıdır.",
              });
            const dueDate =
              input.evaluationEndDate ?? new Date(Date.now() + 7 * 86400000);
            for (const evaluator of validEvaluators) {
              await db.insert(assignments).values({
                trainingId,
                evaluatorId: evaluator.id,
                assignedById: ctx.user.id,
                assignedAt: new Date(),
                dueDate,
                status: "PENDING",
              });
              await notify(
                evaluator.id,
                "ASSIGNMENT",
                "Yeni eğitim atandı",
                `${input.title} değerlendirme için size atandı.`,
                `/evaluator/assignments`,
                trainingId
              );
            }
          }
          await audit(ctx.user.id, "TRAINING_CREATED", "TRAINING", trainingId, {
            code: input.code,
          });
          return { id: trainingId };
        }),
      update: trainingManagerProcedure
        .input(trainingInput.extend({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          assertNoForcedPasswordChange(ctx.user);
          validateTrainingDates(input);
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const { id, ...data } = input;
          await db.update(trainings).set(data).where(eq(trainings.id, id));
          await audit(ctx.user.id, "TRAINING_UPDATED", "TRAINING", id);
          return { success: true };
        }),
      archive: trainingManagerProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const training = (
            await db
              .select()
              .from(trainings)
              .where(eq(trainings.id, input.id))
              .limit(1)
          )[0];
          if (!training)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Eğitim bulunamadı.",
            });
          const nextStatus =
            training.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
          await db
            .update(trainings)
            .set({ status: nextStatus })
            .where(eq(trainings.id, input.id));
          await audit(
            ctx.user.id,
            nextStatus === "ARCHIVED"
              ? "TRAINING_ARCHIVED"
              : "TRAINING_REACTIVATED",
            "TRAINING",
            input.id
          );
          return { success: true, status: nextStatus };
        }),
      detail: trainingManagerProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const training = (
            await db
              .select()
              .from(trainings)
              .where(eq(trainings.id, input.id))
              .limit(1)
          )[0];
          if (!training) throw new TRPCError({ code: "NOT_FOUND" });
          const records = await db
            .select({
              assignment: assignments,
              evaluator: users,
              evaluationSet: evaluationSets,
            })
            .from(assignments)
            .innerJoin(users, eq(assignments.evaluatorId, users.id))
            .leftJoin(
              evaluationSets,
              eq(assignments.evaluationSetId, evaluationSets.id)
            )
            .where(eq(assignments.trainingId, input.id));
          const resultEvaluations = await db
            .select()
            .from(evaluations)
            .where(eq(evaluations.trainingId, input.id));
          return {
            training,
            assignments: records.map(record => ({
              ...record.assignment,
              evaluator: safeUser(record.evaluator),
              evaluationSet: record.evaluationSet,
              evaluation:
                resultEvaluations.find(
                  evaluation => evaluation.assignmentId === record.assignment.id
                ) ?? null,
            })),
          };
        }),
      assign: trainingManagerProcedure
        .input(
          z.object({
            trainingId: z.number().int().positive(),
            evaluatorIds: z.array(z.number().int().positive()),
            evaluationSetId: z.number().int().positive().nullable().optional(),
            dueDate: z.date(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const uniqueEvaluatorIds = normalizeEvaluatorIds(input.evaluatorIds);
          const training = (
            await db
              .select()
              .from(trainings)
              .where(eq(trainings.id, input.trainingId))
              .limit(1)
          )[0];
          if (!training || training.status === "ARCHIVED")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Arşivlenmiş veya bulunamayan eğitime atama yapılamaz.",
            });
          if (input.evaluationSetId) {
            const set = (
              await db
                .select({ id: evaluationSets.id })
                .from(evaluationSets)
                .where(
                  and(
                    eq(evaluationSets.id, input.evaluationSetId),
                    eq(evaluationSets.isActive, true)
                  )
                )
                .limit(1)
            )[0];
            if (!set) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "Seçilen değerlendirme seti aktif değil veya bulunamadı.",
              });
            }
          }
          const evaluatorRows = await db
            .select()
            .from(users)
            .where(
              and(
                inArray(users.id, uniqueEvaluatorIds),
                eq(users.isActive, true)
              )
            );
          if (evaluatorRows.length !== uniqueEvaluatorIds.length)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Yalnızca aktif kullanıcılar atanabilir.",
            });
          const desiredEvaluatorIds = new Set(uniqueEvaluatorIds);
          const selectedSetId = input.evaluationSetId ?? null;
          const existingAssignments = await db
            .select()
            .from(assignments)
            .where(
              and(
                eq(assignments.trainingId, input.trainingId),
                selectedSetId === null
                  ? isNull(assignments.evaluationSetId)
                  : eq(assignments.evaluationSetId, selectedSetId)
              )
            );

          for (const existing of existingAssignments) {
            if (
              existing.status !== "COMPLETED" &&
              !desiredEvaluatorIds.has(existing.evaluatorId)
            ) {
              await db
                .delete(assignments)
                .where(eq(assignments.id, existing.id));
            }
          }

          for (const evaluator of evaluatorRows) {
            const existing = (
              await db
                .select({ id: assignments.id })
                .from(assignments)
                .where(
                  and(
                    eq(assignments.trainingId, input.trainingId),
                    eq(assignments.evaluatorId, evaluator.id),
                    selectedSetId === null
                      ? isNull(assignments.evaluationSetId)
                      : eq(assignments.evaluationSetId, selectedSetId)
                  )
                )
                .limit(1)
            )[0];
            if (existing) {
              await db
                .update(assignments)
                .set({
                  dueDate: input.dueDate,
                  evaluationSetId: selectedSetId,
                  assignedById: ctx.user.id,
                })
                .where(eq(assignments.id, existing.id));
              continue;
            }
            await db.insert(assignments).values({
              trainingId: input.trainingId,
              evaluatorId: evaluator.id,
              evaluationSetId: input.evaluationSetId ?? null,
              assignedById: ctx.user.id,
              assignedAt: new Date(),
              dueDate: input.dueDate,
              status: "PENDING",
            });
            await notify(
              evaluator.id,
              "ASSIGNMENT",
              "Yeni eğitim atandı",
              `${training.title} değerlendirme için size atandı.`,
              "/evaluator/assignments",
              input.trainingId
            );
          }
          await audit(
            ctx.user.id,
            "EVALUATORS_ASSIGNED",
            "TRAINING",
            input.trainingId,
            {
              evaluatorIds: uniqueEvaluatorIds,
              evaluationSetId: input.evaluationSetId ?? null,
            }
          );
          return { success: true };
        }),
      reopen: trainingManagerProcedure
        .input(z.object({ assignmentId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const record = await getOwnedAssignment(input.assignmentId, ctx.user);
          await db
            .update(assignments)
            .set({
              status: "REOPENED",
              reopenedAt: new Date(),
              reopenedById: ctx.user.id,
              completedAt: null,
            })
            .where(eq(assignments.id, input.assignmentId));
          await db
            .update(evaluations)
            .set({ status: "DRAFT", submittedAt: null })
            .where(eq(evaluations.assignmentId, input.assignmentId));
          await notify(
            record.assignment.evaluatorId,
            "REOPENED",
            "Değerlendirme yeniden açıldı",
            `${record.training.title} değerlendirmesi yeniden düzenlemeye açıldı.`,
            `/evaluator/assignments/${input.assignmentId}/evaluate`,
            input.assignmentId
          );
          await audit(
            ctx.user.id,
            "EVALUATION_REOPENED",
            "ASSIGNMENT",
            input.assignmentId
          );
          return { success: true };
        }),
    }),
    auditLogs: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(150);
    }),
  }),

  evaluator: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      if (
        !(["ADMIN", "TRAINING_MANAGER", "EVALUATOR"] as const).includes(
          ctx.user.role
        )
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const own = await db
        .select()
        .from(assignments)
        .where(eq(assignments.evaluatorId, ctx.user.id));
      const now = new Date();
      const nearDue = own.filter(
        item =>
          item.status !== "COMPLETED" &&
          item.dueDate.getTime() - now.getTime() <= 3 * 86400000 &&
          item.dueDate >= now
      ).length;
      return {
        pending: own.filter(
          item => item.status === "PENDING" || item.status === "REOPENED"
        ).length,
        drafts: own.filter(item => item.status === "DRAFT").length,
        completed: own.filter(item => item.status === "COMPLETED").length,
        nearDue,
      };
    }),
    assignments: protectedProcedure
      .input(z.object({ status: assignmentStatus.optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (
          !(["ADMIN", "TRAINING_MANAGER", "EVALUATOR"] as const).includes(
            ctx.user.role
          )
        )
          throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) return [];
        const own = await db
          .select({
            assignment: assignments,
            training: trainings,
            evaluationSet: evaluationSets,
          })
          .from(assignments)
          .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
          .leftJoin(
            evaluationSets,
            eq(assignments.evaluationSetId, evaluationSets.id)
          )
          .where(eq(assignments.evaluatorId, ctx.user.id));
        const now = new Date();
        return own
          .map(item => ({
            ...item.assignment,
            status:
              item.assignment.status !== "COMPLETED" &&
              item.assignment.dueDate < now
                ? "OVERDUE"
                : item.assignment.status,
            training: item.training,
            evaluationSet: item.evaluationSet,
            nearDue:
              item.assignment.status !== "COMPLETED" &&
              item.assignment.dueDate >= now &&
              item.assignment.dueDate.getTime() - now.getTime() <= 3 * 86400000,
          }))
          .filter(item => !input?.status || item.status === input.status);
      }),
    assignmentDetail: protectedProcedure
      .input(z.object({ assignmentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const record = await getOwnedAssignment(input.assignmentId, ctx.user);
        const [responseRows, setCriteria] = await Promise.all([
          db
            .select()
            .from(evaluations)
            .where(eq(evaluations.assignmentId, input.assignmentId))
            .limit(1)
            .then(rows => rows[0]),
          record.assignment.evaluationSetId
            ? db
                .select({
                  criterionId: evaluationSetCriteria.criterionId,
                  name: criteria.name,
                  description: criteria.description,
                  weight: evaluationSetCriteria.weight,
                })
                .from(evaluationSetCriteria)
                .innerJoin(
                  criteria,
                  eq(evaluationSetCriteria.criterionId, criteria.id)
                )
                .where(
                  eq(
                    evaluationSetCriteria.evaluationSetId,
                    record.assignment.evaluationSetId
                  )
                )
                .orderBy(
                  asc(evaluationSetCriteria.sortOrder),
                  asc(evaluationSetCriteria.id)
                )
            : Promise.resolve([]),
        ]);
        const responses = responseRows
          ? await db
              .select()
              .from(evaluationResponses)
              .where(eq(evaluationResponses.evaluationId, responseRows.id))
          : [];
        const evaluationSet = record.evaluationSet
          ? {
              ...record.evaluationSet,
              criteria: setCriteria.map(item => ({
                criterionId: item.criterionId,
                name: item.name,
                description: item.description ?? null,
                weight: Number(item.weight),
              })),
            }
          : null;
        return {
          ...record,
          evaluationSet,
          evaluation: responseRows ?? null,
          responses,
        };
      }),
    saveEvaluation: protectedProcedure
      .input(
        z.object({
          assignmentId: z.number().int().positive(),
          responses: z
            .array(
              z.object({
                criterionId: z.number().int().positive(),
                score: z.number().int(),
                comment: z.string().max(2000).optional().nullable(),
              })
            )
            .max(8),
          generalComment: z.string().max(5000).optional().nullable(),
          complete: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          !(["ADMIN", "TRAINING_MANAGER", "EVALUATOR"] as const).includes(
            ctx.user.role
          )
        )
          throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const record = await getOwnedAssignment(
          input.assignmentId,
          ctx.user,
          true
        );
        if (
          new Set(input.responses.map(item => item.criterionId)).size !==
          input.responses.length
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bir kriter için yalnızca bir yanıt verilebilir.",
          });
        const assignmentSetId = record.assignment.evaluationSetId ?? null;
        const assignmentSet = assignmentSetId
          ? (
              await db
                .select({
                  passingScore: evaluationSets.passingScore,
                  rubricScale: evaluationSets.rubricScale,
                })
                .from(evaluationSets)
                .where(eq(evaluationSets.id, assignmentSetId))
                .limit(1)
            )[0]
          : null;
        const maxScore = getRubricMaxScore(assignmentSet?.rubricScale ?? null);
        if (
          input.responses.some(
            response => response.score < 1 || response.score > maxScore
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Puan 1 ile ${maxScore} arasında olmalıdır.`,
          });
        }
        const activeCriteria = await db
          .select()
          .from(criteria)
          .where(eq(criteria.isActive, true));
        const setCriteria = assignmentSetId
          ? await db
              .select({
                criterionId: evaluationSetCriteria.criterionId,
                weight: evaluationSetCriteria.weight,
              })
              .from(evaluationSetCriteria)
              .where(eq(evaluationSetCriteria.evaluationSetId, assignmentSetId))
              .orderBy(
                asc(evaluationSetCriteria.sortOrder),
                asc(evaluationSetCriteria.id)
              )
          : [];
        const criteriaForEvaluation = setCriteria.length
          ? activeCriteria.filter(criterion =>
              setCriteria.some(item => item.criterionId === criterion.id)
            )
          : activeCriteria;
        if (
          input.complete &&
          (input.responses.length !== criteriaForEvaluation.length ||
            criteriaForEvaluation.some(
              criterion =>
                !input.responses.find(
                  response => response.criterionId === criterion.id
                )
            ))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Tamamlamak için ${criteriaForEvaluation.length} kriterin tümü puanlanmalıdır.`,
          });
        const existing = (
          await db
            .select()
            .from(evaluations)
            .where(eq(evaluations.assignmentId, input.assignmentId))
            .limit(1)
        )[0];
        const weightedCriteria = criteriaForEvaluation.map(criterion => {
          const response = input.responses.find(
            item => item.criterionId === criterion.id
          );
          const weight =
            setCriteria.find(item => item.criterionId === criterion.id)
              ?.weight ?? 100 / Math.max(criteriaForEvaluation.length, 1);
          return {
            score: response?.score ?? 0,
            weight,
          };
        });
        const summary = input.complete
          ? calculateWeightedEvaluationScores(
              weightedCriteria,
              Number(assignmentSet?.passingScore ?? 70),
              maxScore
            )
          : null;
        if (
          input.complete &&
          summary?.successStatus === "UNSUCCESSFUL" &&
          !input.generalComment?.trim()
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Başarısız değerlendirmelerde genel yorum zorunludur.",
          });
        }
        let evaluationId = existing?.id;
        if (!evaluationId) {
          const result = await db.insert(evaluations).values({
            assignmentId: input.assignmentId,
            evaluatorId: ctx.user.id,
            trainingId: record.assignment.trainingId,
            status: input.complete ? "COMPLETED" : "DRAFT",
            generalComment: input.generalComment,
            ...(summary ?? {}),
            submittedAt: input.complete ? new Date() : null,
          });
          evaluationId = Number(result.lastInsertRowid ?? 0);
        } else {
          await db
            .update(evaluations)
            .set({
              status: input.complete ? "COMPLETED" : "DRAFT",
              generalComment: input.generalComment,
              ...(summary ?? {}),
              submittedAt: input.complete ? new Date() : null,
            })
            .where(eq(evaluations.id, evaluationId));
        }
        for (const response of input.responses)
          await db
            .insert(evaluationResponses)
            .values({
              evaluationId,
              criterionId: response.criterionId,
              score: response.score,
              comment: response.comment,
            })
            .onConflictDoUpdate({
              target: [
                evaluationResponses.evaluationId,
                evaluationResponses.criterionId,
              ],
              set: { score: response.score, comment: response.comment },
            });
        await db
          .update(assignments)
          .set({
            status: input.complete ? "COMPLETED" : "DRAFT",
            completedAt: input.complete ? new Date() : null,
          })
          .where(eq(assignments.id, input.assignmentId));
        if (input.complete) {
          const admins = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true)));
          for (const admin of admins)
            await notify(
              admin.id,
              "EVALUATION_COMPLETED",
              "Değerlendirme tamamlandı",
              `${record.training.title} için değerlendirme tamamlandı.`,
              `/admin/trainings/${record.training.id}/evaluations`,
              input.assignmentId
            );
          await audit(
            ctx.user.id,
            "EVALUATION_COMPLETED",
            "EVALUATION",
            evaluationId
          );
        }
        return { success: true, evaluationId, summary };
      }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(30);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(
            and(
              eq(notifications.id, input.id),
              eq(notifications.userId, ctx.user.id)
            )
          );
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
