import { AppShell, formatDate, StatusBadge } from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatScoreValue } from "@shared/score";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ClipboardPlus,
  Download,
  Edit3,
  ImageUp,
  Plus,
  RotateCcw,
  Search,
  Upload,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type TrainingFormState = {
  code: string;
  title: string;
  description: string;
  trainingType: "Ürün" | "Üretim" | "Destek" | "";
  targetAudience: string;
  learningObjectives: string;
  durationMinutes: string;
  contentOwner: string;
  trainingUrl: string;
  fileUrl: string;
  imageUrl: string;
  version: string;
  publishDate: string;
  lastUpdatedDate: string;
  evaluationEndDate: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};
const TRAINING_TYPES = ["Ürün", "Üretim", "Destek"] as const;
const blankForm: TrainingFormState = {
  code: "",
  title: "",
  description: "",
  trainingType: "",
  targetAudience: "",
  learningObjectives: "",
  durationMinutes: "",
  contentOwner: "",
  trainingUrl: "",
  fileUrl: "",
  imageUrl: "",
  version: "1.0",
  publishDate: "",
  lastUpdatedDate: "",
  evaluationEndDate: "",
  status: "DRAFT",
};
const toInputDate = (value?: Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const optional = (value: string) => value.trim() || null;
const toDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`) : null;

type TrainingSearchFilters = {
  code: string;
  title: string;
  trainingType: string;
  targetAudience: string;
  learningObjectives: string;
  durationMinutes: string;
  contentOwner: string;
  version: string;
  publishDate: string;
  lastUpdatedDate: string;
  evaluationEndDate: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "";
};

const blankFilters: TrainingSearchFilters = {
  code: "",
  title: "",
  trainingType: "",
  targetAudience: "",
  learningObjectives: "",
  durationMinutes: "",
  contentOwner: "",
  version: "",
  publishDate: "",
  lastUpdatedDate: "",
  evaluationEndDate: "",
  status: "",
};

const valueMatches = (value: string | null | undefined, query: string) =>
  value?.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")) ?? false;

export default function AdminTrainings() {
  const [, setLocation] = useLocation();
  const [isNewRoute] = useRoute("/admin/trainings/new");
  const [isEditRoute] = useRoute("/admin/trainings/:id/edit");
  const isEditor = isNewRoute || isEditRoute;
  const [isDetail, detailParams] = useRoute("/admin/trainings/:id");
  if (isEditor)
    return <TrainingEditor onExit={() => setLocation("/admin/trainings")} />;
  if (isDetail && detailParams?.id)
    return (
      <TrainingDetail
        trainingId={Number(detailParams.id)}
        onBack={() => setLocation("/admin/trainings")}
        onEdit={() => setLocation(`/admin/trainings/${detailParams.id}/edit`)}
      />
    );
  return (
    <TrainingList
      onCreate={() => setLocation("/admin/trainings/new")}
      onEdit={id => setLocation(`/admin/trainings/${id}/edit`)}
    />
  );
}

function TrainingList({
  onCreate,
  onEdit,
}: {
  onCreate: () => void;
  onEdit: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const trainingsQuery = trpc.admin.trainings.list.useQuery();
  const usersQuery = trpc.admin.users.list.useQuery({ activeOnly: true });
  const archive = trpc.admin.trainings.archive.useMutation({
    onSuccess: data => {
      toast.success(
        data.status === "ARCHIVED" ? "Eğitim pasifleştirildi." : "Eğitim aktifleştirildi."
      );
      utils.admin.trainings.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const assign = trpc.admin.trainings.assign.useMutation({
    onSuccess: () => {
      toast.success("Değerlendiriciler atandı.");
      utils.admin.trainings.list.invalidate();
      setAssigning(null);
    },
    onError: error => toast.error(error.message),
  });
  const [assigning, setAssigning] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<TrainingSearchFilters>(blankFilters);
  const [evaluatorIds, setEvaluatorIds] = useState<number[]>([]);
  const [evaluationSetId, setEvaluationSetId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const evaluationSetsQuery = trpc.admin.evaluationSets.list.useQuery();
  const activeEvaluationSets = evaluationSetsQuery.data?.filter(set => set.isActive) ?? [];
  const assignableUsers = usersQuery.data ?? [];
  const assigningTraining = assigning
    ? trainingsQuery.data?.find(item => item.id === assigning.id)
    : undefined;
  const completedEvaluatorIds = new Set(
    assigningTraining?.completedEvaluatorIds ?? []
  );
  const filteredTrainings = useMemo(() => {
    if (!trainingsQuery.data) return [];

    const normalizedQuery = searchQuery.trim();

    return trainingsQuery.data.filter(training => {
      const matchesQuickSearch =
        !normalizedQuery ||
        [
          training.title,
          training.code,
          training.trainingType,
          training.targetAudience,
          training.contentOwner,
          training.version,
        ].some(value => valueMatches(value, normalizedQuery));

      if (!matchesQuickSearch) return false;

      const filters = advancedFilters;
      if (filters.code && !valueMatches(training.code, filters.code)) return false;
      if (filters.title && !valueMatches(training.title, filters.title)) return false;
      if (filters.trainingType && training.trainingType !== filters.trainingType) return false;
      if (filters.targetAudience && !valueMatches(training.targetAudience, filters.targetAudience)) return false;
      if (filters.learningObjectives && !valueMatches(training.learningObjectives, filters.learningObjectives)) return false;
      if (filters.durationMinutes && Number(training.durationMinutes ?? 0) !== Number(filters.durationMinutes)) return false;
      if (filters.contentOwner && !valueMatches(training.contentOwner, filters.contentOwner)) return false;
      if (filters.version && !valueMatches(training.version, filters.version)) return false;
      if (filters.publishDate && toInputDate(training.publishDate) !== filters.publishDate) return false;
      if (filters.lastUpdatedDate && toInputDate(training.lastUpdatedDate) !== filters.lastUpdatedDate) return false;
      if (filters.evaluationEndDate && toInputDate(training.evaluationEndDate) !== filters.evaluationEndDate) return false;
      if (filters.status && training.status !== filters.status) return false;

      return true;
    });
  }, [advancedFilters, searchQuery, trainingsQuery.data]);
  const allAssignableUsersSelected =
    assignableUsers.length > 0 &&
    assignableUsers.every(user => evaluatorIds.includes(user.id));
  const syncEvaluatorIdsForSet = (nextSetId: number | "") => {
    setEvaluationSetId(nextSetId);
    if (!assigning) return;
    const training = trainingsQuery.data?.find(item => item.id === assigning.id);
    setEvaluatorIds(
      nextSetId === ""
        ? []
        : training?.assignedEvaluatorIdsBySet?.[String(nextSetId)] ?? []
    );
  };
  const toggleEvaluator = (evaluatorId: number, checked: boolean) => {
    if (completedEvaluatorIds.has(evaluatorId)) return;
    setEvaluatorIds(current => {
      if (checked) {
        return current.includes(evaluatorId)
          ? current
          : [...current, evaluatorId];
      }
      return current.filter(id => id !== evaluatorId);
    });
  };
  const toggleAllEvaluators = () => {
    if (allAssignableUsersSelected) {
      setEvaluatorIds(current =>
        current.filter(id => !assignableUsers.some(user => user.id === id))
      );
      return;
    }
    const nextIds = assignableUsers
      .filter(user => !completedEvaluatorIds.has(user.id))
      .map(user => user.id);
    setEvaluatorIds(current => {
      const merged = [...current, ...nextIds];
      return merged.filter((id, index) => merged.indexOf(id) === index);
    });
  };
  const submitAssignment = (event: FormEvent) => {
    event.preventDefault();
    if (!assigning || !dueDate)
      return toast.error("Son tarih seçin.");
    if (evaluationSetId === "")
      return toast.error("Değerlendirme seti seçin.");
    assign.mutate({
      trainingId: assigning.id,
      evaluatorIds,
      evaluationSetId: Number(evaluationSetId),
      dueDate: new Date(`${dueDate}T12:00:00`),
    });
  };
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const [downloadingSetKey, setDownloadingSetKey] = useState<string | null>(null);
  const previewSetPdf = (trainingId: number, setId: string, code: string) => {
    const key = `${trainingId}-${setId}`;
    const fileName = encodeURIComponent(`degerlendirme-raporu-${code}-${setId}.pdf`);
    const previewWindow = window.open(
      `/admin/reports/preview?trainingId=${trainingId}&evaluationSetId=${setId}&fileName=${fileName}`,
      "_blank",
      "noopener,noreferrer"
    );
    if (!previewWindow) {
      toast.error("PDF önizleme penceresi açılamadı. Tarayıcı açılır pencereyi engelliyor olabilir.");
      return;
    }
    setDownloadingSetKey(key);
    setTimeout(() => setDownloadingSetKey(null), 1000);
    previewWindow.focus();
  };

  return (
    <AppShell role={appRole}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Eğitim kataloğu</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            Eğitimler
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Eğitim içeriklerini, sürümlerini ve değerlendirme atamalarını
            yönetin.
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"
        >
          <Plus className="h-4 w-4" /> Yeni eğitim
        </Button>
      </div>
      <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Eğitim adı, kodu, müdürlük, hedef kitle, sorumlu..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvancedSearch(current => !current)}
            >
              Detaylı arama
            </Button>
          </div>
          {showAdvancedSearch && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="advanced-code">Eğitim kodu</Label>
                  <Input id="advanced-code" value={advancedFilters.code} onChange={event => setAdvancedFilters(current => ({ ...current, code: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-title">Eğitim adı</Label>
                  <Input id="advanced-title" value={advancedFilters.title} onChange={event => setAdvancedFilters(current => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-type">Eğitim müdürlüğü</Label>
                  <select id="advanced-type" value={advancedFilters.trainingType} onChange={event => setAdvancedFilters(current => ({ ...current, trainingType: event.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                    <option value="">Tümü</option>
                    {(["Ürün", "Üretim", "Destek"] as const).map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-audience">Hedef kitle</Label>
                  <Input id="advanced-audience" value={advancedFilters.targetAudience} onChange={event => setAdvancedFilters(current => ({ ...current, targetAudience: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-owner">Sorumlu</Label>
                  <Input id="advanced-owner" value={advancedFilters.contentOwner} onChange={event => setAdvancedFilters(current => ({ ...current, contentOwner: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-duration">Süre (dakika)</Label>
                  <Input id="advanced-duration" type="number" min="1" value={advancedFilters.durationMinutes} onChange={event => setAdvancedFilters(current => ({ ...current, durationMinutes: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-version">Sürüm</Label>
                  <Input id="advanced-version" value={advancedFilters.version} onChange={event => setAdvancedFilters(current => ({ ...current, version: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-learning">Öğrenme hedefi</Label>
                  <Input id="advanced-learning" value={advancedFilters.learningObjectives} onChange={event => setAdvancedFilters(current => ({ ...current, learningObjectives: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-publish">Yayın tarihi</Label>
                  <Input id="advanced-publish" type="date" value={advancedFilters.publishDate} onChange={event => setAdvancedFilters(current => ({ ...current, publishDate: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-end">Değerlendirme son tarihi</Label>
                  <Input id="advanced-end" type="date" value={advancedFilters.evaluationEndDate} onChange={event => setAdvancedFilters(current => ({ ...current, evaluationEndDate: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advanced-status">Durum</Label>
                  <select id="advanced-status" value={advancedFilters.status} onChange={event => setAdvancedFilters(current => ({ ...current, status: event.target.value as TrainingSearchFilters["status"] }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                    <option value="">Tümü</option>
                    <option value="DRAFT">Taslak</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="ARCHIVED">Arşivlenmiş</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAdvancedFilters(blankFilters)}>
                  Temizle
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Card className="mt-7 border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Eğitim</th>
                  <th className="px-4 py-4 font-semibold">Müdürlük</th>
                  <th className="px-4 py-4 font-semibold">Durum</th>
                  <th className="px-4 py-4 font-semibold">Atama</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainingsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Eğitimler yükleniyor…
                    </td>
                  </tr>
                ) : filteredTrainings.length ? (
                  filteredTrainings.map(training => {
                    const assignmentRows = Object.entries(
                      training.assignedEvaluatorIdsBySet ?? {}
                    ).map(([setId, evaluatorIds]) => {
                      const setName =
                        evaluationSetsQuery.data?.find(set => set.id === Number(setId))?.name ??
                        `Set ${setId}`;
                      const evaluatorNames = evaluatorIds
                        .map(id => {
                          const evaluator = usersQuery.data?.find(
                            user => user.id === id && user.role === "EVALUATOR"
                          );
                          if (!evaluator) return null;
                          return `${evaluator.firstName} ${evaluator.lastName}`.trim();
                        })
                        .filter(Boolean) as string[];
                      const summary = training.evaluationSetSummaryBySet?.[setId];

                      return { setId, setName, evaluatorNames, summary };
                    });

                    return (
                      <tr key={training.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#0b385d]">
                            {training.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            <span className="font-medium text-teal-700">
                              {training.code}
                            </span>{" "}
                            · Sürüm {training.version}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {training.trainingType ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={training.status} />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-700">
                            {training.completedCount} / {training.assignedCount}
                          </p>
                          <p className="text-xs text-slate-500">
                            {training.pendingCount} bekliyor
                          </p>
                          {assignmentRows.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {assignmentRows.map(row => (
                                <div
                                  key={row.setId}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                      {row.setName}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                                      onClick={() => previewSetPdf(training.id, row.setId, training.code)}
                                      disabled={downloadingSetKey === `${training.id}-${row.setId}`}
                                    >
                                      <Download className="h-3 w-3" />
                                      {downloadingSetKey === `${training.id}-${row.setId}` ? "Hazırlanıyor" : "PDF önizle"}
                                    </Button>
                                  </div>
                                  <p className="mt-1 text-[11px] font-medium text-slate-600">
                                    {row.summary?.completedCount ?? 0} / {row.summary?.assignedCount ?? 0} tamamlandı
                                    {" · "}
                                    {row.summary?.pendingCount ?? 0} bekliyor
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                    <span>
                                      Başarı ortalaması: <strong className="text-slate-700">
                                        {row.summary?.averageTotal == null ? "—" : `${formatScoreValue(row.summary.averageTotal, 1).replace(" / 100", "")}%`}
                                      </strong>
                                    </span>
                                    <span>
                                      Son tarih: <strong className="text-slate-700">{formatDate(row.summary?.dueDate)}</strong>
                                    </span>
                                    {row.summary?.successStatus && (
                                      <StatusBadge status={row.summary.successStatus} />
                                    )}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {row.evaluatorNames.length ? (
                                      row.evaluatorNames.map(name => (
                                        <span
                                          key={`${row.setId}-${name}`}
                                          className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700"
                                        >
                                          {name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-slate-400">
                                        Atanmış değerlendirici yok
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => onEdit(training.id)}
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Düzenle
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={training.status === "ARCHIVED"}
                            onClick={() => {
                              const firstSetId = activeEvaluationSets[0]?.id;
                              setAssigning({
                                id: training.id,
                                title: training.title,
                              });
                              setDueDate(toInputDate(training.evaluationEndDate));
                              syncEvaluatorIdsForSet(firstSetId ?? "");
                            }}
                          >
                            <UsersRound className="h-3.5 w-3.5" /> Ata
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={
                              training.status === "ARCHIVED"
                                ? "Aktifleştir"
                                : "Pasifleştir"
                            }
                            title={
                              training.status === "ARCHIVED"
                                ? "Eğitimi aktifleştir"
                                : "Eğitimi pasifleştir"
                            }
                            disabled={archive.isPending}
                            onClick={() => archive.mutate({ id: training.id })}
                          >
                            {training.status === "ARCHIVED" ? (
                              <RotateCcw className="h-3.5 w-3.5 text-emerald-700" />
                            ) : (
                              <Archive className="h-3.5 w-3.5 text-amber-700" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <ClipboardPlus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 font-medium text-slate-700">
                        {trainingsQuery.data?.length ? "Arama kriterlerine uygun eğitim bulunamadı." : "Henüz eğitim bulunmuyor."}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {trainingsQuery.data?.length
                          ? "Filtreleri temizleyip tekrar deneyin."
                          : "İlk eğitim kaydını oluşturarak değerlendirme sürecini başlatın."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {assigning && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={submitAssignment}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Değerlendirici atama
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#0b385d]">
                  {assigning.title}
                </h2>
              </div>
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-900"
                onClick={() => {
                  setAssigning(null);
                  setEvaluationSetId("");
                  setEvaluatorIds([]);
                  setDueDate("");
                }}
              >
                Kapat
              </button>
            </div>
            <div className="mt-6">
              <Label>Değerlendirme seti</Label>
              <select
                value={evaluationSetId}
                onChange={event => {
                  const nextSetId = event.target.value === "" ? "" : Number(event.target.value);
                  syncEvaluatorIdsForSet(nextSetId);
                }}
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Set seçilmedi</option>
                {evaluationSetsQuery.data?.filter(set => set.isActive).map(set => (
                  <option key={set.id} value={set.id}>{set.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-6">
              <Label>Son tarih</Label>
              <Input
                className="mt-2"
                type="date"
                value={dueDate}
                onChange={event => setDueDate(event.target.value)}
                required
              />
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <Label>Değerlendiriciler</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-teal-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                  disabled={!assignableUsers.length}
                  onClick={toggleAllEvaluators}
                >
                  {allAssignableUsersSelected ? "Tümünü kaldır" : "Tümünü seç"}
                </button>
              </div>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                {assignableUsers.map(userOption => (
                  <label
                    key={userOption.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className={
                        completedEvaluatorIds.has(userOption.id)
                          ? "accent-emerald-600"
                          : "accent-teal-600"
                      }
                      disabled={completedEvaluatorIds.has(userOption.id)}
                      checked={evaluatorIds.includes(userOption.id)}
                      onChange={event =>
                        toggleEvaluator(userOption.id, event.target.checked)
                      }
                    />
                    <span className="text-sm text-slate-700">
                      {userOption.firstName} {userOption.lastName}
                      <small className="ml-2 text-slate-400">
                        {userOption.email}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssigning(null)}
              >
                Vazgeç
              </Button>
              <Button
                disabled={assign.isPending}
                className="bg-[#0b385d] hover:bg-[#082d4c]"
              >
                {assign.isPending ? "Atanıyor…" : "Atamayı kaydet"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function TrainingEditor({ onExit }: { onExit: () => void }) {
  const [, params] = useRoute("/admin/trainings/:id/edit");
  const id = params?.id ? Number(params.id) : undefined;
  const list = trpc.admin.trainings.list.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<TrainingFormState>(blankForm);
  const existing = list.data?.find(item => item.id === id);
  useEffect(() => {
    if (existing)
      setForm({
        code: existing.code,
        title: existing.title,
        description: existing.description ?? "",
        trainingType: (existing.trainingType as TrainingFormState["trainingType"]) ?? "",
        targetAudience: existing.targetAudience ?? "",
        learningObjectives: existing.learningObjectives ?? "",
        durationMinutes: existing.durationMinutes?.toString() ?? "",
        contentOwner: existing.contentOwner ?? "",
        trainingUrl: existing.trainingUrl ?? "",
        fileUrl: existing.fileUrl ?? "",
        imageUrl: existing.imageUrl ?? "",
        version: existing.version,
        publishDate: toInputDate(existing.publishDate),
        lastUpdatedDate: toInputDate(existing.lastUpdatedDate),
        evaluationEndDate: toInputDate(existing.evaluationEndDate),
        status: existing.status,
      });
  }, [existing]);
  const create = trpc.admin.trainings.create.useMutation({
    onSuccess: () => {
      toast.success("Eğitim oluşturuldu.");
      utils.admin.trainings.list.invalidate();
      onExit();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.trainings.update.useMutation({
    onSuccess: () => {
      toast.success("Eğitim güncellendi.");
      utils.admin.trainings.list.invalidate();
      onExit();
    },
    onError: error => toast.error(error.message),
  });
  const upload = trpc.files.upload.useMutation({
    onSuccess: (result, variables) => {
      change(variables.kind === "image" ? "imageUrl" : "fileUrl", result.url);
      toast.success("Dosya güvenli depolamaya yüklendi.");
    },
    onError: error => toast.error(error.message),
  });
  const change = (field: keyof TrainingFormState, value: string) =>
    setForm(current => ({ ...current, [field]: value }));
  const uploadFile = (file: File | undefined, kind: "material" | "image") => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Dosya boyutu en fazla 10 MB olabilir.");
    const allowed =
      kind === "image"
        ? ["image/png", "image/jpeg", "image/webp"]
        : ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type))
      return toast.error("Desteklenen biçimler: PDF, PNG, JPEG ve WebP.");
    const reader = new FileReader();
    reader.onload = () =>
      upload.mutate({
        fileName: file.name,
        contentType: file.type as
          | "application/pdf"
          | "image/png"
          | "image/jpeg"
          | "image/webp",
        kind,
        base64Data: String(reader.result).split(",")[1] ?? "",
      });
    reader.readAsDataURL(file);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const title = form.title.trim();
    if (!/^[A-Z0-9_-]{2,64}$/.test(code))
      return toast.error(
        "Eğitim kodu en az 2 karakter olmalı; yalnızca harf, rakam, tire ve alt çizgi içermelidir."
      );
    if (title.length < 2)
      return toast.error("Eğitim adı en az 2 karakter olmalıdır.");
    if (
      form.durationMinutes &&
      (!Number.isInteger(Number(form.durationMinutes)) ||
        Number(form.durationMinutes) < 1)
    )
      return toast.error("Süre pozitif tam sayı olmalıdır.");
    if (!form.trainingType) return toast.error("Eğitim Müdürlüğü alanı zorunludur.");
    const input = {
      code,
      title,
      description: optional(form.description),
      trainingType: form.trainingType,
      targetAudience: optional(form.targetAudience),
      learningObjectives: optional(form.learningObjectives),
      durationMinutes: form.durationMinutes
        ? Number(form.durationMinutes)
        : null,
      contentOwner: optional(form.contentOwner),
      trainingUrl: optional(form.trainingUrl),
      fileUrl: optional(form.fileUrl),
      imageUrl: optional(form.imageUrl),
      version: form.version.trim(),
      publishDate: toDate(form.publishDate),
      lastUpdatedDate: toDate(form.lastUpdatedDate),
      evaluationEndDate: toDate(form.evaluationEndDate),
      status: form.status,
    };
    if (id) update.mutate({ id, ...input });
    else create.mutate({ ...input, evaluatorIds: [] });
  };
  const fields: Array<[keyof TrainingFormState, string, string, boolean]> = [
    ["code", "Eğitim kodu", "text", true],
    ["title", "Eğitim adı", "text", true],
    ["targetAudience", "Hedef kitle", "text", false],
    ["durationMinutes", "Süre (dakika)", "number", false],
    ["contentOwner", "Sorumlu", "text", false],
    ["version", "Sürüm", "text", true],
    ["trainingUrl", "Eğitim bağlantısı", "text", false],
    ["publishDate", "Yayın tarihi", "date", false],
    ["lastUpdatedDate", "Son güncelleme", "date", false],
    ["evaluationEndDate", "Değerlendirme son tarihi", "date", false],
  ];
  const { user } = useAuth();
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";

  return (
    <AppShell role={appRole}>
      <button
        type="button"
        className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0b385d]"
        onClick={onExit}
      >
        <ChevronLeft className="h-4 w-4" /> Eğitim listesine dön
      </button>
      <div className="mb-7">
        <p className="text-sm font-medium text-teal-700">Eğitim yönetimi</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#0b385d]">
          {id ? "Eğitimi düzenle" : "Yeni eğitim oluştur"}
        </h1>
      </div>
      <form onSubmit={submit}>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-3 md:col-span-2 xl:col-span-3">
                <Label className="text-base font-medium">
                  Eğitim Müdürlüğü <span className="text-rose-600">*</span>
                </Label>
                <RadioGroup
                  value={form.trainingType}
                  onValueChange={value => change("trainingType", value as TrainingFormState["trainingType"])}
                  className="flex flex-wrap gap-4"
                  required
                >
                  {TRAINING_TYPES.map(option => (
                    <label key={option} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <RadioGroupItem value={option} id={`trainingType-${option}`} />
                      <span>{option}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {fields.map(([field, label, type, required]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>
                    {label}
                    {required && <span className="text-rose-600"> *</span>}
                  </Label>
                  <Input
                    id={field}
                    type={type}
                    required={required}
                    value={form[field]}
                    onChange={event => change(field, event.target.value)}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Durum</Label>
                <select
                  value={form.status}
                  onChange={event => change("status", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="DRAFT">Taslak</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="ARCHIVED">Arşiv</option>
                </select>
              </div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="description">Açıklama</Label>
                <Textarea
                  id="description"
                  rows={6}
                  maxLength={10000}
                  value={form.description}
                  onChange={event => change("description", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectives">Öğrenme amaçları</Label>
                <Textarea
                  id="objectives"
                  rows={6}
                  maxLength={10000}
                  value={form.learningObjectives}
                  onChange={event =>
                    change("learningObjectives", event.target.value)
                  }
                />
              </div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-dashed border-slate-300 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#0b385d]">
                  <Upload className="h-4 w-4 text-teal-700" /> Eğitim materyali
                  yükle
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF, PNG, JPEG veya WebP · En fazla 10 MB
                </p>
                <Input
                  className="mt-3 cursor-pointer"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  disabled={upload.isPending}
                  onChange={event =>
                    uploadFile(event.target.files?.[0], "material")
                  }
                />
                {form.fileUrl && (
                  <a
                    className="mt-2 block truncate text-xs font-medium text-teal-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={form.fileUrl}
                  >
                    Yüklenen materyali görüntüle
                  </a>
                )}
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#0b385d]">
                  <ImageUp className="h-4 w-4 text-teal-700" /> Kapak görseli
                  yükle
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPEG veya WebP · En fazla 10 MB
                </p>
                <Input
                  className="mt-3 cursor-pointer"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={upload.isPending}
                  onChange={event =>
                    uploadFile(event.target.files?.[0], "image")
                  }
                />
                {form.imageUrl && (
                  <a
                    className="mt-2 block truncate text-xs font-medium text-teal-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={form.imageUrl}
                  >
                    Yüklenen görseli görüntüle
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onExit}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            disabled={create.isPending || update.isPending || upload.isPending}
            className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"
          >
            <CalendarDays className="h-4 w-4" />{" "}
            {id ? "Değişiklikleri kaydet" : "Eğitimi oluştur"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function TrainingDetail({
  trainingId,
  onBack,
  onEdit,
}: {
  trainingId: number;
  onBack: () => void;
  onEdit: () => void;
}) {
  const query = trpc.admin.trainings.detail.useQuery({ id: trainingId });
  const utils = trpc.useUtils();
  const reopen = trpc.admin.trainings.reopen.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme yeniden açıldı.");
      utils.admin.trainings.detail.invalidate({ id: trainingId });
    },
    onError: error => toast.error(error.message),
  });
  const { user } = useAuth();
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const [downloadingAssignmentId, setDownloadingAssignmentId] = useState<number | null>(null);

  const downloadPdf = async (assignmentId: number, evaluationSetId: number | null, code: string) => {
    setDownloadingAssignmentId(assignmentId);
    try {
      const params = evaluationSetId ? `?evaluationSetId=${evaluationSetId}` : "";
      const response = await fetch(`/api/reports/training/${trainingId}.pdf${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("PDF raporu oluşturulamadı.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `degerlendirme-raporu-${code}-${assignmentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF raporu indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF indirme başarısız oldu.");
    } finally {
      setDownloadingAssignmentId(null);
    }
  };

  if (query.isLoading)
    return (
      <AppShell role={appRole}>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </AppShell>
    );
  if (!query.data)
    return (
      <AppShell role={appRole}>
        <p className="text-slate-500">Eğitim bulunamadı.</p>
      </AppShell>
    );
  const { training, assignments } = query.data;
  return (
    <AppShell role={appRole}>
      <button
        className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0b385d]"
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" /> Eğitim listesine dön
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Eğitim detayı</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#0b385d]">
            {training.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {training.code} · Sürüm {training.version} ·{" "}
            {training.trainingType ?? "Eğitim"}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={training.status} />
          <Button variant="outline" onClick={onEdit}>
            <Edit3 className="mr-2 h-4 w-4" /> Düzenle
          </Button>
        </div>
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="font-semibold text-[#0b385d]">Eğitim künyesi</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Hedef kitle</dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {training.targetAudience ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Sorumlu</dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {training.contentOwner ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Süre</dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {training.durationMinutes
                    ? `${training.durationMinutes} dakika`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Değerlendirme dönemi</dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {formatDate(training.evaluationEndDate)}
                </dd>
              </div>
            </dl>
            {training.description && (
              <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">
                {training.description}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 p-6">
              <h2 className="font-semibold text-[#0b385d]">
                Değerlendirme takip tablosu
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Atama, taslak ve tamamlanma durumlarını izleyin.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[570px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Değerlendirici</th>
                    <th className="px-4 py-3">Değerlendirme seti</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Sonuç</th>
                    <th className="px-5 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map(item => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-700">
                          {item.evaluator.firstName} {item.evaluator.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          Son tarih: {formatDate(item.dueDate)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {item.evaluationSet?.name ?? "Varsayılan set"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        {item.evaluation?.totalScore == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {formatScoreValue(item.evaluation.totalScore, 1)} ·{" "}
                            {item.evaluation.successPercentage?.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => downloadPdf(item.id, item.evaluationSetId, training.code)} disabled={downloadingAssignmentId === item.id}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {downloadingAssignmentId === item.id ? "Hazırlanıyor" : "PDF indir"}
                          </Button>
                          {item.status === "COMPLETED" && (
                            <Button size="sm" variant="outline" onClick={() => reopen.mutate({ assignmentId: item.id })} disabled={reopen.isPending}>
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Yeniden aç
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
