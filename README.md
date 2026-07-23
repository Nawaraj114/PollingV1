# FriendCircle

A private Next.js and Supabase application for a group of friends to split bills and run polls. Development follows the isolated phases in [`build-phases.md`](./build-phases.md). Chat is explicitly deferred to a future release and is outside the current delivery scope.

## Current phase

Phase 8 — Net Balances (preview branch; Phase 6 chat remains deferred)

- Circle-wide net balance and deterministic debt-simplification view
- Accepted and unpaid allocations only, calculated in exact integer paisa
- Payment-sent amounts excluded from suggestions while awaiting confirmation
- Read-only settlement suggestions with existing bill audit trails kept authoritative
- Realtime balance updates across signed-in browsers
- Passkey registration and removal from the account screen
- Face, fingerprint, or device-PIN approval for sensitive billing actions
- Single-page bill cards for accepting allocations, marking payments, and confirming receipts
- Expandable bill breakdowns and audit history without a separate detail screen
- Settled bills automatically leave the active Bills tab after every payment is confirmed
- Realtime bill creation and lifecycle updates across signed-in browsers without manual refresh
- Prefetched Bills and Polls routes with immediate loading feedback during navigation
- Single-round-trip billing feed reads and parallel poll-feed reads for lower server latency
- Batched avatar signing and database-authoritative creation validation to reduce form wait time
- One-time, five-minute WebAuthn challenges bound to the signed-in user, hostname, and billing action
- Verified passkey acceptance and receipt confirmation with immutable audit attribution
- Password re-authentication remains available as a fallback
- Database-enforced fresh-session check for acceptance
- Accepted amounts, category breakdowns, and bill headers locked by triggers
- Participant dispute notes and biller-only balanced resubmission
- Creator-only, password-confirmed soft deletion with retained audit history
- Authenticated participants can irreversibly mark their own payment as sent
- Password-confirmed receipt actions are restricted to the bill creator
- Database-triggered settlement after every participant payment is confirmed
- Append-only, trigger-generated allocation history
- Single- and multiple-choice circle polls with optional expiry
- Atomic, database-enforced one-time ballots
- Authenticated Realtime updates for votes and creator-closed polls
- Deterministic integer-paisa split calculator with 25 unit tests
- Phase 1 invite-only authentication and Phase 2 billing creation remain active
- GitHub Actions checks for linting, tests, types, and production builds

Passkey signatures are verified by a Supabase Edge Function before a service-role-only database function completes the bound billing action. Private passkey material never leaves the user's authenticator. Polling remains active, while chat remains deferred and is not part of this build.

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

Passkeys are scoped to the page hostname. A passkey registered on a Vercel preview hostname will not automatically be available on the production hostname, so register once on each deployment used for testing. The Edge Function accepts localhost, the stable production deployment, and this project's Vercel preview aliases.

Deploy the WebAuthn verifier after linking the Supabase project:

```bash
npx supabase functions deploy webauthn
```

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
