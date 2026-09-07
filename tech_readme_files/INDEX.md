# Documentation Index

> Entry point for humans and AI agents. Pick the task, follow the link.
> Everything under `tech_readme_files/`; root holds only `README.md`,
> `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`.

## I want to …

### … get started
- [reference/ONBOARDING.md](reference/ONBOARDING.md) — first commands, read order.
- [`../AGENTS.md`](../AGENTS.md) — conventions. [`../CLAUDE.md`](../CLAUDE.md) — tool rules.
- [CURRENT_STATUS.md](CURRENT_STATUS.md) — what is verified, what is not.

### … understand the system
- [plan.md](plan.md) — the spec: domain, API table, client decisions, DoD.
- [guides/02_architecture.md](guides/02_architecture.md) — request lifecycle, trust boundaries.
- [guides/01_folder_structure.md](guides/01_folder_structure.md).
- [decisions/](decisions/README.md) — why (7 ADRs).

### … understand one feature
- [features/README.md](features/README.md) — registration & lockout, exam, proctoring, results, admin, question bank & settings, email.

### … change something
- Endpoint: [guides/03_how_to_add_new_api.md](guides/03_how_to_add_new_api.md)
- Page: [guides/04_how_to_add_new_page.md](guides/04_how_to_add_new_page.md)
- Questions: [guides/05_how_to_change_questions.md](guides/05_how_to_change_questions.md)
- Env / secrets / auth: [guides/06_security_and_environment.md](guides/06_security_and_environment.md)

### … verify and ship
- [guides/07_testing.md](guides/07_testing.md) — gate + manual smoke (no automated tests yet).
- [guides/08_deployment.md](guides/08_deployment.md) — Railway, Docker, rollback.
- [guides/09_deployment_platforms.md](guides/09_deployment_platforms.md) — platform comparison: packages, fit, weaknesses, cost.
- [TODO.md](TODO.md) — Phase 8 hardening is the open work.

### … when stuck
- [reference/TROUBLESHOOTING.md](reference/TROUBLESHOOTING.md)
- [reference/COMMON_PITFALLS.md](reference/COMMON_PITFALLS.md)
- [reference/GLOSSARY.md](reference/GLOSSARY.md)

## Doc maintenance

`CHANGELOG.md` and `TODO.md` move with the code. `CURRENT_STATUS.md` is
re-derived from them. A new ADR goes in `decisions/` with the next number
and a row in its README. A new feature gets a `features/*.md` and a row
in that README.
