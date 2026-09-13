import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, GraduationCap, TrendingUp, XCircle } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { useLocation } from "wouter";

const metricStyle = ["bg-[#e8f5f4] text-teal-700", "bg-[#eaf1f8] text-[#0b385d]", "bg-[#ecf8f0] text-emerald-700", "bg-[#fff6df] text-amber-700", "bg-[#fff0f1] text-rose-700", "bg-[#eef2ff] text-indigo-700"];
const metricIcon = [GraduationCap, ClipboardCheck, CheckCircle2, AlertTriangle, CheckCircle2, XCircle];

type CriterionChartPoint = {
  name: string;
  value: number;
  text: string;
  description: string | null;
};

type SuccessChartPoint = {
  name: string;
  value: number;
};

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

function CriterionBarLabel({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) {
  if (x === undefined || y === undefined || width === undefined || value === undefined) return null;
  return <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#0b385d" fontSize={12} fontWeight={700}>{formatPercentage(value)}</text>;
}

function SuccessPieLabel({ cx, cy, midAngle, outerRadius, percent }: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number; percent?: number }) {
  if (cx === undefined || cy === undefined || midAngle === undefined || outerRadius === undefined || percent === undefined) return null;
  const radians = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * radians);
  const y = cy + radius * Math.sin(-midAngle * radians);
  return <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fill="#0b385d" fontSize={12} fontWeight={700}>{formatPercentage(percent * 100)}</text>;
}

function CriteriaTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: CriterionChartPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return <div className="max-w-xs rounded-xl border border-teal-100 bg-white px-4 py-3 shadow-lg">
    <p className="text-xs font-semibold text-teal-700">{point.name} · Başarı: {formatPercentage((point.value / 5) * 100)}</p>
    <p className="mt-1 text-sm font-semibold leading-5 text-[#0b385d]">{point.text}</p>
    {point.description && <p className="mt-1 text-xs leading-5 text-slate-600">{point.description}</p>}
  </div>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<"ALL" | "30_DAYS" | "90_DAYS" | "YEAR">("ALL");
  const [selectedSetId, setSelectedSetId] = useState<number | "">("");
  const [selectedTrainingType, setSelectedTrainingType] = useState<"Ürün" | "Üretim" | "Destek" | "">("");
  const evaluationSets = trpc.admin.evaluationSets.list.useQuery();
  const appRole = user?.role === "TRAINING_MANAGER" ? "TRAINING_MANAGER" : "ADMIN";
  const query = trpc.admin.dashboard.useQuery({
    period,
    evaluationSetId: selectedSetId === "" ? null : Number(selectedSetId),
    trainingType: selectedTrainingType || null,
  });
  const cards = query.data?.cards;
  const criteriaChart = (query.data?.charts.criteria ?? []) as CriterionChartPoint[];
  const criteriaPercentageChart = criteriaChart.map(point => ({ ...point, percentage: (point.value / 5) * 100 }));
  const successChart = (query.data?.charts.success ?? []) as SuccessChartPoint[];
  const successTotal = successChart.reduce((total, point) => total + point.value, 0);
  const successPercentageChart = successChart.map(point => ({ ...point, percentage: successTotal ? (point.value / successTotal) * 100 : 0 }));
  const metrics = cards ? [["Toplam eğitim", cards.totalTrainings], ["Aktif değerlendirme", cards.activeAssignments], ["Tamamlanan", cards.completedEvaluations], ["Bekleyen", cards.pendingEvaluations], ["Başarılı eğitim", cards.successfulTrainings], ["Başarısız eğitim", cards.unsuccessfulTrainings]] : [];

  return <AppShell role={appRole}>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-teal-700">Yönetim göstergesi</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">Eğitim değerlendirme özeti</h1><p className="mt-2 text-sm text-slate-500">Seçilen zaman aralığındaki tamamlanan değerlendirmelerin görünümü.</p></div>
      <div className="flex items-end gap-3"><label className="grid gap-1 text-right text-xs font-medium text-slate-500">Zaman aralığı<select value={period} onChange={event => setPeriod(event.target.value as typeof period)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500"><option value="ALL">Tüm zamanlar</option><option value="30_DAYS">Son 30 gün</option><option value="90_DAYS">Son 90 gün</option><option value="YEAR">Son 1 yıl</option></select></label><label className="grid gap-1 text-right text-xs font-medium text-slate-500">Değerlendirme seti<select value={selectedSetId} onChange={event => setSelectedSetId(event.target.value === "" ? "" : Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500"><option value="">Tüm setler</option>{evaluationSets.data?.filter(set => set.isActive).map(set => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label><label className="grid gap-1 text-right text-xs font-medium text-slate-500">Eğitim müdürlüğü<select value={selectedTrainingType} onChange={event => setSelectedTrainingType(event.target.value as typeof selectedTrainingType)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500"><option value="">Tümü</option><option value="Ürün">Ürün</option><option value="Üretim">Üretim</option><option value="Destek">Destek</option></select></label><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-xs text-slate-500">Genel tamamlanma oranı</p><p className="text-xl font-semibold text-[#0b385d]">{(cards?.completionRate ?? 0).toFixed(2)}%</p></div></div>
    </div>
    {query.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div> : query.isError ? <Card className="border-rose-200 bg-rose-50 shadow-sm"><CardContent className="p-6"><p className="font-semibold text-rose-800">Dashboard verileri yüklenemedi.</p><p className="mt-2 text-sm text-rose-700">{query.error.message}</p></CardContent></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value], index) => { const Icon = metricIcon[index]; return <Card key={label} className="border-slate-200 shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold text-[#0b385d]">{value}</p></div><div className={`grid h-12 w-12 place-items-center rounded-2xl ${metricStyle[index]}`}><Icon className="h-5 w-5" /></div></CardContent></Card>; })}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><div className="mb-5"><p className="font-semibold text-[#0b385d]">Kriter bazında başarı yüzdesi</p><p className="mt-1 text-sm text-slate-500">Yalnızca tamamlanan değerlendirmeler üzerinden hesaplanır.</p></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={criteriaPercentageChart} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "rgba(20, 166, 160, 0.08)" }} content={<CriteriaTooltip />} /><Bar dataKey="percentage" radius={[7, 7, 0, 0]} fill="#14a6a0"><LabelList dataKey="percentage" content={<CriterionBarLabel />} /></Bar></BarChart></ResponsiveContainer></div>
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-100"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-semibold">Kriter</th><th className="px-3 py-2 text-right font-semibold">Ortalama</th><th className="px-3 py-2 text-right font-semibold">Yüzde</th></tr></thead><tbody>{criteriaPercentageChart.map(point => <tr key={point.name} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-[#0b385d]">{point.name}</td><td className="px-3 py-2 text-right text-slate-600">{point.value.toFixed(2)} / 5</td><td className="px-3 py-2 text-right font-semibold text-teal-700">{formatPercentage(point.percentage)}</td></tr>)}</tbody></table></div>
          <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-[#0b385d]">Kriter açıklamaları</p><ol className="mt-3 grid gap-3 sm:grid-cols-2">{criteriaChart.map(point => <li key={point.name} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700"><span className="font-semibold text-teal-700">{point.name}:</span> <span className="font-medium text-[#0b385d]">{point.text}</span>{point.description && <span className="mt-0.5 block text-xs text-slate-500">{point.description}</span>}</li>)}</ol></div>
        </CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="font-semibold text-[#0b385d]">Başarı dağılımı</p><p className="mt-1 text-sm text-slate-500">Eğitim sonuçlarının durumu</p><div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={successPercentageChart} dataKey="value" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={4} labelLine={false} label={<SuccessPieLabel />}>{successPercentageChart.map((_, index) => <Cell key={index} fill={index === 0 ? "#16a370" : "#e35968"} />)}</Pie><Tooltip formatter={(value: number, _name, item) => [formatPercentage(item.payload.percentage), item.payload.name]} /></PieChart></ResponsiveContainer></div><div className="overflow-hidden rounded-lg border border-slate-100"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-semibold">Sonuç</th><th className="px-3 py-2 text-right font-semibold">Adet</th><th className="px-3 py-2 text-right font-semibold">Yüzde</th></tr></thead><tbody>{successPercentageChart.map((point, index) => <tr key={point.name} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-[#0b385d]"><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${index === 0 ? "bg-emerald-600" : "bg-rose-500"}`} />{point.name}</td><td className="px-3 py-2 text-right text-slate-600">{point.value}</td><td className="px-3 py-2 text-right font-semibold text-teal-700">{formatPercentage(point.percentage)}</td></tr>)}</tbody></table></div></CardContent></Card>
      </div>
      <Card className="mt-6 border-slate-200 shadow-sm"><CardContent className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><TrendingUp className="h-5 w-5" /></div><div><p className="font-semibold text-[#0b385d]">Değerlendirici tamamlanma oranları</p><p className="text-sm text-slate-500">Atama sayısına göre tamamlanan değerlendirmeler</p></div></div><Button type="button" variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-teal-700 gap-2 shadow-sm font-medium" onClick={() => setLocation("/admin/reports/detailed")}><FileText className="h-4 w-4 text-teal-600" />Detaylı Rapor</Button></div><div className="mt-5 grid gap-4 md:grid-cols-3">{(query.data?.charts.evaluators ?? []).map(item => <div key={item.name} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><span className="font-medium text-slate-700">{item.name}</span><span className="font-semibold text-teal-700">{item.completedCount}/{item.assignedCount} · {item.completionRate.toFixed(0)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-500" style={{ width: `${item.completionRate}%` }} /></div></div>)}</div></CardContent></Card>
    </>}
  </AppShell>;
}
