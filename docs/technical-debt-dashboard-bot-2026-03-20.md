# Technical Debt Report: dashboard + bot

Date: 2026-03-20

## Summary

The current technical debt is not isolated to one feature or package. It is spread across:

- `dashboard` API routes and shared moderation/stats helpers
- `bot` service layer and dashboard API bridge
- generated artifacts and repo hygiene
- missing regression tests

This debt is already visible in three ways:

- `dashboard` production build passes, but full lint still reports a large backlog of legacy issues outside the current work area.
- `bot` lint is now runnable, but the repo still contains many warnings and several quality escapes.
- there are no meaningful test files in either package, so the codebase has very little protection against regressions.

The practical conclusion is simple: the highest-risk debt is correctness and security debt in API paths, followed by shared semantics debt in stats, then repository hygiene.

## What I Checked

- repository manifests and scripts in `dashboard/package.json` and `bot/package.json`
- current lint/build behavior in both packages
- `src`-level scans for `@ts-ignore`, `@ts-expect-error`, and `any`
- presence of test files in both packages
- representative hot spots in API routes and shared utilities

## Findings

### 1. `dashboard` has a large legacy lint backlog outside the current feature area

The `dashboard` build passes, but a full lint run still produces thousands of problems. The important part is not the exact number; it is the shape of the debt:

- API routes still contain `@ts-ignore` and implicit `any` usage
- several stats routes do heavy in-memory processing instead of pushing work into the database
- some routes lack consistent guild-level authorization
- generated Prisma artifacts are present inside `src/generated`, which pollutes lint and code search

Representative examples:

- [dashboard/src/app/api/guilds/[guildId]/tickets/route.ts](D:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/tickets/route.ts)
- [dashboard/src/lib/discord-api.ts](D:/discord_bot/Dev/dashboard/src/lib/discord-api.ts)
- [dashboard/src/app/api/guilds/[guildId]/stats/route.ts](D:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/route.ts)
- [dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts](D:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts)
- [dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts](D:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts)

### 2. `bot` has a smaller but still real maintenance backlog

`bot` lint now runs because a minimal ESLint config was added, but the repo still has a substantial warning surface:

- many `any`-typed utilities in command and service code
- empty catch blocks and low-value fallback logic
- generated client artifacts under `src/generated`
- a few `prefer-const`, `no-empty`, and whitespace issues

Representative examples:

- [bot/src/utils/dashboardApi.ts](D:/discord_bot/Dev/bot/src/utils/dashboardApi.ts)
- [bot/src/index.ts](D:/discord_bot/Dev/bot/src/index.ts)
- [bot/src/services/AiModerationService.ts](D:/discord_bot/Dev/bot/src/services/AiModerationService.ts)
- [bot/src/services/RollupService.ts](D:/discord_bot/Dev/bot/src/services/RollupService.ts)
- [bot/src/utils/helpMenu.ts](D:/discord_bot/Dev/bot/src/utils/helpMenu.ts)

### 3. The repo has almost no regression coverage

I did not find a meaningful set of test files in either package.

That matters because the current debt sits exactly in places where regressions are easiest to ship:

- API payload normalization
- moderation config serialization
- stats aggregation semantics
- access-control checks
- localization and formatting behavior

### 4. Stats debt is a correctness problem, not just a performance problem

The stats module has mixed time models and mixed execution paths:

- UTC aggregation in bot write paths
- timezone-aware recalculation in dashboard sync
- raw scans for some list/drilldown pages
- different voice semantics across routes

The result is that the same guild and the same period can produce inconsistent answers depending on which endpoint last touched the data.

This is the kind of debt that becomes invisible in UI, because charts still render while correctness slowly drifts.

### 5. Some routes are still underprotected

Parts of the dashboard API do auth checks, but not all stats and write routes use the same access model.

That creates a real security and data-leak risk:

- read endpoints may expose guild data without the same gate as the UI
- write endpoints may be callable outside the intended dashboard flow

## Debt Map

### High priority

- implicit `any` and `@ts-ignore` in API routes
- inconsistent auth/access checks across dashboard routes
- mixed timezone semantics in stats
- missing tests for moderation/config and stats payload handling

### Medium priority

- generated artifacts inside `src/generated`
- empty catch blocks and weak error normalization
- heavy raw scans in `users`, `channels`, and `contacts`

### Lower priority

- locale and formatting cleanup
- remaining warning-level lint issues in `bot`
- visual/UX cleanup that is not correctness-affecting

## Recommended Backlog

### P0: Correctness and security

1. Normalize auth/access checks across all dashboard API routes.
2. Remove `@ts-ignore` and implicit `any` from the moderation, tickets, and stats endpoints that sit on hot paths.
3. Pick one canonical time model for stats and migrate the write/read paths to it.
4. Add regression tests for moderation config serialization and stats payload shape.

### P1: Shared semantics and performance

5. Replace full raw scans in `users` and `channels` with targeted aggregate queries.
6. Rework `contacts` so it no longer depends on quadratic pairwise overlap checks for large voice datasets.
7. Consolidate shared period/window logic into one server-side helper.

### P2: Hygiene and maintainability

8. Move generated client output out of `src/` or exclude it cleanly from lint/search.
9. Clean up warning-level debt in `bot` command and service utilities.
10. Fix locale/formatting source-of-truth issues after the correctness layer is stable.

## Verification Gates

After each large debt item is fixed, the acceptance check should be:

- `dashboard build`
- `bot build`
- targeted `eslint` on the touched files
- smoke checks for the affected API endpoint or page
- a regression test when the change affects payload shape, authorization, or time bucketing

## Notes and Assumptions

- This doc focuses on current code debt in `dashboard` and `bot`, not on the stats PostgreSQL migration runbook.
- The repository should be treated as a mixed-quality codebase: some debt is deliberate legacy, but correctness/security debt should not be left in place.
- Generated artifacts are considered technical debt when they live inside the app source tree and get caught in lint or search noise.
