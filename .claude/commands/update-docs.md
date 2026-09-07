# Update docs

After a code change, bring the docs level with it:

1. `CHANGELOG.md` → Unreleased: Added / Changed / Fixed line.
2. `tech_readme_files/TODO.md` → tick the box or add one under the right phase.
3. Endpoint added/changed → `tech_readme_files/plan.md` §4 table + the `features/*.md` it belongs to.
4. New design choice → `tech_readme_files/decisions/NNN-title.md` + README row.
5. Verification changed (something now proven or newly unproven) → `tech_readme_files/CURRENT_STATUS.md`.
6. New gotcha → `reference/COMMON_PITFALLS.md` or `TROUBLESHOOTING.md`.

Do not rewrite `README.md` unless the deploy steps or env vars changed.
