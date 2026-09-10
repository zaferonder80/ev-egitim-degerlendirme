import { describe, expect, it } from "vitest";
import { aggregateCompletedEvaluations, calculateEvaluationScores } from "./evaluationMath";

describe("calculateEvaluationScores", () => {
  it("sekiz kriterin toplamını, ortalamasını ve yüzdesini hesaplar", () => {
    expect(calculateEvaluationScores([5, 4, 3, 4, 3, 4, 4, 5])).toEqual({ totalScore: 32, averageScore: 4, successPercentage: 80, successStatus: "SUCCESSFUL" });
  });

  it("%70 başarı eşiğini kapsayıcı olarak uygular", () => {
    expect(calculateEvaluationScores([4, 4, 4, 3, 3, 3, 3, 4]).successStatus).toBe("SUCCESSFUL");
    expect(calculateEvaluationScores([3, 3, 3, 3, 3, 3, 3, 3]).successStatus).toBe("UNSUCCESSFUL");
  });

  it("sekiz olmayan veya geçersiz puanları reddeder", () => {
    expect(() => calculateEvaluationScores([1, 2, 3])).toThrow("sekiz adet");
    expect(() => calculateEvaluationScores([1, 1, 1, 1, 1, 1, 1, 6])).toThrow("1 ile 5");
  });
});

describe("aggregateCompletedEvaluations", () => {
  it("taslak dışarıda bırakıldıktan sonra tamamlanmış sonuçları toplulaştırır", () => {
    const result = aggregateCompletedEvaluations([[5, 5, 5, 5, 5, 5, 5, 5], [3, 3, 3, 3, 3, 3, 3, 3]]);
    expect(result.completedCount).toBe(2);
    expect(result.averageTotalScore).toBe(32);
    expect(result.successPercentage).toBe(80);
    expect(result.criterionAverages).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
  });
});
