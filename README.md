# 🏓 Ping Pong Ladder

The office table tennis rankings. After every game you enter who won, and the site keeps track of the Elo rankings, stats and head-to-heads.

## Features

- **Add a result** in a few taps: pick yourself, your opponent and who won. Your name is remembered.
- **House rules**: 🐢 *Under the table* (won 15-0, the loser crawls under the table) and ☕ *Coffee slave challenge* (someone 0-2 down in sets calls that they will still win). The loser of a coffee slave challenge is always the coffee slave on the next working day.
- **Rankings** based on Elo (everyone starts at 1000, K = 48), with the last 5 games and win or loss streaks.
- **Player profile** with a rating chart, arch rival, nemesis, biggest upset and head-to-head against everyone.
- **Head-to-head** between two players, including the chance of winning the next game.
- **Undo** your own result within 15 minutes.
- **Admin** (`/admin`, with an admin code): add, rename or deactivate players, and delete results.

Ratings are not stored. They are recalculated from all results every time, so deleting or fixing a result updates every rating immediately. This also makes a yearly reset (e.g. on 1 September) easy to add later.

## Tech

- [Next.js](https://nextjs.org) (App Router), plain JavaScript
- PostgreSQL (e.g. [Neon](https://neon.tech) via Vercel). Tables are created automatically on the first request.
- Hosted on [Vercel](https://vercel.com)

### Environment variables

| Name | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (set automatically when you connect Neon through Vercel; `POSTGRES_URL` also works) |
| `ADMIN_CODE` | Secret code for the admin page `/admin` |

### Running locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and ADMIN_CODE
npm run dev
npm test                     # Elo and stats tests
```

## Deploying on Vercel

1. Log in at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New → Project** and import `pingpong-ranglijst`.
3. Under **Environment Variables**, add `ADMIN_CODE` with a secret code of your choice, then click **Deploy**.
4. In the project, go to **Storage → Create Database → Neon (Postgres)** and connect it to the project. `DATABASE_URL` is then set automatically.
5. Go to **Deployments** and choose **Redeploy** on the latest deployment so the database setting takes effect.
6. Open `https://<your-site>.vercel.app/admin`, log in with your code and paste in the names of all your colleagues.

Every push to `main` is deployed automatically.
