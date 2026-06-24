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
cd web
npm run build
pm2 restart liquidflow-web --update-env
```

Verify auth:

```bash
curl -sk https://liquidflow.happymonkey.ai/api/auth/providers
curl -sk https://liquidflow.happymonkey.ai/api/auth/session
```

Expected:

- `/api/auth/providers` includes `github`.
- `/api/auth/session` returns `null` before sign-in and user session JSON after sign-in.

## Known Troubleshooting

- Redirects to `a2m.one`: nginx is missing the HTTPS `server_name liquidflow.happymonkey.ai` block and is falling through to the default `www.a2m.one` TLS vhost.
- `UntrustedHost`: set `AUTH_TRUST_HOST=true` and keep proxy headers in nginx.
- `MissingSecret`: set `AUTH_SECRET`.
- `error=Configuration` after GitHub callback: check PM2 logs. If Prisma reports missing `DATABASE_URL`, set it in `web/.env.local` and restart PM2 with `--update-env`.
