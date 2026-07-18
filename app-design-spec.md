# FriendCircle App — Design & Flow Specification
**Polling · Billing · Chat — built for a private group of 10–15 friends**
Stack: Next.js (Vercel) · Supabase (Postgres + Auth + Realtime + Storage) · Git

---

## 1. Design Principles (so future features slot in cleanly)

1. **Feature isolation** — Polling, Billing, and Chat are independent modules (own tables, own routes, own components). None depends on another's internals. A future "Events" or "Photo Album" module can be added the same way.
2. **One `profiles` table is the hub** — every feature just references `profiles.id`. Never duplicate user info per feature.
3. **Every money-affecting action is logged, never overwritten** — updates create new history rows; we don't silently mutate financial rows. This is what makes "cross-verification" possible later.
4. **RLS (Row Level Security) is the real enforcement layer**, not the UI. The UI hiding a button is a convenience; the database rule is what actually stops an admin from editing a locked bill. This matters a lot for your "admin should not be able to tamper with billing" requirement — a determined admin could otherwise call the API directly and bypass a UI restriction.
5. **Status fields are enums with a strict state machine** (below), so nothing can jump from "unpaid" to "confirmed" without passing through the required steps.
6. **Free-tier aware**: Supabase free tier gives 500MB DB, 5GB bandwidth, 50k monthly active users, and Realtime included — all wildly sufficient for 10–15 users. Design avoids anything that needs a paid add-on (no large file storage, no heavy cron jobs, no email-sending beyond a few a day which fits free-tier limits on something like Resend).

---

## 2. Tech Architecture

```
Next.js 14+ (App Router) — deployed on Vercel
 ├─ /app
 │   ├─ (auth)/            → login, signup, PIN/passkey setup
 │   ├─ polls/              → poll list, poll detail, create poll
 │   ├─ bills/              → bill list, bill detail, create bill, my-balance
 │   ├─ chat/               → group chat, per-bill/per-poll comment threads
 │   └─ api/                → thin server routes only where Supabase can't do it directly
 ├─ /lib
 │   ├─ supabase/           → browser client, server client (RLS-aware, uses user JWT)
 │   ├─ validations/        → Zod schemas shared by client & server (single source of truth for split-math)
 │   └─ auth/                → step-up (re-auth) helper for the billing "authenticate" action
 ├─ /components
 ├─ /types                  → generated from `supabase gen types typescript`
 └─ /supabase
     ├─ migrations/          → SQL migration files (checked into Git)
     └─ functions/           → Edge Functions (webauthn-verify, notify-on-bill, etc.)
```

**Why this shape:** Supabase client libraries + RLS mean most CRUD never needs a custom backend route — the browser talks to Postgres directly under the user's own JWT, and Postgres enforces who can do what. Custom Edge Functions are used only for the handful of things that need elevated logic (e.g., verifying a WebAuthn signature). This keeps the whole app "serverless" and fits comfortably in Vercel + Supabase free tiers.

---

## 3. Authentication & the "who can confirm what" model

- Base login: Supabase Auth (email/password or magic link) — this logs you *into the app*.
- **Step-up authentication** (a second, separate check) is required specifically for the two sensitive billing actions: *(a)* a participant agreeing to an owed amount, and *(b)* the biller confirming they received payment.
- **Recommended approach: WebAuthn (Passkeys).** Instead of building separate fingerprint / face / PIN systems, WebAuthn is one standard that lets the device's own authenticator (Face ID, Touch ID, Windows Hello, Android fingerprint, or a fallback PIN) sign a challenge. One integration gives you literally everything you listed (fingerprint, face, PIN) for free, because the OS handles it — you just ask the browser "please verify this user" and it shows whatever biometric/PIN prompt that device supports.
  - Each user registers a passkey once (per device) → stored as a public key in `webauthn_credentials`.
  - Verifying an action = browser asks device to sign a challenge → an Edge Function verifies the signature server-side → only then does the DB update go through.
  - **Simple fallback for MVP** (if you want to ship faster): re-entering your account password before confirming. You can add WebAuthn as a v2 upgrade without changing any other part of the schema — the `auth_method` field already supports it.

---

## 4. Database Schema (Supabase / Postgres)

### 4.1 Shared

```sql
profiles (
  id            uuid primary key references auth.users(id),
  full_name     text not null,
  avatar_url    text,
  is_admin      bool default false,   -- reserved for future permission tiers
  pin_hash      text,                 -- optional fallback step-up method
  created_at    timestamptz default now()
)

webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id),
  public_key    text not null,
  device_label  text,                 -- "Rohan's iPhone"
  created_at    timestamptz default now()
)
```

### 4.2 Polling

```sql
polls (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references profiles(id),
  title         text not null,
  description   text,
  poll_type     text check (poll_type in ('single','multiple')) default 'single',
  status        text check (status in ('active','closed')) default 'active',
  expires_at    timestamptz,
  created_at    timestamptz default now()
)

poll_options (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid references polls(id) on delete cascade,
  option_text   text not null,
  order_index   int default 0
)

poll_votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid references polls(id) on delete cascade,
  option_id     uuid references poll_options(id) on delete cascade,
  user_id       uuid references profiles(id),
  created_at    timestamptz default now(),
  unique (poll_id, user_id, option_id)
)
```
*(For `single` type, app/trigger enforces one vote per user per poll; `multiple` allows several.)*

### 4.3 Billing — the core module

```sql
bill_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,        -- Food, Games, Beverages, Others, or custom
  is_default    bool default false,
  created_by    uuid references profiles(id),   -- null for the seeded defaults
  created_at    timestamptz default now()
)

bills (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references profiles(id),   -- the biller
  title         text,
  total_amount  numeric(10,2) not null,
  bill_date     date not null default current_date,
  status        text check (status in ('draft','active','settled')) default 'active',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
)

bill_participants (
  id                uuid primary key default gen_random_uuid(),
  bill_id           uuid references bills(id) on delete cascade,
  user_id           uuid references profiles(id),
  owed_amount       numeric(10,2),               -- null until computed/entered
  split_type        text check (split_type in ('manual','auto_equal')) default 'manual',
  auth_status       text check (auth_status in ('pending','authenticated','disputed')) default 'pending',
  auth_method       text,                          -- 'password' | 'pin' | 'webauthn'
  authenticated_at  timestamptz,
  payment_status    text check (payment_status in ('unpaid','marked_paid','confirmed_paid')) default 'unpaid',
  paid_at           timestamptz,
  confirmed_at      timestamptz,
  created_at        timestamptz default now(),
  unique (bill_id, user_id)
)

bill_line_items (
  id                    uuid primary key default gen_random_uuid(),
  bill_participant_id   uuid references bill_participants(id) on delete cascade,
  category_id           uuid references bill_categories(id),
  amount                numeric(10,2) not null,
  note                  text,
  created_at            timestamptz default now()
)

bill_status_history (      -- the audit trail, append-only, never edited
  id                    uuid primary key default gen_random_uuid(),
  bill_participant_id   uuid references bill_participants(id),
  event_type            text not null,   -- created / amount_set / authenticated / disputed / marked_paid / confirmed_paid
  event_data            jsonb,
  actor_id              uuid references profiles(id),
  created_at            timestamptz default now()
)
```

### 4.4 Chat

```sql
chat_channels (
  id            uuid primary key default gen_random_uuid(),
  type          text check (type in ('global','poll','bill')) default 'global',
  reference_id  uuid,        -- poll_id or bill_id if type isn't 'global'
  name          text,
  created_at    timestamptz default now()
)

chat_messages (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid references chat_channels(id) on delete cascade,
  sender_id     uuid references profiles(id),
  content       text not null,
  created_at    timestamptz default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
)
```
Realtime subscriptions on `chat_messages` give you live chat with zero extra infrastructure.

---

## 5. Billing Logic — exactly how the split works

This is the part you called "most important," so here's the precise rule the app follows:

1. Biller creates a bill: total amount (e.g., ₹1000), date, description, and picks which friends are part of it.
2. For **each selected participant**, the biller can either:
   - **Type an exact amount** that person owes, optionally broken into category line items (e.g., ₹200 Games + ₹100 Food + ₹700 Others = ₹1000 for that one person), **or**
   - **Leave it blank.**
3. On save, the app computes:
   ```
   remaining = total_amount − sum(explicitly entered amounts)
   auto_share = remaining / (number of participants left blank)
   ```
   Each blank participant gets `owed_amount = auto_share`, `split_type = 'auto_equal'`.
4. Every `bill_participants` row starts at `auth_status = 'pending'`.
5. **The participant must step-up-authenticate to accept the amount.** Only after that does `auth_status` become `'authenticated'` and the amount **locks** — a DB trigger blocks any further UPDATE to `owed_amount` or its line items from anyone but re-opening the flow (see §5.1 for disputes). This is what physically prevents the biller from tampering with it afterward.
6. Once authenticated, the participant sees a **"Mark as Paid"** button. Clicking it sets `payment_status = 'marked_paid'`, `paid_at = now()`.
7. The **biller** then sees "Confirm receipt" on their side. Only when they step-up-authenticate that click does `payment_status` become `'confirmed_paid'`, `confirmed_at = now()`. Until then it's visibly "payment pending confirmation" to both sides.
8. Every one of these events (created, amount set, authenticated, marked paid, confirmed) writes a row to `bill_status_history` — nothing is ever silently overwritten, so you always have a full timeline to cross-check later.

### 5.1 Suggested addition: Disputes
Instead of forcing a participant to either blindly authenticate or do nothing, let them **dispute** an amount with a short note ("this should be 250, not 300"). That sets `auth_status = 'disputed'`, notifies the biller, unlocks just that row for editing, and logs the dispute + resolution in `bill_status_history`. Without this, a genuine mistake has no clean fix path once you lock things down.

### 5.2 RLS policy summary (the actual enforcement)

| Action | Who can do it | Condition |
|---|---|---|
| Insert a bill | Any authenticated user | — |
| Edit `owed_amount` / line items | The biller only | `auth_status = 'pending'` |
| Set `auth_status = 'authenticated'` | The participant only (`auth.uid() = user_id`) | must include valid step-up token |
| Set `payment_status = 'marked_paid'` | The participant only | `auth_status = 'authenticated'` |
| Set `payment_status = 'confirmed_paid'` | The biller only (`auth.uid() = bills.created_by`) | must include valid step-up token, `payment_status = 'marked_paid'` |
| Read a bill | Biller or any listed participant | — |
| Insert to `bill_status_history` | System trigger only, never direct client writes | — |

---

## 6. Bill Lifecycle (state machine)

```
 [pending] --(participant authenticates)--> [authenticated] --(participant disputes)--> [disputed] --(biller edits, resets)--> [pending]
                                                    │
                                                    ▼
                                              payment_status:
                                     [unpaid] --(participant taps "Paid")--> [marked_paid]
                                                    │
                                          (biller step-up confirms)
                                                    ▼
                                            [confirmed_paid]  ✅ settled
```

A bill itself moves to `status = 'settled'` once all its participants reach `confirmed_paid`.

---

## 7. Polling & Chat — brief flow

**Polling**
1. Creator makes a poll: question, options, single/multiple choice, optional expiry.
2. Friends vote (one row per vote in `poll_votes`); results update live via Realtime.
3. Poll auto-closes at `expires_at` or can be closed manually by its creator.

**Chat**
1. One default `global` channel everyone lands in.
2. Optional contextual threads: a `bill`-type or `poll`-type channel tied to a specific item, so a discussion about "who actually ordered the extra fries" stays attached to that bill instead of cluttering the main chat.
3. Realtime message delivery, edit/soft-delete supported from day one (so message history stays intact for the same "cross-verification" reason as billing).

---

## 8. Suggested Improvements (beyond what you asked for)

- **Net balance view** — a "who owes whom, net" screen (classic Splitwise-style debt simplification) so with 10–15 people you're not tracking 15 separate small transactions when a handful of net transfers would settle everything.
- **Receipt photo attachment** — let the biller attach a photo of the actual receipt to a bill using Supabase Storage (free tier includes 1GB). Strengthens the "cross-verification" goal you mentioned.
- **Notifications** — a lightweight email (via a free-tier provider like Resend) or in-app badge when: a bill is assigned to you, someone disputes, or a payment needs your confirmation. With only 10–15 users this stays well within any free tier.
- **Immutable audit export** — a simple "export my bill history as CSV" button, useful exactly for the cross-verification use case you described.
- **PWA install** — make it installable on phones (manifest + service worker) so it feels like a native app for step-up biometric prompts, which behave better in an installed PWA than a browser tab.
- **Unit tests around the split-math** — since you emphasized "error-free," the auto-split/remainder calculation is the one piece of logic most worth covering with tests before you trust it with real money.
- **Soft-delete everywhere**, not hard delete — for the same audit reason as the history table.

---

## 9. Suggested Build Order (MVP → later)

1. Auth + profiles + basic layout, deploy skeleton to Vercel, confirm Supabase connection.
2. Billing core (bills, participants, categories, line items, manual/auto split) — no step-up auth yet, just basic RLS (biller vs participant read/write).
3. Add step-up authentication (start with password re-entry fallback) and lock the amount-editing rules.
4. Add Paid → Confirm flow + `bill_status_history` logging.
5. Polling module.
6. Chat module (global first, then contextual threads).
7. Upgrade step-up auth to WebAuthn passkeys.
8. Nice-to-haves from §8 (net balance, receipts, notifications, exports, PWA).

This order gets your highest-priority feature (billing) fully correct and tested before the lower-stakes modules are layered on, and each step is a self-contained Git commit/PR.
