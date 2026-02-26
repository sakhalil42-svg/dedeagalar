"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Users, Truck, Wallet } from "lucide-react";

const STORAGE_KEY = "dedeagalar_onboarding_done";

const STEPS = [
  {
    icon: Users,
    title: "Kişi Ekleyin",
    description: "Üretici ve müşteri bilgilerini girerek başlayın. Telefon, adres ve diğer bilgileri kaydedin.",
  },
  {
    icon: Truck,
    title: "Sevkiyat Kaydedin",
    description: "Alım ve satış işlemlerini oluşturun, kantar fişlerini girin. Stok otomatik güncellenir.",
  },
  {
    icon: Wallet,
    title: "Finansı Takip Edin",
    description: "Cari hesapları, ödemeleri ve çek/senetleri takip edin. Vade takviminden hatırlatma alın.",
  },
];

interface OnboardingProps {
  show: boolean;
}

export function Onboarding({ show }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setVisible(true);
    }
  }, [show]);

  if (!visible) return null;

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSkip();
    }
  };

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Icon className="h-8 w-8 text-primary" />
          </div>

          <h2 className="text-lg font-bold">{currentStep.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex w-full gap-3">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="flex-1">
              Atla
            </Button>
            <Button size="sm" onClick={handleNext} className="flex-1">
              {step < STEPS.length - 1 ? "İleri" : "Başla"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
