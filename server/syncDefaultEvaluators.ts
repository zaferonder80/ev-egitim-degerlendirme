import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { DEFAULT_EVALUATOR_PASSWORD, defaultEvaluators } from "./defaultEvaluators";

export async function syncDefaultEvaluators() {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");

  const passwordHash = await bcrypt.hash(DEFAULT_EVALUATOR_PASSWORD, 12);
  const synced: string[] = [];

  for (const evaluator of defaultEvaluators) {
    const existing = (await db.select({ id: users.id }).from(users).where(eq(users.email, evaluator.email)).limit(1))[0];
    if (existing) {
      await db.update(users).set({
        firstName: evaluator.firstName,
        lastName: evaluator.lastName,
        name: evaluator.name,
        passwordHash,
        loginMethod: "password",
        role: "EVALUATOR",
        isActive: true,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({
        ...evaluator,
        passwordHash,
        loginMethod: "password",
        role: "EVALUATOR",
        isActive: true,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lastSignedIn: new Date(),
      });
    }
    synced.push(evaluator.email);
  }

  return synced;
}

if (process.argv[1]?.endsWith("syncDefaultEvaluators.ts")) {
  syncDefaultEvaluators()
    .then(emails => {
      console.log(`Varsayılan değerlendiriciler eşitlendi: ${emails.join(", ")}`);
      process.exit(0);
    })
    .catch(error => { console.error(error); process.exit(1); });
}
