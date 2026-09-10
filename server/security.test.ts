import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { validateStrongPassword } from "./auth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function evaluatorContext(): TrpcContext {
  const now = new Date();
  return { user: { id: 9, openId: "local:test", firstName: "Test", lastName: "Değerlendirici", name: "Test Değerlendirici", email: "test@example.com", passwordHash: "!test!", loginMethod: "password", role: "EVALUATOR", isActive: true, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, createdAt: now, updatedAt: now, lastSignedIn: now }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
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
});
