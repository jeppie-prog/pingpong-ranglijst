# 🏓 Pingpong Ranglijst

De tafeltennis-ranglijst van kantoor. Na elk potje vul je in wie er won, en de site houdt de Elo-ranglijst, statistieken en head-to-heads bij.

## Wat zit erin

- **Uitslag invullen** in een paar tikken: kies jezelf, je tegenstander en wie er won. Je naam wordt onthouden.
- **Huisregels**: 🐢 *Onder de tafel door* (gewonnen met 15-0) en ☕ *Koffieslaaf-uitdaging* (wie 0-2 achterstond en riep dat hij nog ging winnen). De verliezer van een koffieslaaf-uitdaging is altijd de koffieslaaf op de volgende werkdag.
- **Ranglijst** op basis van Elo (iedereen begint op 1000, K = 32), met de laatste 5 potjes en winst- of verliesreeksen.
- **Spelersprofiel** met een grafiek van de rating, de aartsrivaal, de nemesis, de grootste stunt en de head-to-head tegen iedereen.
- **Head-to-head** tussen twee spelers, inclusief de winkans voor het volgende potje.
- **Ongedaan maken** van je eigen uitslag binnen 15 minuten.
- **Beheer** (`/beheer`, met beheerderscode): spelers toevoegen, hernoemen of inactief maken, en uitslagen verwijderen.

Ratings worden niet opgeslagen, maar steeds opnieuw uit alle uitslagen berekend. Een uitslag verwijderen of corrigeren werkt dus meteen door in alle ratings. Een jaarlijkse reset (bv. per 1 september) wordt daardoor later eenvoudig.

## Techniek

- [Next.js](https://nextjs.org) (App Router), gewone JavaScript
- PostgreSQL (bijvoorbeeld [Neon](https://neon.tech) via Vercel). Tabellen worden bij de eerste aanvraag automatisch aangemaakt.
- Hosting op [Vercel](https://vercel.com)

### Omgevingsvariabelen

| Naam | Uitleg |
| --- | --- |
| `DATABASE_URL` | Postgres-verbinding (wordt automatisch gezet als je Neon via Vercel koppelt; `POSTGRES_URL` werkt ook) |
| `ADMIN_CODE` | Geheime code voor de beheerpagina `/beheer` |

### Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul DATABASE_URL en ADMIN_CODE in
npm run dev
npm test                     # rekentests voor Elo en statistieken
```

## Online zetten op Vercel

1. Log in op [vercel.com](https://vercel.com) met je GitHub-account.
2. Klik op **Add New → Project** en importeer `pingpong-ranglijst`.
3. Voeg bij **Environment Variables** `ADMIN_CODE` toe, met een zelfgekozen geheime code, en klik op **Deploy**.
4. Ga in het project naar **Storage → Create Database → Neon (Postgres)** en koppel die aan het project. `DATABASE_URL` wordt dan automatisch ingesteld.
5. Ga naar **Deployments** en kies **Redeploy** bij de nieuwste deployment, zodat de database-instelling actief wordt.
6. Open `https://<jouw-site>.vercel.app/beheer`, log in met je code en plak de namen van alle collega's.
