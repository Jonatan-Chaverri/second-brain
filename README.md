# Second Brain

Second Brain is a private, self-hosted web app for building your own personal knowledge base. The idea is simple: write notes every day, keep them in one secure place, and gradually grow a searchable second brain around your own life, work, projects, and thoughts.

The long-term goal of this project is to let anyone run it for themselves and turn daily writing into a structured memory system.

## Purpose

This project is meant to help you:

- capture daily notes, reflections, ideas, and unfinished thoughts
- build a personal archive over time
- keep ownership of your own data
- create a foundation for AI-assisted recall and reflection
- develop a true second brain from ordinary writing habits

Instead of treating notes as isolated daily entries, the app is designed to make each one part of a growing personal knowledge system.

## Vision

Over time, the app is intended to support:

- private daily note-taking
- AI-generated summaries and structure from your entries
- semantic search across your notes
- chat grounded only in your own stored notes
- strong ownership and access controls for personal use

## Current Status

Phases 1, 2, 3, 4, and 6 are currently implemented:

- owner-only authentication with Supabase Auth
- protected app routes
- login flow with owner email enforcement
- notes page for writing and editing today's entry
- save and reload support for a single daily entry
- Prisma schema for users and note entries
- server-side API routes for loading and saving entries
- server-side OpenAI summarization and embedding generation on save
- pgvector-based retrieval and a server-side chat API over journal context
- normalized database schema verified against the live Supabase database
- Spanish-first metadata extraction with separated projects, people, topics, tools, events, media, and observations

Not implemented yet:
- no major planned phases remain in the current scope

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Prisma
- PostgreSQL

## Who This Is For

This project is for people who want to run their own private note system and slowly build a more useful memory layer for themselves by writing a little every day.

It can work well for:

- daily notes
- work logs
- idea capture
- personal reflection
- project notes
- habit tracking in freeform text

## Running Locally

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

3. Set up your PostgreSQL and Supabase project values.

4. Run Prisma generate and migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the app:

```bash
npm run dev
```

Optional one-time metadata migration to Spanish categories:

```bash
npm run migrate:metadata:es
```

## Environment Variables

See [.env.example](/Users/jonatan/Desktop/journal/.env.example) for the required values:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_SUMMARY_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OWNER_EMAIL`

## Notes

- All current note save/load behavior is server-side.
- The app is intended to remain private-first.
- AI processing runs on the server only and should continue to keep secret keys off the client.
