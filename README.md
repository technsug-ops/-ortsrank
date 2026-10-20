# Ortsrank

Zeigt Betrieben mit regionalem Einzugsgebiet, in welchen Gemeinden sie bei Google hinter der Konkurrenz liegen und wo sie zuerst ansetzen sollten.
Ein Angebot der TechNS UG (haftungsbeschränkt). Live: https://ortsrank.foundercheck.de

## Stack

- Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript
- Tailwind CSS v4
- i18n: `src/app/[lang]` + `src/proxy.ts` + JSON dictionaries (`de`, `en`, `tr`); the search language is always German
- Postgres (Neon) + Drizzle ORM — multi-tenant schema in `src/db/schema.ts`
- Vercel (region `fra1`)

## Grundsätze

1. **Nur echte Daten.** Messeinheit sind die Gemeinden aus Destatis GV-ISys (AGS), gemessen von einem repräsentativen Mittelpunkt. Nicht messbare Gemeinden werden als solche ausgewiesen, nie ersetzt.
2. **Nachvollziehbar.** Jede Zahl im Report verweist auf die Rohantwort (`serp_raw`), Zeitpunkt, Messpunkt und Gerät.
3. **Evidenzstufen.** Jede Erkenntnis ist Beobachtung, Ableitung oder Hypothese; keine Genauigkeits- oder Kausalitätsversprechen.
4. **Mandantenfähig.** Jede Kundentabelle trägt `organization_id`.
5. **Mehrsprachig.** Keine Texte im Code – alles in `src/i18n/dictionaries`.

Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Entwicklung

```bash
cp .env.example .env.local
npm install
npm run dev
npx drizzle-kit generate   # Migration aus dem Schema erzeugen
```
