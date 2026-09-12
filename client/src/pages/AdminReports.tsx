import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatScoreValue } from "@shared/score";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, FileBarChart, FileSpreadsheet, Filter, Loader2, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function getSessionHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("ev-preview-session");
  return token ? { "X-EV-Session": token } : {};
}

export default function AdminReports() {
  const query = trpc.admin.reports.list.useQuery();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const { user } = useAuth();
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const reportRows = query.data ?? [];
  const ownerOptions = Array.from(new Set(reportRows.map(row => row.contentOwner))).sort((first, second) => first.localeCompare(second, "tr"));
  const trainingTypeOptions = Array.from(new Set(reportRows.map(row => row.trainingType))).sort((first, second) => first.localeCompare(second, "tr"));
  const setOptions = Array.from(new Map(reportRows.map(row => [String(row.evaluationSetId ?? "none"), row.evaluationSetName])).entries()).sort((first, second) => first[1].localeCompare(second[1], "tr"));
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");
  const filteredRows = reportRows.filter(row => {
    const searchableText = `${row.title} ${row.code} ${row.evaluationSetName}`.toLocaleLowerCase("tr-TR");
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
    const matchesOwner = ownerFilter === "all" || row.contentOwner === ownerFilter;
    const matchesTrainingType = trainingTypeFilter === "all" || row.trainingType === trainingTypeFilter;
    const matchesSet = setFilter === "all" || String(row.evaluationSetId ?? "none") === setFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "successful" && row.successStatus === "SUCCESSFUL")
      || (statusFilter === "unsuccessful" && row.successStatus === "UNSUCCESSFUL")
      || (statusFilter === "pending" && row.successStatus === null);
    const matchesCompletion = completionFilter === "all"
      || (completionFilter === "completed" && row.completedCount === row.assignedCount)
      || (completionFilter === "incomplete" && row.completedCount < row.assignedCount);
    return matchesSearch && matchesOwner && matchesTrainingType && matchesSet && matchesStatus && matchesCompletion;
  });
  const hasActiveFilters = Boolean(searchTerm || ownerFilter !== "all" || trainingTypeFilter !== "all" || setFilter !== "all" || statusFilter !== "all" || completionFilter !== "all");
  const resetFilters = () => {
    setSearchTerm("");
    setOwnerFilter("all");
    setTrainingTypeFilter("all");
    setSetFilter("all");
    setStatusFilter("all");
    setCompletionFilter("all");
  };

  const downloadPdf = async (trainingId: number, evaluationSetId: number | null, code: string, setName: string) => {
    const queryString = evaluationSetId ? `?evaluationSetId=${evaluationSetId}` : "";
    const setSuffix = setName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g, "-").replace(/^-|-$/g, "");
    setDownloadingId(`${trainingId}-${evaluationSetId ?? "none"}`);
    try {
      const response = await fetch(`/api/reports/training/${trainingId}.pdf${queryString}`, {
        credentials: "include",
        headers: getSessionHeaders(),
      });

      if (!response.ok) {
        let message = "PDF raporu oluşturulamadı.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error === "forbidden") {
            message = "Raporu indirmek için yönetici yetkisi gerekir.";
          }
        } catch {
          // JSON olmayan hata yanıtı
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("PDF raporu boş döndü.");

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `degerlendirme-raporu-${code}-${setSuffix}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF raporu indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF indirme başarısız oldu.");
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadExcel = async (trainingId: number, evaluationSetId: number | null, code: string, setName: string) => {
    const queryString = evaluationSetId ? `?evaluationSetId=${evaluationSetId}` : "";
    const setSuffix = setName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+/g, "-").replace(/^-|-$/g, "");
    setDownloadingId(`${trainingId}-${evaluationSetId ?? "none"}`);
    try {
      const response = await fetch(`/api/reports/training/${trainingId}.xlsx${queryString}`, { credentials: "include", headers: getSessionHeaders() });
      if (!response.ok) throw new Error("Excel raporu oluşturulamadı.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Excel raporu boş döndü.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `degerlendirme-raporu-${code}-${setSuffix}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel raporu indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel indirme başarısız oldu.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppShell role={appRole}>
      <div>
        <p className="text-sm font-medium text-teal-700">Kurumsal raporlama</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
          Değerlendirme raporları
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Tamamlanan değerlendirmeleri PDF veya Excel dosyası olarak indirin.
        </p>
      </div>

      <div className="mt-7 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0b385d]"><Filter className="h-4 w-4 text-teal-700" /> Rapor filtreleri</div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{filteredRows.length} / {reportRows.length} kayıt gösteriliyor</span>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={resetFilters} disabled={!hasActiveFilters}><RotateCcw className="h-3.5 w-3.5" /> Temizle</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Eğitim, kod veya set ara" className="pl-9 bg-white" aria-label="Eğitim, kod veya değerlendirme seti ara" />
            </div>
            <Select value={trainingTypeFilter} onValueChange={setTrainingTypeFilter}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Eğitim Müdürlüğü" /></SelectTrigger>
              <SelectContent className="bg-white opacity-100"><SelectItem value="all">Tüm eğitim müdürlükleri</SelectItem>{trainingTypeOptions.map(trainingType => <SelectItem key={trainingType} value={trainingType}>{trainingType}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Eğitim sorumlusu" /></SelectTrigger>
              <SelectContent className="bg-white opacity-100"><SelectItem value="all">Tüm eğitim sorumluları</SelectItem>{ownerOptions.map(owner => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={setFilter} onValueChange={setSetFilter}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Değerlendirme seti" /></SelectTrigger>
              <SelectContent className="bg-white opacity-100"><SelectItem value="all">Tüm değerlendirme setleri</SelectItem>{setOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Sonuç" /></SelectTrigger>
              <SelectContent className="bg-white opacity-100"><SelectItem value="all">Tüm sonuçlar</SelectItem><SelectItem value="successful">Başarılı</SelectItem><SelectItem value="unsuccessful">Başarısız</SelectItem><SelectItem value="pending">Henüz sonuç yok</SelectItem></SelectContent>
            </Select>
            <Select value={completionFilter} onValueChange={setCompletionFilter}>
              <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Tamamlanma" /></SelectTrigger>
              <SelectContent className="bg-white opacity-100"><SelectItem value="all">Tüm tamamlanma durumları</SelectItem><SelectItem value="completed">Tamamı tamamlandı</SelectItem><SelectItem value="incomplete">Eksik değerlendirme</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Eğitim</th>
                  <th className="px-4 py-4">Eğitim Müdürlüğü</th>
                  <th className="px-4 py-4">Değerlendirme seti</th>
                  <th className="px-4 py-4">Atama</th>
                  <th className="px-4 py-4">Ortalama puan</th>
                  <th className="px-4 py-4">Sonuç</th>
                  <th className="px-6 py-4 text-right">Rapor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Raporlar yükleniyor…
                    </td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map(training => (
                    <tr key={training.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#0b385d]">{training.title}</p>
                        <p className="text-xs text-slate-500">
                          {training.code} · Sürüm {training.version}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">{training.trainingType}</td>
                      <td className="px-4 py-4 font-medium text-slate-700">{training.evaluationSetName}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {training.completedCount} / {training.assignedCount}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {training.averageTotal === null ? "—" : formatScoreValue(training.averageTotal, 2)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={training.successStatus} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5" disabled={training.completedCount === 0 || downloadingId !== null} onClick={() => downloadPdf(training.trainingId, training.evaluationSetId, training.code, training.evaluationSetName)}>
                            {downloadingId === `${training.trainingId}-${training.evaluationSetId ?? "none"}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            PDF indir
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5" disabled={training.completedCount === 0 || downloadingId !== null} onClick={() => downloadExcel(training.trainingId, training.evaluationSetId, training.code, training.evaluationSetName)}>
                            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel indir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                      {hasActiveFilters ? "Filtrelere uyan rapor bulunamadı." : "Henüz raporlanacak değerlendirme bulunmuyor."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!query.isLoading && filteredRows.length === 0 && !hasActiveFilters && (
            <div className="p-12 text-center">
              <FileBarChart className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Raporlanacak eğitim bulunmuyor.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AppShell>
  );
}
