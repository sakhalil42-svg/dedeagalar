# İŞ AKIŞI REVİZE DOKÜMANI — Kaba Yem Ticaret

> Bu doküman uygulamanın gerçek iş mantığını ve UI yeniden tasarımını tanımlar.
> Claude Code'a bu dosyayı okutup tüm değişiklikleri yaptıracağız.

---

## GERÇEK İŞ MODELİ (Komisyoncu/Aracı)

```
1. MÜŞTERİ SİPARİŞ → 2. ÜRETİCİ TEDARİK → 3. PARÇA SEVK → 4. TAHSİLAT/ÖDEME
```

### Akış Detayı:
1. **Müşteriyle anlaşma**: 150 ton arpa samanı, 4 ₺/kg
2. **Üretici araştırma**: Birden fazla üreticiyi ara, fiyat+kalite karşılaştır
3. **Alım kararı**: En uygun üreticiyle anlaş
4. **Parça parça sevkiyat**: 150 ton tek seferde gelmiyor, kamyon kamyon geliyor
5. **Her sevkiyat kantar fişi ile**: kg bazlı tartım, gerçek miktar kaydı
6. **Nakliye ödeyen taraf değişken**: müşteri, ben veya üretici ödeyebilir
7. **Mal tamamlanınca tahsilat**: çek, havale, nakit — kısmi de olabilir
8. **Üreticiye ödeme**: peşin veya vadeli, çek/havale

### Fiyatlandırma Modelleri:

**Model A — Nakliye Dahil (üretici nakliye ayarlıyor):**
- Üretici fiyatı: 3,5 ₺/kg (nakliye dahil)
- Müşteri fiyatı: 4 ₺/kg
- 21.000 kg × 4 ₺ = 84.000 ₺ müşteri borcu
- Müşteri nakliye öderse: 84.000 - 15.000 = 69.000 ₺ bakiye

**Model B — Tır Üstü (ben nakliye ayarlıyorum):**
- Üretici fiyatı: 2,7 ₺/kg (sadece mal, nakliye hariç)
- Nakliyeyi ben ayarlıyorum, ödeyen taraf seçilebilir
- Müşteri nakliye öderse → bakiyeden düşülür
- Ben ödersem → maliyet olarak kalır

### Nakliye Ödeme Senaryoları:
| Senaryo | Müşteri Bakiyesi | Benim Maliyetim |
|---------|-----------------|-----------------|
| Müşteri nakliye ödüyor | Satış tutarı - nakliye | Değişmez |
| Ben nakliye ödüyorum | Satış tutarı (tam) | +Nakliye maliyeti |
| Üretici nakliye dahil | Satış tutarı (tam) | Fiyata dahil |

### Finansal Süreç:
- **Ödeme yöntemleri**: Nakit, Havale, Çek, Senet
- **Çek kullanımı yaygın** — özellikle büyük tutarlarda
- **Kısmi ödeme var** — parça parça ödeme/tahsilat
- **Vade**: Müşteri vadesiyle üretici vadesi yakın
- **Çoğu zaman**: Mal tamamlanınca tahsilat başlar

---

## VERİTABANI DEĞİŞİKLİKLERİ

### Mevcut purchases tablosuna eklenecek alan:
- `pricing_model`: 'nakliye_dahil' | 'tir_ustu' — fiyatlandırma modeli

### Mevcut sales tablosuna eklenecekler:
- `delivered_quantity`: Teslim edilen toplam (parça sevkiyatların toplamı)
- `is_freight_deducted`: boolean — nakliye müşteri bakiyesinden düşülecek mi

### Yeni tablo: deliveries (Sevkiyat/Kantar Fişleri)
```sql
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id),         -- hangi satışa ait
    purchase_id UUID REFERENCES purchases(id), -- hangi alıma ait
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ticket_no TEXT,                             -- kantar fişi numarası
    gross_weight NUMERIC(10,2),                -- brüt ağırlık (kg)
    tare_weight NUMERIC(10,2),                 -- dara ağırlık (kg)
    net_weight NUMERIC(10,2) NOT NULL,         -- net ağırlık (kg)
    vehicle_plate TEXT,                        -- araç plakası
    driver_name TEXT,                          -- şoför adı
    carrier_name TEXT,                         -- nakliyeci
    freight_cost NUMERIC(10,2) DEFAULT 0,      -- nakliye ücreti
    freight_payer TEXT DEFAULT 'customer',      -- 'customer' | 'me' | 'supplier'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Bu tablo şu anda shipments tablosunun yerini alacak — çünkü gerçek iş akışında "shipment" değil "kantar fişi bazlı sevkiyat" var.

---

## UI YENİDEN TASARIM

### Tasarım Konsepti
- **Ton**: Industrial/utilitarian — tarım ticareti uygulaması, temiz ve fonksiyonel
- **Renk paleti**: 
  - Primary: Koyu yeşil (#166534) — tarım/doğa
  - Accent: Amber (#d97706) — buğday/saman rengi
  - Danger: Kırmızı (#dc2626) — borç/gecikme
  - Success: Yeşil (#16a34a) — alacak/tamamlandı
  - Background: Açık krem (#fefce8) veya beyaz
- **Font**: Sistem fontu, büyük rakamlar için bold
- **Mobil öncelikli**: iPhone 15 (390px genişlik)
- **Bottom Tab Bar**: 5 sekme — Ana Sayfa, Satışlar, Alımlar, Kişiler, Finans

### Sayfa Yapısı Revizyonu:

#### 1. DASHBOARD (Ana Sayfa)
- Hoşgeldin + bugünün tarihi
- 4 KPI kartı (büyük rakamlar):
  - Aktif Satışlar (devam eden siparişler)
  - Bu Ay Ciro (₺)
  - Bekleyen Tahsilat (₺)
  - Bekleyen Ödemeler (₺)
- Yaklaşan vadeler (çek + ödeme, ilk 5)
- Son sevkiyatlar (son 5 kantar fişi)

#### 2. SATIŞLAR (Önce satış — ana iş akışı)
- Satış listesi (müşteri adı, yem türü, toplam miktar, teslim edilen, kalan, durum)
- **Durum çubuğu**: Sipariş → Sevkiyat Başladı → Tamamlandı
- Satış detay sayfası:
  - Üst kısım: müşteri, yem türü, toplam miktar, birim fiyat, toplam tutar
  - **Sevkiyat listesi**: Bu satışa ait tüm kantar fişleri (parça parça)
  - "Yeni Sevkiyat Ekle" butonu → kantar fişi formu
  - **İlerleme çubuğu**: 150 ton sipariş → 63 ton teslim edildi → %42
  - Nakliye özeti: toplam nakliye maliyeti, ödeyen taraf
  - Finansal özet: toplam tutar, nakliye düşümü, net bakiye, ödenen, kalan

#### 3. ALIMLAR
- Alım listesi (üretici, yem türü, model, miktar, fiyat, durum)
- Fiyatlandırma modeli seçimi: "Nakliye Dahil" veya "Tır Üstü"
- Alım detay → sevkiyatlar (kantar fişleri)

#### 4. KİŞİLER (Müşteri + Üretici)
- Kişi kartları: isim, tip (üretici/müşteri/her ikisi), şehir, bakiye
- Kişi detay: iletişim + cari hesap hareketleri + son işlemler

#### 5. FİNANS
- Cari hesap özeti (tüm bakiyeler)
- Ödeme/tahsilat kayıt
- Çek/senet takibi (vade takvimi)
- Kısmi ödeme desteği

### Yeni Satış Formu Akışı:
```
1. Müşteri seç
2. Yem türü seç
3. Toplam miktar (kg) gir
4. Birim fiyat (₺/kg) gir → toplam otomatik hesaplansın
5. Vade tarihi (opsiyonel)
6. Not ekle
7. Kaydet → Satış oluşturuldu, sevkiyat eklemeye başla
```

### Yeni Sevkiyat (Kantar Fişi) Formu:
```
1. Kantar fişi no
2. Tarih
3. Brüt ağırlık → Dara → Net (otomatik hesap)
4. Araç plakası
5. Nakliyeci adı
6. Nakliye ücreti (₺)
7. Nakliye ödeyen: Müşteri / Ben / Üretici
8. Kaydet → satışın teslim miktarı güncellenir
```

---

## CLAUDE CODE'A VERİLECEK TALİMAT

Yukarıdaki tüm değişiklikleri şu sırayla uygula:

### Adım 1: Veritabanı
- Supabase SQL Editor'de yeni migration çalıştır (deliveries tablosu + purchases/sales güncelleme)

### Adım 2: UI Yeniden Tasarım
- Renk paleti değiştir (tarım teması: yeşil + amber)
- Bottom tab bar güncelle (Ana Sayfa, Satışlar, Alımlar, Kişiler, Finans)
- Tüm sayfaları mobile-first yeniden tasarla

### Adım 3: İş Mantığı
- Satış → Sevkiyat (parça parça kantar fişi) akışı
- Nakliye ödeme senaryoları (müşteri/ben/üretici)
- Bakiye hesaplama (nakliye düşümü dahil)
- Fiyatlandırma modeli (nakliye dahil / tır üstü)

### Adım 4: Test
- npm run build başarılı olmalı
- Tüm formlar ve hesaplamalar doğru çalışmalı
