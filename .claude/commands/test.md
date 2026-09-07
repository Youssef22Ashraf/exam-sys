# Test

There is no automated suite. Run the gate and the manual smoke from `tech_readme_files/guides/07_testing.md`:

```bash
cd backend && npx tsc --noEmit
cd frontend && npm run lint && npx tsc -b
```

Report exactly which commands ran and their exit status. Do not say "tests pass". If asked to add tests, start with the three backend cases listed in that guide (scoring, 48 h boundary, auth middleware) using vitest + supertest.
