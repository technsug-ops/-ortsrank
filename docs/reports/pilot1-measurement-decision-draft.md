# Pilot 1 – Planlı ölçüm: karar taslağı

> 22.10.2026 · **Yalnızca karar taslağı.** Ölçüm başlatılmadı, onaylanmadı, tarihi belirlenmedi. Anonim: işletme adı yok.
> Dayanak: [PHASE1_PLAN](../PHASE1_PLAN.md) 5.3, 5.7, 6 · [Aşama 1 denetimi](phase1-status-audit.md) T9, T11, T12 · [Pilot 1 özeti](pilot1-small-run.md).

## 1. Cevaplanacak sorular

1. **Reklam görülme sıklığı:** Ana keyword „Arbeitsbühne mieten“ için 5 belediyede, üç saatte reklam görülüyor mu? Sonuç örneklem sayısıyla yüzde olarak verilir (ROADMAP 6).
2. **Ana keyword için gün içi değişim (tek gün):** Aynı gün 09:00, 13:00 ve 18:00'deki ilk 10 örtüşmesi ve sıra farkı.
3. **Elle ayrıştırma kontrolü için örneklem:** Arşivdeki 42 başarılı yanıta 30 yeni yanıt eklenir; 50 rastgele yanıtın elle kontrolü (denetim T9) bu sayede mümkün olur.

Bu ölçüm **günler arası değişkenliği** ölçmez (tek gün). Diğer üç keyword yalnızca 13:00'te ölçülür; **bu keywordlerde gün içi karşılaştırma yapılamaz**, tek ölçüm yalnızca o andaki durumu gösterir.

## 2. Kapsam

| | |
| --- | --- |
| Belediyeler | Heidenheim an der Brenz (08135019) · Steinheim am Albuch (08135032) · Aalen (08136088) · Ulm (08421000) · Babenhausen (09778115) – Pilot 1 ile aynı merkez koordinatları |
| Keywordler | „Arbeitsbühne mieten“ (ana) · „Hubarbeitsbühne mieten“ · „Scherenbühne mieten“ · „Arbeitsbühne mieten in der Nähe“ |
| Ayarlar | Pilot 1 ile aynı: mobil (Android), Almanca, Google Almanya, derinlik 20, nokta yarıçapı 200 mm |
| Gün | **Belirlenmedi** (Halil'in kararı). Tek iş günü önerilir |
| Saatler (Europe/Berlin) | 09:00 · 13:00 · 18:00. 25.10.2026'dan itibaren kış saati (UTC+1): 09:00 = 08:00 UTC; öncesinde UTC+2. Kayıt saat dilimini Europe/Berlin olarak değerlendirir; ±60 dakikadan fazla sapan oturum özette işaretlenir |
| Görev dağılımı | 09:00: ana keyword × 5 belediye = **5** · 13:00: dört keyword × 5 belediye = **20** · 18:00: ana keyword × 5 = **5** · toplam **5 × (3 + 3) = 30** |
| Yapılandırma notu | Kodda örneklem n, oturum n'e düşer (PHASE1_PLAN 5.7). Diğer keywordlerin 13:00'te ölçülmesi için oturumlar `1 = 13:00`, `2 = 09:00`, `3 = 18:00` tanımlanır. Bu dağılım plan fonksiyonuyla API'siz hesaplandı: 13:00'te 20, 09:00 ve 18:00'de 5'er görev. Başlatmadan önce `--dry-run` ile yeniden doğrulanmalı |
| Çalıştırma | Her oturum kendi saatinde ayrı başlatılır (`--session 2` 09:00, `--session 1` 13:00, `--session 3` 18:00), aynı `scanId` ile; üç oturum tek bütçe defterini paylaşır. `--back-to-back` kullanılmaz; aksi halde ölçüm yine `technical_validation` olur |

## 3. Maliyet

Fiyat varsayımı: Live 0,002 $ / SERP, derinlik 20 = 2 SERP = **0,004 $ / deneme**. Bu değer 21.10.2026'da canlı yanıttaki `cost` alanıyla doğrulandı; sağlayıcı fiyatı değişmiş olabilir, başlangıçta tekrar kontrol edilir.

| Senaryo | Görev | Beklenen (%20 tekrar varsayımı) | En kötü durum (en fazla 3 deneme) | Önerilen tavan `SCAN_MAX_USD` |
| --- | --- | --- | --- | --- |
| **A · Öneri: tek gün 9/13/18, diğerleri 13:00** | 30 | 0,144 $ | 0,36 $ | 0,40 $ |
| B · Tek gün, dört keywordün tümü üç saatte | 60 | 0,288 $ | 0,72 $ | 0,80 $ |
| C · A'nın üç farklı günde tekrarı (günler arası değişkenlik için) | 90 | 0,432 $ | 1,08 $ | 1,10 $ |

Son kayıtlı hesap bakiyesi 0,82 $ (21.10.2026, Pilot 1 sonrası; ardından 2 Maps sorgusu, 0,004 $). Güncel bakiye panelden doğrulanmalı. A ve B mevcut bakiyeyle karşılanır; C bakiye yüklemesi gerektirir (bu pakette yapılmadı).

Bu hesap yalnızca veri toplama maliyetidir; inceleme, açıklama ve insan süresi ayrıca kaydedilir.

## 4. Mevcut teknik denemeyle karşılaştırmanın sınırları

- 21.10.2026 ölçümü ≈ 14:49 UTC'de, bütün oturumlar ~35 saniye içinde yapıldı (`technical_validation`). Yeni ölçümle karşılaştırma iki farklı günün tekil ölçümlerini karşılaştırır; fark, gün içi veya günler arası değişkenliğin ölçüsü değildir ve bir işleme bağlanamaz.
- Ayarlar (keyword, koordinat, cihaz, dil, derinlik) aynı tutulursa dönem karşılaştırma şartı (ROADMAP 6) sağlanır; saatler eşleşmez (14:49 UTC ↔ 09/13/18 Europe/Berlin), bu not edilir.
- Arada işletme tarafında bir değişiklik yapılırsa (aksiyon kaydı), sonuç „işlem + sonrasındaki değişim" olarak yazılır; nedensellik iddiası yok.

## 5. Giderdiği ve gidermediği teknik eksikler

| Denetim maddesi | Bu ölçümle |
| --- | --- |
| T12 Reklam örneklemesi (ana keyword, 3 farklı saat) | **Giderilir** (5 belediye × 3 saat = 15 örneklem) |
| T9 50 yanıtta elle ayrıştırma kontrolü | **Mümkün olur** (42 + 30 = 72 yanıt); kontrolün kendisi ayrı iş |
| T5 Ayrı başlatılan oturumların ortak bütçe defteri | **Canlıda gösterilir** |
| T7 Geçerli sonuç oranı | Ek kanıt; pilot ölçeği (≥ 120 görev) değil |
| T11 Günler arası değişkenlik | **Giderilmez** (yalnızca senaryo C) |
| Diğer üç keywordde gün içi değişim | **Giderilmez** (tek ölçüm, 13:00) |
| T10 Koordinat ↔ şehir kodu karşılaştırması | **Giderilmez.** Tarama kodu şu an yalnızca `location_coordinate` ile sorgu yapıyor; şehir koduyla sorgu için kod değişikliği ve ayrı karar gerekir |
| T13 Müşteri ve rakip sayfa incelemesi | Giderilmez |
| D2 20–30 belediye | Giderilmez |

## 6. Başlatmak için Halil'den gereken karar

1. Senaryo: A (öneri) / B / C / hiçbiri.
2. Ölçüm günü (ve C için üç gün).
3. `SCAN_MAX_USD` tavanı (öneri: A için 0,40 $) ve güncel panel bakiyesinin teyidi.
4. Oturumları kimin, hangi saatte başlatacağı (Aşama 1'de elle başlatma yeterli).
5. İsteğe bağlı: başlatmadan önce `check_url` içindeki `uule` noktasının kaydı ve `os` parametresinin karşılaştırmaya eklenmesi (küçük kod değişikliği; denetim T8).
