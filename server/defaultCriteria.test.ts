import { describe, expect, it } from "vitest";
import { DEFAULT_CRITERIA } from "./defaultCriteria";

describe("varsayılan kriter listesi", () => {
  it("uygulamada kullanılacak sekiz varsayılan kriteri içerir", () => {
    expect(DEFAULT_CRITERIA).toHaveLength(8);
    expect(DEFAULT_CRITERIA.map(criterion => criterion.name)).toEqual([
      "Amaç ve hedeflerin netliği",
      "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu",
      "İçeriğin farklı öğrenme stillerine uygunluğu",
      "Eğitim içerik hiyerarşisinin uygunluğu",
      "Eğitimde verilen örneklerin, alıştırmaların ve etkileşimlerin yeterliliği ve etkililiği",
      "İçeriğin bilgi yoğunluğu ile toplam eğitim süresinin uygunluğu",
      "Video, ses, montaj ve görsellerin kalitesi",
      "Ölçme ve değerlendirme aracının eğitim içeriğine ve hedef kitleye uygunluğu",
    ]);
  });
});
