# FriendCircle

A private Next.js and Supabase application for a group of friends to split bills and run polls. Development follows the isolated phases in [`build-phases.md`](./build-phases.md). Chat is explicitly deferred to a future release and is outside the current delivery scope.

## Current phase

Phase 0 — Project Foundation

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- Cookie-based Supabase SSR authentication
- Migration-managed `profiles` table with RLS and an Auth trigger
- Responsive application shell with Bills and Polls placeholders
- GitHub Actions checks for linting, types, and production builds

Do not use the application for real financial records until the billing locking and audit phases are complete.

## Local setup

Requirements:

- Node.js 22–24 (`.nvmrc` selects Node.js 24)
- npm 11+
- Docker-compatible runtime if using the local Supabase stack

Install and configure:

```bash
npm install
cp .env.example .env.local
```

Set these browser-safe values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Never place `SUPABASE_SECRET_KEY`, a service-role key, database password, recovery codes, or other private credentials in a `NEXT_PUBLIC_` variable.

Start the app:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Apply the database migration

All database changes live in `supabase/migrations`; do not reproduce them manually in the Supabase dashboard.

For an existing hosted project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

For a fully local Supabase stack:

```bash
npm run supabase:start
npm run supabase:reset
```

`supabase status` prints the local URL and publishable/anon key to use in `.env.local`.

## Supabase Auth configuration

During Phase 0 testing, public email/password signup remains enabled so two test accounts can exercise the profile trigger. Phase 1 will replace this with private, invite-only access.

In Supabase Auth URL Configuration, set:

- Site URL to the production Vercel URL
- An allowed redirect URL for `http://localhost:3000/auth/callback`
- An allowed redirect URL for the Vercel preview deployment used for testing

If email confirmation is enabled, a new user follows the confirmation email before signing in. If it is disabled, signup creates a session immediately.

## Vercel configuration

The Vercel–Supabase integration normally synchronizes these variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Confirm that both exist in Preview and Production environments. Preview deployments should use throwaway test data until a separate staging project exists.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

Or run all three:

```bash
npm run check
```

## Git workflow

- `main` stays deployable.
- Each phase uses `feature/phase-<number>-<name>`.
- A phase is reviewed and tested through its Vercel preview before merge.
- Database changes are timestamped migrations committed with the feature.
- Secrets, `.env` files, Vercel state, Supabase local state, and recovery codes are ignored.
