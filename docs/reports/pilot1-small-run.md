# Pilot 1 – küçük gerçek veri denemesi (özet)

> 21.10.2026 · **Anonim özet**: işletme ve rakip adları yok; tam rapor git dışında (`data/reports/`). Sektör: Arbeitsbühnenvermietung, Heidenheim çevresi.

## 1. Kapsam

Küçük gerçek veri denemesi (Halil'in talimatı, 21.10.2026). **Yalnızca bu 5 belediye için geçerlidir; ölçülmeyen belediyelere ve bütün bölgeye genellenmez.**

- Merkez: Heidenheim an der Brenz (zorunlu, `includeCenter`); aday alan 60 km, nüfus 5.000–140.000 (sınırlar dahil); açık liste (`settlementAgs`), en fazla 5.
- Keywordler (mevcut keşiften, yeni ücretli keşif yok): Arbeitsbühne mieten (3 oturum), Hubarbeitsbühne mieten, Scherenbühne mieten, Arbeitsbühne mieten in der Nähe (1'er).
- Görev: 5 × (3 + 1 + 1 + 1) = **30**; oturum 1: 20, oturum 2: 5, oturum 3: 5.

| Belediye | AGS | km | Nüfus | Seçim gerekçesi |
| --- | --- | --- | --- | --- |
| Heidenheim an der Brenz | 08135019 | 0.0 | 50.612 | Merkez (zorunlu); orta büyüklükte ilçe merkezi |
| Steinheim am Albuch | 08135032 | 6.9 | 8.790 | Yakın + küçük (6.9 km. < 10.000); işletmenin şube adresi burada – marka kaydı mantığını gerçek veriyle sınamak için |
| Aalen | 08136088 | 18.1 | 67.675 | Orta mesafe + büyük (18.1 km. ≈ 68.000); en yakın büyük şehir. yerel rakip adresleri burada |
| Ulm | 08421000 | 33.3 | 130.288 | Uzak + çok büyük (33.3 km. ≈ 130.000); üst nüfus sınırına yakın en büyük belediye |
| Babenhausen | 09778115 | 59.9 | 5.694 | Çok uzak + küçük (59.9 km. < 6.000); alan sınırı. Bavyera. farklı yön |

## 2. Çalıştırma

| | |
| --- | --- |
| Tarama | `pilot1-small-20261021`, çalıştırma `20261021-164919-pilot1-small-b5a646` |
| Oturumlar | **Peş peşe** çalıştırıldı (14:49 UTC civarı, planlı 09:00/13:00/18:00 saatlerinde değil) → `technical_validation`; reklam sıklığı çıkarılmadı. Planlı oturumlar **tamamlanmış sayılmaz.** |
| Görev | 30 başarılı · 0 hata · 0 iptal · 0 atlanan |
| Deneme | 30 (tekrar gerekmedi) |
| Kayıt bütünlüğü / geçerli sonuç | %100 / %100 |
| Parametre uyuşmazlığı | 0 |

## 3. Maliyet

| | |
| --- | --- |
| Tavan | min(0,40 $; kullanılabilir bakiye 0,94 $) = **0,40 $** (bütçe defteri, tüm oturum ve tekrarlar için ortak) |
| Plan | beklenen 0,144 $, en kötü durum 0,36 $ |
| **Gerçek harcama** | **0.120 $** (confirmed; uncertain 0.000 $) |
| Defterde kalan | 0.280 $ / 0,40 $ |
| DataForSEO bakiyesi | 0,94 $ → **0,82 $** (panel API, `user_data`) |
| Para yükleme | yapılmadı |

| Belediye | Deneme | Maliyet |
| --- | --- | --- |
| Heidenheim an der Brenz | 6 | 0.024 $ |
| Steinheim am Albuch | 6 | 0.024 $ |
| Aalen | 6 | 0.024 $ |
| Ulm | 6 | 0.024 $ |
| Babenhausen | 6 | 0.024 $ |

Belediye başına **0,024 $** = 6 ölçüm × 0,004 $ (depth 20 = 2 SERP sayfası × 0,002 $). Tekrar denemesi gerekseydi her tekrar +0,004 $.

## 4. Sonuçlar (gerçek veri)

Hedef: işletmenin domaini (organik) ve Heidenheim şubesi (Local Pack, kimlik doğrulanmadı). Marka adı `<Markenname>` ile gizlendi.

| Belediye | Keyword | Geçerli/plan | Organik (hedef domain) | Local Pack | Reklam |
| --- | --- | --- | --- | --- | --- |
| Heidenheim an der Brenz | Arbeitsbühne mieten | 3/3 | bestes Ergebnis Platz 8 | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Heidenheim an der Brenz | Hubarbeitsbühne mieten | 1/1 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Heidenheim an der Brenz | Scherenbühne mieten | 1/1 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Eintrag der Marke im Local Pack (Platz 3: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Heidenheim an der Brenz | Arbeitsbühne mieten in der Nähe | 1/1 | unter den ersten 20 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Steinheim am Albuch | Arbeitsbühne mieten | 3/3 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Eintrag der Marke im Local Pack (Platz 2: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Steinheim am Albuch | Hubarbeitsbühne mieten | 1/1 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Eintrag der Marke im Local Pack (Platz 2: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Steinheim am Albuch | Scherenbühne mieten | 1/1 | unter den ersten 18 organischen Ergebnissen nicht gefunden | kein Local Pack angezeigt | nicht ausgewertet (technische Validierung) |
| Steinheim am Albuch | Arbeitsbühne mieten in der Nähe | 1/1 | bestes Ergebnis Platz 5 | Eintrag der Marke im Local Pack (Platz 1: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Aalen | Arbeitsbühne mieten | 3/3 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Eintrag der Marke im Local Pack (Platz 7: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Aalen | Hubarbeitsbühne mieten | 1/1 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Aalen | Scherenbühne mieten | 1/1 | unter den ersten 20 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Aalen | Arbeitsbühne mieten in der Nähe | 1/1 | unter den ersten 20 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Ulm | Arbeitsbühne mieten | 3/3 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Ulm | Hubarbeitsbühne mieten | 1/1 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Ulm | Scherenbühne mieten | 1/1 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Ulm | Arbeitsbühne mieten in der Nähe | 1/1 | unter den ersten 20 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Babenhausen | Arbeitsbühne mieten | 3/3 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Babenhausen | Hubarbeitsbühne mieten | 1/1 | unter den ersten 18 organischen Ergebnissen nicht gefunden | Eintrag der Marke im Local Pack (Platz 6: <Markenname>), nicht dem Zielstandort zugeordnet | nicht ausgewertet (technische Validierung) |
| Babenhausen | Scherenbühne mieten | 1/1 | unter den ersten 19 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |
| Babenhausen | Arbeitsbühne mieten in der Nähe | 1/1 | unter den ersten 20 organischen Ergebnissen nicht gefunden | Betriebszuordnung nicht verifiziert | nicht ausgewertet (technische Validierung) |

**Üretilen bulgular:** rakip kapsaması 17 (hepsi „vorläufige Einordnung", etiketler onaylanmadı; 6 domain sınıflandırılmamış). Organik boşluk, Local Pack boşluğu, reklam gözlemi ve inceleme önceliği üretilmedi – nedenleri bölüm 5'te.

**Hedef domain organikte:** Heidenheim'da „Arbeitsbühne mieten" için oturum 2 ve 3'te 8. sırada, oturum 1'de ilk 18'de yok; Steinheim'da „Arbeitsbühne mieten in der Nähe" için 5.; diğer hücrelerde dönen ilk 18–20 organik sonuçta bulunamadı. Tek zaman penceresi, mobil, belediye merkez noktası.

## 5. Teknik olarak doğrulananlar / henüz doğrulanamayanlar

**Doğrulandı (gerçek veriyle):**
- Veri çekme: 30/30 istek başarılı; gönderilen parametreler yanıttaki `data` ile aynı.
- Bütçe: istek öncesi ayırma, confirmed muhasebe, ortak tavan; gerçek maliyet = 30 × 0,004 $; panel bakiyesi defterle tutarlı.
- Ayrıştırma: organik, reklam, Local Pack satırları; Local Pack'te `cid: null` / Google domaini doğru ele alındı.
- Kurallar: durum tablosu, „bulunamadı" ifadesinde gerçek organik sonuç sayısı (18–20), marka kaydı ayrı gösterimi, teknik denemede reklam oranı gösterilmemesi, onaylanmamış etiketlerin „vorläufig" işaretlenmesi.
- Raporlama: `findings.json`, durum tablosu ve bulgu cümleleri gerçek veriden üretildi.

**Henüz doğrulanamayan / üretilemeyen:**
- **Organik boşluk (`organic_gap`):** üretilmedi. Rakip etiketleri onaylanmamış ve taslakta yalnızca 3 local/regional domain var; koşul (her ölçümde ≥ 2 local/regional rakip ilk 10'da) 5 belediyenin hiçbirinde her ölçümde sağlanmadı. Oturum 1 ölçümlerinde ilk 10'da taslak listesinde olmayan (sınıflandırılmamış) domainler çıktı. Etiket onayı ve sınıflandırılmamış domainlerin incelenmesi gerekiyor.
- **Local Pack hedef şubesi:** kimlik doğrulanmadı; markanın bir kaydı 5 belediyenin 4'ünde en az bir ölçümde Local Pack'te görüldü ama Heidenheim şubesine bağlanmadı. Yokluk bulgusu üretilmedi; `local_pack_gap` pilotta kapalı.
- **Reklam gözlemi:** teknik denemede değerlendirilmedi (planlı oturumlar gerekli).
- **İnceleme önceliği:** organik boşluk olmadığı için üretilmedi.
- **Planlı oturumlar, değişkenlik, dönem karşılaştırması:** yapılmadı.

## 6. Gözlem: aynı anda farklı sonuç sayfası

Aynı belediye, keyword ve koordinat için aynı saniyede gönderilen 3 ölçümde Google iki farklı sayfa döndürdü: oturum 1 ölçümlerinde „AI Overview" kutusu ve farklı bir ilk 10 vardı; oturum 2 ve 3 ölçümleri birbirine çok yakındı. Eşleme doğrulandı (yanıttaki `data` doğru). Bu, tek ölçümle karar vermemenin ve örneklemenin gerekçesidir; rapor cümleleri her ölçümü ayrı ele alıyor.

## 7. Maliyet modeli (fiyatlandırma için)

| Kalem | Bu pilotta | Not |
| --- | --- | --- |
| SERP verisi (DataForSEO) | 0,024 $ / belediye / tarama günü | 6 ölçüm × 0,004 $; tekrar oranı %20 varsayımıyla ≈ 0,029 $ |
| Tam pilot ölçeği (30 belediye) | ≈ 0,72 $ (tekrarsız) / 0,86 $ (beklenen) / 2,16 $ (en kötü) | aynı keyword seti |
| LLM (Claude API) | 0 $ | tarama ve kurallar deterministik; rapor metni şablondan, LLM kullanılmıyor |
| Barındırma / veritabanı | tarama başına ayrıca ölçülmedi | tarama yerelde çalışıyor; Vercel ve Neon kullanımı bu ölçümde yok |
| Geliştirme (Claude Code oturumları) | bu belgede ölçülmedi | kullanım Claude hesabının kullanım ekranında görünür; belediye başına maliyet değildir |
| İnsan emeği (inceleme, açıklama) | ölçülmedi | ROADMAP: pilot kaydı 5 (saat) |
