import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, BookOpenCheck, ClipboardCheck, FileBarChart, LayoutDashboard, ListChecks, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const adminNavigation = [
  { label: "Genel Bakış", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Eğitimler", path: "/admin/trainings", icon: BookOpenCheck },
  { label: "Kriter Yönetimi", path: "/admin/criteria", icon: ListChecks },
  { label: "Değerlendirme Setleri", path: "/admin/evaluation-sets", icon: ClipboardCheck },
  { label: "Kullanıcılar", path: "/admin/users", icon: Users },
  { label: "Raporlar", path: "/admin/reports", icon: FileBarChart },
  { label: "Denetim Kayıtları", path: "/admin/audit-logs", icon: ShieldCheck },
];

const evaluatorNavigation = [
  { label: "Genel Bakış", path: "/evaluator/dashboard", icon: LayoutDashboard },
  { label: "Atamalarım", path: "/evaluator/assignments", icon: ClipboardCheck },
];

export function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

export function StatusBadge({ status }: { status?: string | null }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Aktif", className: "bg-teal-50 text-teal-700 border-teal-200" },
    DRAFT: { label: "Taslak", className: "bg-slate-100 text-slate-700 border-slate-200" },
    ARCHIVED: { label: "Arşiv", className: "bg-amber-50 text-amber-700 border-amber-200" },
    PENDING: { label: "Bekliyor", className: "bg-amber-50 text-amber-700 border-amber-200" },
    COMPLETED: { label: "Tamamlandı", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    OVERDUE: { label: "Süresi Geçti", className: "bg-rose-50 text-rose-700 border-rose-200" },
    REOPENED: { label: "Yeniden Açıldı", className: "bg-sky-50 text-sky-700 border-sky-200" },
    SUCCESSFUL: { label: "Başarılı", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    UNSUCCESSFUL: { label: "Başarısız", className: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const style = statusMap[status ?? ""] ?? { label: "Değerlendirilmedi", className: "bg-slate-100 text-slate-700 border-slate-200" };
  return <Badge variant="outline" className={cn("font-medium border", style.className)}>{style.label}</Badge>;
}

export function AppShell({ children, role }: { children: React.ReactNode; role: "ADMIN" | "EVALUATOR" }) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notifications = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(user) });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => notifications.refetch() });
  const unreadCount = useMemo(() => notifications.data?.filter(item => !item.isRead).length ?? 0, [notifications.data]);
  const items = role === "ADMIN" ? adminNavigation : evaluatorNavigation;

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
    if (user?.mustChangePassword && location !== "/change-password") setLocation("/change-password");
    if (user && user.role !== role && !user.mustChangePassword) setLocation(user.role === "ADMIN" ? "/admin/dashboard" : "/evaluator/dashboard");
  }, [loading, location, role, setLocation, user]);

  if (loading || !user || user.role !== role || user.mustChangePassword) return <div className="min-h-screen grid place-items-center bg-slate-50"><div className="h-9 w-9 rounded-full border-4 border-teal-100 border-t-teal-600 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#f5f8fb] text-slate-900">
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-[278px] bg-[#092a47] text-slate-100 transition-transform lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 px-6 h-[76px] border-b border-white/10">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-400 text-[#082743] shadow-lg shadow-teal-950/20"><ClipboardCheck className="h-5 w-5" /></div>
          <div className="min-w-0"><p className="text-[10px] tracking-[0.18em] uppercase text-teal-200">E/V Sistemi</p><h1 className="font-semibold text-sm leading-tight">Eğitim Değerlendirme</h1></div>
          <button aria-label="Menüyü kapat" className="ml-auto lg:hidden text-slate-300" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="px-3 py-6 space-y-1" aria-label="Ana menü">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-400">Yönetim</p>
          {items.map(item => { const active = location === item.path || (item.path !== "/admin/dashboard" && item.path !== "/evaluator/dashboard" && location.startsWith(item.path)); const Icon = item.icon; return <button key={item.path} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={cn("group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors", active ? "bg-white/12 text-white shadow-inner" : "text-slate-300 hover:bg-white/7 hover:text-white")}><Icon className={cn("h-4 w-4", active ? "text-teal-300" : "text-slate-400 group-hover:text-teal-200")} /><span>{item.label}</span></button>; })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <button onClick={() => setLocation(role === "ADMIN" ? "/admin/profile" : "/evaluator/profile")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/7"><div className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-[#0b385d]">{user.firstName?.[0]}{user.lastName?.[0]}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.firstName} {user.lastName}</p><p className="truncate text-xs text-slate-400">{role === "ADMIN" ? "Yönetici" : "Değerlendirici"}</p></div></button>
          <button onClick={() => logout()} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-white/7 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Güvenli çıkış</button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
      <main className="min-h-screen lg:pl-[278px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3"><button aria-label="Menüyü aç" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button><div><p className="text-xs text-slate-500">{role === "ADMIN" ? "Yönetim merkezi" : "Değerlendirme çalışma alanı"}</p><p className="text-sm font-semibold text-[#0b385d]">Hoş geldiniz, {user.firstName}</p></div></div>
          <div className="relative flex items-center gap-3"><button onClick={() => setNotificationOpen(value => !value)} aria-label="Bildirimler" className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unreadCount}</span>}</button>{notificationOpen && <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="border-b border-slate-100 px-4 py-3"><p className="font-semibold text-[#0b385d]">Bildirimler</p></div><div className="max-h-[420px] overflow-auto">{notifications.data?.length ? notifications.data.map(item => <button key={item.id} onClick={() => { if (!item.isRead) markRead.mutate({ id: item.id }); if (item.link) setLocation(item.link); setNotificationOpen(false); }} className={cn("block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50", !item.isRead && "bg-teal-50/45")}><div className="flex gap-2"><span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-teal-500")} /><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.message}</p></div></div></button>) : <p className="p-6 text-center text-sm text-slate-500">Yeni bildirim bulunmuyor.</p>}</div></div>}<Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => setLocation(role === "ADMIN" ? "/admin/profile" : "/evaluator/profile")}><Settings className="h-3.5 w-3.5" /> Profil</Button></div>
        </header>
        <div className="mx-auto max-w-[1600px] p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
