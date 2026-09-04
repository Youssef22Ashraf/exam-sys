# Exam System

A web-based examination platform for assessing employees/interns before they are granted access to a workplace or site.

## Current Status

- React + TypeScript + Vite frontend
- Examinee registration (name, email, company ID)
- Exam instructions page
- 40-question examination
- Two exam sections:
  - Part A — Interface Management (Questions 1–23)
  - Part B — Stakeholder Management (Questions 24–40)
- Multiple-choice and True/False questions
- Question navigation (Previous / Next)
- Answer selection and persistence while navigating
- Frontend countdown timer (30 minutes)
- Automatic submission when the timer reaches zero
- Basic score calculation on submission

## Planned Features

1. Backend API
2. SQLite database for exam attempts, users, answers, and results
3. Admin dashboard
4. Email notification when an exam starts
5. Email notification when an exam is completed
6. Excel export/reporting
7. Camera-based exam monitoring
8. Advanced proctoring features
9. Server-side timer and scoring validation
10. Production deployment with Docker/cloud infrastructure

## Project Structure

```text
exam-system/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Exam.tsx
│   │   │   └── ExamRegistration.tsx
│   │   ├── App.tsx
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
└── README.md
Tech Stack
React
TypeScript
Vite
Node.js / npm
Running the Frontend

From the project root:

cd frontend
npm install
npm run dev

Then open the local Vite URL shown in the terminal.

Normally:

http://localhost:5173/
Development Notes

The current timer and scoring are frontend prototypes.

For the production version, the backend will become the source of truth for:

Exam timing
Exam submissions
Scoring
Candidate information
Exam results
Project Goal

Build a reliable internal assessment system that can verify candidates before workplace/site access while providing administrators with exam results, notifications, reporting, and monitoring capabilities.