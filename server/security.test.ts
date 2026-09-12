import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { validateStrongPassword } from "./auth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function evaluatorContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 9, openId: "local:test", firstName: "Test", lastName: "Değerlendirici", name: "Test Değerlendirici", email: "test@example.com", passwordHash: "!test!", loginMethod: "password", role: "EVALUATOR", isActive: true, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function trainingManagerContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 7, openId: "local:manager", firstName: "Test", lastName: "Yönetici", name: "Test Yönetici", email: "manager@example.com", passwordHash: "!test!", loginMethod: "password", role: "TRAINING_MANAGER", isActive: true, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function adminContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 1, openId: "local:admin", firstName: "Test", lastName: "Admin", name: "Test Admin", email: "admin@example.com", passwordHash: "!test!", loginMethod: "password", role: "ADMIN", isActive: true, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("parola kuralları", () => {
  it("yalnızca minimum uzunluğu zorunlu tutar", () => {
    expect(validateStrongPassword("1234567").valid).toBe(false);
    expect(validateStrongPassword("12345678").valid).toBe(true);
    expect(validateStrongPassword("sadecekucukharf").valid).toBe(true);
  });
});

describe("sunucu tarafı RBAC", () => {
  it("değerlendiricinin yönetici göstergesine erişimini engeller", async () => {
    const caller = appRouter.createCaller(evaluatorContext());
    await expect(caller.admin.dashboard()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  it("eğitim yöneticisinin değerlendirme seti ve kullanıcı listesini okuyabilmesini sağlar", async () => {
    const caller = appRouter.createCaller(trainingManagerContext());
    await expect(caller.admin.evaluationSets.list()).resolves.toBeDefined();
    await expect(caller.admin.users.list({ activeOnly: true })).resolves.toBeDefined();
  });

  it("eğitim yöneticisi ve admin kendi atamalarını görebilmelidir", async () => {
    const managerCaller = appRouter.createCaller(trainingManagerContext());
    const adminCaller = appRouter.createCaller(adminContext());

    await expect(managerCaller.evaluator.assignments()).resolves.toEqual(expect.any(Array));
    await expect(adminCaller.evaluator.assignments()).resolves.toEqual(expect.any(Array));
  });
});
