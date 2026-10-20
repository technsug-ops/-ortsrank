# Aşama 1 – Teknik Uygulama Planı

> Kapsam: ROADMAP sürüm 3.1, Aşama 1'in **teknik** kısmı (veri + tarama scriptleri).
> Müşteri bulma, hesap açma, para yatırma ve işletme katılımı bu planın dışında; Halil tarafından ayrı takip edilir.
> Hazırlanma: 21.10.2026 · Sürüm 1.1 · Uygulama: VS Code'da
>
> Sürüm 1.1: gerçek harcama tavanı (bütçe defteri), örnekleme oturumları, eksik koordinat ile eksik nüfusun ayrılması, deneme bazlı kayıt ve çakışmayan çalışma kimliği eklendi.

---

## 1. İlk teknik teslimatın tanımı

Teslimat tamam sayılır, eğer:

1. `import-settlements` scripti **gerçek Destatis dosyasını** okuyup belediye listesini üretiyor; eksik koordinat ve eksik nüfus ayrı raporlanıyor.
2. `scan` scripti bir proje tanımından görev planı çıkarıyor, **beklenen ve en kötü durum maliyetini** veriyor ve tavanı aşan taramayı başlatmıyor.
3. Bütçe defteri, örnekleme oturumları ve deneme bazlı kayıt **testlerle** gösterilmiş (bölüm 5).
4. Ayrıştırıcı ve plan mantığı **örnek yanıtlarla** test edilmiş; tüm testler geçiyor.
5. Gerekli ortam değişkenlerinin adları belgelenmiş.

**İlk teslimatta gösterilecekler:** test sonuçları, gerçek Destatis verisinden üretilmiş belediye listesinin özeti ve pilot projesinin dry-run çıktısı (belediye listesi, görev planı, maliyet tahmini).

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
  runlog.ts                 # deneme ve görev kayıtları (JSONL)
  budget.ts                 # bütçe defteri: reserved / confirmed / uncertain
tests/
  fixtures/                 # örnek yanıtlar; dosya başında "sentetik, dokümandan" notu
  geo.test.ts
  plan.test.ts
  parse.test.ts
  runlog.test.ts
  budget.test.ts
  sessions.test.ts
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
- Eksik veriyi **atlamaz, uydurmaz**. Eksik koordinat ile eksik nüfus ayrı ele alınır:

| Eksik bilgi | Kayıt | Sonuç |
| --- | --- | --- |
| Koordinat yok | `lat/lng = null`, `scan_mode: "none"`, `scan_note: "missing_coordinates"` | Konumdan tarama yapılamaz |
| Nüfus yok, koordinat var | `population = null`, `scan_mode: "coordinate"`, `scan_note: "missing_population"` | Teknik olarak taranabilir; nüfus filtresine uygunluğu belirsiz |
| İkisi de yok | `scan_mode: "none"`, `scan_note: "missing_coordinates,missing_population"` | Taranamaz |

- Çıktı: `data/settlements.de.json` + özet (toplam belediye, eyalet başına sayı, eksik koordinat sayısı, eksik nüfus sayısı, ikisi birden eksik sayısı).
- `--db`: `settlements` tablosuna AGS üzerinden upsert. Şemada `lat`, `lng`, `population` alanları bu durumlar için null kabul edecek şekilde güncellenir.

**Testler (`import.test.ts`):** küçük örnek XLSX fixture'ı ile başlık bulma, AGS oluşturma, sayı çevirme, üç eksik veri durumunun ayrı işaretlenmesi, özet sayıları, eksik sütunda hata.

### 5.2 `geo.ts`

- `haversineKm(a, b)`
- `selectSettlements({ center, radiusKm, populationMin, limit? })` dört ayrı liste döndürür:

| Liste | İçerik | Taranır mı |
| --- | --- | --- |
| `selected` | Koordinatı var, yarıçap içinde, nüfus ≥ eşik; mesafeye göre sıralı, merkez dahil | Evet |
| `unknownPopulation` | Koordinatı var, yarıçap içinde, nüfusu bilinmiyor | Varsayılan hayır; `--include-unknown-population` ile evet, raporda işaretli |
| `unlocatable` | Koordinatı yok; yarıçap içinde olup olmadığı hesaplanamıyor | Hayır; raporda "konumu belirlenemeyen kayıtlar" olarak listelenir |
| `belowThreshold` | Yarıçap içinde, nüfus < eşik | Hayır; yalnızca sayısı raporlanır |

Koordinatı olmayan bir belediye yarıçap listesine **konmaz**; bölgenin içinde olup olmadığı bilinemez.

**Testler:** bilinen iki nokta arası mesafe (ör. Frankfurt–Offenbach, kabaca 6–7 km; tolerans ±0,5 km), yarıçap sınırı, nüfus filtresi, sıralama, dört listenin doğru ayrılması, koordinatsız kaydın `selected`'a girmemesi.

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

- Görev = belediye × keyword × örneklem. Her örneklem ayrı bir **oturuma** aittir (bölüm 5.7).
- `serpsPerTask = ceil(depth / 10)`; `costPerAttempt = serpsPerTask × pricePerSerp`.
- `maxAttempts = 1 + maxRetries` (varsayılan `maxRetries = 2`, yani en fazla 3 deneme).
- İki ayrı tahmin üretilir ve ikisi de yazdırılır:
  - **Beklenen maliyet** = `tasks × costPerAttempt × (1 + expectedRetryRate)`; `expectedRetryRate` varsayılan 0,2. Bu, görevlerin yaklaşık %20'sinin bir kez tekrar edileceği varsayımıdır; tekrar sayısı sınırı değildir.
  - **En kötü durum** = `tasks × costPerAttempt × maxAttempts`.
- Başlangıç kuralı: beklenen maliyet `SCAN_MAX_USD`'yi aşarsa plan reddedilir. En kötü durum tavanı aşıyorsa uyarı verilir; tarama yine başlayabilir, çünkü tavan çalışma sırasında bütçe defteriyle zorlanır (5.4).
- `--dry-run` her zaman çalışır ve API'ye istek atmaz.

**Testler:** görev sayısı, SERP yuvarlama (depth 15 → 2), iki maliyet formülü, beklenen tavanı aşınca red, en kötü durum uyarısı, örneklem → oturum ataması.

### 5.4 `dataforseo/client.ts`

- Basic Auth; istek başına zaman aşımı; tanımlı sayıda tekrar deneme (varsayılan `maxRetries = 2`, artan bekleme).
- Eşzamanlılık sınırı (varsayılan 5).
- Her **deneme** ayrı saklanır: `runs/<runId>/raw/<taskKey>/attempt-<n>.json` (yanıt gelmediyse hata bilgisiyle birlikte boş gövde). Tekrar denemeler önceki dosyanın üzerine yazmaz.

**Bütçe defteri (gerçek tavan)**

Tavan yalnızca başlangıçta değil, **her istekten önce** uygulanır.

| Kalem | Anlamı |
| --- | --- |
| `reserved` | Gönderilmiş, yanıtı beklenen denemeler için ayrılan tutar (`costPerAttempt` kadar) |
| `confirmed` | Yanıttaki `cost` alanıyla doğrulanmış harcama |
| `uncertain` | Zaman aşımı, bağlantı kopması veya yanıtta `cost` olmayan denemeler. **Ücretlendirilmiş sayılır** (`costPerAttempt`), çünkü sağlayıcı isteği işlemiş olabilir |
| `remaining` | `SCAN_MAX_USD − confirmed − uncertain − reserved` |

Kurallar:

1. Bir deneme gönderilmeden önce `remaining ≥ costPerAttempt` kontrol edilir ve tutar `reserved`'a alınır. Eşzamanlı istekler bu ayırma üzerinden yarışmadan bütçe kullanır.
2. Yanıt gelince ayrılan tutar `confirmed`'a (gerçek `cost` ile) veya `uncertain`'a taşınır.
3. Bütçe yetmiyorsa yeni deneme gönderilmez. Kalan görevler `cancelled` durumuyla ve `reason: "budget_exhausted"` gerekçesiyle kaydedilir.
4. Tarama sonunda `confirmed + uncertain ≤ SCAN_MAX_USD` her koşulda sağlanır.

**Testler (`budget.test.ts`, mock'lu istemci):** HTTP katmanı taklit edilerek (fetch mock): başarı, `status_code` ≠ 20000, zaman aşımı, tekrar denemeden sonra başarı. Bütçe defteri için: eşzamanlı isteklerde tavanın aşılmaması, zaman aşımının `uncertain` sayılması, bütçe bitince kalan görevlerin gerekçeyle iptali, tekrar denemelerin ayrı dosyalara yazılması.

### 5.5 `dataforseo/parse.ts`

- `items` içinden `organic`, `paid`, `local_pack` türlerini ayırır; diğer türleri sayar ama satıra çevirmez.
- Satır: `type, rank (rank_group), rankAbsolute, domain, url, title`; `paid` için konum (üst/alt) varsa saklanır; `local_pack` için rating ve yorum sayısı.
- Domain normalleştirme: küçük harf, `www.` kaldırılır.
- Hedef domain bulunamazsa "taranan derinlikte bulunamadı" olarak işaretlenir; "görünmüyor" denmez.

**Testler (fixture'larla):** üç türün doğru ayrılması, sıra numaraları, `www` normalleştirme, boş `items`, `local_pack` olmayan yanıt, hata yanıtı.

### 5.6 `runlog.ts` – kayıt bütünlüğü

İki ayrı kayıt tutulur:

- `attempts.jsonl` – her deneme için bir satır: `attemptId, taskKey, attempt (1..n), sentAt, receivedAt, outcome (ok | api_error | timeout | network_error), statusCode, statusMessage, costUsd, costCertainty (confirmed | uncertain), rawPath`.
- `tasks.jsonl` – her görev için bir satır: `taskKey, ags, keyword, sample, session, plannedAt, status (success | error | cancelled), reason, attemptIds[], finalAttemptId, totalCostUsd`.

Görev özeti denemelere `attemptIds` ile bağlanır; her denemenin maliyeti ve hatası ayrı görülür.

Tarama sonunda özet:

- **Kayıt bütünlüğü** = durumu kayıtlı görev / planlanan görev → **%100 olmalı**.
- **Geçerli sonuç oranı** = kullanılabilir sonuç üreten görev / planlanan görev → hedef ≥ %98.
- Maliyet: beklenen, en kötü durum, `confirmed`, `uncertain`, toplam deneme sayısı.

**Testler:** eksik kayıt tespiti, oran hesapları, iptal edilen görevlerin gerekçesiyle sayılması, bir görevin birden fazla denemesinin doğru bağlanması, toplam maliyetin denemelerin toplamına eşit olması.

### 5.7 Örnekleme oturumları

`samples: 3`, aynı görevin üç kez peş peşe çalıştırılması anlamına gelmez. Her örneklem ayrı bir oturumdur ve ayrı çalıştırılır.

- Proje tanımına oturum zamanları eklenir:

```json
"sessions": [
  { "id": 1, "plannedAt": "09:00" },
  { "id": 2, "plannedAt": "13:00" },
  { "id": 3, "plannedAt": "18:00" }
]
```

- `scan.ts --session <id>` yalnızca o oturuma ait görevleri çalıştırır. Örneklem 1 tüm keywordler için oturum 1'e, örneklem 2 ve 3 yalnızca ana keyword için oturum 2 ve 3'e düşer.
- Her görevin `plannedAt` ve gerçek `sentAt` değeri kaydedilir. Planlanandan ±60 dakikadan fazla sapan oturum özette işaretlenir.
- Bir oturumun tamamı aynı keyword, koordinat, cihaz, dil ve derinlikle çalışır (ROADMAP dönem karşılaştırma şartları).
- Oturumlar elle veya zamanlanmış görevle başlatılabilir; Aşama 1'de elle başlatmak yeterli.

**Küçük canlı denemede istisna:** Oturumlar peş peşe çalıştırılabilir (`--sessions all --back-to-back`). Bu durumda özete `samplingMode: "technical_validation"` yazılır ve sonuçlar **reklam görülme sıklığı olarak kullanılmaz**; yalnızca teknik doğrulamadır.

**Testler:** örneklem → oturum ataması, `--session` filtresi, sapma işaretleme, `technical_validation` modunda sıklık hesabının yapılmaması.

### 5.8 `scan.ts`

```
npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --dry-run
npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --session 1 --live
npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --limit-settlements 2 --limit-keywords 2 --sessions all --back-to-back --live
```

- Varsayılan dry-run; canlı istek için `--live` zorunlu.
- **Çalışma kimliği** (`runId`) çakışmaz: `<YYYYMMDD-HHMMSS>-<proje>-<rastgele 6 karakter>`. Aynı gün aynı proje için yapılan iki tarama ayrı klasöre yazılır; klasör zaten varsa script durur.
- Bir taramanın oturumları aynı `scanId` altında toplanır; her oturum çalıştırması kendi `runId`'sini alır.
- Çıktılar `runs/<runId>/`: `plan.json`, `attempts.jsonl`, `tasks.jsonl`, `budget.json`, `raw/<taskKey>/attempt-<n>.json`, `results.csv`, `summary.json`.
- Konsolda: belediye sayısı, görev sayısı, tahmini maliyet, gerçek maliyet, kayıt bütünlüğü, geçerli sonuç oranı, hedef domainlerin bulunduğu/bulunmadığı belediyeler.

---

## 6. Maliyet tahmini

Varsayımlar: Live mod, 0,002 $ / SERP, depth 20 (= 2 SERP / deneme = 0,004 $), beklenen tekrar oranı %20, en fazla 3 deneme, ana keyword 3 örneklem, diğerleri 1. Fiyat doğrulanmış değil; ilk canlı yanıttaki `cost` ile karşılaştırılır.

| Senaryo | Görev hesabı | Görev | Beklenen | En kötü durum (3 deneme) |
| --- | --- | --- | --- | --- |
| Küçük canlı deneme | 2 belediye × (ana 3 + 1 diğer) | 8 | **≈ 0,04 $** (0,0384) | 0,096 $ |
| Tek tam tarama | 30 belediye × (ana 3 + 4 diğer) | 210 | **≈ 1,01 $** (1,008) | 2,52 $ |
| Değişkenlik ölçümü | tam tarama × 3 gün | 630 | ≈ 3,02 $ | 7,56 $ |
| İkinci ölçüm (karşılaştırma) | tam tarama × 1 | 210 | ≈ 1,01 $ | 2,52 $ |

Küçük canlı deneme için önerilen tavan: `SCAN_MAX_USD=0.20` (en kötü durumun üstünde). Tam tarama için: `SCAN_MAX_USD=3.00`.

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
4. `plan.ts` + testler (beklenen ve en kötü durum maliyeti, oturum ataması).
5. Örnek yanıt fixture'ları (dokümandaki alanlara göre, "sentetik" notuyla).
6. `parse.ts` + testler.
7. `runlog.ts` + testler (deneme ve görev kayıtları ayrı).
8. Bütçe defteri + testler (eşzamanlılık, `uncertain`, bütçe bitince iptal).
9. `client.ts` + mock testler (deneme başına ayrı ham dosya).
10. `scan.ts` (dry-run uçtan uca; `runId` çakışmazlığı, `--session` filtresi).
11. Şemada `lat`, `lng`, `population` alanlarını null kabul edecek şekilde güncelle; migration'ı yeniden üret.
12. Gerçek Destatis dosyasını indir, sütun eşlemesini doğrula, `import-settlements.ts` + testler.
13. `scan.ts --dry-run` ile pilot projesinin gerçek belediye listesi (dört liste) ve maliyet tahmini.
14. Commit; testlerin, belediye listesi özetinin ve dry-run çıktısının özeti.

Her adım ayrı commit. Testler geçmeden bir sonraki adıma geçilmez.

---

## 8. Küçük canlı deneme (anahtarlar geldikten sonra)

1. `.env.local`: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `SCAN_MAX_USD=0.20`.
2. `scan.ts --limit-settlements 2 --limit-keywords 2 --sessions all --back-to-back --live`.
3. Kontrol listesi:
   - [ ] Gönderilen parametreler (koordinat, keyword, cihaz, dil, depth) ham yanıttaki `data` alanıyla aynı.
   - [ ] Kayıt bütünlüğü %100; her deneme ayrı dosyada.
   - [ ] `confirmed + uncertain ≤ SCAN_MAX_USD`; bütçe defteri yanıtlardaki `cost` toplamıyla tutarlı.
   - [ ] Özette `samplingMode: "technical_validation"` yazıyor; reklam sıklığı hesaplanmadı.
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
