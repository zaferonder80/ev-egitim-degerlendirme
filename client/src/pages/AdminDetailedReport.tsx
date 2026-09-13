import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell, StatusBadge, formatDate } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Download, FileBarChart, FileSpreadsheet, Filter, GraduationCap, Loader2, MessageSquare, RotateCcw, Search, UserCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function getSessionHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("ev-preview-session");
  return token ? { "X-EV-Session": token } : {};
}

export default function AdminDetailedReport() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const query = trpc.admin.reports.detailedList.useQuery();

  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("all");
  const [trainingFilter, setTrainingFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [assignerFilter, setAssignerFilter] = useState("all");
  const [evaluatorFilter, setEvaluatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [selectedComment, setSelectedComment] = useState<{ title: string; evaluator: string; comment: string } | null>(null);

  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const rows = query.data ?? [];

  // Dropdown options extracted dynamically from data
  const trainingTypeOptions = useMemo(() => Array.from(new Set(rows.map(r => r.trainingType))).filter(Boolean).sort((a, b) => (a || "").localeCompare(b || "", "tr")), [rows]);
  const trainingOptions = useMemo(() => Array.from(new Map(rows.map(r => [r.trainingId, r.trainingTitle])).entries()).sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "tr")), [rows]);
  const setOptions = useMemo(() => Array.from(new Map(rows.map(r => [String(r.evaluationSetId ?? "none"), r.evaluationSetName])).entries()).sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "tr")), [rows]);
  const assignerOptions = useMemo(() => Array.from(new Map(rows.map(r => [r.assignedById, r.assignedByName])).entries()).sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "tr")), [rows]);
  const evaluatorOptions = useMemo(() => Array.from(new Map(rows.map(r => [r.evaluatorId, r.evaluatorName])).entries()).sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "tr")), [rows]);

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const textToSearch = `${row.trainingTitle} ${row.trainingCode} ${row.evaluatorName} ${row.assignedByName} ${row.evaluationSetName} ${row.generalComment ?? ""}`.toLocaleLowerCase("tr-TR");
      const matchesSearch = !normalizedSearch || textToSearch.includes(normalizedSearch);
      const matchesTrainingType = trainingTypeFilter === "all" || row.trainingType === trainingTypeFilter;
      const matchesTraining = trainingFilter === "all" || String(row.trainingId) === trainingFilter;
      const matchesSet = setFilter === "all" || String(row.evaluationSetId ?? "none") === setFilter;
      const matchesAssigner = assignerFilter === "all" || String(row.assignedById) === assignerFilter;
      const matchesEvaluator = evaluatorFilter === "all" || String(row.evaluatorId) === evaluatorFilter;
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesResult = resultFilter === "all"
        || (resultFilter === "SUCCESSFUL" && row.successStatus === "SUCCESSFUL")
        || (resultFilter === "UNSUCCESSFUL" && row.successStatus === "UNSUCCESSFUL")
        || (resultFilter === "PENDING" && !row.successStatus);
      const matchesActive = activeFilter === "all"
        || (activeFilter === "ACTIVE" && row.evaluatorIsActive)
        || (activeFilter === "PASSIVE" && !row.evaluatorIsActive);

      return matchesSearch && matchesTrainingType && matchesTraining && matchesSet && matchesAssigner && matchesEvaluator && matchesStatus && matchesResult && matchesActive;
    });
  }, [rows, normalizedSearch, trainingTypeFilter, trainingFilter, setFilter, assignerFilter, evaluatorFilter, statusFilter, resultFilter, activeFilter]);

  const hasActiveFilters = Boolean(
    searchTerm || trainingTypeFilter !== "all" || trainingFilter !== "all" || setFilter !== "all" || assignerFilter !== "all" || evaluatorFilter !== "all" || statusFilter !== "all" || resultFilter !== "all" || activeFilter !== "all"
  );

  const resetFilters = () => {
    setSearchTerm("");
    setTrainingTypeFilter("all");
    setTrainingFilter("all");
    setSetFilter("all");
    setAssignerFilter("all");
    setEvaluatorFilter("all");
    setStatusFilter("all");
    setResultFilter("all");
    setActiveFilter("all");
  };

  // KPIs
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const completed = filteredRows.filter(r => r.status === "COMPLETED");
    const completedCount = completed.length;
    const completionRate = total ? (completedCount / total) * 100 : 0;

    const successful = completed.filter(r => r.successStatus === "SUCCESSFUL");
    const successfulCount = successful.length;

    const percentages = completed.map(r => r.successPercentage).filter((percentage): percentage is number => typeof percentage === "number");
    const avgPercentage = percentages.length ? percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length : null;

    return { total, completedCount, completionRate, successfulCount, avgPercentage };
  }, [filteredRows]);

  const downloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (trainingTypeFilter !== "all") params.set("trainingType", trainingTypeFilter);
      if (trainingFilter !== "all") params.set("trainingId", trainingFilter);
      if (setFilter !== "all") params.set("evaluationSetId", setFilter);
      if (assignerFilter !== "all") params.set("assignedById", assignerFilter);
      if (evaluatorFilter !== "all") params.set("evaluatorId", evaluatorFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (resultFilter !== "all") params.set("successStatus", resultFilter === "PENDING" ? "none" : resultFilter);
      if (activeFilter !== "all") params.set("isActive", activeFilter === "ACTIVE" ? "active" : "passive");

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/reports/detailed.xlsx${queryString}`, {
        credentials: "include",
        headers: getSessionHeaders(),
      });

      if (!response.ok) {
        throw new Error("Excel raporu oluşturulamadı.");
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error("Excel raporu boş döndü.");

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `detayli-degerlendirme-raporu.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Detaylı Excel raporu başarıyla indirildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel indirme başarısız oldu.");
    } finally {
      setDownloadingExcel(false);
    }
  };

  return (
    <AppShell role={appRole}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-teal-700 hover:text-teal-800 hover:bg-teal-50 gap-1" onClick={() => setLocation("/admin/reports")}>
              <ArrowLeft className="h-4 w-4" /> Özet Raporlar
            </Button>
            <span>/</span>
            <span>Detaylı Rapor</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            Detaylı Değerlendirme Raporu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Eğitim, değerlendirme seti, atamayı yapan, değerlendirici, tamamlama durumu, puan ve yorum detayları.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-medium"
            onClick={downloadExcel}
            disabled={downloadingExcel || query.isLoading}
          >
            {downloadingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel'e Aktar
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Toplam Atama Kaydı</p>
              <p className="mt-1 text-2xl font-bold text-[#0b385d]">{stats.total}</p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sky-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Tamamlanan Atama</p>
              <p className="mt-1 text-2xl font-bold text-teal-700">
                {stats.completedCount} <span className="text-xs font-normal text-slate-500">({stats.completionRate.toFixed(1)}%)</span>
              </p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Başarılı Sonuç</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {stats.successfulCount}
              </p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Ortalama puan</p>
              <p className="mt-1 text-2xl font-bold text-[#0b385d]">
                {stats.avgPercentage != null ? `%${stats.avgPercentage.toFixed(2)}` : "—"}
              </p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
              <FileBarChart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Section */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0b385d]">
              <Filter className="h-4 w-4 text-teal-700" /> Detaylı Filtreleme
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{filteredRows.length} / {rows.length} kayıt listeleniyor</span>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={resetFilters} disabled={!hasActiveFilters}>
                <RotateCcw className="h-3.5 w-3.5" /> Filtreleri Sıfırla
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(event.target.value)}
                placeholder="Eğitim, kişi, set veya yorum ara..."
                className="pl-9 bg-white text-xs"
              />
            </div>

            <Select value={trainingTypeFilter} onValueChange={setTrainingTypeFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Eğitim Müdürlüğü" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">Tüm Müdürlükler</SelectItem>{trainingTypeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={trainingFilter} onValueChange={setTrainingFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Eğitim" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">Tüm Eğitimler</SelectItem>{trainingOptions.map(([id, title]) => <SelectItem key={id} value={String(id)}>{title}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={setFilter} onValueChange={setSetFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Değerlendirme Seti" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">Tüm Setler</SelectItem>{setOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={assignerFilter} onValueChange={setAssignerFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Atamayı Yapan" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">Tüm Atayanlar</SelectItem>{assignerOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={evaluatorFilter} onValueChange={setEvaluatorFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Atama Yapılan (Değerlendirici)" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">Tüm Değerlendiriciler</SelectItem>{evaluatorOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Tamamlama Durumu" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                <SelectItem value="PENDING">Bekliyor</SelectItem>
                <SelectItem value="DRAFT">Taslak</SelectItem>
                <SelectItem value="OVERDUE">Süresi Geçti</SelectItem>
                <SelectItem value="REOPENED">Yeniden Açıldı</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Değerlendirme Sonucu" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Tüm Sonuçlar</SelectItem>
                <SelectItem value="SUCCESSFUL">Başarılı</SelectItem>
                <SelectItem value="UNSUCCESSFUL">Başarısız</SelectItem>
                <SelectItem value="PENDING">Henüz Sonuç Yok</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Aktiflik Durumu" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Tüm Aktiflik Durumları</SelectItem>
                <SelectItem value="ACTIVE">Aktif Değerlendiriciler</SelectItem>
                <SelectItem value="PASSIVE">Pasif Değerlendiriciler</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-xs">
                <thead className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Eğitim Adı & Kodu</th>
                    <th className="px-4 py-3.5">Değerlendirme Seti</th>
                    <th className="px-4 py-3.5">Atamayı Yapan Kişi</th>
                    <th className="px-4 py-3.5">Atama Yapılan Kişi</th>
                    <th className="px-3 py-3.5 text-center">Aktiflik</th>
                    <th className="px-3 py-3.5 text-center">Tamamlama Durumu</th>
                    <th className="px-3 py-3.5 text-right">Puan</th>
                    <th className="px-3 py-3.5 text-center">Sonuç</th>
                    <th className="px-4 py-3.5">Genel Yorumu</th>
                    <th className="px-4 py-3.5 text-right">Tarihler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.isLoading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        Detaylı veriler yükleniyor...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        Arama kriterlerine uygun kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => (
                      <tr key={row.assignmentId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 min-w-[220px]">
                          <p className="font-semibold text-[#0b385d]">{row.trainingTitle}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{row.trainingCode}</span>
                            <span>•</span>
                            <span className="text-teal-700 font-medium">{row.trainingType}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {row.evaluationSetName}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{row.assignedByName}</p>
                          <p className="text-[11px] text-slate-500">{row.assignedByEmail}</p>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.evaluatorName}</p>
                          <p className="text-[11px] text-slate-500">{row.evaluatorEmail}</p>
                        </td>

                        <td className="px-3 py-3 text-center">
                          {row.evaluatorIsActive ? (
                            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-medium text-[10px]">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-medium text-[10px]">
                              Pasif
                            </Badge>
                          )}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <StatusBadge status={row.status} />
                        </td>

                        <td className="px-3 py-3 text-right">
                          {row.successPercentage != null ? (
                            <div>
                              <p className="font-bold text-[#0b385d]">%{row.successPercentage.toFixed(2)}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {row.successStatus ? (
                            <StatusBadge status={row.successStatus} />
                          ) : (
                            <span className="text-slate-400 text-[11px]">Henüz Yok</span>
                          )}
                        </td>

                        <td className="px-4 py-3 max-w-[220px]">
                          {row.generalComment ? (
                            <div className="group relative">
                              <p className="line-clamp-2 text-slate-700 text-[11px] leading-relaxed">
                                {row.generalComment}
                              </p>
                              {row.generalComment.length > 50 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedComment({ title: row.trainingTitle, evaluator: row.evaluatorName, comment: row.generalComment! })}
                                  className="mt-0.5 text-[10px] font-semibold text-teal-600 hover:underline flex items-center gap-1"
                                >
                                  <MessageSquare className="h-3 w-3" /> Tüm yorumu gör
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Yorum yok</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-[11px] text-slate-600 space-y-0.5">
                          <p><span className="text-slate-400">Atama:</span> {formatDate(row.assignedAt)}</p>
                          <p><span className="text-slate-400">Son:</span> {formatDate(row.dueDate)}</p>
                          {row.completedAt && (
                            <p className="text-emerald-700 font-medium"><span className="text-slate-400">Bitiş:</span> {formatDate(row.completedAt)}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Comment Modal */}
      <Dialog open={Boolean(selectedComment)} onOpenChange={open => !open && setSelectedComment(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0b385d] text-base font-semibold">
              Değerlendirme Genel Yorumu
            </DialogTitle>
          </DialogHeader>
          {selectedComment && (
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-xs font-semibold text-teal-700">{selectedComment.title}</p>
                <p className="text-xs text-slate-500">Değerlendirici: {selectedComment.evaluator}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedComment.comment}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}