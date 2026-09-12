import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPostLoginPath } from "@/lib/authNavigation";
import { trpc } from "@/lib/trpc";
import { BookOpenCheck, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = trpc.auth.login.useMutation({ onSuccess: data => {
    if (!data) return;
    try {
      if (data.previewSessionToken) sessionStorage.setItem("ev-preview-session", data.previewSessionToken);
    } catch {
      // sessionStorage kullanılamazsa HttpOnly oturum çerezi kullanılmaya devam eder.
    }
    toast.success("Giriş başarılı.");
    // Yeni oturum belirtecinin bütün sorgular tarafından okunması için uygulamayı
    // hedef rotada taze olarak başlatır; SPA önbelleğinde eski auth.me=null değeri
    // kalırsa kullanıcının tekrar giriş ekranına dönmesini önler.
    window.location.replace(getPostLoginPath(data.user.role, data.mustChangePassword));
  }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ email, password }); };
  return <div className="min-h-screen bg-[#062642] p-4 md:p-8"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative hidden overflow-hidden bg-[#0a365a] p-12 text-white lg:flex lg:flex-col"><div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" /><div className="relative flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-400 text-[#082743]"><BookOpenCheck /></div><div><p className="text-xs font-semibold tracking-[.18em] text-teal-200">E/V SİSTEMİ</p><h1 className="font-semibold">Eğitim İçerik Değerlendirme</h1></div></div><div className="relative my-auto"><p className="mb-5 text-sm font-semibold tracking-[.16em] text-teal-200">KALİTEYİ GÖRÜNÜR KILIN</p><h2 className="max-w-md text-4xl font-semibold leading-tight">Eğitim içeriklerinizi kanıta dayalı biçimde değerlendirin.</h2><p className="mt-6 max-w-md text-base leading-7 text-slate-300">Standartlaştırılmış kriterler, izlenebilir iş akışları ve anlamlı raporlarla eğitim kalitesini kurumsal ölçekte yönetin.</p></div><div className="relative flex gap-5 border-t border-white/10 pt-6 text-xs text-slate-300"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" /> Rol bazlı erişim</span><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-teal-300" /> Güvenli oturum</span></div></section>
    <section className="flex items-center justify-center p-6 sm:p-12"><form onSubmit={submit} className="w-full max-w-sm"><div className="mb-9 lg:hidden"><div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-100 text-[#0b385d]"><BookOpenCheck /></div><h1 className="mt-4 text-xl font-semibold text-[#0b385d]">E/V Sistemi</h1></div><p className="text-sm font-medium text-teal-700">Güvenli erişim</p><h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Giriş yapın</h2><p className="mt-3 text-sm leading-6 text-slate-500">Yetkiniz doğrultusunda yönetim veya değerlendirme çalışma alanınıza erişin.</p><div className="mt-8 space-y-5"><div className="space-y-2"><Label htmlFor="email">E-posta adresi</Label><Input id="email" autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Şifre</Label><button type="button" className="text-xs font-medium text-teal-700 hover:underline" onClick={() => toast.info("Şifre sıfırlama işlemi için kurum yöneticinizle iletişime geçin.")}>Şifremi unuttum</button></div><div className="relative"><Input id="password" autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={event => setPassword(event.target.value)} className="pr-10" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Şifre görünürlüğünü değiştir" className="absolute right-3 top-2.5 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div><Button className="w-full bg-[#0b385d] hover:bg-[#082d4c]" size="lg" disabled={login.isPending}>{login.isPending ? "Giriş yapılıyor…" : "Güvenli giriş"}</Button></div><div className="mt-8 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-xs leading-5 text-teal-800"><strong>Not:</strong> İlk girişte şifreniz e-posta adresinizdeki @ işareti öncesindeki isimle aynıdır. Türkçe karakter kullanmayınız. Ör: ad.soyad</div></form></section>
  </div></div>;
}
