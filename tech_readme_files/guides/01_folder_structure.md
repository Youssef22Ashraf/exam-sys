> [INDEX](../INDEX.md) > Guides > Folder structure

# 01 — Folder structure

```
exam-sys/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        5 models — the data contract
│   │   ├── seed.ts              40 questions + admin/admin123 + default ExamSetting
│   │   └── dev.db               gitignored SQLite (created by `prisma db push`)
│   ├── src/
│   │   ├── index.ts             Express app, Socket.io, static SPA, /api mounts, error handler
│   │   ├── config/
│   │   │   ├── db.ts            the single PrismaClient
│   │   ├── env.ts           JWT_SECRET (prod boot guard) and CORS_ORIGIN parsing
│   │   │   └── defaultQuestions.ts   bank used by POST /api/questions/reset
│   │   ├── middleware/auth.ts   authenticateAdmin (Bearer JWT)
│   │   ├── routes/              authRoutes · candidateRoutes · questionRoutes · examRoutes · proctorRoutes · settingRoutes
│   │   └── services/emailService.ts
│   ├── uploads/{videos,snapshots}/   gitignored, mounted as a volume in prod
│   ├── .env.example
│   ├── Dockerfile               backend-only image (docker-compose)
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx · App.tsx   entry + page state machine
│   │   ├── pages/               ExamRegistration · ExamInstructions · Exam · ExamResults · AdminLogin · AdminDashboard (+ .css each)
│   │   ├── components/CameraProctor.tsx
│   │   ├── services/            api · storage · socket · camera · videoStorage
│   │   ├── assets/
│   │   └── styles.css · index.css · App.css
│   ├── vite.config.ts · eslint.config.js · tsconfig*.json
│   └── Dockerfile               nginx SPA image (docker-compose)
├── tech_readme_files/           all docs (this tree)
├── ref-for ui/                  client screenshots — read-only
├── interface questions.txt      client source for Part A
├── stakeholder questions.txt    client source for Part B
├── Dockerfile · railway.json · docker-compose.yml
├── package.json                 root build/start scripts
├── AGENTS.md · CLAUDE.md · README.md · CHANGELOG.md
├── .agents/ · .claude/ · .codex/ · .cursor/   agent configs
```

## Where a change goes

| I want to… | Touch |
|---|---|
| Add an endpoint | `backend/src/routes/<x>Routes.ts` + `frontend/src/services/api.ts` — [03](03_how_to_add_new_api.md) |
| Add a screen | `frontend/src/pages/` + `App.tsx` switch — [04](04_how_to_add_new_page.md) |
| Change a question | three files — [05](05_how_to_change_questions.md) |
| Add a DB column | `schema.prisma` → `prisma db push` → routes → `storage.ts` types |
| Change colours | `frontend/src/styles.css` CSS variables |
