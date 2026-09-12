import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function getSessionHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("ev-preview-session");
  return token ? { "X-EV-Session": token } : {};
}

export default function PdfPreview() {
  const { user } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = new URLSearchParams(window.location.search);
  const trainingId = Number(params.get("trainingId"));
  const evaluationSetId = Number(params.get("evaluationSetId"));
  const fileName = params.get("fileName") || "degerlendirme-raporu.pdf";
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const closePreview = () => {
    if (window.opener) {
      window.close();
      return;
    }
    window.location.assign("/admin/trainings");
  };
  const downloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await fetch(`/api/reports/training/${trainingId}.xlsx?evaluationSetId=${evaluationSetId}`, {
        credentials: "include",
        headers: getSessionHeaders(),
      });
      if (!response.ok) throw new Error("XLS raporu oluşturulamadı.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("XLS raporu boş döndü.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName.replace(/\.pdf$/i, ".xlsx");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("XLS raporu indirildi.");
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "XLS indirme başarısız oldu.");
    } finally {
      setDownloadingExcel(false);
    }
  };

  useEffect(() => {
    if (!Number.isInteger(trainingId) || trainingId <= 0 || !Number.isInteger(evaluationSetId) || evaluationSetId <= 0) {
      setError("Geçersiz rapor bilgisi.");
      return;
    }

    let objectUrl: string | null = null;
    const load = async () => {
      try {
        const response = await fetch(`/api/reports/training/${trainingId}.pdf?evaluationSetId=${evaluationSetId}`, {
          credentials: "include",
          headers: getSessionHeaders(),
        });
        if (!response.ok) throw new Error("PDF raporu oluşturulamadı.");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "PDF raporu yüklenemedi.");
        toast.error("PDF raporu yüklenemedi.");
      }
    };
    void load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evaluationSetId, trainingId]);

  return (
    <AppShell role={appRole}>
      <div className="flex min-h-[calc(100vh-140px)] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-medium text-teal-700">Rapor önizleme</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0b385d]">PDF değerlendirme raporu</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="gap-2" onClick={closePreview}><ArrowLeft className="h-4 w-4" /> Kapat</Button>
            <Button variant="outline" className="gap-2" onClick={() => void downloadExcel()} disabled={downloadingExcel}>
              {downloadingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} XLS indir
            </Button>
            {pdfUrl && <Button asChild className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"><a href={pdfUrl} download={fileName}><Download className="h-4 w-4" /> PDF indir</a></Button>}
          </div>
        </div>
        <div className="mt-4 flex min-h-[680px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {pdfUrl ? <iframe title="PDF raporu" src={pdfUrl} className="h-full min-h-[680px] w-full border-0 bg-white" /> : error ? <p className="text-sm text-rose-700">{error}</p> : <Loader2 className="h-8 w-8 animate-spin text-teal-600" />}
        </div>
      </div>
    </AppShell>
  );
}
