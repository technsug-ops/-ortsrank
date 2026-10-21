# Ortsrank – Durum ve Checklist

> **Şu an:** Aşama 1 · Veri + talep pilotu · adım 6 tamam; sıradaki adım 7 (`runlog.ts` + testler)
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
- [ ] Neon bölgesinin Frankfurt olduğu doğrulandı
- [ ] Migration uygulandı (Aşama 1 adım 11'deki şema değişikliğinden sonra)
- [ ] Vercel ↔ GitHub bağlantısı (Settings → Git → Connect)
- [ ] İlk production deploy; `https://ortsrank.foundercheck.de` açılıyor ve SSL geçerli
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
- [ ] 7. `runlog.ts` + testler (deneme ve görev kayıtları)
- [ ] 8. Bütçe defteri + testler (eşzamanlılık, oturumlar arası, yeniden başlatma, yüksek ücret)
- [ ] 9. `client.ts` + mock testler
- [ ] 10. `scan.ts` dry-run uçtan uca
- [ ] 11. Şema: `lat`, `lng`, `population` null kabul eder; ayrıca `serp_results.domain` null kabul eder (web sitesi olmayan local_pack işletmesi, adım 6'da görüldü); migration
- [ ] 12. Gerçek Destatis dosyası indirildi, sütun eşlemesi doğrulandı, `import-settlements.ts`
- [ ] 13. Pilot dry-run: gerçek belediye listesi + maliyet
- [ ] 14. Teslimat raporu `docs/reports/phase1-delivery.md`
- [ ] Teslimat raporu bu sohbette değerlendirildi

### Canlı doğrulama

- [ ] DataForSEO hesabı açıldı, deposit yatırıldı, panel harcama limiti ayarlandı
- [ ] Anahtarlar `.env.local` ve Vercel ortam değişkenlerinde
- [ ] Küçük canlı deneme: 2 belediye × 2 keyword, teknik doğrulama
- [ ] Gerçek `cost` ile fiyat varsayımı doğrulandı
- [ ] `local_pack` yanıt yapısı doğrulandı
- [ ] Tam pilot taraması (oturumlu)
- [ ] Değişkenlik ölçümü (3 gün)

### Rapor

- [ ] Kurallar v0 (kanıt seviyeli)
- [ ] Sayfa taraması (rakip + müşteri sitesi)
- [ ] Almanca PDF rapor şablonu
- [ ] İlk rapor elle gözden geçirildi

### İş hattı (Halil)

- [x] Pilot çerçevesi: Terrassenüberdachung, Frankfurt/Rhein-Main, 20–30 belediye (21.10.2026)
- [ ] Pilot keywordleri (3–5), işletmelerin gerçek hizmetlerine göre
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
| 21.10.2026 | Sohbetteki ROADMAP 3.3 birleştirmesi (`7f9dc03`, `51bd25a`) VS Code dalıyla birleştirildi; Aşama 2 ürün maddeleri yerine taşındı, geçmiş tablosu sıralandı; WUA-0 alt maddelere ayrıldı | bu commit |
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
