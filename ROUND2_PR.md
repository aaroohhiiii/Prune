## What this PR does
This PR introduces live, continuous pricing optimization. Instead of static, one-off audits, the system now automatically tracks AI tool pricing changes. When a tool's price shifts, it recalculates past audits and proactively emails affected users with their new optimal stack recommendations.

## Why
AI tool pricing is volatile—what is an optimal stack today might be overpriced tomorrow. By automatically tracking these shifts, we transform the product from a manual audit tool into a proactive financial safeguard. The core assumption here is that users are busy and won't remember to re-check their stack manually; they want actionable savings pushed directly to them.

## How it works
1. **Pricing Updates**: An admin submits a market price change via the `/api/admin/pricing` endpoint.
2. **Detection & Recomputation**: This triggers `/api/admin/detect-changes`, which queries the Supabase `audits` table to find all users currently using the affected tool. It then runs the audit engine against their original inputs using the updated pricing data.
3. **Notification**: If the new math results in a different recommendation or a significant change in savings, we batch the results and send a single consolidated email via Resend (`lib/resend.ts`).
4. **Comparison View**: Users click the email link and land on `/audit/[id]/compare`, which uses `AuditDiffView.tsx` to render a side-by-side diff highlighting exactly what changed and how their savings shifted.
5. **Analytics Track**: Email opens and click-throughs are securely tracked via Resend webhooks and logged in the `email_events` table for admin metrics.

## What I cut
- **Granular User Email Thresholds**: Users cannot yet say "only email me if savings change by >$50." The value/effort ratio favored shipping the core re-audit logic and the visual diff view first.
- **Complex Historical Charts**: Cut the aesthetic UI for tracking historical pricing trends in favor of a simpler, highly functional admin metrics dashboard.
- **Automated Web Scraping for Prices**: Cut researching and building an automated web scraping pipeline (via Vercel Cron/Playwright) to fetch live prices from provider websites. Due to time constraints and the fragility of scraping, I settled for an admin-fed `/api/admin/pricing` endpoint instead.

## How to test it manually
1. Submit a fresh audit via `/audit/new` that includes **Cursor Pro** at $20/month.
2. Simulate a market price change by calling the admin endpoint:
   ```bash
   curl -X PATCH http://localhost:3000/api/admin/pricing \
     -H "Authorization: Bearer <your_password>" \
     -H "Content-Type: application/json" \
     -d '{"tool": "cursor", "plan": "Pro", "new_price": "30", "verified_date": "2026-05-20"}'
   ```
3. Check your inbox (or the local Resend logs) for the consolidated "Pricing Updated" email.
4. Click the "View Updated Audit" link in the email.
5. Verify the side-by-side diff view clearly highlights the Cursor pricing change as the reason for the new recommendation.

## What's tested
- **Pricing DB Updates (`pricingService.test.ts`)**: Verifies `updatePricing` correctly inserts new price rows and invalidates the cache, and `getPricingData` falls back to hardcoded data on DB failure.
- **Email Resiliency (`emailService.test.ts`)**: Ensures `sendAuditResultEmail` securely creates `email_events` rows on send and handles Resend API failures gracefully without crashing the app.
- **Diff Calculation Logic (`auditDiff.test.ts`)**: Verifies `calculateAuditDelta` accurately detects removed tools, plan downgrades, and properly calculates negative/positive savings deltas.
- **Recomputation Limits (`auditRecompute.test.ts`)**: Ensures `recomputeAuditsForPricingChange` automatically re-runs old audits against new pricing while strictly enforcing the 30-day window and max 100 audits limit.
- **Webhook Event Tracking (`emailTracking.test.ts`)**: Ensures email opens update the `opened_at` timestamp securely and email click tracking captures `clicked_at` and click URLs idempotently.

## Open questions / risks
- **Serverless Timeouts on Scale**: Running the audit engine for hundreds of users linearly inside a single Vercel serverless function (`/api/admin/detect-changes`) will eventually time out as the platform grows. We need to move this to a background queue like Inngest.
- **Pricing Input Integrity**: We currently trust the manual JSON inputs. A typo (e.g., $400 instead of $40) will instantly trigger false-positive emails to the entire user base. We need a staging/approval step for all price changes.
