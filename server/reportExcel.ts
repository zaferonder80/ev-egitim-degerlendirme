import ExcelJS from "exceljs";
import { and, asc, eq, inArray } from "drizzle-orm";
import { assignments, criteria, evaluationResponses, evaluations, evaluationSetCriteria, trainings, users } from "../drizzle/schema";
import { getDb } from "./db";

export async function buildTrainingEvaluationExcel(trainingId: number, evaluationSetId?: number): Promise<Buffer> {
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");

  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  if (!training) throw new Error("Eğitim bulunamadı.");

  const rows = await db
    .select({ assignment: assignments, evaluator: users, evaluation: evaluations })
    .from(assignments)
    .innerJoin(users, eq(assignments.evaluatorId, users.id))
    .leftJoin(evaluations, eq(evaluations.assignmentId, assignments.id))
    .where(eq(assignments.trainingId, trainingId));
  const selectedSetId = evaluationSetId;
  const filteredRows = selectedSetId ? rows.filter(row => row.assignment.evaluationSetId === selectedSetId) : rows;
  const completed = filteredRows.filter(row => row.evaluation?.status === "COMPLETED" && row.evaluation.totalScore !== null);
  const averageTotal = completed.length
    ? completed.reduce((sum, row) => sum + (row.evaluation?.totalScore ?? 0), 0) / completed.length
    : null;

  const assignedSetIds = Array.from(new Set(rows.map(row => row.assignment.evaluationSetId).filter((id): id is number => id !== null)));
  const setCriterionRows = selectedSetId
    ? await db.select({ criterion: criteria, weight: evaluationSetCriteria.weight }).from(evaluationSetCriteria).innerJoin(criteria, eq(evaluationSetCriteria.criterionId, criteria.id)).where(and(eq(evaluationSetCriteria.evaluationSetId, selectedSetId), eq(criteria.isActive, true))).orderBy(asc(evaluationSetCriteria.sortOrder), asc(evaluationSetCriteria.id))
    : assignedSetIds.length
      ? await db.select({ criterion: criteria, weight: evaluationSetCriteria.weight }).from(evaluationSetCriteria).innerJoin(criteria, eq(evaluationSetCriteria.criterionId, criteria.id)).where(and(inArray(evaluationSetCriteria.evaluationSetId, assignedSetIds), eq(criteria.isActive, true))).orderBy(asc(criteria.orderNumber))
      : [];
  const criteriaRows = setCriterionRows.length
    ? Array.from(new Map(setCriterionRows.map(row => [row.criterion.id, row])).values())
    : assignedSetIds.length ? [] : (await db.select().from(criteria).where(eq(criteria.isActive, true)).orderBy(asc(criteria.orderNumber))).map(criterion => ({ criterion, weight: null }));
  const responseMap = new Map<number, Map<number, { score: number; comment: string | null }>>();
  for (const row of filteredRows) {
    if (!row.evaluation) continue;
    const responses = await db.select().from(evaluationResponses).where(eq(evaluationResponses.evaluationId, row.evaluation.id));
    responseMap.set(row.evaluation.id, new Map(responses.map(item => [item.criterionId, item])));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E/V Eğitim İçerik Değerlendirme Sistemi";
  const sheet = workbook.addWorksheet("Değerlendirme Raporu", { views: [{ showGridLines: false }] });
  sheet.columns = [
    { width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 26 },
  ];
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } };
  sheet.headerFooter.oddFooter = "E/V Eğitim İçerik Değerlendirme Sistemi • Gizli                                      Sayfa &P / &N";

  const navy = "0B385D";
  const teal = "14A6A0";
  const lightTeal = "EEF6F6";
  const slate = "475569";
  const border = { style: "thin" as const, color: { argb: "D7E1EA" } };
  const normalFont = { name: "DejaVu Sans", size: 10, color: { argb: "334155" } };
  const setRowStyle = (row: ExcelJS.Row, fill?: string) => {
    row.eachCell(cell => {
      cell.font = normalFont;
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { top: border, bottom: border, left: border, right: border };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
  };
  const addSection = (title: string) => {
    const row = sheet.addRow([title]);
    sheet.mergeCells(`A${row.number}:G${row.number}`);
    row.height = 22;
    row.getCell(1).font = { name: "DejaVu Sans", size: 13, bold: true, color: { argb: "FFFFFF" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } };
    row.getCell(1).alignment = { vertical: "middle" };
    return row;
  };
  const addTableHeader = (values: string[]) => {
    const row = sheet.addRow(values);
    row.height = 24;
    row.eachCell(cell => {
      cell.font = { name: "DejaVu Sans", size: 9, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { top: border, bottom: border, left: border, right: border };
    });
    return row;
  };

  sheet.mergeCells("A1:G1");
  const title = sheet.getCell("A1");
  title.value = "E/V EĞİTİM İÇERİK DEĞERLENDİRME SİSTEMİ";
  title.font = { name: "DejaVu Sans", size: 15, bold: true, color: { argb: navy } };
  title.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 28;
  sheet.mergeCells("A2:G2");
  const reportTitle = sheet.getCell("A2");
  reportTitle.value = "PDF DEĞERLENDİRME ÖZET RAPORU";
  reportTitle.font = { name: "DejaVu Sans", size: 10, bold: true, color: { argb: teal } };
  reportTitle.alignment = { vertical: "middle" };
  sheet.mergeCells("A3:G3");
  const trainingTitle = sheet.getCell("A3");
  trainingTitle.value = training.title;
  trainingTitle.font = { name: "DejaVu Sans", size: 22, bold: true, color: { argb: navy } };
  trainingTitle.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(3).height = 34;
  sheet.mergeCells("A4:G4");
  const metadata = sheet.getCell("A4");
  metadata.value = `Eğitim Kodu: ${training.code}   •   Sürüm: ${training.version}   •   Rapor tarihi: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date())}`;
  metadata.font = { ...normalFont, size: 10, color: { argb: slate } };
  metadata.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(4).height = 24;

  addSection("Eğitim Künyesi");
  [["Eğitim türü", training.trainingType ?? "—"], ["Hedef kitle", training.targetAudience ?? "—"], ["Sorumlu", training.contentOwner ?? "—"], ["Süre", training.durationMinutes ? `${training.durationMinutes} dakika` : "—"], ["Değerlendirme son tarihi", training.evaluationEndDate ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(training.evaluationEndDate) : "—"]].forEach((values, index) => {
    const row = sheet.addRow([values[0], values[1]]);
    sheet.mergeCells(`B${row.number}:G${row.number}`);
    setRowStyle(row, index % 2 === 0 ? lightTeal : undefined);
    row.getCell(1).font = { ...normalFont, bold: true, color: { argb: navy } };
  });

  addSection("Değerlendirme Özeti");
  addTableHeader(["Atanan değerlendirici", "Tamamlanan değerlendirme", "Ortalama toplam puan", "Başarı durumu", "", "", ""]);
  const summaryRow = sheet.addRow([filteredRows.length, completed.length, averageTotal === null ? "—" : `${averageTotal.toFixed(2)} / 100`, averageTotal === null ? "Henüz sonuç yok" : averageTotal >= 70 ? "Başarılı" : "Başarısız"]);
  setRowStyle(summaryRow, lightTeal);
  summaryRow.eachCell(cell => { cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });

  addSection("Kriter Bazlı Sonuçlar");
  addTableHeader(["Kriter", "Ağırlık", "Ort. puan", "Açıklama", "", "", ""]);
  criteriaRows.forEach(row => {
    const values = completed.map(item => responseMap.get(item.evaluation!.id)?.get(row.criterion.id)?.score).filter((value): value is number => typeof value === "number");
    const average = values.length ? `${((values.reduce((sum, value) => sum + value, 0) / values.length) / 5 * 100).toFixed(1).replace(/\.0$/, "")}%` : "—";
    const resultRow = sheet.addRow([row.criterion.name, row.weight == null ? "—" : `${Number(row.weight).toFixed(1).replace(/\.0$/, "")}%`, average, values.length ? `${values.length} yanıt` : "Yanıt yok"]);
    setRowStyle(resultRow);
  });

  addSection("Değerlendirici Bazlı Sonuçlar");
  addTableHeader(["Değerlendirici", "Durum", "Puan", "Genel yorum", "", "", ""]);
  filteredRows.forEach(row => {
    const evaluatorRow = sheet.addRow([`${row.evaluator.firstName} ${row.evaluator.lastName}`, row.evaluation?.status === "COMPLETED" ? "Tamamlandı" : row.assignment.status === "DRAFT" ? "Taslak" : "Bekliyor", row.evaluation?.totalScore == null ? "—" : `${row.evaluation.totalScore}/100`, row.evaluation?.generalComment ?? ""]);
    setRowStyle(evaluatorRow);
    evaluatorRow.getCell(4).alignment = { vertical: "top", wrapText: true };
  });

  addSection("Kriter Bazlı Değerlendirici Yorumları");
  const intro = sheet.addRow(["Yalnızca kayıtlı yorumlar listelenir. Her yorum, kriteri ve değerlendiricisiyle birlikte sunulur."]);
  sheet.mergeCells(`A${intro.number}:G${intro.number}`);
  intro.getCell(1).font = { ...normalFont, italic: true, size: 9, color: { argb: slate } };
  intro.getCell(1).alignment = { wrapText: true };
  criteriaRows.forEach(criterionRow => {
    const criterionTitle = sheet.addRow([criterionRow.criterion.name]);
    sheet.mergeCells(`A${criterionTitle.number}:G${criterionTitle.number}`);
    criterionTitle.getCell(1).font = { name: "DejaVu Sans", size: 11, bold: true, color: { argb: navy } };
    criterionTitle.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightTeal } };
    const comments = completed.flatMap(assessmentRow => {
      const response = responseMap.get(assessmentRow.evaluation!.id)?.get(criterionRow.criterion.id);
      return response?.comment?.trim() ? [{ evaluator: `${assessmentRow.evaluator.firstName} ${assessmentRow.evaluator.lastName}`, comment: response.comment.trim() }] : [];
    });
    if (!comments.length) {
      const emptyRow = sheet.addRow(["Bu kriter için kayıtlı yorum bulunmuyor."]);
      sheet.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
      emptyRow.getCell(1).font = { ...normalFont, size: 9.5, color: { argb: "64748B" } };
      return;
    }
    comments.forEach((item, index) => {
      const commentRow = sheet.addRow([`${index + 1}. ${item.evaluator}`, item.comment]);
      sheet.mergeCells(`B${commentRow.number}:G${commentRow.number}`);
      setRowStyle(commentRow);
      commentRow.getCell(1).font = { ...normalFont, bold: true, color: { argb: navy } };
      commentRow.getCell(2).alignment = { vertical: "top", wrapText: true };
      commentRow.height = Math.max(24, Math.ceil(item.comment.length / 95) * 15);
    });
  });

  sheet.eachRow(row => {
    row.eachCell(cell => {
      if (!cell.font) cell.font = normalFont;
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}