# Friend Group App — Design & Flow Specification
**Modules:** Polling · Billing (Splitwise-style, auth-gated) · Chat
**Stack:** Next.js (Vercel, free tier) · Supabase (Postgres + Auth + Realtime + Storage, free tier) · Git

---

## 1. Design Principles (apply to every module)

1. **Modular by domain, not by page.** Each feature (`polls`, `billing`, `chat`) is its own folder with its own DB tables, API routes, and components. This is what makes it easy to bolt on features later without touching unrelated code.
2. **Small trusted user base (10–15 people).** No public signup. Admin (you) invites people; auth is just enough to know *who* is acting, not to gatekeep access.
3. **Postgres is the source of truth, not the UI.** Every state transition (a vote, a bill confirmation, a payment) is a row in an append-only log, not just a field update. This gives you the "cross-verification later" ability you asked for, and is what makes billing tamper-resistant.
4. **RLS (Row Level Security) does the enforcement, not the frontend.** "Admin can't tamper with billing" is a promise you can only actually keep if Postgres itself refuses the write — not just because your UI hides the button. All rules below are written assuming Supabase RLS policies back them up.
5. **Realtime over notifications for now.** Free tier + 15 users means Supabase Realtime (Postgres changes pushed over websockets) is enough to make chat and bill-status updates feel live. Push/email notifications can be a later upgrade via Supabase Edge Functions + a cron.

---

## 2. Core Users & Auth

- `profiles` table (extends Supabase Auth's built-in `auth.users`):
  - `id` (uuid, FK to auth.users), `display_name`, `avatar_url`, `role` (`admin` | `member`), `created_at`
- Auth methods:
  - **Password** — Supabase Auth default.
  - **PIN** — a 4–6 digit PIN, stored as a salted hash in a `pin_credentials` table, verified via a Supabase Edge Function (never compare PINs client-side).
  - **Fingerprint / Face** — implemented via **WebAuthn (passkeys)**. This is the correct web-native way to use a phone/laptop's actual fingerprint or face sensor — the browser talks to the device's secure hardware, and Supabase (or a library like `simplewebauthn`) just stores a public key credential. There's no real native SDK route on a Vercel/Supabase free-tier web app, so WebAuthn *is* your biometric auth, not a workaround.
  - All three are "step-up auth" methods used to **confirm a specific action** (agreeing to a bill split, marking something paid) — separate from normal login.

---

## 3. Module I — Polling

### Tables
```
polls
  id, creator_id, title, description, poll_type ('single_choice' | 'multi_choice'),
  status ('open' | 'closed'), closes_at, created_at

poll_options
  id, poll_id, label, created_at

poll_votes
  id, poll_id, option_id, voter_id, created_at
  UNIQUE(poll_id, option_id, voter_id) -- prevents duplicate votes on same option
```

### Flow
1. Admin creates poll → title + options + optional close time + single/multi choice.
2. Members vote (Realtime updates live tally for everyone watching).
3. Poll auto-closes at `closes_at`, or admin closes manually.
4. Results view: counts + who voted for what (small trusted group, so no need for anonymous voting — but keep a `is_anonymous` boolean on the table now so you can add that flag later without a schema change).

This module is simple by design since it's not your priority — but structuring options/votes as separate normalized tables (rather than JSON blobs) is what keeps it flexible for later (e.g., ranked-choice, anonymous polls, scheduled recurring polls).

---

## 4. Module II — Billing (the important one)

This is designed as a **state machine per bill-split**, not a single "paid: true/false" flag, because you need: (a) mutual authentication before a debt is "real," (b) mutual confirmation before it's "settled," and (c) a permanent record for later cross-checking.

### 4.1 Tables

```
bill_categories
  id, name, created_by (nullable = system default), is_custom (bool)
  -- seed with: Food, Games, Beverages, Others

bills
  id, biller_id, title, total_amount, default_category_id,
  created_at, updated_at

bill_splits                         -- one row per (bill, participant)
  id, bill_id, payer_id,            -- payer_id = the friend who owes money
  amount,                           -- final amount this person owes
  status,                           -- see state machine below
  authenticated_at,                 -- when payer confirmed the amount
  paid_marked_at,                   -- when payer hit "Paid"
  completed_at,                     -- when biller confirmed receipt
  created_at

bill_split_items                    -- category breakdown WITHIN one split
  id, bill_split_id, category_id, amount
  -- e.g., for one split: {games: 200, food: 100, others: 700} → must sum to bill_splits.amount

bill_audit_log                      -- append-only, never updated or deleted
  id, bill_id, bill_split_id, actor_id, action, old_value, new_value, created_at
```

**Why `bill_split_items` is separate from `bills`:** your example (₹200 games, ₹100 food, ₹700 others *for one specific person*) shows the category breakdown is per-split, not per-bill — because different people in the same bill might have spent differently. This structure supports that directly.

**Why `bill_audit_log` exists:** every meaningful action (amount set, authenticated, disputed, paid, completed) writes a row here in addition to updating `bill_splits`. This is your "cross-verify in future" table — nobody can quietly edit history, and you can later build a full activity/audit view from it for free.

### 4.2 Split Amount Logic (the part you specifically asked about)

When the biller creates a bill and selects participants:
- For each participant, biller may enter a specific amount owed, or leave it blank.
- **Recommended rule (please confirm this matches your intent):**
  `remaining = total_amount − sum(all manually entered amounts)`
  `remaining ÷ (number of participants left blank)` = each blank participant's share.
  - Example: Total ₹1000, 3 participants. You enter ₹300 for Friend A, leave Friend B and Friend C blank → remaining ₹700 ÷ 2 = ₹350 each.
  - If **all** are left blank → simple equal split of the full total (your original "divide by number of people" case).
- Edge case to decide: what if manually entered amounts **exceed** the total? The system should block bill creation and show an error rather than silently allowing it — I've included this as a validation rule below.

### 4.3 Bill Split State Machine

```
pending_auth       → split created by biller, waiting for payer to confirm the amount
     ↓ (payer authenticates via PIN/passkey/password)
authenticated      → payer has agreed this is what they owe; amount now LOCKED (biller cannot edit)
     ↓ (payer clicks "Paid")
pending_confirmation → payer says they've paid; waiting for biller to confirm receipt
     ↓ (biller authenticates via PIN/passkey/password to confirm)
completed          → both sides confirmed; done

-- side branch:
disputed           → payer disagrees with the amount at pending_auth stage
                      (opens a comment/negotiation thread on that split; biller can propose
                      a revised amount, which resets it to pending_auth for re-confirmation)
```

Key rule enforced by RLS, not just UI: **once a split leaves `pending_auth`, the `amount` and `bill_split_items` rows become immutable.** Any Postgres `UPDATE` attempt on `amount` after that point is rejected by policy — this is what actually makes "admin can't tamper" true, rather than just a UI restriction.

Similarly: `paid_marked_at` can only be set by `payer_id`, and `completed_at` can only be set by `biller_id` — enforced by RLS `USING`/`WITH CHECK` clauses tied to `auth.uid()`.

### 4.4 Screens / Flow

1. **Create Bill** (biller): title → total amount → category → select participants → enter per-person amounts (or leave blank) → live-updating "remaining to be split" indicator → submit. Validation blocks over-allocation.
2. **My Splits (as payer)**: list of bills where you owe money, grouped by status. Tapping a `pending_auth` split shows the amount + category breakdown → "Confirm this is correct" (triggers PIN/passkey/password step-up) or "Dispute."
3. **My Splits (as biller)**: see the live status of every split you created — who's confirmed, who's disputed, who's marked paid — waiting on your confirmation for `pending_confirmation` items.
4. **Detail view per split**: full timeline — created at, authenticated at, paid-marked at, completed at — pulled straight from `bill_audit_log`, giving both people (and future-you) a clean paper trail.

### 4.5 Suggested Improvements (optional, but worth considering)

- **Partial payments** — right now it's binary paid/not paid. If someone pays half now and half later, you'd want a `bill_payments` child table instead of a single `paid_marked_at` timestamp. Flag this now even if you build it later, since it changes the schema shape.
- **Net settlement view** — since friends will owe each other across many bills, a "who owes whom, netted out" dashboard (like Splitwise's balance summary) saves everyone from settling bill-by-bill. This can be a read-only SQL view over `bill_splits`, cheap to add later.
- **Soft reminders** — a "nudge" button on unconfirmed/unpaid splits (just writes a notification row + realtime toast), useful for a friend group where people forget.
- **Dispute resolution history** — since disputes reset to `pending_auth`, keep every previous proposed amount in the audit log so nothing gets lost in back-and-forth.

---

## 5. Module III — Chat

### Tables
```
chat_rooms
  id, name, type ('group' | 'dm'), created_at

chat_room_members
  room_id, user_id, joined_at

chat_messages
  id, room_id, sender_id, content, created_at
```

### Flow
- One default group room auto-created for all members; DMs created on demand.
- Supabase Realtime subscription on `chat_messages` for live updates — no polling needed.
- Keep it deliberately simple now (text only); attachments/reactions can be added later since the schema already isolates chat from billing/polls.

---

## 6. Cross-Cutting: Why This Stays Flexible for Future Upgrades

- **New feature = new folder + new tables**, not edits to existing modules — polls, billing, and chat don't reference each other's internals.
- **`bill_audit_log` and `bill_split_items`** are designed so you can add new report types (spending-by-category charts, monthly summaries, export-to-CSV) purely as read queries, no schema migration needed.
- **RLS policies are centralized per table**, so adding a new role later (e.g., "moderator") is a policy change, not a rewrite.
- **WebAuthn/PIN as a shared "step-up auth" utility** — reusable anywhere you later need "prove it's really you" (e.g., leaving a group, deleting a bill), not billing-specific code.

---

## 7. Suggested Build Order

1. Auth + profiles + invite flow
2. Billing (core value) — bills → splits → items → state machine → audit log
3. Step-up auth (PIN first, WebAuthn passkey second — PIN is much faster to ship)
4. Polling
5. Chat
6. Net-settlement dashboard / nudges / reports (v2)

---

*Open questions for you to confirm before implementation:*
1. Does the "remaining amount split among blanks" logic in §4.2 match what you meant, or did you want blanks to always split the full total?
2. Should a payer be able to dispute *after* authenticating (e.g., they agreed, then changed their mind), or is the amount fully final once authenticated?
3. For WebAuthn/passkeys — are your 10–15 friends all on devices with fingerprint/face hardware (most modern phones/laptops), or should PIN be the primary method with biometric as a bonus?
