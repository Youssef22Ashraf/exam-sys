> [INDEX](../INDEX.md) > Guides > Change questions

# 05 — How to change the question bank

The bank exists in three files that must be identical:

| File | Used by |
|---|---|
| `backend/prisma/seed.ts` | `npm run seed` on a fresh DB |
| `backend/src/config/defaultQuestions.ts` | `POST /api/questions/reset` |
| `frontend/src/services/storage.ts` `INITIAL_QUESTIONS` | first load before the API responds, and the fallback path |

Wording source: `interface questions.txt` (Part A) and
`stakeholder questions.txt` (Part B) at repo root. The ✓ marks the
correct option. Note the seed reorders options relative to the txt in
places — `correctAnswer` is the index in the **seed's** `options` array,
not the letter in the txt.

## Steps

1. Edit the entry in all three files. Keep `id`, `section`,
   `sectionTitle` identical; `options` is a `JSON.stringify`'d array in
   the two backend files and a plain array in `storage.ts`.
2. Reset a running DB: admin → exams tab → Reset, or
   `POST /api/questions/reset` with a token, or drop `dev.db` and re-seed.
3. `CHANGELOG.md` Unreleased: "Changed — question N wording".
4. Gate: both `tsc`.

## Adding a question

Next `id` = 41. Section A or B. Candidates see it on next app load. The
CSV export and answer sheet key on `id`, so never reuse a deleted id.
