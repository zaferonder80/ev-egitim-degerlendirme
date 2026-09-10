import { and, eq, gte, lt, ne } from "drizzle-orm";
import { assignments, notifications, trainings } from "../drizzle/schema";
import { getDb } from "./db";

function dayWindow(daysFromToday: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + daysFromToday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Günlük tetikleyici tekrar çağrılsa bile aynı atama için gün içinde tek bildirim üretir. */
export async function createThreeDayDueReminders() {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const { start, end } = dayWindow(3);
  const candidates = await db.select({ assignment: assignments, training: trainings }).from(assignments).innerJoin(trainings, eq(assignments.trainingId, trainings.id)).where(and(gte(assignments.dueDate, start), lt(assignments.dueDate, end), ne(assignments.status, "COMPLETED")));
  let created = 0;
  for (const candidate of candidates) {
    const existing = (await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, candidate.assignment.evaluatorId), eq(notifications.type, "DUE_REMINDER"), eq(notifications.relatedEntityId, candidate.assignment.id), gte(notifications.createdAt, start), lt(notifications.createdAt, end))).limit(1))[0];
    if (existing) continue;
    await db.insert(notifications).values({ userId: candidate.assignment.evaluatorId, type: "DUE_REMINDER", title: "Değerlendirme son tarihi yaklaşıyor", message: `${candidate.training.title} değerlendirmesinin son tarihi üç gün sonra.`, link: `/evaluator/assignments/${candidate.assignment.id}/evaluate`, relatedEntityType: "assignment", relatedEntityId: candidate.assignment.id });
    created += 1;
  }
  return { examined: candidates.length, created };
}
