import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SetForm = {
  name: string;
  description: string;
  passingScore: number;
  rubricScale: Record<string, string>;
  selectedCriterionIds: number[];
  weights: Record<number, number>;
};

const defaultRubric = {
  "1": "Uygun değil",
  "2": "Gelişmesi gerekli",
  "3": "Kısmen uygun",
  "4": "Uygun",
  "5": "Mükemmel",
};

const buildEmptyForm = (): SetForm => ({
  name: "",
  description: "",
  passingScore: 70,
  rubricScale: { ...defaultRubric },
  selectedCriterionIds: [],
  weights: {},
});

type CriterionDraft = {
  name: string;
  description: string;
  controlPoints: string[];
};

const buildEmptyCriterionDraft = (): CriterionDraft => ({
  name: "",
  description: "",
  controlPoints: [""],
});

export default function AdminEvaluationSets() {
  const utils = trpc.useUtils();
  const criteriaQuery = trpc.admin.criteria.list.useQuery();
  const setsQuery = trpc.admin.evaluationSets.list.useQuery();
  const createCriterion = trpc.admin.criteria.create.useMutation({
    onSuccess: () => {
      toast.success("Kriter eklendi.");
      setCriterionEditorOpen(false);
      setCriterionDraft(buildEmptyCriterionDraft());
      setEditingCriterionId(null);
      utils.admin.criteria.list.invalidate();
      utils.admin.evaluationSets.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateCriterion = trpc.admin.criteria.update.useMutation({
    onSuccess: () => {
      toast.success("Kriter güncellendi.");
      setCriterionEditorOpen(false);
      setCriterionDraft(buildEmptyCriterionDraft());
      setEditingCriterionId(null);
      utils.admin.criteria.list.invalidate();
      utils.admin.evaluationSets.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeCriterion = trpc.admin.criteria.remove.useMutation({
    onSuccess: () => {
      toast.success("Kriter silindi.");
      utils.admin.criteria.list.invalidate();
      utils.admin.evaluationSets.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const create = trpc.admin.evaluationSets.create.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme seti kaydedildi.");
      setOpen(false);
      setForm(buildEmptyForm());
      utils.admin.evaluationSets.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.evaluationSets.update.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme seti güncellendi.");
      utils.admin.evaluationSets.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.evaluationSets.remove.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme seti pasifleştirildi.");
      utils.admin.evaluationSets.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const restore = trpc.admin.evaluationSets.restore.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme seti aktifleştirildi.");
      utils.admin.evaluationSets.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SetForm>(buildEmptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [criterionEditorOpen, setCriterionEditorOpen] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(
    null
  );
  const [criterionDraft, setCriterionDraft] = useState<CriterionDraft>(
    buildEmptyCriterionDraft()
  );

  useEffect(() => {
    if (!setsQuery.data || !criteriaQuery.data) return;
    if (!editingId) return;
    const editingSet = setsQuery.data.find(set => set.id === editingId);
    if (!editingSet) return;
    setForm({
      name: editingSet.name,
      description: editingSet.description ?? "",
      passingScore: Number(editingSet.passingScore ?? 70),
      rubricScale: editingSet.rubricScale ?? { ...defaultRubric },
      selectedCriterionIds: editingSet.criteria.map(item => item.criterionId),
      weights: Object.fromEntries(
        editingSet.criteria.map(item => [item.criterionId, Number(item.weight)])
      ),
    });
  }, [editingId, setsQuery.data, criteriaQuery.data]);

  const selectableCriteria = useMemo(
    () => (criteriaQuery.data ?? []).filter(criterion => criterion.isActive),
    [criteriaQuery.data]
  );

  const criteriaById = useMemo(
    () =>
      new Map(selectableCriteria.map(criterion => [criterion.id, criterion])),
    [selectableCriteria]
  );

  const selectedCriteria = useMemo(
    () =>
      form.selectedCriterionIds
        .map(id => criteriaById.get(id))
        .filter((criterion): criterion is NonNullable<typeof criterion> =>
          Boolean(criterion)
        ),
    [criteriaById, form.selectedCriterionIds]
  );

  const totalCriterionPoints = useMemo(
    () =>
      criterionDraft.controlPoints.filter(point => point.trim().length > 0)
        .length,
    [criterionDraft.controlPoints]
  );

  const totalWeight = useMemo(
    () =>
      selectedCriteria.reduce((sum, criterion) => {
        const weight = Number(form.weights[criterion.id] ?? 0);
        return sum + (Number.isFinite(weight) ? weight : 0);
      }, 0),
    [form.weights, selectedCriteria]
  );

  const toggleCriterion = (criterionId: number) => {
    setForm(current => {
      const has = current.selectedCriterionIds.includes(criterionId);
      const selectedCriterionIds = has
        ? current.selectedCriterionIds.filter(id => id !== criterionId)
        : [...current.selectedCriterionIds, criterionId];
      const weights = { ...current.weights };
      if (!has) {
        weights[criterionId] = 0;
      }
      return { ...current, selectedCriterionIds, weights };
    });
  };

  const updateWeight = (criterionId: number, value: string) => {
    const numeric = Number(value);
    setForm(current => ({
      ...current,
      weights: {
        ...current.weights,
        [criterionId]: Number.isFinite(numeric) ? numeric : 0,
      },
    }));
  };

  const updateCriterionPoint = (index: number, value: string) => {
    setCriterionDraft(current => ({
      ...current,
      controlPoints: current.controlPoints.map((point, pointIndex) =>
        pointIndex === index ? value : point
      ),
    }));
  };

  const addCriterionPoint = () => {
    setCriterionDraft(current => ({
      ...current,
      controlPoints: [...current.controlPoints, ""],
    }));
  };

  const removeCriterionPoint = (index: number) => {
    setCriterionDraft(current => {
      const points = current.controlPoints.filter(
        (_, pointIndex) => pointIndex !== index
      );
      return {
        ...current,
        controlPoints: points.length > 0 ? points : [""],
      };
    });
  };

  const submitCriterion = () => {
    const cleaned = {
      name: criterionDraft.name.trim(),
      description: criterionDraft.description.trim() || null,
      controlPoints: criterionDraft.controlPoints
        .map(point => point.trim())
        .filter(Boolean),
    };

    if (!cleaned.name) {
      toast.error("Kriter adı zorunludur.");
      return;
    }

    if (cleaned.controlPoints.length === 0) {
      toast.error("En az bir kontrol noktası ekleyin.");
      return;
    }

    if (editingCriterionId) {
      updateCriterion.mutate({ id: editingCriterionId, ...cleaned });
      return;
    }

    createCriterion.mutate(cleaned);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Set adı zorunludur.");
      return;
    }
    if (!form.selectedCriterionIds.length) {
      toast.error("En az bir kriter seçmelisiniz.");
      return;
    }
    if (
      !Number.isFinite(form.passingScore) ||
      form.passingScore < 0 ||
      form.passingScore > 100
    ) {
      toast.error("Baraj puanı 0 ile 100 arasında olmalıdır.");
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.0001) {
      toast.error("Toplam ağırlık 100 olmalıdır.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      passingScore: form.passingScore,
      rubricScale: form.rubricScale,
      criteria: form.selectedCriterionIds.map(criterionId => ({
        criterionId,
        weight: Number(form.weights[criterionId] ?? 0),
      })),
    };

    if (editingId) {
      update.mutate({ id: editingId, ...payload });
      return;
    }

    create.mutate(payload);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setOpen(true);
  };

  const openEdit = (setId: number) => {
    setEditingId(setId);
    setOpen(true);
  };

  const openCriterionCreate = () => {
    setEditingCriterionId(null);
    setCriterionDraft(buildEmptyCriterionDraft());
    setCriterionEditorOpen(true);
  };

  const openCriterionEdit = (criterion: {
    id: number;
    name: string;
    description?: string | null;
    controlPoints?: string[];
  }) => {
    setEditingCriterionId(criterion.id);
    setCriterionDraft({
      name: criterion.name,
      description: criterion.description ?? "",
      controlPoints:
        Array.isArray(criterion.controlPoints) &&
        criterion.controlPoints.length > 0
          ? criterion.controlPoints
          : [""],
    });
    setCriterionEditorOpen(true);
  };

  return (
    <AppShell role="ADMIN">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">
            Değerlendirme yapılandırması
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            Değerlendirme Setleri
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Farklı değerlendirme setlerini tanımlayın, rubrik ölçeğini ve
            ağırlıkları yönetin.
          </p>
        </div>
        <Button
          className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" /> Yeni set
        </Button>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {setsQuery.data?.map(set => (
          <Card key={set.id} className="border-slate-200 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0b385d]">{set.name}</p>
                  {set.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {set.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    Baraj: {Number(set.passingScore ?? 70)}%
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700">
                    {set.criteria.reduce(
                      (sum, item) => sum + Number(item.weight ?? 0),
                      0
                    )}{" "}
                    / 100
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Rubrik
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(set.rubricScale ?? {}).map(
                    ([score, label]) => (
                      <span
                        key={score}
                        className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700"
                      >
                        {score}: {label}
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Kriterler
                </p>
                <div className="flex flex-wrap gap-2">
                  {set.criteria.map(item => (
                    <span
                      key={item.criterionId}
                      className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700"
                    >
                      {item.name} ({item.weight})
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(set.id)}
                >
                  Düzenle
                </Button>
                {set.isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-rose-600 hover:text-rose-700"
                    onClick={() => remove.mutate({ id: set.id })}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Kaldır
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-teal-700 hover:text-teal-800"
                    onClick={() => restore.mutate({ id: set.id })}
                    disabled={restore.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Aktifleştir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {criterionEditorOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  {editingCriterionId ? "Kriter düzenle" : "Yeni kriter"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#0b385d]">
                  {editingCriterionId
                    ? "Kriter bilgilerini güncelle"
                    : "Yeni kriter ekle"}
                </h2>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setCriterionEditorOpen(false);
                  setEditingCriterionId(null);
                  setCriterionDraft(buildEmptyCriterionDraft());
                }}
              >
                Kapat
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label>Kriter adı</Label>
                <Input
                  value={criterionDraft.name}
                  onChange={event =>
                    setCriterionDraft(current => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ör: Geri bildirim kalitesi"
                />
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  value={criterionDraft.description}
                  onChange={event =>
                    setCriterionDraft(current => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Kriterin değerlendirme amacı kısa açıklanır..."
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Kontrol noktaları</Label>
                  <span className="text-xs text-slate-500">
                    {totalCriterionPoints} adet
                  </span>
                </div>

                {criterionDraft.controlPoints.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={point}
                      onChange={event =>
                        updateCriterionPoint(index, event.target.value)
                      }
                      placeholder={`Kontrol noktası ${index + 1}`}
                    />
                    {criterionDraft.controlPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeCriterionPoint(index)}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={addCriterionPoint}
                >
                  <Plus className="h-4 w-4" /> Kontrol noktası ekle
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCriterionEditorOpen(false);
                  setEditingCriterionId(null);
                  setCriterionDraft(buildEmptyCriterionDraft());
                }}
              >
                İptal
              </Button>
              <Button
                className="bg-[#0b385d] hover:bg-[#082d4c]"
                onClick={submitCriterion}
                disabled={
                  createCriterion.isPending || updateCriterion.isPending
                }
              >
                {createCriterion.isPending || updateCriterion.isPending
                  ? "Kaydediliyor..."
                  : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  {editingId ? "Set düzenle" : "Yeni set"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#0b385d]">
                  {editingId ? "Değerlendirme seti" : "Yeni değerlendirme seti"}
                </h2>
              </div>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Set adı</Label>
                  <Input
                    value={form.name}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ör: E-eğitim Değerlendirme"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    value={form.description}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Setin amacını açıklayın..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Baraj puanı</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.passingScore}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        passingScore: Number(event.target.value),
                      }))
                    }
                    placeholder="70"
                  />
                  <p className="text-xs text-slate-500">
                    Değerlendirme yüzdesi bu değere eşit veya yüksekse sonuç
                    başarılı sayılır.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Rubrik ifadeleri</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        setForm(current => {
                          const nextScore = String(
                            Object.keys(current.rubricScale).length + 1
                          );
                          return {
                            ...current,
                            rubricScale: {
                              ...current.rubricScale,
                              [nextScore]: "",
                            },
                          };
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Ekle
                    </Button>
                  </div>
                  {Object.entries(form.rubricScale).map(([score, label]) => (
                    <div key={score} className="flex items-center gap-2">
                      <span className="grid h-8 w-10 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                        {score}
                      </span>
                      <Input
                        value={label}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            rubricScale: {
                              ...current.rubricScale,
                              [score]: event.target.value,
                            },
                          }))
                        }
                      />
                      {Object.keys(form.rubricScale).length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setForm(current => {
                              const nextScale = { ...current.rubricScale };
                              delete nextScale[score];
                              return {
                                ...current,
                                rubricScale: nextScale,
                              };
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Kriter seçimi</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        Toplam {totalWeight.toFixed(1)} / 100
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={openCriterionCreate}
                      >
                        <Plus className="h-3.5 w-3.5" /> Ekle
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectableCriteria.map(criterion => (
                      <div
                        key={criterion.id}
                        className="rounded-lg border border-slate-200 bg-white p-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex flex-1 items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={form.selectedCriterionIds.includes(
                                criterion.id
                              )}
                              onChange={() => toggleCriterion(criterion.id)}
                            />
                            <span>{criterion.name}</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openCriterionEdit(criterion)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700"
                              onClick={() =>
                                removeCriterion.mutate({ id: criterion.id })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-slate-500">
                            {criterion.controlPoints.length} kontrol
                          </span>
                          {form.selectedCriterionIds.includes(criterion.id) && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={Number(form.weights[criterion.id] ?? 0)}
                                onChange={event =>
                                  updateWeight(criterion.id, event.target.value)
                                }
                                className="w-24"
                              />
                              <span className="text-xs text-slate-500">
                                ağırlık
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button
                className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"
                onClick={submit}
                disabled={create.isPending || update.isPending}
              >
                <Save className="h-4 w-4" />{" "}
                {create.isPending || update.isPending
                  ? "Kaydediliyor..."
                  : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
