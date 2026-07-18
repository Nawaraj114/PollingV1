# FriendCircle App — Phased Build Plan
Companion to `app-design-spec.md`. This breaks the build into small, shippable phases — each one is a complete Git branch/PR, each ends in something you can actually deploy and test with your friends before moving on.

---

## How to work through this (workflow, once, for every phase below)

- **Branching:** `main` = always deployable. Work happens in `feature/<phase-name>` branches, merged via PR into `main` once a phase's Definition of Done is met. Vercel auto-deploys a **preview URL** for every PR and auto-deploys `main` to production — so you can test each phase live before merging.
- **Commits:** small and scoped, e.g. `feat(billing): add auto-split calc`, `fix(polls): prevent duplicate vote`, `chore(db): add bill_status_history migration`.
- **Migrations:** every schema change is a new file in `/supabase/migrations`, applied with `supabase db push`. Never hand-edit the schema in the Supabase dashboard — always through a migration file, so Git is the single source of truth and you can rebuild the DB from scratch if needed.
- **Environments:** one Supabase project is enough at this scale (10–15 users). Use `.env.local` for local dev keys, and set the same keys in Vercel's Environment Variables panel for production. Don't commit `.env.local`.
- **Definition of Done (applies to every phase):** builds with no errors, deploys clean to a Vercel preview, the specific feature works end-to-end for at least 2 test accounts, and is merged to `main` before starting the next phase. Don't parallelize phases — billing especially should be solid before you add anything on top of it.

---

## Phase 0 — Project Foundation
**Goal:** empty but fully wired skeleton — nothing feature-related yet, just the plumbing.

- [x] Create GitHub repo, initialize Next.js (App Router) + TypeScript project
- [x] Create Supabase project, note the project URL + anon key
- [x] Connect repo to Vercel, confirm a blank deploy works
- [x] Add `/lib/supabase/client.ts` (browser) and `/lib/supabase/server.ts` (server, cookie-aware)
- [x] Set up `/supabase/migrations` folder + Supabase CLI locally (`supabase init`, `supabase link`)
- [x] Create the `profiles` table migration + a Postgres trigger that auto-inserts a `profiles` row when a new `auth.users` row is created
- [x] Basic layout shell: top nav with placeholders for Polls / Bills, sign-in/sign-out

**Definition of Done:** you and one friend can both sign up, land on an empty dashboard, and see your names pulled from `profiles`.

---

## Phase 1 — Auth & Access
**Goal:** everyone who should have access, has it — and only them.

- [x] Restrict sign-up: public signup is disabled and approved accounts are created through Supabase
- [x] Enable Row Level Security on **every** table from the start (default-deny), even before other phases add their tables — it's much easier to build with RLS on from day one than to retrofit it later
- [x] `profiles`: everyone can read all profiles (small trusted group), only update their own
- [x] Basic account page: name, avatar

**Definition of Done:** an outsider cannot self-register; logged-in users can see each other's names for tagging in polls/bills.

---

## Phase 2 — Billing Core (no locking yet)
**Goal:** the split-calculation logic works and is trustworthy, before you add any authentication layer on top.

- [x] Migrations: `bill_categories` (seed Food, Games, Beverages, Others), `bills`, `bill_participants`, `bill_line_items`
- [x] RLS: only the biller can insert/update a bill and its participants for now; participants can read bills they're part of
- [x] "Create Bill" screen: total amount, date, description, category picker (+ "add custom category"), participant multi-select
- [x] Per-participant input: optional exact amount, optional category breakdown (line items) — leave blank to auto-split
- [x] Server-side (not just client-side) calculation of the auto-split remainder, using a single shared function in `/lib/validations/billSplit.ts` so client preview and server truth never disagree
- [x] **Write unit tests for the split function first** — this is the single most important piece of logic in the app; test: all-blank (even split), mixed blank/explicit, single explicit rest to one blank person, rounding edge cases (e.g. ₹100 / 3 people)
- [x] "My Bills" list + bill detail page showing each participant's owed amount and category breakdown

**Definition of Done:** you can create a real bill with a friend, split it manually or automatically, and the numbers are provably correct (tests passing + manually double-checked).

---

## Phase 3 — Locking, Step-Up Auth, and Tamper Prevention
**Goal:** implement the trust boundary — this is the phase that actually satisfies "admin should not be able to tamper."

- [x] Add `auth_status`, `auth_method`, `authenticated_at` to `bill_participants`
- [x] DB trigger: reject any UPDATE to `owed_amount` / line items once `auth_status = 'authenticated'`, unless it's a system-controlled dispute reset
- [x] RLS rewrite per the policy table in the design spec: biller can edit only while `pending`; participant is the only one who can flip `pending → authenticated`
- [x] Step-up auth v1 (fast path): before allowing the "Authenticate & Accept" click to actually write to the DB, re-prompt for password and verify via `supabase.auth.signInWithPassword` (or a short-lived re-auth check) — store `auth_method = 'password'`
- [x] `bill_status_history` table + a trigger that logs every status transition automatically (don't rely on the app remembering to log it — do it at the DB level so it can never be skipped)
- [x] Add the **dispute** path: participant can reject with a note instead of authenticating → `auth_status = 'disputed'` → unlocks that row for the biller to correct → re-submits to `pending`
- [x] Creator-only bill deletion with password reconfirmation; retain the deleted bill and its history as an immutable audit record

**Definition of Done:** try, as the biller, to edit an amount after your test friend has authenticated it — it should fail. Confirm the failure happens at the database level (test by calling the API directly, not just clicking through the UI).

---

## Phase 4 — Payment & Confirmation Flow
**Goal:** the "Paid" / "Confirm receipt" loop, fully audited.

- [x] Add `payment_status`, `paid_at`, `confirmed_at` to `bill_participants`
- [x] "Mark as Paid" button, visible only once `auth_status = 'authenticated'`; sets `marked_paid` + timestamp
- [x] "Confirm Receipt" button on the biller's side, gated by the same step-up auth as Phase 3; sets `confirmed_paid` + timestamp
- [x] Auto-flip `bills.status` to `'settled'` once all participants reach `confirmed_paid` (DB trigger, not app logic)
- [x] Bill detail page shows a full timeline pulled from `bill_status_history`: created → amount set → authenticated → paid → confirmed, each with who and when

**Definition of Done:** a full bill lifecycle — create, split, authenticate, pay, confirm — is completable end-to-end by two real test accounts, and the timeline view matches reality.

---

## Phase 5 — Polling Module
**Goal:** now that billing (the hard part) is solid, polling is comparatively simple and self-contained.

- [x] Migrations: `polls`, `poll_options`, `poll_votes`
- [x] RLS: any authenticated user can create a poll and vote once
- [x] Create-poll screen: question, options, single/multiple choice toggle, optional expiry
- [x] Voting UI + live results using Supabase Realtime subscription on `poll_votes`
- [x] Auto-close on `expires_at` (simple client-side check is fine at this scale, no cron needed)

**Definition of Done:** a poll created by one user is votable by others in real time, and results update live without a page refresh.

---

## Phase 6 — Chat Module
**Goal:** basic group chat, plus optional contextual threads.

- [ ] Migrations: `chat_channels`, `chat_messages`; seed one `global` channel
- [ ] RLS: any authenticated user can read/write to channels they're part of (at this scale, everyone is part of everything)
- [ ] Chat UI with Realtime subscription for live message delivery
- [ ] Soft-delete + edit support (never hard-delete a message)
- [ ] Optional: auto-create a `bill`-type or `poll`-type channel when a bill/poll is created, and link a "discuss this" button from the bill/poll detail page into that thread

**Definition of Done:** messages appear live for all participants; editing/deleting a message doesn't remove its row from the database.

---

## Phase 7 — Upgrade Step-Up Auth to WebAuthn (Passkeys)
**Goal:** replace the password-re-entry fallback with real biometric/PIN device authentication, without touching any other part of the schema (this is exactly why `auth_method` was designed as a flexible field from Phase 3).

- [ ] Add `webauthn_credentials` table
- [ ] Client: register a passkey per device using `@simplewebauthn/browser`
- [ ] Server: an Edge Function using `@simplewebauthn/server` to issue challenges and verify signatures
- [ ] Swap the "Authenticate & Accept" and "Confirm Receipt" actions to request a WebAuthn signature instead of a password, falling back to password if no passkey is registered on that device
- [ ] Store `auth_method = 'webauthn'` on success

**Definition of Done:** on a phone, tapping "Authenticate & Accept" triggers the actual Face ID / fingerprint / device PIN prompt, and the DB write only happens after a valid signature.

---

## Phase 8 — Polish & Extras (pick based on what you actually miss using it)
- [ ] Net balance / debt-simplification view across all bills
- [ ] Receipt photo attachment via Supabase Storage
- [ ] Notifications (email via a free-tier provider, or in-app badges) for "a bill needs your response"
- [ ] CSV export of bill history
- [ ] PWA install support
- [ ] Dark mode

---

## Suggested Timeline Shape (not a deadline — a sanity check on scope)

| Phase | Focus | Relative effort |
|---|---|---|
| 0–1 | Foundation + Auth | Small |
| 2 | Billing core + split logic + tests | Large — take your time here |
| 3 | Locking + step-up auth v1 | Medium-Large |
| 4 | Paid/confirm flow | Medium |
| 5 | Polling | Small-Medium |
| 6 | Chat | Small-Medium |
| 7 | WebAuthn upgrade | Medium |
| 8 | Polish | Ongoing, as needed |

Phases 2–4 (all billing) are intentionally the bulk of the work, since you called it out as the most important and error-sensitive part. Everything after Phase 4 is lower stakes and can be reordered or deferred without risk to the core app.
