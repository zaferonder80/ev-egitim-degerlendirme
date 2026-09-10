import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell, StatusBadge, formatDate } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Clock3, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function Profile({ role }: { role: "ADMIN" | "EVALUATOR" }) {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Şifreniz güncellendi.");
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("Yeni şifre ve tekrarı aynı olmalıdır.");
    changePassword.mutate({ currentPassword, newPassword });
  };

  if (!user) return null;
  const details = [
    { label: "Ad", value: user.firstName, icon: UserRound },
    { label: "Soyad", value: user.lastName, icon: UserRound },
    { label: "E-posta adresi", value: user.email, icon: Mail },
    { label: "Rol", value: user.role === "ADMIN" ? "Yönetici" : "Değerlendirici", icon: ShieldCheck },
    { label: "Son giriş", value: formatDate(user.lastLoginAt), icon: Clock3 },
  ];

  return <AppShell role={role}><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-teal-700">Hesap yönetimi</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">Kullanıcı bilgilerim</h1><p className="mt-2 text-sm text-slate-500">Hesap bilgileriniz yalnızca görüntülenebilir. Güncelleme yetkisi sistem yöneticisindedir.</p></div><StatusBadge status={user.isActive ? "ACTIVE" : "ARCHIVED"} /></div><div className="mt-7 grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><div className="flex items-center gap-4 border-b border-slate-100 pb-5"><div className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-lg font-semibold text-[#0b385d]">{user.firstName?.[0]}{user.lastName?.[0]}</div><div><h2 className="text-lg font-semibold text-[#0b385d]">{user.firstName} {user.lastName}</h2><p className="mt-1 text-sm text-slate-500">{user.role === "ADMIN" ? "Yönetici" : "Değerlendirici"} hesabı</p></div></div><dl className="mt-5 divide-y divide-slate-100">{details.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 py-4"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon className="h-4 w-4" /></div><div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-all text-sm font-medium text-slate-800">{value || "—"}</dd></div></div>)}</dl><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><div className="flex gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><p>Ad, soyad, e-posta ve rol bilgileriniz bu ekranda değiştirilemez. Bilgi güncelleme talebiniz için yöneticinizle iletişime geçin.</p></div></div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#0b385d]">Şifre değiştir</h2><p className="mt-1 text-sm text-slate-500">Mevcut şifrenizi doğrulayarak yeni şifrenizi belirleyin.</p></div></div><form onSubmit={submit} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="current-password">Mevcut şifre</Label><Input id="current-password" type="password" required autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="new-password">Yeni şifre</Label><Input id="new-password" type="password" required autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><p className="text-xs text-slate-500">En az 12 karakter; büyük/küçük harf, rakam ve özel karakter içermelidir.</p></div><div className="space-y-2"><Label htmlFor="confirm-password">Yeni şifre tekrar</Label><Input id="confirm-password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div><Button type="submit" disabled={changePassword.isPending} className="mt-2 w-full bg-[#0b385d] hover:bg-[#082d4c]">{changePassword.isPending ? "Şifre güncelleniyor…" : "Şifreyi güncelle"}</Button></form></CardContent></Card></div></AppShell>;
}
