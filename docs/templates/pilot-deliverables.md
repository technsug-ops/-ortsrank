# Pilot teslim standardı

> Halil'in kararı, 22.10.2026: bundan sonraki **bütün pilotlarda** aynı klasör düzeni ve aynı teslim dosyaları.
> Dosyalar gerçek işletme verisi içerir ve git dışında tutulur (`data/`). Bu belge yalnızca düzeni tanımlar; dizin `data/reports/README.md`.

## Klasör düzeni

```
data/reports/
  README.md                         ← dizin: işletme, sürüm, müşteriye giden dosyalar, gönderildi mi
  _ortak/                           ← ortak üreticiler (anket, PDF baskısı)
  pilotN-<kısa-ad>/
    YYYY-MM-DD/                     ← teslim sürümü (ölçüm/rapor tarihi)
      1-musteriye-verilecek/        ← işletmeye verilecek Almanca PDF'ler
      2-gorusme/                    ← anket, DE + TR, HTML + PDF
      3-ic-kullanim/                ← yalnızca TechNS (Türkçe)
      4-kaynak-html/                ← PDF'lerin üretildiği HTML dosyaları
    eski/                           ← önceki taslaklar
    uretim/                         ← rapor üretim betikleri, anket ayarı (interview.json)
data/interviews/pilotN-interview.md ← görüşme cevapları (şablon: pilot-interview-form.md)
data/actions/pilotN-actions.md      ← aksiyon kaydı (şablon: action-register-template.md)
```

Sürüm klasörünün kökünde dosya bulunmaz.

## Her pilotta teslim edilecekler

| Klasör | Dosya | Dil |
| --- | --- | --- |
| `1-musteriye-verilecek/` | `pilotN-kurzfassung-YYYYMMDD-de.pdf` – teknik olmayan tek sayfalık yönetici özeti | DE |
| | `pilotN-bericht-YYYYMMDD-de.pdf` – pilot raporu (özet bölümleri) | DE |
| | `pilotN-bericht-YYYYMMDD-de-belege.pdf` – kanıt eki | DE |
| `2-gorusme/` | `pilotN-fragebogen-YYYYMMDD-de.html` / `.pdf`, `-tr.html` / `.pdf` – standart anket | DE, TR |
| `3-ic-kullanim/` | `pilotN-rapor-YYYYMMDD-tr-ic-inceleme.pdf`, `pilotN-yonetici-ozeti-YYYYMMDD-tr.pdf` | TR |
| `4-kaynak-html/` | `pilotN-bericht-YYYYMMDD.html` (etkileşimli rapor), özetlerin HTML'leri | DE/TR |

**Özet standardı:** Almanca kısa özet ve Türkçe yönetici özeti aynı yapıda, tek sayfa: iyi giden · hızlı düzeltilebilecek / dikkat çeken · bu ölçümde görünmedikleri yerler · netleştirilecekler · sonraki adımlar; teknik terim, kanıt kodu ve profil kimliği yok; vaat yok.

**Anket standardı:** Bölüm 1 (yönlendirmesiz, B1–B4) ve Bölüm 3 (karar, B5–B8) her işletmede birebir aynı; yalnızca Bölüm 2 işletmenin raporundaki bulgulardan gelir. HTML ekranda doldurulur ve cevaplarıyla kaydedilir; PDF elle doldurulur ([pilot-interview-form.md](pilot-interview-form.md)).

## Teslimden önce

- Teslim dosyalarının kendisinde kontrol: yer tutucu ve başka işletmeden kalan metin yok; DE ve TR'de sayılar aynı; ölçüm saatleri UTC/yerel doğru; yerel dosya yolu yok.
- `data/reports/README.md` dizinine satır: sürüm, müşteriye giden dosyalar, „gönderildi mi“.
- Rapor yeniden üretilirse sürüm damgası değişir; teslim edilmiş bir sürüm gerekmedikçe yeniden üretilmez.
