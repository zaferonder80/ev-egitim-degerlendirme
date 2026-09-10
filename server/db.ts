import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { sessions, users, type InsertUser } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({
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
