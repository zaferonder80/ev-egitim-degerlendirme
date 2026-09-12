import PDFDocument from "pdfkit";
import { asc, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { criteria, evaluationResponses, evaluations, assignments, trainings, users } from "../drizzle/schema";
import { getDb } from "./db";

const dateText = (value?: Date | null) => value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(value) : "—";
const text = (value?: string | null) => value?.trim() || "—";
const bundledFont = path.join(process.cwd(), "server/assets/DejaVuSans.ttf");
const productionFont = path.join(process.cwd(), "dist/assets/DejaVuSans.ttf");
const fontFile = fs.existsSync(productionFont) ? productionFont : bundledFont;

export async function buildTrainingEvaluationPdf(trainingId: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  if (!training) throw new Error("Eğitim bulunamadı.");
  const [criteriaRows, assessmentRows] = await Promise.all([
    db.select().from(criteria).where(eq(criteria.isActive, true)).orderBy(asc(criteria.orderNumber)),
    db.select({ assignment: assignments, evaluator: users, evaluation: evaluations }).from(assignments).innerJoin(users, eq(assignments.evaluatorId, users.id)).leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id)).where(eq(assignments.trainingId, trainingId)),
  ]);
  const responseMap = new Map<number, Map<number, { score: number; comment: string | null }>>();
  for (const row of assessmentRows) {
    if (!row.evaluation) continue;
    const responses = await db.select().from(evaluationResponses).where(eq(evaluationResponses.evaluationId, row.evaluation.id));
    responseMap.set(row.evaluation.id, new Map(responses.map(item => [item.criterionId, item])));
  }
  const completed = assessmentRows.filter(row => row.evaluation?.status === "COMPLETED" && row.evaluation.totalScore !== null);
  const averageTotal = completed.length ? completed.reduce((sum, row) => sum + (row.evaluation?.totalScore ?? 0), 0) / completed.length : 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 52, bufferPages: true, info: { Title: `Değerlendirme Raporu - ${training.code}`, Author: "E/V Eğitim Değerlendirme Sistemi" } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.font(fontFile);
    const contentBottom = 758;
    const header = () => { doc.fillColor("#0B385D").fontSize(15).text("E/V EĞİTİM İÇERİK DEĞERLENDİRME SİSTEMİ", { align: "left" }); doc.moveDown(0.2).strokeColor("#14A6A0").lineWidth(2).moveTo(52, doc.y).lineTo(543, doc.y).stroke().moveDown(1.2); doc.fillColor("#0F172A"); };
    const startPage = () => { doc.addPage(); header(); };
    const space = (height: number) => { if (doc.y + height > contentBottom) startPage(); };
    const tableRow = (columns: Array<{ text: string; width: number; align?: "left" | "right" | "center" }>, shaded = false) => { const x = 52; const lineHeight = 13; const height = Math.max(...columns.map(column => doc.heightOfString(column.text, { width: column.width - 10, lineGap: 2 })) as number[], lineHeight) + 12; space(height); const rowY = doc.y; if (shaded) doc.save().fillColor("#EEF6F6").rect(x, rowY, 491, height).fill().restore(); let cursor = x; columns.forEach(column => { doc.fillColor("#1E293B").fontSize(8.5).text(column.text, cursor + 5, rowY + 6, { width: column.width - 10, align: column.align ?? "left", lineGap: 2 }); cursor += column.width; }); doc.y = rowY + height; };
    const sectionTitle = (title: string) => { space(42); doc.fillColor("#0B385D").fontSize(13).text(title); doc.moveDown(0.5); };

    header();
    doc.fillColor("#14A6A0").fontSize(10).text("PDF DEĞERLENDİRME ÖZET RAPORU", { characterSpacing: 1.2 });
    doc.fillColor("#0B385D").fontSize(24).text(training.title, { width: 470, lineGap: 6 });
    doc.moveDown(0.8).fillColor("#475569").fontSize(10).text(`Eğitim Kodu: ${training.code}   •   Sürüm: ${training.version}   •   Rapor tarihi: ${dateText(new Date())}`);
    doc.moveDown(1.8);
    doc.fillColor("#0B385D").fontSize(13).text("Eğitim Künyesi"); doc.moveDown(0.5);
    tableRow([{ text: "Eğitim türü", width: 150 }, { text: text(training.trainingType), width: 341 }], true);
    tableRow([{ text: "Hedef kitle", width: 150 }, { text: text(training.targetAudience), width: 341 }]);
    tableRow([{ text: "Sorumlu", width: 150 }, { text: text(training.contentOwner), width: 341 }], true);
    tableRow([{ text: "Süre", width: 150 }, { text: training.durationMinutes ? `${training.durationMinutes} dakika` : "—", width: 341 }]);
    tableRow([{ text: "Değerlendirme son tarihi", width: 150 }, { text: dateText(training.evaluationEndDate), width: 341 }], true);
    doc.moveDown(1.3); sectionTitle("Değerlendirme Özeti");
    tableRow([{ text: "Atanan değerlendirici", width: 245, align: "center" }, { text: "Tamamlanan değerlendirme", width: 246, align: "center" }], true);
    tableRow([{ text: String(assessmentRows.length), width: 245, align: "center" }, { text: String(completed.length), width: 246, align: "center" }]);
    tableRow([{ text: "Ortalama toplam puan", width: 245, align: "center" }, { text: "Başarı durumu", width: 246, align: "center" }], true);
    tableRow([{ text: completed.length ? `${averageTotal.toFixed(2)} / 100` : "—", width: 245, align: "center" }, { text: completed.length ? (averageTotal >= 70 ? "Başarılı" : "Başarısız") : "Henüz sonuç yok", width: 246, align: "center" }]);
    startPage(); doc.fillColor("#0B385D").fontSize(13).text("Kriter Bazlı Sonuçlar"); doc.moveDown(0.5);
    tableRow([{ text: "Kriter", width: 280 }, { text: "Ort. puan", width: 100, align: "center" }, { text: "Açıklama", width: 111 }], true);
    criteriaRows.forEach(criterion => { const values = completed.map(row => responseMap.get(row.evaluation!.id)?.get(criterion.id)?.score).filter((value): value is number => typeof value === "number"); const average = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : "—"; tableRow([{ text: `${criterion.orderNumber}. ${criterion.name}`, width: 280 }, { text: average, width: 100, align: "center" }, { text: values.length ? `${values.length} yanıt` : "Yanıt yok", width: 111 }]); });
    startPage(); doc.fillColor("#0B385D").fontSize(13).text("Değerlendirici Bazlı Sonuçlar"); doc.moveDown(0.5);
    tableRow([{ text: "Değerlendirici", width: 190 }, { text: "Durum", width: 95 }, { text: "Puan", width: 70, align: "center" }, { text: "Genel yorum", width: 136 }], true);
    assessmentRows.forEach(row => { const evaluation = row.evaluation; tableRow([{ text: `${row.evaluator.firstName} ${row.evaluator.lastName}`, width: 190 }, { text: evaluation?.status === "COMPLETED" ? "Tamamlandı" : row.assignment.status === "DRAFT" ? "Taslak" : "Bekliyor", width: 95 }, { text: evaluation?.totalScore == null ? "—" : `${evaluation.totalScore}/100`, width: 70, align: "center" }, { text: text(evaluation?.generalComment), width: 136 }]); });
    startPage(); doc.fillColor("#0B385D").fontSize(13).text("Kriter Bazlı Değerlendirici Yorumları"); doc.moveDown(0.5); doc.fillColor("#475569").fontSize(9).text("Yalnızca kayıtlı yorumlar listelenir. Her yorum, kriteri ve değerlendiricisiyle birlikte sunulur."); doc.moveDown(0.8);
    criteriaRows.forEach(criterion => {
      const comments = completed.flatMap(row => {
        const response = responseMap.get(row.evaluation!.id)?.get(criterion.id);
        return response?.comment?.trim() ? [{ evaluator: `${row.evaluator.firstName} ${row.evaluator.lastName}`, comment: response.comment.trim() }] : [];
      });
      sectionTitle(`${criterion.orderNumber}. ${criterion.name}`);
      if (!comments.length) { doc.fillColor("#64748B").fontSize(9).text("Bu kriter için kayıtlı yorum bulunmuyor."); doc.moveDown(0.7); return; }
      comments.forEach((item, index) => {
        const label = `${index + 1}. ${item.evaluator}`;
        const bodyHeight = doc.heightOfString(item.comment, { width: 451, lineGap: 3 });
        space(42 + bodyHeight);
        doc.fillColor("#0B385D").fontSize(9.5).text(label);
        doc.moveDown(0.25).fillColor("#334155").fontSize(9).text(item.comment, { width: 451, lineGap: 3 });
        doc.moveDown(0.8);
      });
    });
    const pageCount = doc.bufferedPageRange().count;
    for (let index = 0; index < pageCount; index += 1) {
      doc.switchToPage(index);
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor("#64748B").fontSize(7.5).text("E/V Eğitim İçerik Değerlendirme Sistemi • Gizli", 52, 790, { width: 360, lineBreak: false });
      doc.text(`Sayfa ${index + 1} / ${pageCount}`, 410, 790, { width: 133, align: "right", lineBreak: false });
      doc.page.margins.bottom = originalBottomMargin;
    }
    doc.end();
  });
}
