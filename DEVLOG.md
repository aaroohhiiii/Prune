# DEVLOG
# Vantage Dev Log

## Day 1 — 07-05-2026
**Hours worked:** 4
**What I did:**
- Created Next.js project and installed all dependencies (Supabase, Resend, grok, Upstash)
- Defined TypeScript types (`AuditResult`, `AuditTool`, `ToolSpend`) in `/lib/types.ts`
- Created `/lib/pricing-data.ts` with official AI tool pricing (Claude, GPT-4, Gemini) + source URLs
- Set up Supabase project, created `audits` and `leads` tables with full schema
- Created skeleton markdown docs: `AGENTS.md`, `PRICING.md`, `ARCHITECTURE.md`

**What I learned:**
- Supabase RLS policies need service role key for writes from API routes
- Environment variable naming (NEXT_PUBLIC_* vs private) matters for security
- Next.js 15 uses App Router; file structure changed from training data

**Blockers / what I'm stuck on:**
- npm ci is extremely strict and crashes if the Linux-specific optional binaries aren't perfectly mapped out in a Mac-generated lockfile.

**Plan for tomorrow:**
- Build the audit engine (core calculation logic)
- Write 8 unit tests for audit engine

---

## Day 2 — 08-05-2026
**Hours worked:** 7
**What I did:**
- Configured `.env.local` with all secrets (Supabase, Anthropic, Resend, Upstash)
- Built landing page shell at `/app/page.tsx` with hero section and CTA
- Built audit engine at `/lib/audit-engine.ts` — calculates monthly/annual savings for each tool
- Wrote 8 Jest tests at `/lib/__tests__/audit-engine.test.ts` — all passing
- Created 3-step form component at `/app/components/AuditForm.tsx`
- Built API route `/app/api/audit/route.ts` — receives form data, runs audit engine, saves to DB

**What I learned:**
- Audit engine must handle missing spend data gracefully (assume $0)
- Discriminated unions help model multi-step forms cleanly

**Plan for tomorrow:**
- Add AI summary generation (Claude API) to audit results

---

## Day 3 — 09-05-2026
**Hours worked:** 8
**What I did:**
- Debugged 3-step form — replaced shadcn Select with native HTML select.
- Overhauled `PricingDatabase` in `lib/pricingData.ts` to support 25+ AI tools.
- Built core audit logic in `lib/auditEngine.ts` to process 6 specific rule groups.
- Wrote a comprehensive Jest test suite (`tests/auditEngine.test.ts`).
- Built the final `/app/audit/[id]/page.tsx` results dashboard.
- Implemented `lib/aiSummary.ts` to generate tailored AI summaries.

**What I learned:**
- Grouping complex audit logic into specific rule sets makes testing much more predictable.
- Users need clear visual feedback about plan requirements.

**Plan for tomorrow:**
- Polish the lead capture form workflow.

---

## Day 4 - May 10, 2026
**Hours worked:** 8
### Deploy Audit Engine V2 - Capability Overlap Analysis
**What I did:**
- **Added new types**: Capability enum, PlanCapabilityProfile, AuditOutput
- **Created capability data**: Complete mapping of tools/plans to their capabilities
- **Built analysis functions**: Overlap detection, unique capability scoring
- **Implemented new audit pipeline**: 5-stage process (normalize → context → findings → recommendations → summary)
- **Updated API route**: Switched to auditEngineV2 for capability-based analysis

### UI/UX Improvements  
**What I did:**
- **Auto-fill seats**: When plan selected, automatically fills minimum required seats
- **Prevent below-minimum**: Users can't decrease seats below plan requirements
- **Added shadcn warnings**: Inline alerts with AlertTriangle/Info icons

### What I learned:
- Capability overlap analysis provides much more defensible recommendations than simple price comparison.

---

## Day 5 - May 11, 2026
**Hours worked:** 8
### Core Engine & Intelligence
**What I did:**
- **Efficiency Score Engine**: Implemented 0–100 scoring based on overlap and unique value.
- **Per-Tool AI Analysis**: Integrated Groq Llama-3 to generate specific insights.
- **Batched AI Calls**: Optimized backend to generate all insights in a single request.

### UI/UX Redesign
**What I did:**
- **Dashboard Grid Layout**: Complete results page overhaul with 5 modular sections.
- **Data Visualizations**: Built SVG spend donuts and overlap gradient bars.

---

## Day 6 - May 12, 2026
**Hours worked:** 10
**What I did:**
- **Landing Page Overhaul**: Implemented new conversion-focused copy and social proof.
- **Funnel Analytics**: Implemented full-funnel tracking using Supabase `analytics_events`.
- **Heuristic Engine Fixes**: Added "Poor Fit / High Cost" rules.
- **Stability Fixes**: Resolved hydration errors and Supabase client initialization crashes.

**What I learned:**
- Annual savings figures generate significantly more urgency than monthly ones.
- Instrumenting the funnel early is critical for identifying drop-off points.

---

## Day 7 - May 13, 2026
**Hours worked:** 10
**What I did:**
- **Audit Engine V3**: 
  - Switched to **Containment Score** for more accurate redundancy detection.
  - Implemented a **Dynamic Secondary Tool Penalty** based on team size.
  - Reserved "Optimized" label for scores 85+.
- **AI-to-Engine Synchronization**: 
  - Implemented an **AI Refinement Step** where AI can override engine verdicts.
  - Recalculated aggregate savings post-refinement.
- **UI/UX Polish**:
  - Replaced browser alerts with a premium **Referral Modal**.
  - Standardized all technical typography to uppercase **"IDE"**.
  - Simplified Tool Cards by removing redundant status labels.
- **System Stability**: 
  - Fixed Webpack crash by consolidating `next.config` files.
  - Updated Gemini Ultra pricing to $249.99.

**What I learned:**
- Jaccard Similarity penalizes large tools too much; Containment is a superior metric for redundancy.
- Rule-based engines need qualitative AI "overrides" to be truly intelligent.

**Plan for tomorrow:**
- Launch v1.1 with the new referral engine.
- Start building the "Enterprise Stack" bulk-upload feature.
