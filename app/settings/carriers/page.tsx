"use client";

import { useState } from "react";
import Link from "next/link";
import { useCarriers, useCreateCarrier, useDeleteCarrier } from "@/lib/hooks/use-carriers";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { useVehicles, useCreateVehicle, useDeleteVehicle } from "@/lib/hooks/use-vehicles";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Truck,
  Phone,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";
import type { Vehicle } from "@/lib/types/database.types";

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function CarriersPage() {
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles();
  const { data: balances } = useCarrierBalances();
  const createCarrier = useCreateCarrier();
  const deleteCarrier = useDeleteCarrier();
  const createVehicle = useCreateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const [showNewCarrier, setShowNewCarrier] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [expandedCarrier, setExpandedCarrier] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "carrier" | "vehicle"; id: string; label: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New carrier form
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cPhone2, setCPhone2] = useState("");
  const [cCity, setCCity] = useState("");
  const [cNotes, setCNotes] = useState("");

  // New vehicle form
  const [vPlate, setVPlate] = useState("");
  const [vDriverName, setVDriverName] = useState("");
  const [vDriverPhone, setVDriverPhone] = useState("");
  const [vCarrierId, setVCarrierId] = useState("");
  const [vType, setVType] = useState("tir");
  const [vCapacity, setVCapacity] = useState("");

  const isLoading = carriersLoading || vehiclesLoading;

  function getVehiclesForCarrier(carrierId: string): Vehicle[] {
    return (vehicles || []).filter((v) => v.carrier_id === carrierId);
  }

  const unassignedVehicles = (vehicles || []).filter((v) => !v.carrier_id);

  // Total debt across all carriers
  const totalDebt = (balances || []).reduce((sum, b) => sum + Math.max(0, b.balance), 0);

  // Filtered carriers
  const filteredCarriers = (carriers || []).filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCreateCarrier() {
    if (!cName.trim()) {
      toast.error("Nakliyeci adı giriniz");
      return;
    }
    try {
      await createCarrier.mutateAsync({
        name: cName.trim(),
        phone: cPhone || null,
        phone2: cPhone2 || null,
        city: cCity || null,
        notes: cNotes || null,
      });
      toast.success("Nakliyeci eklendi");
      setShowNewCarrier(false);
      setCName("");
      setCPhone("");
      setCPhone2("");
      setCCity("");
      setCNotes("");
    } catch {
      toast.error("Ekleme başarısız");
    }
  }

  async function handleCreateVehicle() {
    if (!vPlate.trim()) {
      toast.error("Plaka giriniz");
      return;
    }
    try {
      await createVehicle.mutateAsync({
        plate: vPlate.trim().toUpperCase(),
        driver_name: vDriverName || null,
        driver_phone: vDriverPhone || null,
        carrier_id: vCarrierId || null,
        vehicle_type: vType,
        capacity_ton: vCapacity ? parseFloat(vCapacity) : null,
      });
      toast.success("Araç eklendi");
      setShowNewVehicle(false);
      setVPlate("");
      setVDriverName("");
      setVDriverPhone("");
      setVCarrierId("");
      setVType("tir");
      setVCapacity("");
    } catch {
      toast.error("Ekleme başarısız (plaka zaten kayıtlı olabilir)");
    }
  }

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Nakliyeciler</h1>
          <p className="text-xs text-muted-foreground">
            {(carriers || []).length} nakliyeci, {(vehicles || []).length} araç
          </p>
        </div>
      </div>

      {/* Banner Card */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 p-5 text-white mb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80 uppercase tracking-wide">Toplam Nakliye Borcu</p>
            <p className="text-3xl font-extrabold mt-1">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Truck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Nakliyeci ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-muted px-4 py-3 pl-10 text-sm outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowNewCarrier(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Nakliyeci
        </button>
        <button
          onClick={() => setShowNewVehicle(true)}
          className="flex items-center gap-1.5 rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          <Plus className="h-4 w-4" />
          Araç
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Carriers list */}
          {filteredCarriers.length > 0 ? (
            <div className="space-y-2">
              {filteredCarriers.map((carrier) => {
                const cvehicles = getVehiclesForCarrier(carrier.id);
                const isExpanded = expandedCarrier === carrier.id;
                const bal = balances?.find((b) => b.id === carrier.id);
                return (
                  <div key={carrier.id} className="rounded-xl bg-card shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCarrier(isExpanded ? null : carrier.id)
                      }
                      className="flex w-full items-center gap-3 p-4 text-left"
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold">
                        {getInitials(carrier.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{carrier.name}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted">
                            {cvehicles.length} araç
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                          {carrier.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {carrier.phone}
                            </span>
                          )}
                          {carrier.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {carrier.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {bal && bal.balance > 0 && (
                          <span className="text-sm font-extrabold text-red-600">
                            {formatCurrency(bal.balance)}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 pb-4 pt-3">
                        {carrier.phone2 && (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Tel 2: {carrier.phone2}
                          </p>
                        )}
                        {carrier.notes && (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Not: {carrier.notes}
                          </p>
                        )}

                        {/* Vehicles */}
                        {cvehicles.length > 0 ? (
                          <div className="space-y-1.5 mb-3">
                            <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                              Araçlar
                            </p>
                            {cvehicles.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-mono font-semibold bg-card rounded px-1.5 py-0.5">
                                    {v.plate}
                                  </span>
                                  {v.driver_name && (
                                    <span className="text-xs text-muted-foreground">
                                      {v.driver_name}
                                    </span>
                                  )}
                                  <span className="text-[10px] bg-card rounded px-1.5 py-0.5 text-muted-foreground">
                                    {v.vehicle_type}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ type: "vehicle", id: v.id, label: v.plate })}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-3">
                            Henüz araç yok.
                          </p>
                        )}

                        {/* Balance */}
                        {bal && bal.total_freight > 0 && (
                          <div className="rounded-xl bg-muted p-3 text-xs mb-3 space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Toplam Nakliye:</span>
                              <span className="font-semibold">{formatCurrency(bal.total_freight)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ödenen:</span>
                              <span className="font-semibold text-green-600">{formatCurrency(bal.total_paid)}</span>
                            </div>
                            <div className="border-t border-dashed pt-1.5 flex justify-between">
                              <span className="text-muted-foreground font-medium">Kalan Borç:</span>
                              <span className={`font-extrabold ${bal.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                {formatCurrency(Math.abs(bal.balance))}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Link
                            href={`/settings/carriers/${carrier.id}`}
                            className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-center text-xs font-semibold"
                          >
                            Cari Hesap
                          </Link>
                          <button
                            onClick={() => {
                              setVCarrierId(carrier.id);
                              setShowNewVehicle(true);
                            }}
                            className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2.5 text-xs font-semibold"
                          >
                            <Plus className="h-3 w-3" />
                            Araç
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: "carrier", id: carrier.id, label: carrier.name })}
                            className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Sil
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "Sonuç bulunamadı" : "Henüz nakliyeci yok"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">Yukarıdan ekleyin.</p>
              )}
            </div>
          )}

          {/* Unassigned vehicles */}
          {unassignedVehicles.length > 0 && (
            <div className="rounded-xl bg-card shadow-sm overflow-hidden mt-4">
              <div className="p-4 pb-2">
                <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                  Nakliyecisiz Araçlar ({unassignedVehicles.length})
                </p>
              </div>
              <div className="space-y-1.5 px-4 pb-4">
                {unassignedVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold">{v.plate}</span>
                      {v.driver_name && (
                        <span className="text-xs text-muted-foreground">
                          {v.driver_name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: "vehicle", id: v.id, label: v.plate })}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Carrier Dialog */}
      <Dialog open={showNewCarrier} onOpenChange={setShowNewCarrier}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Nakliyeci</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Ad *</label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Nakliyeci adı"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Telefon</label>
                <Input
                  type="tel"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="05XX XXX XXXX"
                  className="rounded-xl bg-muted border-0 h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Telefon 2</label>
                <Input
                  type="tel"
                  value={cPhone2}
                  onChange={(e) => setCPhone2(e.target.value)}
                  placeholder="05XX XXX XXXX"
                  className="rounded-xl bg-muted border-0 h-12"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Şehir</label>
              <Input
                value={cCity}
                onChange={(e) => setCCity(e.target.value)}
                placeholder="Şehir"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Notlar</label>
              <Input
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="Ek notlar..."
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowNewCarrier(false)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold"
            >
              İptal
            </button>
            <button
              onClick={handleCreateCarrier}
              disabled={createCarrier.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createCarrier.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Vehicle Dialog */}
      <Dialog open={showNewVehicle} onOpenChange={setShowNewVehicle}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Araç</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Plaka *</label>
              <Input
                value={vPlate}
                onChange={(e) => setVPlate(e.target.value.toUpperCase())}
                placeholder="34 XX 1234"
                className="rounded-xl bg-muted border-0 h-12 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Şoför Adı</label>
                <Input
                  value={vDriverName}
                  onChange={(e) => setVDriverName(e.target.value)}
                  placeholder="Şoför adı"
                  className="rounded-xl bg-muted border-0 h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Şoför Tel</label>
                <Input
                  type="tel"
                  value={vDriverPhone}
                  onChange={(e) => setVDriverPhone(e.target.value)}
                  placeholder="05XX XXX XXXX"
                  className="rounded-xl bg-muted border-0 h-12"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Nakliyeci</label>
              <select
                value={vCarrierId}
                onChange={(e) => setVCarrierId(e.target.value)}
                className="flex h-12 w-full rounded-xl bg-muted border-0 px-3 py-2 text-sm outline-none"
              >
                <option value="">Seçiniz (opsiyonel)</option>
                {(carriers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Araç Tipi</label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                  className="flex h-12 w-full rounded-xl bg-muted border-0 px-3 py-2 text-sm outline-none"
                >
                  <option value="tir">Tır</option>
                  <option value="kamyon">Kamyon</option>
                  <option value="romorsk">Römork</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Kapasite (ton)</label>
                <Input
                  type="number"
                  value={vCapacity}
                  onChange={(e) => setVCapacity(e.target.value)}
                  placeholder="0"
                  className="rounded-xl bg-muted border-0 h-12"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowNewVehicle(false)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold"
            >
              İptal
            </button>
            <button
              onClick={handleCreateVehicle}
              disabled={createVehicle.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createVehicle.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === "carrier" ? "Nakliyeciyi Sil" : "Aracı Sil"}
            </DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.label}&quot; silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold"
            >
              İptal
            </button>
            <button
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "carrier") {
                  deleteCarrier.mutate(deleteTarget.id);
                } else {
                  deleteVehicle.mutate(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
              className="flex-1 rounded-xl bg-destructive py-3 text-sm font-semibold text-white"
            >
              Sil
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
