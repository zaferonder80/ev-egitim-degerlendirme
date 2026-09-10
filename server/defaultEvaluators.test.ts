import { describe, expect, it } from "vitest";
import { DEFAULT_EVALUATOR_PASSWORD, defaultEvaluators } from "./defaultEvaluators";

describe("varsayılan değerlendirici hesapları", () => {
  it("on benzersiz ve yönetici olmayan hesabı içerir", () => {
    expect(defaultEvaluators).toHaveLength(10);
    expect(new Set(defaultEvaluators.map(user => user.email))).toHaveLength(10);
    expect(defaultEvaluators.every(user => user.email.endsWith("@lcwaikiki.com"))).toBe(true);
  });

  it("başlangıç parolasının güçlü parola politikasını karşıladığını doğrular", () => {
    expect(DEFAULT_EVALUATOR_PASSWORD).toMatch(/^(?=.*[a-zçğıöşü])(?=.*[A-ZÇĞİÖŞÜ])(?=.*\d)(?=.*[^A-Za-zÇĞİÖŞÜçğıöşü\d]).{12,}$/);
  });
});
