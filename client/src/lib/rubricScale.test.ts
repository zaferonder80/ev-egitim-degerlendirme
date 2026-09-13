import { describe, expect, it } from "vitest";

import { getRubricLabel } from "./rubricScale";

describe("getRubricLabel", () => {
  it("rubrik ölçeğindeki açıklamayı skor için döndürür", () => {
    expect(
      getRubricLabel(
        {
          "1": "Uygun değil",
          "2": "Geliştirilmesi gerekli",
          "3": "Kısmen uygun",
          "4": "Uygun",
          "5": "Özellikle güçlü",
        },
        2,
      ),
    ).toBe("Geliştirilmesi gerekli");
  });

  it("ölçek yoksa boş değer döndürür", () => {
    expect(getRubricLabel(undefined, 3)).toBe("");
  });
});
