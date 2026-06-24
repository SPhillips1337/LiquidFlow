# LiquidFlow Web SaaS Implementation Plan

> **For Hermes / implementers:** Use subagent-driven-development or a user-specified CLI (e.g. gemini) to execute this plan task-by-task. Read this file first in every delegation.

**Goal:** Deploy LiquidFlow as a secure, multi-tenant web application at `liquidflow.happymonkey.ai` with OAuth login (Google, GitHub, email), personal bookshelves, tiered usage (configurable free tier limits + deprioritized queuing), OpenRouter.ai for scalable AI (free models for free tier, premium paid models for subscribers), and Stripe billing. Future-proof for native app backends.

**Architecture Overview:**
- **Frontend:** Static build of existing `reader/` (Vite) served via CDN/nginx or Next.js static export. Canvas rendering unchanged.
- **Backend:** New Node.js API layer (Express or Next.js API routes) handling auth, user isolation, book storage, ingestion queue, usage metering, and OpenRouter proxy.
- **Data:** Postgres (users, subscriptions, usage, book metadata) + per-user object storage (manifests, assets) or S3-compatible.
- **AI:** OpenRouter unified API. Free tier → cheap/free models with strict quotas/queuing. Paid → priority + premium models.
- **Queue:** BullMQ / pg-boss for sequential ingestion with priority (paid > free).
- **Hosting:** VPS (or existing happymonkey.ai infra) + Cloudflare (DNS, DDoS, WAF, rate limiting) + Let's Encrypt / Cloudflare certs. PM2 or Docker for services.
- **Auth:** Auth.js (NextAuth) or Passport.js + OAuth providers + email magic links.
- **Billing:** Stripe Subscriptions + webhooks for tier enforcement.
- **Security:** Defense-in-depth (HTTPS everywhere, CSP, rate limits, input validation, session hardening, abuse detection, no direct model keys exposed).

**Tech Stack (minimal delta from current):**
- Node 20+, npm workspaces (existing)
- Postgres + Prisma or Drizzle ORM
- Auth.js / NextAuth v5
- Stripe
- OpenRouter SDK (or direct fetch)
- BullMQ (Redis) or simple DB-backed queue for MVP
- Existing: `@chenglou/pretext`, Vite, TypeScript
- Optional: Next.js 15 (App Router) for unified frontend+API to reduce context switching

**Tier Rules (configurable via admin/env):**
- **Free:** 1 ingestion / week (adjustable down to 1/month on high demand). Deprioritized queue. Limited to free/cheapest OpenRouter models. Max X books stored.
- **Paid (Yearly/Monthly):** Higher quotas (or unlimited with fair-use), priority queue (FIFO among paid), access to premium models (Claude 3.5 / GPT-4o / etc.). Funds the paid usage.
- Quotas enforced before any OpenRouter call. Usage tracked per user/month.
- Paid users always processed before free in the queue.

**Phased Approach (gate at each phase end):**
- Phase 0: Foundations & Domain
- Phase 1: Auth + User Isolation
- Phase 2: OpenRouter Integration + Basic Quotas
- Phase 3: Ingestion Queue + Tier Prioritization
- Phase 4: Billing + Paid Tier Enforcement
- Phase 5: Security Hardening + Monitoring
- Phase 6: Polish, Migration, App-Readiness

---

## Phase 0: Foundations & Domain Setup

### Task 0.1: Domain & TLS
**Objective:** Point `liquidflow.happymonkey.ai` at the server with valid HTTPS.

**Files:**
- Create: `deploy/liquidflow.happymonkey.ai.nginx.conf`
- Modify: existing `deploy/nginx-liquidflow.conf` (adapt)

**Steps:**
1. Add DNS A record (or CNAME via Cloudflare) for `liquidflow.happymonkey.ai` → server IP.
2. Install certbot or use Cloudflare Origin CA / Let's Encrypt.
3. Write nginx config with:
   - `server_name liquidflow.happymonkey.ai;`
   - SSL termination, HSTS, modern ciphers.
   - Proxy to backend (port 3000 or PM2).
   - Static serving for built reader assets with long cache.
   - Rate limiting zones.

**Verification:**
```bash
curl -I https://liquidflow.happymonkey.ai
# Expect: HTTP/2 200 + strict-transport-security header
```

**Current production note:** the HTTPS vhost must explicitly include `server_name liquidflow.happymonkey.ai`.
If only the HTTP block is installed, nginx falls through to the first `:443` vhost and can redirect to
`a2m.one`. The working config is tracked in `deploy/liquidflow.happymonkey.ai.nginx.conf`.

**Commit:** `chore: add domain nginx config for liquidflow.happymonkey.ai`

### Task 0.2: Project Structure for Web Backend
**Objective:** Scaffold backend without breaking existing local pipeline/reader.

**Files:**
- Create: `web/` directory (or `apps/web/` if monorepo)
- Create: `web/package.json`, `web/src/server.ts` (Express or Next.js), `web/.env.example`
- Create: `web/prisma/schema.prisma` (User, Subscription, Usage, Book models)
- Update: root `package.json` workspaces if needed

**Step 1:** Initialize minimal Express or `npx create-next-app@latest web --yes --tailwind --eslint --yes` (recommended for Auth.js).

**Verification:** `cd web && npm run dev` serves on 3000 without conflicting reader dev server (9325).

**Commit:** `feat: scaffold web backend directory`

---

## Phase 1: Authentication & Personal Bookshelves

### Task 1.1: User Model & Auth.js Setup
**Objective:** Enable Google, GitHub, and email/passwordless login with secure sessions.

**Files:**
- `web/src/app/api/auth/[...nextauth]/route.ts` (if Next.js)
- `web/prisma/schema.prisma` – User, Account, Session, VerificationToken models
- `web/src/lib/auth.ts`

**Step 1:** Install `next-auth` (or `@auth/express`), `@prisma/client`, `prisma`.

**Step 2:** Configure providers in Auth.js (Google, GitHub, Email).

**Step 3:** Add middleware for protected routes.

**Verification:** Login flow works, session cookie is HttpOnly + Secure, user row created in DB.

**Current production note:** GitHub OAuth is configured with:

```text
Homepage URL: https://liquidflow.happymonkey.ai
Authorization callback URL: https://liquidflow.happymonkey.ai/api/auth/callback/github
```

Auth.js also requires `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST=true`, and
`DATABASE_URL` in the production environment. Missing `DATABASE_URL` presents as
`/api/auth/error?error=Configuration` after the GitHub callback.

**Commit:** `feat(auth): add Google + GitHub + Email auth with Auth.js`

### Task 1.2: Per-User Book Storage & Bookshelf UI
**Objective:** Users see only their own books; ingestion writes to user-scoped paths.

**Files:**
- Extend `pipeline/src/ingest.ts` to accept `userId` and write to `public/books/{userId}/`
- New API routes: `/api/books` (list/create for current user), `/api/books/:id`
- Update reader to fetch from user-specific endpoint instead of static `/books/`

**Step:** Add `userId` column to Book model; enforce RLS or query filters everywhere.

**Verification:** Two test users cannot see each other's books.

**Commit:** `feat: user-isolated book storage and personal bookshelf`

---

## Phase 2: OpenRouter Integration + Tier Quotas

### Task 2.1: OpenRouter Client & Model Routing
**Objective:** Replace/supplement local Ollama with OpenRouter; route based on tier.

**Files:**
- Create: `web/src/lib/openrouter.ts` (wrapper with API key from env, usage logging)
- Update: `pipeline/src/ingest.ts` (or new `web/src/lib/ingest.ts`) to call OpenRouter instead of Ollama proxy

**Config (env):**
```
OPENROUTER_API_KEY=...
FREE_MODELS="google/gemini-flash,..."   # cheap/free tier
PAID_MODELS="anthropic/claude-3.5-sonnet,..."
```

**Verification:** Test ingestion calls OpenRouter and returns annotated manifest.

**Commit:** `feat(ai): integrate OpenRouter with tier-based model selection`

### Task 2.2: Usage Tracking & Configurable Free Tier Limits
**Objective:** Enforce "1 ingestion/week" (or dynamic) for free users; log every AI call.

**Files:**
- `web/prisma/schema.prisma` – UsageLog, Quota models
- `web/src/lib/quotas.ts` – functions `canIngest(userId)`, `recordUsage(userId, type, cost)`
- Admin config endpoint or `.env` + DB table for `free_ingest_limit_per_week`

**Verification:** Free user hits limit → 429 with clear message. Paid user unaffected.

**Commit:** `feat(quotas): implement configurable free tier limits + usage logging`

---

## Phase 3: Priority Ingestion Queue

### Task 3.1: Job Queue with Paid Priority
**Objective:** Paid ingestions processed first; free users may wait.

**Files:**
- Add Redis (or Postgres) + BullMQ (or pg-boss)
- `web/src/queues/ingestion.queue.ts`
- Job processor that calls the (now OpenRouter) ingest logic

**Logic:**
- Job priority: paid = 10, free = 1
- Concurrency limited (e.g. 2–4 simultaneous)
- Free jobs only run when no paid jobs pending

**Verification:** Submit mixed free/paid jobs; observe paid always processed sooner.

**Commit:** `feat(queue): BullMQ ingestion queue with paid priority`

---

## Phase 4: Billing & Paid Tier

### Task 4.1: Stripe Integration
**Objective:** Yearly/monthly subscriptions that unlock higher quotas + premium models.

**Files:**
- `web/src/lib/stripe.ts`
- Webhook handler `/api/webhooks/stripe`
- Pricing page + checkout flow
- Update user subscription status on webhook

**Verification:** Successful subscription → user tier flips to paid, quota increases immediately.

**Commit:** `feat(billing): Stripe subscriptions + webhook tier enforcement`

---

## Phase 5: Security Hardening

### Task 5.1: Core Security Layers
**Objective:** Protect against common web + AI-specific attacks.

**Checklist & Implementation:**
- HTTPS + HSTS + CSP (restrict scripts, no inline unless nonce)
- Rate limiting (nginx + express-rate-limit or Cloudflare)
- Input sanitization on book uploads / prompts
- Secrets only in env / vault; never in client
- Session rotation + secure cookies
- CORS locked to app domain
- Abuse detection (too many failed logins, unusual ingestion patterns)
- Content moderation hooks if ingesting arbitrary books
- Regular dependency scanning (`npm audit`, Dependabot)

**Files:** `web/src/middleware/security.ts`, nginx updates, `.env` docs.

**Verification:** Run `owasp-zap` or `nikto` against staging; zero high/critical findings.

**Commit:** `security: implement defense-in-depth (CSP, rate limits, auth hardening)`

### Task 5.2: AI Abuse Prevention
**Objective:** Prevent prompt injection, excessive usage, data exfiltration via AI.

**Steps:**
- Prompt templates with strict output schemas
- Token/length limits on user inputs
- Cost caps per user/day
- Logging of all OpenRouter requests/responses (redacted)

**Commit:** `security: AI-specific guardrails and cost caps`

---

## Phase 6: Polish, Migration & App Readiness

### Task 6.1: Production Deployment & Monitoring
**Objective:** Zero-downtime deploy, observability.

**Steps:**
- Dockerize or PM2 ecosystem update for web service
- Add Prometheus/Grafana or simple logging (Pino + Loki)
- Health checks, uptime monitoring (UptimeRobot or similar)
- Error tracking (Sentry)

**Commit:** `ops: production deployment + monitoring setup`

### Task 6.2: Migration from Local
**Objective:** Existing local users/books can be imported.

**Script:** One-time migration tool that assigns anonymous books to a default user or prompts login.

### Task 6.3: App-Ready API Surface
**Objective:** Document REST/GraphQL endpoints so a future React Native / Flutter app can consume the same backend.

**Deliverable:** `docs/API.md` with auth, books, ingest, usage endpoints + OpenAPI spec.

**Commit:** `docs: publish stable API surface for future mobile apps`

---

## Post-Plan Recommendations & Open Questions (for later refinement)

- **Hosting choice:** Existing VPS + Cloudflare (recommended for control) vs Vercel/Render + managed Postgres.
- **Queue backend:** Redis (BullMQ) vs pure Postgres for simplicity.
- **Free tier adjustment mechanism:** Admin dashboard or simple config file + restart.
- **Future:** Mobile app can reuse the exact same auth + API + queue logic.
- **Cost control:** Monitor OpenRouter spend weekly; auto-pause free tier if budget exceeded.

**Next immediate action after plan approval:** Run Phase 0 tasks, then gate review before Phase 1.

**Plan created:** 2026-06-23 by Hermes planning session. Ready for execution.
