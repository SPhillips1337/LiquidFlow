# LiquidFlow Progress

Last updated: 2026-06-26

## What We Shipped Today

- Production login flow now lands authenticated users on an account dashboard instead of the public landing page.
- Dashboard shows current tier, bookshelf count, weekly creation quota, and plan status.
- `My Bookshelf` is now a production SaaS page with account-scoped books and tier-aware creation/import actions.
- Added focused production pages for:
  - `/bookshelf/create` - AI story creation.
  - `/bookshelf/import` - Project Gutenberg search and import.
- Added authenticated Next API routes for:
  - `/api/books/search`
  - `/api/books/ingest`
  - `/api/books/create-story`
- Story creation now uses OpenRouter with `FREE_MODELS` configured locally for `nvidia/nemotron-3-super-120b-a12b:free`.
- Generated story output is cleaned and validated before it is saved, with one retry if model notes or reasoning appear.
- The production bookshelf opens books directly in the canvas reader via `/reader/?book=<bookId>`.
- The old proof-of-concept reader shelf is bypassed for production book links.
- The production reader opens in dark theme for direct book links.
- nginx config now serves the built reader from `/reader/`, plus reader assets and book assets.

## 2026-06-26 Update

- Reset the free-tier usage counter for the test account so another creation run could be tested.
- Investigated a generated story that was saved mid-sentence. Root causes were a short story prompt, low output budget, no `finish_reason` check, no ending validation, and one-chapter manifest generation.
- Hardened story creation so it now requests four concise chapters, rejects length-stopped model responses, rejects mid-sentence endings, and requires chapter headings before saving.
- Updated manifest creation to split generated `Chapter ...` headings into real reader chapters instead of always storing one chapter.
- Added safer client/server error handling for story creation so HTML/proxy/runtime failures are returned to the user as readable errors instead of `Unexpected token '<'`.
- Tuned story generation down to `1800-2600` words and `4500` max output tokens after the larger request appeared likely to timeout against the free 120B model.

## Current Shape

- Next.js `web/` is the production shell for auth, dashboard, bookshelf, creation, import, and user-scoped APIs.
- Vite `reader/` is now primarily the canvas reading surface for books launched from the production bookshelf.
- Imported/generated books are stored in Postgres as `Book.manifest` records scoped by `userId`.
- Free-tier creation/import quota is enforced through `UsageLog` and `FREE_INGEST_LIMIT_PER_WEEK`.

## Known Gaps

- Gutenberg import currently creates a basic manifest locally; it does not yet run OpenRouter annotation for mood, entities, summaries, or visual prompts.
- Story generation has validation, but there is no admin review queue or user-facing regeneration/edit flow yet.
- Existing books created before output validation may still contain model notes and need cleanup or regeneration.
- Existing books created before chapter/ending validation may still be short or truncated and need cleanup, deletion, or regeneration.
- Story creation is still synchronous HTTP. Longer OpenRouter calls can still hit proxy/runtime timeouts; moving creation/import to a durable job flow is the proper production fix.
- Reader visual styling is still partly the original POC canvas UI; it opens directly now, but the toolbar/sidebar styling should be brought closer to the production web design.
- Stripe billing and paid-tier upgrade flows are not implemented yet.
- The in-memory queue helper is still not a durable production queue; a database-backed or Redis-backed queue is still needed for load.
- The OpenRouter key used during testing was exposed in the session transcript and should be rotated before longer-term production use.

## Next Session Priorities

1. Rotate the OpenRouter key and update `web/.env.local`.
2. Add OpenRouter annotation to Gutenberg imports so imported books get richer LiquidFlow metadata.
3. Bring the reader toolbar/sidebar styling in line with the production dashboard/bookshelf design.
4. Add a lightweight generation status page or job model so long-running creation/import work is visible and durable.
5. Decide whether old POC shelf functionality should be removed entirely or retained only for local development.
