# Simple Task Organizer

A small Next.js app for organizing goals as task graphs with child streams, successor links, due-date warnings, and local browser persistence.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy To Vercel

1. Push this project to a GitHub repository.
2. In Vercel, create a new project from that repository.
3. Keep the default settings:
   - Framework preset: `Next.js`
   - Build command: `npm run build`
   - Install command: `npm install`
4. Deploy.

Current persistence is `localStorage`, so data is saved per browser/device. The next backend step is Railway Postgres plus auth.

## Prototype

The original static prototype is kept in `prototype/` for reference. The active app is the Next.js app in `app/`, `components/`, and `lib/`.
