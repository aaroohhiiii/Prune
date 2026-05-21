# Vantage

**AI Spend Optimization Platform** — Stop overpaying for AI tools. Vantage audits your team's entire AI stack, surfaces redundancies, and proactively alerts you whenever market pricing shifts your recommendations.

**[Watch the Demo Video](https://youtu.be/Qlu0wdfcylw)**

Vantage is a two-round product: Round 1 shipped the core audit engine. Round 2 layered in live pricing change detection, re-audit notifications, a side-by-side diff view, email analytics, and an admin metrics dashboard on top.

---

## Who It's For

- **Startups** (5–50 employees) looking to optimize SaaS costs
- **Engineering teams** using multiple AI development tools
- **Finance leaders** needing visibility into AI tool spending
- **DevOps managers** managing tool subscriptions and licenses

---

## Screenshots

### Homepage & Audit Flow

*Landing page with audit CTA and real-time savings calculator*

<img width="1703" height="980" alt="Homepage" src="https://github.com/user-attachments/assets/b08298ff-e7a1-4ae0-bf8a-8112b253f793" />

<img width="1703" height="980" alt="Audit flow" src="https://github.com/user-attachments/assets/98c2d74c-a0c4-4eb4-978e-c075244caeca" />

### Audit Results Dashboard
<img width="1703" height="980" alt="Results dashboard" src="https://github.com/user-attachments/assets/e040b509-f7a6-402c-a196-8a7e5e36fac8" />

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm
- Supabase account (for database)
- Groq API key (for AI summaries)
- Resend account (for email notifications)

### Installation

```bash
git clone https://github.com/aaroohhiiii/Vantage.git
cd Vantage
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

Visit `http://localhost:3000`.

---

## Key Features

### Round 1 — Core Audit Engine
- **Science of Savings Engine**: Multi-vector auditing covering redundancy mapping, benchmarking, and tier optimization.
- **90-Second Audit**: Complete AI stack analysis in under 2 minutes.
- **AI-Powered Insights**: Strategic consultant-grade recommendations using Llama 3.3 via Groq.
- **Real-Time Pricing**: Up-to-date pricing data against official vendor sources.
- **Public Audit URLs**: Every audit gets a shareable, permanent URL.

### Round 2 — Live Pricing Intelligence
- **Pricing Change Detection**: Admin endpoint to update market prices; system detects which stored audits are now stale.
- **Automatic Re-Audit**: When a price changes, all affected users' audits are recomputed against the new pricing automatically.
- **Consolidated Email Alerts**: Users receive one clean email per pricing event (no spam) via Resend, telling them exactly what changed and what their new recommendation is.
- **One-Click Unsubscribe**: Signed HMAC-SHA256 tokens in email footers. Users can opt out of re-audit notifications without touching the app.
- **Side-by-Side Diff View** (`/audit/[id]/compare`): Headline summary → tool-by-tool breakdown → actionable insights → market context. Rendered with full savings deltas highlighted.
- **Email Analytics Pipeline**: Every email is tracked end-to-end. Resend webhooks write `opened_at` to `email_events`. Clicking the email link records `clicked_at` via `/api/track-click`.
- **Admin Metrics Dashboard** (`/admin/metrics`): Password-protected dashboard showing total audits, emails sent, open rate, and click-through rate.
- **Public Pricing Changes Widget**: The landing page (`/`) shows the latest detected market pricing shifts — a growth surface that proves the product is actively monitoring the market.
- **GitHub Actions Cron**: `.github/workflows/detect-prices.yml` hits `/api/detect-prices` every night at 2:00 AM UTC to sweep for changes automatically.

---

## Architecture

```
├── app/
│   ├── page.tsx                         # Landing page + PricingChangesWidget
│   ├── audit/
│   │   ├── new/page.tsx                 # Audit intake form
│   │   ├── [id]/page.tsx               # Audit results
│   │   └── [id]/compare/page.tsx       # Side-by-side diff view (Round 2)
│   ├── admin/metrics/page.tsx          # Admin analytics dashboard (Round 2)
│   └── api/
│       ├── audit/route.ts              # Core audit engine endpoint
│       ├── admin/pricing/route.ts      # Price update endpoint (Round 2)
│       ├── admin/detect-changes/route.ts # Manual recompute trigger (Round 2)
│       ├── detect-prices/route.ts      # GitHub Actions cron target (Round 2)
│       ├── pricing-changes/route.ts    # Public pricing changes feed (Round 2)
│       ├── webhooks/resend/route.ts    # Email open tracking (Round 2)
│       ├── track-click/route.ts        # Email click tracking (Round 2)
│       └── email-preferences/unsubscribe/route.ts # Unsubscribe handler (Round 2)
├── components/
│   ├── AuditDiffView.tsx               # Diff view UI component (Round 2)
│   ├── PricingChangesWidget.tsx        # Live pricing changes on homepage (Round 2)
│   └── AuditResults/                  # Results dashboard components
├── lib/
│   ├── auditEngineV2.ts               # Core recommendation algorithm
│   ├── auditDiff.ts                   # Delta calculation between two audits (Round 2)
│   ├── auditRecompute.ts              # Re-run engine against new pricing (Round 2)
│   ├── dailyDetection.ts             # Daily price sweep logic (Round 2)
│   ├── pricingService.ts             # DB-backed pricing cache (Round 2)
│   ├── resend.ts                     # Email templates + Resend integration
│   ├── emailNotifications.ts         # Consolidated email dispatcher (Round 2)
│   ├── emailTemplates.ts             # Pricing change email HTML (Round 2)
│   └── emailTokens.ts               # HMAC unsubscribe token management (Round 2)
├── tests/                            # Vitest unit + integration tests (Round 2)
├── supabase/migrations/              # SQL migrations for all new tables
└── .github/workflows/detect-prices.yml  # GitHub Actions daily cron (Round 2)
```

---

## Technical Decisions

### 1. Next.js 14 App Router
Used for better route organization, streaming, and React Server Component support. Enables superior performance for the data-heavy audit results and compare pages.

### 2. Supabase & PostgreSQL
Managed database with row-level security. All Round 2 tables (`pricing_snapshot`, `pricing_changes`, `email_events`, `email_preferences`) use the same project. Historical price lookups use a ledger pattern: old rows are marked `is_active = false` and a new row is inserted.

### 3. Groq Llama 3.3
Ultra-low latency AI inference. The entire audit flow stays under 60 seconds even with AI summary generation included.

### 4. Resend for Email
Free tier, developer-friendly API, and webhook delivery for email lifecycle events (`email.opened`, `email.bounced`, `email.unsubscribed`). Webhooks feed directly into `email_events` in Supabase.

### 5. GitHub Actions (Free Tier) for Automation
Instead of paid Vercel Cron, we use GitHub's built-in scheduler to call `/api/detect-prices` nightly. The endpoint is secured with a `PRICE_DETECTION_TOKEN` Bearer secret stored in GitHub repo secrets.

---

## Running Tests

```bash
npm run test          # Run all 17 Vitest tests
npm run lint          # ESLint check
npm run build         # Production build verification
```

---

## Updating Pricing Data

There is no scraping — pricing is maintained manually by an admin:

```bash
curl -X PATCH https://your-app.vercel.app/api/admin/pricing \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"tool": "cursor", "plan": "Pro", "new_price": "30", "verified_date": "2026-05-20", "source_url": "https://cursor.com/pricing"}'
```

Alternatively, update rows directly in the Supabase dashboard under `pricing_snapshot`.

---

## Deployed URL

**Live Demo**: [vantagecredex.vercel.app](https://vantagecredex.vercel.app/)

---

**Built with ❤️ for the AI-powered development community**
https://vantagecredex.vercel.app/)

---

**Built with ❤️ for the AI-powered development community**
