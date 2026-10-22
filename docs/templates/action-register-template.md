# Aksiyon kaydı – şablon

> Anonim şablon. Gerçek işletme ve rakip bilgisi içeren kayıtlar git dışında tutulur: `data/actions/<proje>-actions.md`.
> Dayanak: ROADMAP bölüm 5 (kanıt seviyeleri, aksiyon türleri), bölüm 6 (dönem karşılaştırma şartları), RULES_V0 bölüm 1.

Kayıt dosya temellidir: proje başına bir Markdown dosyası, aksiyon başına bir bölüm. Uygulama kodu yoktur. Aşama 2'de admin paneli geldiğinde kayıtlar veritabanındaki `actions` tablosuna taşınır (eşleme aşağıda).

## Kurallar

1. **Uydurma yok.** Sorumlu, hedef tarih, müşteri kararı ve süre yalnızca gerçekten belirlendiyse veya ölçüldüyse yazılır; yoksa alan boş kalır. Geçmiş emek sonradan tahmin edilmez.
2. **Kanıt seviyesi ayrı.** Gözlem (kaynakta doğrudan görülen), çıkarım (gözlemlerin yorumu), hipotez (sınanmamış neden/etki). Bir aksiyonun dayanağı birden fazla seviye içeriyorsa her biri ayrı satırda.
3. **Önce inceleme.** İyileştirme aksiyonu ancak inceleme ihtiyacı doğruladıktan sonra açılır. İnceleme sonunda değişiklik gerekmiyorsa aksiyon gerekçesiyle **tamamlandı** olur.
4. **Tamamlanma ≠ etki.** „İş tamamlandı" ölçütü (teslim çıktısı var mı?) ile görünürlük üzerindeki etki (sonraki ölçümde ne değişti?) ayrı alanlardır. Etki alanı nedensellik iddiası taşımaz: „işlem + sonrasındaki değişim" yazılır. Sıralama veya gelir artışı garanti edilmez.
5. **Onay ayrı.** İşletmenin sitesine, Google profillerine veya bütçesine dokunan her adım önce işletmenin onayını bekler; onay kaydı tarih ve kişi rolüyle yazılır.

## Durumlar

`planlandı` → `inceleniyor` → `karar/onay bekliyor` → `uygulandı` → `takip ediliyor` → `tamamlandı`

| Durum | Anlamı | Sonraki duruma geçiş şartı |
| --- | --- | --- |
| planlandı | Konu, dayanak ve planlanan çıktı yazılı; iş başlamadı | Gerekli girdiler var ve iş başladı |
| inceleniyor | İnceleme yapılıyor | İnceleme notu (planlanan çıktı) hazır |
| karar/onay bekliyor | Çıktı işletmede; karar bekleniyor | İşletmenin kararı kaydedildi |
| uygulandı | Karar verilen değişiklik yapıldı (tarih, kim) | Takip yöntemi ve tarihi belirlendi |
| takip ediliyor | Sonraki ölçüm/kontrol bekleniyor | Takip ölçümü yapıldı ve kaydedildi |
| tamamlandı | Kapanış gerekçesi yazılı | – |

Kısa yollar: inceleme sonunda değişiklik gerekmiyorsa `inceleniyor` → `tamamlandı` (gerekçe zorunlu). İşletme değişikliği istemezse `karar/onay bekliyor` → `tamamlandı` (karar „değişmedi" olarak kaydedilir; olumsuz cevap sayılmaz, karar sayılır).

**Veritabanı eşlemesi** (`src/db/schema.ts` › `actions`): tür `inceleme` / `iyileştirme` / `doğrulama çalışması` → `review` / `improvement` / `verification`. Durum: `tamamlandı` → `done`; işletme kararıyla vazgeçilen → `dismissed`; diğer beş durum → `open`. Ayrıntılı durum, tablo genişletilene kadar bu dosyada tutulur.

## Aksiyon bölümü

Her aksiyon için aşağıdaki tablo kopyalanır. Boş alan = henüz belirlenmedi.

```markdown
## <Kimlik> · <Başlık>

| Alan | Değer |
| --- | --- |
| Kimlik / proje | <PROJE>-A01 / <proje> |
| Başlık | |
| Tür | inceleme / iyileştirme / doğrulama çalışması |
| Dayanak – gözlem | <kanıt kimlikleri, kaynak, tarih> |
| Dayanak – çıkarım | |
| Dayanak – hipotez | |
| İnceleme sorusu | |
| Yapılacak somut iş | |
| Gerekli girdiler | <var / eksik: ...> |
| Planlanan teslim çıktısı | <henüz yapılmamış işin planlanan teslimi> |
| Bu çıktıyla verilebilecek karar | |
| Sınırlar | <ne yapılmayacak, ne iddia edilmeyecek> |
| Sorumlu | |
| Hedef tarih | |
| Onay gereksinimi | <kimden, ne için> |
| Onay durumu | gerekmiyor / bekliyor / verildi (tarih, rol) / verilmedi |
| İş durumu | planlandı |
| Tamamlanma ölçütü | <hangi çıktı varsa iş tamamdır> |
| Takip yöntemi | <hangi ölçüm/kontrol, aynı keyword/koordinat/cihaz/dil/derinlik> |
| Görünürlük etkisi | <takip ölçümünden sonra: işlem + sonrasındaki değişim; nedensellik iddiası yok> |
| Sonuç | |
| Kalan belirsizlik | |

**Süre kaydı** (yalnızca bundan sonra ölçülen süre)

| Tarih | Kişi (rol) | Tür (hazırlık / inceleme / açıklama / uygulama) | Dakika | Not |
| --- | --- | --- | --- | --- |

**Durum geçmişi**

| Tarih | Eski durum | Yeni durum | Gerekçe / kanıt |
| --- | --- | --- | --- |
```
