# Edit questions

Three files, one commit — `tech_readme_files/guides/05_how_to_change_questions.md`.

1. Confirm wording against `interface questions.txt` / `stakeholder questions.txt`.
2. Edit the same `id` in `backend/prisma/seed.ts`, `backend/src/config/defaultQuestions.ts`, `frontend/src/services/storage.ts INITIAL_QUESTIONS`. `correctAnswer` is the index in the seed's `options` order.
3. `diff` the three entries to prove they match.
4. `CHANGELOG.md`: "Changed — question N". Gate.
