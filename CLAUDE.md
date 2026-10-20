@AGENTS.md

# Ortsrank – Çalışma Kuralları

Bu repo Ortsrank'ın kodudur: bölgesel hizmet veren işletmelerin Google'da hangi belediyelerde rekabetin gerisinde kaldığını gösteren araç. İşleten: TechNS UG (haftungsbeschränkt).

## Önce oku

- `docs/STATUS.md` – **nerede olduğumuz ve checklist.** Her tamamlanan adımdan sonra güncelle: kutuyu işaretle, tarih ve commit ekle, "Şu an" satırını ve günlüğü güncelle. Güncellemeyi o adımın commit'ine dahil et.
- `docs/ROADMAP.md` – aşamalar, ilkeler, kanıt seviyeleri, ölçüm ölçütleri (sürüm 3.1)
- `docs/PHASE1_PLAN.md` – şu anki teknik iş: Aşama 1 scriptleri
- `src/db/schema.ts` – veri modeli

## Değişmez ilkeler

1. **Gerçek veri.** Ölçüm birimi Destatis belediyeleridir (AGS). Eksik veri uydurulmaz, komşu yerle doldurulmaz; `scan_mode = "none"` + gerekçe.
2. **Temsilî nokta.** Her belediye tek merkez koordinatından ölçülür. DataForSEO `location_coordinate` yarıçapı **milimetre**dir (199–199999) ve hizmet alanı yarıçapıyla (km) karıştırılmaz.
3. **İzlenebilirlik.** Her sonuç ham yanıta, zamana, koordinata ve cihaza bağlı kalır. Ham yanıt silinmeden önce ayrıştırma yapılmaz.
4. **Kanıt seviyeleri.** Gözlem = bir kaynakta doğrudan doğrulanmış olgu (kaynak türü seviyeyi değiştirmez). Çıkarım = gözlemlerin yorumu. Hipotez = sınanmamış neden/etki. "Bulunamadı" ≠ "görünmüyor".
5. **Aksiyonlar önce inceleme.** Rakipte sayfa bulunması tek başına "sayfa açın" demek değildir.
6. **Vaat yok.** Doğruluk sınırı veya nedensellik iddiası yazılmaz.
7. **Maliyet tavanı.** Canlı API çağrısı yalnızca `--live` ile ve `SCAN_MAX_USD` altında yapılır. Varsayılan her zaman dry-run.
8. **Gizli bilgi yok.** Anahtarlar, gerçek işletme verileri ve `runs/`, `data/` çıktıları commit edilmez.

## Kod kuralları

- TypeScript, katı tipler; dış veriler zod ile doğrulanır.
- Kullanıcıya görünen metin kodda yazılmaz: `src/i18n/dictionaries/{de,en,tr}.json`.
- Müşteri verisi içeren her sorgu `organization_id` ile filtrelenir.
- Her yeni modül testle gelir (vitest). Testler geçmeden sonraki adıma geçilmez.
- Küçük, açıklamalı commitler.
- Next.js 16 kullanılıyor; API'ler eğitim verisinden farklı olabilir. Kod yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehberi oku (bkz. AGENTS.md).

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # production build
npm run lint
npm test           # vitest (Aşama 1'de eklenecek)
npx drizzle-kit generate
```
