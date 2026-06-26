# LiquidFlow Production Notes

LiquidFlow production currently runs as a Next.js web app behind nginx at:

```text
https://liquidflow.happymonkey.ai
```

## Services

- `liquidflow-web`: PM2 process running `web` with `next start -p 3000`.
- nginx terminates HTTPS for `liquidflow.happymonkey.ai` and proxies to `127.0.0.1:3000`.
- Postgres stores Auth.js users, sessions, OAuth accounts, subscriptions, usage logs, and book metadata.

## Nginx

The active config should match:

```text
deploy/liquidflow.happymonkey.ai.nginx.conf
```

Install/update:

```bash
sudo certbot certonly --nginx -d liquidflow.happymonkey.ai
sudo cp deploy/liquidflow.happymonkey.ai.nginx.conf /etc/nginx/sites-available/liquidflow.happymonkey.ai.conf
sudo ln -sf /etc/nginx/sites-available/liquidflow.happymonkey.ai.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Verify nginx routes to LiquidFlow, not the default `a2m.one` vhost:

```bash
curl -skI --resolve liquidflow.happymonkey.ai:443:127.0.0.1 https://liquidflow.happymonkey.ai/
curl -skI https://liquidflow.happymonkey.ai/
```

Expected: `HTTP/2 200` with `x-powered-by: Next.js`.

## Runtime Environment

Secrets are stored in ignored local files:

```text
web/.env
web/.env.local
```

Required production variables:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
AUTH_URL="https://liquidflow.happymonkey.ai"
NEXTAUTH_URL="https://liquidflow.happymonkey.ai"
AUTH_TRUST_HOST="true"
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
OPENROUTER_API_KEY="..."
FREE_INGEST_LIMIT_PER_WEEK=1
PAID_INGEST_LIMIT_PER_WEEK=50
```

GitHub OAuth App settings:

```text
Homepage URL: https://liquidflow.happymonkey.ai
Authorization callback URL: https://liquidflow.happymonkey.ai/api/auth/callback/github
```

Leave GitHub App setup URL and webhook URL blank unless the product later needs GitHub App installation webhooks. Auth.js GitHub login uses an OAuth App.

## Database

Apply the Prisma schema after setting `DATABASE_URL`:

```bash
cd web
npx prisma db push
```

Current schema creates:

```text
User, Account, Session, VerificationToken, Book, Subscription, UsageLog
```

## Deploy

```bash
cd reader
npm run build

cd web
npm run build
pm2 restart liquidflow-web --update-env
```

The root PM2 config starts the same production Next.js process:

```bash
pm2 start /home/stephen/projects/LiquidFlow/ecosystem.config.cjs
```

Do not expose `reader`'s Vite dev server publicly. Its development middleware includes local-only ingestion,
management, and Ollama proxy endpoints that are intentionally absent from the production Next.js app.

The production site is split between the Next.js app and the built Vite reader:

- `/` - public landing page or authenticated dashboard.
- `/bookshelf` - production bookshelf and account-scoped book list.
- `/bookshelf/create` - authenticated AI story creation.
- `/bookshelf/import` - authenticated Project Gutenberg import.
- `/reader/` - built canvas reader. Production links should include `?book=<Book.id>` so the reader opens the selected book directly.

Bookshelf cards expose account-scoped actions:

- **Open in Reader** opens the selected book by database id.
- **Regenerate** creates a new AI-generated version from the existing book text using the same story-generation pipeline and quota reservation path.
- **Delete** removes the selected book from the current user's account only.

OpenRouter is required for AI story creation:

```env
OPENROUTER_API_KEY="..."
FREE_MODELS="nvidia/nemotron-3-super-120b-a12b:free"
PAID_MODELS="nvidia/nemotron-3-super-120b-a12b:free"
```

Rotate the OpenRouter key if it has been shared in chat, logs, screenshots, or terminals.

Story creation currently runs synchronously inside `/api/books/create-story`. Regeneration runs synchronously
inside `/api/books/:id/regenerate`. Both use the shared story-generation pipeline:

1. create a compact private first draft from the user premise or source book;
2. extract themes, motifs, archetypes, and Gutendex search signals;
3. search Project Gutenberg/Gutendex metadata for public-domain reference material;
4. expand the final story using those references only for high-level motifs, atmosphere, archetypes, and structure;
5. validate generated text before saving.

Validation checks:

- strips reasoning/model-note wrappers such as `<think>...</think>`;
- rejects obvious model/task commentary;
- rejects output-limit finishes;
- requires a multi-chapter story shape;
- rejects mid-sentence endings.

Long-running model calls can still fail at the HTTP/proxy layer. The next production step is to move creation
and import work into a durable job table or queue with a status page.

Verify auth:

```bash
curl -sk https://liquidflow.happymonkey.ai/api/auth/providers
curl -sk https://liquidflow.happymonkey.ai/api/auth/session
```

Expected:

- `/api/auth/providers` includes `github`.
- `/api/auth/session` returns `null` before sign-in and user session JSON after sign-in.

Verify reader routing:

```bash
curl -skI https://liquidflow.happymonkey.ai/reader/
```

Expected: `HTTP/2 200` with `content-type: text/html`.

## Known Troubleshooting

- Redirects to `a2m.one`: nginx is missing the HTTPS `server_name liquidflow.happymonkey.ai` block and is falling through to the default `www.a2m.one` TLS vhost.
- `UntrustedHost`: set `AUTH_TRUST_HOST=true` and keep proxy headers in nginx.
- `MissingSecret`: set `AUTH_SECRET`.
- `error=Configuration` after GitHub callback: check PM2 logs. If Prisma reports missing `DATABASE_URL`, set it in `web/.env.local` and restart PM2 with `--update-env`.
- OpenRouter `404` for a model: update `FREE_MODELS`/`PAID_MODELS` to currently available OpenRouter model ids. Paid users fall back to `PAID_MODELS`, then `FREE_MODELS`, then the tracked free default.
- OpenRouter `402` for credits: use a free/cheaper model or reduce the story token ceilings before retrying.
