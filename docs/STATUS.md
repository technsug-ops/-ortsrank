# Ortsrank – Durum ve Checklist

> **Şu an:** Pilot 1 küçük gerçek veri denemesi tamamlandı (5 belediye, 0,12 $); sıradaki: etiket onayı, Heidenheim profil kimliği, planlı oturumlar. Önceki: Aşama 1 · Veri + talep pilotu · Aşama 1 teknik hattı adım 1–14 tamam; teslimat raporu [docs/reports/phase1-delivery.md](reports/phase1-delivery.md) değerlendirme bekliyor. Açık karar: pilot alanı (30 km / ≥10k → 66 belediye, üst sınır 30 ile fiilen 17 km)
> **Son güncelleme:** 21.10.2026
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
- [ ] Almanca PDF rapor şablonu
- [ ] İlk rapor elle gözden geçirildi

### İş hattı (Halil)

- [x] Pilot çerçevesi: Terrassenüberdachung, Frankfurt/Rhein-Main, 20–30 belediye (21.10.2026)
- [x] **Pilot 1: Arbeitsbühnenvermietung, Heidenheim çevresi** (Halil'in kararı, 21.10.2026); Terrassenüberdachung sonraki pilot. Ayarlar ve taslaklar: [PILOT_SETUP.md](PILOT_SETUP.md)
- [x] Pilot 1 keyword keşfi: 4 sorgu Heidenheim'dan, 0,016 $ (yerel keşif taraması, 21.10.2026)
- [ ] Pilot 1 kesin keyword seti (öneri: Arbeitsbühne mieten ×3, Hubarbeitsbühne mieten, Scherenbühne mieten, Arbeitsbühne mieten in der Nähe)
- [-] Pilot 1 alt nüfus eşiği / 30 belediyelik tarama – Halil'in kararıyla bu pilot için geçersiz; yerine küçük gerçek veri denemesi
- [x] **Pilot 1 küçük gerçek veri denemesi** (21.10.2026): 5 belediye (Heidenheim, Steinheim, Aalen, Ulm, Babenhausen), 30/30 görev, 0,12 $ (0,024 $ / belediye), bakiye 0,94 → 0,82 $; oturumlar peş peşe → `technical_validation`. Özet [reports/pilot1-small-run.md](reports/pilot1-small-run.md); tam rapor git dışında
- [ ] Pilot 1 planlı oturumlarla ölçüm (09:00 / 13:00 / 18:00) – reklam gözlemi için
- [ ] Pilot 1 Heidenheim şubesinin Google profili (tam ad, adres, bağlantı, kimlik) doğrulanmış kaynaktan
- [ ] Pilot 1 rakip etiket taslağı onayı (`data/competitor-labels.pilot1.draft.json`)
- [-] DataForSEO'ya 50 $ yükleme – Halil'in talimatıyla uygulanmadı; yalnızca mevcut bakiye kullanılıyor (kalan 0,82 $)
- [~] Pilot keywordleri (3–5), işletmelerin gerçek hizmetlerine göre – taslak [PILOT_SETUP.md](PILOT_SETUP.md) bölüm 1 (Google önerilerinden), Halil'in onayı bekleniyor
- [~] Pilot alanı kararı (taslak [PILOT_SETUP.md](PILOT_SETUP.md) bölüm 2; önce pilot işletmenin konumu): 30 km / ≥10.000 nüfusta 66 belediye var; üst sınır 30 iken seçim 17,4 km'de bitiyor. Seçenekler: üst sınırı artırmak, nüfus eşiğini yükseltmek (30 km / ≥20.000 → 34) veya yarıçapı küçültmek (25 km / ≥20.000 → 29)
- [ ] Pilot işletme 1 (aday: UG-ALU – katılım netleşmeli)
- [ ] Pilot işletme 2
- [ ] Pilot işletme 3
- [ ] Pilot işletme 4–5 (isteğe bağlı)
- [ ] Rapor görüşmeleri yapıldı
- [ ] Her pilot için 5 kayıt dolduruldu (yeni bilgi, değişen öncelik, işi kim yaptı, ödeme, süre)
- [ ] Pilot sözleşmesi ve Datenschutz taslağı (Aşama 2 hazırlığı)

### WUA-0 · Reklam ve ciro veri sözleşmesi – [ROADMAP](ROADMAP.md) bölüm 12

Tarama teknik hattından bağımsız, Aşama 1 boyunca paralel; kod gerektirmez. Kabul: net/brüt, para birimi, tarih temeli, dönem ve kanal kapsamı belirli; gerçek müşteri verisinden önce erişim ve işleme koşulları belirlenmiş.

- [x] Müşteri veri ihtiyaç belgesi 1.1: veri alanları, net/brüt, para birimi ve birim, tarih temeli, kısmi ay, kanal kapsamı tanımlı (21.10.2026, `7f9dc03`)
- [ ] İlk görüşme formu (~45 dk: hedefler, hizmet alanı, aksiyonlar, bütçe kararları, fiyat, kapasite)
- [ ] Veri kalite kuralları yazılı (eksik ay, tekrar kayıt, storno/iade, kaynak toplamı uzlaştırma)
- [ ] Gerçek müşteri verisinden önce erişim ve işleme koşulları (amaç, roller, alt işleyenler, saklama/silme, gerekirse AVV)
- [ ] WUA pilot adayı: dosya verisi (Ads dışa aktarımı + aylık gerçek ciro) ve AVV kontrolü

### Kapı 1

- [ ] Ölçüm ölçütleri karşılandı (kayıt bütünlüğü %100, geçerli sonuç ≥ %98)
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
| 21.10.2026 | Pilot 1 küçük canlı deneme: 5 belediye, 30/30, 0,12 $; 17 rakip kapsaması bulgusu (etiketler taslak); organik boşluk etiket onayı olmadan üretilemedi; SERP varyantı gözlemi. Kod: açık belediye listesi, `--labels-draft`, teknik denemede reklam oranı gizli; toplam 326/326 | bu commit |
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
