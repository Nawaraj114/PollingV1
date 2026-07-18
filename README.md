# FriendCircle

A private Next.js and Supabase application for a group of friends to split bills and run polls. Development follows the isolated phases in [`build-phases.md`](./build-phases.md). Chat is explicitly deferred to a future release and is outside the current delivery scope.

## Current phase

Phase 4 — Payment & Confirmation Flow (preview branch)

- Password re-authentication before a participant can accept an allocation
- Database-enforced fresh-session check for acceptance
- Accepted amounts, category breakdowns, and bill headers locked by triggers
- Participant dispute notes and biller-only balanced resubmission
- Creator-only, password-confirmed soft deletion with retained audit history
- Authenticated participants can irreversibly mark their own payment as sent
- Password-confirmed receipt actions are restricted to the bill creator
- Database-triggered settlement after every participant payment is confirmed
- Append-only, trigger-generated allocation history
- Deterministic integer-paisa split calculator with 25 unit tests
- Phase 1 invite-only authentication and Phase 2 billing creation remain active
- GitHub Actions checks for linting, tests, types, and production builds

Payment transitions are enforced by database triggers as well as server actions. A bill cannot settle early, and neither a participant nor the biller can silently skip or reverse a payment state.

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

Public signup is disabled in Phase 1. Add the small set of approved members from Supabase Dashboard → Authentication → Users. Creating an account there still runs the database trigger that creates its `profiles` row. Existing users can sign in normally; outsiders receive `signup_disabled` even if they call the Auth API directly.

Hosted Auth URL settings are tracked in `supabase/config.toml`, including local development, the stable Phase 0 preview alias, and the production callback. After linking the intended project, deploy config changes with:

```bash
npx supabase config push
```

Review the displayed diff before confirming because this command can also update Auth and Storage settings.

The hosted default email sender is suitable only for limited testing. Until custom SMTP is configured, administrator-created and auto-confirmed test users are the reliable way to exercise private access.

Avatar images are stored in a private bucket. The application generates one-hour signed URLs for authenticated members and never stores those temporary URLs in `profiles`.

## Vercel configuration

The Vercel–Supabase integration normally synchronizes these variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Confirm that both exist in Preview and Production environments. Preview deployments should use throwaway test data until a separate staging project exists.

## Quality checks

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Or run all four:

```bash
npm run check
```

## Git workflow

- `main` stays deployable.
- Each phase uses `feature/phase-<number>-<name>`.
- A phase is reviewed and tested through its Vercel preview before merge.
- Database changes are timestamped migrations committed with the feature.
- Secrets, `.env` files, Vercel state, Supabase local state, and recovery codes are ignored.
