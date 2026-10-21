# Pilot ayarları – taslak

> Durum: **taslak, Halil'in kararını bekliyor** · 21.10.2026
> Kaynak: canlı deneme `trial-20261021` (Frankfurt am Main, Offenbach am Main; 8 ham yanıt) ve Destatis GV 31.12.2025. Rakamlar gerçek komut çıktısından.
> Kararlar verilince `projects/pilot-rhein-main.json` güncellenir ve bu belge „onaylandı" olur.

---

## 1. Keywordler

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

## 2. Tarama alanı

**Önce pilot işletmenin konumu doğrulanmalı.** Merkez (`centerAgs`) ve yarıçap işletmenin gerçekten hizmet verdiği bölgeye göre seçilir; şu anki Frankfurt merkezi bir varsayımdır.

Frankfurt merkezli seçenekler (Destatis GV 31.12.2025, nüfus eşiğini geçen belediye sayısı):

| Yarıçap | ≥ 10.000 | ≥ 15.000 | ≥ 20.000 | ≥ 25.000 |
| --- | --- | --- | --- | --- |
| 20 km | 36 | 31 | 25 | 20 |
| 25 km | 47 | 36 | 29 | 22 |
| 30 km | 66 | 47 | 34 | 27 |

Bugünkü ayar (30 km, ≥ 10.000, en fazla 30) seçimi 17,4 km'de kesiyor.

**Öneri (Frankfurt merkezi kalırsa):** 25 km, ≥ 20.000, en fazla 30 → 29 belediye, ROADMAP'teki 20–30 hedefinde ve kesilme yok.

## 3. Maliyet (taslak set: ana keyword 3 örneklem + 3 keyword × 1)

Görev = belediye × 6. Fiyat canlı denemede doğrulandı: 0,004 $ / deneme (depth 20).

| Alan | Belediye | Görev / tarama | Beklenen | En kötü durum |
| --- | --- | --- | --- | --- |
| 25 km, ≥ 20.000 | 29 | 174 | 0,84 $ | 2,09 $ |
| 30 km, ≥ 10.000, en fazla 30 | 30 | 180 | 0,86 $ | 2,16 $ |
| 30 km, ≥ 20.000 | 34 | 204 | 0,98 $ | 2,45 $ |

Değişkenlik ölçümü (3 gün) yaklaşık üç katı. Kalan deneme bakiyesi (~0,95 $) bir tam taramanın en kötü durumunu karşılamaz; tam pilot için DataForSEO'ya en az 50 $ yatırılmalı (tek seferlik, süresiz bakiye).

## 4. Rakip etiketleri

Taslak `data/competitor-labels.draft.json` dosyasında (git dışı; gerçek işletme adları içerir). Canlı denemedeki 49 domainden 31'ine öneri var: portal 10, national 16, manufacturer 2, local 1, regional 2. Kanıt: bilinen platform/zincir/üretici, ya da herkese açık Impressum'daki ilk adres (21.10.2026). 18 domain belirsiz, etiketsiz kaldı.

- Etiketler TechNS'in sınıflandırmasıdır; raporda „Eingeordnet von TechNS als …" olarak görünür.
- Impressum adresi hizmet bölgesini kanıtlamaz; bir firma birden fazla şubeye sahip olabilir. „local/regional" önerileri gözden geçirilmeli.
- Onaydan sonra `data/competitor-labels.json` oluşturulur; etiketsiz domainler „nicht eingeordnet" kalır ve organik boşluk kuralında rakip sayılmaz.
- Liste 30 belediyelik tam taramadan sonra genişler; yeni domainler yine aynı yöntemle önerilir.

## 5. Proje dosyasına girecekler (karar sonrası)

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
