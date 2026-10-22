# Pilot 1 – Teknik doğrulama ve ölçüm planı: karar taslağı

> 22.10.2026 · Sürüm 3 · **Yalnızca karar taslağı.** Hiçbir ölçüm, sorgu veya harcama başlatılmadı; tarih belirlenmedi; kod yazılmadı. Anonim: işletme adı yok.
> Dayanak: [Aşama 1 denetimi](phase1-status-audit.md) T5, T7, T9–T12 · [PHASE1_PLAN](../PHASE1_PLAN.md) 5.3, 5.7, 6 · [Pilot 1 özeti](pilot1-small-run.md).
> Sürüm 2: elle ayrıştırma kontrolünün gerçek durumu, koordinat ↔ şehir kodu deneyi ve günler arası değişkenlik tek bir veri toplama planında birleştirildi. Sürüm 3: elle kontrolde üç yaklaşım ayrıldı (bölüm 1); hata durumunda yapılacaklar netleştirildi.

## 1. Elle ayrıştırma kontrolü (denetim T9)

ROADMAP 6: „50 rastgele yanıtta elle kontrol, hata yok".

| | Durum |
| --- | --- |
| Arşivdeki başarılı SERP yanıtları | **42**: `trial-20261021` (çalıştırma `…-1d4ae0`) 8 · keşif taraması 21.10.2026 (`…-07fd82`) 4 · Pilot 1 `pilot1-small-20261021` (`…-b5a646`) 30. İki Google Maps yanıtı ayrı uç noktadır, sayılmaz |
| Şartı karşılayan belgelenmiş elle kontrol | **0.** Tek kayıt `c1c9098` commit mesajı: trial çalıştırmasında „10/10 parsed organic rows match the raw responses" (sıra, mutlak sıra, URL, domain). Hangi yanıtlar olduğu ve diğer alanlar kayıtlı değil; ön kontrol sayılır, 50'ye eklenmez |
| Kontrol edilmemiş mevcut yanıtlar | 42'nin tamamı (yukarıdaki üç çalıştırma) |
| Gereken yeni yanıt | Yaklaşıma bağlı (aşağıda). **Mevcut 42 yanıtın kontrolüne yeni veri beklemeden başlanabilir.** Sırf sayıyı doldurmak için sorgu önerilmez; yeni yanıtlar bölüm 3'teki, başka kabul maddelerine hizmet eden ölçümlerden gelir |

**Üç yaklaşım (ayrı tutulur):**

| Yaklaşım | Ne zaman mümkün | ROADMAP 6 „50 rastgele yanıt" açısından |
| --- | --- | --- |
| 1 · Mevcut 42 yanıtın tümünün kontrolü | Hemen | Tek başına karşılamaz (42 < 50). Hata aramak ve kontrol yöntemini sınamak için yararlı |
| 2 · Havuz en az 50 olunca 50 kaydın tümünün kontrolü (tam sayım) | Planlanmış ölçümlerden en az 8 yeni başarılı yanıt geldiğinde | Rastgele seçim değil, havuzun tamamı. Eşdeğer sayılıp sayılmayacağı **açık karar**; yanıtların az sayıda ölçüm gününden geldiği not edilir |
| 3 · Havuz 50'den büyükse önceden kaydedilmiş tohumla (`seed`) 50 rastgele yanıt | Örneğin bölüm 3 planından sonra (havuz 42 + 110 = 152) | Metne en yakın yaklaşım |

Hangi yaklaşımın şartı karşıladığına Halil karar verir; daha zayıf bir kontrol sessizce eşdeğer sayılmaz. Yaklaşım 1, yaklaşım 2 ve 3'ün yerine geçmez ama onları engellemez: önce kontrol edilen yanıtlar da sonraki seçime girebilir ve yeniden kontrol edilir.

**Örneklem seçimi (yaklaşım 3):** başarılı yanıtların ham dosya yolları sıralanır; seçimden önce kaydedilen bir tohumla 50 yanıt rastgele seçilir. Seçim listesi kontrolden önce dondurulur.

**Karşılaştırılan alanlar (yanıt başına):**

| Grup | Ham yanıt alanı | Ayrıştırılmış karşılığı |
| --- | --- | --- |
| Görev | `status_code`, `tasks[0].status_code` | görev durumu |
| Parametreler | `data.keyword`, `location_coordinate`, `language_code`, `device`, `os`, `depth` | gönderilen ve kaydedilen değer |
| Organik | her `organic` öğesi: `rank_group`, `rank_absolute`, `domain`, `url`, `title` | sıra, mutlak sıra, normalleştirilmiş domain, URL, başlık; öğe sayısı |
| Hedef | hedef domainin en iyi organik sırası veya yokluğu | durum tablosu hücresi |
| Reklam | `paid` öğe sayısı ve `rank_group` | reklam satırları |
| Local Pack | her öğe: `rank_group`, `title`, `domain`, `cid`, `svid` → `/g/` | Local Pack satırları ve kimlik çözümü |
| Diğer | `item_types`; ayrıştırılmayan türlerin sayısı | `issues` / sayım |

**Kayıt:** yanıt başına bir satır – `runId/taskKey/attempt`, ham dosyanın SHA-256 değeri, kontrol eden kişi (rol), tarih, alan grubu başına `ok` / `farklı` ve açıklama. Gerçek domainler içerdiği için tablo git dışında (`data/parse-checks/`); repoya yalnızca anonim özet (yaklaşım, kontrol edilen sayı, hata sayısı, seçim tohumu) girer. Şart: 50/50 hatasız.

**Hata bulunursa:** hata kaydı açılır. Önce nedeni (ayrıştırıcı, ham veri, kontrol tablosu) ve etkilenen kapsam belirlenir: aynı hata türü arşivdeki diğer yanıtlarda var mı, durum tablosunu, kuralları veya raporu etkiliyor mu? Düzeltme yapılır ve etkilenen yanıtlarda doğrulanır; kontrol bundan sonra tekrarlanır. **Yalnızca yeni örneklem seçmek hata kaydını kapatmaz.**

**Kim:** seçim listesi ve yan yana karşılaştırma tablosu geliştirme ajanı tarafından hazırlanabilir; „elle kontrol" bir insanın tabloyu ham yanıtla karşılaştırmasıdır (kimin yapacağı Halil'in kararı).

## 2. Koordinat ↔ şehir kodu karşılaştırması (denetim T10)

**Cevaplanacak soru:** Aynı anda, aynı keyword ve cihazla belediye merkez koordinatıyla (`location_coordinate`, 200 mm) yapılan sorgu ile DataForSEO şehir koduyla (`location_code`) yapılan sorgu ne kadar farklı sonuç veriyor? Ölçü: ilk 10 örtüşmesi, hedef domainin sırası, Local Pack'in varlığı. Bu deney hangi yöntemin „doğru" olduğunu göstermez; yalnızca yöntem farkının büyüklüğünü, aynı yöntemin peş peşe tekrarı arasındaki farkla karşılaştırarak gösterir (Pilot 1'de aynı saniyede gönderilen ölçümlerde de farklı sonuç sayfaları görüldü).

**Kapsam uyumsuzlukları:**

- Şehir kodları Google'ın konum hedefleridir; Destatis belediyesiyle (AGS) birebir eşleşmeyebilir: şehir ↔ belediye, ilçe veya posta kodu düzeyi.
- Aynı adlı yerler: ör. Babenhausen hem Bavyera'da (09778115) hem Hessen'de var; Ulm ↔ Neu-Ulm; Steinheim am Albuch ↔ başka Steinheim'lar. Eşleştirme ad + eyalet + koordinat yakınlığıyla yapılır; belirsiz olan alınmaz.
- Küçük belediyeler için kod bulunmayabilir. Kodu olmayan veya belirsiz eşleşen belediye **deneyden çıkarılır ve gerekçesiyle raporlanır**; başka bir yerin koduyla doldurulmaz.
- Kod listesinin kaynağı ve güncelliği deneyden önce belgelenir (sağlayıcının konum listesi; bu pakette sorgulanmadı).

**Tasarım (öneri):** 10 belediye (5 Pilot 1 + kodu net olan 5 belediye) × ana keyword × 2 yöntem × 2 tekrar = **40 görev**, yöntemler aynı zaman diliminde dönüşümlü gönderilir.

**Uygulama:** Ana ürün akışını (proje şeması, `scan.ts`) genişletmek gerekmez; **ayrı bir doğrulama betiği yeterli** görünüyor: mevcut istemci, bütçe defteri ve deneme kayıtlarını kullanır, yalnızca istek gövdesinde koordinat yerine şehir kodu gönderir, gönderilen kodun yanıtta geri döndüğünü kontrol eder ve çıktısını ayrı bir klasöre yazar. İstek oluşturucu ve kod eşleştirmesi için test gerekir. **Bu pakette uygulanmadı**; tarama kodu şu an yalnızca `location_coordinate` ile sorgu yapıyor.

## 3. Birleşik veri toplama planı

Bütün ölçümler Pilot 1'in 5 belediyesi ve 4 keywordüyle, aynı ayarlarla (mobil/Android, Almanca, Google Almanya, derinlik 20, nokta yarıçapı 200 mm). Saatler Europe/Berlin; **25.10.2026'da kış saatine geçiş** (UTC+2 → UTC+1), kayıtlar yerel saate göre değerlendirilir.

| Ölçüm | Ne zaman | Görevler | Hizmet ettiği kabul maddesi |
| --- | --- | --- | --- |
| **M1** | 1. gün 09:00 · 13:00 · 18:00 | 09:00 ana keyword × 5 = 5 · 13:00 dört keyword × 5 = 20 · 18:00 ana keyword × 5 = 5 → **30** | T12 reklam örneklemesi (ana keyword, 3 saat); ana keyword için **tek gün içi** değişim; T5 ayrı başlatılan oturumların ortak defteri; T7; T9 havuzu |
| **M2** | 2. gün 13:00 | dört keyword × 5 → **20** | T11 günler arası değişkenlik (13:00); T12 ek örneklem; T7; T9 havuzu |
| **M3** | 3. gün 13:00 | dört keyword × 5 → **20** | T11 (üç gün tamamlanır); T12; T7; T9 havuzu |
| **V** | M1 ile aynı gün, ayrı saat (ör. 15:00) | **40** (bölüm 2) | T10 koordinat ↔ şehir kodu |
| **P** | Mevcut 42 için hemen; diğer yaklaşımlar M1–M3 sonrası | sorgu yok | T9: bölüm 1'deki yaklaşıma göre |

**Neyi ölçer, neyi ölçmez:**

- Günler arası değişkenlik: 13:00'te üç gün, dört keyword, 5 belediye; ilk 10 örtüşmesi ve sıra farkı ölçülen değer olarak raporlanır. **Tek günlük M1 bunun yerine geçmez.**
- Gün içi değişim yalnızca ana keyword için ve yalnızca M1 gününde. Diğer üç keyword her gün yalnızca 13:00'te ölçülür; **bu keywordlerde gün içi karşılaştırma yapılamaz.**
- Reklam görülme sıklığı keyword ve belediye başına örneklem sayısıyla verilir: ana keyword 5 örneklem (M1'de 3 + M2 + M3), diğerleri 3 örneklem.
- Giderilmeyenler: T13 sayfa incelemesi (P1-A01 ayrı yapıldı), 20–30 belediye (D2), diğer işletmeler, talep ve gelir.

**Yapılandırma:** kodda örneklem n, oturum n'e düşer. Oturumlar `1 = 13:00`, `2 = 09:00`, `3 = 18:00` tanımlanır. Bu dağılım plan fonksiyonuyla API'siz hesaplandı (13:00'te 20, 09:00 ve 18:00'de 5'er görev). M2 ve M3 yalnızca oturum 1'i (13:00) çalıştırır. Her gün kendi `scanId`'siyle (varsayılan `<YYYYMMDD>-<proje>`) ve kendi tavanıyla çalışır; aynı oturumun farklı günlerde aynı `scanId` altında tekrarlanması doğrulanmadı. Oturumlar kendi saatlerinde ayrı başlatılır; `--back-to-back` kullanılmaz. Başlamadan önce `--dry-run` ile görev dağılımı yeniden doğrulanır.

## 4. Maliyet

Fiyat varsayımı: Live 0,002 $ / SERP, derinlik 20 = **0,004 $ / deneme** – 21.10.2026'da canlı yanıttaki `cost` alanıyla doğrulandı; şehir koduyla sorgunun aynı fiyatta olduğu varsayılır ve ilk yanıtta kontrol edilir. Beklenen = %20 tekrar varsayımı; en kötü = görev başına en fazla 3 deneme.

| Ölçüm | Görev | Beklenen | En kötü durum | Önerilen tavan `SCAN_MAX_USD` |
| --- | --- | --- | --- | --- |
| M1 | 30 | 0,144 $ | 0,36 $ | 0,40 $ |
| M2 | 20 | 0,096 $ | 0,24 $ | 0,25 $ |
| M3 | 20 | 0,096 $ | 0,24 $ | 0,25 $ |
| V | 40 | 0,192 $ | 0,48 $ | 0,50 $ |
| **Çekirdek M1–M3** | 70 | 0,336 $ | 0,84 $ | 0,90 $ |
| **Tümü M1–M3 + V** | 110 | 0,528 $ | 1,32 $ | 1,40 $ |

**Bakiye:** son kayıtlı bakiye 0,82 $ ([STATUS](../STATUS.md), 21.10.2026, Pilot 1 ölçümünden sonra); ardından 2 Google Maps sorgusu, 0,004 $ kayıtlı. **Güncel bakiye bilinmiyor** – bu pakette sağlayıcı hesabına erişilmedi.

- Çekirdek planın beklenen maliyeti (0,336 $) son kayıtlı bakiyeye sığar; **en kötü durumu (0,84 $) ve önerilen tavanları sığmaz.**
- Seçenek 1: bakiye yüklemesi (Halil'in kararı).
- Seçenek 2: tavanları bakiyeye göre düşürmek (ör. 0,36 + 0,22 + 0,22 = 0,80 $). Tekrar denemeleri beklenenden çok olursa kalan görevler `budget_exhausted` gerekçesiyle iptal edilir ve kayıtlı kalır; o günün verisi eksik olur.
- V, son kayıtlı bakiyeyle çekirdek planla birlikte karşılanamaz; ayrı karar.

Bu hesap yalnızca veri toplama maliyetidir; elle kontrol, inceleme ve açıklama süresi ayrıca kaydedilir.

## 5. Mevcut teknik denemeyle karşılaştırmanın sınırları

- 21.10.2026 ölçümü ≈ 14:49 UTC'de, bütün oturumlar ~35 saniye içinde yapıldı (`technical_validation`). Yeni ölçümlerle karşılaştırma farklı günlerin tekil ölçümlerini karşılaştırır; tek başına değişkenlik ölçüsü değildir.
- Ayarlar aynı tutulduğunda dönem karşılaştırma şartı (ROADMAP 6) sağlanır; saatler eşleşmez (14:49 UTC ↔ 09/13/18 Europe/Berlin), bu not edilir.
- Arada sitede veya profillerde bir değişiklik yapılırsa (aksiyon kaydı), sonuç „işlem + sonrasındaki değişim" olarak yazılır; nedensellik iddiası yok.

## 6. Başlatmak için Halil'den gereken kararlar

1. Kapsam: çekirdek (M1–M3) / çekirdek + V / yalnızca M1 / hiçbiri.
2. Üç ölçüm günü (ardışık iş günleri önerilir) ve V'nin saati.
3. Bakiye: güncel panel bakiyesinin teyidi; yükleme mi, düşük tavan mı.
4. Oturumları kimin, hangi saatte başlatacağı (Aşama 1'de elle başlatma yeterli).
5. V için: ayrı doğrulama betiğinin yazılması (kod + test) ve şehir kodu listesinin kaynağı.
6. P için: elle kontrolü kimin yapacağı, hangi yaklaşımın (bölüm 1) şartı karşıladığı ve sonucun kim tarafından kabul edileceği. Mevcut 42'nin kontrolüne bu kararı beklemeden başlanabilir.
7. İsteğe bağlı, M1'den önce: `check_url` içindeki `uule` noktasının her ölçümde kaydı ve `os` parametresinin otomatik karşılaştırmaya eklenmesi (küçük kod değişikliği; denetim T8).
