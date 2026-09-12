import { describe, expect, it } from "vitest";
import { getAllowedRolesForShell } from "@/components/AppShell";
import { getPostLoginPath } from "./authNavigation";

describe("giriş sonrası yönlendirme", () => {
  it("yöneticiyi yönetim göstergesine yönlendirir", () => {
    expect(getPostLoginPath("ADMIN", false)).toBe("/admin/dashboard");
  });

  it("eğitim yöneticisini yönetim göstergesine yönlendirir", () => {
    expect(getPostLoginPath("TRAINING_MANAGER", false)).toBe("/admin/dashboard");
  });

  it("değerlendiriciyi değerlendirme göstergesine yönlendirir", () => {
    expect(getPostLoginPath("EVALUATOR", false)).toBe("/evaluator/dashboard");
  });

  it("zorunlu parola değişimini rolün önüne alır", () => {
    expect(getPostLoginPath("ADMIN", true)).toBe("/change-password");
    expect(getPostLoginPath("TRAINING_MANAGER", true)).toBe("/change-password");
    expect(getPostLoginPath("EVALUATOR", true)).toBe("/change-password");
  });

  it("eğitim yöneticisi için izinli menü rolleri doğru kalır", () => {
    expect(getAllowedRolesForShell("TRAINING_MANAGER")).toEqual(["ADMIN", "TRAINING_MANAGER"]);
    expect(getAllowedRolesForShell("ADMIN")).toEqual(["ADMIN"]);
  });
});
