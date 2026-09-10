import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ClipboardCheck, GraduationCap, TrendingUp, XCircle } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";

const metricStyle = ["bg-[#e8f5f4] text-teal-700", "bg-[#eaf1f8] text-[#0b385d]", "bg-[#ecf8f0] text-emerald-700", "bg-[#fff6df] text-amber-700", "bg-[#fff0f1] text-rose-700", "bg-[#eef2ff] text-indigo-700"];
const metricIcon = [GraduationCap, ClipboardCheck, CheckCircle2, AlertTriangle, CheckCircle2, XCircle];

type CriterionChartPoint = {
  name: string;
  value: number;
  text: string;
  description: string | null;
};

function CriteriaTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: CriterionChartPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return <div className="max-w-xs rounded-xl border border-teal-100 bg-white px-4 py-3 shadow-lg">
    <p className="text-xs font-semibold text-teal-700">{point.name} · Ortalama puan: {point.value.toFixed(2)}</p>
    <p className="mt-1 text-sm font-semibold leading-5 text-[#0b385d]">{point.text}</p>
    {point.description && <p className="mt-1 text-xs leading-5 text-slate-600">{point.description}</p>}
  </div>;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<"ALL" | "30_DAYS" | "90_DAYS" | "YEAR">("ALL");
  const query = trpc.admin.dashboard.useQuery({ period });
  const cards = query.data?.cards;
  const criteriaChart = (query.data?.charts.criteria ?? []) as CriterionChartPoint[];
  const metrics = cards ? [["Toplam eğitim", cards.totalTrainings], ["Aktif değerlendirme", cards.activeAssignments], ["Tamamlanan", cards.completedEvaluations], ["Bekleyen", cards.pendingEvaluations], ["Başarılı eğitim", cards.successfulTrainings], ["Başarısız eğitim", cards.unsuccessfulTrainings]] : [];

  return <AppShell role="ADMIN">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-teal-700">Yönetim göstergesi</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">Eğitim değerlendirme özeti</h1><p className="mt-2 text-sm text-slate-500">Seçilen zaman aralığındaki tamamlanan değerlendirmelerin görünümü.</p></div>
      <div className="flex items-end gap-3"><label className="grid gap-1 text-right text-xs font-medium text-slate-500">Zaman aralığı<select value={period} onChange={event => setPeriod(event.target.value as typeof period)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500"><option value="ALL">Tüm zamanlar</option><option value="30_DAYS">Son 30 gün</option><option value="90_DAYS">Son 90 gün</option><option value="YEAR">Son 1 yıl</option></select></label><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-xs text-slate-500">Genel tamamlanma oranı</p><p className="text-xl font-semibold text-[#0b385d]">{(cards?.completionRate ?? 0).toFixed(2)}%</p></div></div>
    </div>
    {query.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value], index) => { const Icon = metricIcon[index]; return <Card key={label} className="border-slate-200 shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold text-[#0b385d]">{value}</p></div><div className={`grid h-12 w-12 place-items-center rounded-2xl ${metricStyle[index]}`}><Icon className="h-5 w-5" /></div></CardContent></Card>; })}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><div className="mb-5"><p className="font-semibold text-[#0b385d]">Kriter bazında genel puan ortalaması</p><p className="mt-1 text-sm text-slate-500">Sütunların üzerine gelerek kriter metnini görüntüleyin. Yalnızca tamamlanan değerlendirmeler üzerinden hesaplanır.</p></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={criteriaChart}><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis domain={[0, 5]} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "rgba(20, 166, 160, 0.08)" }} content={<CriteriaTooltip />} /><Bar dataKey="value" radius={[7, 7, 0, 0]} fill="#14a6a0" /></BarChart></ResponsiveContainer></div>
          <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-[#0b385d]">Kriter açıklamaları</p><ol className="mt-3 grid gap-3 sm:grid-cols-2">{criteriaChart.map(point => <li key={point.name} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700"><span className="font-semibold text-teal-700">{point.name}:</span> <span className="font-medium text-[#0b385d]">{point.text}</span>{point.description && <span className="mt-0.5 block text-xs text-slate-500">{point.description}</span>}</li>)}</ol></div>
        </CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="font-semibold text-[#0b385d]">Başarı dağılımı</p><p className="mt-1 text-sm text-slate-500">Eğitim sonuçlarının durumu</p><div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={query.data?.charts.success} dataKey="value" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={4}>{(query.data?.charts.success ?? []).map((_, index) => <Cell key={index} fill={index === 0 ? "#16a370" : "#e35968"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex justify-center gap-4 text-xs"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Başarılı</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Başarısız</span></div></CardContent></Card>
      </div>
      <Card className="mt-6 border-slate-200 shadow-sm"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><TrendingUp className="h-5 w-5" /></div><div><p className="font-semibold text-[#0b385d]">Değerlendirici tamamlanma oranları</p><p className="text-sm text-slate-500">Atama sayısına göre tamamlanan değerlendirmeler</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-3">{(query.data?.charts.evaluators ?? []).map(item => <div key={item.name} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><span className="font-medium text-slate-700">{item.name}</span><span className="font-semibold text-teal-700">{item.completionRate.toFixed(0)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-500" style={{ width: `${item.completionRate}%` }} /></div></div>)}</div></CardContent></Card>
    </>}
  </AppShell>;
}
