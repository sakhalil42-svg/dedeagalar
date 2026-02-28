"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Save, Info, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_META,
  getTemplate,
  saveTemplate,
  resetTemplate,
  type TemplateKey,
} from "@/lib/utils/whatsapp";

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({
    sevkiyat_bildirimi: "",
    odeme_hatirlatma: "",
    cek_vade_hatirlatma: "",
    ekstre_paylasim: "",
    gunluk_ozet: "",
  });

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const meta of TEMPLATE_META) {
      loaded[meta.key] = getTemplate(meta.key);
    }
    setTemplates(loaded as Record<TemplateKey, string>);
  }, []);

  function handleSave(key: TemplateKey) {
    saveTemplate(key, templates[key]);
    toast.success("Şablon kaydedildi");
  }

  function handleReset(key: TemplateKey) {
    resetTemplate(key);
    setTemplates((prev) => ({
      ...prev,
      [key]: getTemplate(key),
    }));
    toast.success("Şablon varsayılana sıfırlandı");
  }

  function insertVariable(variable: string) {
    const meta = TEMPLATE_META[activeTab];
    setTemplates((prev) => ({
      ...prev,
      [meta.key]: prev[meta.key] + variable,
    }));
  }

  const activeMeta = TEMPLATE_META[activeTab];
  const activeContent = templates[activeMeta?.key] || "";

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Mesaj Şablonları</h1>
          <p className="text-xs text-muted-foreground">WhatsApp mesaj şablonlarını düzenleyin</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-card p-1 shadow-sm mb-4 no-scrollbar">
        {TEMPLATE_META.map((meta, i) => (
          <button
            key={meta.key}
            onClick={() => setActiveTab(i)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === i
                ? "bg-primary text-white"
                : "text-muted-foreground"
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {activeMeta && (
        <div className="space-y-3">
          {/* Info Card */}
          <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
          </div>

          {/* Textarea */}
          <div className="rounded-xl bg-card p-4 shadow-sm space-y-3">
            <div className="relative">
              <textarea
                value={activeContent}
                onChange={(e) =>
                  setTemplates((prev) => ({
                    ...prev,
                    [activeMeta.key]: e.target.value,
                  }))
                }
                rows={5}
                className="w-full rounded-xl bg-muted p-3 text-sm outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow resize-none"
              />
              <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">
                {activeContent.length} karakter
              </span>
            </div>

            {/* Variable Chips */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Değişkenler</p>
              <div className="flex flex-wrap gap-1.5">
                {activeMeta.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Preview */}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Önizleme</p>
              <div className="rounded-xl bg-[#DCF8C6] p-3 text-xs whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {activeContent || "Mesaj önizlemesi burada görünecek..."}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleReset(activeMeta.key)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Sıfırla
              </button>
              <button
                onClick={() => handleSave(activeMeta.key)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
