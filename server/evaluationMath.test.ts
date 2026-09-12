import { describe, expect, it } from "vitest";
import {
  aggregateCompletedEvaluations,
  calculateEvaluationScores,
  calculateWeightedEvaluationScores,
} from "./evaluationMath";

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

  it("ağırlıklı kriterlerde yüzde toplamı ağırlıkla doğru hesaplanır", () => {
    const result = calculateWeightedEvaluationScores([
      { score: 4, weight: 20 },
      { score: 5, weight: 30 },
      { score: 3, weight: 50 },
    ]);

    expect(result.totalScore).toBe(76);
    expect(result.successPercentage).toBeCloseTo(76, 5);
    expect(result.successStatus).toBe("SUCCESSFUL");
  });

  it("başarı durumunu değerlendirme setinin baraj puanına göre belirler", () => {
    const criteria = Array.from({ length: 5 }, () => ({ score: 4, weight: 20 }));

    expect(calculateWeightedEvaluationScores(criteria, 80).successStatus).toBe("SUCCESSFUL");
    expect(calculateWeightedEvaluationScores(criteria, 80.01).successStatus).toBe("UNSUCCESSFUL");
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
