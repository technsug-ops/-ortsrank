# Kurallar v0 – sentetik örnek çıktı

> **Sentetik veri.** Bu çıktı `tests/findings-e2e.test.ts` testindeki uydurma bir „dünyadan" üretildi; belediyelerden yalnızca Frankfurt am Main gerçek AGS'dir, diğerleri (`Beispielstadt …`, `99xxxxxx`) uydurmadır. Domainler kurgusal (`.example`). Gerçek tarama verisi değildir.
> Kurallar: [RULES_V0.md](../RULES_V0.md) sürüm 0.2 · Üretim: 21.10.2026 (Local Pack ad eşleştirmesi sonrası) · Yeniden üretmek için: `SHOW_FINDINGS=<dosya> npx vitest run tests/findings-e2e.test.ts`

## Sentetik dünya

| Belediye | Durum |
| --- | --- |
| Frankfurt am Main | Hedef organik 3., Local Pack'te profil adıyla tam eşleşiyor, her oturumda reklam. Oturum 1'in ilk denemesi zaman aşımı, tekrar başarılı |
| Beispielstadt A | Hedef organik 14., ilk 10'da iki yerel rakip; Local Pack var, profil adı yok (pilotta Local Pack boşluğu bulgusu üretilmez); reklam yok |
| Beispielstadt B | Hedef yok; rakipler ölçüme göre değişiyor (3. ölçümde yalnızca 1 yerel rakip + portal); Local Pack hiç yok; 1 oturumda reklam |
| Beispielstadt G | Hedef organik yok, iki yerel rakip; Local Pack'te profil adına **benzer ama farklı** bir ad („Ziel Betrieb") → doğrulanamadı |
| Beispielstadt H | Oturum 2 başarısız (40501); diğer iki ölçümde yerel + bölgesel rakip |

Oturum 1 iki kez çalıştırıldı; ilk başarılı çalıştırma kullanıldı (ölçüm sayısı artmadı).

## Çıktı (`scripts/findings.ts`)

```text
Rules v0.2 · scan test-scan · 5 planned settlements

Status (settlement · keyword · valid/planned · organic · local pack · ads):
  Frankfurt am Main · Terrassenüberdachung · 3/3 · bestes Ergebnis Platz 3 · im Local Pack, Platz 1 (Abgleich über den Profilnamen) · 3/3
  Frankfurt am Main · Terrassenüberdachung mit Montage · 1/1 · bestes Ergebnis Platz 2 · kein Local Pack angezeigt · 0/1
  Beispielstadt A · Terrassenüberdachung · 3/3 · bestes Ergebnis Platz 14 · im angezeigten Local Pack kein Eintrag mit dem Profilnamen gefunden · 0/3
  Beispielstadt A · Terrassenüberdachung mit Montage · 1/1 · bestes Ergebnis Platz 2 · kein Local Pack angezeigt · 0/1
  Beispielstadt B · Terrassenüberdachung · 3/3 · unter den ersten 20 organischen Ergebnissen nicht gefunden · kein Local Pack angezeigt · 1/3
  Beispielstadt B · Terrassenüberdachung mit Montage · 1/1 · bestes Ergebnis Platz 2 · kein Local Pack angezeigt · 0/1
  Beispielstadt G · Terrassenüberdachung · 3/3 · unter den ersten 20 organischen Ergebnissen nicht gefunden · Betriebszuordnung nicht verifiziert · 0/3
  Beispielstadt G · Terrassenüberdachung mit Montage · 1/1 · bestes Ergebnis Platz 2 · kein Local Pack angezeigt · 0/1
  Beispielstadt H · Terrassenüberdachung · 2/3 (1 failed or unusable) · unter den ersten 20 organischen Ergebnissen nicht gefunden · kein Local Pack angezeigt · 0/2
  Beispielstadt H · Terrassenüberdachung mit Montage · 1/1 · bestes Ergebnis Platz 2 · kein Local Pack angezeigt · 0/1

[organic_gap] 3
  (Beobachtung) In Beispielstadt A war ziel-betrieb.example bei „Terrassenüberdachung“ in 3 von 3 gültigen Messungen nicht unter den ersten 10 organischen Ergebnissen (bestes Ergebnis Platz 14). In jeder dieser Messungen waren mindestens 2 lokale oder regionale Wettbewerber unter den ersten 10 – Messung 1 (21.10.2026): lokal-a.example und lokal-b.example; Messung 2 (21.10.2026): lokal-a.example und lokal-b.example; Messung 3 (21.10.2026): lokal-a.example und lokal-b.example.
    → review/website: Prüfen Sie, ob Ihre bestehende Seite den Bedarf für „Terrassenüberdachung“ in Beispielstadt A abdeckt.
  (Beobachtung) In Beispielstadt G war ziel-betrieb.example bei „Terrassenüberdachung“ in 3 von 3 gültigen Messungen nicht unter den ersten 10 organischen Ergebnissen (unter den ersten 20 organischen Ergebnissen nicht gefunden). In jeder dieser Messungen waren mindestens 2 lokale oder regionale Wettbewerber unter den ersten 10 – Messung 1 (21.10.2026): lokal-a.example und lokal-b.example; Messung 2 (21.10.2026): lokal-a.example und lokal-b.example; Messung 3 (21.10.2026): lokal-a.example und lokal-b.example.
    → review/website: Prüfen Sie, ob Ihre bestehende Seite den Bedarf für „Terrassenüberdachung“ in Beispielstadt G abdeckt.
  (Beobachtung) In Beispielstadt H war ziel-betrieb.example bei „Terrassenüberdachung“ in 2 gültigen von 3 geplanten Messungen nicht unter den ersten 10 organischen Ergebnissen (unter den ersten 20 organischen Ergebnissen nicht gefunden). In jeder dieser Messungen waren mindestens 2 lokale oder regionale Wettbewerber unter den ersten 10 – Messung 1 (21.10.2026): lokal-a.example und region-c.example; Messung 3 (21.10.2026): lokal-a.example und region-c.example.
    → review/website: Prüfen Sie, ob Ihre bestehende Seite den Bedarf für „Terrassenüberdachung“ in Beispielstadt H abdeckt.

[competitor_coverage] 2
  (Beobachtung) Von 5 geplanten Gemeinden konnten 5 für „Terrassenüberdachung“ gemessen werden. lokal-a.example wurde in 5 dieser 5 Gemeinden in mindestens einer Messung unter den ersten 10 organischen Ergebnissen oder im Local Pack beobachtet (organisch: 5, Local Pack: 0). Eingeordnet von TechNS als: local.
    Hinweis: „In mindestens einer Messung beobachtet“ bedeutet nicht, dass die Domain dort dauerhaft sichtbar ist.
  (Beobachtung) Von 5 geplanten Gemeinden konnten 5 für „Terrassenüberdachung“ gemessen werden. lokal-b.example wurde in 4 dieser 5 Gemeinden in mindestens einer Messung unter den ersten 10 organischen Ergebnissen oder im Local Pack beobachtet (organisch: 4, Local Pack: 0). Eingeordnet von TechNS als: local.
    Hinweis: „In mindestens einer Messung beobachtet“ bedeutet nicht, dass die Domain dort dauerhaft sichtbar ist.

[ad_observation] 6
  (Beobachtung) In Frankfurt am Main wurden bei „Terrassenüberdachung“ in 3 von 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen (21.10.2026, mobil, Gemeindemitte).
  (Beobachtung) In Beispielstadt A wurden bei „Terrassenüberdachung“ in keiner der 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen (21.10.2026, mobil, Gemeindemitte).
  (Hypothese) Hypothese, zu prüfen: Eine kleine Testkampagne für „Terrassenüberdachung“ in Beispielstadt A könnte zeigen, zu welchen Kosten dort Sichtbarkeit über Anzeigen möglich ist.
    → verification/ads: Planen Sie eine Testkampagne mit kleinem Budget für „Terrassenüberdachung“ in Beispielstadt A und erfassen Sie die Kosten.
  (Beobachtung) In Beispielstadt B wurden bei „Terrassenüberdachung“ in 1 von 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen (21.10.2026, mobil, Gemeindemitte).
  (Beobachtung) In Beispielstadt G wurden bei „Terrassenüberdachung“ in keiner der 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen (21.10.2026, mobil, Gemeindemitte).
  (Hypothese) Hypothese, zu prüfen: Eine kleine Testkampagne für „Terrassenüberdachung“ in Beispielstadt G könnte zeigen, zu welchen Kosten dort Sichtbarkeit über Anzeigen möglich ist.
    → verification/ads: Planen Sie eine Testkampagne mit kleinem Budget für „Terrassenüberdachung“ in Beispielstadt G und erfassen Sie die Kosten.

[review_priority] 3
  Prüfreihenfolge (Ableitung aus den Beobachtungen oben). Das ist ein für diese erste Version gewähltes Verfahren, um eine Reihenfolge für die Prüfung festzulegen – keine Bewertung des Geschäftspotenzials: Einwohnerzahl ist kein Suchvolumen, Nähe ist keine Rentabilität. Formel: 100 × (0,5 × Lücke + 0,3 × Einwohneranteil + 0,2 × Nähe).
  (Ableitung) 1. Beispielstadt A – Wert 51 (Lücke 0,60, Einwohneranteil 0,17, Nähe 0,80)
    → review/monitoring: Prüfen Sie die Befunde für Beispielstadt A.
  (Ableitung) 2. Beispielstadt G – Wert 32 (Lücke 0,60, Einwohneranteil 0,02, Nähe 0,07)
    → review/monitoring: Prüfen Sie die Befunde für Beispielstadt G.
  (Ableitung) 3. Beispielstadt H – Wert 31 (Lücke 0,60, Einwohneranteil 0,01, Nähe 0,03)
    → review/monitoring: Prüfen Sie die Befunde für Beispielstadt H.
Written to runs/scans/test-scan/findings.json
```
