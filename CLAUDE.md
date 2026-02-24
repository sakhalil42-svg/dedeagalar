# CLAUDE.md — Kaba Yem Ticaret Uygulaması

> Bu dosya projenin tamamını tanımlar. Her oturumda otomatik okunur.

---

## PROJE NEDİR?

Kaba yem alım-satım operasyonlarını yöneten ticaret uygulaması.
Üreticiden kaba yem (yonca, saman, silaj, fiğ vb.) alınır, hayvancılık işletmelerine satılır.
Tek firma, birkaç kullanıcı, sahada mobil + ofiste web kullanımı.

## İŞ MODELİ

```
Üretici (çiftçi) → [ALIM] → Depo (stok) → [SATIŞ] → Müşteri (hayvancılık işletmesi)
                      ↑                                        ↓
                  Nakliyeci                                Nakliyeci
                      ↑                                        ↓
              Ödeme (nakit/çek/senet)                  Tahsilat (nakit/çek/senet)
```

### Temel İş Akışları

1. **Alım**: Üreticiyle anlaş → Nakliye ayarla → Teslim al (tartı) → Depoya gir → Fatura/ödeme planı
2. **Satış**: Müşteriyle anlaş → Depodan çıkış → Nakliye → Teslim → Fatura/tahsilat planı
3. **Nakliye**: Nakliyeci atama, plaka, yükleme/teslim miktarı (fire farkı), maliyet takibi
4. **Finans**: Cari hesap (borç/alacak), vadeli ödeme, kısmi ödeme, çek/senet yaşam döngüsü

## HEDEF CİHAZ

**iPhone 15** (6.1", iOS 17+, Dynamic Island) — PWA olarak Safari'den kurulur
- Dağıtım: Link gönder → Safari → Paylaş → "Ana Ekrana Ekle"
- App Store'a GEREK YOK, Apple Developer hesabına GEREK YOK
- Standalone mode: URL çubuğu olmadan tam ekran çalışır

## TEKNOLOJİ STACK

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| **Framework** | Next.js 15 (App Router) | Senin ERP ile aynı stack! SSR + PWA |
| **UI** | Tailwind CSS + shadcn/ui | Senin ERP ile aynı, sıfır öğrenme eğrisi |
| **PWA** | next-pwa (Serwist) | Service Worker, manifest, offline cache |
| **Backend** | Supabase Cloud (Frankfurt) | DB + Auth + API + Storage |
| **State** | TanStack Query v5 | Server cache yönetimi |
| **Forms** | react-hook-form + Zod | Form validasyon |
| **Charts** | Recharts | Senin ERP ile aynı |
| **Hosting** | Vercel (ücretsiz) | git push → auto deploy |
| **Dağıtım** | URL paylaş (0 ₺) | Link gönder, bitti |

### PWA Kütüphaneleri
- `next-pwa` (Serwist) — Service Worker + offline cache
- `@ducanh2912/next-pwa` — Next.js 15 uyumlu PWA
- Kamera: HTML5 getUserMedia API (ek kütüphane gereksiz)
- Push Notification: Web Push API (iOS 16.4+)

## DEPLOYMENT & MALİYET

### Hosting
- **Supabase Cloud Free** — DB 500MB, Auth 50K MAU, 1GB Storage
- **Vercel Free** — Hosting, SSL, CDN, auto deploy
- **TOPLAM MALİYET: 0 ₺**

### Maliyet Karşılaştırması
| Kalem | PWA | Native (Expo) |
|-------|-----|---------------|
| Apple Developer | 0 ₺ | ~3.500 ₺/yıl |
| Hosting | 0 ₺ (Vercel) | 0 ₺ (EAS) |
| Supabase | 0 ₺ (Free) | 0 ₺ (Free) |
| **TOPLAM** | **0 ₺** | **~3.500 ₺/yıl** |

## VERİTABANI

### Tablolar (12)

| Modül | Tablolar |
|-------|----------|
| Temel | `profiles`, `feed_types`, `warehouses` |
| Kişiler | `contacts`, `accounts` |
| Alım | `purchases` |
| Satış | `sales` |
| Lojistik | `shipments` |
| Stok | `inventory`, `inventory_movements` |
| Finans | `payments`, `checks`, `account_transactions` |

### Views (4)

| View | Açıklama |
|------|----------|
| `v_account_summary` | Cari hesap özeti (bakiye + toplam alım/satış) |
| `v_inventory_summary` | Depo bazlı stok durumu + değer |
| `v_checks_due` | Vadesi gelen/geçen çekler |
| `v_payments_due` | Vadesi gelen alım/satış ödemeleri |

### Kritik Trigger'lar

1. **`trg_contact_create_account`** — Yeni contact eklenince otomatik cari hesap açar
2. **`trg_account_tx_balance`** — account_transactions INSERT'inde bakiye otomatik güncellenir
3. **`trg_inventory_movement`** — inventory_movements INSERT'inde stok + WAC otomatik güncellenir
4. **`trg_purchase_no` / `trg_sale_no`** — Otomatik sıra numarası: AL-2026-0001, ST-2026-0001

### Tasarım Kararları

- **numeric(12,2)** tüm mali alanlar — Float KULLANMA
- **date / timestamptz** tüm tarih alanlar — String tarih KULLANMA
- **GENERATED ALWAYS AS** — total_amount = quantity × unit_price (tutarsızlık imkansız)
- **contacts tek tablo** — type: 'supplier' | 'customer' | 'both'
- **balance_after** her transaction'da — audit trail + tutarlılık
- **loaded_quantity vs delivered_quantity** — nakliye fire takibi
- **WAC (Weighted Average Cost)** — stok girişlerinde otomatik hesaplanır
- **RLS** — 3 rol: admin (tam yetki), staff (CRUD), viewer (sadece okuma)

## PROJE YAPISI

```
kaba-yem-ticaret/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (PWA meta tags)
│   ├── page.tsx                 # Dashboard (ana sayfa)
│   ├── login/                   # Auth
│   │   └── page.tsx
│   ├── purchases/               # Alım modülü
│   │   ├── page.tsx             # Liste
│   │   ├── [id]/page.tsx        # Detay
│   │   └── new/page.tsx         # Yeni alım
│   ├── sales/                   # Satış modülü
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── contacts/                # Üretici + Müşteri
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── inventory/               # Stok
│   │   └── page.tsx
│   └── finance/                 # Finans
│       ├── page.tsx             # Cari hesap özeti
│       ├── payments/page.tsx    # Ödeme/tahsilat
│       └── checks/page.tsx      # Çek/senet takibi
├── components/                   # Paylaşılan UI
│   ├── ui/                      # shadcn/ui bileşenleri
│   ├── forms/                   # Form bileşenleri
│   ├── layout/                  # MobileNav, BottomTabBar
│   └── dashboard/               # KPI kartları, grafikler
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   └── middleware.ts        # Auth middleware
│   ├── hooks/                   # TanStack Query hooks
│   ├── types/
│   │   └── database.types.ts   # Supabase gen types
│   ├── schemas/                 # Zod validation
│   └── utils/
│       └── format.ts           # Para, tarih formatlama
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── icons/                   # PWA ikonları (192, 512)
│   └── sw.js                    # Service Worker (auto-generated)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── next.config.js               # PWA config (next-pwa)
├── tailwind.config.ts
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## GELİŞTİRME KURALLARI

### Kodlama Standartları
- TypeScript strict mode
- Tüm API çağrıları TanStack Query hooks üzerinden
- Form validasyonu Zod ile
- Para formatı: `new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`
- Tarih: `date-fns` veya `dayjs` ile, locale: tr

### Git Konvansiyonu
- `feat: yeni alım formu eklendi`
- `fix: stok güncelleme hatası düzeltildi`
- `chore: bağımlılık güncelleme`

### Supabase CLI Komutları
```bash
# Tip üretimi (DB değişikliğinden sonra mutlaka çalıştır)
npx supabase gen types typescript --project-id <ID> > lib/types/database.types.ts

# Migration oluşturma
npx supabase migration new <migration_name>

# Edge Function deploy
npx supabase functions deploy <function_name>

# Local development
npx supabase start
```

## FAZ PLANI (PWA — Next.js + Supabase + Vercel)

### Faz 0: Proje Kurulumu (1 gün)
- [ ] Supabase projesi oluştur → Migration SQL çalıştır
- [ ] `npx create-next-app@latest kaba-yem-ticaret`
- [ ] Tailwind + shadcn/ui + Supabase client kur
- [ ] next-pwa (Serwist) yapılandır
- [ ] Vercel'e bağla (GitHub repo → auto deploy)

### Faz 1: Auth + Temel CRUD (3 gün)
- [ ] Supabase Auth ile login/register
- [ ] PWA manifest.json + icons + splash screen
- [ ] Mobile-first responsive layout (bottom tab bar)
- [ ] Contact (üretici/müşteri) CRUD
- [ ] Feed types + Warehouse yönetimi

### Faz 2: Alım & Satış (5 gün)
- [ ] Alım formu + liste (pull-to-refresh pattern)
- [ ] Satış formu + liste
- [ ] Nakliye kaydı
- [ ] Stok otomatik güncelleme (DB trigger)
- [ ] Swipe actions (kaydır → düzenle/sil)

### Faz 3: Finans (5 gün)
- [ ] Cari hesap görünümü
- [ ] Ödeme/tahsilat kayıt
- [ ] Çek/senet CRUD + durum yönetimi
- [ ] Vade takvimi görünümü
- [ ] Push notification (vade hatırlatma, iOS 16.4+)

### Faz 4: Dashboard & Raporlar (3 gün)
- [ ] KPI kartları (alım/satış/stok/bakiye)
- [ ] Grafikler (Recharts)
- [ ] Vadesi gelen çek/ödeme listesi
- [ ] PDF export (fatura/ekstre)

### Faz 5: Yayınla! (0.5 gün)
- [ ] Vercel'de production domain ayarla
- [ ] Arkadaşına link gönder 🔗
- [ ] Safari → Paylaş → Ana Ekrana Ekle → Bitti! 🎉

### Toplam: ~17.5 gün · Maliyet: 0 ₺

### Supabase CLI Komutları
```bash
# Tip üretimi (DB değişikliğinden sonra mutlaka çalıştır)
npx supabase gen types typescript --project-id <ID> > lib/types/database.types.ts

# Local development
npx supabase start

# Vercel deploy (otomatik — git push yeterli)
git push origin main
```
