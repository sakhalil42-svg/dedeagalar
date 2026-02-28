"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_META,
  getTemplate,
  saveTemplate,
  resetTemplate,
  type TemplateKey,
} from "@/lib/utils/whatsapp";

export default function TemplatesPage() {
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

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Mesaj Şablonları</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp mesaj şablonlarını düzenleyin
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {TEMPLATE_META.map((meta) => (
          <Card key={meta.key}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">{meta.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <Textarea
                value={templates[meta.key]}
                onChange={(e) =>
                  setTemplates((prev) => ({
                    ...prev,
                    [meta.key]: e.target.value,
                  }))
                }
                rows={3}
                className="text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {meta.variables.map((v) => (
                  <Badge key={v} variant="secondary" className="text-[10px]">
                    {v}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReset(meta.key)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Sıfırla
                </Button>
                <Button size="sm" onClick={() => handleSave(meta.key)}>
                  <Save className="mr-1 h-3 w-3" />
                  Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
