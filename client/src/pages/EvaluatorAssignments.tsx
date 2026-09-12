import { AppShell, StatusBadge, formatDate } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const defaultCriteria = [
  { id: 1, name: "Amaç ve hedeflerin netliği", description: null },
  { id: 2, name: "İçeriğin doğruluğu, güncelliği ve hedef kitleye uygunluğu", description: null },
  { id: 3, name: "İçeriğin farklı öğrenme stillerine uygunluğu", description: null },
  { id: 4, name: "Eğitim içerik hiyerarşisinin uygunluğu", description: null },
  { id: 5, name: "Eğitimde verilen örneklerin, alıştırmaların ve etkileşimlerin yeterliliği ve etkililiği", description: null },
  { id: 6, name: "İçeriğin bilgi yoğunluğu ile toplam eğitim süresinin uygunluğu", description: null },
  { id: 7, name: "Video, ses, montaj ve görsellerin kalitesi", description: null },
  { id: 8, name: "Ölçme ve değerlendirme aracının eğitim içeriğine ve hedef kitleye uygunluğu", description: null },
] as const;

export default function EvaluatorAssignments() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/evaluator/assignments/:id/evaluate");

  if (match && params?.id)
    return (
      <EvaluationForm
        assignmentId={Number(params.id)}
        onBack={() => setLocation("/evaluator/assignments")}
      />
    );

  return (
    <AssignmentList onOpen={id => setLocation(`/evaluator/assignments/${id}/evaluate`)} />
  );
}

function AssignmentList({ onOpen }: { onOpen: (id: number) => void }) {
  const query = trpc.evaluator.assignments.useQuery();

  return (
    <AppShell role="EVALUATOR">
      <div>
        <p className="text-sm font-medium text-teal-700">Değerlendirme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
          Atamalarım
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Atandığınız eğitimlerin durumunu takip edin, taslaklara devam edin veya tamamlanmış değerlendirmeleri görüntüleyin.
        </p>
      </div>

      <div className="mt-7 grid gap-4">
        {query.isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ) : query.data?.length ? (
          query.data.map(item => (
            <Card
              key={item.id}
              className={item.nearDue ? "border-rose-200 shadow-sm" : "border-slate-200 shadow-sm"}
            >
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div
                    className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      item.nearDue ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {item.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : item.status === "DRAFT" ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[#0b385d]">{item.training.title}</h2>
                      <StatusBadge status={item.status} />
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      <span className="font-medium text-teal-700">{item.training.code}</span> · {item.training.trainingType ?? "Eğitim"} · {item.training.durationMinutes ? `${item.training.durationMinutes} dk` : "Süre belirtilmemiş"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Değerlendirme seti: <span className="font-medium text-[#0b385d]">{item.evaluationSet?.name ?? "Varsayılan set"}</span>
                    </p>

                    <p
                      className={`mt-3 flex items-center gap-1.5 text-sm ${
                        item.nearDue ? "font-medium text-rose-700" : "text-slate-600"
                      }`}
                    >
                      <CalendarClock className="h-4 w-4" />
                      Son tarih: {formatDate(item.dueDate)}
                      {item.nearDue && " · Son 3 gün"}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => onOpen(item.id)}
                  variant={item.status === "COMPLETED" ? "outline" : "default"}
                  className={
                    item.status === "COMPLETED"
                      ? "border-slate-200 text-slate-700 hover:bg-slate-100"
                      : "bg-[#0b385d] hover:bg-[#082d4c]"
                  }
                >
                  {item.status === "COMPLETED" ? "Görüntüle" : "Değerlendir"}
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-lg font-semibold text-[#0b385d]">Henüz atama yok.</p>
              <p className="mt-2 text-sm text-slate-500">
                Size atanmış bir eğitim bulunmuyor.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function EvaluationForm({ assignmentId, onBack }: { assignmentId: number; onBack: () => void }) {
  const detail = trpc.evaluator.assignmentDetail.useQuery({ assignmentId });
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"evaluation" | "training">("evaluation");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [generalComment, setGeneralComment] = useState("");

  const assignmentSet =
    detail.data?.evaluationSet ?? null;
  const visibleCriteria = assignmentSet?.criteria?.length
    ? assignmentSet.criteria.map(item => ({
        id: item.criterionId,
        name: item.name,
        description: item.description ?? null,
        weight: Number(item.weight ?? 0),
      }))
    : defaultCriteria.map(item => ({
        ...item,
        weight: 100 / defaultCriteria.length,
      }));

  useEffect(() => {
    if (!detail.data) return;

    const values: Record<number, number> = {};
    const notes: Record<number, string> = {};

    detail.data.responses.forEach(response => {
      values[response.criterionId] = response.score;
      notes[response.criterionId] = response.comment ?? "";
    });

    setScores(values);
    setComments(notes);
    setGeneralComment(detail.data.evaluation?.generalComment ?? "");
  }, [detail.data]);

  const save = trpc.evaluator.saveEvaluation.useMutation({
    onSuccess: result => {
      utils.evaluator.assignments.invalidate();
      utils.evaluator.dashboard.invalidate();
      utils.evaluator.assignmentDetail.invalidate({ assignmentId });
      toast.success(result?.summary ? "Değerlendirme tamamlandı." : "Taslak kaydedildi.");
    },
    onError: error => toast.error(error.message),
  });

  const submit = (complete: boolean) => {
    const responses = Object.entries(scores).map(([criterionId, score]) => ({
      criterionId: Number(criterionId),
      score,
      comment: comments[Number(criterionId)] || null,
    }));

    if (complete && responses.length !== visibleCriteria.length) {
      return toast.error(`Tamamlamak için ${visibleCriteria.length} kriterin tümü puanlanmalıdır.`);
    }

    const passingScore = Number(assignmentSet?.passingScore ?? 70);
    if (complete && weightedTotal < passingScore && !generalComment.trim()) {
      return toast.error("Başarısız değerlendirmelerde genel yorum zorunludur.");
    }

    save.mutate({
      assignmentId,
      responses,
      generalComment: generalComment || null,
      complete,
    });
  };

  if (detail.isLoading)
    return (
      <AppShell role="EVALUATOR">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </AppShell>
    );

  if (!detail.data) {
    return (
      <AppShell role="EVALUATOR">
        <p>Atama bulunamadı.</p>
      </AppShell>
    );
  }

  const { assignment, training, evaluation } = detail.data;
  const isCompleted = assignment.status === "COMPLETED";
  const weightedTotal = visibleCriteria.reduce((sum, criterion) => {
    const score = scores[criterion.id] ?? 0;
    const weight = criterion.weight ?? 100 / Math.max(visibleCriteria.length, 1);
    return sum + (weight * score) / 5;
  }, 0);
  const total = weightedTotal;
  const passingScore = Number(assignmentSet?.passingScore ?? 70);

  return (
    <AppShell role="EVALUATOR">
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0b385d]"
      >
        <ChevronLeft className="h-4 w-4" /> Atamalarıma dön
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">
            {assignmentSet?.name ?? "Standart değerlendirme"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            {training.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {training.code} · Sürüm {training.version} · Set: {assignmentSet?.name ?? "Varsayılan"} · Son tarih: {formatDate(assignment.dueDate)}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      <div
        className="mt-6 flex gap-2 border-b border-slate-200"
        role="tablist"
        aria-label="Değerlendirme bölümleri"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "evaluation"}
          onClick={() => setActiveTab("evaluation")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "evaluation"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-[#0b385d]"
          }`}
        >
          Değerlendirme formu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "training"}
          onClick={() => setActiveTab("training")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "training"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-[#0b385d]"
          }`}
        >
          Eğitim bilgileri
        </button>
      </div>

      {activeTab === "training" ? (
        <TrainingInfoPanel training={training} />
      ) : (
        <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {visibleCriteria.map((criterion, index) => (
              <Card key={criterion.id} className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="font-semibold leading-6 text-[#0b385d]">{criterion.name}</h2>
                      {criterion.description && (
                        <p className="mt-1 text-sm text-slate-500">{criterion.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm font-medium text-slate-700">Puan</Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            type="button"
                            key={score}
                            onClick={() =>
                              setScores(prev => ({ ...prev, [criterion.id]: score }))
                            }
                            className={`h-9 min-w-9 rounded-lg border text-sm font-semibold transition-colors ${
                              scores[criterion.id] === score
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-700"
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={comments[criterion.id] ?? ""}
                      onChange={event =>
                        setComments(prev => ({
                          ...prev,
                          [criterion.id]: event.target.value,
                        }))
                      }
                      className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Kriterle ilgili kısa yorum ekleyin..."
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <aside className="space-y-5">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-teal-700">Özet</p>
                <p className="mt-2 text-3xl font-semibold text-[#0b385d]">
                  {Math.round(total)}%
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Baraj puanı: <span className="font-semibold text-amber-700">{passingScore}%</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {Object.keys(scores).length} / {visibleCriteria.length} kriter puanlandı
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-teal-700">Genel yorum</p>
                <textarea
                  value={generalComment}
                  onChange={event => setGeneralComment(event.target.value)}
                  className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder={weightedTotal < passingScore ? "Başarısız değerlendirmelerde açıklama zorunludur..." : "Değerlendirme hakkında genel yorum yazın..."}
                />
                {weightedTotal < passingScore && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Bu değerlendirme baraj puanının altında. Tamamlamak için genel yorum yazmalısınız.
                  </p>
                )}
              </CardContent>
            </Card>

            {evaluation && (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-teal-700">Önceki değerlendirme</p>
                  <p className="mt-2 text-xl font-semibold text-[#0b385d]">
                    {evaluation.successPercentage ?? 0}%
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {evaluation.successStatus === "SUCCESSFUL"
                      ? "Başarılı"
                      : evaluation.successStatus === "UNSUCCESSFUL"
                        ? "Başarısız"
                        : "Taslak"}
                  </p>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      )}

      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => submit(false)} disabled={isCompleted}>
          Taslak kaydet
        </Button>
        <Button
          type="button"
          className="bg-[#0b385d] hover:bg-[#082d4c]"
          onClick={() => submit(true)}
          disabled={isCompleted}
        >
          {isCompleted ? "Tamamlandı" : "Değerlendirmeyi tamamla"}
        </Button>
      </div>
    </AppShell>
  );
}

function TrainingInfoPanel({
  training,
}: {
  training: {
    title: string;
    code: string;
    description: string | null;
    trainingType: string | null;
    targetAudience: string | null;
    learningObjectives: string | null;
    durationMinutes: number | null;
    contentOwner: string | null;
    trainingUrl: string | null;
    fileUrl: string | null;
    imageUrl: string | null;
    version: string;
    publishDate: Date | null;
    lastUpdatedDate: Date | null;
    evaluationStartDate: Date | null;
    evaluationEndDate: Date | null;
  };
}) {
  const info = (value: string | null) => value?.trim() || "Bilgi girilmemiş.";

  return (
    <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Admin tarafından verilen eğitim künyesi
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#0b385d]">
                  {training.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {training.code} · Sürüm {training.version}
                </p>
              </div>
              {training.imageUrl && (
                <img
                  src={training.imageUrl}
                  alt="Eğitim kapak görseli"
                  className="h-24 w-36 rounded-xl object-cover"
                />
              )}
            </div>

            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eğitim türü
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{info(training.trainingType)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hedef kitle
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{info(training.targetAudience)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Süre
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {training.durationMinutes ? `${training.durationMinutes} dakika` : "Bilgi girilmemiş."}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sorumlu
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{info(training.contentOwner)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Yayın tarihi
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDate(training.publishDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Son güncelleme
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDate(training.lastUpdatedDate)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Değerlendirme dönemi
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {formatDate(training.evaluationStartDate)} - {formatDate(training.evaluationEndDate)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-teal-700">Açıklama</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {info(training.description)}
            </p>
          </CardContent>
        </Card>

        {training.trainingUrl && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-teal-700">Eğitim linki</p>
              <a
                href={training.trainingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-[#0b385d] underline decoration-teal-500 underline-offset-2"
              >
                {training.trainingUrl}
              </a>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
