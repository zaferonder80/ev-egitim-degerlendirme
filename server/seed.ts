import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { assignments, criteria, evaluationResponses, evaluations, trainings, users } from "../drizzle/schema";
import { getDb } from "./db";
import { DEFAULT_EVALUATOR_PASSWORD, defaultEvaluators } from "./defaultEvaluators";
import { calculateEvaluationScores } from "./evaluationMath";

const criterionSeed = [
  ["Amaç ve hedeflerin netliği", "Eğitim künyesinin tam olması ve eğitimde açıklanması beklenir.", ["Eğitim adı, hedef kitle, süre ve öğrenme hedefleri mevcut mu?", "Amaç ve kazanımlar açık şekilde ifade edilmiş mi?", "Katılımcının eğitim sonunda ne kazanacağı net mi?"]],
  ["İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu", "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu değerlendirilir.", ["İçerik doğru mu?", "İçerik güncel mi?", "Hedef kitlenin bilgi ve deneyim seviyesine uygun mu?", "Kullanılan dil ve terminoloji uygun mu?"]],
  ["İçeriğin farklı öğrenme stillerine uygunluğu", "İçeriğin işitsel, görsel ve etkileşimli öğrenme tercihlerini destekleme seviyesi değerlendirilir.", ["Görsel destekler yeterli mi?", "İşitsel içerikler uygun mu?", "Etkileşimli öğrenme unsurları var mı?", "Farklı öğrenme tercihleri dengeli biçimde destekleniyor mu?"]],
  ["Eğitim içerik hiyerarşisinin uygunluğu", "İçeriğin basitten karmaşığa doğru tasarlanması beklenir.", ["İçerik basitten karmaşığa ilerliyor mu?", "Konular arasında mantıksal akış var mı?", "Başlık ve alt başlık yapısı anlaşılır mı?", "Bölümler arasındaki geçişler öğrenmeyi destekliyor mu?"]],
  ["Eğitimde verilen örneklerin, alıştırmaların ve etkileşimlerin yeterliliği ve etkililiği", null, ["Örnekler gerçek iş yaşamıyla bağlantılı mı?", "Alıştırmalar öğrenmeyi pekiştiriyor mu?", "Etkileşimler katılımcıyı aktif tutuyor mu?", "Yeterli uygulama fırsatı bulunuyor mu?"]],
  ["İçeriğin bilgi yoğunluğu ile toplam eğitim süresinin uygunluğu", "Uzun eğitimlerin micro-learning yaklaşımıyla bölümlenmesi dikkate alınır.", ["İçerik yoğunluğu ve süre dengeli mi?", "Bilişsel yük uygun seviyede mi?", "Uzun içerikler anlamlı küçük bölümlere ayrılmış mı?", "Micro-learning yaklaşımına uygun mu?"]],
  ["Video, ses, montaj ve görsellerin kalitesi", null, ["Video görüntü kalitesi yeterli mi?", "Ses seviyesi ve ses temizliği uygun mu?", "Montaj profesyonel ve akıcı mı?", "Görseller anlaşılır ve kaliteli mi?", "Görsel tasarım dili tutarlı mı?", "Medya unsurları öğrenmeyi destekliyor mu?"]],
  ["Ölçme ve değerlendirme aracının eğitim içeriğine ve hedef kitleye uygunluğu", null, ["Ölçme aracı öğrenme hedefleriyle uyumlu mu?", "Sorular eğitim içeriğini kapsıyor mu?", "Sorular hedef kitleye uygun mu?", "Yalnızca bilgiyi hatırlamayı değil, uygulamayı da ölçüyor mu?", "Katılımcıya anlamlı geri bildirim veriliyor mu?"]],
] as const;

export async function seedDevelopmentData() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo verisi üretim ortamında oluşturulamaz.");
  const db = await getDb();
  if (!db) throw new Error("Veritabanı bağlantısı kurulamadı.");
  const passwordHash = await bcrypt.hash("Demo!2026Egitim", 12);
  const defaultEvaluatorPasswordHash = await bcrypt.hash(DEFAULT_EVALUATOR_PASSWORD, 12);
  for (const [index, [name, description, controlPoints]] of Array.from(criterionSeed.entries())) {
    await db.insert(criteria).values({ orderNumber: index + 1, name, description, controlPoints: [...controlPoints], isActive: true }).onDuplicateKeyUpdate({ set: { name, description, controlPoints: [...controlPoints], isActive: true } });
  }
  const demoUsers = [
    { openId: "local:demo-admin", firstName: "Demo", lastName: "Yönetici", name: "Demo Yönetici", email: "admin.demo@ev.local", role: "ADMIN" as const },
    { openId: "local:ayse", firstName: "Ayşe", lastName: "Demir", name: "Ayşe Demir", email: "ayse.demir@ev.local", role: "EVALUATOR" as const },
    { openId: "local:berk", firstName: "Berk", lastName: "Kaya", name: "Berk Kaya", email: "berk.kaya@ev.local", role: "EVALUATOR" as const },
    { openId: "local:deniz", firstName: "Deniz", lastName: "Aras", name: "Deniz Aras", email: "deniz.aras@ev.local", role: "EVALUATOR" as const },
  ];
  for (const user of demoUsers) {
    await db.insert(users).values({ ...user, passwordHash, isActive: true, mustChangePassword: false, loginMethod: "password" }).onDuplicateKeyUpdate({ set: { passwordHash, isActive: true, role: user.role, mustChangePassword: false } });
  }
  for (const user of defaultEvaluators) {
    await db.insert(users).values({ ...user, passwordHash: defaultEvaluatorPasswordHash, isActive: true, mustChangePassword: true, loginMethod: "password" }).onDuplicateKeyUpdate({ set: { firstName: user.firstName, lastName: user.lastName, name: user.name, passwordHash: defaultEvaluatorPasswordHash, isActive: true, role: "EVALUATOR", mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null } });
  }
  const createdUsers = await db.select().from(users);
  const admin = createdUsers.find(user => user.email === "admin.demo@ev.local");
  if (!admin) throw new Error("Demo yönetici oluşturulamadı.");
  const now = new Date();
  const trainingSeed = [
    { code: "EV-001", title: "Bilgi Güvenliği Farkındalığı", description: "Kurumsal bilgi güvenliği temel eğitimi.", trainingType: "Zorunlu", targetAudience: "Tüm çalışanlar", learningObjectives: "Temel tehditleri tanımak ve güvenli çalışma alışkanlığı kazanmak.", durationMinutes: 45, contentOwner: "Kurumsal Güvenlik", version: "2.1", status: "ACTIVE" as const, evaluationEndDate: new Date(now.getTime() + 2 * 86400000) },
    { code: "EV-002", title: "Etkili Geri Bildirim", description: "Yöneticiler için yapılandırılmış geri bildirim yaklaşımı.", trainingType: "Gelişim", targetAudience: "Takım yöneticileri", learningObjectives: "Yapıcı geri bildirim görüşmesi yürütmek.", durationMinutes: 60, contentOwner: "İnsan ve Kültür", version: "1.3", status: "ACTIVE" as const, evaluationEndDate: new Date(now.getTime() + 10 * 86400000) },
    { code: "EV-003", title: "Müşteri Deneyimi Temelleri", description: "Müşteri odaklı karar verme prensipleri.", trainingType: "Gelişim", targetAudience: "Müşteriyle temas eden ekipler", learningObjectives: "Müşteri yolculuğunu analiz etmek.", durationMinutes: 50, contentOwner: "Müşteri Deneyimi", version: "1.0", status: "ACTIVE" as const, evaluationEndDate: new Date(now.getTime() - 2 * 86400000) },
  ];
  for (const training of trainingSeed) {
    await db.insert(trainings).values({ ...training, createdById: admin.id, evaluationStartDate: now, publishDate: now, lastUpdatedDate: now }).onDuplicateKeyUpdate({ set: { title: training.title, status: training.status, evaluationEndDate: training.evaluationEndDate } });
  }
  const allTrainings = await db.select().from(trainings);
  const ayse = createdUsers.find(user => user.email === "ayse.demir@ev.local");
  const berk = createdUsers.find(user => user.email === "berk.kaya@ev.local");
  const deniz = createdUsers.find(user => user.email === "deniz.aras@ev.local");
  if (!ayse || !berk || !deniz) throw new Error("Demo değerlendiriciler oluşturulamadı.");
  const assignmentSeed = [
    { trainingCode: "EV-001", evaluator: ayse, status: "PENDING" as const, dueDate: new Date(now.getTime() + 2 * 86400000) },
    { trainingCode: "EV-002", evaluator: berk, status: "DRAFT" as const, dueDate: new Date(now.getTime() + 10 * 86400000) },
    { trainingCode: "EV-003", evaluator: deniz, status: "COMPLETED" as const, dueDate: new Date(now.getTime() - 2 * 86400000) },
  ];
  for (const record of assignmentSeed) {
    const training = allTrainings.find(item => item.code === record.trainingCode);
    if (!training) continue;
    await db.insert(assignments).values({ trainingId: training.id, evaluatorId: record.evaluator.id, assignedById: admin.id, assignedAt: now, dueDate: record.dueDate, status: record.status, completedAt: record.status === "COMPLETED" ? now : null }).onDuplicateKeyUpdate({ set: { status: record.status, dueDate: record.dueDate } });
  }
  const completedAssignment = (await db.select().from(assignments)).find(assignment => assignment.evaluatorId === deniz.id);
  const completedTraining = allTrainings.find(training => training.code === "EV-003");
  const allCriteria = await db.select().from(criteria);
  if (completedAssignment && completedTraining) {
    const scores = [3, 3, 3, 3, 3, 3, 3, 3];
    const summary = calculateEvaluationScores(scores);
    await db.insert(evaluations).values({ assignmentId: completedAssignment.id, evaluatorId: deniz.id, trainingId: completedTraining.id, status: "COMPLETED", generalComment: "Demo değerlendirmesi: içerik yapılandırılmış iyileştirme alanları içermektedir.", ...summary, submittedAt: now }).onDuplicateKeyUpdate({ set: { status: "COMPLETED", ...summary, submittedAt: now } });
    const evaluation = (await db.select().from(evaluations).where(eq(evaluations.assignmentId, completedAssignment.id)).limit(1))[0];
    if (evaluation) for (const [index, criterion] of Array.from(allCriteria.entries())) {
      await db.insert(evaluationResponses).values({ evaluationId: evaluation.id, criterionId: criterion.id, score: scores[index], comment: "Demo yorum: bu kriter için gözlemler kaydedildi." }).onDuplicateKeyUpdate({ set: { score: scores[index], comment: "Demo yorum: bu kriter için gözlemler kaydedildi." } });
    }
  }
  return { demoPassword: "Demo!2026Egitim", users: demoUsers.map(user => user.email) };
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedDevelopmentData().then(result => console.log(`Demo verileri hazırlandı. Hesaplar: ${result.users.join(", ")}`)).catch(error => { console.error(error); process.exitCode = 1; });
}
