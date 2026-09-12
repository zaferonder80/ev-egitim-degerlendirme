import { AppShell, formatDate, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ClipboardPlus,
  Edit3,
  ImageUp,
  Plus,
  RotateCcw,
  Upload,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type TrainingFormState = {
  code: string;
  title: string;
  description: string;
  trainingType: string;
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
  evaluationStartDate: string;
  evaluationEndDate: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};
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
  evaluationStartDate: "",
  evaluationEndDate: "",
  status: "DRAFT",
};
const toInputDate = (value?: Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const optional = (value: string) => value.trim() || null;
const toDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`) : null;

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
  const [evaluatorIds, setEvaluatorIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState("");
  const evaluators =
    usersQuery.data?.filter(user => user.role === "EVALUATOR") ?? [];
  const assigningTraining = assigning
    ? trainingsQuery.data?.find(item => item.id === assigning.id)
    : undefined;
  const completedEvaluatorIds = new Set(
    assigningTraining?.completedEvaluatorIds ?? []
  );
  const allEvaluatorsSelected =
    evaluators.length > 0 &&
    evaluators.every(evaluator => evaluatorIds.includes(evaluator.id));
  const toggleAllEvaluators = () =>
    setEvaluatorIds(
      allEvaluatorsSelected
        ? Array.from(completedEvaluatorIds)
        : evaluators.map(evaluator => evaluator.id)
    );
  useEffect(() => {
    if (!assigning) return;
    const training = trainingsQuery.data?.find(
      item => item.id === assigning.id
    );
    if (training) setEvaluatorIds(training.evaluatorIds);
  }, [assigning, trainingsQuery.data]);
  const submitAssignment = (event: FormEvent) => {
    event.preventDefault();
    if (!assigning || !dueDate)
      return toast.error("Son tarih seçin.");
    assign.mutate({
      trainingId: assigning.id,
      evaluatorIds,
      dueDate: new Date(`${dueDate}T12:00:00`),
    });
  };
  return (
    <AppShell role="ADMIN">
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
      <Card className="mt-7 border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Eğitim</th>
                  <th className="px-4 py-4 font-semibold">Durum</th>
                  <th className="px-4 py-4 font-semibold">Atama</th>
                  <th className="px-4 py-4 font-semibold">Ortalama</th>
                  <th className="px-4 py-4 font-semibold">Son tarih</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainingsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Eğitimler yükleniyor…
                    </td>
                  </tr>
                ) : trainingsQuery.data?.length ? (
                  trainingsQuery.data.map(training => (
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
                        <StatusBadge status={training.status} />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-700">
                          {training.completedCount} / {training.assignedCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          {training.pendingCount} bekliyor
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {training.averageTotal === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-700">
                              {training.averageTotal.toFixed(1)} / 40
                            </p>
                            <StatusBadge status={training.successStatus} />
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(training.evaluationEndDate)}
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
                              setAssigning({
                                id: training.id,
                                title: training.title,
                              });
                              setEvaluatorIds(training.evaluatorIds);
                              setDueDate(
                                toInputDate(training.evaluationEndDate)
                              );
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <ClipboardPlus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 font-medium text-slate-700">
                        Henüz eğitim bulunmuyor.
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        İlk eğitim kaydını oluşturarak değerlendirme sürecini
                        başlatın.
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
                onClick={() => setAssigning(null)}
              >
                Kapat
              </button>
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
                  disabled={!evaluators.length}
                  onClick={toggleAllEvaluators}
                >
                  {allEvaluatorsSelected ? "Tümünü kaldır" : "Tümünü seç"}
                </button>
              </div>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                {evaluators.map(evaluator => (
                  <label
                    key={evaluator.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className={
                        completedEvaluatorIds.has(evaluator.id)
                          ? "accent-emerald-600"
                          : "accent-teal-600"
                      }
                      disabled={completedEvaluatorIds.has(evaluator.id)}
                      checked={evaluatorIds.includes(evaluator.id)}
                      onChange={event =>
                        setEvaluatorIds(
                          event.target.checked
                            ? [...evaluatorIds, evaluator.id]
                            : evaluatorIds.filter(id => id !== evaluator.id)
                        )
                      }
                    />
                    <span className="text-sm text-slate-700">
                      {evaluator.firstName} {evaluator.lastName}
                      <small className="ml-2 text-slate-400">
                        {evaluator.email}
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
        trainingType: existing.trainingType ?? "",
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
        evaluationStartDate: toInputDate(existing.evaluationStartDate),
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
    const input = {
      code,
      title,
      description: optional(form.description),
      trainingType: optional(form.trainingType),
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
      evaluationStartDate: toDate(form.evaluationStartDate),
      evaluationEndDate: toDate(form.evaluationEndDate),
      status: form.status,
    };
    if (
      input.evaluationStartDate &&
      input.evaluationEndDate &&
      input.evaluationStartDate > input.evaluationEndDate
    )
      return toast.error(
        "Değerlendirme başlangıç tarihi bitiş tarihinden sonra olamaz."
      );
    if (id) update.mutate({ id, ...input });
    else create.mutate({ ...input, evaluatorIds: [] });
  };
  const fields: Array<[keyof TrainingFormState, string, string, boolean]> = [
    ["code", "Eğitim kodu", "text", true],
    ["title", "Eğitim adı", "text", true],
    ["trainingType", "Eğitim türü", "text", false],
    ["targetAudience", "Hedef kitle", "text", false],
    ["durationMinutes", "Süre (dakika)", "number", false],
    ["contentOwner", "Sorumlu", "text", false],
    ["version", "Sürüm", "text", true],
    ["trainingUrl", "Eğitim bağlantısı", "text", false],
    ["publishDate", "Yayın tarihi", "date", false],
    ["lastUpdatedDate", "Son güncelleme", "date", false],
    ["evaluationStartDate", "Değerlendirme başlangıcı", "date", false],
    ["evaluationEndDate", "Değerlendirme son tarihi", "date", false],
  ];
  return (
    <AppShell role="ADMIN">
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
  if (query.isLoading)
    return (
      <AppShell role="ADMIN">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </AppShell>
    );
  if (!query.data)
    return (
      <AppShell role="ADMIN">
        <p className="text-slate-500">Eğitim bulunamadı.</p>
      </AppShell>
    );
  const { training, assignments } = query.data;
  return (
    <AppShell role="ADMIN">
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
                  {formatDate(training.evaluationStartDate)} —{" "}
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
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        {item.evaluation?.totalScore == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {item.evaluation.totalScore}/40 ·{" "}
                            {item.evaluation.successPercentage?.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {item.status === "COMPLETED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              reopen.mutate({ assignmentId: item.id })
                            }
                            disabled={reopen.isPending}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Yeniden
                            aç
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
