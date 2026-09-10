import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const offlineFiles = [
  new URL("../offline/ev-egitim-degerlendirme-offline.html", import.meta.url),
  new URL(
    "../offline/ev-egitim-degerlendirme-offline-veritabani-anlik-goruntu.html",
    import.meta.url
  ),
];

describe("çevrimdışı toplu atama", () => {
  it("her pakette birden fazla değerlendirici seçimini ve mükerrer atama engelini içerir", () => {
    for (const fileUrl of offlineFiles) {
      const html = readFileSync(fileUrl, "utf8");

      expect(html).toContain('name="evaluatorIds"');
      expect(html).toContain("window.saveAssignment");
      expect(html).toContain("Seçilen değerlendiricilerin tamamı bu eğitime zaten atanmış.");
      expect(html).toContain("mükerrer atama atlandı");
    }
  });

  it("tek değerlendirici seçimini aynı atama yolundan işler ve yerel depolamaya kaydeder", () => {
    for (const fileUrl of offlineFiles) {
      const html = readFileSync(fileUrl, "utf8");
      const assignmentIndex = html.indexOf("pending.forEach(evaluatorId=>db.assignments.push");
      const saveIndex = html.indexOf("save();closeModal();layout();toast", assignmentIndex);

      expect(html).toContain(
        "evaluatorIds=[...new Set(f.getAll('evaluatorIds').map(Number).filter(Boolean))]"
      );
      expect(assignmentIndex).toBeGreaterThan(-1);
      expect(saveIndex).toBeGreaterThan(assignmentIndex);
      expect(html).toContain("localStorage.setItem(KEY,JSON.stringify(db))");
    }
  });

  it("daha önce iletilen değerlendirici listesini varsayılan veri olarak içerir", () => {
    const html = readFileSync(offlineFiles[0], "utf8");

    for (const email of [
      "zafer.onder@lcwaikiki.com",
      "selinmerve.agca@lcwaikiki.com",
      "seyda.topcu@lcwaikiki.com",
      "yesim.sandikci@lcwaikiki.com",
      "ebru.celik@lcwaikiki.com",
      "tuba.tapar@lcwaikiki.com",
      "pinar.tuncsav@lcwaikiki.com",
      "fatma.cardak@lcwaikiki.com",
      "nazire.erton@lcwaikiki.com",
      "onur.izbul@lcwaikiki.com",
    ]) {
      expect(html).toContain(email);
    }
  });
});
