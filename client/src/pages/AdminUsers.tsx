import { AppShell, StatusBadge, formatDate } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  UserCog,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type EditableUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
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
  const [userForAssignments, setUserForAssignments] = useState<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [firstLoginFilter, setFirstLoginFilter] = useState("ALL");
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter(user => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        if (!fullName.includes(q) && !email.includes(q)) return false;
      }

      // Role
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;

      // Status
      if (statusFilter === "ACTIVE" && !user.isActive) return false;
      if (statusFilter === "INACTIVE" && user.isActive) return false;

      // First login status
      if (firstLoginFilter === "PENDING" && !user.mustChangePassword)
        return false;
      if (firstLoginFilter === "COMPLETED" && user.mustChangePassword)
        return false;

      return true;
    });
  }, [query.data, searchQuery, roleFilter, statusFilter, firstLoginFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    roleFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    firstLoginFilter !== "ALL";

  const activeFilterCount = [
    searchQuery.trim() !== "",
    roleFilter !== "ALL",
    statusFilter !== "ALL",
    firstLoginFilter !== "ALL",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setFirstLoginFilter("ALL");
  };

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

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Ad, soyad veya e-posta ile ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isFilterExpanded ? "default" : "outline"}
              onClick={() => setIsFilterExpanded(prev => !prev)}
              className={`gap-2 ${
                isFilterExpanded
                  ? "bg-[#0b385d] text-white hover:bg-[#082d4c]"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Detaylı Filtreler
              {activeFilterCount > 0 && (
                <span className="ml-0.5 rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
              {isFilterExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1.5 text-slate-600 hover:text-[#0b385d]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Filtreleri Sıfırla
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {isFilterExpanded && (
          <Card className="border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Rol
                </label>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">Tüm Roller</option>
                  <option value="ADMIN">Yönetici</option>
                  <option value="TRAINING_MANAGER">Eğitim Yöneticisi</option>
                  <option value="EVALUATOR">Değerlendirici</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Hesap Durumu
                </label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">Tüm Durumlar</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Pasif / Arşiv</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  İlk Giriş Durumu
                </label>
                <select
                  value={firstLoginFilter}
                  onChange={e => setFirstLoginFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">Tüm Durumlar</option>
                  <option value="PENDING">Şifre Değişikliği Bekleniyor</option>
                  <option value="COMPLETED">Giriş Tamamlandı</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Count Info */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 pt-1 gap-2">
          <span>
            {query.data
              ? `${filteredUsers.length} / ${query.data.length} kullanıcı listeleniyor`
              : ""}
          </span>
        </div>
      </div>

      <Card className="mt-4 border-slate-200 shadow-sm">
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
                {query.isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Yükleniyor...
                    </td>
                  </tr>
                ) : filteredUsers.length ? (
                  filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#0b385d]">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {user.role === "ADMIN"
                            ? "Yönetici"
                            : user.role === "TRAINING_MANAGER"
                              ? "Eğitim Yöneticisi"
                              : "Değerlendirici"}
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-teal-200 text-teal-800 hover:bg-teal-50"
                            onClick={() =>
                              setUserForAssignments({
                                id: user.id,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
                              })
                            }
                          >
                            <ClipboardList className="h-3.5 w-3.5 text-teal-600" />{" "}
                            Atanan Değerlendirmeler
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setEditing({
                                id: user.id,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                email: user.email,
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
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      <p className="text-base font-semibold text-[#0b385d]">
                        {query.data?.length
                          ? "Filtrelere uyan kullanıcı bulunamadı."
                          : "Henüz kullanıcı bulunmuyor."}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {query.data?.length
                          ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyin."
                          : ""}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="mt-4 gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Filtreleri Sıfırla
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
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
      {userForAssignments && (
        <UserAssignmentsModal
          user={userForAssignments}
          onClose={() => setUserForAssignments(null)}
        />
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
                  role: event.target.value as
                    | "ADMIN"
                    | "TRAINING_MANAGER"
                    | "EVALUATOR",
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
            Yeni şifre girerseniz kaydetme sırasında kullanıcının şifresi
            yenilenir. En az 8 karakter olmalıdır.
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

function UserAssignmentsModal({
  user,
  onClose,
}: {
  user: { id: number; firstName: string; lastName: string; email: string };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const assignmentsQuery = trpc.admin.users.userAssignments.useQuery({
    userId: user.id,
  });

  const convertToDraft = trpc.admin.users.convertToDraft.useMutation({
    onSuccess: () => {
      toast.success("Değerlendirme statüsü Taslak olarak güncellendi.");
      utils.admin.users.userAssignments.invalidate({ userId: user.id });
    },
    onError: error => toast.error(error.message),
  });

  const deleteAssignment = trpc.admin.users.deleteAssignment.useMutation({
    onSuccess: () => {
      toast.success("Atama başarıyla silindi.");
      utils.admin.users.userAssignments.invalidate({ userId: user.id });
    },
    onError: error => toast.error(error.message),
  });

  const handleConvertToDraft = (assignmentId: number, title: string) => {
    if (
      confirm(
        `"${title}" eğitimine ait tamamlanmış değerlendirme Taslak statüsüne çevrilsin mi? Değerlendirici formu yeniden düzenleyebilecektir.`
      )
    ) {
      convertToDraft.mutate({ assignmentId });
    }
  };

  const handleDeleteAssignment = (assignmentId: number, title: string) => {
    if (
      confirm(
        `"${title}" eğitimi atamasını silmek istediğinizden emin misiniz? Varsa bu atamaya girilen tüm yanıtlar da silinecektir.`
      )
    ) {
      deleteAssignment.mutate({ assignmentId });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white p-6 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#0b385d]">
                Atanan Değerlendirmeler
              </h2>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">
                  {user.firstName} {user.lastName}
                </span>{" "}
                ({user.email}) için tanımlı atama listesi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {assignmentsQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : assignmentsQuery.data?.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Eğitim</th>
                    <th className="px-3 py-3">Değerlendirme Seti</th>
                    <th className="px-3 py-3">Son Tarih</th>
                    <th className="px-3 py-3">Durum</th>
                    <th className="px-4 py-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignmentsQuery.data.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0b385d]">
                          {item.trainingTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          <span className="font-medium text-teal-700">
                            {item.trainingCode}
                          </span>{" "}
                          · {item.trainingType}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-700 font-medium">
                        {item.evaluationSetName}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {item.status === "COMPLETED" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={convertToDraft.isPending}
                              className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() =>
                                handleConvertToDraft(
                                  item.id,
                                  item.trainingTitle
                                )
                              }
                              title="Değerlendirmeyi tamamlandı statüsünden Taslak statüsüne çevir"
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Taslağa çevir
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deleteAssignment.isPending}
                            className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() =>
                              handleDeleteAssignment(
                                item.id,
                                item.trainingTitle
                              )
                            }
                            title="Atamayı sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
              <p className="text-slate-600 font-medium">
                Kullanıcıya atanmış herhangi bir değerlendirme bulunmuyor.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Yönetim panelinden eğitimler sayfasına giderek bu kullanıcıya
                değerlendirme atayabilirsiniz.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
