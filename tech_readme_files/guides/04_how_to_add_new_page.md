> [INDEX](../INDEX.md) > Guides > Add a new page

# 04 — How to add a new page

There is no router ([ADR 002](../decisions/002-no-router-no-state-library.md)).

1. Create `frontend/src/pages/NewPage.tsx` + `NewPage.css`. Props in, callbacks out; no page reads `window.location` except `App.tsx`.
2. In `App.tsx`, add a `page` value and a branch in the render switch. Pass the `setPage` transition as a named callback (`onDone`, `onBack`).
3. If the page is reachable during the exam, call `releaseCamera()` on every path that leaves it.
4. Read settings/questions via `ExamStorage`, never fetch directly from a page — `App.tsx` already hydrates on mount.
5. Colours and spacing from the CSS variables in `styles.css`; no new inline hex.
6. If it's an admin-only page, gate on `sessionStorage.adminToken` in `App.tsx` the way `admin-dashboard` is.

When a third top-level area with its own URL appears, that's the trigger to add a router — do not add one for a single page.
