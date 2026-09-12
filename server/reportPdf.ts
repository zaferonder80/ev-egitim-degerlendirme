import PDFDocument from "pdfkit";
import { and, asc, eq, inArray } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { criteria, evaluationResponses, evaluations, assignments, evaluationSetCriteria, trainings, users } from "../drizzle/schema";
import { getDb } from "./db";

const dateText = (value?: Date | null) => value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(value) : "—";
const text = (value?: string | null) => value?.trim() || "—";
const bundledFont = path.join(process.cwd(), "server/assets/DejaVuSans.ttf");
const bundledBoldFont = path.join(process.cwd(), "server/assets/DejaVuSans-Bold.ttf");
const productionFont = path.join(process.cwd(), "dist/assets/DejaVuSans.ttf");
const productionBoldFont = path.join(process.cwd(), "dist/assets/DejaVuSans-Bold.ttf");
const fontFile = fs.existsSync(productionFont) ? productionFont : bundledFont;
const boldFontFile = fs.existsSync(productionBoldFont) ? productionBoldFont : bundledBoldFont;
const academyLogoFile = path.join(process.cwd(), "server/assets/lc-waikiki-akademi.png");

export async function buildTrainingEvaluationPdf(trainingId: number, evaluationSetId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  if (!training) throw new Error("Eğitim bulunamadı.");
  const assessmentRows = await db.select({ assignment: assignments, evaluator: users, evaluation: evaluations }).from(assignments).innerJoin(users, eq(assignments.evaluatorId, users.id)).leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id)).where(eq(assignments.trainingId, trainingId));
  const selectedSetId = evaluationSetId;
  const assignedSetIds = Array.from(new Set(assessmentRows.map(row => row.assignment.evaluationSetId).filter((id): id is number => id !== null)));
  const setCriterionRows = selectedSetId
    ? await db.select({ criterion: criteria, weight: evaluationSetCriteria.weight }).from(evaluationSetCriteria).innerJoin(criteria, eq(evaluationSetCriteria.criterionId, criteria.id)).where(and(eq(evaluationSetCriteria.evaluationSetId, selectedSetId), eq(criteria.isActive, true))).orderBy(asc(evaluationSetCriteria.sortOrder), asc(evaluationSetCriteria.id))
    : assignedSetIds.length
      ? await db.select({ criterion: criteria, weight: evaluationSetCriteria.weight }).from(evaluationSetCriteria).innerJoin(criteria, eq(evaluationSetCriteria.criterionId, criteria.id)).where(and(inArray(evaluationSetCriteria.evaluationSetId, assignedSetIds), eq(criteria.isActive, true))).orderBy(asc(criteria.orderNumber))
      : [];
  const criteriaRows = setCriterionRows.length
    ? Array.from(new Map(setCriterionRows.map(row => [row.criterion.id, row])).values())
    : assignedSetIds.length ? [] : (await db.select().from(criteria).where(eq(criteria.isActive, true)).orderBy(asc(criteria.orderNumber))).map(criterion => ({ criterion, weight: null }));
  const filteredAssessmentRows = selectedSetId ? assessmentRows.filter(row => row.assignment.evaluationSetId === selectedSetId) : assessmentRows;
  const responseMap = new Map<number, Map<number, { score: number; comment: string | null }>>();
  for (const row of filteredAssessmentRows) {
    if (!row.evaluation) continue;
    const responses = await db.select().from(evaluationResponses).where(eq(evaluationResponses.evaluationId, row.evaluation.id));
    responseMap.set(row.evaluation.id, new Map(responses.map(item => [item.criterionId, item])));
  }
  const completed = filteredAssessmentRows.filter(row => row.evaluation?.status === "COMPLETED" && row.evaluation.totalScore !== null);
  const averageTotal = completed.length ? completed.reduce((sum, row) => sum + (row.evaluation?.totalScore ?? 0), 0) / completed.length : 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 52, bufferPages: true, info: { Title: `Değerlendirme Raporu - ${training.code}`, Author: "E/V Eğitim Değerlendirme Sistemi" } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.font(fontFile);
    const contentBottom = 758;
    const drawAcademyLogo = () => { const x = 448; const y = 42; if (fs.existsSync(academyLogoFile)) { doc.image(academyLogoFile, x, y, { fit: [95, 28], align: "right" }); return; } doc.save().strokeColor("#D94B95").lineWidth(2).roundedRect(x, y, 95, 28, 7).stroke().fillColor("#07549A").font(boldFontFile).fontSize(11).text("LC WAIKIKI", x + 8, y + 6, { width: 80, align: "center", lineBreak: false }).fillColor("#D94B95").font(fontFile).fontSize(5.5).text("KURUMSAL AKADEMI", x + 8, y + 18, { width: 80, align: "center", lineBreak: false }).restore(); };
    const header = () => { drawAcademyLogo(); doc.x = 52; doc.y = 52; doc.font(fontFile).fillColor("#0B385D").fontSize(15).text("E/V EĞİTİM İÇERİK DEĞERLENDİRME SİSTEMİ", { align: "left", width: 370 }); doc.x = 52; doc.moveDown(0.2).strokeColor("#14A6A0").lineWidth(2).moveTo(52, doc.y).lineTo(543, doc.y).stroke().moveDown(1.2); doc.x = 52; doc.fillColor("#0F172A"); };
    const startPage = () => { doc.addPage(); header(); };
    const space = (height: number) => { if (doc.y + height > contentBottom) startPage(); };
    const tableRow = (columns: Array<{ text: string; width: number; align?: "left" | "right" | "center" }>, shaded = false) => { const x = 52; const lineHeight = 13; doc.font(fontFile); const height = Math.max(...columns.map(column => doc.heightOfString(column.text, { width: column.width - 10, lineGap: 2 })) as number[], lineHeight) + 12; space(height); const rowY = doc.y; if (shaded) doc.save().fillColor("#EEF6F6").rect(x, rowY, 491, height).fill().restore(); let cursor = x; columns.forEach(column => { doc.fillColor("#1E293B").fontSize(8.5).text(column.text, cursor + 5, rowY + 6, { width: column.width - 10, align: column.align ?? "left", lineGap: 2 }); cursor += column.width; }); doc.y = rowY + height; };
    const sectionTitle = (title: string) => { space(42); doc.font(boldFontFile).fillColor("#0B385D").fontSize(13).text(title); doc.moveDown(0.5); };

    header();
    doc.x = 52; doc.fillColor("#14A6A0").fontSize(10).text("PDF DEĞERLENDİRME ÖZET RAPORU", { align: "left", characterSpacing: 1.2 });
    doc.x = 52; doc.font(boldFontFile).fillColor("#0B385D").fontSize(24).text(training.title, { align: "left", width: 470, lineGap: 6 });
    doc.x = 52; doc.moveDown(0.8).fillColor("#475569").fontSize(10).text(`Eğitim Kodu: ${training.code}   •   Sürüm: ${training.version}   •   Rapor tarihi: ${dateText(new Date())}`, { align: "left" });
    doc.moveDown(1.8);
    doc.font(boldFontFile).fillColor("#0B385D").fontSize(13).text("Eğitim Künyesi"); doc.moveDown(0.5);
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
    tableRow([{ text: "Kriter", width: 245 }, { text: "Ağırlık", width: 75, align: "center" }, { text: "Ort. puan", width: 100, align: "center" }, { text: "Açıklama", width: 71 }], true);
    criteriaRows.forEach(row => { const values = completed.map(item => responseMap.get(item.evaluation!.id)?.get(row.criterion.id)?.score).filter((value): value is number => typeof value === "number"); const average = values.length ? `${((values.reduce((sum, value) => sum + value, 0) / values.length) / 5 * 100).toFixed(1).replace(/\.0$/, "")}%` : "—"; tableRow([{ text: row.criterion.name, width: 245 }, { text: row.weight == null ? "—" : `${Number(row.weight).toFixed(1).replace(/\.0$/, "")}%`, width: 75, align: "center" }, { text: average, width: 100, align: "center" }, { text: values.length ? `${values.length} yanıt` : "Yanıt yok", width: 71 }]); });
    startPage(); doc.fillColor("#0B385D").fontSize(13).text("Değerlendirici Bazlı Sonuçlar"); doc.moveDown(0.5);
    tableRow([{ text: "Değerlendirici", width: 190 }, { text: "Durum", width: 95 }, { text: "Puan", width: 70, align: "center" }, { text: "Genel yorum", width: 136 }], true);
    filteredAssessmentRows.forEach(row => { const evaluation = row.evaluation; tableRow([{ text: `${row.evaluator.firstName} ${row.evaluator.lastName}`, width: 190 }, { text: evaluation?.status === "COMPLETED" ? "Tamamlandı" : row.assignment.status === "DRAFT" ? "Taslak" : "Bekliyor", width: 95 }, { text: evaluation?.totalScore == null ? "—" : `${evaluation.totalScore}/100`, width: 70, align: "center" }, { text: text(evaluation?.generalComment), width: 136 }]); });
    startPage(); doc.fillColor("#0B385D").fontSize(13).text("Kriter Bazlı Değerlendirici Yorumları"); doc.moveDown(0.5); doc.fillColor("#475569").fontSize(9).text("Yalnızca kayıtlı yorumlar listelenir. Her yorum, kriteri ve değerlendiricisiyle birlikte sunulur."); doc.moveDown(0.8);
    criteriaRows.forEach(criterionRow => {
      const comments = completed.flatMap(assessmentRow => {
        const response = responseMap.get(assessmentRow.evaluation!.id)?.get(criterionRow.criterion.id);
        return response?.comment?.trim() ? [{ evaluator: `${assessmentRow.evaluator.firstName} ${assessmentRow.evaluator.lastName}`, comment: response.comment.trim() }] : [];
      });
      sectionTitle(criterionRow.criterion.name);
      if (!comments.length) { doc.font(fontFile).fillColor("#64748B").fontSize(9.5).text("Bu kriter için kayıtlı yorum bulunmuyor."); doc.moveDown(0.7); return; }
      comments.forEach((item, index) => {
        const label = `${index + 1}. ${item.evaluator}`;
        doc.font(fontFile).fontSize(10);
        const bodyHeight = doc.heightOfString(item.comment, { width: 451, lineGap: 3 });
        space(42 + bodyHeight);
        doc.font(boldFontFile).fillColor("#0B385D").fontSize(10).text(label);
        doc.moveDown(0.25).font(fontFile).fillColor("#334155").fontSize(10).text(item.comment, { width: 451, lineGap: 3 });
        doc.moveDown(0.8);
      });
    });
    const pageCount = doc.bufferedPageRange().count;
    for (let index = 0; index < pageCount; index += 1) {
      doc.switchToPage(index);
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font(fontFile).fillColor("#64748B").fontSize(7.5).text("E/V Eğitim İçerik Değerlendirme Sistemi • Gizli", 52, 790, { width: 360, lineBreak: false });
      doc.font(fontFile).text(`Sayfa ${index + 1} / ${pageCount}`, 410, 790, { width: 133, align: "right", lineBreak: false });
      doc.page.margins.bottom = originalBottomMargin;
    }
    doc.end();
  });
}
