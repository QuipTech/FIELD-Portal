# QuipTech FIELD — Portal

## Purpose

This is the User Portal and Admin Console frontend for QuipTech FIELD — a separate Next.js app from the marketing landing page at the project root. It's currently a bare scaffold; the actual portal/admin screens are not built yet and should be implemented next from the `QuipTech FIELD Phase 1 UI` designs.

## Folder structure

```
portal/
├── app/
│   ├── layout.tsx     ← root layout, fonts, metadata
│   ├── page.tsx        ← placeholder home page
│   └── globals.css     ← Tailwind entry point
├── tailwind.config.ts   ← shares FIELD's brand color tokens
├── tsconfig.json
└── next.config.js
```

## How to run locally

```bash
cd portal
npm install
npm run dev
```

Runs on **http://localhost:3001** (not 3000), so it can run side by side with the landing app.

## Key conventions specific to this app

- Independent app with its own `package.json` — not part of a monorepo/workspace with the landing page.
- Follows the same naming, component, and 200-line file rules as the rest of the project (see the root `CLAUDE.md`).
- Brand color tokens in `tailwind.config.ts` are duplicated from the landing app's config to keep visual consistency; if this grows into a real monorepo later, promote them to a shared `packages/types` or `packages/ui` token file instead of keeping two copies in sync by hand.

## Environment variables required

None yet.
