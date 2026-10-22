# Unsubscribe service

Standalone Express + TypeScript service. The email link opens a confirm page; pressing **Confirm** sets
`subscribers.unsubscribed = TRUE` in Aurora PostgreSQL. It has no send or editor code, so exposing it publicly
does not expose your campaign app.

## Flow
1. Email link: `https://<unsub-domain>/unsubscribe?r=<subscribers.id>&c=<campaign id, optional>`
2. `GET` shows the confirm page and creates a one-time token (30 min; only its SHA-256 hash is stored in `unsubscribe_tokens`).
3. `POST /unsubscribe` with that token sets `unsubscribed` and `unsubscribed_at`, adds an `unsubscribe` row to
   `tracking_events`, and increments `campaigns.metrics.unsubscribeCount` (only when `c` is given).

## Configure
Copy `.env.example`; every value is an environment variable (set them on the Fargate task definition).

## Database
- Run `migrations/001_unsubscribe.sql` once as an admin user, then set `AUTO_MIGRATE=false`
  (or leave it `true` if the service user may ALTER/CREATE).
- IAM database user:
```sql
CREATE USER unsubscribe_svc WITH LOGIN;
GRANT rds_iam TO unsubscribe_svc;
GRANT SELECT, UPDATE ON subscribers, campaigns TO unsubscribe_svc;
GRANT INSERT ON tracking_events TO unsubscribe_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON unsubscribe_tokens TO unsubscribe_svc;
```
- The ECS task role needs `rds-db:connect` on
  `arn:aws:rds-db:<region>:<account-id>:dbuser:<cluster-resource-id>/unsubscribe_svc`.

## Run
```bash
npm install
npm run dev                                   # local, reads .env (use DATABASE_URL for a local Postgres)
docker build -t unsubscribe-service .
docker run -p 8080:8080 --env-file .env unsubscribe-service
```
Container port `8080`; ALB health check path `/health` (`/ready` also checks the DB).
The image bundles the Amazon RDS CA bundle (`NODE_EXTRA_CA_CERTS`) so TLS verification works.
Set `TRUST_PROXY_HOPS=1` behind an ALB.
