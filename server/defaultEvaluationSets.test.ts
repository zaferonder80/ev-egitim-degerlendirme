import { describe, expect, it } from "vitest";

import { DEFAULT_EVALUATION_SETS } from "./defaultEvaluationSets";

describe("DEFAULT_EVALUATION_SETS", () => {
  it("varsayılan rubrik ölçeği istenen ifadeleri içerir", () => {
    const rubricScale = DEFAULT_EVALUATION_SETS[0].rubricScale;

    expect(rubricScale["1"]).toBe("Uygun değil");
    expect(rubricScale["2"]).toBe("Gelişmesi gerekli");
    expect(rubricScale["3"]).toBe("Kısmen uygun");
    expect(rubricScale["4"]).toBe("Uygun");
    expect(rubricScale["5"]).toBe("Mükemmel");
  });
});
