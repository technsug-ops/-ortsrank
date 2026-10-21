# Pilot ayarları

> Güncelleme: 21.10.2026 · Rakamlar gerçek komut çıktısından.
> **Pilot 1 (ilk pilot): Arbeitsbühnenvermietung, Heidenheim çevresi** – Halil'in kararı 21.10.2026. İşletmenin adı, domaini ve proje dosyası git dışında (`data/projects/pilot1-heidenheim.json`).
> **Sonraki pilot: Terrassenüberdachung** – taslak aşağıda, bölüm „Sonraki pilot".
> Tam canlı tarama, kesin keyword seti ve harcama tavanı Halil'in ayrı onayına bağlı.

---

## Pilot 1 – Arbeitsbühnenvermietung, Heidenheim çevresi

Rapor kapsamı: **„Heidenheim çevresi pilot ölçümü"** (Pilotmessung Raum Heidenheim). İşletmenin diğer şubelerinin bölgeleri ölçülmez.

### 1. Alan ve belediye seçimi

| Ayar | Değer |
| --- | --- |
| Merkez | Heidenheim an der Brenz (AGS 08135019), `includeCenter: true` – nüfustan bağımsız, ilk sırada |
| Yarıçap | 40 km |
| Nüfus | 5.000 ≤ nüfus ≤ 140.000 (`populationMin` / `populationMax`) |
| En fazla | 30 belediye, merkez dahil |
| Kaynak | Destatis GV 31.12.2025 |

**Dry-run sonucu** (21.10.2026, `data/projects/pilot1-heidenheim.json`): 30 seçildi, 114 eşik altı, 0 üst sınır üstü, **26 sınıra takıldı (`overLimit`)**. Seçim **27,8 km'de** kesiliyor; Schwäbisch Gmünd (29,7 km) ve Ulm (33,3 km) dışarıda.

| # | Belediye | AGS | km | Nüfus |
| --- | --- | --- | --- | --- |
| 1 | Heidenheim an der Brenz | 08135019 | 0,0 | 50.612 |
| 2 | Herbrechtingen | 08135020 | 6,4 | 13.281 |
| 3 | Nattheim | 08135026 | 6,8 | 6.531 |
| 4 | Steinheim am Albuch | 08135032 | 6,9 | 8.790 |
| 5 | Königsbronn | 08135025 | 7,9 | 6.966 |
| 6 | Giengen an der Brenz | 08135016 | 8,8 | 19.857 |
| 7 | Gerstetten | 08135015 | 11,7 | 11.530 |
| 8 | Oberkochen | 08136050 | 12,4 | 7.679 |
| 9 | Neresheim | 08136045 | 15,7 | 7.921 |
| 10 | Böhmenkirch | 08117010 | 16,4 | 5.621 |
| 11 | Sontheim an der Brenz | 08135031 | 16,6 | 5.846 |
| 12 | Essingen | 08136021 | 17,3 | 6.421 |
| 13 | Aalen | 08136088 | 18,1 | 67.675 |
| 14 | Langenau | 08425072 | 20,0 | 15.359 |
| 15 | Heubach | 08136028 | 20,3 | 10.241 |
| 16 | Gundelfingen a.d.Donau | 09773136 | 21,2 | 7.836 |
| 17 | Lonsee | 08425075 | 23,0 | 5.148 |
| 18 | Westhausen | 08136082 | 23,1 | 6.131 |
| 19 | Lauingen (Donau) | 09773144 | 23,5 | 11.604 |
| 20 | Geislingen an der Steige | 08117024 | 24,2 | 27.781 |
| 21 | Hüttlingen | 08136033 | 24,3 | 6.079 |
| 22 | Bopfingen | 08136010 | 24,7 | 11.531 |
| 23 | Donzdorf | 08117015 | 25,2 | 10.550 |
| 24 | Leipheim | 09774155 | 26,0 | 7.385 |
| 25 | Kuchen | 08117033 | 26,5 | 5.481 |
| 26 | Waldstetten | 08136079 | 26,5 | 7.018 |
| 27 | Günzburg | 09774135 | 26,5 | 21.291 |
| 28 | Abtsgmünd | 08136002 | 26,6 | 7.560 |
| 29 | Dillingen a.d.Donau | 09773125 | 27,5 | 19.643 |
| 30 | Elchingen | 09775139 | 27,8 | 9.768 |

**Karar noktası (Halil):** Aynı 40 km ve en fazla 30 ile eşik seçenekleri:

| Alt eşik | Şartı sağlayan (merkez dahil) | Kesilme | Ulm | Schwäbisch Gmünd |
| --- | --- | --- | --- | --- |
| 5.000 (şu anki) | 56 | 27,8 km | hayır | hayır |
| 7.500 | 34 | 33,7 km | evet | evet |
| 10.000 | 24 | yok | evet | evet |

### 2. Keyword keşfi ve öneri

**Keşif:** yerel keşif taraması, 21.10.2026, Heidenheim merkez koordinatı, mobil, depth 20, 4 sorgu × 1 ölçüm; tavan 0,05 $ (bütçe defteriyle), harcanan **0,016 $**, 4/4 başarılı. Öneriler Google'ın „Andere suchten auch" / „Ähnliche Suchanfragen" kutularından; **arama hacmi veya talep kanıtı değildir**, aday listesidir. Sayı = 4 yanıttan kaçında görüldüğü.

| Keşif sorgusu | Organik sonuç | Hedef domain (organik) | Local Pack |
| --- | --- | --- | --- |
| Arbeitsbühne mieten | 19 | 7. | 4 işletme |
| Hebebühne mieten | 19 | ilk 19'da yok | 4 işletme, biri KFZ (oto) mağazası |
| Scherenbühne mieten | 19 | ilk 19'da yok | 4 işletme, biri markanın kaydı (şube belirsiz) |
| Hubarbeitsbühne mieten | 19 | 11. | 4 işletme |

Tek ölçüm, tek konum, tek an: bu sıralar genel sonuç değildir.

Sık görülen Google önerileri (4/4): „Arbeitsbühne mieten in der Nähe", „Arbeitsbühne mieten Kosten pro Tag", „Anhänger-Arbeitsbühne mieten", „Mini Arbeitsbühne mieten", „Hebebühne mieten Heidenheim"; 2/4: „Scherenbühne mieten in der Nähe", „Arbeitsbühne mieten nähe Heidenheim an der Brenz", „Teleskop Arbeitsbühne mieten", „LKW-Arbeitsbühne mieten", „Elektrische Arbeitsbühne mieten". „Hebebühne mieten" için öneriler KFZ niyeti de taşıyor („KFZ Hebebühne mieten", „Mobile Hebebühne mieten Auto").

**Öneri (Arbeitsbühne / Hebebühne / Scherenbühne ailesi):**

| Keyword | Tür | Ölçüm | Gerekçe |
| --- | --- | --- | --- |
| Arbeitsbühne mieten | main | 3 oturum | Ailenin genel terimi; hedef domain keşifte organik 7.; reklam gözlemi için 3 oturum |
| Hubarbeitsbühne mieten | variant | 1 | İşletmenin sitesinde kullandığı terim; keşifte organik 11. |
| Scherenbühne mieten | variant | 1 | Ürün tipi; Local Pack'te markanın kaydı görüldü |
| Arbeitsbühne mieten in der Nähe | local | 1 | **Gerekçe var:** Google bu öneriyi 4 yanıtın 4'ünde gösterdi; ölçüm her belediyenin merkez noktasından yapıldığı için yerel niyet anlamlı |

**Bilinçli olarak alınmayan / sonraki kapsam:**
- „Hebebühne mieten": karışık niyet (KFZ-Hebebühne); keşifte Local Pack'te oto mağazası. Alınırsa sonuçlar ayrıca yorumlanmalı.
- „Teleskopstapler mieten" ve diğer Stapler/Autokran terimleri: Halil'in kararıyla sonraki kapsam.
- „Anhänger-Arbeitsbühne", „LKW-Arbeitsbühne", „Mini Arbeitsbühne": işletmenin ürün yelpazesi netleşince sonraki kapsam adayı.
- Şehir adı içeren öneriler („… Heidenheim", „… Ulm"): ölçüm zaten belediye koordinatından.

### 3. İşletme ve şube eşleştirmesi

| Hedef | Durum |
| --- | --- |
| Organik | İşletmenin domaini (`targetDomains`) |
| Local Pack | **Heidenheim şubesi – kimlik doğrulanmadı.** Proje dosyasında `targetLocalBusinesses: []` |
| Marka | `brandNames` ile markanın kayıtları ayrı gösterilir („Eintrag der Marke …, nicht dem Zielstandort zugeordnet") |

- Canlı yanıtta Local Pack öğeleri `cid: null` ve Google domaini taşır; adres yok. Keşifte markanın bir kaydı görüldü (ham ad `data/` içindeki taslakta), ama Heidenheim şubesi mi başka bir şube mi olduğu **bu veriden belirlenemez**.
- İşletmenin sitesinde Heidenheim adresi var; Google profilinin tam adı, adresi, bağlantısı ve kimliği henüz doğrulanmış kaynaktan alınmadı. Tahmini kimlik üretilmedi.
- Doğrulanana kadar: organik analiz çalışır; Local Pack hücresi „Betriebszuordnung nicht verifiziert" veya „Eintrag der Marke … nicht dem Zielstandort zugeordnet" gösterir; Heidenheim şubesinin yokluğuna dair bulgu üretilmez (`local_pack_gap` zaten kapalı).

### 4. Rakip etiket taslağı

`data/competitor-labels.pilot1.draft.json` (git dışı, gerçek işletme adları). Keşifteki organik domainlerden: local 1, regional 2, portal 4, directory 1, national 21; **belirsiz 12** (etiketsiz kalır). local/regional yalnızca 40 km içinde Impressum adresi olanlara önerildi; adres hizmet bölgesini kanıtlamaz. Local Pack'teki rakipler domainsiz geldiği için yalnızca adla listelendi, domain etiketlerine bağlanamaz. Taslak Halil'in onayına kadar aktif değil.

### 5. Maliyet ve tavan

Görev = belediye × keyword örneklemi (her örneklem bir oturum). Önceki tahminden taşınmadı; bu ayarla yeniden hesaplandı:

| Keyword | Hesap | Görev |
| --- | --- | --- |
| Arbeitsbühne mieten (main) | 30 × 3 | 90 |
| Hubarbeitsbühne mieten | 30 × 1 | 30 |
| Scherenbühne mieten | 30 × 1 | 30 |
| Arbeitsbühne mieten in der Nähe | 30 × 1 | 30 |
| **Toplam (bir tarama günü, 3 oturum)** | | **180** |

Oturum 1: 120 görev · oturum 2: 30 · oturum 3: 30. Fiyat canlı denemede doğrulandı: 0,004 $ / deneme.

| | |
| --- | --- |
| Beklenen | 0,864 $ |
| En kötü durum (3 deneme) | 2,16 $ |
| **Önerilen tavan (`SCAN_MAX_USD`, tarama günü başına, 3 oturum ortak)** | **2,50 $** – en kötü durumun üstünde, böylece plan uyarısız başlar; tavan istek başına bütçe defteriyle uygulanır |

Kalan deneme bakiyesi (~0,93 $) bu tavanı karşılamaz; tam tarama için DataForSEO'ya en az 50 $ yatırılmalı.

---

## Sonraki pilot – Terrassenüberdachung (taslak, 21.10.2026)

### T1. Keywordler

**Kanıt:** Canlı denemedeki ham yanıtlarda Google'ın kendi önerileri („Ähnliche Suchanfragen", „Andere suchten auch"). Sayı = kaç yanıtta görüldüğü (en fazla 10). Arama hacmi değildir; hacim ölçülmedi.

| Öneri (Google) | Görüldü |
| --- | --- |
| Terrassenüberdachung Alu | 14 |
| Holz Terrassenüberdachung | 12 |
| Terrassenüberdachung Holz selbst bauen | 12 |
| Terrassenüberdachung freistehend | 12 |
| Terrassenüberdachung Abverkauf | 11 |
| Terrassenüberdachung günstig mit Montage | 9 |
| Terrassenüberdachung mit Montage Preise | 7 |
| Terrassenüberdachung mit Montage in der Nähe | 6 |
| Terrassenüberdachung aus Polen / Holland … | 3–4 (birkaç varyant) |

**Taslak set (4 keyword):**

| Keyword | Tür | Örneklem | Gerekçe |
| --- | --- | --- | --- |
| Terrassenüberdachung | main | 3 | Ana talep; reklam gözlemi için 3 oturum |
| Terrassenüberdachung mit Montage | intent | 1 | Hizmet (montaj) niyeti; denemede zaten ölçüldü |
| Terrassenüberdachung Alu | variant | 1 | En sık Google önerisi; malzeme |
| Terrassenüberdachung in der Nähe | local | 1 | Yerel niyet; koordinat ölçümüyle anlamlı |

**Halil'in netleştirmesi gerekenler:** Pilot işletmeler alüminyum mu, ahşap mı, ikisi de mi sunuyor? Ahşap da varsa „Terrassenüberdachung Alu" yerine veya yanına „Holz Terrassenüberdachung" gelir. „selbst bauen", „Abverkauf", „aus Polen" gibi kendin-yap / indirim / ithalat niyetleri montaj yapan bir işletme için öncelikli değildir; sete alınmadı.

**Bilinçli olarak alınmayanlar:** Şehir adı içeren keywordler („Terrassenüberdachung Rhein Main"); ölçüm zaten her belediyenin merkez koordinatından yapılıyor.

### T2. Tarama alanı

**Önce pilot işletmenin konumu doğrulanmalı.** Merkez (`centerAgs`) ve yarıçap işletmenin gerçekten hizmet verdiği bölgeye göre seçilir; şu anki Frankfurt merkezi bir varsayımdır.

Frankfurt merkezli seçenekler (Destatis GV 31.12.2025, nüfus eşiğini geçen belediye sayısı):

| Yarıçap | ≥ 10.000 | ≥ 15.000 | ≥ 20.000 | ≥ 25.000 |
| --- | --- | --- | --- | --- |
| 20 km | 36 | 31 | 25 | 20 |
| 25 km | 47 | 36 | 29 | 22 |
| 30 km | 66 | 47 | 34 | 27 |

Bugünkü ayar (30 km, ≥ 10.000, en fazla 30) seçimi 17,4 km'de kesiyor.

**Öneri (Frankfurt merkezi kalırsa):** 25 km, ≥ 20.000, en fazla 30 → 29 belediye, ROADMAP'teki 20–30 hedefinde ve kesilme yok.

### T3. Maliyet (taslak set: ana keyword 3 örneklem + 3 keyword × 1)

Görev = belediye × 6. Fiyat canlı denemede doğrulandı: 0,004 $ / deneme (depth 20).

| Alan | Belediye | Görev / tarama | Beklenen | En kötü durum |
| --- | --- | --- | --- | --- |
| 25 km, ≥ 20.000 | 29 | 174 | 0,84 $ | 2,09 $ |
| 30 km, ≥ 10.000, en fazla 30 | 30 | 180 | 0,86 $ | 2,16 $ |
| 30 km, ≥ 20.000 | 34 | 204 | 0,98 $ | 2,45 $ |

Değişkenlik ölçümü (3 gün) yaklaşık üç katı. Kalan deneme bakiyesi (~0,95 $) bir tam taramanın en kötü durumunu karşılamaz; tam pilot için DataForSEO'ya en az 50 $ yatırılmalı (tek seferlik, süresiz bakiye).

### T4. Rakip etiketleri

Taslak `data/competitor-labels.terrassen.draft.json` dosyasında (git dışı; gerçek işletme adları içerir). Canlı denemedeki 49 domainden 31'ine öneri var: portal 10, national 16, manufacturer 2, local 1, regional 2. Kanıt: bilinen platform/zincir/üretici, ya da herkese açık Impressum'daki ilk adres (21.10.2026). 18 domain belirsiz, etiketsiz kaldı.

- Etiketler TechNS'in sınıflandırmasıdır; raporda „Eingeordnet von TechNS als …" olarak görünür.
- Impressum adresi hizmet bölgesini kanıtlamaz; bir firma birden fazla şubeye sahip olabilir. „local/regional" önerileri gözden geçirilmeli.
- Onaydan sonra `data/competitor-labels.json` oluşturulur; etiketsiz domainler „nicht eingeordnet" kalır ve organik boşluk kuralında rakip sayılmaz.
- Liste 30 belediyelik tam taramadan sonra genişler; yeni domainler yine aynı yöntemle önerilir.

### T5. Proje dosyasına girecekler (karar sonrası)

```json
{
  "centerAgs": "<pilot işletmenin bölgesi>",
  "radiusKm": 25,
  "populationMin": 20000,
  "maxSettlements": 30,
  "keywords": [
    { "term": "Terrassenüberdachung", "type": "main", "samples": 3 },
    { "term": "Terrassenüberdachung mit Montage", "type": "intent", "samples": 1 },
    { "term": "Terrassenüberdachung Alu", "type": "variant", "samples": 1 },
    { "term": "Terrassenüberdachung in der Nähe", "type": "local", "samples": 1 }
  ],
  "targetDomains": ["<pilot işletmenin domaini>"],
  "targetLocalBusinesses": [{ "profileName": "<Google profilindeki tam ad>", "source": "<nereden doğrulandı>" }]
}
```

Gerçek işletme verisi (`targetDomains`, `targetLocalBusinesses`) içeren proje dosyası pilot başlarken git dışına (`data/projects/`) taşınır.
