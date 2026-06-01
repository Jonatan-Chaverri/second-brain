# Second Brain

<p align="center">
  <img src="docs/blink.gif" alt="Blink mascot animation" width="160" />
</p>

Second Brain is a private, self-hosted AI journal. You write one entry per day, the app extracts structured metadata from it, stores embeddings with `pgvector`, and lets you chat only against your own saved journal context.

The project is intended to be open source and reusable by anyone. It does not hardcode personal aliases or diary-specific knowledge in source code.

## Current Status

The current MVP is working and includes:

- owner-only authentication with Supabase Auth
- protected `journal`, `chat`, and `aliases` pages
- one journal entry per user per day
- overwrite/update support for today's entry
- server-side OpenAI processing on save
- pgvector embeddings stored in Postgres
- semantic retrieval for chat
- normalized `projects` and `people` tables
- JSON metadata on `journal_entries`
- alias management UI and API

Current metadata extracted from each entry:

- `topics`
- `tools`
- `events`
- `media`
- `observations`
- `emotions`
- `actionItems`
- `lessons`
- `ideas`
- `experiences`
- `workKnowledge`

`projects` and `people` are kept as normalized tables. Everything else above is stored as native JSON arrays directly on `journal_entries`.

## How It Works

When you save a journal entry:

1. The app upserts a single entry for `userId + entryDate`.
2. OpenAI generates a summary, projects, people, metadata arrays, and an embedding.
3. The app resolves aliases from the database.
4. `projects` and `people` are upserted into normalized tables.
5. Journal-to-project and journal-to-person joins are replaced.
6. Metadata arrays are stored on the journal row as JSON.
7. The embedding is stored in Postgres using `pgvector`.

If you rewrite today's entry and save again, the same row for today is updated. This is expected behavior in the current MVP.

## Alias System

Aliases exist so the app can normalize recurring names without hardcoding user-specific rules in code.

Example:

- extracted value: `personal blog`
- alias type: `project`
- canonical name: `personal_blog`
- display name: `Personal Blog`

After that, future entries that mention that alias resolve automatically.

Alias behavior:

- aliases are stored in `entity_aliases`
- aliases are scoped per user
- if an alias exists, the canonical name from the database is used
- if no alias exists, the app falls back to generic normalization

You can manage aliases from:

- `/aliases`

Available alias entity types:

- `project`
- `person`
- `topic`
- `tool`
- `event`
- `media`
- `observation`
- `emotion`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- Supabase Auth
- Supabase Postgres / PostgreSQL
- OpenAI API
- `pgvector`
- Vercel

## Prerequisites

Before running this project, you need:

- a Supabase project
- a Postgres database
- the `vector` extension available in Postgres
- an OpenAI API key
- a Vercel account if you want hosted deployment

Recommended setup for this repo:

- Supabase Auth for login/session handling
- Supabase Postgres for the database
- Vercel for hosting the Next.js app

## Environment Variables

See [.env.example](/Users/jonatan/Desktop/journal/.env.example).

Required variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_SUMMARY_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OWNER_EMAIL`

Notes:

- `OWNER_EMAIL` is the only email allowed to access the app
- `DATABASE_URL` is used by Prisma at runtime
- `DIRECT_URL` is used for Prisma migrations
- Supabase service role is not required in the current implementation

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env.local
```

3. Fill in real values for Supabase, Postgres, OpenAI, and `OWNER_EMAIL`.

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run migrations:

```bash
npm run prisma:migrate
```

6. Start the app:

```bash
npm run dev
```

## Database Notes

Important storage rules in the current implementation:

- JSON metadata is stored as native JSON arrays, not stringified JSON
- embeddings are stored as native `pgvector` values, not text or JSON
- `projects` and `people` are normalized tables
- metadata categories remain on `journal_entries` for MVP simplicity

Useful scripts:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run backfill:aliases
```

`npm run backfill:aliases` is idempotent and re-resolves existing stored data through the `entity_aliases` table.

## Supabase Setup

This app currently uses Supabase only for authentication and session handling.

What Supabase is used for:

- magic link / auth session flow
- protected owner-only access
- browser/server session cookies

What Supabase is not used for:

- application data ORM access

Journal data is handled through Prisma against Postgres.

## Vercel Deployment

To deploy on Vercel:

1. Create a Vercel project connected to this repo.
2. Add the same environment variables from your local env.
3. Make sure your database URLs are reachable from Vercel.
4. Make sure Supabase Auth redirect URLs include your Vercel domain.
5. Deploy.

Deployment notes:

- the project is currently pinned to `next 15.5.9`
- this was updated to satisfy current Next.js security requirements enforced by Vercel
- if Vercel reports an outdated or vulnerable Next.js version later, upgrade to the latest patched release in the current line

## Routes

Main app routes:

- `/login`
- `/journal`
- `/chat`
- `/aliases`

API routes:

- `POST /api/journal/save`
- `GET /api/journal/today`
- `POST /api/chat`
- `GET /api/aliases`
- `POST /api/aliases`
- `PATCH /api/aliases/:id`
- `DELETE /api/aliases/:id`
- `POST /api/logout`

## Known MVP Constraints

- one entry per day, no version history yet
- owner-only access, not multi-user yet
- chat answers only from retrieved journal context and may say context is insufficient
- aliases are manual; they are not auto-created from guesses
- metadata quality still depends partly on LLM extraction quality

## Project Goal

The goal is to make it easy for anyone to run a private AI journal that grows into a personal second brain through normal daily writing, while keeping the architecture simple enough to evolve over time.
