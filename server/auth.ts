import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, lt } from "drizzle-orm";
import { parse } from "cookie";
import { sessions, users, type User } from "../drizzle/schema";
import { getActiveSessionUser, getDb } from "./db";

export const APP_SESSION_COOKIE = "ev_evaluation_session";
const SESSION_DAYS = 8;
const LOCK_MINUTES = 15;
const MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_PER_IP = 30;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export type PasswordRuleResult = { valid: boolean; message?: string };

export function validateStrongPassword(password: string): PasswordRuleResult {
  if (password.length < 8) return { valid: false, message: "Şifre en az 8 karakter olmalıdır." };
  return { valid: true };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  return (typeof forwarded === "string" ? forwarded.split(",")[0] : req.ip ?? "bilinmiyor").trim().slice(0, 64);
}

function sessionOptions(req: Request) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || req.protocol === "https",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(APP_SESSION_COOKIE, token, sessionOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(APP_SESSION_COOKIE, { ...sessionOptions(req), maxAge: 0 });
}

export function assertLoginRateLimit(req: Request) {
  const key = clientIp(req);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > LOGIN_MAX_PER_IP) throw new Error("Bu IP adresi için çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.");
}

export async function createSession(userId: number, req: Request) {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const token = randomBytes(32).toString("base64url");
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    ipAddress: clientIp(req),
    userAgent: req.headers["user-agent"]?.slice(0, 512),
  });
  return token;
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const cookieToken = parse(req.headers.cookie ?? "")[APP_SESSION_COOKIE];
  const headerToken = req.headers["x-ev-session"];
  const token = cookieToken ?? (typeof headerToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(headerToken) ? headerToken : undefined);
  if (!token) return null;
  const session = await getActiveSessionUser(hashSessionToken(token));
  return session?.user?.isActive ? session.user : null;
}

async function provisionInitialAdminIfNeeded() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) return;
  const passwordRule = validateStrongPassword(password);
  if (!passwordRule.valid) throw new Error(`INITIAL_ADMIN_PASSWORD geçersiz: ${passwordRule.message}`);
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const currentAdmin = (await db.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN")).limit(1))[0];
  if (currentAdmin) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({
    openId: `initial:${hashSessionToken(email)}`,
    firstName: "İlk",
    lastName: "Yönetici",
    name: "İlk Yönetici",
    email,
    passwordHash,
    role: "ADMIN",
    isActive: true,
    mustChangePassword: true,
    loginMethod: "password",
  });
}

export async function loginWithPassword(email: string, password: string, req: Request) {
  assertLoginRateLimit(req);
  await provisionInitialAdminIfNeeded();
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const normalizedEmail = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  const genericError = new Error("E-posta veya şifre hatalı.");
  if (!user || !user.isActive) throw genericError;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("Hesap geçici olarak kilitlenmiştir. Lütfen daha sonra tekrar deneyin.");
  }
  const verified = await bcrypt.compare(password, user.passwordHash);
  if (!verified) {
    const count = user.failedLoginAttempts + 1;
    await db.update(users).set({
      failedLoginAttempts: count >= MAX_FAILURES ? 0 : count,
      lockedUntil: count >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
    }).where(eq(users.id, user.id));
    throw genericError;
  }
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

export async function setUserPassword(userId: number, password: string) {
  const rule = validateStrongPassword(password);
  if (!rule.valid) throw new Error(rule.message);
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
}
