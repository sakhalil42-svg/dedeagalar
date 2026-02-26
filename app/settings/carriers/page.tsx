"use client";

import { useState } from "react";
import Link from "next/link";
import { useCarriers, useCreateCarrier, useDeleteCarrier } from "@/lib/hooks/use-carriers";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { useVehicles, useCreateVehicle, useDeleteVehicle } from "@/lib/hooks/use-vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
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
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/format";
import type { Carrier, Vehicle } from "@/lib/types/database.types";

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
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nakliyeciler & Araçlar</h1>
            <p className="text-sm text-muted-foreground">
              {(carriers || []).length} nakliyeci, {(vehicles || []).length} araç
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowNewCarrier(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nakliyeci
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowNewVehicle(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Araç
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Carriers list */}
          {(carriers || []).length > 0 ? (
            <div className="space-y-2">
              {(carriers || []).map((carrier) => {
                const cvehicles = getVehiclesForCarrier(carrier.id);
                const isExpanded = expandedCarrier === carrier.id;
                return (
                  <Card key={carrier.id}>
                    <CardContent className="p-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCarrier(isExpanded ? null : carrier.id)
                        }
                        className="flex w-full items-center justify-between p-4 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{carrier.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {cvehicles.length} araç
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-2">
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

                          {cvehicles.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Araçlar:
                              </p>
                              {cvehicles.map((v) => (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5"
                                >
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-mono font-medium">
                                      {v.plate}
                                    </span>
                                    {v.driver_name && (
                                      <span className="text-xs text-muted-foreground">
                                        {v.driver_name}
                                      </span>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {v.vehicle_type}
                                    </Badge>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `${v.plate} aracını silmek istediğinize emin misiniz?`
                                        )
                                      ) {
                                        deleteVehicle.mutate(v.id);
                                      }
                                    }}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Henüz araç yok.
                            </p>
                          )}

                          {/* Balance */}
                          {(() => {
                            const bal = balances?.find((b) => b.id === carrier.id);
                            if (bal && bal.total_freight > 0) {
                              return (
                                <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Toplam Nakliye:</span>
                                    <span className="font-medium">{formatCurrency(bal.total_freight)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ödenen:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(bal.total_paid)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Kalan Borç:</span>
                                    <span className={`font-bold ${bal.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                      {formatCurrency(Math.abs(bal.balance))}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs" asChild>
                              <Link href={`/settings/carriers/${carrier.id}`}>
                                Cari Hesap
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setVCarrierId(carrier.id);
                                setShowNewVehicle(true);
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Araç Ekle
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `${carrier.name} nakliyecisini silmek istediğinize emin misiniz?`
                                  )
                                ) {
                                  deleteCarrier.mutate(carrier.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Sil
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz nakliyeci yok. Yukarıdan ekleyin.
            </div>
          )}

          {/* Unassigned vehicles */}
          {unassignedVehicles.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Nakliyecisiz Araçlar ({unassignedVehicles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {unassignedVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-medium">{v.plate}</span>
                      {v.driver_name && (
                        <span className="text-xs text-muted-foreground">
                          {v.driver_name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `${v.plate} aracını silmek istediğinize emin misiniz?`
                          )
                        ) {
                          deleteVehicle.mutate(v.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* New Carrier Dialog */}
      <Dialog open={showNewCarrier} onOpenChange={setShowNewCarrier}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Nakliyeci</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad *</Label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Nakliyeci adı"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Telefon</Label>
                <Input
                  type="tel"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="05XX XXX XXXX"
                />
              </div>
              <div>
                <Label>Telefon 2</Label>
                <Input
                  type="tel"
                  value={cPhone2}
                  onChange={(e) => setCPhone2(e.target.value)}
                  placeholder="05XX XXX XXXX"
                />
              </div>
            </div>
            <div>
              <Label>Şehir</Label>
              <Input
                value={cCity}
                onChange={(e) => setCCity(e.target.value)}
                placeholder="Şehir"
              />
            </div>
            <div>
              <Label>Notlar</Label>
              <Input
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="Ek notlar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCarrier(false)}>
              İptal
            </Button>
            <Button
              onClick={handleCreateCarrier}
              disabled={createCarrier.isPending}
            >
              {createCarrier.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Vehicle Dialog */}
      <Dialog open={showNewVehicle} onOpenChange={setShowNewVehicle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Araç</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plaka *</Label>
              <Input
                value={vPlate}
                onChange={(e) => setVPlate(e.target.value.toUpperCase())}
                placeholder="34 XX 1234"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Şoför Adı</Label>
                <Input
                  value={vDriverName}
                  onChange={(e) => setVDriverName(e.target.value)}
                  placeholder="Şoför adı"
                />
              </div>
              <div>
                <Label>Şoför Tel</Label>
                <Input
                  type="tel"
                  value={vDriverPhone}
                  onChange={(e) => setVDriverPhone(e.target.value)}
                  placeholder="05XX XXX XXXX"
                />
              </div>
            </div>
            <div>
              <Label>Nakliyeci</Label>
              <select
                value={vCarrierId}
                onChange={(e) => setVCarrierId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
                <Label>Araç Tipi</Label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="tir">Tır</option>
                  <option value="kamyon">Kamyon</option>
                  <option value="romorsk">Römork</option>
                </select>
              </div>
              <div>
                <Label>Kapasite (ton)</Label>
                <Input
                  type="number"
                  value={vCapacity}
                  onChange={(e) => setVCapacity(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVehicle(false)}>
              İptal
            </Button>
            <Button
              onClick={handleCreateVehicle}
              disabled={createVehicle.isPending}
            >
              {createVehicle.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
