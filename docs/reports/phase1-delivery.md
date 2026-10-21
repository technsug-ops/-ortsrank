# Aşama 1 – İlk teknik teslimat raporu

> Tarih: 21.10.2026 · Kapsam: [PHASE1_PLAN.md](../PHASE1_PLAN.md) sürüm 1.2, bölüm 7 adım 1–13
> Bu rapordaki her rakam gerçek komut çıktısından alınmıştır (bölüm 8 kuralı). Canlı DataForSEO isteği yapılmadı; canlı deneme bölüm 9'a göre ayrı adımdır.

## Teslimat tanımına göre durum (plan bölüm 1)

| # | Ölçüt | Durum |
| --- | --- | --- |
| 1 | `import-settlements` gerçek Destatis dosyasını okuyor; eksik koordinat ve eksik nüfus ayrı raporlanıyor | Tamam – bölüm 2 |
| 2 | `scan` görev planı, beklenen ve en kötü durum maliyeti veriyor; tavanı aşan taramayı başlatmıyor | Tamam – bölüm 3; tavan reddi testle gösterildi (`exit 2`, istek yok) |
| 3 | Bütçe defteri, örnekleme oturumları, deneme bazlı kayıt testlerle gösterildi | Tamam – bölüm 1 |
| 4 | Ayrıştırıcı ve plan mantığı örnek yanıtlarla test edildi; tüm testler geçiyor | Tamam – 229/229 |
| 5 | Ortam değişkenlerinin adları belgelendi | Tamam – plan bölüm 4; `scripts/scan.ts` kullanım metni |

---

## 1. Test özeti

Komut: `npx vitest run --reporter=json` (vitest 5.0.5, Node 24.18.1). Ek kontroller: `npx tsc --noEmit` hatasız, `npm run lint` hatasız, `npm run build` başarılı (adım 11'de).

**Toplam 229 test · 229 geçti · 0 başarısız · 0 atlandı**

| Dosya | Test | Geçen | Konu |
| --- | --- | --- | --- |
| `tests/budget.test.ts` | 18 | 18 | Bütçe defteri |
| `tests/client.test.ts` | 16 | 16 | HTTP istemcisi (fetch mock), uçtan uca bütçe |
| `tests/fixtures.test.ts` | 25 | 25 | Sentetik yanıtların kendi tutarlılığı |
| `tests/geo.test.ts` | 12 | 12 | Mesafe, dört liste |
| `tests/i18n.test.ts` | 2 | 2 | DE/EN/TR sözlük anahtarları |
| `tests/import.test.ts` | 41 | 41 | Destatis içe aktarma |
| `tests/parse.test.ts` | 28 | 28 | Yanıt ayrıştırıcı |
| `tests/plan.test.ts` | 30 | 30 | Görev planı, maliyet, tavan |
| `tests/runlog.test.ts` | 19 | 19 | Deneme/görev kayıtları, oturum sapması |
| `tests/scan-run.test.ts` | 35 | 35 | `scan.ts` uçtan uca |
| `tests/schema.test.ts` | 3 | 3 | Şemada null alanlar |

**Planın özellikle istediği senaryolar**

| Senaryo | Test (dosya › ad) | Sonuç |
| --- | --- | --- |
| Eşzamanlı bütçe kullanımı | budget › cap › *does not exceed the cap with concurrent requests* – 12 eşzamanlı istek, bütçe 5'e yetiyor: 5 gönderildi, 7 `budget_exhausted`, kalan hiçbir an < 0 | Geçti |
| Oturumlar arası bütçe koruması | budget › *session 2 of the same scan can only use what session 1 left* · scan-run › main › *two sessions of one scan share the budget* (iki ayrı `runId`, tek defter) | Geçti |
| Yeniden başlatma | budget › *after an interrupted run, reads earlier spending and charges open reservations as uncertain* – önceki `confirmed` okunuyor, askıda kalan iki ayırma `uncertain` (`interrupted_run`) sayılıyor | Geçti |
| Beklenenden yüksek ücret | budget › *records the full cost, logs the deviation, stops new attempts and reports the overrun* · client › *provider charges twice the estimate: full cost recorded, no new requests, rest cancelled, overrun reported* · client › *requests already in flight when the price jumps are still recorded in full* · budget › *stays halted after restart with the same price; a new price clears the halt* | Geçti |

Diğer plan maddeleri de testli: zaman aşımının `uncertain` sayılması, tekrar denemelerin ayrı ham dosyalara yazılması, bütçe bitince kalan görevlerin `budget_exhausted` ile iptali ve kayıt bütünlüğünün yine %100 kalması, `technical_validation` modunda reklam sıklığı hesaplanmaması, oturum saat sapması (Europe/Berlin, ±60 dk), gönderilen parametre ↔ yanıttaki `data` eşleşmesi.

**Sınır:** DataForSEO yanıt fixture'ları dokümana göre hazırlanmış sentetik örneklerdir (`tests/fixtures/dataforseo/`, her dosyada `_fixture.synthetic: true`). `local_pack` yapısı ve gerçek `cost` ilk canlı denemede doğrulanacak.

---

## 2. Destatis verisi

| | |
| --- | --- |
| Dosya | `31122025_Auszug_GV.xlsx` – „Alle politisch selbständigen Gemeinden (mit Gemeindeverband) in Deutschland" |
| Kaynak | [destatis.de › Gemeindeverzeichnis › GVAuszugJ › 31122025](https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugJ/31122025_Auszug_GV.html) |
| Yayın | Erscheinungsmonat August 2026 (dosyanın „Inhalt" sayfası) |
| Gebietsstand | 31.12.2025 |
| Nüfus referans tarihi | 31.12.2025, Zensus 2022 temelli |
| Koordinat atama durumu | Zuordnungsstand 31.12.2024 (dosya başlığı) |
| SHA-256 | `5bfb8b7a5ce0dc65988ff30b28146ec2f08dd0b29756c9c8c427cbd7baa00e79` |
| Komut | `npx tsx scripts/import-settlements.ts --file data/source/31122025_Auszug_GV.xlsx --db` |

**Sonuç**

| | Sayı |
| --- | --- |
| İçe aktarılan belediye (Satzart 60) | **10.751** |
| Eksik koordinat | 0 |
| Eksik nüfus | 0 |
| İkisi birden eksik | 0 |
| Hariç tutulan gemeindefreie Gebiete (Textkennzeichen 65/66) | 202 (65: 2 – Lohheide, Osterheide; 66: 200) |
| Eyalet | 16 |

Eyalet başına: Schleswig-Holstein 1104 · Hamburg 1 · Niedersachsen 939 · Bremen 2 · Nordrhein-Westfalen 396 · Hessen 421 · Rheinland-Pfalz 2300 · Baden-Württemberg 1101 · Bayern 2056 · Saarland 52 · Berlin 1 · Brandenburg 413 · Mecklenburg-Vorpommern 724 · Sachsen 418 · Sachsen-Anhalt 218 · Thüringen 605.

Çıktı `data/settlements.de.json` (gitignore) ve Neon `settlements` tablosu (10.751 satır; ikinci çalıştırma çoğaltmadı).

**Sütun eşlemesi nasıl doğrulandı**

1. Dosya `exceljs` ile açıldı; iki sayfa var: `Inhalt` ve `Onlineprodukt_Gemeinden31122025` (16.018 satır × 20 sütun).
2. İlk 12 satır ham olarak incelendi. Başlık 3.–5. satırlara yayılıyor: üst başlık („Amtlicher Regionalschlüssel (ARS)", „Bevölkerung auf Grundlage des Zensus 20222)", „Geografische Mittelpunktkoordinaten"), alt başlık („Land | RB | Kreis | VB | Gem", „insgesamt", „Längengrad | Breitengrad"), tarih satırı. Etiketlerde dipnot rakamları var.
3. Script sütunları bu metinlere göre buluyor (sabit numara yok); bulunan eşleme her çalıştırmada yazdırılıyor:
   - Satzart = sütun 1, Textkennzeichen = 2
   - AGS = Land (3) + RB (4) + Kreis (5) + Gem (7) → 8 hane; VB (6) AGS'ye girmez
   - Gemeindename = 8 · Bevölkerung insgesamt = 10 · Längengrad = 15 · Breitengrad = 16
4. Satzart dağılımı sayıldı (10: 16, 20: 29, 30: 12, 40: 400, 50: 4.590, 60: 10.953). 60 içindeki Textkennzeichen değerleri ayrıca incelendi; 65/66'nın gemeindefreie Gebiete olduğu satır adlarından doğrulandı („Sachsenwald (Forstgutsbez.),gemfr.Geb.", „Lohheide, gemfr. Bezirk").
5. Bilinen değerlerle karşılaştırma: Frankfurt am Main 06412000 · 760.656 · 50,11088 / 8,682433 · Offenbach am Main 06413000 · 133.195 · Hanau 06435014 · Oberursel 06434008 (Kreis: Hochtaunuskreis) · Berlin 11000000 · 3.700.577 · Hamburg 02000000 · 1.869.473. Hessen'deki belediye sayısı 421.
6. Testte sütunların yeri değiştirildiğinde de doğru bulunduğu, zorunlu bir sütun eksikse içe aktarmanın durduğu gösterildi.

**Karar:** gemeindefreie Gebiete belediye değildir (ROADMAP 4: ölçüm birimi siyasi olarak bağımsız belediyedir). Listeye alınmadılar, özetle adlarıyla raporlanıyorlar. Kaynak dosyada koordinatı eksik olan 3 satırın üçü de bu gruptadır.

---

## 3. Dry-run çıktısı (pilot)

Komut: `SCAN_MAX_USD=3.00 npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --dry-run`
Çalıştırma: `20261021-035707-pilot-rhein-main-b22ad1` · tarama `20261021-pilot-rhein-main` · API isteği yok.

| Ayar | Değer |
| --- | --- |
| Merkez | Frankfurt am Main, Stadt (06412000), 50,11088 / 8,682433 |
| Yarıçap | 30 km |
| Nüfus eşiği | ≥ 10.000 |
| En fazla belediye | 30 |
| Cihaz / derinlik / nokta yarıçapı | mobile (android) / 20 / 200 mm |

**Seçilen belediyeler (30)**

| # | Belediye | AGS | Mesafe (km) | Nüfus |
| --- | --- | --- | --- | --- |
| 1 | Frankfurt am Main, Stadt | 06412000 | 0,0 | 760.656 |
| 2 | Offenbach am Main, Stadt | 06413000 | 5,9 | 133.195 |
| 3 | Neu-Isenburg, Hugenotten- und Waldenserstadt | 06438009 | 6,3 | 38.236 |
| 4 | Eschborn, Stadt | 06436003 | 8,8 | 22.478 |
| 5 | Bad Vilbel, Stadt | 06440003 | 8,8 | 35.886 |
| 6 | Steinbach (Taunus), Stadt | 06434010 | 10,1 | 10.827 |
| 7 | Dreieich, Stadt | 06438002 | 10,4 | 41.965 |
| 8 | Heusenstamm, Stadt | 06438005 | 10,5 | 19.397 |
| 9 | Mühlheim am Main, Stadt | 06438008 | 11,0 | 29.213 |
| 10 | Schwalbach am Taunus, Stadt | 06436011 | 11,2 | 15.474 |
| 11 | Maintal, Stadt | 06435019 | 11,9 | 39.130 |
| 12 | Kelsterbach, Stadt | 06433007 | 12,2 | 16.762 |
| 13 | Oberursel (Taunus), Stadt | 06434008 | 12,3 | 46.757 |
| 14 | Obertshausen, Stadt | 06438010 | 12,6 | 25.381 |
| 15 | Dietzenbach, Kreisstadt | 06438001 | 13,4 | 35.458 |
| 16 | Bad Soden am Taunus, Stadt | 06436001 | 13,4 | 23.096 |
| 17 | Langen (Hessen), Stadt | 06438006 | 13,5 | 39.009 |
| 18 | Bad Homburg v. d. Höhe, Stadt | 06434001 | 14,0 | 56.938 |
| 19 | Kronberg im Taunus, Stadt | 06434006 | 14,4 | 18.577 |
| 20 | Hattersheim am Main, Stadt | 06436005 | 14,7 | 28.820 |
| 21 | Karben, Stadt | 06440012 | 14,7 | 22.486 |
| 22 | Kriftel | 06436009 | 15,6 | 11.402 |
| 23 | Schöneck | 06435026 | 15,8 | 11.793 |
| 24 | Egelsbach | 06438003 | 15,8 | 11.002 |
| 25 | Friedrichsdorf, Philipp-Reis-Stadt | 06434002 | 16,5 | 26.054 |
| 26 | Kelkheim (Taunus), Stadt | 06436008 | 16,6 | 28.041 |
| 27 | Hanau, Brüder-Grimm-Stadt | 06435014 | 16,8 | 98.582 |
| 28 | Hofheim am Taunus, Kreisstadt | 06436007 | 17,0 | 39.149 |
| 29 | Mörfelden-Walldorf, Stadt | 06433008 | 17,1 | 31.441 |
| 30 | Rodgau, Stadt | 06438011 | 17,4 | 45.197 |

**Diğer listeler**

| Liste | Sayı |
| --- | --- |
| `unknownPopulation` | 0 |
| `unlocatable` | 0 |
| `belowThreshold` (30 km içinde, < 10.000) | 23 |
| `overLimit` (şartları sağlıyor, üst sınır 30 dolu) | 36 – en yakını Königstein im Taunus 17,4 km; aralarında Rüsselsheim am Main 23,3 km (66.028), Darmstadt 26,6 km (168.253), Friedberg (Hessen) 25,7 km, Bad Nauheim 28,3 km |

**Keywordler ve oturumlar**

| Keyword | Tür | Örneklem |
| --- | --- | --- |
| Terrassenüberdachung | main | 3 |
| Terrassenüberdachung mit Montage | intent | 1 |

| Oturum | Saat | Görev |
| --- | --- | --- |
| 1 | 09:00 | 60 |
| 2 | 13:00 | 30 |
| 3 | 18:00 | 30 |

**Maliyet**

| | |
| --- | --- |
| Görev | 120 |
| SERP / deneme | 2 (depth 20) × 0,002 $ = 0,004 $ |
| Beklenen (tekrar oranı %20) | **0,576 $** |
| En kötü durum (3 deneme) | **1,44 $** |
| Tavan (`SCAN_MAX_USD`) | 3,00 $ → `ok` |

**Gözlem:** 30 km ve ≥ 10.000 nüfusta 66 belediye şartı sağlıyor; üst sınır 30 olduğu için seçim 17,4 km'de bitiyor. Pilot alanı kararı açık ([STATUS](../STATUS.md), iş hattı). Projede şu an 2 keyword var; plandaki 3–5 keyword (ör. ana 3 örneklem + 4 diğer) ile 30 belediyede 210 görev, beklenen ≈ 1,01 $, en kötü durum 2,52 $ olur (plan bölüm 6).

---

## 4. Değişen dosyalar ve commitler

Aralık `87e668d..aaa3398` (bu rapor ayrı commit'tir). `package-lock.json` hariç 52 dosya, +8.448 / −84 satır.

**Kod**

| Dosya | Açıklama |
| --- | --- |
| `src/lib/geo.ts` | Haversine; `selected`, `unknownPopulation`, `unlocatable`, `belowThreshold`, `overLimit` |
| `src/lib/plan.ts` | Proje doğrulama (zod), görevler, oturum ataması, maliyet, tavan kontrolü |
| `src/lib/scan-defaults.ts` | Tüm varsayılanlar ve sağlayıcı sınırları (tek kaynak) |
| `src/lib/dataforseo/types.ts`, `parse.ts` | Yanıt şeması ve ayrıştırıcı |
| `src/lib/dataforseo/client.ts` | HTTP istemcisi, deneme başına ham dosya, parametre eşleşme kontrolü |
| `src/lib/runlog.ts` | `attempts.jsonl` / `tasks.jsonl`, özet, oturum sapması |
| `src/lib/budget.ts` | Tarama başına kalıcı bütçe defteri, kilit |
| `src/lib/scan-run.ts`, `scripts/scan.ts` | Tarama akışı ve CLI |
| `src/lib/settlements.ts` | Belediye dosyası şeması |
| `src/lib/destatis.ts`, `src/lib/import-settlements.ts`, `scripts/import-settlements.ts` | Destatis içe aktarma |
| `src/db/schema.ts`, `drizzle/0001_nullable_settlement_data.sql` | Null alanlar, migration (Neon'a uygulandı) |
| `projects/pilot-rhein-main.json` | Pilot proje tanımı (gerçek işletme verisi yok) |
| `vitest.config.mts`, `tests/**` | Test kurulumu, 11 test dosyası, sentetik fixture'lar |

Ayrıca bu dönemde: Impressum sayfası (`src/app/[lang]/impressum`, `src/config/operator.ts`, ortak header/footer), ROADMAP 3.3 ve WUA belgesi (sohbetten), STATUS/CLAUDE.md güncellemeleri.

**Commitler**

| Commit | Mesaj |
| --- | --- |
| `4874f4d` | Phase 1 step 1 (partial): add tsx, vitest, dotenv |
| `23b8618` | Phase 1 step 1: add exceljs for Destatis XLSX import |
| `b17f0f2` | Phase 1 step 2: vitest setup and npm test |
| `37b2097` | Phase 1 step 3: geo.ts with haversine and settlement selection |
| `c331e64` | Phase 1 step 4: plan.ts with tasks, sessions, cost estimate and cap check |
| `38842ef` | Phase 1 step 5: synthetic DataForSEO response fixtures |
| `bbad96a` | STATUS: record commit hashes for steps 1, 4 and 5 |
| `17a3807` | Phase 1 step 6: DataForSEO response schema and parser |
| `7f9dc03` | ROADMAP 3.3: Reklam ve Ciro Analizi (WUA) modülü; veri ihtiyaç belgesi 1.1 |
| `51bd25a` | STATUS: commit hash |
| `56c1171` | Merge origin/main (ROADMAP 3.3 from chat) into phase 1 steps 1-6 |
| `2874124` | Docs: fixes on top of ROADMAP 3.3 merge |
| `b9034fe` | STATUS: GitHub connected, first production deploy live |
| `a58d027` | Add Impressum page (DE/EN/TR) |
| `768b2f0` | Phase 1 step 7: runlog.ts with attempt and task records |
| `38c2c49` | Phase 1 step 8: budget ledger shared per scan |
| `0209348` | Phase 1 step 9: DataForSEO client with mocked HTTP tests |
| `0bd7d5c` | Phase 1 step 10: scan.ts end to end (dry-run default) |
| `931d900` | Phase 1 step 11: nullable settlement data and serp_results.domain |
| `75739d4` | Apply migrations to Neon; add npm run db:migrate |
| `10be488` | Phase 1 step 12: import the Destatis Gemeindeverzeichnis |
| `aaa3398` | STATUS: step 13 pilot dry-run on real Destatis data |

---

## Plandan sapmalar ve eklemeler

| Konu | Plan | Uygulama | Gerekçe |
| --- | --- | --- | --- |
| XLSX paketi | `xlsx` veya `exceljs` | `exceljs` | npm'deki `xlsx` 0.18.5 yamanmamış güvenlik açıkları içeriyor |
| `overLimit` listesi | dört liste | beşinci liste | `maxSettlements` ile kesilenler sessizce düşmesin |
| Yarıda kalan ayırmalar | – | yeniden açılışta `uncertain` | Sağlayıcı isteği işlemiş olabilir |
| Bütçe kilidi | – | `budget.lock` (pid) | İki eşzamanlı oturum aynı kalanı harcamasın |
| Parametre eşleşmesi | bölüm 9'da elle | her yanıtta otomatik, `parameter_mismatch` | ROADMAP 6: „%100, otomatik testle" |
| `serp_results.domain` null | – | null kabul eder | Web sitesi olmayan local_pack işletmesi |
| gemeindefreie Gebiete | – | hariç, raporlu | Belediye değiller (ROADMAP 4) |
| `scanId` varsayılanı | belirtilmemiş | `<YYYYMMDD>-<proje>` | Aynı günün oturumları bütçeyi kendiliğinden paylaşır; `--scan-id` ile değişir |

## Açık konular

1. Pilot alanı kararı (bölüm 3, gözlem).
2. Pilot keywordleri (3–5), işletmelerin gerçek hizmetlerine göre.
3. Canlı deneme (plan bölüm 9): DataForSEO hesabı, deposit, anahtarlar `.env.local`'a, `SCAN_MAX_USD=0.20`; sonra `--limit-settlements 2 --limit-keywords 2 --sessions all --back-to-back --live`.
4. Site için Datenschutzerklärung.
