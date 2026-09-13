import { AppShell, StatusBadge, formatDate } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { getRubricLabel, getRubricMaxScore } from "@/lib/rubricScale";
import { trpc } from "@/lib/trpc";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock3,
  FileText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const { user } = useAuth();
  const shellRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : user?.role === "ADMIN" ? "ADMIN" : "EVALUATOR";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("INCOMPLETE");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState<string>("ALL");
  const [evaluationSetFilter, setEvaluationSetFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<string>("DUE_DATE_ASC");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);

  const trainingTypes = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<string>();
    query.data.forEach(item => {
      if (item.training.trainingType) set.add(item.training.trainingType);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [query.data]);

  const evaluationSets = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<string>();
    query.data.forEach(item => {
      if (item.evaluationSet?.name) set.add(item.evaluationSet.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [query.data]);

  const filteredAssignments = useMemo(() => {
    if (!query.data) return [];

    return query.data
      .filter(item => {
        // Status Filter
        if (statusFilter === "INCOMPLETE") {
          if (item.status === "COMPLETED") return false;
        } else if (statusFilter === "PENDING") {
          if (item.status !== "PENDING" && item.status !== "REOPENED") return false;
        } else if (statusFilter === "DRAFT") {
          if (item.status !== "DRAFT") return false;
        } else if (statusFilter === "COMPLETED") {
          if (item.status !== "COMPLETED") return false;
        } else if (statusFilter === "OVERDUE") {
          if (item.status !== "OVERDUE") return false;
        } else if (statusFilter === "NEAR_DUE") {
          if (!item.nearDue) return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = item.training.title?.toLowerCase().includes(q);
          const codeMatch = item.training.code?.toLowerCase().includes(q);
          const setMatch = item.evaluationSet?.name?.toLowerCase().includes(q);
          if (!titleMatch && !codeMatch && !setMatch) return false;
        }

        // Training Type Filter
        if (trainingTypeFilter !== "ALL") {
          if (item.training.trainingType !== trainingTypeFilter) return false;
        }

        // Evaluation Set Filter
        if (evaluationSetFilter !== "ALL") {
          if (item.evaluationSet?.name !== evaluationSetFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const getDue = (dateVal: any) => (dateVal ? new Date(dateVal).getTime() : Infinity);
        const getCreated = (dateVal: any) => (dateVal ? new Date(dateVal).getTime() : 0);

        switch (sortOrder) {
          case "DUE_DATE_ASC": {
            const diff = getDue(a.dueDate) - getDue(b.dueDate);
            if (diff !== 0) return diff;
            return a.training.title.localeCompare(b.training.title, "tr");
          }
          case "DUE_DATE_DESC": {
            const diff = getDue(b.dueDate) - getDue(a.dueDate);
            if (diff !== 0) return diff;
            return a.training.title.localeCompare(b.training.title, "tr");
          }
          case "TITLE_ASC":
            return a.training.title.localeCompare(b.training.title, "tr");
          case "TITLE_DESC":
            return b.training.title.localeCompare(a.training.title, "tr");
          case "CREATED_DESC":
            return getCreated(b.createdAt) - getCreated(a.createdAt);
          default:
            return 0;
        }
      });
  }, [query.data, statusFilter, searchQuery, trainingTypeFilter, evaluationSetFilter, sortOrder]);

  const hasNonDefaultFilters =
    statusFilter !== "INCOMPLETE" ||
    sortOrder !== "DUE_DATE_ASC" ||
    searchQuery.trim() !== "" ||
    trainingTypeFilter !== "ALL" ||
    evaluationSetFilter !== "ALL";

  const customFilterCount = [
    statusFilter !== "INCOMPLETE",
    sortOrder !== "DUE_DATE_ASC",
    searchQuery.trim() !== "",
    trainingTypeFilter !== "ALL",
    evaluationSetFilter !== "ALL",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setStatusFilter("INCOMPLETE");
    setSortOrder("DUE_DATE_ASC");
    setSearchQuery("");
    setTrainingTypeFilter("ALL");
    setEvaluationSetFilter("ALL");
  };

  return (
    <AppShell role={shellRole}>
      <div>
        <p className="text-sm font-medium text-teal-700">Değerlendirme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
          Atamalarım
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Atandığınız eğitimlerin durumunu takip edin, taslaklara devam edin veya tamamlanmış değerlendirmeleri görüntüleyin.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Eğitim adı, kod veya değerlendirme seti ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isFilterExpanded ? "default" : "outline"}
              onClick={() => setIsFilterExpanded(prev => !prev)}
              className={`gap-2 ${
                isFilterExpanded
                  ? "bg-[#0b385d] text-white hover:bg-[#082d4c]"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Detaylı Filtreler
              {customFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">
                  {customFilterCount}
                </span>
              )}
              {isFilterExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {hasNonDefaultFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1.5 text-slate-600 hover:text-[#0b385d]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Filtreleri Sıfırla
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Panel */}
        {isFilterExpanded && (
          <Card className="border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Durum
                </label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="INCOMPLETE">Tamamlanmamışlar (Varsayılan)</option>
                  <option value="ALL">Tüm Durumlar</option>
                  <option value="PENDING">Bekleyenler</option>
                  <option value="DRAFT">Taslaklar</option>
                  <option value="COMPLETED">Tamamlananlar</option>
                  <option value="OVERDUE">Süresi Geçenler</option>
                  <option value="NEAR_DUE">Son 3 Gün (Öncelikli)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Sıralama
                </label>
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="DUE_DATE_ASC">Son Teslim Tarihi (Öncelikli - En Yakın)</option>
                  <option value="DUE_DATE_DESC">Son Teslim Tarihi (En Uzak)</option>
                  <option value="TITLE_ASC">Eğitim Adı (A-Z)</option>
                  <option value="TITLE_DESC">Eğitim Adı (Z-A)</option>
                  <option value="CREATED_DESC">Atama Tarihi (Yeni - Eski)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Eğitim Türü
                </label>
                <select
                  value={trainingTypeFilter}
                  onChange={e => setTrainingTypeFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">Tüm Türler</option>
                  {trainingTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Değerlendirme Seti
                </label>
                <select
                  value={evaluationSetFilter}
                  onChange={e => setEvaluationSetFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">Tüm Setler</option>
                  {evaluationSets.map(set => (
                    <option key={set} value={set}>
                      {set}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Count and default filter notice */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 pt-1 gap-2">
          <span>
            {query.data ? `${filteredAssignments.length} / ${query.data.length} atama listeleniyor` : ""}
          </span>
          {statusFilter === "INCOMPLETE" && (
            <span className="font-medium text-teal-700">
              * Varsayılan: Tamamlanmamış ve son teslim tarihine göre öncelikli sıralı.
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {query.isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ) : filteredAssignments.length ? (
          filteredAssignments.map(item => (
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
              <p className="text-lg font-semibold text-[#0b385d]">
                {query.data?.length ? "Filtrelere uyan atama bulunamadı." : "Henüz atama yok."}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {query.data?.length
                  ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyin."
                  : "Size atanmış bir eğitim bulunmuyor."}
              </p>
              {hasNonDefaultFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Filtreleri Sıfırla
                </Button>
              )}
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"evaluation" | "training">("evaluation");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [generalComment, setGeneralComment] = useState("");

  const shellRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : user?.role === "ADMIN" ? "ADMIN" : "EVALUATOR";

  const assignmentSet =
    detail.data?.evaluationSet ?? null;
  const maxScore = getRubricMaxScore(assignmentSet?.rubricScale ?? null);
  const scoreOptions = Array.from({ length: maxScore }, (_, index) => index + 1);
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
    onSuccess: (result, variables) => {
      utils.evaluator.assignments.invalidate();
      utils.evaluator.dashboard.invalidate();
      utils.evaluator.assignmentDetail.invalidate({ assignmentId });
      toast.success(result?.summary ? "Değerlendirme tamamlandı." : "Taslak kaydedildi.");
      if (variables.complete) {
        onBack();
      }
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
      <AppShell role={shellRole}>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </AppShell>
    );

  if (!detail.data) {
    return (
      <AppShell role={shellRole}>
        <p>Atama bulunamadı.</p>
      </AppShell>
    );
  }

  const { assignment, training, evaluation } = detail.data;
  const isCompleted = assignment.status === "COMPLETED";
  const weightedTotal = visibleCriteria.reduce((sum, criterion) => {
    const score = scores[criterion.id] ?? 0;
    const weight = criterion.weight ?? 100 / Math.max(visibleCriteria.length, 1);
    return sum + (weight * score) / maxScore;
  }, 0);
  const total = weightedTotal;
  const passingScore = Number(assignmentSet?.passingScore ?? 70);

  return (
    <AppShell role={shellRole}>
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold leading-6 text-[#0b385d]">{criterion.name}</h2>
                        <span className="text-sm font-semibold text-red-600">{criterion.weight}%</span>
                      </div>
                      {criterion.description && (
                        <p className="mt-1 text-sm text-slate-500">{criterion.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm font-medium text-slate-700">Puan</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        {scoreOptions.map(score => {
                          const rubricLabel = getRubricLabel(assignmentSet?.rubricScale ?? null, score);
                          const isSelected = scores[criterion.id] === score;

                          return (
                            <div key={score} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setScores(prev => ({ ...prev, [criterion.id]: score }))
                                }
                                className={`h-9 min-w-9 rounded-lg border text-sm font-semibold transition-colors ${
                                  isSelected
                                    ? "border-teal-600 bg-teal-600 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-700"
                                }`}
                                title={rubricLabel || `Puan ${score}`}
                              >
                                {score}
                              </button>
                              {rubricLabel && (
                                <span
                                  className={`text-xs ${
                                    isSelected ? "font-semibold text-teal-700" : "text-slate-500"
                                  }`}
                                >
                                  {rubricLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
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
                  Değerlendirme son tarihi
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDate(training.evaluationEndDate)}</dd>
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
