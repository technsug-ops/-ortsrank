# Ortsrank – Durum ve Checklist

> **Şu an:** Aşama 1 · Veri + talep pilotu · teknik uygulama başlıyor (VS Code)
> **Son güncelleme:** 21.10.2026
> **Kaynaklar:** [ROADMAP](ROADMAP.md) (sürüm 3.2) · [Aşama 1 planı](PHASE1_PLAN.md) (sürüm 1.2)

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
- [ ] Neon bölgesinin Frankfurt olduğu doğrulandı; yerel `.env.local` hazır
- [ ] Migration uygulandı (Aşama 1 adım 11'deki şema değişikliğinden sonra)
- [ ] Vercel ↔ GitHub bağlantısı (Settings → Git → Connect)
- [ ] İlk production deploy; `https://ortsrank.foundercheck.de` açılıyor ve SSL geçerli
- [ ] Repo adı `ortsrank` olarak düzeltildi (isteğe bağlı)

---

## Aşama 1 · Veri + talep pilotu

### Teknik hat (VS Code) – [PHASE1_PLAN.md](PHASE1_PLAN.md) bölüm 7

- [ ] 1. Bağımlılıklar: `tsx`, `vitest`, `xlsx`, `dotenv`
- [ ] 2. Vitest kurulumu, `npm test`
- [ ] 3. `geo.ts` + testler (dört liste)
- [ ] 4. `plan.ts` + testler (beklenen / en kötü durum, oturum ataması)
- [ ] 5. Sentetik örnek yanıt fixture'ları
- [ ] 6. `parse.ts` + testler
- [ ] 7. `runlog.ts` + testler (deneme ve görev kayıtları)
- [ ] 8. Bütçe defteri + testler (eşzamanlılık, oturumlar arası, yeniden başlatma, yüksek ücret)
- [ ] 9. `client.ts` + mock testler
- [ ] 10. `scan.ts` dry-run uçtan uca
- [ ] 11. Şema: `lat`, `lng`, `population` null kabul eder; migration
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
- [ ] Aşama 3 · Admin paneli v2 (kullanıcılar, planlar ve kota, ödeme durumu, sistem sağlığı, içerik ve hukuk metinleri, audit log)

---

## Günlük

| Tarih | Ne oldu | Commit |
| --- | --- | --- |
| 21.10.2026 | Neon veritabanı Vercel üzerinden oluşturuldu ve bağlandı | `93f65ec` |
| 21.10.2026 | Anayasaya eklendi: kullanım kolaylığı, tek yerden yönetim, admin paneli (ROADMAP 3.2) | `4e9e12d` |
| 21.10.2026 | Aşama 1 planı 1.2; STATUS.md oluşturuldu | `612e3ad` |
| 21.10.2026 | ROADMAP 3.1 (dış değerlendirme sonrası) | `0fa9446` |
| 20.10.2026 | Repo, iskelet, şema, subdomain, Vercel projesi | `a4f05ac` |
