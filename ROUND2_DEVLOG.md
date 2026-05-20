# Round 2 Development Log

A real-time log of what we built, the problems we hit, and how we sorted them out during Round 2 development.

## 2026-05-20 11:00 — Getting Started & Planning
Read through the brief and sketched out what we'd need: database changes, email notifications, a side-by-side comparison UI, and an engine to detect when prices change. Mapped out the order we'd tackle things: database first, then the comparison interface, then email notifications, and finally the recomputation logic.

## 2026-05-20 11:15 — Database Changes
Added two new columns to the audits table in the database: one to mark audits as outdated (`is_stale`) and another to link to the updated pricing snapshot (`price_snapshot_id`). Also added performance indexes so queries stay fast. Nothing controversial here.

## 2026-05-20 11:35 — Building the Comparison UI
Started building `AuditDiffView.tsx` so users can see their original recommendations next to the new ones side-by-side. Used proper design patterns with dark borders and muted styling to keep it looking premium and consistent with Vantage's aesthetic.



## 2026-05-20 12:30 — Afternoon Break
Paused to recharge.

## 2026-05-20 17:00 — Email Templates & Logos
Got back to it. Built out proper HTML email templates in `lib/emailTemplates.ts`. Made the email cards format work so we can list all the audit changes in one message.

## 2026-05-20 17:20 — Email Notification Dispatcher
**Problem 2: Too Many Emails**
Built the email sending logic in `lib/emailNotifications.ts` using Resend. The trick here: if multiple audits get updated for the same person, we bundle them all into *one* email instead of spamming them with five separate ones. Smart consolidation logic.

*Note: Resend's free tier has a limitation — it only lets us send to the account owner's verified address. If we want to email actual users, we'd need to verify the domain first.*

## 2026-05-20 17:40 — Recomputation Engine
Built the core logic in `lib/auditRecompute.ts`. When prices change, this engine:
- Finds all leads from the last 30 days
- Runs them through the recommendation engine again using *live* prices
- Compares old recommendations against new ones
- Saves the new audit and marks the old one as stale

This is the engine that powers the whole "detect when pricing changes and re-audit" feature.

## 2026-05-20 18:00 — Wiring Up the Triggers
**Problem 3: Making the System Actually Fire**
Updated the admin pricing endpoint to kick off recomputation in the background whenever someone changes a price. Also created a manual endpoint (`POST /api/recompute-audits`) so cron jobs (or testing) can trigger re-audits on demand.

## 2026-05-20 18:15 — **Problem 4: TypeScript Type Hell**
**The Issue:** Supabase's type system choked when we tried to use dynamic template strings in the query builder. Threw a `ParserError` that wouldn't compile.

**The Fix:** Cast the query builder to a custom interface and move on. Also cleaned up ESLint warnings (`no-explicit-any` flags and unused variables) in the affected files. Classic.



## 2026-05-20 21:30 — Email Preferences Database
Built out the `email_preferences` table so we can track whether users want to receive:
- Re-audit notifications
- Audit results
- Marketing emails

People should be able to control what lands in their inbox.

## 2026-05-20 21:40 — Unsubscribe Tokens
**Problem 5: Unsubscribe Links Need Security**
Created proper unsubscribe tokens in `lib/emailTokens.ts` using HMAC-SHA256 signatures. These tokens:
- Are tamper-proof (can't be faked)
- Expire after 24 hours
- Generate URL-safe strings
- Store user preferences in the database



## 2026-05-20 21:50 — Email Footers & Filtering
Added "Manage email preferences" links to all outgoing emails. Updated the notification and Resend logic to check the preferences table before sending — if someone's unsubscribed, they don't get the email. Simple as that.

## 2026-05-21 01:20 — **Problem 6: The Recomputation Engine Was Using Wrong Prices**
**The Issue:** When re-auditing leads, the engine was still using the old pricing (e.g., $20/month) instead of the new official price (e.g., $100/month). This meant savings calculations were completely wrong.

**The Fix:** Deep cloned the original audit input, overwrote the tool prices with the actual current prices, *then* ran it through the engine. Sorted.

## 2026-05-21 01:30 — **Problem 7: Unsubscribe UX Was Buried**
**The Issue:** The "manage preferences" link was shoved in a tiny footer nobody reads.

**The Fix:** Moved it up to a prominent button right under the main call-to-action. Much harder to miss now. Also added plain-text fallback URLs for email clients that don't render HTML, so we stay compliant with CAN-SPAM regulations.

## 2026-05-21 01:40 — Polish & Edge Cases
Extracted the unsubscribe form into its own Client Component (`SubmitButton.tsx`) so we can show a "Saving..." state whilst the preference updates. Prevents accidental double-clicks.

Also updated the lead capture endpoint so if someone previously unsubscribed but then requests a brand new audit from the homepage, they automatically get re-subscribed to audit results and re-audit notifications. Makes sense — they're actively asking for it.

---

