import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ChangePassword() {
  const { user, refresh } = useAuth(); const [, setLocation] = useLocation();
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const change = trpc.auth.changePassword.useMutation({ onSuccess: async () => { await refresh(); toast.success("Şifreniz güncellendi."); setLocation(user?.role === "ADMIN" ? "/admin/dashboard" : "/evaluator/dashboard"); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); if (newPassword !== confirm) return toast.error("Yeni şifre ve tekrarı aynı olmalıdır."); change.mutate({ currentPassword, newPassword }); };
  return <div className="min-h-screen grid place-items-center bg-[#f5f8fb] p-4"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100 text-[#0b385d]"><KeyRound /></div><h1 className="mt-6 text-2xl font-semibold text-[#0b385d]">Şifrenizi yenileyin</h1><p className="mt-2 text-sm leading-6 text-slate-500">İlk girişinizden önce güçlü bir kişisel şifre belirlemeniz gerekmektedir.</p><div className="mt-7 space-y-4"><div className="space-y-2"><Label>Mevcut şifre</Label><Input type="password" required autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div><div className="space-y-2"><Label>Yeni şifre</Label><Input type="password" required autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><p className="text-xs text-slate-500">En az 12 karakter; büyük/küçük harf, rakam ve özel karakter içermelidir.</p></div><div className="space-y-2"><Label>Yeni şifre tekrar</Label><Input type="password" required autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></div></div><Button className="mt-7 w-full bg-[#0b385d] hover:bg-[#082d4c]" disabled={change.isPending}>{change.isPending ? "Kaydediliyor…" : "Şifreyi güncelle ve devam et"}</Button><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-teal-600" /> Yeni şifreniz bcrypt ile hashlenerek korunur.</div></form></div>;
}
