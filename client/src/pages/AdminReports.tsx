import { AppShell, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatScoreValue } from "@shared/score";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function getSessionHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("ev-preview-session");
  return token ? { "X-EV-Session": token } : {};
}

export default function AdminReports() {
  const query = trpc.admin.trainings.list.useQuery();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const downloadPdf = async (trainingId: number, code: string) => {
    setDownloadingId(trainingId);
    try {
      const response = await fetch(`/api/reports/training/${trainingId}.pdf`, { credentials: "include", headers: getSessionHeaders() });
      if (!response.ok) {
        let message = "PDF raporu oluşturulamadı.";
        try { const body = await response.json() as { error?: string }; if (body.error === "forbidden") message = "Raporu indirmek için yönetici yetkisi gerekir."; } catch { /* JSON olmayan hata yanıtı */ }
        throw new Error(message);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("PDF raporu boş döndü.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `degerlendirme-raporu-${code}.pdf`;
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

  return <AppShell role="ADMIN"><div><p className="text-sm font-medium text-teal-700">Kurumsal raporlama</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">Değerlendirme raporları</h1><p className="mt-2 text-sm text-slate-500">Tamamlanan değerlendirmeleri Türkçe karakter destekli, sayfalı PDF raporlar olarak indirin.</p></div><Card className="mt-7 border-slate-200 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-4">Eğitim</th><th className="px-4 py-4">Atama</th><th className="px-4 py-4">Ortalama puan</th><th className="px-4 py-4">Sonuç</th><th className="px-6 py-4 text-right">Rapor</th></tr></thead><tbody className="divide-y divide-slate-100">{query.isLoading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Raporlar yükleniyor…</td></tr> : query.data?.map(training => <tr key={training.id}><td className="px-6 py-4"><p className="font-semibold text-[#0b385d]">{training.title}</p><p className="text-xs text-slate-500">{training.code} · Sürüm {training.version}</p></td><td className="px-4 py-4 text-slate-600">{training.completedCount} / {training.assignedCount}</td><td className="px-4 py-4 font-semibold text-slate-700">{training.averageTotal === null ? "—" : formatScoreValue(training.averageTotal, 2)}</td><td className="px-4 py-4"><StatusBadge status={training.successStatus} /></td><td className="px-6 py-4 text-right"><Button size="sm" variant="outline" className="gap-1.5" disabled={training.completedCount === 0 || downloadingId !== null} onClick={() => downloadPdf(training.id, training.code)}>{downloadingId === training.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {downloadingId === training.id ? "Hazırlanıyor…" : "PDF indir"}</Button></td></tr>)}</tbody></table></div>{!query.isLoading && !query.data?.length && <div className="p-12 text-center"><FileBarChart className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Raporlanacak eğitim bulunmuyor.</p></div>}</CardContent></Card></AppShell>;
}
