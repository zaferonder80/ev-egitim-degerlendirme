import { AppShell, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound, Plus, UserCog } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type EditableUser = {
  id: number;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "TRAINING_MANAGER" | "EVALUATOR";
  isActive: boolean;
};

export default function AdminUsers() {
  const utils = trpc.useUtils();
  const query = trpc.admin.users.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const update = trpc.admin.users.update.useMutation({
    onSuccess: () => {
      toast.success("Kullanıcı güncellendi.");
      utils.admin.users.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reset = trpc.admin.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(
        "Geçici şifre tanımlandı; kullanıcı ilk girişte şifre değiştirecek."
      );
      setResetId(null);
      setTemporaryPassword("");
    },
    onError: error => toast.error(error.message),
  });
  return (
    <AppShell role="ADMIN">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Erişim yönetimi</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b385d]">
            Kullanıcılar
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Kullanıcıları oluşturun, rollerini ve hesap durumlarını yönetin.
          </p>
        </div>
        <Button
          className="gap-2 bg-[#0b385d] hover:bg-[#082d4c]"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" /> Yeni kullanıcı
        </Button>
      </div>
      <Card className="mt-7 border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Kullanıcı</th>
                  <th className="px-4 py-4">Rol</th>
                  <th className="px-4 py-4">Hesap durumu</th>
                  <th className="px-4 py-4">İlk giriş durumu</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data?.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#0b385d]">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {user.role === "ADMIN" ? "Yönetici" : user.role === "TRAINING_MANAGER" ? "Eğitim Yöneticisi" : "Değerlendirici"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={user.isActive ? "ACTIVE" : "ARCHIVED"}
                      />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {user.mustChangePassword
                        ? "Şifre değişikliği bekleniyor"
                        : "Tamam"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditing({
                              id: user.id,
                              firstName: user.firstName,
                              lastName: user.lastName,
                              role: user.role,
                              isActive: user.isActive,
                            })
                          }
                        >
                          Düzenle
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setResetId(user.id)}
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Şifre sıfırla
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {showCreate && (
        <CreateUser
          onClose={() => setShowCreate(false)}
          onDone={() => {
            utils.admin.users.list.invalidate();
            setShowCreate(false);
          }}
        />
      )}
      {editing && (
        <EditUser
          user={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            utils.admin.users.list.invalidate();
            setEditing(null);
          }}
        />
      )}
      {resetId && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              reset.mutate({ id: resetId, temporaryPassword });
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <KeyRound className="h-8 w-8 text-teal-700" />
            <h2 className="mt-3 text-xl font-semibold text-[#0b385d]">
              Geçici şifre tanımla
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Kullanıcı bu şifreyle giriş yaptıktan sonra şifresini değiştirmek
              zorundadır.
            </p>
            <div className="mt-5 space-y-2">
              <Label>Geçici şifre</Label>
              <Input
                type="password"
                required
                value={temporaryPassword}
                onChange={event => setTemporaryPassword(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Şifre en az 8 karakter olmalıdır.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetId(null)}
              >
                Vazgeç
              </Button>
              <Button
                disabled={reset.isPending}
                className="bg-[#0b385d] hover:bg-[#082d4c]"
              >
                Şifreyi sıfırla
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function CreateUser({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const create = trpc.admin.users.create.useMutation({
    onSuccess: () => {
      toast.success(
        "Kullanıcı oluşturuldu. İlk girişte şifre değişikliği istenecek."
      );
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "EVALUATOR" as "ADMIN" | "TRAINING_MANAGER" | "EVALUATOR",
    password: "",
  });
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          create.mutate(form);
        }}
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <UserCog className="h-8 w-8 text-teal-700" />
        <h2 className="mt-3 text-xl font-semibold text-[#0b385d]">
          Yeni kullanıcı
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ad</Label>
            <Input
              required
              value={form.firstName}
              onChange={event =>
                setForm({ ...form, firstName: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Soyad</Label>
            <Input
              required
              value={form.lastName}
              onChange={event =>
                setForm({ ...form, lastName: event.target.value })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>E-posta</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={event =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={event =>
                setForm({
                  ...form,
                  role: event.target.value as "ADMIN" | "TRAINING_MANAGER" | "EVALUATOR",
                })
              }
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="ADMIN">Yönetici</option>
              <option value="TRAINING_MANAGER">Eğitim Yöneticisi</option>
              <option value="EVALUATOR">Değerlendirici</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Geçici şifre</Label>
            <Input
              required
              type="password"
              value={form.password}
              onChange={event =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Şifre en az 12 karakter; büyük/küçük harf, rakam ve özel karakter
          içermelidir.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            disabled={create.isPending}
            className="bg-[#0b385d] hover:bg-[#082d4c]"
          >
            Kullanıcıyı oluştur
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditUser({
  user,
  onClose,
  onDone,
}: {
  user: EditableUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const reset = trpc.admin.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Kullanıcı bilgileri ve şifresi güncellendi.");
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.users.update.useMutation({
    onSuccess: () => {
      if (newPassword.trim()) {
        reset.mutate({ id: user.id, temporaryPassword: newPassword });
      } else {
        toast.success("Kullanıcı bilgileri güncellendi.");
        onDone();
      }
    },
    onError: error => toast.error(error.message),
  });
  const [form, setForm] = useState(user);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (newPassword && newPassword.length < 8) {
            toast.error("Şifre en az 8 karakter olmalıdır.");
            return;
          }
          update.mutate(form);
        }}
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <UserCog className="h-8 w-8 text-teal-700" />
        <h2 className="mt-3 text-xl font-semibold text-[#0b385d]">
          Kullanıcıyı düzenle
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ad</Label>
            <Input
              required
              value={form.firstName}
              onChange={event =>
                setForm({ ...form, firstName: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Soyad</Label>
            <Input
              required
              value={form.lastName}
              onChange={event =>
                setForm({ ...form, lastName: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <select
              value={form.role}
              onChange={event =>
                setForm({
                  ...form,
                  role: event.target.value as EditableUser["role"],
                })
              }
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="ADMIN">Yönetici</option>
              <option value="TRAINING_MANAGER">Eğitim Yöneticisi</option>
              <option value="EVALUATOR">Değerlendirici</option>
            </select>
          </div>
          <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={event =>
                setForm({ ...form, isActive: event.target.checked })
              }
            />{" "}
            Hesabı etkin tut
          </label>
        </div>
        <div className="mt-5 space-y-2">
          <Label>Yeni şifre</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              placeholder="Değiştirmek istemiyorsanız boş bırakın"
              onChange={event => setNewPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              aria-label="Şifre görünürlüğünü değiştir"
              className="absolute right-3 top-2.5 text-slate-400"
              onClick={() => setShowPassword(value => !value)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Yeni şifre girerseniz kaydetme sırasında kullanıcının şifresi yenilenir. En az 8 karakter olmalıdır.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            disabled={update.isPending || reset.isPending}
            className="bg-[#0b385d] hover:bg-[#082d4c]"
          >
            Değişiklikleri kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}
