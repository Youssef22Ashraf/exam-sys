> [INDEX](../INDEX.md) > Guides > Deployment platforms

# 09 — Deployment platforms: comparison and fit

Which host to run this system on, what each one's packages include, where
each fits, and where each breaks for **this** app. Read
[08_deployment.md](08_deployment.md) for the Railway steps that exist
today; this file is for choosing.

> Prices are list prices as of mid-2026, USD, rounded. They change.
> Verify on the vendor page before quoting a client.

---

## 1. What this app needs from a host

Every judgement below is against these seven requirements. They come
from the code, not from preference.

| # | Requirement | Where it comes from | Why it matters for platform choice |
|---|---|---|---|
| R1 | **One long-running Node process** | `backend/src/index.ts` — Express + Socket.io on one `httpServer` | Serverless / function platforms are out unless the app is restructured |
| R2 | **WebSockets** | Socket.io live proctoring (`candidate:*` → `admin:*`) | Host must proxy WS, keep connections open for 30+ min |
| R3 | **Persistent writable disk** | `backend/uploads/videos` (200 MB per exam), `uploads/snapshots`, SQLite `dev.db` | Ephemeral filesystems lose every recording on redeploy |
| R4 | **Docker build from repo root** | `Dockerfile` + `railway.json` | Buildpack-only hosts need a rewrite of the build |
| R5 | **Large uploads** | multer 200 MB cap, `express.json` 50 MB | Some proxies cap request body at 10–100 MB |
| R6 | **Outbound SMTP** | `emailService.ts` port 587/465 | Several clouds block port 25/587 egress by default |
| R7 | **Low ops budget** | one developer, no SRE | Managed platform beats raw VM unless cost forces it |

**The single biggest lever**: R3. If recordings and the DB move off local
disk (S3-compatible object storage + managed Postgres), almost every
platform becomes viable and cheap. If they stay on disk, only platforms
with attached volumes work. §6 covers that migration.

---

## 2. Platform-by-platform

Each entry: what the packages contain, where it fits, where it fails
for this app, and a verdict.

### 2.1 Railway (current target)

**Packages**

| Plan | Price | Includes |
|---|---|---|
| Hobby | $5/mo (includes $5 usage) | 8 GB RAM / 8 vCPU per service cap, volumes, custom domains, 1 seat |
| Pro | $20/seat/mo (includes $20 usage) | 32 GB RAM / 32 vCPU cap, priority support, multiple regions, unlimited seats |
| Usage on top | ~$0.000231/vCPU-min, ~$0.000231/GB-min RAM, volume ~$0.15/GB-mo, egress ~$0.05/GB | billed by the minute of actual use |

**Fits this app**

- Detects the root `Dockerfile` (R4). Zero config already committed.
- Volumes mount at any path — `/app/backend/uploads` and `/app/backend/prisma` (R3).
- WebSockets pass through the edge proxy with no config (R2).
- SMTP egress open (R6).
- Managed Postgres one click if/when SQLite goes (§6).
- Pay for actual CPU minutes — an exam system idle 90% of the day costs a few dollars.

**Weaknesses**

- A volume attaches to **one** service replica; horizontal scaling is off the table while uploads are on disk. Same for every volume-based host below.
- Volume is region-locked; moving region means a manual copy.
- Request body cap ~100 MB at the edge is **not** documented as hard; a 200 MB `.webm` has not been proven through Railway's proxy. Test with a full 30-minute recording before go-live.
- No built-in backups for volumes. Snapshot `dev.db` yourself.
- Usage billing surprises if a container loops on crash (`restartPolicyMaxRetries: 10` limits this).

**Verdict**: **Best fit today.** Nothing to change. Expected bill for one
low-traffic instance: $5–10/month including a 10 GB volume.

---

### 2.2 Render

**Packages**

| Plan | Price | Includes |
|---|---|---|
| Free web service | $0 | 512 MB, **spins down after 15 min idle**, no disks |
| Starter | $7/mo | 512 MB RAM, 0.5 CPU, always on |
| Standard | $25/mo | 2 GB RAM, 1 CPU |
| Persistent disk | $0.25/GB-mo | attaches to one instance, SSD |
| Postgres | Free 90-day → $6/mo basic-256mb → $19/mo basic-1gb | managed, daily backups on paid |

**Fits this app**

- Native Dockerfile support, `render.yaml` blueprint is ~15 lines.
- Persistent disks (R3), WebSockets (R2), SMTP (R6) all supported on paid tiers.
- Health checks, zero-downtime deploys, preview environments on Pro.
- Disk snapshots exist on paid disks — better than Railway for the SQLite file.

**Weaknesses**

- **Free tier is unusable**: cold start 30–60 s means a candidate's first request times out, and Socket.io drops on spin-down.
- Persistent disk **disables zero-downtime deploys** — every deploy is ~1 min of downtime. Acceptable if deploys happen outside exam windows.
- Disk is region-locked, single-attach (same as Railway).
- Fixed monthly per instance, not per-minute. Slightly more than Railway at idle.

**Verdict**: **Strong second choice.** Pick Render over Railway when
disk snapshots / DB backups matter more than per-minute billing, or the
client already has a Render account. Migration effort: half a day.

---

### 2.3 Fly.io

**Packages**

| Item | Price | Notes |
|---|---|---|
| shared-cpu-1x, 256 MB | ~$2/mo | too small for Prisma + Node comfortably |
| shared-cpu-1x, 1 GB | ~$6/mo | realistic minimum |
| shared-cpu-2x, 2 GB | ~$12/mo | headroom for video uploads |
| Volumes | $0.15/GB-mo | NVMe, single-attach, snapshots daily (5-day retention) |
| Managed Postgres (Fly MPG) | from ~$38/mo | or run unmanaged Postgres on a Fly Machine for ~$6 |
| Egress | first 100 GB free, then $0.02/GB | video downloads to admins count |

**Fits this app**

- Dockerfile-first platform (R4). `fly launch` reads it.
- Volumes with **automatic daily snapshots** (R3) — the best SQLite story of the managed platforms.
- WebSockets native (R2). SMTP egress open (R6).
- Machines can auto-stop when idle and auto-start on request; ~300 ms cold start, far better than Render free.
- Anycast + multi-region if a client ever needs Middle East latency (`fra`, `bom`, `sin` regions; no Gulf region as of 2026).

**Weaknesses**

- Configuration is `fly.toml` + CLI; there is no dashboard-driven deploy from GitHub. CI needs a `flyctl deploy` step and a token.
- Volume and Machine must be in the same region; scaling to two machines needs two volumes and there is no shared filesystem. Same single-writer constraint.
- Auto-stop kills Socket.io connections; disable `auto_stop_machines` for this app, which removes the idle saving.
- Support is community-first on Hobby; paid support starts at $29/mo.
- Billing granularity and dashboard are rougher than Railway/Render.

**Verdict**: **Best price/feature ratio if the team is CLI-comfortable.**
Choose it for volume snapshots and future multi-region. Migration
effort: one day including a `fly.toml` and a GitHub Action.

---

### 2.4 DigitalOcean

Two different products.

**App Platform (PaaS)**

| Plan | Price | Includes |
|---|---|---|
| Basic | $5/mo | 512 MB, 1 vCPU, **no persistent disk** |
| Professional | $12/mo | 1 GB, autoscale, |
| Managed Postgres | $15/mo | 1 GB, daily backups |
| Spaces (S3-compatible) | $5/mo for 250 GB + 1 TB egress | for recordings |

- Dockerfile supported. WebSockets supported. SMTP: **outbound port 25 blocked, 587 open**.
- **No persistent disk at all.** R3 fails unless recordings go to Spaces and DB to managed Postgres. That is the §6 migration.
- Verdict: **Only after §6.** Then it is a clean, cheap fit at ~$32/mo (app + Postgres + Spaces).

**Droplet (VM)**

| Plan | Price | Includes |
|---|---|---|
| Basic 1 GB | $6/mo | 1 vCPU, 25 GB SSD, 1 TB transfer |
| Basic 2 GB | $12/mo | 1 vCPU, 50 GB SSD |
| Block storage | $0.10/GB-mo | attachable, snapshots |

- Run `docker compose up -d` from the repo; the existing `docker-compose.yml` works with a Caddy or nginx TLS front.
- Everything on local SSD (R3), full control, cheapest at scale.
- **All ops are yours** (R7 fails): OS patches, TLS renewal, Docker updates, backups, log rotation, restart on crash. Budget 2–4 hours/month.
- Verdict: **Fit for a client who insists on their own server or region.** Not the default.

---

### 2.5 Hetzner Cloud (VPS)

| Plan | Price | Includes |
|---|---|---|
| CX22 | ~€4/mo | 2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB traffic |
| CX32 | ~€7/mo | 4 vCPU, 8 GB |
| Volumes | €0.05/GB-mo | attachable |
| Snapshots | €0.01/GB-mo | |

- Same model as a Droplet at a third of the price and double the RAM. Regions: Germany, Finland, US, Singapore.
- **Weaknesses**: identical ops burden; **SMTP ports blocked on new accounts** until you open a support ticket (R6); no managed Postgres (use their community images or an external one); no Gulf region.
- Verdict: **Best raw value if self-managing anyway.** Same caveats as a Droplet.

---

### 2.6 AWS

Three realistic shapes.

**Lightsail (simplified VPS)**

| Plan | Price |
|---|---|
| 1 GB / 2 vCPU / 40 GB | $7/mo |
| 2 GB / 2 vCPU / 60 GB | $12/mo |
| Lightsail Containers (nano) | $7/mo per node, **no persistent disk** |

- Lightsail **instance** = VPS, same as Droplet, AWS console. Fine.
- Lightsail **Containers** have no volumes; needs §6.
- **SMTP: AWS blocks port 25 by default; 587 is open. Use SES** ($0.10 per 1000 mails) instead of Gmail once on AWS.

**App Runner**

- Runs a container from ECR or GitHub, $0.007/vCPU-hr + $0.0008/GB-hr, ~$25–40/mo always-on.
- **No persistent disk, no WebSockets** as of 2026 (HTTP/1.1 request-response only). Fails R2 and R3. **Not viable.**

**ECS Fargate + EFS + RDS**

- The "proper" AWS answer: Fargate task with an EFS mount for uploads, RDS Postgres, ALB for WebSockets.
- Cost floor ~$60–90/mo (Fargate ~$15, ALB ~$18, RDS t4g.micro ~$13, EFS + NAT + data). Setup 2–3 days with Terraform or CDK.
- Fits every requirement, scales horizontally (EFS is shared, unlike volumes elsewhere).
- Verdict: **Over-built for one exam per company.** Choose only if the client mandates AWS or plans many tenants.

---

### 2.7 Google Cloud Run

| Item | Price |
|---|---|
| Request-based | $0.000024/vCPU-s, first 180k vCPU-s free/mo |
| Always-on instance (min instances = 1) | ~$15–20/mo for 1 vCPU / 512 MB |
| Cloud SQL Postgres (db-f1-micro) | ~$10/mo |
| Cloud Storage | $0.02/GB-mo |

- Dockerfile native. WebSockets supported (**60-min request timeout max**, must set `min-instances=1` and session affinity).
- **No persistent disk**; in-memory filesystem counts against RAM. A 200 MB upload buffered by multer to `/tmp` eats the container. Needs §6 with direct-to-GCS uploads.
- SMTP: port 587 open, 25 blocked.
- Verdict: **Only after §6, and only if the client is on GCP.** Otherwise more moving parts than Railway for no gain.

---

### 2.8 Vercel / Netlify

- Serverless functions, 10–60 s execution cap, no WebSockets on the function runtime, no disk, 4.5 MB body limit on Vercel functions.
- Fails R1, R2, R3, R5. The frontend `dist/` alone could be hosted here, but that reintroduces CORS and a second deploy for nothing.
- Verdict: **Not viable** without rewriting the backend into functions + a third-party WebSocket service (Pusher/Ably) + object storage. Do not.

---

### 2.9 Heroku

| Plan | Price |
|---|---|
| Eco | $5/mo for 1000 dyno-hours shared, sleeps |
| Basic | $7/mo, always on, 512 MB |
| Standard-1X | $25/mo, 512 MB, metrics |
| Postgres Essential-0 | $5/mo, 1 GB |

- Docker deploys supported via `heroku.yml`. WebSockets supported.
- **Ephemeral filesystem** — every dyno restart (at least daily) wipes `uploads/`. R3 fails hard. Needs §6.
- Verdict: **Not without §6.** Even then, Railway/Render give the same for less.

---

### 2.10 Azure App Service (for completeness)

- Basic B1 ~$13/mo, Linux container support, WebSockets on, persistent `/home` storage (250 GB on Basic) that **does** survive restarts.
- Fits R1–R6 as-is, but the persistent storage is SMB-backed and slow for a 200 MB write; SQLite on SMB is a known corruption risk.
- Verdict: **Viable if the client is a Microsoft shop** (and they use Office 365 SMTP already, which this app supports). Move the DB to Azure Database for PostgreSQL Flexible (~$13/mo burstable) first.

---

## 3. Side-by-side

Legend: ✅ works as-is · ⚠️ works with a caveat · ❌ needs the §6 migration · ✖ not viable.

| Platform | R1 process | R2 WS | R3 disk | R4 Docker | R5 200 MB | R6 SMTP | R7 low ops | Floor cost | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Railway** | ✅ | ✅ | ✅ volume | ✅ | ⚠️ untested at edge | ✅ | ✅ | ~$5–10 | **Use now** |
| **Render** | ✅ | ✅ | ✅ disk, snapshots | ✅ | ✅ | ✅ | ✅ | $7 + disk | Second choice |
| **Fly.io** | ✅ | ✅ | ✅ volume, snapshots | ✅ | ✅ | ✅ | ⚠️ CLI | ~$6–12 | Best value, CLI |
| DO App Platform | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ 587 only | ✅ | ~$32 after §6 | After §6 |
| DO Droplet | ✅ | ✅ | ✅ SSD | ✅ compose | ✅ | ✅ | ❌ self-managed | $6 | Client-owned server |
| Hetzner | ✅ | ✅ | ✅ SSD | ✅ compose | ✅ | ⚠️ ticket to unblock | ❌ | ~€4 | Cheapest self-managed |
| AWS Lightsail VM | ✅ | ✅ | ✅ | ✅ compose | ✅ | ⚠️ use SES | ❌ | $7 | AWS-mandated, small |
| AWS App Runner | ✅ | ✖ | ❌ | ✅ | ⚠️ | ⚠️ | ✅ | ~$30 | **Not viable** |
| AWS ECS+EFS+RDS | ✅ | ✅ | ✅ shared | ✅ | ✅ | ⚠️ SES | ❌ heavy | ~$70+ | Enterprise mandate only |
| GCP Cloud Run | ✅ min=1 | ⚠️ 60-min cap | ❌ | ✅ | ❌ | ⚠️ | ⚠️ | ~$25 after §6 | GCP shops, after §6 |
| Vercel / Netlify | ✖ | ✖ | ✖ | ✖ | ✖ | – | – | – | **Not viable** |
| Heroku | ✅ | ✅ | ❌ ephemeral | ✅ | ✅ | ✅ | ✅ | $7 + $5 | After §6, no advantage |
| Azure App Service | ✅ | ✅ | ⚠️ SMB, no SQLite | ✅ | ✅ | ✅ | ✅ | ~$13 + $13 | Microsoft shops |

---

## 4. Decision guide

Pick the first row that matches.

| Situation | Choose | Why |
|---|---|---|
| Ship this week, one company, < 200 exams/month | **Railway** (as configured) | Zero changes, per-minute billing, volumes |
| Need automatic disk/DB snapshots without extra work | **Fly.io** or **Render** | Both snapshot volumes; Railway does not |
| Client insists on their own server / data residency | **Hetzner** (EU) or **DO Droplet** (regions incl. Bangalore, Singapore) with `docker compose` | Nothing in the code changes |
| Client is on AWS / GCP / Azure by policy | Do §6 first, then Lightsail VM / Cloud Run / App Service | Their managed disk story is weak or absent |
| Expect multiple tenants, > 1000 exams/month, or two app instances | Do §6, then any PaaS with managed Postgres; ECS+EFS if on AWS | Single-attach volumes cap you at one instance |
| Client wants "free" | There is no free tier that keeps recordings. Say so. | Render/Fly free tiers sleep or lack disks |

---

## 5. Cost model for one deployment (12 months)

Assumptions: 100 exams/month, 40 MB average recording, admins watch
20% of them, 10 GB retained after pruning.

| Platform | Compute | Storage | DB | Egress | Year |
|---|---|---|---|---|---|
| Railway Hobby | ~$5 | 10 GB × $0.15 = $1.5 | SQLite on volume | ~$0.50 | **~$85** |
| Render Starter + 10 GB disk | $7 | $2.50 | SQLite on disk | included | **~$115** |
| Fly shared-1x 1 GB + 10 GB vol | ~$6 | $1.50 | SQLite on volume | free tier | **~$90** |
| Hetzner CX22 | ~€4 | included | SQLite | included | **~€50** + your hours |
| DO App Platform after §6 | $12 | Spaces $5 | Postgres $15 | included | **~$385** |
| AWS ECS+EFS+RDS | ~$35 | ~$5 | ~$13 | ~$18 ALB + egress | **~$850+** |

The gap between the top three and the cloud-native options is entirely
the managed Postgres and load balancer line items. Do not pay them until
SQLite or single-instance actually becomes the problem.

---

## 6. The migration that unlocks every platform

Two changes make the app stateless and therefore portable, scalable,
and safe on hosts with no disk. Neither is required for Railway today.

### 6.1 Recordings and snapshots → S3-compatible object storage

- Options: Cloudflare R2 (no egress fees, $0.015/GB-mo), AWS S3, DO
  Spaces, Backblaze B2 ($0.006/GB-mo). R2 is the default recommendation
  because admins stream videos back and egress is the hidden cost.
- Code: replace multer `diskStorage` in `proctorRoutes.ts` with
  `multer-s3` (or, better, have the browser upload directly to a
  pre-signed URL so the 200 MB never passes through Node). Store the
  object key in `videoFilename`. Serve playback via a short-lived signed
  URL instead of `express.static`.
- Effort: one day. Removes R3 and R5 from the platform equation.

### 6.2 SQLite → managed Postgres

- `schema.prisma`: `provider = "postgresql"`, `DATABASE_URL` from the host.
  `Question.options` and `ExamAttempt.answers` can stay `String`; migrate
  to `Json` later if wanted.
- Switch from `prisma db push` on boot to `prisma migrate deploy` with a
  committed `prisma/migrations/` (ADR 007 names this as the trigger).
- Effort: half a day plus a one-off data copy.

After both: any platform in §3 marked ❌ becomes ✅, two instances behind
a load balancer become possible, and backups are the DB vendor's job.

---

## 7. Checklist before going live on any platform

1. Full 30-minute recording uploads and plays back **through the host's proxy**, not just localhost.
2. `JWT_SECRET` set and not the fallback; `admin/admin123` changed.
3. Volume / disk mounted at the path `index.ts` resolves (`/app/backend/uploads`), confirmed by uploading, redeploying, and playing.
4. SMTP test button delivers to the real supervisor mailbox.
5. `GET /api/health` returns `frontendServed: true`.
6. TODO Phase 8 §Security item 1 (auth on read endpoints) is done — public results on a public URL is the one thing no platform choice fixes.
