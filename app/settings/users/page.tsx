"use client";

import { useState } from "react";
import Link from "next/link";
import { useProfiles, useCreateUser, useUpdateProfile } from "@/lib/hooks/use-profiles";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Pencil, Shield, UserCog, Eye } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  staff: "Personel",
  viewer: "Görüntüleyici",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  staff: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Shield,
  staff: UserCog,
  viewer: Eye,
};

export default function UsersPage() {
  const { data: profiles, isLoading } = useProfiles();
  const createUser = useCreateUser();
  const updateProfile = useUpdateProfile();

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "viewer">("staff");

  const [editTarget, setEditTarget] = useState<{
    id: string;
    full_name: string;
    role: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "staff" | "viewer">("staff");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ email, password, fullName, role });
      toast.success("Kullanıcı oluşturuldu");
      setShowCreate(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Hata oluştu";
      toast.error(message);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    try {
      await updateProfile.mutateAsync({
        id: editTarget.id,
        full_name: editName,
        role: editRole,
      });
      toast.success("Kullanıcı güncellendi");
      setEditTarget(null);
    } catch {
      toast.error("Güncelleme hatası");
    }
  }

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Kullanıcı Yönetimi</h1>
            <p className="text-xs text-muted-foreground">Kullanıcıları yönetin</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles && profiles.length > 0 ? (
        <div className="space-y-2">
          {profiles.map((p) => {
            const initials = p.full_name
              ? p.full_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?";
            const RoleIcon = ROLE_ICONS[p.role] || UserCog;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.full_name || "İsimsiz"}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email || p.id}</p>
                </div>
                <span className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${ROLE_COLORS[p.role] || ""}`}>
                  <RoleIcon className="h-3 w-3" />
                  {ROLE_LABELS[p.role] || p.role}
                </span>
                <button
                  onClick={() => {
                    setEditTarget({ id: p.id, full_name: p.full_name || "", role: p.role });
                    setEditName(p.full_name || "");
                    setEditRole(p.role);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Henüz kullanıcı yok.
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ad Soyad *</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Ahmet Yılmaz"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-posta *</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ornek@email.com"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Şifre *</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="En az 6 karakter"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rol</label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Yönetici</SelectItem>
                  <SelectItem value="staff">Personel</SelectItem>
                  <SelectItem value="viewer">Görüntüleyici</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={createUser.isPending}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {createUser.isPending ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ad Soyad</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rol</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as typeof editRole)}>
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Yönetici</SelectItem>
                  <SelectItem value="staff">Personel</SelectItem>
                  <SelectItem value="viewer">Görüntüleyici</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {updateProfile.isPending ? "Güncelleniyor..." : "Güncelle"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
