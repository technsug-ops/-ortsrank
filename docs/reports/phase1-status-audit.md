# Aşama 1 – Durum denetimi (kanıtlı)

> 22.10.2026 · Anonim belge: işletme ve rakip adları yok. Esas alınan: [ROADMAP](../ROADMAP.md) 3.3 bölüm 6–7 ve 12, [PHASE1_PLAN](../PHASE1_PLAN.md) 1.2, [RULES_V0](../RULES_V0.md), [STATUS](../STATUS.md), [Pilot 1 özeti](pilot1-small-run.md), [ilk teknik teslimat](phase1-delivery.md).
> Denetlenen repo durumu: `3d08f1f` (uzak dal ile aynı). Bu denetimde yeni sorgu, ölçüm, tarama veya internet araştırması yapılmadı.

## 1. Resmî aşama ve Kapı 1

| | Durum |
| --- | --- |
| Resmî aşama | **Aşama 1 · Veri + talep pilotu – devam ediyor** |
| Kapı 1 | **Geçilmedi.** Şart: ölçüm ölçütleri (ROADMAP bölüm 6) karşılandı **ve** pilot kayıtlarında en az 2 işletme rapor nedeniyle önceliğini değiştirdi |
| Ölçüm ölçütleri | Kısmen. Kayıt bütünlüğü ve parametre eşleşmesi karşılandı; 50 yanıtta elle ayrıştırma kontrolü, değişkenlik ölçümü ve reklam sıklığı **yapılmadı** (tablo 2) |
| Öncelik değiştiren işletme | **0 belgelenmiş.** Pilot 1 raporu hazır; görüşme, öncelik değişikliği, ödeme veya tekrar talebi kaydı yok |
| Pilot 1 | Teknik deneme ve raporlama **kapalı** (22.10.2026). Bu, Aşama 1'in tamamlandığı anlamına gelmez |

Pilot 1 tek işletme, 5 belediye ve 4 keyword ile yapılan küçük bir teknik denemedir. ROADMAP'teki Aşama 1 kapsamının (1 sektör, 20–30 belediye, 3–5 keyword, 3–5 işletme) yerine geçmez.

## 2. Kabul maddeleri

Durumlar: **tamamlandı** · **kısmen** (bir kısmı kanıtlı, bir kısmı açık) · **doğrulanmadı** (iş yapıldı ama şartın istediği biçimde kanıtlanmadı) · **yapılmadı**.
Sorumlu: **Geliştirme** = geliştirme ajanı (kod, belge, mevcut veriden analiz) · **Halil** = karar, işletme ilişkisi, ödeme ve dış hesaplar.
Test sayısı (407/407) yalnızca kodun beklenen davranışını gösterir; aşağıdaki ölçüm ve talep şartlarının karşılandığına kanıt sayılmaz.

### 2.1 Veri ve tarama hattı

| # | Kabul maddesi | Durum | Kanıt | Kalan iş | Sorumlu | Sonraki bağımlılık |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Destatis GV-ISys importu: AGS, ad, Bundesland, Kreis, nüfus, nüfus tarihi, koordinat; eksik koordinat ve eksik nüfus ayrı (PHASE1_PLAN 1.1, 5.1) | Tamamlandı | `10be488`; `scripts/import-settlements.ts`, `src/lib/destatis.ts`, `tests/import.test.ts`; [phase1-delivery](phase1-delivery.md) bölüm 2: `31122025_Auszug_GV.xlsx`, 10.751 belediye, eksik koordinat 0, eksik nüfus 0, gemeindefrei 202 alan hariç ve raporlu; Neon `settlements` | Yok (yeni Destatis yayınında yeniden içe aktarma) | Geliştirme | – |
| T2 | Belediye seçimi: yarıçap + nüfus, `selected` / `unknownPopulation` / `unlocatable` / `belowThreshold` / `overLimit` (PHASE1_PLAN 5.2) | Tamamlandı (kod); Pilot 1'de kullanılmadı | `37b2097`, `tests/geo.test.ts`; Rhein-Main dry-run 66 uygun → 30 seçildi, 36 `overLimit` (STATUS adım 13). Pilot 1 açık belediye listesiyle seçildi (`settlementAgs`, `9f761c3`) | 20–30 belediyelik pilot alanının seçimi | Halil (alan kararı) | Pilot alanı kararı (T15) |
| T3 | Koordinatla sorgulanamayan belediye için yedek yöntem veya `scan_mode = none` (ROADMAP Aşama 1) | Tamamlandı (mekanizma) | `tests/import.test.ts` (üç eksik veri durumu ayrı işaretli); gerçek dosyada eksik koordinat 0 | Yok | – | – |
| T4 | Görev planı: belediye × keyword × örneklem; beklenen ve en kötü durum maliyeti; beklenen maliyet tavanı aşarsa red (PHASE1_PLAN 1.2, 5.3) | Tamamlandı | `c331e64`, `tests/plan.test.ts`; Pilot 1 `plan.json` (30 görev); bu denetimde plan fonksiyonuyla (API'siz) 30 görev / 0,144 $ / 0,36 $ yeniden hesaplandı | Yok | – | – |
| T5 | Bütçe defteri: istek öncesi ayırma, `confirmed` / `uncertain`, tarama başına ortak defter, yeniden başlatma, beklenenden yüksek ücret (PHASE1_PLAN 1.3, 5.4) | Tamamlandı (testle); canlıda kısmen kullanıldı | `38c2c49`, `0209348`; `tests/budget.test.ts`, `tests/client.test.ts` ([phase1-delivery](phase1-delivery.md) bölüm 1). Canlı: Pilot 1 ortak tavan 0,40 $, harcama 0,12 $, panel bakiyesiyle tutarlı | Farklı saatlerde ayrı başlatılan oturumların aynı defteri paylaşması canlıda henüz görülmedi (yalnızca peş peşe oturum) | Geliştirme | Planlı ölçüm kararı (A1) |
| T6 | Deneme kayıtları ve kayıt bütünlüğü %100 (ROADMAP 6) | Tamamlandı | `768b2f0`, `tests/runlog.test.ts`; `runs/*/attempts.jsonl`: 5 çalıştırmada 51 denemenin tamamı sonuç durumuyla kayıtlı (9 deneme HTTP 403, hesap doğrulanmadan önce) | Yok | – | – |
| T7 | Geçerli sonuç oranı ≥ %98 (tekrar denemelerinden sonra) (ROADMAP 6) | Kısmen | Hesap doğrulandıktan sonraki 3 çalıştırma: 42/42 başarılı (trial 8, keşif 4, Pilot 1 30). Önceki 9 deneme kurulum hatası (403/40104) | Pilot ölçeğinde (≥ 120 görev) ve planlı oturumlarda ölçülmedi | Geliştirme (ölçüm sonrası özet) | Planlı ölçüm (A1), tam pilot taraması |
| T8 | Gönderilen = kaydedilen parametre (koordinat, keyword, cihaz, dil) %100, otomatik testle (ROADMAP 6) | Tamamlandı | `src/lib/dataforseo/client.ts` `compareEchoedParameters` (keyword, language_code, device, depth, location_coordinate) → `parameter_mismatch`; `tests/client.test.ts`; canlı: Pilot 1 30/30, trial 8/8 | İsteğe bağlı: `os` alanını karşılaştırmaya eklemek; `check_url` içindeki `uule` noktasını her ölçümde kaydetmek (STATUS'taki açık öneri) | Geliştirme | Bir sonraki canlı ölçümden önce |
| T9 | Ayrıştırma doğruluğu: ham yanıt ↔ ayrıştırılmış sonuç, **50 rastgele yanıtta elle kontrol, hata yok** (ROADMAP 6) | Yapılmadı | Yalnızca ön kontrol: trial çalıştırmasında 10 organik satır elle karşılaştırıldı, 10/10 (`c1c9098`; hangi yanıtlar olduğu kayıtlı değil). Şartı karşılayan belgelenmiş kontrol: 0. Otomatik: Pilot 1'de sıra numaraları 30/30 kesintisiz. **Arşivde yalnızca 42 başarılı SERP yanıtı var (< 50)**; şart mevcut arşivle karşılanamaz | 42 yanıtın elle kontrolü yapılabilir (yeni sorgu gerekmez); kalan en az 8 yanıt bir sonraki ölçümden; rastgele seçim ve kontrol tablosu hazırlanmalı | Geliştirme (seçim, tablo) · Halil (elle kontrolün kim tarafından yapıldığının kabulü) | Planlı ölçüm (A1) |
| T10 | Koordinat yöntemi: 10 belediyede koordinat sorgusu ile şehir kodu (`location_code`) sorgusunun karşılaştırılması (ROADMAP Aşama 1) | Yapılmadı | Kısmi: gönderilen `location_coordinate` 30/30 yanıtta aynen dönüyor; `check_url` içindeki `uule` noktası 20–110 m farklı ([pilot1-small-run](pilot1-small-run.md) „Konum mantığı"). Bu, ölçümün merkez koordinatıyla **istendiğini** gösterir; Google'ın bu noktayı kullandığını veya şehir koduyla farkı göstermez | 10 belediye × 2 yöntem karşılaştırma ölçümü (yeni sorgular, ayrı karar) | Geliştirme (plan) · Halil (onay) | Ölçüm kararı |
| T11 | Sonuç değişkenliği: aynı sorgu, aynı nokta, farklı zamanlarda (ör. 3 gün); ilk 10 örtüşmesi ve sıra farkı ölçülen değer olarak (ROADMAP 6) | Yapılmadı | Pilot 1 oturumları ~35 saniye içinde peş peşe (`samplingMode: technical_validation`); yakın zamanlı farklılık gözlemi var, değişkenlik ölçümü değil | En az 3 farklı günde aynı ayarlarla ölçüm; ilk 10 örtüşmesi ve sıra farkı hesabı | Geliştirme (plan, hesap) · Halil (onay) | Ölçüm kararı; tek günlük 9/13/18 ölçümü bunu karşılamaz |
| T12 | Reklam örneklemesi: ana keyword için 3 tekrar, farklı saatlerde; görülme sıklığı örneklem sayısıyla yüzde (ROADMAP 6, Aşama 1) | Yapılmadı | Teknik denemede reklam oranı bilerek hesaplanmadı (`tests/rules.test.ts`, teknik doğrulama durumu) | Planlı oturumlarla ölçüm | Halil (onay) · Geliştirme (çalıştırma, rapor) | Ölçüm kararı (A1) |
| T13 | Sayfa taraması (sınırlı): ilk 10'daki yerel rakiplerin ve **müşterinin kendi sitesinin** ilgili sayfaları, aynı yöntemle (ROADMAP Aşama 1) | Kısmen | Müşteri ana sayfası ve bağlı tek hizmet sayfası 22.10.2026'da salt okunur incelendi (P1-A01; not git dışında). Rakip **konum ve hizmet** kaynakları elle incelendi (45 domain; git dışı) – rakip tanımı içindi, hizmet sayfalarının aynı yöntemle karşılaştırması değildir | Rakip sayfalarının müşteriyle aynı yöntemle incelenmesi | Halil (sayfa incelemesine onay / yöntem) · Geliştirme | Müşteri görüşmesi (aksiyon seçimi) |

### 2.2 Kurallar, rapor ve maliyet

| # | Kabul maddesi | Durum | Kanıt | Kalan iş | Sorumlu | Sonraki bağımlılık |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Kurallar v0 (5 kural), her bulgu kanıt seviyesiyle (ROADMAP Aşama 1) | Tamamlandı (uygulama); gerçek veride kısmen işletildi | [RULES_V0](../RULES_V0.md) 0.2 ve bölüm 10–13; `src/lib/rules/`, `tests/rules.test.ts`, `tests/competitors.test.ts`, `tests/findings-e2e.test.ts`. Pilot 1: organik boşluk 2 belediyede değerlendirildi / 3'te değerlendirilemedi; Local Pack boşluğu pilotta kapalı; reklam kuralı teknik denemede değerlendirilemedi | Reklam kuralı planlı ölçümle; rakip kayıtlarının onayı | Halil (onay) | Planlı ölçüm, rakip onayı |
| R2 | Ölçüm ölçütleri için otomatik testler ve değişkenlik ölçümü (ROADMAP Aşama 1) | Kısmen | Kayıt bütünlüğü, geçerli oran, parametre eşleşmesi: `tests/runlog.test.ts`, `tests/client.test.ts`. Değişkenlik ölçümü ve hesabı yok | Değişkenlik hesabı (ilk 10 örtüşmesi, sıra farkı) ve ölçümü | Geliştirme | T11 |
| R3 | Rapor şablonu (Almanca PDF): durum, rakipler, kanıt seviyeli öneriler, ölçüm sınırları (ROADMAP Aşama 1) | Tamamlandı | `docs/templates/ortsrank-report-template.html` (`3d08f1f`); Pilot 1 DE özet 6 s., DE kanıt eki 8 s., TR iç inceleme 6 s., sürüm 22.10.2026 10:40 · 9664f01 (git dışı) | Pilot betikleri (HTML doldurma, PDF baskısı) gerçek veri içerdiği için git dışında; ikinci işletme için genel bir üretim adımı yok | Geliştirme | İkinci pilot işletme |
| R4 | İlk rapor elle gözden geçirildi (STATUS) | Tamamlandı | Dış inceleme: üç PDF açılıp değerlendirildi, teslim edilebilir bulundu (22.10.2026) | – | – | – |
| R5 | Gerçek maliyet kaydı: SERP, tekrar denemeler, kontrol sorguları, sayfa taraması, LLM, depolama (ROADMAP Aşama 1, bölüm 8) | Kısmen | SERP: keşif 0,016 $, trial 0,032 $, Pilot 1 0,12 $ (tekrar 0); Google Maps kontrol sorguları 0,004 $; sayfa taraması ve LLM kullanılmadı (0); depolama kaydedilmedi | Depolama maliyetinin kaydı veya „ölçülmedi" notu; maliyet kaydının tek yerde tutulması | Geliştirme | – |
| R6 | Raporu hazırlama ve açıklama süresi, ayrı (ROADMAP Aşama 1 madde 5, bölüm 8) | Yapılmadı | Geçmiş süreler kaydedilmedi ve tahmin edilmiyor | Bundan sonra: aksiyon kaydı ve görüşme formundaki süre alanları | Halil | Müşteri görüşmesi |

### 2.3 Talep

| # | Kabul maddesi | Durum | Kanıt | Kalan iş | Sorumlu | Sonraki bağımlılık |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Sektör seçimi (ROADMAP Aşama 1) | Tamamlandı | Pilot 1: Arbeitsbühnenvermietung (Halil'in kararı, 21.10.2026); Terrassenüberdachung sonraki pilot | – | – | – |
| D2 | 20–30 belediye, 3–5 keyword (ROADMAP bölüm 7) | Kısmen | Pilot 1: 5 belediye, 4 keyword (canlı). Rhein-Main: 30 belediye yalnızca dry-run | Pilot alanı kararı ve tam pilot taraması | Halil | Pilot işletmeler |
| D3 | 3–5 pilot işletme; tercihen sahip + pazarlamacı birlikte (ROADMAP Aşama 1) | Kısmen | 1 işletme için rapor hazır; işletme tarafının katılımı ve katılımcıları belgelenmedi | 2–4 işletme daha; katılımcıların belgelenmesi | Halil | – |
| D4 | Pilot anlaşması (kısa): ücretsiz/ücretli, veri kullanımı, gizlilik | Yapılmadı | Kayıt yok | Kısa pilot anlaşması | Halil | Rapor teslimi |
| D5 | Rapor teslimi ve açıklama görüşmesi | Yapılmadı | Teslim veya görüşme kaydı yok | Görüşme; form: [pilot-interview-form](../templates/pilot-interview-form.md) | Halil | – |
| D6 | Her pilot için 5 zorunlu kayıt (yeni bilgi, öncelik değişikliği, işi kim üstlendi, ikinci ölçüm ödemesi, süre) | Yapılmadı | Kayıt yok; form bu pakette hazırlandı | Görüşme sonrası doldurma | Halil | D5 |
| D7 | Kapı 1: en az 2 işletme rapor nedeniyle önceliğini değiştirdi | Yapılmadı | 0 belgelenmiş | En az 2 işletmede D5–D6 | Halil | D3, D5, D6 |

### 2.4 WUA-0 (paralel, kod gerektirmez)

| # | Kabul maddesi | Durum | Kanıt | Kalan iş | Sorumlu | Sonraki bağımlılık |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | Net/brüt, para birimi, tarih temeli, dönem ve kanal kapsamı belirli | Tamamlandı | [Datenbedarf_Werbe_Umsatzanalyse](../Datenbedarf_Werbe_Umsatzanalyse.md) 1.1 (`7f9dc03`) | – | – | – |
| W2 | Görüşme formu, veri kalite kuralları, gerçek veriden önce erişim ve işleme koşulları | Yapılmadı | STATUS WUA-0 maddeleri açık | Üç belge | Geliştirme (taslak) · Halil (koşullar) | WUA-1 (Aşama 2) |

## 3. Belgeler arası çelişkiler ve eski varsayımlar

Bunlar kaydedildi; kabul şartları kolaylaştırılmadı.

| # | Yer | Çelişki | Bu denetimdeki yaklaşım |
| --- | --- | --- | --- |
| C1 | ROADMAP Aşama 0 | Vercel ↔ GitHub ve Neon maddeleri işaretsiz; STATUS'a göre tamamlandı | STATUS esas; ROADMAP checklist'i güncel değil |
| C2 | ROADMAP Aşama 1 checklist | Bütün maddeler işaretsiz; güncel durum STATUS'ta | Bu denetim ve STATUS esas |
| C3 | ROADMAP bölüm 9 ↔ RULES_V0 bölüm 1 | ROADMAP analiz metni için Aşama 1'de Claude API öngörüyor; RULES_V0 „Aşama 1'de LLM yok" diyor; uygulama LLM kullanmıyor | Uygulama RULES_V0'a uygun; ROADMAP satırı karar bekliyor |
| C4 | ROADMAP Aşama 1 sektör | Terrassenüberdachung birincil, Arbeitsbühnen alternatif; Pilot 1 Arbeitsbühnen | Halil'in 21.10.2026 kararı esas |
| C5 | STATUS „Kapı 1" ↔ ROADMAP bölüm 6 | STATUS'taki Kapı 1 maddesi yalnızca kayıt bütünlüğü ve geçerli sonuç oranını sayıyor; ROADMAP ölçütleri parametre eşleşmesini, 50 yanıtta elle kontrolü, değişkenlik ve reklam sıklığı ölçümünü de içeriyor | ROADMAP esas; STATUS'taki madde genişletildi |
| C6 | ROADMAP ↔ PHASE1_PLAN | Koordinat ↔ şehir kodu karşılaştırması (10 belediye) ROADMAP'te var, PHASE1_PLAN'da yok | Açık kabul maddesi (T10) |
| C7 | PHASE1_PLAN başlığı | Kapsam „ROADMAP 3.1"; ROADMAP şu an 3.3 (WUA ayrı, tutarlı) | Anlam farkı yok |
| C8 | PHASE1_PLAN 5.5 ↔ canlı yanıt | Plan `local_pack` öğesinde `cid` bekliyor; canlıda çoğu kayıtta `cid: null`, kimlik `svid` → `/g/` | RULES_V0 bölüm 9–10 esas |
| C9 | ROADMAP bölüm 9 PDF | „Playwright"; Pilot 1 PDF'leri HTML şablonundan yerel bir tarayıcı betiğiyle üretildi; betik gerçek veri içerdiği için git dışında | Açık iş (R3) |
| C10 | PHASE1_PLAN 5.7 ↔ önerilen ölçüm | Kodda örneklem n = oturum n; „diğer keywordler 13:00'te" için oturum 1'in 13:00 olarak tanımlanması gerekir | [Ölçüm karar taslağı](pilot1-measurement-decision-draft.md) |
| C11 | Şema `actions` ↔ aksiyon kaydı | Tabloda `status` yalnızca `open` / `done` / `dismissed`; aksiyon kaydında 6 durum | Eşleme [aksiyon kaydı şablonunda](../templates/action-register-template.md); şema değişmedi |
| C12 | RULES_V0 başlığı | Başlık „taslak", durum satırı „onaylandı, uygulandı" | Durum satırı esas |

## 4. Sonraki işlerin sırası

Kapılar değişmez: **Kapı 1** = ölçüm ölçütleri + en az 2 işletmede öncelik değişikliği · **Kapı 2** = gerçek ödeme + en az 2 müşterinin **ücretli** ikinci ölçümü · **Kapı 3** = yardımsız kullanım + ilk abonelik yenilemesi. Bu pakette yeni özellik uygulanmadı.

| Sıra | Aşama | İş | Sorumlu | Bağımlılık |
| --- | --- | --- | --- | --- |
| 1 | 1 | Pilot 1 raporunun teslimi ve görüşme; 5 kaydın doldurulması | Halil | – |
| 2 | 1 | Görüşmede seçilen aksiyonun başlatılması (aksiyon kaydı A veya B) | Halil (seçim, girdiler) · Geliştirme (inceleme) | 1 |
| 3 | 1 | Planlı ölçüm kararı (9/13/18, tek gün) – reklam sıklığı ve ana keyword için gün içi değişim | Halil (onay) · Geliştirme (çalıştırma) | Karar taslağı |
| 4 | 1 | 50 yanıtta elle ayrıştırma kontrolü (42 mevcut + yeni ölçümden en az 8) | Geliştirme · Halil (kabul) | 3 |
| 5 | 1 | Koordinat ↔ şehir kodu karşılaştırması (10 belediye) ve en az 3 günlük değişkenlik ölçümü | Halil (onay) · Geliştirme | Ayrı karar |
| 6 | 1 | 2–4 pilot işletme daha; pilot alanı (20–30 belediye) ve keyword seti; tam pilot taraması | Halil | – |
| 7 | 1 | Müşteri ve rakip sayfalarının aynı yöntemle sınırlı incelemesi | Geliştirme · Halil (yöntem onayı) | 2, 6 |
| 8 | 1 (paralel) | WUA-0: görüşme formu, veri kalite kuralları, erişim/işleme koşulları | Geliştirme (taslak) · Halil | – |
| – | **Kapı 1** | Ölçüm ölçütleri + en az 2 işletmede öncelik değişikliği; karar: geç / düzelt / dur | Halil | 1–6 |
| 9 | 2 | Ücretli pilot: erişim kontrolü, pilot sözleşmesi, Datenschutz pilot sürümü, fatura; salt-okunur web raporu; planlı ikinci ölçüm ve dönem karşılaştırması | Halil · Geliştirme | Kapı 1 |
| 10 | 2 (ayrı teslimat) | WUA-1 dosyadan reklam/ciro analizi pilotu | Halil · Geliştirme | WUA-0, Kapı 1 |
| – | **Kapı 2** | Gerçek ödeme + en az 2 müşterinin ücretli ikinci ölçümü | Halil | 9 |
| 11 | 3 | Müşterinin temel akışı yardımsız tamamlaması için SaaS özellikleri (hesap, organizasyon, ödeme, kota, planlı yeniden tarama); WUA-2 yalnızca WUA-1 talebi doğrulanırsa | Geliştirme | Kapı 2 |
| – | **Kapı 3** | Yardımsız kullanım + ilk abonelik yenilemesi | – | 11 |
| 12 | 4 | Doğrulanmış taleple genişleme (ajans, çok noktalı ölçüm, ek sektörler, AT/CH); WUA-3 bağlantıları fizibiliteye göre | – | Kapı 3 |

Ads bağlantısı ve ciro importu bu pakete dahil değil. Başka bir projedeki reklam/ciro analizi Ortsrank'ta uygulanmış modül sayılmaz.

## 5. Bu paketin çıktıları

| Çıktı | Yer |
| --- | --- |
| Bu denetim | `docs/reports/phase1-status-audit.md` |
| Aksiyon kaydı şablonu (alanlar, durumlar, kurallar) | [`docs/templates/action-register-template.md`](../templates/action-register-template.md) |
| Pilot 1 aksiyon kaydı (A, B) | git dışında: `data/actions/pilot1-actions.md` |
| Müşteri görüşme ve karar formu | [`docs/templates/pilot-interview-form.md`](../templates/pilot-interview-form.md); Pilot 1 için boş kopya git dışında: `data/interviews/pilot1-interview.md` |
| Yeni ölçüm karar taslağı | [`docs/reports/pilot1-measurement-decision-draft.md`](pilot1-measurement-decision-draft.md) |

Bu paketin tamamlanması iki incelemenin yapıldığı, müşteri talebinin doğrulandığı veya Kapı 1'in geçildiği anlamına gelmez.
