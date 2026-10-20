# Ortsrank

Lokales Google-Ranking für Betriebe in Deutschland – Ort für Ort, auf Basis des amtlichen Gemeindeverzeichnisses.
Ein Angebot der TechNS UG (haftungsbeschränkt). Live: https://ortsrank.foundercheck.de

## Stack

- Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript
- Tailwind CSS v4
- i18n: `src/app/[lang]` + `src/proxy.ts` + JSON dictionaries (`de`, `en`, `tr`); the search language is always German
- Postgres (Neon) + Drizzle ORM — multi-tenant schema in `src/db/schema.ts`
- Vercel (region `fra1`)

## Grundsätze

1. **Nur echte Daten.** Orte kommen ausschließlich aus Destatis GV-ISys (AGS). Ein Ort ohne Provider-Mapping wird als „nicht scanbar“ markiert, nie ersetzt.
2. **Nachvollziehbar.** Jede Zahl im Report verweist auf Abruf, Ort, Gerät und Provider-Task.
3. **Mandantenfähig.** Jede Kundentabelle trägt `organization_id`.
4. **Mehrsprachig.** Keine Texte im Code – alles in `src/i18n/dictionaries`.

## Entwicklung

```bash
cp .env.example .env.local
npm install
npm run dev
npx drizzle-kit generate   # Migration aus dem Schema erzeugen
```
