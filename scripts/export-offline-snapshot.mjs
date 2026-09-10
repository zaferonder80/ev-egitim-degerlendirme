import { getDb } from "../server/db.ts";
import { auditLogs, assignments, criteria, evaluationResponses, evaluations, notifications, trainings, users } from "../drizzle/schema.ts";

const knownOfflinePasswords = new Map([
  ["admin.demo@ev.local", "Demo!2026Egitim"],
  ["ayse.aktar@lcwaikiki.com", "Demo!2026Egitim"],
  ["berk.kaya@ev.local", "Demo!2026Egitim"],
  ["deniz.aras@ev.local", "Demo!2026Egitim"],
  ["zafer.onder@lcwaikiki.com", "Demodegerlendirme123!"],
  ["selinmerve.agca@lcwaikiki.com", "Demodegerlendirme123!"],
  ["seyda.topcu@lcwaikiki.com", "Demodegerlendirme123!"],
  ["yesim.sandikci@lcwaikiki.com", "Demodegerlendirme123!"],
  ["ebru.celik@lcwaikiki.com", "Demodegerlendirme123!"],
  ["tuba.tapar@lcwaikiki.com", "Demodegerlendirme123!"],
  ["pinar.tuncsav@lcwaikiki.com", "Demodegerlendirme123!"],
  ["fatma.cardak@lcwaikiki.com", "Demodegerlendirme123!"],
  ["nazire.erton@lcwaikiki.com", "Demodegerlendirme123!"],
  ["onur.izbul@lcwaikiki.com", "Demodegerlendirme123!"],
]);

const db = await getDb();
if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");

const snapshot = {
  schemaVersion: 1,
  exportedAt: process.env.SNAPSHOT_EXPORTED_AT || new Date().toISOString(),
  data: {
    users: await db.select().from(users),
    criteria: await db.select().from(criteria),
    trainings: await db.select().from(trainings),
    assignments: await db.select().from(assignments),
    evaluations: await db.select().from(evaluations),
    evaluationResponses: await db.select().from(evaluationResponses),
    notifications: await db.select().from(notifications),
    auditLogs: await db.select().from(auditLogs),
  },
};

snapshot.data.users = snapshot.data.users.map(row => {
  const { passwordHash: _passwordHash, ...copy } = row;
  return { ...copy, offlinePassword: knownOfflinePasswords.get(copy.email) ?? null };
});

process.stdout.write(JSON.stringify(snapshot));
process.exit(0);
