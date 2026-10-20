# Aşama 1 – Teknik Uygulama Planı

> Kapsam: ROADMAP sürüm 3.1, Aşama 1'in **teknik** kısmı (veri + tarama scriptleri).
> Müşteri bulma, hesap açma, para yatırma ve işletme katılımı bu planın dışında; Halil tarafından ayrı takip edilir.
> Hazırlanma: 21.10.2026 · Uygulama: VS Code'da

---

## 1. İlk teknik teslimatın tanımı

Teslimat tamam sayılır, eğer:

1. `import-settlements` scripti gerçek Destatis dosyasını okuyup belediye listesini üretiyor.
2. `scan` scripti bir proje tanımından görev planı çıkarıyor, **maliyet tahmini** veriyor ve tavanı aşan taramayı başlatmıyor.
3. Ayrıştırıcı ve plan mantığı **örnek yanıtlarla** test edilmiş; tüm testler geçiyor.
4. Gerekli ortam değişkenlerinin adları belgelenmiş.
5. **2 belediye × 2 keyword** küçük canlı deneme için maliyet tahmini hazır.

Canlı deneme bu teslimatın parçası değildir; anahtarlar gelince ayrı adım olarak yapılır (bölüm 8).

---

## 2. Doğrulanmış dış bilgiler

Aşağıdakiler 21.10.2026'da dokümandan kontrol edildi. Değerler değişebilir; ilk canlı denemede yanıttaki `cost` alanıyla tekrar doğrulanır.

### DataForSEO

| Konu | Bilgi | Kaynak |
| --- | --- | --- |
| Uç nokta | `POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced` | [Live Advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced.md) |
| Neden Advanced | Regular uç noktası yalnızca `featured_snippet`, `organic`, `paid` döndürür; `local_pack` için Advanced gerekir | [Live Regular](https://docs.dataforseo.com/v3/serp/google/organic/live/regular.md) |
| Konum | `location_coordinate = "enlem,boylam,yarıçap"`; enlem/boylam en fazla 7 ondalık; **yarıçap milimetre**, 199–199999 | aynı |
| Önemli | Bu yarıçap ölçüm noktasının hassasiyetidir (en fazla ~200 m). Hizmet alanı yarıçapıyla (km) **ilgisi yoktur**; kodda farklı adlarla tutulur | – |
| Diğer parametreler | `keyword`, `language_code: "de"`, `device: "mobile"`, `os: "android"`, `depth` (varsayılan 10, en fazla 200) | aynı |
| Ek ücretli parametreler | `load_async_ai_overview`, `calculate_rectangles`, `people_also_ask_click_depth`, `site:` gibi operatörler (×5). **Kullanılmaz.** | aynı |
| Yanıt | Üst seviye `status_code` (20000 = başarı), `cost`, `tasks[]`; görevde `id`, `status_code`, `status_message`, `cost`, `data`, `result[]`; sonuçta `items[]`, `item_types`, `check_url`, `datetime` | aynı |
| Öğe alanları | `organic`: type, rank_group, rank_absolute, position, domain, url, title · `paid`: type, rank_group, rank_absolute, position (top/bottom), domain, url, title · `local_pack`: type, rank_group, rank_absolute, title, domain, url, phone, is_paid, rating{value, votes_count}, cid | aynı |
| Belirsiz | Dokümana göre her `local_pack` öğesi tek bir işletme gibi görünüyor (iç içe `items` yok). **İlk canlı yanıtla doğrulanmalı.** | – |

### Fiyat

| Mod | 10 sonuçluk SERP başına | Not |
| --- | --- | --- |
| Standard queue | 0,0006 $ | ~5 dk, en fazla 45 dk |
| Priority queue | 0,0012 $ | ~1 dk |
| Live | 0,002 $ | ~6 sn |
| Derinlik | Her ek 10 sonuç +1 taban fiyat; yukarı yuvarlanır; dönmeyen sonuçlar iade | |

Kaynak: [DataForSEO fiyat sayfası](https://dataforseo.com/pricing/serp/google-organic-serp-api). Advanced'in Regular ile aynı fiyatta olduğu varsayılır; ilk canlı yanıttaki `cost` ile doğrulanır.

### Destatis Gemeindeverzeichnis

- Kaynak: [Statistikportal – Gemeindeverzeichnis](https://www.statistikportal.de/de/gemeindeverzeichnis) ("Alle politisch selbständigen Gemeinden mit ausgewählten Merkmalen", XLSX).
- **Doğrulanmadı:** Sayfa adı, başlık satırı ve sütun sırası. Script başlık metnine göre sütun bulmalı, sabit sütun numarasına güvenmemeli. Gerçek dosya indirildikten sonra ilk iş, sütun eşlemesini doğrulamak.
- Beklenen alanlar: Satzart (belediye satırları için `60`), Land/RB/Kreis/VB/Gem kodları (AGS bunlardan oluşur), Gemeindename, Bevölkerung insgesamt, Längengrad, Breitengrad. Sayılar Almanca biçimde olabilir (`8,6821`, `1.234`).

---

## 3. Dosya yapısı

```
scripts/
  import-settlements.ts     # XLSX → data/settlements.de.json (+ --db ile Neon'a upsert)
  scan.ts                   # proje tanımı → plan → maliyet → (onayla) → tarama
projects/
  pilot-rhein-main.json     # örnek proje tanımı (gerçek işletme verisi commit edilmez)
src/lib/
  geo.ts                    # haversine, yarıçap + nüfus seçimi
  plan.ts                   # görev planı, maliyet tahmini, tavan kontrolü
  dataforseo/
    client.ts               # HTTP istemcisi (Basic Auth, zaman aşımı, tekrar deneme)
    parse.ts                # yanıt → organic / ad / local_pack satırları
    types.ts                # yanıt tipleri (zod şemaları)
  runlog.ts                 # görev durumu kaydı (JSONL)
tests/
  fixtures/                 # örnek yanıtlar; dosya başında "sentetik, dokümandan" notu
  geo.test.ts
  plan.test.ts
  parse.test.ts
  runlog.test.ts
  import.test.ts
runs/                       # tarama çıktıları (gitignore)
data/                       # üretilen belediye verisi (gitignore)
```

Eklenecek paketler: `xlsx` (veya `exceljs`), `tsx`, `vitest`, `zod` (mevcut), `dotenv`.

---

## 4. Ortam değişkenleri

| Ad | Gerekli | Açıklama |
| --- | --- | --- |
| `DATAFORSEO_LOGIN` | canlı tarama | API kullanıcı adı |
| `DATAFORSEO_PASSWORD` | canlı tarama | API şifresi |
| `SCAN_MAX_USD` | evet | Tek taramanın harcama tavanı; tahmin bunu aşarsa tarama başlamaz |
| `SCAN_PRICE_PER_SERP_USD` | hayır | Varsayılan `0.002` (Live). Fiyat değişirse buradan güncellenir |
| `DATABASE_URL` | hayır | Yalnızca `--db` kullanılırsa |
| `ANTHROPIC_API_KEY` | hayır | Aşama 1'in sonraki adımı (rapor metni); bu teslimatta gerekmez |

Hesaba yatırılan tutar ile `SCAN_MAX_USD` ayrı şeylerdir: deposit hesabın bakiyesi, tavan tek bir taramanın üst sınırı. DataForSEO panelinde ayrıca günlük/aylık harcama limiti varsa o da açılır.

Anahtarlar sohbete veya repoya yazılmaz: yerelde `.env.local`, Vercel'de ortam değişkeni.

---

## 5. Modüller ve kabul ölçütleri

### 5.1 `import-settlements.ts`

```
npx tsx scripts/import-settlements.ts --file <xlsx> [--as-of 2024-12-31] [--db]
```

- Başlık satırını metne göre bulur; zorunlu sütunlardan biri yoksa **hata verip durur**.
- Yalnızca belediye satırlarını alır (Satzart 60).
- AGS = Land(2) + RB(1) + Kreis(2) + Gem(3) → 8 hane.
- Almanca sayı biçimini doğru çevirir.
- Koordinatı veya nüfusu eksik satırı **atlamaz, uydurmaz**: `scan_mode: "none"`, `scan_note: "koordinat yok"` ile kaydeder ve sayısını raporlar.
- Çıktı: `data/settlements.de.json` + özet (toplam, eyalet başına sayı, eksik koordinat sayısı).
- `--db`: `settlements` tablosuna AGS üzerinden upsert.

**Testler (`import.test.ts`):** küçük örnek XLSX fixture'ı ile başlık bulma, AGS oluşturma, sayı çevirme, eksik veri işaretleme, eksik sütunda hata.

### 5.2 `geo.ts`

- `haversineKm(a, b)`
- `selectSettlements({ center, radiusKm, populationMin, limit? })` → mesafeye göre sıralı liste; merkez dahil.
- `scan_mode = "none"` olanlar listede kalır ama "taranamadı" olarak işaretli döner.

**Testler:** bilinen iki nokta arası mesafe (ör. Frankfurt–Offenbach, kabaca 6–7 km; tolerans ±0,5 km), yarıçap sınırı, nüfus filtresi, sıralama.

### 5.3 `plan.ts`

Proje tanımı (`projects/*.json`):

```json
{
  "name": "pilot-rhein-main",
  "centerAgs": "06412000",
  "radiusKm": 30,
  "populationMin": 10000,
  "maxSettlements": 30,
  "device": "mobile",
  "depth": 20,
  "pointRadiusMm": 200,
  "keywords": [
    { "term": "Terrassenüberdachung", "type": "main", "samples": 3 },
    { "term": "Terrassenüberdachung mit Montage", "type": "intent", "samples": 1 }
  ],
  "targetDomains": []
}
```

- Görev = belediye × keyword × örneklem.
- `serpsPerTask = ceil(depth / 10)`.
- `estimateUsd = tasks × serpsPerTask × pricePerSerp × (1 + retryBuffer)`; `retryBuffer` varsayılan 0,2.
- `SCAN_MAX_USD` aşılırsa plan reddedilir; script tahmini ve tavanı yazdırıp çıkar.
- `--dry-run` her zaman çalışır ve API'ye istek atmaz.

**Testler:** görev sayısı, SERP yuvarlama (depth 15 → 2), maliyet formülü, tavan aşımında red, örneklem sayısı.

### 5.4 `dataforseo/client.ts`

- Basic Auth; istek başına zaman aşımı; ağ hatasında tanımlı sayıda tekrar deneme (varsayılan 2, artan bekleme).
- Eşzamanlılık sınırı (varsayılan 5).
- Her görev için ham yanıt `runs/<runId>/raw/<taskKey>.json` olarak saklanır.
- Gerçek maliyet yanıttaki `cost` alanından toplanır; tahminle karşılaştırılır.

**Testler:** HTTP katmanı taklit edilerek (fetch mock): başarı, `status_code` ≠ 20000, zaman aşımı, tekrar denemeden sonra başarı.

### 5.5 `dataforseo/parse.ts`

- `items` içinden `organic`, `paid`, `local_pack` türlerini ayırır; diğer türleri sayar ama satıra çevirmez.
- Satır: `type, rank (rank_group), rankAbsolute, domain, url, title`; `paid` için konum (üst/alt) varsa saklanır; `local_pack` için rating ve yorum sayısı.
- Domain normalleştirme: küçük harf, `www.` kaldırılır.
- Hedef domain bulunamazsa "taranan derinlikte bulunamadı" olarak işaretlenir; "görünmüyor" denmez.

**Testler (fixture'larla):** üç türün doğru ayrılması, sıra numaraları, `www` normalleştirme, boş `items`, `local_pack` olmayan yanıt, hata yanıtı.

### 5.6 `runlog.ts` – kayıt bütünlüğü

- Her görev için tek satır JSONL: `taskKey, ags, keyword, sample, status (success | error | cancelled), statusCode, attempts, costUsd, rawPath, startedAt, finishedAt`.
- Tarama sonunda özet:
  - **Kayıt bütünlüğü** = durumu kayıtlı görev / planlanan görev → **%100 olmalı**.
  - **Geçerli sonuç oranı** = kullanılabilir sonuç üreten görev / planlanan görev → hedef ≥ %98.
  - Tahmini maliyet ↔ gerçek maliyet.

**Testler:** eksik kayıt tespiti, oran hesapları, iptal edilen görevlerin sayılması.

### 5.7 `scan.ts`

```
npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --dry-run
npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --limit-settlements 2 --limit-keywords 2 --live
```

- Varsayılan dry-run; canlı istek için `--live` zorunlu.
- Çıktılar `runs/<tarih>-<proje>/`: `plan.json`, `runlog.jsonl`, `raw/`, `results.csv`, `summary.json`.
- Konsolda: belediye sayısı, görev sayısı, tahmini maliyet, gerçek maliyet, kayıt bütünlüğü, geçerli sonuç oranı, hedef domainlerin bulunduğu/bulunmadığı belediyeler.

---

## 6. Maliyet tahmini

Varsayımlar: Live mod, 0,002 $ / SERP, depth 20 (= 2 SERP / görev), %20 tekrar deneme payı, ana keyword 3 örneklem, diğerleri 1.

| Senaryo | Görev hesabı | Görev | SERP | Tahmin (payla) |
| --- | --- | --- | --- | --- |
| Küçük canlı deneme | 2 belediye × (ana 3 + 1 diğer) | 8 | 16 | **≈ 0,04 $** |
| Tek tam tarama | 30 belediye × (ana 3 + 4 diğer) | 210 | 420 | **≈ 1,01 $** |
| Değişkenlik ölçümü | tam tarama × 3 gün | 630 | 1.260 | **≈ 3,02 $** |
| İkinci ölçüm (karşılaştırma) | tam tarama × 1 | 210 | 420 | ≈ 1,01 $ |

Notlar:

- Aynı bölge ve aynı keywordler için bir tarama, o bölgedeki **tüm pilot işletmelere** hizmet eder; sıralama sonucu işletmeye göre değişmez. Farklı keyword setleri ek tarama gerektirir.
- Standard queue kullanılırsa SERP maliyeti yaklaşık üçte birine düşer, ama sonuçlar dakikalar sonra gelir; pilot için Live yeterli.
- Bu hesap yalnızca SERP'i kapsar. Sayfa taraması, LLM, depolama ve **raporu hazırlama/açıklama süresi** ayrıca kaydedilir (ROADMAP bölüm 8).
- Rakamlar tahmindir; küçük canlı denemedeki gerçek `cost` ile güncellenir.

---

## 7. Uygulama sırası (VS Code)

1. `git pull`, `npm install`, paketleri ekle (`tsx`, `vitest`, `xlsx`, `dotenv`).
2. `vitest` kurulumu, `npm test` scripti.
3. `geo.ts` + testler.
4. `plan.ts` + testler (dry-run maliyet tahmini burada çalışır hale gelir).
5. Örnek yanıt fixture'ları (dokümandaki alanlara göre, "sentetik" notuyla).
6. `parse.ts` + testler.
7. `runlog.ts` + testler.
8. `client.ts` + mock testler.
9. `scan.ts` (dry-run uçtan uca).
10. Gerçek Destatis dosyasını indir, sütun eşlemesini doğrula, `import-settlements.ts` + testler.
11. `scan.ts --dry-run` ile pilot projesinin gerçek belediye listesi ve maliyet tahmini.
12. Commit; testlerin ve dry-run çıktısının özeti.

Her adım ayrı commit. Testler geçmeden bir sonraki adıma geçilmez.

---

## 8. Küçük canlı deneme (anahtarlar geldikten sonra)

1. `.env.local`: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `SCAN_MAX_USD=0.20`.
2. `scan.ts --limit-settlements 2 --limit-keywords 2 --live`.
3. Kontrol listesi:
   - [ ] Gönderilen parametreler (koordinat, keyword, cihaz, dil, depth) ham yanıttaki `data` alanıyla aynı.
   - [ ] Kayıt bütünlüğü %100.
   - [ ] `local_pack` öğelerinin gerçek yapısı dokümanla uyumlu; değilse ayrıştırıcı düzeltilir.
   - [ ] Gerçek `cost` ile tahmin karşılaştırıldı; fiyat varsayımı güncellendi.
   - [ ] 5–10 sonuç ham yanıtla elle karşılaştırıldı.
   - [ ] Advanced uç noktasının fiyatı Regular ile aynı mı, doğrulandı.
4. Sorun yoksa tam pilot taramasına geçilir; varsa önce düzeltilir.

---

## 9. Bu planın dışında kalanlar (Halil)

- Pilot işletmelerle görüşme ve katılım (UG-ALU dahil adayların netleştirilmesi)
- DataForSEO hesabı, deposit ve panel harcama limiti
- Neon veritabanı (yalnızca `--db` kullanılacaksa)
- Pilot keywordlerinin işletmelerin gerçek hizmetlerine göre seçimi
