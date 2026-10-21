# Kurallar v0 – Tasarım (taslak)

> Kapsam: ROADMAP 3.3, Aşama 1 › Rapor › „Kurallar v0 (5 kural), her bulgu kanıt seviyesiyle".
> Durum: **onaylandı, uygulandı** · 21.10.2026 · Sürüm 0.2 (kararlar bölüm 7; kod incelemesi bölüm 8; canlı yanıt bölüm 9; Local Pack kimlik/adres/marka bölüm 10)
> Girdi yalnızca SERP taraması (`serp_raw` / `runs/`). Sayfa taraması gerektiren kurallar („rakibin Hanau sayfası var") sayfa taraması eklendiğinde gelir.

---

## 1. İlkeler (ROADMAP 4–5'ten, kurallara uygulanmış hali)

1. **Kural sayı üretir, LLM üretmez.** Her bulgu deterministik koddan çıkar; metin şablondan doldurulur (`src/i18n/dictionaries/de.json`). Aşama 1'de LLM yok.
2. **Her bulgu kanıt seviyesi taşır:** `observation` (gözlem), `inference` (çıkarım), `hypothesis` (hipotez). Seviye kuralın tanımında sabittir, çalışma anında değişmez.
3. **„Bulunamadı" ≠ „görünmüyor".** Hedef domain sonuçlarda yoksa cümle: „in den ersten {depth} Ergebnissen nicht gefunden". „Sie sind nicht sichtbar", „Sie fehlen" yazılmaz.
4. **Başarısız ölçüm, sıralama kaybı değildir.** `error` / `cancelled` görevler hiçbir bulguya „bulunamadı" olarak girmez; belediye × keyword için geçerli örneklem yoksa durum „nicht gemessen" olur ve bulgu üretilmez.
5. **Aksiyon önce inceleme.** Gözleme dayanan aksiyon `review` türündedir. „Sayfa açın", „şehir sayfası oluşturun" gibi `improvement` aksiyonu v0'da üretilmez (ihtiyaç doğrulanmadan).
6. **„Sizde yok" yazılmaz.** Müşterinin kendi sitesi aynı yöntemle kontrol edilmeden (sayfa taraması) bu cümle gözlem değildir.
7. **Kaynak izi.** Her bulgu dayandığı `taskKey`, `rawPath`, zaman, koordinat ve cihazı `evidence` alanında taşır.
8. **Vaat yok.** Cümleler ölçülen olguyu söyler; „sıralamanız yükselir", „X € kazanırsınız" yok.

---

## 2. Girdi ve ön koşullar

- Bir taramanın (`scanId`) tüm oturum çalıştırmaları birlikte okunur: `tasks.jsonl`, `attempts.jsonl` ve ham yanıtlar yeniden ayrıştırılır.
- Kurallar yalnızca `status = success` ve parametre eşleşmesi tam olan görevleri kullanır.
- `samplingMode = technical_validation` olan çalıştırmalardan reklam bulgusu (kural 4) üretilmez.
- Hedef domain(ler): proje dosyasındaki `targetDomains`.
- Rakip etiketi (`local`, `regional`, `national`, `portal`, `directory`, `manufacturer`): şemadaki `competitor_labels` tablosundan; v0'da tablo boşsa `data/competitor-labels.json` (gitignore, gerçek işletme adları içerir). Etiketsiz domain „nicht eingeordnet" sayılır ve „yerel rakip" koşullarına girmez.

**Durum tablosu (kural değil, her raporun temeli):** belediye × keyword başına hedefin en iyi organik sırası, local pack sırası, görülen reklam sayısı ve geçerli örneklem sayısı. Hücre değerleri: `1–10`, `11–{depth}`, „in den ersten {depth} nicht gefunden", „nicht gemessen".

---

## 3. Beş kural

| # | Kural (`rule`) | Soru | Seviye | `kind` | Aksiyon |
| --- | --- | --- | --- | --- | --- |
| 1 | `organic_gap` | Hangi belediyede ana keyword'de ilk 10 dışındayım, yerel rakipler içerideyken? | Gözlem | opportunity | `review` · website |
| 2 | `local_pack_gap` | Hangi belediyede local pack'te yokum, yerel rakip varken? | Gözlem | opportunity | `review` · google_profile |
| 3 | `competitor_coverage` | Hangi rakip hizmet bölgemin çoğunda görünür? | Gözlem | threat | – |
| 4 | `ad_observation` | Hangi belediyede reklam görüldü, hangisinde görülmedi? | Gözlem (+ isteğe bağlı hipotez) | opportunity | gerekirse `verification` · ads |
| 5 | `review_priority` | Önce hangi belediyeyi incelemeliyim? | Çıkarım | action | `review` |

### 3.1 `organic_gap` – organik boşluk (gözlem)

- **Koşul:** belediye × ana keyword; tüm geçerli örneklemlerde hedef organik ilk 10'da değil **ve** aynı örneklemlerde en az **2** farklı `local`/`regional` rakip organik ilk 10'da.
- **Cümle (DE):** „In {Gemeinde} war {Ziel} bei „{Keyword}" in {n} von {n} Messungen nicht unter den ersten 10 organischen Ergebnissen ({Status}). {k} lokale Wettbewerber waren in den ersten 10: {Liste}." – `{Status}` = „bestes Ergebnis Platz {r}" veya „in den ersten {depth} nicht gefunden".
- **Aksiyon (review, website):** „Prüfen Sie, ob Ihre bestehende Seite den Bedarf für {Leistung} in {Gemeinde} abdeckt."
- **Skor:** 0–100 = kural 5'teki öncelik skoruna girdi; tek başına sıralama yapılmaz.

### 3.2 `local_pack_gap` – local pack boşluğu (gözlem)

- **Koşul:** belediye × ana keyword; hiçbir geçerli örneklemde hedef local pack'te değil **ve** en az bir örneklemde local pack var ve içinde en az **1** `local` rakip bulunuyor.
- **Cümle:** „In {Gemeinde} erschien {Ziel} bei „{Keyword}" in keiner der {n} Messungen im Local Pack (Karten-Ergebnisse); dort erschienen: {Liste}."
- **Sınır metni (her zaman):** „Das Local Pack hängt stark von der Entfernung zum Messpunkt ab; gemessen wurde von einem repräsentativen Punkt in der Gemeindemitte."
- **Aksiyon (review, google_profile):** „Prüfen Sie, ob Ihr Google-Unternehmensprofil {Gemeinde} als Einzugsgebiet abdeckt und die Kategorie zu „{Keyword}" passt."

### 3.3 `competitor_coverage` – rakip kapsaması (gözlem)

- **Koşul:** domain (hedef hariç), ana keyword'de taranan belediyelerin **≥ %50**'sinde en az bir geçerli örneklemde organik ilk 10'da veya local pack'te.
- **Cümle:** „{Domain} erschien in {m} von {N} gemessenen Gemeinden unter den ersten 10 organischen Ergebnissen oder im Local Pack." Etiket varsa ayrıca: „(eingeordnet als {Label})" – etiket TechNS'in sınıflandırmasıdır, cümlede böyle belirtilir.
- **Aksiyon:** yok (bilgi). Portal/dizin etiketli domainler ayrı listelenir, „yerel rakip" sayılmaz.

### 3.4 `ad_observation` – reklam gözlemi (gözlem, isteğe bağlı hipotez)

- **Koşul:** `samplingMode = sessions`, belediye × ana keyword için en az 3 geçerli örneklem.
- **Cümle:** „In {Gemeinde} wurden bei „{Keyword}" in {k} von {n} Messungen Anzeigen gesehen ({Datum}, mobil, Gemeindemitte)." `k = 0` ise: „… in keiner der {n} Messungen Anzeigen gesehen." – „kein Anzeigenwettbewerb" **yazılmaz**.
- **Hipotez (ayrı bulgu, „Zu prüfen" etiketli):** `k = 0` **ve** aynı belediyede `organic_gap` varsa: „Hypothese, zu prüfen: Eine kleine Testkampagne für „{Keyword}" in {Gemeinde} könnte zeigen, zu welchen Kosten dort Sichtbarkeit über Anzeigen möglich ist." Aksiyon `verification` · ads.

### 3.5 `review_priority` – inceleme önceliği (çıkarım)

- **Ne yapar:** kural 1–2 bulgusu olan belediyeleri inceleme sırasına koyar. Sıralama bir yorumdur, bu yüzden seviye **çıkarım**; dayandığı gözlemler ve formül raporda gösterilir.
- **Skor (0–100), açık formül:**
  `skor = 100 × (0,5 × boşluk + 0,3 × nüfus_payı + 0,2 × yakınlık)`
  - `boşluk` = (organic_gap ? 0,6 : 0) + (local_pack_gap ? 0,4 : 0)
  - `nüfus_payı` = belediye nüfusu / taranan belediyelerin en büyük nüfusu
  - `yakınlık` = 1 − mesafe / yarıçap
- **Cümle:** „Prüfreihenfolge (Ableitung aus den Beobachtungen oben, Formel im Anhang): 1. {Gemeinde} …"
- **Aksiyon:** en fazla 5 belediye için `review`; ROADMAP'teki „3–5 öncelikli aksiyon" sınırı.

---

## 4. Çıktı

- `runs/scans/<scanId>/findings.json`: bulgular (şemadaki `findings` alanlarıyla aynı adlar: `rule`, `kind`, `score`, `evidenceLevel`, `dataSources`, `ags`, `keyword`, `competitorDomain`, `evidence`) ve aksiyon önerileri (`type`, `bucket`, metin anahtarı + parametreler).
- `--db` ile `findings` / `actions` tablolarına yazım Aşama 2'de (müşteri organizasyonu gerektirir).
- Komut: `npx tsx scripts/findings.ts --scan-id <id> [--runs-dir runs] [--labels data/competitor-labels.json]` (yalnızca okur, API isteği yok). Hedef domain ve doğrulanmış `cid`'ler taramanın `plan.json` dosyalarından okunur (proje dosyasında `targetDomains`, `targetLocalBusinesses`).

## 5. Testler

- Her kural için: koşul sağlanınca bulgu, sağlanmayınca yok; sınır değerleri (tam 2 rakip, tam %50, tam 3 örneklem).
- „Bulunamadı" cümlesinin „nicht gefunden" + derinlik içermesi; yasaklı ifadelerin (`nicht sichtbar`, `fehlt`, `kein Wettbewerb`, `Ranking steigt`) hiçbir şablonda geçmemesi.
- `error` / `cancelled` görevlerin hiçbir bulguya girmemesi; tüm örneklemleri başarısız belediyenin „nicht gemessen" olması.
- `technical_validation` çalıştırmasından reklam bulgusu çıkmaması.
- Etiketsiz rakiplerin „yerel rakip" sayılmaması; portalların ayrı listelenmesi.
- Öncelik skorunun formülle birebir aynı olması; en fazla 5 aksiyon.
- Her bulgunun `evidence` alanında `taskKey` ve `rawPath` bulunması.

## 6. Onay gereken kararlar

| Karar | Önerilen | Alternatif |
| --- | --- | --- |
| Organik eşik | ilk 10 | ilk 3 / ilk 5 |
| `organic_gap` için rakip sayısı | ≥ 2 local/regional | ≥ 1 |
| `competitor_coverage` eşiği | ≥ %50 belediye | ≥ %33 |
| Reklam bulgusu için örneklem | ≥ 3 | ≥ 2 |
| Öncelik formülü ağırlıkları | 0,5 / 0,3 / 0,2 | işletmeyle konuşulduktan sonra |
| Rakip etiketleri kaynağı | `competitor_labels` tablosu, v0'da `data/competitor-labels.json` | yalnızca dosya |
| Rapor dili | Almanca (pilot) | – |

---

## 7. Onaylanan kararlar ve ölçüm ayrıntıları (sürüm 0.2)

| Karar | Onaylanan |
| --- | --- |
| Organik eşik | İlk 10 |
| `organic_gap` rakip koşulu | **Her** geçerli ölçümde ayrı ayrı en az 2 farklı `local`/`regional` rakip ilk 10'da |
| `competitor_coverage` | ≥ %50, tam %50 dahil |
| Öncelik ağırlıkları | 0,5 boşluk / 0,3 nüfus / 0,2 yakınlık – pilot varsayımı |
| Rakip etiketleri | Elle hazırlanan, gözden geçirilmiş liste; bilinmeyen domain „nicht eingeordnet" |
| Reklam gözlemi | En az 3 **farklı oturumda** geçerli ölçüm |

**Örneklem:** Bir görevin tekrar denemeleri ayrı örneklem değildir. Belediye × keyword × oturum başına tek geçerli sonuç (görevin son başarılı denemesi) kullanılır. Aynı görev birden fazla çalıştırmada başarılıysa ilk başarılı olan seçilir.

**Local Pack işletme eşleştirmesi** (ilk tasarım; güncel kurallar bölüm 10)**:** Hedef işletme proje dosyasındaki doğrulanmış `targetLocalBusinesses[].cid` ile tanınır (DataForSEO `local_pack.cid`). Ölçüm başına durum:

| Durum | Koşul |
| --- | --- |
| `matched` | Local Pack'te `cid` doğrulanmış listede |
| `not_matched` | Local Pack var, doğrulanmış `cid` tanımlı, hiçbir öğe ne `cid` ne hedef domain ile eşleşiyor |
| `no_local_pack` | Ölçüm başarılı, Local Pack gösterilmemiş |
| `match_unverified` | Doğrulanmış `cid` tanımlı değil, ya da bir öğe hedef domaini taşıyor ama `cid`'i listede değil |
| (ölçülemedi) | Ölçüm başarısız; örneklem sayılmaz |

`local_pack_gap` yalnızca hiçbir ölçüm `matched` / `match_unverified` değilse ve en az bir ölçümde Local Pack içinde `local` rakip varsa üretilir. Herhangi bir ölçüm `match_unverified` ise durum „Betriebszuordnung nicht verifiziert" olur, bulgu üretilmez.

**Local Pack aksiyon metni:** „Prüfen Sie, ob Profilangaben, Kategorie und das tatsächlich bediente Einzugsgebiet in Ihrem Google-Unternehmensprofil zutreffend sind." Sınır metni: Google yerel sonuçlarda alaka, mesafe ve bilinirliği esas alır; profil kontrolü o belediyede sıralanma garantisi değildir.

**Kapsama paydası:** İlgili keyword'de en az bir geçerli ölçümü olan belediyeler. Rapor planlanan ve ölçülen sayıyı birlikte verir; organik kapsama, Local Pack kapsaması ve birleşik „en az bir kez gözlenen kapsama" ayrı gösterilir. Birleşik oran sürekli görünürlük anlamına gelmez.

**Öncelik skoru:** İş potansiyeli değil, inceleme sırası üretmek için seçilmiş bir yöntemdir; rapor bunu yazar (nüfus ≠ arama talebi, yakınlık ≠ kârlılık). Nüfus eksikse skor üretilmez, belediye „manuel inceleme" listesine girer. Bileşenler 0–1 aralığına sınırlanır; yarıçap ≤ 0 geçersizdir.

## 8. Kod incelemesi düzeltmeleri (`f787001` sonrası)

1. **Hedef domain tanımlı değilse** organik durum „Ziel-Domain nicht festgelegt" olur; hedefe bağlı organik bulgu (`organic_gap`), ona bağlı öncelik ve reklam hipotezi üretilmez. Rakip kapsaması ve reklam gözlemi devam eder.
2. **Keyword ayrımı:** organik boşluk belediye + keyword düzeyinde tutulur. Reklam hipotezi yalnızca aynı belediye ve aynı keyword'deki `organic_gap`'e dayanır; `basedOn` yalnızca var olan bulgulara bağlanır. (Öncelik skoru belediye düzeyinde kalır.)
3. **Kısmen ayrıştırılmış yanıt:** ayrıştırıcı bir sonuç öğesini çözemediyse (`issues`) o ölçüm bulgular için kullanılmaz; „unusable" (`parse_issues:<tür>`) olarak durum tablosunda „failed or unusable" sayılır. Yokluk çıkarımı yapılmaz.
4. **Eksik ölçüm cümlede görünür:** geçerli < planlanan ise „in 2 gültigen von 3 geplanten Messungen" / „in keiner der 2 gültigen von 3 geplanten Messungen".
5. **Öncelik aksiyonu:** „Prüfen Sie die Befunde für {Gemeinde}."; sıralamayı numaralar verir. İç şemada `bucket = monitoring` kalır; raporda „Prüfreihenfolge" altında gösterilir.

## 9. İlk canlı yanıttan düzeltmeler (21.10.2026, `c1c9098`)

- **Local Pack kimliği:** Canlı yanıtta `cid: null`, `domain: "www.google.com"`, `url` Google searchviewer linki. Google domaini işletme domaini sayılmaz (ayrıştırıcıda `null`); `cid`'siz öğe varken hedef eşleşmesi „Betriebszuordnung nicht verifiziert“ olur ve `local_pack_gap` üretilmez. Google rakip kapsamasına girmez. Hedef işletmeyi Local Pack'te tanıma yöntemi için karar bekleniyor (STATUS).
- **„Bulunamadı“ derinliği:** depth 20 istenir ama yanıt 14–16 organik sonuç içerir. Cümle artık ölçümlerdeki en küçük organik liste uzunluğunu söyler: „unter den ersten {n} organischen Ergebnissen nicht gefunden“; hiç organik sonuç yoksa „keine organischen Ergebnisse angezeigt“.

## 10. Local Pack: profil kimliği, adres ve marka gözlemi (21.10.2026, Halil'in onayıyla; bölüm 10'un ilk hali ve bölüm 11 yerine)

Önceki yöntem A (doğrulanmış profil adıyla `matched`) **kaldırıldı**: unvan, puan ve yorum sayısı tek başına profil kimliği değildir. Aynı adı, aynı puanı ve aynı yorum sayısını taşıyan farklı şubeler pilot 1'de gerçekten görüldü.

**Kaynak alanlar (ayrıştırıcı, `src/lib/dataforseo/parse.ts` + `local-identity.ts`).** Her Local Pack kaydında ayrı ayrı saklanır:

- `cid`: sağlayıcı alanı, değiştirilmeden.
- `svid`: Google searchviewer URL'sindeki ham değer.
- `googleId`: `svid` içinden çözülen `/g/…` değeri.
- `profileIdStatus`: `decoded`, `absent` ya da `undecodable`.
- `description`: ham snippet.

Google'ın kendi domaini işletme domaini sayılmaz (bölüm 9).

**`svid` çözümü varsayımdır.** Canlı yanıtlardan (21.10.2026) çıkarılan yapı şöyle:

1. base64url protobuf → alan 2 → alan 2 → `{1: "pvq", 2: base64 protobuf}`
2. İçteki protobufun alan 1'i: `/g/…`

Bu yapı belgelenmiş değil. Yapı farklıysa değer `undecodable` olur; tahmin yapılmaz. `/g/` değerinin zaman içinde kalıcı ve profil başına tekil olduğu pilot gözlemiyle (30 yanıt, 21 farklı `/g/` değeri, her biri tek bir unvanla) desteklenir ama **doğrulanmamıştır**.

**Hedef kimliği.** Kimlik `targetLocalBusinesses[]` listesinden okunur:

- Alanlar: `label`, `cid`, `googleId`, `address` (`street`, `houseNumber`, `postalCode`, `city`) ve zorunlu `source`.
- Aynı kayıtta birlikte verilen `cid` ve `googleId`, ikisinin aynı profil olduğunun kanıtıdır. Başka bir bağlantı kurulmaz.
- Çalıştırmadan sonra doğrulanan kimlik `findings --project <dosya>` ile verilir. Çalıştırma dosyaları değişmez; `findings.json` içindeki `identitySource` kimliğin nereden geldiğini kaydeder.

**Kayıt bazında değerlendirme (`assessLocalPackItem`).** Kurallar sırayla uygulanır:

| Sıra | Koşul | Sonuç (`assessment`) | Yöntem |
| --- | --- | --- | --- |
| 1 | Kaydın kendi `cid`'i veya `googleId`'si tek bir doğrulanmış profille aynı | `identity_match`. Aynı profilin adresiyle çelişki varsa ya da başka bir profilin tam adresi tutuyorsa `ambiguous` (`identity_address_conflict`). Birden fazla aday varsa `ambiguous` | `cid` / `google_id` |
| 2 | Kimlik eşleşmesi yok; snippet adresi **tek bir** profilin doğrulanmış adresiyle tam tutuyor (sokak, bina no, posta kodu, şehir) **ve** unvanda marka var | `address_match`. O profilin doğrulanmış kimliği varken kayıt başka bir kimlik taşıyorsa `ambiguous` (`address_identity_conflict`). Marka yoksa `ambiguous` (`address_without_brand`) | `address_full` |
| 3 | Birden fazla adres adayı (tam veya kısmi) | `ambiguous` (`several_address_candidates`) | – |
| 4 | Unvanda marka var, kimlik ve tam adres yok | `brand_only`. Gerekçe: `partial_address` · `address_differs` · `cid_not_verified` · `profile_id_undecodable` · `no_verified_identity` | – |
| 5 | Unvan profil adıyla aynı (`name_only`) veya benzer (`similar_name`); hedef domaini kimliksiz (`target_domain_without_identity`); markasız kısmi adres | `ambiguous` | – |
| 6 | Diğerleri | `not_target` | – |

**Adres karşılaştırması (`compareAddress`).** Dört alan tek tek karşılaştırılır:

- **Normalizasyon yalnızca yazımı birleştirir:** büyük-küçük harf, NFKC, ß/ss, "Str." → "Straße", tire ve boşluk. Kelime silinmez. Bina numarası ekiyle birlikte korunur, yani 25 ≠ 25/7 ≠ 25a.
- **Sonuçlar:**
  - `full`: dört alan da var ve aynı.
  - `partial`: bina numarası ve sokak aynı (ya da sokak yalnızca "belirsiz"), eksik alan var, farklı alan yok.
  - `conflict`: iki tarafta da bulunan bir alan farklı. Örnek: aynı sokak ve numara, başka şehir.
  - `insufficient`: sokak veya bina numarası yok.
- **Belirsiz sokak:** Snippet'ler kategoriyi sokağın önüne yapıştırıyor ("Ausrüstungsverleih Mühlweg 21"). Doğrulanmış sokak yalnızca metnin son kelimeleri olarak geçiyorsa sokak `uncertain` sayılır, çünkü "Alte Hauptstraße" ile "Hauptstraße" de böyle görünür. Belirsiz sokak hiçbir zaman `full` olmaz.
- Yalnızca şehir adı (posta kodu olmadan) okunmaz.

**Ölçüm başına durum (`localPackStatus`).** Öncelik sırası: `matched` > `address_match` > `match_unverified` > `brand_only` > `not_measurable` > `not_found_in_pack` > `no_local_pack`.

| Durum | Kanıt | Durum tablosu metni |
| --- | --- | --- |
| `matched` | Doğrulanmış kimlik | „im Local Pack, Platz {n}: {Profil} (Abgleich über verifizierte Kennung)" |
| `address_match` | Doğrulanmış tam adres + marka; kimlikten **zayıf** | „… Eintrag mit der vollständigen verifizierten Adresse von {Profil} (Adressabgleich, keine verifizierte Kennung)" |
| `match_unverified` | Belirsiz veya çelişkili kayıt. Ayrıca marka kelimesi tanımsızken kimliği karşılaştırılamayan kayıt (`no_id_in_response`), ya da doğrulanmış profil yok | „Betriebszuordnung nicht verifiziert" |
| `brand_only` | Yalnızca marka gözlemi | „Eintrag mit dem Markennamen im Local Pack (Platz {n}: {ham ad}); Standort nicht verifiziert" |
| `not_measurable` | Adsız kayıt, ya da `svid`'i çözülemeyen ve `cid`'i olmayan kayıt | „Local Pack nicht auswertbar" |
| `not_found_in_pack` | Gösterilen kayıtlarda doğrulanmış eşleşme yok. **Yokluk kanıtı değildir** | „unter den angezeigten Local-Pack-Einträgen kein verifizierter Treffer für den Zielbetrieb" |
| `no_local_pack` | Local Pack gösterilmedi | „kein Local Pack angezeigt" |

**Kayıt ve özetler.** `localPackDetails[].items` her kayıt için şunları saklar: ham ad, `cid`, `svid`, `googleId`, kendi domaini, değerlendirme, yöntem, kullanılan alanlar, okunan adres, profil bazında adres karşılaştırması ve gerekçe.

- `targetProfiles`: Doğrulanmış her profil için kimlik, adres ve belirsiz eşleşmelerin ölçüm listesi.
- `localPackProfiles`: Kayıtlar kendi kimliğine göre gruplanır (`cid:` / `gid:`). Kanıt yokken `cid` ve `gid` anahtarları birleştirilmez; iki anahtar aynı profil olabilir, bu yüzden toplanmaz. Sayılar farklı ölçüm sayısıdır.

**Domain ayrı bir işlemdir.** Local Pack kaydına domain yalnızca kaydın kendi web sitesi alanından verilir.

- Profil eşleşmesi, aynı unvan ya da başka bir kayıt üzerinden domain atanmaz; zincirleme bağlantı kurulmaz.
- Rakip kapsamasının Local Pack sütunu bu yüzden yalnızca kendi web sitesini taşıyan kayıtları sayar.

**Değişmeyenler.**

- `local_pack_gap` kapalı kalır (`LOCAL_PACK_GAP_ENABLED = false`). Adres yöntemi onu açmaz; açmak ayrı bir karardır.
- Organik kurallar ve eşikler değişmedi.
- Öncelik skoru yalnızca organik boşluktan beslenir.

**Pilot 1 sonucu (30 ham yanıt, yeni istek yok).** Marka 8 kayıtta görüldü; hepsi `brand_only`, hiçbiri doğrulanmış profile bağlanmadı:

- **6 kayıt (`gid`, Heidenheim ve Steinheim):** Snippet'te ofis profilinin sokak adı ve bina numarası var. Bina numarası ofis adresiyle aynı, sokak belirsiz, posta kodu ve şehir yok; yani `partial`. Heidenheim adresiyle sokak ve numara farklı.
- **2 kayıt (`cid`):** Kimlikleri doğrulanmış listede yok. Snippet'te yalnızca yer adı geçiyor.

Bu ölçümlerde dönen kayıtlar arasında Heidenheim profiline doğrulanmış bir eşleşme bulunamadı. 30 ölçümün hesabı: 8 marka kaydı olan + 21 marka kaydı olmayan ölçümde Local Pack var, 1 ölçümde Local Pack yok.

**`/g/` kayıtlarını bağlamanın sınırı:** Maps yanıtı `cid`, `place_id` ve `feature_id` (ikinci kısmı `cid`'in onaltılık hali) taşır, `/g/` taşımaz. Maps verisi yalnızca `cid` taşıyan kayıtlarla karşılaştırılabilir. Yalnızca `/g/` taşıyan kayıtlar için ortak alanı olan bir kaynak gösterilmeden ücretli sorgu yapılmaz.

## 11. Markanın başka şubeleri

Bölüm 10'a taşındı (`brand_other_location` → `brand_only`).

## 12. Ölçüm bazında gösterim ve kural kontrolleri (Pilot 1 değerlendirmesi, 21.10.2026)

- **Organik hücre her ölçümü gösterir**, yalnızca en iyi sırayı değil: „in 2 von 3 Messungen gefunden (Platz 8 und 8); in 1 Messung unter den zurückgegebenen organischen Ergebnissen nicht gefunden (18 Ergebnisse)". Tek ölçümde tekil ifade. Sonuç sayıları ölçüm başına korunur („18, 19 und 19 Ergebnisse").
- **„İlk N'de yok" denmez:** „unter den zurückgegebenen organischen Ergebnissen nicht gefunden (N Ergebnisse)". Sağlayıcının sıra numaraları raporda ayrıca kontrol edilir (pilot 1: tüm ölçümlerde 1..n kesintisiz).
- **Rakip kapsaması** bulgusu belediye başına gözlendiği ölçüm sayısını ve organik / Local Pack ayrımını söyler („Beobachtet in: Heidenheim: 1 von 3 Messungen (organisch 1, Local Pack 0); …"); `evidence.details.perSettlement`.
- **Kural kontrolleri (`ruleChecks`):** her kural ve hücre için `finding` · `not_met` (değerlendirildi, koşul sağlanmadı) · `not_evaluable` (eksik bilgi: hedef domain yok, ilk 10'da etiketsiz rakipler, yalnızca teknik deneme) · `disabled` (pilotta kapalı). Organik boşlukta etiketsiz rakipler sonucu değiştirebiliyorsa hücre „değerlendirilemedi" olur; eşikler gevşetilmez.
- **Teknik denemede reklam oranı** durum tablosunda gösterilmez („nicht ausgewertet (technische Validierung)").
