# Agent Instructions — Codex shim

Canonical conventions live in [`../AGENTS.md`](../AGENTS.md). Read it first. Tool-use rules in [`../CLAUDE.md`](../CLAUDE.md) apply to every agent, not only Claude.

## Scope
- Edit `backend/` and `frontend/` and docs under `tech_readme_files/`. Never edit `ref-for ui/` or the two `*questions.txt` files.

## Non-negotiables
1. Server-side scoring only. 2. Three-file question bank. 3. `releaseCamera()` on every exam exit. 4. `authenticateAdmin` on mutations. 5. Gate = `tsc` + `lint`; there are no tests. 6. No secrets, DBs, or uploads in commits.

## Where to look
| Need | File |
|---|---|
| Conventions, architecture, commands | [`../AGENTS.md`](../AGENTS.md) |
| Docs map | [`../tech_readme_files/INDEX.md`](../tech_readme_files/INDEX.md) |
| Open work | [`../tech_readme_files/TODO.md`](../tech_readme_files/TODO.md) |
| Pitfalls | [`../tech_readme_files/reference/COMMON_PITFALLS.md`](../tech_readme_files/reference/COMMON_PITFALLS.md) |
