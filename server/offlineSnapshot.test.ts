import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const htmlPath = new URL(
  "../offline/ev-egitim-degerlendirme-offline-veritabani-anlik-goruntu.html",
  import.meta.url
);

function readEmbeddedSnapshot() {
  const html = readFileSync(htmlPath, "utf8");
  const match = html.match(/const\s+SNAPSHOT_GZIP_B64\s*=\s*`([\s\S]*?)`;/);
  if (!match) throw new Error("Gömülü anlık görüntü bulunamadı.");

  const compressed = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  return {
    html,
    snapshot: JSON.parse(gunzipSync(compressed).toString("utf8")),
  };
}

describe("çevrimdışı veritabanı anlık görüntüsü", () => {
  it("gömülü veriyi açar ve güncel iş kayıtlarını korur", () => {
    const { snapshot } = readEmbeddedSnapshot();
    expect(snapshot.data.users).toHaveLength(14);
    expect(snapshot.data.trainings).toHaveLength(6);
    expect(snapshot.data.assignments).toHaveLength(19);
    expect(snapshot.data.evaluations).toHaveLength(9);
    expect(snapshot.data.evaluationResponses).toHaveLength(72);
    expect(snapshot.data.criteria).toHaveLength(8);
    expect(snapshot.data.notifications).toHaveLength(24);
    expect(snapshot.data.auditLogs).toHaveLength(39);
  });

  it("haricî stil veya betik kaynağı kullanmaz", () => {
    const { html } = readEmbeddedSnapshot();
    expect(html).not.toMatch(/<script[^>]+\bsrc\s*=/i);
    expect(html).not.toMatch(/<link[^>]+\bhref\s*=\s*["']https?:\/\//i);
  });
});
