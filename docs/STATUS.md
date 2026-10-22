# Ortsrank – Durum ve Checklist

> **Şu an:** Aşama 1 devam ediyor; Kapı 1 geçilmedi. Pilot 1 kapalı. P1-A01 ana sayfa incelemesi yapıldı; işletmenin teyidi ve kararı bekleniyor (karar paketi hazır, gönderilmedi); P1-A03 önerildi, hiçbir değişiklik uygulanmadı; P1-A02 profil listesini bekliyor. Arşiv uzlaştırıldı (gerçek veri toplama maliyeti 0,180 $); elle kontrol için 44 uygun yanıt ve kontrol tablosu hazır, kontrol yapılmadı. Ölçüm planı karar bekliyor. Kanıt taleplerini Halil Yapraklı karşılar
> **Son güncelleme:** 22.10.2026
> **Kaynaklar:** [ROADMAP](ROADMAP.md) (sürüm 3.3) · [Aşama 1 planı](PHASE1_PLAN.md) (sürüm 1.2) · [Veri ihtiyacı WUA](Datenbedarf_Werbe_Umsatzanalyse.md) (sürüm 1.1)

Bu dosya projenin tek durum kaynağıdır. Her tamamlanan adımdan sonra güncellenir: kutu işaretlenir, tarih ve commit eklenir, "Şu an" satırı değiştirilir. Hem Claude sohbeti hem VS Code bu dosyayı günceller.

İşaretler: `[x]` tamam · `[ ]` açık · `[~]` devam ediyor · `[-]` iptal / kapsam dışı

---

## Genel görünüm

| Aşama | Durum | Kapı | Kapı durumu |
| --- | --- | --- | --- |
| 0 · Altyapı | Neredeyse tamam | – | – |
| 1 · Veri + talep pilotu | **Devam ediyor** | Kapı 1: rapor sayesinde karar alındı mı? | Açık |
| 2 · Ücretli pilot | Başlamadı | Kapı 2: ücretli ikinci ölçüm | – |
| 3 · İlk SaaS sürümü | Başlamadı | Kapı 3: yardımsız kullanım + yenileme | – |
| 4 · Genişleme | Başlamadı | – | – |

---

## Aşama 0 · Altyapı

- [x] Ürün fikri, rakip analizi, proje dokümanı (20.10.2026)
- [x] İsim: Ortsrank; subdomain `ortsrank.foundercheck.de` (20.10.2026)
- [x] KAS DNS: CNAME `ortsrank` → `cname.vercel-dns.com` (20.10.2026)
- [x] Vercel projesi `ortsrank`, bölge `fra1` (20.10.2026)
- [x] GitHub reposu `technsug-ops/-ortsrank` (20.10.2026)
- [x] Next.js 16 iskeleti, DE/EN/TR yönlendirme, açılış sayfası (20.10.2026)
- [x] Çok kiracılı şema, Better Auth uyumlu kimlik tabloları, `serp_raw`, kanıt seviyeleri (21.10.2026)
- [x] ROADMAP sürüm 3.1, dış değerlendirmeden geçti (21.10.2026)
- [x] Aşama 1 teknik planı sürüm 1.2 (21.10.2026, commit `612e3ad`)
- [x] `CLAUDE.md` – VS Code için çalışma kuralları (21.10.2026)
- [x] Neon Postgres `neon-erin-envelope` oluşturuldu, yalnızca `ortsrank` projesine bağlı; `DATABASE_URL` tüm ortamlarda (21.10.2026)
- [x] Yerel `.env.local` `vercel env pull` ile oluşturuldu; yerel klasör Vercel projesine bağlı (21.10.2026)
- [x] Neon bölgesinin Frankfurt olduğu doğrulandı (`eu-central-1`, 21.10.2026)
- [x] Migration uygulandı: `0000_init` + `0001_nullable_settlement_data`, `public` şemasında 19 tablo (21.10.2026, `npm run db:migrate`)
- [x] Vercel ↔ GitHub bağlantısı (Settings → Git → Connect) (21.10.2026)
- [x] İlk production deploy; `https://ortsrank.foundercheck.de` açılıyor ve SSL geçerli (21.10.2026, `2874124`; `/` → `/de`, `/de` `/en` `/tr` 200)
- [x] Impressum `/{de,en,tr}/impressum`; bilgiler foundercheck.de Impressum'undan, tek kaynak `src/config/operator.ts` (21.10.2026, `a58d027`)
- [x] Datenschutzerklärung `/{de,en,tr}/datenschutz` sürüm 1.0, tek kaynak `src/content/legal/privacy.ts` (21.10.2026, `8caf246`; Halil onayıyla yayında)
- [ ] Repo adı `ortsrank` olarak düzeltildi (isteğe bağlı)

---

## Aşama 1 · Veri + talep pilotu

### Teknik hat (VS Code) – [PHASE1_PLAN.md](PHASE1_PLAN.md) bölüm 7

- [x] 1. Bağımlılıklar: `tsx`, `vitest`, `dotenv`, `exceljs` (21.10.2026, `4874f4d`, `23b8618`). `xlsx` yerine `exceljs`: npm'deki `xlsx` 0.18.5 yamanmamış açıklar içeriyor. `@types/node` ^24 (vitest 5 şartı, yerel Node 24)
- [x] 2. Vitest kurulumu, `npm test` (21.10.2026, `b17f0f2`). `vitest.config.mts` (`@/` kısayolu, `tests/**/*.test.ts`); ilk test: de/en/tr sözlüklerinin anahtarları aynı
- [x] 3. `geo.ts` + testler (dört liste) (21.10.2026, `37b2097`). Ek: `overLimit` listesi, `maxSettlements` sınırına takılanlar sessizce düşmesin diye
- [x] 4. `plan.ts` + testler (beklenen / en kötü durum, oturum ataması) (21.10.2026, `c331e64`). Proje tanımı zod ile doğrulanıyor; varsayılanlar tek yerde: `src/lib/scan-defaults.ts`
- [x] 5. Sentetik örnek yanıt fixture'ları (21.10.2026, `38842ef`). `tests/fixtures/dataforseo/`: karışık başarı, local_pack yok, boş items, görev hatası, üst seviye hata; kurgusal `.example` domainleri; tutarlılık testi
- [x] 6. `parse.ts` + testler (21.10.2026, `17a3807`). Yanıt şeması zod ile (`dataforseo/types.ts`); geçersiz öğeler `issues` listesine, hedef yoksa `not_found_within_depth`; hatalı yanıtta hedef hükmü verilmez
- [x] 7. `runlog.ts` + testler (deneme ve görev kayıtları) (21.10.2026, `768b2f0`). `attempts.jsonl` / `tasks.jsonl` zod ile; özet: kayıt bütünlüğü, geçerli sonuç oranı, confirmed/uncertain maliyet, `problems` listesi; oturum saat sapması (Europe/Berlin, ±60 dk)
- [x] 8. Bütçe defteri + testler (eşzamanlılık, oturumlar arası, yeniden başlatma, yüksek ücret) (21.10.2026, `38c2c49`). `src/lib/budget.ts`; ek: yarıda kalan ayırmalar yeniden açılışta `uncertain` (`interrupted_run`) sayılır; kilit dosyası aynı taramada iki eşzamanlı çalıştırmayı engeller. HTTP katmanıyla uçtan uca bütçe senaryoları adım 9'da (`client.test.ts`)
- [x] 9. `client.ts` + mock testler (21.10.2026, `0209348`). Her deneme: bütçe ayır → gönder → ham yanıtı değiştirmeden ayrı dosyaya yaz → bütçeyi kapat → kaydet. Tekrar: zaman aşımı, ağ hatası, HTTP 429/5xx, DataForSEO 5xxxx; 4xxxx tekrar edilmez. Ek: gönderilen parametre ↔ yanıttaki `data` karşılaştırması (ROADMAP 6), farklıysa `parameter_mismatch`
- [x] 10. `scan.ts` dry-run uçtan uca (21.10.2026, `0bd7d5c`). Mantık `src/lib/scan-run.ts`, CLI `scripts/scan.ts`; belediye dosyası biçimi `src/lib/settlements.ts` (adım 12 buna yazacak); örnek proje `projects/pilot-rhein-main.json`. `scanId` varsayılanı `<YYYYMMDD>-<proje>` (aynı günün oturumları bütçeyi paylaşır, `--scan-id` ile değiştirilir). Canlıda `--session` veya `--sessions all --back-to-back` zorunlu
- [x] 11. Şema: `lat`, `lng`, `population`, `population_as_of` ve `serp_results.domain` null kabul eder; migration `drizzle/0001_nullable_settlement_data.sql` (21.10.2026, `931d900`); Neon'a uygulandı
- [x] 12. Gerçek Destatis dosyası indirildi, sütun eşlemesi doğrulandı, `import-settlements.ts` (21.10.2026, `10be488`). `31122025_Auszug_GV.xlsx` (sha256 `5bfb8b7a5ce0…`): 10.751 belediye, eksik koordinat 0, eksik nüfus 0; gemeindefrei 202 alan (Textkennzeichen 65/66) hariç ve raporlu. `--db` ile Neon `settlements` tablosuna yazıldı (tekrar çalıştırma çoğaltmıyor)
- [x] 13. Pilot dry-run: gerçek belediye listesi + maliyet (21.10.2026). `pilot-rhein-main` (Frankfurt, 30 km, ≥10.000, en fazla 30): 66 uygun belediye → en yakın 30 seçildi (Frankfurt … Rodgau 17,4 km), 36 `overLimit` (Darmstadt 26,6 km, Rüsselsheim 23,3 km dahil), 23 eşik altı, 0 nüfusu bilinmeyen, 0 konumsuz. Mevcut 2 keyword ile 120 görev: beklenen 0,576 $, en kötü 1,44 $; 5 keyword ile 210 görev ≈ 1,01 $ / 2,52 $
- [x] 14. Teslimat raporu `docs/reports/phase1-delivery.md` (21.10.2026, `d713c87`): 229/229 test, Destatis 10.751 belediye, pilot dry-run 30 belediye / 120 görev / 0,576 $
- [ ] Teslimat raporu bu sohbette değerlendirildi

### Canlı doğrulama

- [x] DataForSEO hesabı açıldı ve doğrulandı (TechNS UG, 1 $ deneme kredisi; deposit ve panel harcama limiti henüz yok) (21.10.2026)
- [~] Anahtarlar `.env.local`'da, ücretsiz `user_data` çağrısıyla doğrulandı (21.10.2026); Vercel ortam değişkenleri henüz değil
- [x] Küçük canlı deneme: 2 belediye × 2 keyword, teknik doğrulama (21.10.2026, tarama `trial-20261021`: 8/8 başarılı, kayıt bütünlüğü %100, 0,032 $)
- [x] Gerçek `cost` ile fiyat varsayımı doğrulandı: 0,004 $ / deneme (depth 20), Advanced = Regular fiyatı (21.10.2026)
- [x] `local_pack` yanıt yapısı doğrulandı: öğe başına tek işletme, **ama `cid: null` ve domain `www.google.com`** (21.10.2026, `c1c9098`)
- [x] Local Pack'te hedef işletme kimliği: pilotta doğrulanmış Google profil adıyla tam eşleşme (yöntem A, kesin kimlik sayılmaz); `local_pack_gap` pilotta kapalı; Maps uç noktası (B) ertelendi – RULES_V0 bölüm 10 (21.10.2026, `94e850e`)
- [ ] Pilot işletmenin Google profil adı doğrulanmış kaynaktan proje dosyasına girildi
- [ ] Tam pilot taraması (oturumlu)
- [ ] Değişkenlik ölçümü (3 gün)

### Rapor

- [x] Kurallar v0 (kanıt seviyeli) – [RULES_V0.md](RULES_V0.md) sürüm 0.2 onaylı ve uygulandı (21.10.2026, `f787001`): `src/lib/rules/`, `scripts/findings.ts`; sentetik örnek çıktı [reports/rules-v0-sample.md](reports/rules-v0-sample.md); kod incelemesi düzeltmeleri `babbd61` (RULES_V0 bölüm 8) – canlı pilota hazır. Gerçek veriyle çalıştırma canlı taramadan sonra; rakip etiket listesi `data/competitor-labels.json` (gitignore) elle hazırlanacak
- [ ] Sayfa taraması (rakip + müşteri sitesi)
- [x] Almanca rapor şablonu (HTML, özet ve kanıt eki olarak PDF baskısı): `docs/templates/ortsrank-report-template.html` (22.10.2026, `3d08f1f`). Pilot betikleri gerçek veri içerdiği için git dışında; ikinci işletme için genel üretim adımı yok
- [x] İlk rapor elle gözden geçirildi: Pilot 1 DE özet, DE kanıt eki ve TR iç inceleme dış incelemede teslim edilebilir bulundu (22.10.2026; sürüm 22.10.2026 10:40 · 9664f01)

### İş hattı (Halil)

- [x] Pilot çerçevesi: Terrassenüberdachung, Frankfurt/Rhein-Main, 20–30 belediye (21.10.2026)
- [x] **Pilot 1: Arbeitsbühnenvermietung, Heidenheim çevresi** (Halil'in kararı, 21.10.2026); Terrassenüberdachung sonraki pilot. Ayarlar ve taslaklar: [PILOT_SETUP.md](PILOT_SETUP.md)
- [x] Pilot 1 keyword keşfi: 4 sorgu Heidenheim'dan, 0,016 $ (yerel keşif taraması, 21.10.2026)
- [ ] Pilot 1 kesin keyword seti (öneri: Arbeitsbühne mieten ×3, Hubarbeitsbühne mieten, Scherenbühne mieten, Arbeitsbühne mieten in der Nähe)
- [-] Pilot 1 alt nüfus eşiği / 30 belediyelik tarama – Halil'in kararıyla bu pilot için geçersiz; yerine küçük gerçek veri denemesi
- [x] **Pilot 1 küçük gerçek veri denemesi** (21.10.2026): 5 belediye (Heidenheim, Steinheim, Aalen, Ulm, Babenhausen), 30/30 görev, 0,12 $ (0,024 $ / belediye), bakiye 0,94 → 0,82 $; oturumlar peş peşe → `technical_validation`. Özet [reports/pilot1-small-run.md](reports/pilot1-small-run.md); tam rapor git dışında
- [ ] Pilot 1 planlı oturumlarla ölçüm (09:00 / 13:00 / 18:00) – reklam gözlemi için
- [x] Pilot 1 Google profilleri: 2 Maps sorgusu (0,004 $) ile hedef işletmenin iki profili `cid` ve adresle doğrulandı; şubeler aynı adı taşıdığı için eşleştirme yalnızca `cid` ile (21.10.2026)
- [x] **Local Pack kanıta dayalı eşleştirme** (Halil'in onayı, 21.10.2026; [RULES_V0.md](RULES_V0.md) bölüm 10): `cid` ve `svid`'den çözülen `/g/` kimliği ayrı; tam adres eşleşmesi kimlikten ayrı ve zayıf; ad/puan/yorum kimlik değil; domain yalnızca kaydın kendi web sitesinden; `local_pack_gap` kapalı. Pilot 1: 8 marka kaydı yalnızca marka gözlemi, hedef şubeye doğrulanmış eşleşme yok; organik sonuçlar, kural kontrolleri ve 17 kapsama bulgusu değişmedi
- [x] Konum mantığı ham istek/yanıtla denetlendi: keyword şehir adı olmadan; konum ayrı parametre (`location_coordinate`, belediye merkez koordinatı), gönderilen değer 30/30 aynen dönüyor. Bu „merkez koordinatıyla istenen ölçüm"dür; Google'ın tam bu noktayı kullandığı kanıtlanmadı (`check_url` içindeki `uule` 20–110 m farklı nokta ve birimi belgesiz `radius` taşıyor) ([reports/pilot1-small-run.md](reports/pilot1-small-run.md))
- [x] `uule` noktası ve yarıçapı ayrıştırma sonucunda (`checkUrlLocation`); `compareEchoedParameters`'a `os` eklendi; ham dosya ↔ deneme kaydı kontrolü (`listRawPaths`) – kayıtsız ham dosya özetteki `problems` listesine düşer (22.10.2026, `5ac4b0a`)
- [ ] Pilot 1 marka kayıtlarının şube ataması: kayıtlarda doğrulanmış kimlik veya tam adres yok; `/g/` ↔ `cid` bağlantısı için kanıt kaynağı yok. Ücretli Maps sorgusu çözüm değil: Maps yanıtında `/g/` yok (`cid`, `place_id`, `feature_id`). Para harcamadan önce yeni veride hangi ortak alanın bulunacağı gösterilmeli
- [x] **Rakip tanımı** (Halil'in onayı, 21.10.2026): işletme bazında; aynı belediyede doğrulanmış faal konum + doğrulanmış hizmet; eksik kanıt „doğrulanmadı"; eşikler aynı – [RULES_V0.md](RULES_V0.md) bölüm 13, `findings --competitors`. Pilot 1: organik boşluk Heidenheim „koşul sağlanmadı" (hedef ilk 10'da, rakip bilgisinden bağımsız), Steinheim „koşul sağlanmadı" (koşullu: bir işletmenin konum envanteri değerlendirmesine bağlı), Aalen, Ulm, Babenhausen incelenen kaynaklarla „değerlendirilemedi"
- [ ] Pilot 1 rakip kayıtları ve etiket onayı – **Halil'in kararı**; dış değerlendirme bu onayın yerine geçmez. Onay – inceleme tablosu v2 `data/competitor-review.pilot1.md` (45 domain; kamuya açık kaynaklardan birebir alıntı, `data/competitor-sources.pilot1.batch1-4.json`; hiçbiri onaylanmadı). Ana keyword'ün ilk 10'u tam incelendi; 12 domain (yalnızca diğer keywordler) açık; 2 site erişilemedi
- [x] Pilot 1 müşteri raporu taslağı (Almanca, git dışı `data/reports/pilot1-kundenbericht-20261021.md`), Halil'in incelemesine hazır
- [x] **Pilot 1 iş paketi kapandı** (22.10.2026): Heidenheim koşul sağlanmadı; Steinheim koşullu (bir işletmenin konum envanteri değerlendirmesine bağlı); Aalen, Ulm, Babenhausen mevcut kaynaklarla değerlendirilemedi. Rapor, belirsizlikleri belirtilmiş haliyle teslim edilebilir; rakip kayıtlarının onaylanmamış olması teslimi engellemez
- [-] DataForSEO'ya 50 $ yükleme – Halil'in talimatıyla uygulanmadı; yalnızca mevcut bakiye kullanılıyor (kalan 0,82 $)
- [~] Pilot keywordleri (3–5), işletmelerin gerçek hizmetlerine göre – taslak [PILOT_SETUP.md](PILOT_SETUP.md) bölüm 1 (Google önerilerinden), Halil'in onayı bekleniyor
- [~] Pilot alanı kararı (taslak [PILOT_SETUP.md](PILOT_SETUP.md) bölüm 2; önce pilot işletmenin konumu): 30 km / ≥10.000 nüfusta 66 belediye var; üst sınır 30 iken seçim 17,4 km'de bitiyor. Seçenekler: üst sınırı artırmak, nüfus eşiğini yükseltmek (30 km / ≥20.000 → 34) veya yarıçapı küçültmek (25 km / ≥20.000 → 29)
- [~] Pilot işletme 2 adayı (UG-ALU): site salt okunur incelendi (22.10.2026; online mağaza + bölgesel montaj, alan Rhein-Main değil işletmenin bulunduğu bölge olmalı); uygunluk notu, proje taslağı ve dry-run git dışında (küçük deneme 30 görev 0,14–0,36 $; tam alan 180 görev 0,86–2,16 $). Katılım, kapsam ve bütçe önceliği netleşmeli
- [~] Pilot adayı 3 (bölgesel su hasarı / sızıntı tespiti işletmesi, Rhein-Main; Halil'in yetkisiyle 22.10.2026): site salt okunur incelendi; işletme hizmet bölgesini 11 belediye olarak beyan ediyor; kendi Google profil bağlantısı `cid` ve `/g/` kimliğini birlikte veriyor (Local Pack eşleştirmesi kanıtla mümkün). Not ve proje taslağı git dışında; dry-run 66 görev (0,32–0,79 $) veya 5 belediye 30 görev (0,14–0,36 $). Üçüncü sektör → ROADMAP „1 sektör“ kararı; katılım ve bütçe önceliği netleşmeli
- [ ] Pilot işletme 2
- [ ] Pilot işletme 3
- [ ] Pilot işletme 4–5 (isteğe bağlı)
- [ ] Rapor görüşmeleri yapıldı
- [ ] Her pilot için 5 kayıt dolduruldu (yeni bilgi, değişen öncelik, işi kim yaptı, ödeme, süre)
- [ ] Pilot sözleşmesi ve Datenschutz taslağı (Aşama 2 hazırlığı)

### Aşama 1 durum denetimi ve Pilot 1 aksiyonları (22.10.2026)

Denetim: [reports/phase1-status-audit.md](reports/phase1-status-audit.md). Bu iş paketi belge ve kayıt hazırlığıdır; iki incelemenin yapıldığı, müşteri talebinin doğrulandığı veya Kapı 1'in geçildiği anlamına gelmez.

- [x] Kabul maddeleri kanıtlarıyla tablo halinde (veri hattı, kurallar/rapor/maliyet, talep, WUA-0); belgeler arası 12 çelişki kaydedildi
- [x] Aksiyon kaydı şablonu: [templates/action-register-template.md](templates/action-register-template.md) (6 durum, tamamlanma ≠ etki, `actions` tablosu eşlemesi; şema değişmedi)
- [x] Pilot 1 aksiyonları git dışında `data/actions/pilot1-actions.md`: P1-A01 ana sayfa incelemesi (planlandı; sayfa kopyası ve işletmenin teslimat bölgesi eksik), P1-A02 marka kayıtlarının eşleştirilmesi (planlandı; mevcut kanıtla 8/8 eşleştirilemedi, işletmenin profil listesi eksik)
- [x] Görüşme ve karar formu: [templates/pilot-interview-form.md](templates/pilot-interview-form.md) (sorular DE, kullanım notu TR); Pilot 1 boş kopyası git dışında `data/interviews/pilot1-interview.md`
- [x] Planlı ölçüm karar taslağı: [reports/pilot1-measurement-decision-draft.md](reports/pilot1-measurement-decision-draft.md) – başlatılmadı
- [x] Görüşme akışı (~20 dk, sorular DE, notlar TR) şablona eklendi; iki başlangıç yolu (rapor önceden okundu / okunmadı), ikinci ölçüm için ayrı alanlar (ilgi · teklif edilen kapsam ve fiyat · sipariş · ödeme); Pilot 1 kopyasında iki inceleme adımının anlatımı, profil bilgisi isteği ve rapor/görüşme davet taslağı (DE, gönderilmedi) – git dışında `data/interviews/pilot1-interview.md` (22.10.2026)
- [x] P1-A01 ana sayfa incelemesi (ücretsiz, salt okunur, 2 sayfa; 22.10.2026): 5 doğrulanmış eksiklik, 8 açık soru, değişiklik taslağı V1–V8 geri bildirimle düzeltildi; Almanca karar paketi (A ilk düzeltmeler · B önce teyit · C ikinci adım) – git dışında, gönderilmedi; durum „karar/onay bekliyor“
- [ ] P1-A03 ana sayfa düzeltme paketi (iyileştirme): „karar/onay bekliyor (önerildi)“ – onay, sorumlu ve tarih yok; **hiçbir değişiklik uygulanmadı**
- [~] P1-A02 marka kayıtları: işletmeden istenecek profil bilgileri hazır (DE); durum „planlandı“, 8/8 eşleştirilemedi
- [x] Teknik doğrulama ve ölçüm planı sürüm 3: elle kontrol (belgelenmiş tam kontrol 0 / 44 – yeniden sayım 22.10.2026; üç yaklaşım ayrı, hangisinin şartı karşıladığı açık karar; hata kuralı), koordinat ↔ şehir kodu deneyi (ayrı doğrulama betiği önerisi, uygulanmadı), M1–M3 + V birleşik plan – [reports/pilot1-measurement-decision-draft.md](reports/pilot1-measurement-decision-draft.md); başlatılmadı
- [ ] Pilot 1 raporunun teslimi ve görüşme (Halil)
- [ ] Görüşmede seçilen aksiyonun başlatılması
- [ ] Ölçüm planı kararı (Halil)
- [ ] 50 yanıtta elle ayrıştırma kontrolü – envanter 55 ham dosya, 44 kontrole uygun (önceki „42“ yeniden sayıldı), belgelenmiş tam kontrol 0; kontrol tablosu hazır (git dışı `data/parse-checks/20261022/`); şart mevcut arşivle karşılanamaz
- [ ] Koordinat ↔ şehir kodu karşılaştırması (10 belediye; tarama kodu şehir koduyla sorgu desteklemiyor)
- [ ] Değişkenlik ölçümü (en az 3 gün)

Kanıt talepleri (ham yanıtlar, kaynaklar): **Halil Yapraklı** karşılar.

### WUA-0 · Reklam ve ciro veri sözleşmesi – [ROADMAP](ROADMAP.md) bölüm 12

Tarama teknik hattından bağımsız, Aşama 1 boyunca paralel; kod gerektirmez. Kabul: net/brüt, para birimi, tarih temeli, dönem ve kanal kapsamı belirli; gerçek müşteri verisinden önce erişim ve işleme koşulları belirlenmiş.

- [x] Müşteri veri ihtiyaç belgesi 1.1: veri alanları, net/brüt, para birimi ve birim, tarih temeli, kısmi ay, kanal kapsamı tanımlı (21.10.2026, `7f9dc03`)
- [ ] İlk görüşme formu (~45 dk: hedefler, hizmet alanı, aksiyonlar, bütçe kararları, fiyat, kapasite)
- [ ] Veri kalite kuralları yazılı (eksik ay, tekrar kayıt, storno/iade, kaynak toplamı uzlaştırma)
- [ ] Gerçek müşteri verisinden önce erişim ve işleme koşulları (amaç, roller, alt işleyenler, saklama/silme, gerekirse AVV)
- [ ] WUA pilot adayı: dosya verisi (Ads dışa aktarımı + aylık gerçek ciro) ve AVV kontrolü

### Kapı 1

- [ ] Ölçüm ölçütleri karşılandı (ROADMAP bölüm 6): kayıt bütünlüğü %100 ✓ (21.10.2026'daki `…-96a2e0` ihlali düzeltildi, kontrol eklendi), geçerli sonuç ≥ %98 (küçük ölçekte ✓), parametre eşleşmesi otomatik %100 ✓, 50 rastgele yanıtta elle ayrıştırma kontrolü ✗, değişkenlik ölçümü ✗, reklam görülme sıklığı ✗ – [denetim](reports/phase1-status-audit.md)
- [ ] En az 2 işletme rapor nedeniyle önceliğini değiştirdi
- [ ] Karar: geç / düzelt / dur → Aşama 2 planı yazılır

---

## Aşama 2–4

Ayrıntılı checklist, ilgili kapıya yaklaşıldığında eklenir (bkz. ROADMAP bölüm 7).

Planlanmış başlıklar:

- [ ] Aşama 2 · Admin paneli v1 (iç kullanım: müşteriler, taramalar, bütçe, rapor linkleri, pilot kayıtları, keyword setleri ve rakip etiketleri)
- [ ] Aşama 2 · Kullanılabilirlik testi (en az 2 işletme sahibi raporu yardımsız anlıyor)
- [ ] Aşama 2 · WUA-1 dosyadan reklam/ciro analizi pilotu (ROADMAP bölüm 12)
- [ ] Aşama 3 · WUA-2 dosya yükleme, veri kalitesi ve yönetici raporu akışı (talep doğrulanırsa)
- [ ] Aşama 3+ · WUA-3 otomatik Google bağlantıları (Ads, Analytics, Search Console; ayrı fizibilite)
- [ ] Aşama 3 · Admin paneli v2 (kullanıcılar, planlar ve kota, ödeme durumu, sistem sağlığı, içerik ve hukuk metinleri, audit log)

---

## Günlük

| Tarih | Ne oldu | Commit |
| --- | --- | --- |
| 22.10.2026 | Pilot adayı 3 incelendi (salt okunur, 4 sayfa + kendi profil bağlantısının yönlendirmesi; ücretli sorgu yok): hizmet bölgesi 11 belediye (kendi beyanı), profil bağlantısında `cid` + `/g/` birlikte; dry-run 66 görev 0,32–0,79 $. Not ve taslak git dışında. Sektör sayısı ROADMAP'e göre karar gerektiriyor | bu commit |
| 22.10.2026 | Pilot 2 adayı incelendi (Halil'in yetkisiyle; 5 sayfa salt okunur, ücretli sorgu yok): uygunluk notu ve proje taslağı git dışında; dry-run: 30 belediye / 180 görev (0,86–2,16 $) veya küçük deneme 30 görev (0,14–0,36 $); bakiye Pilot 1 ölçüm planıyla paylaşılıyor | `b42d266` |
| 22.10.2026 | Arşiv uzlaştırması (yeni sorgu yok): `…-96a2e0`'ın 5 ham yanıtı tek tek incelendi, tarihli uzlaştırma kaydı git dışında; gerçek maliyet ham yanıtlardan SERP 0,176 $ (deneme taraması 0,040 $, önceden 0,032 $), Maps 0,004 $, toplam 0,180 $; Pilot 1 0,12 $ değişmedi. Elle kontrol envanteri: 55 ham dosya, 44 kontrole uygun, yinelenen yok; kontrol tablosu git dışında, hiçbir satır kontrol edilmedi. `checkUrlLocation` durumlu (çözüldü / yok / çözülemedi; yarıçap birimi belgesiz), geri dönen koordinat ayrı alan (`echoedLocationCoordinate`) | `4e7c8e5` |
| 22.10.2026 | Kayıt bütünlüğü bulgusu: 21.10.2026 çalıştırması `…-96a2e0` (EPERM ile durmuş, neden `c1c9098`'de düzeltilmişti) 4 ham yanıtı deneme kaydı olmadan bırakmış (2'si ücretli, 0,008 $; bütçe defteri bunları `uncertain` 0,016 $ olarak tutmuş – 22.10.2026 uzlaştırması); denetimdeki „51/51 kayıtlı“ ifadesi düzeltildi. Yeni kontrol `listRawPaths` → özetteki `problems`; arşivde yalnızca bu çalıştırma işaretli. `os` parametre karşılaştırmasına eklendi; `check_url` `uule` noktası `checkUrlLocation`. 4 yeni test; toplam 411/411, tsc ve ESLint temiz | `5ac4b0a` |
| 22.10.2026 | Geri bildirim düzeltmeleri: aksiyon şablonunda inceleme ↔ uygulama ayrımı (iyileştirme kaydı „karar/onay bekliyor (önerildi)“); görüşme formunda iki başlangıç yolu, ikinci ölçüm için ayrı alanlar, Kapı 1'in iki şartı; ölçüm planı sürüm 3 (elle kontrolde üç yaklaşım, hata kuralı). Git dışında: V1–V8 düzeltildi, Almanca karar paketi (gönderilmedi), P1-A03 açıldı, P1-A01 açıklamaları güncellendi, görüşme kopyası yeni şablonla. Değişiklik uygulanmadı; ölçüm yok; kod değişmedi | `717dd70` |
| 22.10.2026 | Görüşme formuna ~20 dk akış ve yönlendirmesiz sorular; ölçüm planı sürüm 2 (elle kontrolün gerçek durumu, koordinat ↔ şehir kodu deneyi, M1–M3 + V birleşik plan, bakiye bilinmiyor); denetimde T9 ifadesi düzeltildi, T13 „kısmen“. Git dışında: P1-A01 ana sayfa incelemesi ve değişiklik taslağı, P1-A02 profil bilgi isteği, davet taslağı. Ölçüm, sorgu ve harcama yok; kod değişmedi | `0330779` |
| 22.10.2026 | Aşama 1 durum denetimi (kanıtlı kabul tablosu, 12 belge çelişkisi, sonraki işlerin sırası), aksiyon kaydı şablonu, pilot görüşme ve karar formu, planlı ölçüm karar taslağı; Pilot 1 aksiyonları ve form kopyası git dışında. Aşama 1 devam ediyor, Kapı 1 geçilmedi; ölçüm başlatılmadı; kod değişmedi | `648b6f0` |
| 22.10.2026 | Rapor anlatımı ve şablon: özet dört karar sorusuyla (dört kart); kural bölümü yardımcı değerlendirme, ayrıntıları kanıt eki D'de, „bulgu yok ≠ sorun/fırsat yok“ uyarısı görünür; öneriler dört alanlı (`steps[].fields`); rakip girişi (`competitorintro`); ek bölümler (`annexextra`); düzenleme kopyaları veri sürümüne bağlı (`dataVersion`): eski sürüme ait düzenleme güncel verinin üstünde gösterilmez, dosyada kalır ve uyarı çubuğundan açılabilir; özet baskı yazısı büyütüldü (gövde 9,2 pt). Pilot 1 (git dışında): DE özet 6, DE kanıt eki 8, TR 6 sayfa. STATUS: son üç günlük satırı yanlış tabloya girmişti, taşındı | `3d08f1f` |
| 22.10.2026 | Şablon baskı düzeltmesi: `dl` içinde çok paragraflı değer tek açıklama hücresinde (önceden ikinci paragraf dar etiket sütununa düşüyordu); altbilgi tek satır. Pilot 1 (git dışında): ortak rapor sürümü iki dilde aynı, dil bazında içerik kimliği altbilgide ayrı | `835e03a` |
| 22.10.2026 | Baskı: özet tablosunda gövde 8 pt, ölçüm satırları 7,6 pt; 7 pt yalnızca kanıt kimlikleri ve etiketlerde. Pilot 1 teslimi kapandı (git dışında): ölçüm planında keyword adları ve saatleri yazılı; DE özet + DE kanıt eki birlikte gönderilir, TR iç incelemede kalır; kanıt talepleri e-postaya yanıtla, Halil karşılar; rakip onayları açık, teslimi engellemez. Sonraki adım: işletmenin rapordan hangi kararı çıkarabildiğinin değerlendirilmesi | `8dd1b3a` |
| 22.10.2026 | Rapor şablonu baskı düzeni: `#print-summary` (bölüm 1–7) ve `#print-annex` (bölüm 8, kanıt eki) modları; başlıklar içerikten kopmuyor, tablo başlığı her sayfada tekrar ediyor, baskıda en küçük yazı 7 pt; özet kartlarda kaynakların kanıt ekinde olduğu notu; `keywordsLang` (tablo başlıklarında doğru büyük harf). Pilot 1 müşteri teslimi (git dışında): DE özet 5 sayfa + kanıt eki 8 sayfa; HTML ve PDF'ler sürüm damgalı, son kontrol teslim dosyaları üzerinde yapıldı | `b544b6c` |
| 22.10.2026 | Rapor düzeltmeleri (geri bildirim): müşteri raporunda yerel dosya yolu yok (ham yanıt „projede arşivli, talep üzerine"); rakip kartları üç alan (gözlem / değerlendirme / kaynak ve onay) ve tıklanabilir kaynak URL'leri erişim tarihiyle; profil önerisi uygunluk hükmü olmadan, marka kayıtlarını konumlara eşleme sorusuna odaklı. Şablon: güvenli bağlantı listesi (yalnızca http/https; baskıda URL görünür), üç alanlı kart; İngilizce şablonda duruyor | `eabc534` |
| 22.10.2026 | Rapor formatı (Halil): `docs/templates/ortsrank-report-template.html` (TR/DE/EN, düzenlenebilir, yazdır/kaydet); JS isteğe bağlı dizilerle genişletildi (tablo satırları, birden çok rakip kartı, öneri adımları, kanıt kayıtları), dizisiz halde şablon aynı. Pilot 1 raporu bu formatta DE + TR üretildi (git dışı `data/reports/pilot1-bericht-20261022.html`); tarayıcıda denetlendi: 0 konsol hatası, yer tutucu yok | `70d0b43` |
| 22.10.2026 | Pilot 1 iş paketi kapandı; rakip kayıtlarının ve etiketlerin onayı Halil'de açık madde | `6ad033e` |
| 22.10.2026 | Pilot 1 teslim notu (anonim özet): sonuçların sınırları, işletme açısından anlamı, son kod değişikliğinin doğrulaması (`5ac0ce1`: 407/407 test, tsc ve ESLint temiz); kod değişmedi | `82cf218` |
| 22.10.2026 | Sonuçların sunumu (geri bildirim): Steinheim koşullu (kayda özgü konum envanteri değerlendirmesi, genel kural değil), Aalen/Ulm/Babenhausen „incelenen kaynaklarla değerlendirilemedi"; konum için `operational` alanı (faal olduğu kaynakla gösterilmeli; yoksa açık); faal kanıtı zayıf bir konum açık bırakıldı (Ulm sonucu değişmedi); toplam 407/407 | `5ac0ce1` |
| 22.10.2026 | Karar odaklı ücretsiz kaynak kontrolü (yalnızca sonucu değiştirebilecek 3 işletme + 1 erişilemeyen site): 1 işletmenin konum envanteri kendi sayı beyanı ve adlandırılmış konumlarıyla kapandı → Steinheim „koşul sağlanmadı"; 2 işletmenin konum listesi yok, 1 site hâlâ 503 → Aalen, Ulm, Babenhausen açık; kod değişmedi | `3768915` |
| 21.10.2026 | Rakip kaydı düzeltmeleri (geri bildirim): `comprehensive_list` yalnızca kendi konum sayfası tam okunduysa (Impressum/tek adres → „doğrulanmadı"); kısaltılmış şehir adı kayıtlı kanıtla kabul (Neu-Ulm ≠ Ulm); `ruleChecks.perMeasurement` (kesin, açık, azami, ham yanıt yolu); kaynak doğrulaması ile onay ayrı. Pilot 1 sonucu düzeldi: Heidenheim koşul sağlanmadı, 4 belediye değerlendirilemedi (önceki „5 belediyede koşul sağlanmadı" geri alındı); toplam 406/406 | `5eced01` |
| 21.10.2026 | Rakip kaydı ve dar tanım uygulandı: `competitors.ts` (işletme, konum türü, belediye adı eşleşmesi, hizmet doğrulaması, „doğrulanmadı"), `organic_gap` işletme bazında sayım ve kapsam metni, `findings --competitors`; `some`→`every` düzeltmesi (iki yolda); pilot 1 yeniden üretildi (git dışı rakip kaydı): 5 belediyede koşul sağlanmadı; toplam 401/401 | `592eafb` |
| 21.10.2026 | Rakip etiket incelemesi v2 (git dışı): tek etiket yerine tür / kendi konumları / hizmet beyanı / belediye bazında varlık; 45 domain kamuya açık kaynaklarla yeniden incelendi (11'i yeni); sıkı tanım simülasyonu: organik boşluk bulgusu yok; tanım önerisi RULES_V0 bölüm 13 (onay bekliyor); kod değişmedi | `7fe0a3c` |
| 21.10.2026 | Local Pack kanıta dayalı eşleştirme (yalnızca 30 ham yanıt, yeni istek yok): `svid` → `/g/`, adres karşılaştırması, kayıt bazında kanıt, `targetProfiles` / `localPackProfiles`, `findings --project`; profil adıyla eşleşme (yöntem A) kaldırıldı; önceki „ofis profili (çıkarım)" ve „telefonla gözlem" atamaları geri alındı (yalnızca marka gözlemi). Konum mantığı denetimi. Raporlar yeniden üretildi (git dışı); toplam 367/367 | `c0ece0f` |
| 21.10.2026 | Geri bildirim düzeltmeleri: 30 ölçümün Local Pack hesabı (8 + 21 + 1), konum ifadesi („merkez koordinatıyla istenen ölçüm"; `uule` radius gönderilenle karşılaştırılmıyor), uçtan uca olumlu eşleşme testleri (`cid`, bağlı `/g/`, tam adres), Maps sorgusunun `/g/` kayıtlarını bağlamadığı notu; toplam 371/371 | `222ba67` |
| 21.10.2026 | Pilot 1 Maps profil eşleştirmesi (2 sorgu, 0,004 $): local pack marka kayıtları ofis profili (çıkarım) ve diğer şubeler (telefonla gözlem); ikinci adres profili 30 ölçümde görülmedi; müşteri raporu güncellendi (git dışı) | `66a33ff` |
| 21.10.2026 | Pilot 1 değerlendirme raporu (mevcut ham veriden, yeni istek yok): Almanca müşteri raporu ve etiket inceleme tablosu git dışında; ölçüm bazında organik hücre, rakip kapsamasında belediye başına ölçüm, `ruleChecks` (değerlendirilemedi / koşul sağlanmadı), Markdown düzeltmeleri; toplam 336/336 | `4fe77c6` |
| 21.10.2026 | Pilot 1 küçük canlı deneme: 5 belediye, 30/30, 0,12 $; 17 rakip kapsaması bulgusu (etiketler taslak); organik boşluk etiket onayı olmadan üretilemedi; SERP varyantı gözlemi. Kod: açık belediye listesi, `--labels-draft`, teknik denemede reklam oranı gizli; toplam 326/326 | `eb5bf65` |
| 21.10.2026 | Pilot 1 hazırlığı (Arbeitsbühnenvermietung, Heidenheim): `includeCenter`, `populationMax`, marka şubesi durumu; keşif 4 sorgu 0,016 $; dry-run 30 belediye / 180 görev / 0,86–2,16 $; toplam 316/316 | `9f761c3` |
| 21.10.2026 | Pilot ayarları taslağı: keywordler (Google önerilerinden), alan seçenekleri ve maliyet; rakip etiket taslağı `data/` içinde (31 öneri, 18 belirsiz) | `84e6540` |
| 21.10.2026 | Local Pack profil adıyla eşleştirme (5 durum, ham ad + yöntem kaydı), `local_pack_gap` pilotta kapalı; toplam 304/304 | `94e850e` |
| 21.10.2026 | Canlı deneme başarılı (8/8, 0,032 $); local pack `cid` null + Google domaini, organik ~15 sonuç → ayrıştırıcı ve kurallar düzeltildi; bütçe defterinde Windows dosya kilidine karşı tekrar; toplam 289/289 | `c1c9098` |
| 21.10.2026 | İlk canlı deneme `trial-20261021`: 8 görev HTTP 403 / 40104 (hesap doğrulanmamış), maliyet 0 $, kayıt bütünlüğü %100. Düzeltme: HTTP hatasında sağlayıcı kodu kaydedilir; teknik denemede oturum sapması değerlendirilmez | `c5b9f41` |
| 21.10.2026 | Kurallar v0 inceleme düzeltmeleri: hedef domain yoksa organik bulgu yok, keyword bazlı hipotez, ayrıştırma sorunlu yanıt geçersiz, eksik ölçüm cümlede; toplam 281/281 | `babbd61` |
| 21.10.2026 | Kurallar v0 uygulandı (0.2: cid eşleşmesi, ölçüm başına rakip koşulu, kapsama paydası, oturum bazlı reklam, öncelikte eksik nüfus → manuel); 44 yeni test; toplam 273/273 | `f787001` |
| 21.10.2026 | Kurallar v0 tasarım taslağı (5 kural, kanıt seviyeleri, yasaklı ifadeler, test planı) | `ef08780` |
| 21.10.2026 | Datenschutzerklärung taslağı (sitenin gerçek durumuna göre: çerez yok, izleyici yok, Vercel hosting, e-posta iletişimi); Halil onayıyla yayında | `8caf246` |
| 21.10.2026 | Adım 14: Aşama 1 ilk teknik teslimat raporu | `d713c87` |
| 21.10.2026 | Adım 13: pilot dry-run gerçek veriyle (30 belediye, 120 görev, 0,576 $ beklenen); pilot alanı kararı açık | `aaa3398` |
| 21.10.2026 | Adım 12: Destatis GV 31.12.2025 içe aktarıldı (10.751 belediye, JSON + Neon), `destatis.ts` + `import-settlements.ts`, 41 test; toplam 229/229 | `10be488` |
| 21.10.2026 | Neon Frankfurt doğrulandı; migration 0000 + 0001 uygulandı (19 tablo); `npm run db:migrate` | `75739d4` |
| 21.10.2026 | Adım 11: şemada null alanlar + migration 0001, şema testi; toplam 188/188 | `931d900` |
| 21.10.2026 | Adım 10: `scan.ts` (dry-run varsayılan, `--live`, oturum filtresi, runId, plan/summary/results.csv, teknik deneme modu), 35 test; toplam 185/185 | `0bd7d5c` |
| 21.10.2026 | Adım 9: `client.ts` (Basic Auth, zaman aşımı, artan bekleme, eşzamanlılık 5, deneme başına ham dosya, parametre eşleşme kontrolü), 16 test; toplam 150/150 | `0209348` |
| 21.10.2026 | Adım 8: bütçe defteri (ayırma, confirmed/uncertain, tarama başına kalıcı defter, fiyat sapması, kilit), 18 test; toplam 134/134 | `38c2c49` |
| 21.10.2026 | Adım 7: `runlog.ts` (deneme/görev kayıtları, özet, oturum sapması), 19 test; toplam 116/116 | `768b2f0` |
| 21.10.2026 | Impressum sayfası (DE/EN/TR); ortak header/footer bileşenleri; footer'daki 404 veren foundercheck.de linkleri kaldırıldı | `a58d027` |
| 21.10.2026 | Vercel ↔ GitHub bağlandı; ilk production deploy canlı (`ortsrank.foundercheck.de`) | `b9034fe` |
| 21.10.2026 | Sohbetteki ROADMAP 3.3 birleştirmesi (`7f9dc03`, `51bd25a`) VS Code dalıyla birleştirildi; Aşama 2 ürün maddeleri yerine taşındı, geçmiş tablosu sıralandı; WUA-0 alt maddelere ayrıldı | `2874124` |
| 21.10.2026 | ROADMAP 3.3: Reklam ve Ciro Analizi (WUA) modülü; veri ihtiyaç belgesi 1.1 repoya alındı | `7f9dc03` |
| 21.10.2026 | Adım 6: `parse.ts` + `types.ts` (organik/reklam/local_pack, domain normalleştirme, hedef eşleme), 28 test; toplam 97/97 | `17a3807` |
| 21.10.2026 | Adım 5: 5 sentetik DataForSEO yanıtı + tutarlılık testi (25 test); toplam 69/69 | `38842ef` |
| 21.10.2026 | Adım 4: `plan.ts` (proje doğrulama, görevler, oturum ataması, maliyet, tavan kontrolü), 30 test; toplam 44/44 | `c331e64` |
| 21.10.2026 | Adım 3: `geo.ts` (mesafe, dört liste + `overLimit`), 12 test; toplam 14/14 | `37b2097` |
| 21.10.2026 | Adım 2: vitest kurulumu, `npm test`, sözlük anahtar testi (2/2 geçti) | `b17f0f2` |
| 21.10.2026 | Adım 1 tamam: `exceljs` eklendi (`xlsx` yerine) | `23b8618` |
| 21.10.2026 | Adım 1 (kısmi): `tsx`, `vitest`, `dotenv` eklendi, `@types/node` ^24 | `4874f4d` |
| 21.10.2026 | Neon veritabanı Vercel üzerinden oluşturuldu ve bağlandı | `93f65ec` |
| 21.10.2026 | Anayasaya eklendi: kullanım kolaylığı, tek yerden yönetim, admin paneli (ROADMAP 3.2) | `4e9e12d` |
| 21.10.2026 | Aşama 1 planı 1.2; STATUS.md oluşturuldu | `612e3ad` |
| 21.10.2026 | ROADMAP 3.1 (dış değerlendirme sonrası) | `0fa9446` |
| 20.10.2026 | Repo, iskelet, şema, subdomain, Vercel projesi | `a4f05ac` |
