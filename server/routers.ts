import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  assignments,
  auditLogs,
  criteria,
  evaluationResponses,
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
} from "./evaluationMath";
import { createCriteriaChartData } from "./dashboardChartData";
import { storagePut } from "./storage";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";

const scoreScale = [1, 2, 3, 4, 5] as const;
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
  await db
    .insert(auditLogs)
    .values({
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
  await db
    .insert(notifications)
    .values({
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
      .select({ assignment: assignments, training: trainings })
      .from(assignments)
      .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
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
  trainingType: z.string().max(120).optional().nullable(),
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
  evaluationStartDate: z.date().optional().nullable(),
  evaluationEndDate: z.date().optional().nullable(),
  status: trainingStatus,
});

function validateTrainingDates(input: z.infer<typeof trainingInput>) {
  if (
    input.evaluationStartDate &&
    input.evaluationEndDate &&
    input.evaluationStartDate > input.evaluationEndDate
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Değerlendirme başlangıç tarihi bitiş tarihinden sonra olamaz.",
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
    dashboard: adminProcedure
      .input(
        z
          .object({
            period: z
              .enum(["ALL", "30_DAYS", "90_DAYS", "YEAR"])
              .default("ALL"),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [
          allTrainings,
          allAssignments,
          allCompleted,
          allUsers,
          activeCriteria,
        ] = await Promise.all([
          db.select().from(trainings),
          db.select().from(assignments),
          db
            .select()
            .from(evaluations)
            .where(eq(evaluations.status, "COMPLETED")),
          db.select().from(users),
          db
            .select()
            .from(criteria)
            .where(eq(criteria.isActive, true))
            .orderBy(asc(criteria.orderNumber)),
        ]);
        const days =
          input?.period === "30_DAYS"
            ? 30
            : input?.period === "90_DAYS"
              ? 90
              : input?.period === "YEAR"
                ? 365
                : null;
        const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
        const completed = cutoff
          ? allCompleted.filter(
              item => item.submittedAt && item.submittedAt >= cutoff
            )
          : allCompleted;
        const completedAssignmentIds = new Set(
          completed.map(item => item.assignmentId)
        );
        const aggregates = aggregateCompletedEvaluations(
          await Promise.all(
            completed.map(async evaluation =>
              (
                await db
                  .select()
                  .from(evaluationResponses)
                  .where(eq(evaluationResponses.evaluationId, evaluation.id))
              )
                .sort((a, b) => a.criterionId - b.criterionId)
                .map(response => response.score)
            )
          )
        );
        const successfulTrainings = new Set(
          completed
            .filter(item => item.successStatus === "SUCCESSFUL")
            .map(item => item.trainingId)
        );
        const unsuccessfulTrainings = new Set(
          completed
            .filter(item => item.successStatus === "UNSUCCESSFUL")
            .map(item => item.trainingId)
        );
        const evaluatorUsers = allUsers.filter(
          user => user.role === "EVALUATOR"
        );
        const evaluatorCompletion = evaluatorUsers.map(user => {
          const assigned = allAssignments.filter(
            item => item.evaluatorId === user.id
          );
          return {
            name: `${user.firstName} ${user.lastName}`,
            completionRate: assigned.length
              ? (assigned.filter(item => completedAssignmentIds.has(item.id))
                  .length /
                  assigned.length) *
                100
              : 0,
          };
        });
        return {
          cards: {
            totalTrainings: allTrainings.length,
            activeAssignments: allAssignments.filter(
              item => !completedAssignmentIds.has(item.id)
            ).length,
            completedEvaluations: completed.length,
            pendingEvaluations: allAssignments.filter(
              item => !completedAssignmentIds.has(item.id)
            ).length,
            successfulTrainings: successfulTrainings.size,
            unsuccessfulTrainings: unsuccessfulTrainings.size,
            completionRate: allAssignments.length
              ? (completed.length / allAssignments.length) * 100
              : 0,
          },
          charts: {
            success: [
              { name: "Başarılı", value: successfulTrainings.size },
              { name: "Başarısız", value: unsuccessfulTrainings.size },
            ],
            criteria: createCriteriaChartData(
              activeCriteria,
              aggregates.criterionAverages
            ),
            evaluators: evaluatorCompletion,
          },
        };
      }),
    users: router({
      list: adminProcedure
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
            role: z.enum(["ADMIN", "EVALUATOR"]),
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
          const result = await db
            .insert(users)
            .values({
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
            role: z.enum(["ADMIN", "EVALUATOR"]),
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
          await db
            .update(users)
            .set({
              firstName: input.firstName,
              lastName: input.lastName,
              name: `${input.firstName} ${input.lastName}`,
              role: input.role,
              isActive: input.isActive,
            })
            .where(eq(users.id, input.id));
          await audit(ctx.user.id, "USER_UPDATED", "USER", input.id, {
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
    }),
    trainings: router({
      list: adminProcedure
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
              completedEvaluatorIds: matches
                .filter(assignment => assignment.status === "COMPLETED")
                .map(assignment => assignment.evaluatorId),
              assignedCount: matches.length,
              completedCount: completed.length,
              pendingCount: matches.length - completed.length,
              averageTotal,
              successPercentage:
                averageTotal === null ? null : (averageTotal / 40) * 100,
              successStatus:
                averageTotal === null
                  ? null
                  : (averageTotal / 40) * 100 >= 70
                    ? "SUCCESSFUL"
                    : "UNSUCCESSFUL",
            };
          });
        }),
      create: adminProcedure
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
              await db
                .insert(assignments)
                .values({
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
      update: adminProcedure
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
      archive: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await db
            .update(trainings)
            .set({ status: "ARCHIVED" })
            .where(eq(trainings.id, input.id));
          await audit(ctx.user.id, "TRAINING_ARCHIVED", "TRAINING", input.id);
          return { success: true };
        }),
      detail: adminProcedure
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
            .select({ assignment: assignments, evaluator: users })
            .from(assignments)
            .innerJoin(users, eq(assignments.evaluatorId, users.id))
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
              evaluation:
                resultEvaluations.find(
                  evaluation => evaluation.assignmentId === record.assignment.id
                ) ?? null,
            })),
          };
        }),
      assign: adminProcedure
        .input(
          z.object({
            trainingId: z.number().int().positive(),
            evaluatorIds: z.array(z.number().int().positive()),
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
          const evaluatorRows = await db
            .select()
            .from(users)
            .where(
              and(
                inArray(users.id, uniqueEvaluatorIds),
                eq(users.role, "EVALUATOR"),
                eq(users.isActive, true)
              )
            );
          if (evaluatorRows.length !== uniqueEvaluatorIds.length)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Yalnızca aktif değerlendiriciler atanabilir.",
            });
          const desiredEvaluatorIds = new Set(uniqueEvaluatorIds);
          const existingAssignments = await db
            .select()
            .from(assignments)
            .where(eq(assignments.trainingId, input.trainingId));
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
                    eq(assignments.evaluatorId, evaluator.id)
                  )
                )
                .limit(1)
            )[0];
            if (existing) {
              await db
                .update(assignments)
                .set({ dueDate: input.dueDate, assignedById: ctx.user.id })
                .where(eq(assignments.id, existing.id));
              continue;
            }
            await db
              .insert(assignments)
              .values({
                trainingId: input.trainingId,
                evaluatorId: evaluator.id,
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
            { evaluatorIds: uniqueEvaluatorIds }
          );
          return { success: true };
        }),
      reopen: adminProcedure
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
      if (ctx.user.role !== "EVALUATOR")
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
        if (ctx.user.role !== "EVALUATOR")
          throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) return [];
        const own = await db
          .select({ assignment: assignments, training: trainings })
          .from(assignments)
          .innerJoin(trainings, eq(assignments.trainingId, trainings.id))
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
        const responseRows = (
          await db
            .select()
            .from(evaluations)
            .where(eq(evaluations.assignmentId, input.assignmentId))
            .limit(1)
        )[0];
        const responses = responseRows
          ? await db
              .select()
              .from(evaluationResponses)
              .where(eq(evaluationResponses.evaluationId, responseRows.id))
          : [];
        return { ...record, evaluation: responseRows ?? null, responses };
      }),
    saveEvaluation: protectedProcedure
      .input(
        z.object({
          assignmentId: z.number().int().positive(),
          responses: z
            .array(
              z.object({
                criterionId: z.number().int().positive(),
                score: z
                  .number()
                  .int()
                  .refine(
                    value =>
                      scoreScale.includes(value as (typeof scoreScale)[number]),
                    "Puan 1 ile 5 arasında olmalıdır."
                  ),
                comment: z.string().max(2000).optional().nullable(),
              })
            )
            .max(8),
          generalComment: z.string().max(5000).optional().nullable(),
          complete: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "EVALUATOR")
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
        const activeCriteria = await db
          .select()
          .from(criteria)
          .where(eq(criteria.isActive, true));
        if (
          input.complete &&
          (input.responses.length !== 8 ||
            activeCriteria.some(
              criterion =>
                !input.responses.find(
                  response => response.criterionId === criterion.id
                )
            ))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tamamlamak için sekiz kriterin tümü puanlanmalıdır.",
          });
        const existing = (
          await db
            .select()
            .from(evaluations)
            .where(eq(evaluations.assignmentId, input.assignmentId))
            .limit(1)
        )[0];
        const summary = input.complete
          ? calculateEvaluationScores(
              activeCriteria.map(
                criterion =>
                  input.responses.find(
                    response => response.criterionId === criterion.id
                  )!.score
              )
            )
          : null;
        let evaluationId = existing?.id;
        if (!evaluationId) {
          const result = await db
            .insert(evaluations)
            .values({
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
              target: [evaluationResponses.evaluationId, evaluationResponses.criterionId],
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
