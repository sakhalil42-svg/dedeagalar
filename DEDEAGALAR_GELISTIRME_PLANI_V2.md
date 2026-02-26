# 🚜 Dedeağalar Grup — Kapsamlı Geliştirme Planı V2

**Tarih:** 26 Şubat 2026  
**Uygulama:** Kaba Yem Ticaret PWA  
**Teknoloji:** Next.js 15 + Supabase + Vercel

---

## 📋 MEVCUT DURUM

### ✅ Çalışan Özellikler
- Hızlı Sevkiyat paneli (tek sayfa müşteri-tedarikçi-fiyat-tır girişi)
- Cari hesap detay sayfası (sevkiyatlar + ödemeler account_transactions'dan)
- Ödeme/Tahsilat kaydı (Nakit, Havale/EFT, Çek, Senet)
- PDF Cari Hesap Ekstresi (tedarikçi ve müşteri ayrı)
- WhatsApp entegrasyonu (sevkiyat bilgisi gönderme)
- Dashboard (KPI kartları)
- Kişi yönetimi (tedarikçi/müşteri)

### ⚠️ Bilinen Sorunlar
1. `v_account_summary` view'da `contact_name` sıralama hatası (400 error)
2. Hızlı Sevkiyat sadece `account_transactions`'a yazıyor, `deliveries` tablosu boş
3. Müşteri cari hesapta bakiye eksi gösteriyor (terminoloji sorunu)
4. PDF'de sevkiyat detayları description parse'dan geliyor, yapısal veri değil

---

## 🏗️ GELİŞTİRME FAZLARI

---

### FAZ 1: KRİTİK HATA DÜZELTMELERİ VE VERİ BÜTÜNLÜĞÜ
**Öncelik: 🔴 ACİL | Süre: 1-2 gün**

#### 1.1 — v_account_summary 400 Hatası
- `contact_name` → `name` olarak düzelt (contacts tablosundaki gerçek kolon adı)
- Tüm view'ları ve sorguları tarayıp yanlış kolon referanslarını düzelt

#### 1.2 — Hızlı Sevkiyat → deliveries Tablosuna Yazma
Şu an her sevkiyat sadece `account_transactions`'a yazılıyor. Bu büyük bir veri bütünlüğü sorunu.

**Yapılacak:**
Her sevkiyat kaydedildiğinde:
1. `deliveries` tablosuna kayıt at (kantar fişi no, plaka, şoför, net ağırlık, nakliye bilgileri)
2. `account_transactions`'a kayıt at (mevcut davranış, korusun)
3. `deliveries.id` → `account_transactions.reference_id` olarak bağla

**deliveries tablosu zaten var:**
- delivery_date, ticket_no, net_weight, gross_weight, tare_weight
- vehicle_plate, driver_name, carrier_name, carrier_phone
- freight_cost, freight_payer
- sale_id, purchase_id (isteğe bağlı bağlantı)

#### 1.3 — Müşteri/Tedarikçi Terminoloji Düzeltmesi
- Tedarikçi: Borç / Ödenen / Kalan Borç (kırmızı tema)
- Müşteri: Alacak / Tahsil Edilen / Kalan Alacak (yeşil tema)
- Bakiye işaretleri düzelt (müşteride eksi göstermesin)

---

### FAZ 2: NAKLİYECİ VE ARAÇ YÖNETİMİ
**Öncelik: 🟡 YÜKSEK | Süre: 2-3 gün**

#### 2.1 — Nakliyeci/Araç Veritabanı (YENİ TABLO: `carriers`)
```
carriers:
  id: uuid
  name: text              -- Nakliyeci firma/kişi adı
  phone: text             -- Ana telefon
  phone2: text            -- Yedek telefon
  city: text              -- Şehir
  notes: text             -- Notlar
  is_active: boolean
  created_at: timestamptz
```

#### 2.2 — Araç Veritabanı (YENİ TABLO: `vehicles`)
```
vehicles:
  id: uuid
  plate: text             -- Plaka (34 ABC 123)
  carrier_id: uuid        -- FK → carriers
  driver_name: text       -- Varsayılan şoför
  driver_phone: text      -- Şoför telefonu
  vehicle_type: enum      -- tir, kamyon, romorsk
  capacity_ton: numeric   -- Kapasite (ton)
  notes: text
  is_active: boolean
  created_at: timestamptz
```

#### 2.3 — Plaka Dropdown + Otomatik Doldurma
Hızlı Sevkiyat panelinde:
- **Plaka alanı**: Arama yapılabilir dropdown (combobox)
- Plaka seçilince otomatik doldur:
  - Şoför adı
  - Şoför telefonu  
  - Nakliyeci adı
  - Nakliyeci telefonu
- Yeni plaka girilirse "Yeni Araç Ekle" butonu çıksın
- Son kullanılan plakalar üstte gösterilsin (sık kullanılanlar)

#### 2.4 — Nakliyeci Cari Hesabı
- Nakliyecilere de cari hesap açılabilsin
- Nakliye ücretleri nakliyeci bazında takip edilsin
- Nakliyeciye yapılan ödemeler kaydedilsin
- PDF ekstre: Nakliyeci bazında sevkiyat + ödeme raporu

---

### FAZ 3: HIZLI SEVKİYAT PANELİ — PRO VERSİYON
**Öncelik: 🟡 YÜKSEK | Süre: 3-4 gün**

#### 3.1 — Akıllı Alanlar ve Otomatik Tamamlama
- **Müşteri seçimi**: Son seçilen müşteri hatırlansın, sık kullanılanlar üstte
- **Tedarikçi seçimi**: Aynı şekilde
- **Yem türü**: Son seçilen hatırlansın
- **Fiyatlar**: Son girilen müşteri/tedarikçi fiyatları varsayılan gelsin
- **Kantar fişi no**: Otomatik artan numara önerisi (son fişe +1)

#### 3.2 — Toplu Sevkiyat Girişi
Sezon yoğunluğunda günde 20-30 tır girebilirsin. Hız için:
- "Bir Tır Daha Ekle" butonu ile aynı müşteri-tedarikçi-fiyat ayarlarında hızlı ekleme
- Tüm sevkiyatları tek seferde kaydetme
- Kopyala/yapıştır: Son girilen tırın bilgilerini klonlama

#### 3.3 — Kantar Fişi Fotoğrafı
- Her sevkiyatta kamera ikonu
- Fotoğraf çek → Supabase Storage'a yükle
- Thumbnail görüntüleme + büyütme
- Birden fazla fotoğraf (ön yüz, arka yüz, mal fotoğrafı)

#### 3.4 — Sevkiyat Düzenleme ve Silme
- Kayıtlı sevkiyatı düzenleme (yanlış kg, fiyat düzeltme)
- Sevkiyat silme (onay dialogu ile)
- Düzenleme/silme sonrası cari bakiye otomatik güncelleme

#### 3.5 — Hızlı Sevkiyat Şablonları
- Sık yapılan müşteri-tedarikçi-yem kombinasyonlarını şablon olarak kaydet
- "Ofis Hayvancılık ← Halil SAK (Arpa Samanı)" gibi
- Tek tıkla şablon yükle, sadece kg ve plaka gir

---

### FAZ 4: FİNANS MODÜLÜ — GELİŞMİŞ
**Öncelik: 🟡 YÜKSEK | Süre: 3-4 gün**

#### 4.1 — Çek/Senet Takip Sistemi
- Çek defteri yönetimi
- Çek durumu takibi: Beklemede → Bankaya Verildi → Tahsil Edildi / Karşılıksız
- Senet ciro işlemi (bir müşteriden alınan çeki tedarikçiye verme)
- Vade takvimi: Günlük/haftalık vadesi gelen çek/senetler
- Push notification benzeri uyarı: "Yarın 3 çekin vadesi doluyor"

#### 4.2 — Kasa ve Banka Hesapları
- Kasa (nakit) takibi: Giriş/çıkış
- Banka hesap bakiyeleri (manuel giriş)
- Günlük kasa raporu

#### 4.3 — Gelişmiş Ödeme Kayıt
- Kısmi ödeme desteği (150.000 borç, 50.000 ödeme)
- Ödeme makbuzu PDF oluşturma
- Otomatik kapama: Ödeme yapıldığında en eski borca otomatik mahsup

#### 4.4 — Kâr/Zarar Raporu
- Satış bazında kâr hesaplama:
  - Müşteri fiyatı - Tedarikçi fiyatı - Nakliye gideri = Kâr
- Günlük/haftalık/aylık kâr raporu
- Yem türü bazında kâr analizi
- Nakliye gideri analizi

---

### FAZ 5: PDF RAPORLARI — PROFESYONELLEŞTİRME
**Öncelik: 🟠 ORTA | Süre: 2-3 gün**

#### 5.1 — Gelişmiş Cari Hesap Ekstresi
Artık deliveries tablosunda yapısal veri olacağı için:

**Tedarikçi Ekstresi:**
| Tarih | Fiş No | Plaka | Yem Türü | Net Kg | Birim Fiyat | Mal Bedeli | Nakliye | Nakliye Ödeyen | Net Tutar |

**Müşteri Ekstresi:**
| Tarih | Fiş No | Plaka | Yem Türü | Net Kg | Birim Fiyat | Mal Bedeli | Nakliye | Nakliye Ödeyen | Net Tutar |

- Tarih aralığı filtresi (1 Ocak - 28 Şubat gibi)
- Zebra satırlar + profesyonel tasarım
- QR kod (opsiyonel, doğrulama için)

#### 5.2 — Sevkiyat Makbuzu PDF
Her tır için ayrı makbuz:
- Dedeağalar Grup logosu + bilgileri
- Müşteri / Tedarikçi bilgileri
- Kantar fişi detayları (tarih, fiş no, plaka, şoför)
- Tonaj + birim fiyat + tutar
- Nakliye bilgisi
- İmza alanı

#### 5.3 — Aylık Özet Rapor
- Toplam alım tonajı ve tutarı
- Toplam satış tonajı ve tutarı
- Brüt kâr
- Nakliye giderleri
- Net kâr
- En çok çalışılan müşteri/tedarikçi top 5

#### 5.4 — Nakliyeci Raporu
- Nakliyeci bazında sevkiyat listesi
- Toplam sefer sayısı + toplam tonaj
- Toplam nakliye ücreti + ödenen + kalan

---

### FAZ 6: DASHBOARD — AKTİF İŞ ZEKASI
**Öncelik: 🟠 ORTA | Süre: 2-3 gün**

#### 6.1 — Günlük Özet Kartları
- Bugün kaç tır gitti
- Bugün toplam tonaj
- Bugünkü kâr
- Bugün yapılan/alınan ödemeler

#### 6.2 — Bakiye Uyarıları
- Yüksek bakiyeli müşteriler (alacak riski)
- Yüksek borçlu tedarikçiler (ödeme önceliği)
- Renk kodlu uyarı sistemi:
  - 🟢 0-100K: Normal
  - 🟡 100K-500K: Dikkat
  - 🔴 500K+: Acil

#### 6.3 — Vade Takvimi Widget
- Bu hafta vadesi gelen çek/senetler
- Renk kodlu: Bugün (kırmızı), Bu hafta (turuncu), Bu ay (yeşil)

#### 6.4 — Trend Grafikleri
- Haftalık/aylık satış trendi
- Yem türü bazında dağılım pasta grafiği
- Müşteri bazında satış dağılımı
- Nakliye gideri trendi

---

### FAZ 7: İLETİŞİM VE BİLDİRİM
**Öncelik: 🟢 DÜŞÜK | Süre: 2 gün**

#### 7.1 — WhatsApp Entegrasyonu — Gelişmiş
- **Sevkiyat bildirimi**: Tır yola çıktığında müşteriye otomatik mesaj
  > "Sayın [Müşteri], [Plaka] plakalı araç [Tonaj] ton [Yem Türü] ile yola çıkmıştır. Nakliye: [Tutar] ₺. İyi günler, Dedeağalar Grup"
- **Ödeme hatırlatma**: Bakiye yüksek müşterilere nazik hatırlatma
  > "Sayın [Müşteri], cari hesap bakiyeniz [Bakiye] ₺'dir. Ödeme planı için bize ulaşabilirsiniz."
- **Çek/senet vade hatırlatma**: Vade yaklaşan çekler için bilgi
- **Mesaj şablonları**: Özelleştirilebilir şablonlar

#### 7.2 — Hızlı Arama ile WhatsApp
- Kişi detayında tek tıkla WhatsApp'tan ara
- Nakliyeciye tek tıkla ara
- Şoföre tek tıkla ara

---

### FAZ 8: GELİŞMİŞ ARAMA VE FİLTRE
**Öncelik: 🟢 DÜŞÜK | Süre: 1-2 gün**

#### 8.1 — Global Arama
- Üstte arama çubuğu: Kişi adı, plaka, kantar fişi no ile arama
- Arama sonuçları: Kişi, sevkiyat, ödeme sonuçlarını grupla

#### 8.2 — Sevkiyat Filtreleme
- Tarih aralığı filtresi
- Müşteri/tedarikçi filtresi
- Yem türü filtresi
- Plaka/nakliyeci filtresi
- Nakliye ödeme türü filtresi

#### 8.3 — Finans Filtreleme
- Tarih aralığı
- Ödeme yöntemi (Nakit/Havale/Çek/Senet)
- Borçlu/Alacaklı filtresi

---

### FAZ 9: VERİ GÜVENLİĞİ VE YEDEKLEME
**Öncelik: 🟠 ORTA | Süre: 1 gün**

#### 9.1 — Otomatik Yedekleme
- Supabase günlük yedekleme (free tier'da 7 gün)
- Haftalık Excel/CSV export (tüm tablolar)
- One-click backup butonu

#### 9.2 — Silme Koruması
- Soft delete: Kayıtlar silinmesin, "silindi" işaretlensin
- 30 gün çöp kutusu
- Kritik işlemler için onay dialogu

#### 9.3 — İşlem Geçmişi (Audit Log)
- Kim, ne zaman, ne değiştirdi
- Özellikle fiyat ve tutar değişikliklerinin kaydı

---

### FAZ 10: KULLANICI DENEYİMİ İYİLEŞTİRMELERİ
**Öncelik: 🟢 DÜŞÜK | Süre: 2 gün**

#### 10.1 — Offline Destek (PWA Enhancement)
- Sezonda saha'da internet zayıf olabilir
- Temel sevkiyat girişi offline çalışsın
- İnternet gelince senkronize etsin

#### 10.2 — Hızlı Eylemler
- Ana sayfada "+" butonu → Hızlı Sevkiyat, Ödeme Ekle, Kişi Ekle
- Sık kullanılan işlemlere tek tıkla erişim

#### 10.3 — Tema ve Görünüm
- Gece modu (karanlık tema)
- Font boyutu ayarı (sahada güneş altında büyük font)
- Kompakt/geniş görünüm seçimi

#### 10.4 — Çoklu Dil Desteği (Gelecek)
- Şu an Türkçe
- İleride Kürtçe veya İngilizce eklenebilir

---

## 📊 ÖNCELİK MATRİSİ

| Faz | İsim | Öncelik | Süre | İş Etkisi |
|-----|------|---------|------|-----------|
| 1 | Kritik Hata Düzeltmeleri | 🔴 ACİL | 1-2 gün | Veri bütünlüğü |
| 2 | Nakliyeci/Araç Yönetimi | 🟡 YÜKSEK | 2-3 gün | Hız kazandırır |
| 3 | Hızlı Sevkiyat Pro | 🟡 YÜKSEK | 3-4 gün | Sezon verimliliği |
| 4 | Finans Gelişmiş | 🟡 YÜKSEK | 3-4 gün | Nakit akış kontrolü |
| 5 | PDF Profesyonel | 🟠 ORTA | 2-3 gün | Profesyonel imaj |
| 6 | Dashboard Akıllı | 🟠 ORTA | 2-3 gün | Karar desteği |
| 7 | İletişim/Bildirim | 🟢 DÜŞÜK | 2 gün | Müşteri ilişkisi |
| 8 | Arama/Filtre | 🟢 DÜŞÜK | 1-2 gün | Kullanım kolaylığı |
| 9 | Güvenlik/Yedekleme | 🟠 ORTA | 1 gün | Veri güvenliği |
| 10 | UX İyileştirme | 🟢 DÜŞÜK | 2 gün | Kullanıcı memnuniyeti |

**Toplam tahmini süre: ~20-28 gün**

---

## 🗄️ YENİ TABLO ÖZETİ

### carriers (Nakliyeciler)
```sql
CREATE TABLE carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  phone2 TEXT,
  city TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### vehicles (Araçlar)
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  carrier_id UUID REFERENCES carriers(id),
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_type TEXT DEFAULT 'tir',
  capacity_ton NUMERIC(8,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### delivery_templates (Sevkiyat Şablonları)
```sql
CREATE TABLE delivery_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- "Ofis Hayv. ← Halil SAK (Arpa Samanı)"
  customer_id UUID REFERENCES contacts(id),
  supplier_id UUID REFERENCES contacts(id),
  feed_type_id UUID REFERENCES feed_types(id),
  customer_price NUMERIC(10,2),
  supplier_price NUMERIC(10,2),
  pricing_model TEXT DEFAULT 'nakliye_dahil',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🎯 HEMEN BAŞLANACAK (Claude Code Prompt)

Faz 1'i tamamlamak için Claude Code'a verilecek prompt aşağıdadır.
Bu dokümanı referans olarak kullan ve faz faz ilerle.

---

*Bu doküman Dedeağalar Grup PWA geliştirme sürecinde referans olarak kullanılacaktır.*
*Son güncelleme: 26 Şubat 2026*
