# Workplace Assessment & Examination Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.app/)

An enterprise-grade, web-based examination and proctoring platform engineered to evaluate workplace and industrial competency before granting site or operational access. Features real-time webcam recording, multi-attempt tracking with 48-hour retest lockouts, automated SMTP supervisor alerts, and dynamic administrative exam orchestration.

---

## Table of Contents

- [Key Features](#key-features)
  - [Examinee Experience & Assessment Flow](#examinee-experience--assessment-flow)
  - [Anti-Cheating & Proctoring Engine](#anti-cheating--proctoring-engine)
  - [48-Hour Cooldown & Multi-Attempt Enforcement](#48-hour-cooldown--multi-attempt-enforcement)
  - [Administrative Command Center (`/admin`)](#administrative-command-center-admin)
  - [Automated Email Notification System](#automated-email-notification-system)
- [System Architecture](#system-architecture)
- [Directory Structure](#directory-structure)
- [Technology Stack](#technology-stack)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Production Deployment (Railway)](#production-deployment-railway)
- [Database Schema & Persistence](#database-schema--persistence)
- [License](#license)

---

## Key Features

### Examinee Experience & Assessment Flow
- **Streamlined Candidate Registration**: Capture full name, company employee ID, and corporate email.
- **Categorized Question Modules**:
  - **Part A — Interface Management**: Evaluates cross-functional communication, operational protocols, and interface matrices.
  - **Part B — Stakeholder Management**: Evaluates client communications, escalation pathways, and stakeholder expectations.
- **Dynamic Examination Settings**: Timers, passing marks, and question banks update in real time based on supervisor configuration.
- **Seamless Navigation**: Answer tracking, flagged questions, responsive question grid, and auto-submission upon timer expiration.
- **Instant Result Breakdown**: Displays overall score percentage, section-by-section analysis (Part A vs. Part B), pass/fail certification status, and attempt sequence.

### Anti-Cheating & Proctoring Engine
- **Continuous Camera Proctoring**: Live webcam stream with automatic snapshot capture on submission.
- **Webcam Video Archiving**: Records the entire examination session and securely streams or uploads it to backend storage for supervisor verification.
- **Tab & Window Focus Auditing**: Real-time tracking of blur/focus events and tab switches. Warnings are logged and displayed directly on the admin report.
- **Hardware Lifecycle Management**: Guarantees that camera and audio streams are immediately released and powered off when the exam terminates or closes.

### 48-Hour Cooldown & Multi-Attempt Enforcement
- **Algorithmic Retest Lockout**: Examinees who have completed an assessment cannot re-attempt the exam within 48 hours of completion.
- **Compound Identity Verification**: Checks both email and company ID against local storage and the database to prevent duplicate registration circumvention.
- **Dynamic Lockout Countdown**: Informs blocked candidates of the exact hours remaining and the exact date/time their retest window opens.
- **Supervisor Retest Override**: Administrators can clear the 48-hour lockout with one click for authorized re-examinations.

### Administrative Command Center (`/admin`)
- **Live Proctoring & Candidate Oversight**: Monitor ongoing assessments via WebSockets (`socket.io`).
- **Comprehensive Candidate Timeline**:
  - Search by Name, Company ID, or Email.
  - View full chronological attempt history (`Attempt #1`, `🔁 Attempt #2`, etc.).
  - Inspect individual answer sheets question-by-question with candidate vs. correct answer comparisons.
  - Stream archived proctor webcam videos directly inside the dashboard.
- **Live Question Bank Management**:
  - Add, edit, or delete questions on the fly.
  - Filter by section (Part A / Part B).
  - Changes instantly propagate to new candidate sessions without server restarts.
- **Global Assessment Configuration**:
  - Modify passing percentage threshold (e.g. from 70% to 60%) anytime.
  - Adjust exam duration minutes and exam title.
  - Updates immediately reflect on the candidate's exam screen and results certificate.
- **Audit Reporting & Export**: 1-click export of all candidate records, scores, timestamps, and integrity logs to Excel / CSV format.

### Automated Email Notification System
- **Real-Time SMTP Alerting**: Automatically dispatches a rich HTML notification to management whenever an assessment is finalized.
- **Re-Attempt Highlighting**: Re-test submissions automatically include `[RE-ATTEMPT #X]` in the subject line and an amber alert banner highlighting previous attempts.
- **Full Metric Delivery**: Includes candidate credentials, overall score, percentage, passing verdict, duration, and proctoring integrity flags.

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (Candidate Portal  /  Admin Command Center: /admin)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST / WebSockets
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified Express Production Server              │
│  - Static SPA Host (/dist)                                  │
│  - REST API Routes (/api/candidates, /api/exam, etc.)       │
│  - WebSocket Server (socket.io real-time proctoring)        │
│  - Video Upload & Streaming Service                         │
│  - SMTP Email Dispatcher (nodemailer)                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Relational Database Engine                 │
│                 (SQLite / PostgreSQL / MySQL)               │
│  - Candidate Profiles & Last Attempt Timestamps             │
│  - Attempt Sequence Records & Answer Audits                 │
│  - Dynamic Question Bank & Admin Configurations             │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```text
exam-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Relational database models
│   │   └── seed.ts                # Initial questions & default admin seed
│   ├── src/
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts     # Admin auth & dashboard operations
│   │   │   ├── candidateRoutes.ts # Cooldown checks & candidate registration
│   │   │   ├── examRoutes.ts      # Exam submissions, scoring, results
│   │   │   └── questionRoutes.ts  # Live Question Bank CRUD operations
│   │   ├── services/
│   │   │   └── emailService.ts    # SMTP delivery with re-attempt highlights
│   │   └── index.ts               # Express & WebSocket entrypoint
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.tsx # Comprehensive admin management portal
│   │   │   ├── Exam.tsx           # Interactive 40-question proctored exam
│   │   │   ├── ExamRegistration.tsx# Registration & 48-hour cooldown lockout
│   │   │   └── ExamResults.tsx    # Detailed score certificate & retest policy
│   │   ├── services/
│   │   │   ├── api.ts             # REST client with offline fallback
│   │   │   ├── camera.ts          # Camera hardware lifecycle manager
│   │   │   ├── socket.ts          # WebSocket client for real-time sync
│   │   │   ├── storage.ts         # Local synchronization & state schemas
│   │   │   └── videoStorage.ts    # IndexedDB & video chunk manager
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                     # Multi-stage production container build
├── railway.json                   # Railway deployment configuration
├── docker-compose.yml             # Local multi-container orchestration
└── README.md
```

---

## Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Modern CSS3 Responsive Design System (Custom variables, glassmorphic cards, accessible contrast)
- **Media & Hardware**: HTML5 MediaStream Recording API, Canvas API, IndexedDB

### Backend
- **Runtime**: Node.js 18+ / Express
- **Language**: TypeScript
- **ORM**: Prisma ORM (v5)
- **Database**: SQLite (default zero-config) / PostgreSQL (production-ready)
- **Real-Time Communication**: Socket.io
- **Security**: JSON Web Tokens (JWT), bcrypt password hashing, CORS whitelist
- **Email Service**: Nodemailer (SMTP / Gmail App Passwords)

---

## Environment Variables

Configure environment variables in `backend/.env` for local development or within your cloud provider dashboard for production:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Security & Authentication
# Generate a private value -- never reuse one printed in documentation:
#   openssl rand -base64 48
# In production the server refuses to boot if JWT_SECRET is a value that has
# appeared in this repository, or is shorter than 32 characters.
JWT_SECRET=

# Password for the two admin accounts created on an empty database.
# Required in production, minimum 12 characters. Change it in the admin
# portal (Settings -> Change password) after the first login.
ADMIN_INITIAL_PASSWORD=

# Database Connection
DATABASE_URL="file:./dev.db"

# SMTP Alert Delivery
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
ADMIN_ALERT_EMAIL=supervisor_recipient@gmail.com
```

> **Never commit real values for `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD` or
> `SMTP_PASS`.** A secret printed in a README is public: anyone who reads it
> can forge an admin token against any deployment using it.

---

## Local Development Setup

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher

### 1. Clone the Repository
```bash
git clone https://github.com/Youssef22Ashraf/exam-sys.git
cd exam-sys
```

### 2. Configure Backend & Database
```bash
cd backend
npm install

# Initialize Prisma SQLite Database & Seed Data
npx prisma db push
npm run seed

# Start Backend Dev Server
npm run dev
```
Backend will start on `http://localhost:5000`.

### 3. Configure Frontend
Open a separate terminal:
```bash
cd frontend
npm install

# Start Frontend Dev Server
npm run dev
```
Frontend will be accessible at `http://localhost:5173`.

---

## Production Deployment (Railway)

The platform includes a root multi-stage [`Dockerfile`](Dockerfile) and [`railway.json`](railway.json) that compiles the React frontend into static assets, packages the Express backend, and serves both from a unified port.

### 1. Push to GitHub
```bash
git push origin main
```

### 2. Deploy on Railway
1. Navigate to [Railway.app](https://railway.app) and sign in with GitHub.
2. Click **+ New Project** → **Deploy from GitHub repo**.
3. Select `Youssef22Ashraf/exam-sys`.
4. Railway will automatically detect the `Dockerfile` and initiate the container build.

### 3. Configure Environment Variables
In your Railway Service dashboard, open the **Variables** tab and set:
- `PORT` = `5000`
- `NODE_ENV` = `production`
- `JWT_SECRET` = `[your-random-secret-key]`
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER` = `[your-smtp-email]`
- `SMTP_PASS` = `[your-smtp-app-password]`
- `ADMIN_ALERT_EMAIL` = `[supervisor-email]`

### 4. Attach Persistent Volumes (REQUIRED — both of them)

The container filesystem is replaced on every deploy. **Two** volumes are
needed, and neither is optional: without them a redeploy destroys every
candidate, result and webcam recording, silently and irreversibly.

1. In your service view on Railway, click the **Volumes** tab.
2. Add a volume with **Mount Path** `/app/backend/uploads`
   — the webcam recordings and identity snapshots.
3. Add a second volume with **Mount Path** `/app/backend/prisma`
   — the SQLite database file.

> The database path is **not** `/app/backend/dev.db`. Prisma resolves the
> relative `DATABASE_URL` (`file:./dev.db`) against the directory holding
> `schema.prisma`, so the file lives at `/app/backend/prisma/dev.db`.
> `docker-compose.yml` uses different paths (`/app/prisma`, `/app/uploads`)
> because `backend/Dockerfile` sets a different `WORKDIR` — do not copy the
> compose paths into Railway.

On boot the server logs the absolute paths it resolved:

```
Database:  /app/backend/prisma/dev.db
Uploads:   /app/backend/uploads
```

Check those against your mount paths in the deploy log. **Then verify
persistence for real**: create a candidate, redeploy, and confirm the record
and its recording survived. This has never been confirmed on a live
deployment (see `tech_readme_files/CURRENT_STATUS.md`).

Note also that `CMD` runs `prisma db push` on every boot. That reconciles the
live database to the schema without migrations, so a removed or renamed column
drops its data with no prompt (ADR 007).

### 5. Generate Domain
1. In **Settings** → **Networking**, click **Generate Domain**.
2. Railway provides an instant SSL-secured URL (e.g., `https://exam-sys-production.up.railway.app`).

---

## Database Schema & Persistence

The Prisma schema defines 5 core models:
- **`Question`**: Dynamic assessment questions, choices, categories, and correct indices.
- **`ExamSetting`**: Global parameters (passing score %, duration minutes, sectors).
- **`Candidate`**: Identity attributes, completion count, and `lastAttemptAt` for cooldown tracking.
- **`ExamAttempt`**: Full audit submissions with `attemptNumber`, score, proctoring warnings, answers JSON, and video references.
- **`AdminUser`**: Secure hashed credentials for administrative operations.

---

## Accessing the Platform

- **Examinee Portal**: Share root domain (e.g., `https://your-domain.up.railway.app/`) with candidates.
- **Admin Command Portal**: Access via `/admin` (e.g., `https://your-domain.up.railway.app/admin`).
  - Two accounts are created on an empty database: `mofarreh.admin`
    (SUPERADMIN) and `admin` (ADMIN), both with the password you set in
    `ADMIN_INITIAL_PASSWORD`. There is no default password in the code.
  - **Change it after the first login** via Settings -> Change password.
  - SUPERADMIN is required to reset the question bank or delete a candidate
    or a result.

---

## License

This project is proprietary and confidential. Designed for workplace competency certification and assessment operations.