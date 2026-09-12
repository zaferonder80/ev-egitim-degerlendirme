import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { getSessionUser } from "./auth";
import { buildTrainingEvaluationPdf } from "./reportPdf";
import { buildTrainingEvaluationExcel } from "./reportExcel";
import { createThreeDayDueReminders } from "./dueReminders";
import { sdk } from "./_core/sdk";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);

app.get("/api/reports/training/:id.pdf", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !["ADMIN", "TRAINING_MANAGER"].includes(user.role)) return res.status(403).json({ error: "forbidden" });
    const trainingId = Number(req.params.id);
    const evaluationSetId = req.query.evaluationSetId ? Number(req.query.evaluationSetId) : undefined;
    if (!Number.isInteger(trainingId) || trainingId <= 0) return res.status(400).json({ error: "invalid-training-id" });
    if (evaluationSetId !== undefined && (!Number.isInteger(evaluationSetId) || evaluationSetId <= 0)) return res.status(400).json({ error: "invalid-evaluation-set-id" });
    const pdf = await buildTrainingEvaluationPdf(trainingId, evaluationSetId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="degerlendirme-raporu-${trainingId}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    return res.send(pdf);
  } catch (error) {
    console.error("[Reports] PDF generation failed", error);
    return res.status(500).json({ error: "report-generation-failed" });
  }
});

app.get("/api/reports/training/:id.xlsx", async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !["ADMIN", "TRAINING_MANAGER"].includes(user.role)) return res.status(403).json({ error: "forbidden" });
    const trainingId = Number(req.params.id);
    const evaluationSetId = req.query.evaluationSetId ? Number(req.query.evaluationSetId) : undefined;
    if (!Number.isInteger(trainingId) || trainingId <= 0) return res.status(400).json({ error: "invalid-training-id" });
    if (evaluationSetId !== undefined && (!Number.isInteger(evaluationSetId) || evaluationSetId <= 0)) return res.status(400).json({ error: "invalid-evaluation-set-id" });
    const excel = await buildTrainingEvaluationExcel(trainingId, evaluationSetId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="degerlendirme-raporu-${trainingId}.xlsx"`);
    res.setHeader("Content-Length", excel.length);
    return res.send(excel);
  } catch (error) {
    console.error("[Reports] Excel generation failed", error);
    return res.status(500).json({ error: "report-generation-failed" });
  }
});

app.post("/api/scheduled/due-reminders", async (req, res) => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await createThreeDayDueReminders();
    return res.json({ ok: true, ...result, taskUid: user.taskUid });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[Scheduled due-reminders] failed", error);
    return res.status(500).json({ error: detail, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
