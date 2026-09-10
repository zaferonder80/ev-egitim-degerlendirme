import { AppShell, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type CriterionForm = {
  name: string;
  description: string;
  controlPoints: string[];
};

const buildEmptyForm = (): CriterionForm => ({
  name: "",
  description: "",
  controlPoints: [""],
});

export default function AdminCriteria() {
  const utils = trpc.useUtils();
  const criteriaQuery = trpc.admin.criteria.list.useQuery();
  const create = trpc.admin.criteria.create.useMutation({
    onSuccess: () => {
      toast.success("Kriter eklendi.");
      setOpen(false);
      setForm(buildEmptyForm());
      utils.admin.criteria.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.criteria.remove.useMutation({
    onSuccess: () => {
      toast.success("Kriter pasifleştirildi.");
      utils.admin.criteria.list.invalidate();
      utils.admin.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CriterionForm>(buildEmptyForm());

  const totalControlPoints = useMemo(
    () => form.controlPoints.filter(point => point.trim().length > 0).length,
    [form.controlPoints]
  );

  const updatePoint = (index: number, value: string) => {
    setForm(current => ({
      ...current,
      controlPoints: current.controlPoints.map((point, pointIndex) =>
        pointIndex === index ? value : point
      ),
    }));
  };

  const addControlPoint = () => {
    setForm(current => ({
      ...current,
      controlPoints: [...current.controlPoints, ""],
    }));
  };

  const removeControlPoint = (index: number) => {
    setForm(current => {
      const points = current.controlPoints.filter((_, pointIndex) => pointIndex !== index);
      return {
        ...current,
        controlPoints: points.length > 0 ? points : [""],
      };
    });
  };

  const submit = () => {
    const cleaned = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      controlPoints: form.controlPoints
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

    create.mutate(cleaned);
  };

  return (
    <AppShell role="ADMIN">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Değerlendirme yapılandırması</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            Kriter Yönetimi
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Yeni kriter ekleyin, mevcut olanları pasifleştirin ve değerlendirme kalitesini yönetin.
          </p>
        </div>
        <Button className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Yeni kriter
        </Button>
      </div>

      <Card className="mt-7 border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Kriter</th>
                  <th className="px-4 py-4">Kontrol noktaları</th>
                  <th className="px-4 py-4">Durum</th>
                  <th className="px-6 py-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteriaQuery.data?.map(criterion => (
                  <tr key={criterion.id}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0b385d]">{criterion.name}</p>
                      {criterion.description && (
                        <p className="mt-1 max-w-xl text-xs text-slate-500">{criterion.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(criterion.controlPoints) ? criterion.controlPoints : []).map((point, index) => (
                          <span key={`${criterion.id}-${index}`} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                            {point}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={criterion.isActive ? "ACTIVE" : "ARCHIVED"} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-rose-600 hover:text-rose-700"
                          onClick={() => remove.mutate({ id: criterion.id })}
                          disabled={!criterion.isActive}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Kaldır
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-teal-700">Yeni kriter</p>
                <h2 className="mt-1 text-xl font-semibold text-[#0b385d]">Kriter ekle</h2>
              </div>
              <Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label>Kriter adı</Label>
                <Input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Ör: Geri bildirim kalitesi"
                />
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  value={form.description}
                  onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                  placeholder="Kriterin değerlendirme amacı kısa açıklanır..."
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Kontrol noktaları</Label>
                  <span className="text-xs text-slate-500">{totalControlPoints} adet</span>
                </div>

                {form.controlPoints.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={point}
                      onChange={event => updatePoint(index, event.target.value)}
                      placeholder={`Kontrol noktası ${index + 1}`}
                    />
                    {form.controlPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeControlPoint(index)}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button variant="outline" className="gap-2" onClick={addControlPoint}>
                  <Plus className="h-4 w-4" /> Kontrol noktası ekle
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button className="bg-[#0b385d] hover:bg-[#082d4c]" onClick={submit} disabled={create.isPending}>
                {create.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
