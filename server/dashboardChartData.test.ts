import { describe, expect, it } from "vitest";
import { createCriteriaChartData } from "./dashboardChartData";

describe("createCriteriaChartData", () => {
  it("grafik etiketi, puanı ve kriter metnini birlikte üretir", () => {
    expect(createCriteriaChartData([
      { orderNumber: 1, name: "İçerik doğruluğu", description: "Bilgiler güncel ve güvenilir olmalıdır." },
      { orderNumber: 2, name: "Anlatım açıklığı", description: null },
    ], [4.25, 3.5])).toEqual([
      { name: "K1", value: 4.25, text: "İçerik doğruluğu", description: "Bilgiler güncel ve güvenilir olmalıdır." },
      { name: "K2", value: 3.5, text: "Anlatım açıklığı", description: null },
    ]);
  });

  it("eksik ortalama için sıfır puan kullanır", () => {
    expect(createCriteriaChartData([{ orderNumber: 8, name: "Genel kalite", description: "  " }], [])).toEqual([
      { name: "K8", value: 0, text: "Genel kalite", description: null },
    ]);
  });
});
