# Round 2 Reflection

A brief reflection on the architecture, technical decisions, and takeaways from building the pricing-change detection and live audit recomputation system.

## 1. What Went Well
* **Consolidated Email Architecture:** Grouping multiple affected audits per user before sending emails prevents spam and provides a unified, professional summary page.
* **Resilience to Database Migrations:** The code checks dynamically for the presence of the `is_stale` and `price_snapshot_id` columns, falling back gracefully to basic operations if migrations are pending.
* **Separation of Concerns:** By isolating the recomputation logic in a utility file (`lib/auditRecompute.ts`), it can be triggered easily by admin endpoints, cron jobs, or tests.

## 2. Technical Takeaways & Learning
* **Supabase Typed Queries Limit:** Discovered that TypeScript's PostgREST parser cannot handle dynamically interpolated template strings (e.g., `${auditSelect}`) inside `.select()`, causing a compile-time `ParserError`. Explicit casting is necessary for dynamic queries.
* **Local Engine Performance:** Running audits locally in JS takes less than 1ms per audit, making lookups across 100 audits extremely fast (no external API roundtrips needed until saving results).
* **Resend Free Tier Limitation:** Resend's free tier restricts outbound mail delivery strictly to the owner's verified domain/address. For production release, a custom sending domain must be verified to allow external recipients to receive alerts.

## 3. Potential Future Optimizations
* **Batch Inserts:** Currently, database writes (audit insertion, stale updates, lead insertions) are executed per changed audit. Batching operations using a single Supabase query would make the process even faster for larger lookback windows.
* **Queue System:** If processing more than 100 audits, executing recomputations inside a serverless queue or worker would prevent API timeout risks.
