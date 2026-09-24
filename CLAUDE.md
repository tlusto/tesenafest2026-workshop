# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API test suite (no browser) for the Todoist API v1, run against **production** with a free account. `brief.md` is the project's requirements document and `Test Cases for automation.md` lists the test cases (TC-001 to TC-015, in waves). `docs/test-architecture-plan.md` maps each test case to its spec file and tag. Read those before adding tests.

## Commands

Node.js 24 (`.nvmrc`). `npm ci` also installs the husky git hooks.

```sh
npm run lint            # ESLint, type-checked rules + eslint-plugin-playwright on tests/
npm run format:check    # Prettier (npm run format to fix)
npm run typecheck       # tsc --noEmit, strict
npm test                # all tests (runs the global setup first)
npm run test:smoke      # tests tagged @smoke

npx playwright test --grep @TC-002               # one test case, by tag
npx playwright test tests/tasks/create-task.spec.ts
npx playwright test --list --grep @smoke         # check tagging without calling the API
```

Tests need `TODOIST_API_TOKEN` in `.env` (copy `.env.example`). `TEST_ENV` picks `config/<TEST_ENV>.ts` (default `prod`). A new environment is a new file in `config/` registered in `config/index.ts`, nothing more.

## Architecture

- **Clients (`src/clients/`)**: `BaseClient` wraps an `APIRequestContext` that already carries the base URL and `Authorization: Bearer` header (`createApiContext.ts`). There is no login. Typed methods throw `ApiError` on non-2xx. `send(method, path, options)` returns the raw response, for status-code assertions in negative tests. `listAll` follows the v1 `next_cursor` pagination. Resource clients are thin, with one method per endpoint. `createTodoistApi()` bundles them as `api.projects/tasks/labels/comments/user`.
- **Fixtures (`src/fixtures/`)**: specs import `test`, `expect` and `Schema` from `src/fixtures`, never from `@playwright/test`.
  - `api` is the authenticated client set.
  - `unauthenticatedApi` and `apiWithToken(token)` are for the auth tests (TC-014).
  - `testData.create*` builds a unique payload, creates it through the API and deletes it in fixture teardown. Teardown runs even when the test fails; deletion is in reverse order and ignores 404. Use `testData.track(kind, id)` for anything created another way, for example through `send`.
  - `account` and `accountTimezone` are worker-scoped.
- **Test data (`src/data/`)**: every name/content starts with `autotest-<run id>-` (`uniqueName(kind)`). The run id starts with a UTC timestamp and is fixed once in `playwright.config.ts`, so all workers share it. `src/global-setup.ts` uses that timestamp to delete `autotest-` projects, labels and Inbox tasks older than 1 hour. Content must _start_ with the prefix, or leftovers are never cleaned up.
- **Schema validation (`src/schemas/`)**: `openapi.json` is a pinned copy of the Todoist OpenAPI spec. Refresh it by hand with `node scripts/update-openapi.mts` and review the diff. `expect(body).toMatchSchema(Schema.task)` validates a body with Ajv against a component schema. Use the `Schema.*` aliases rather than generated names like `ItemSyncView`. `src/clients/types.ts` only types the fields the tests read.
- **Dates**: date assertions use the account timezone (`accountTimezone` + `src/utils/dates.ts`), never the runner's clock (TC-003, TC-009, TC-013).

## Token safety (public repo)

Playwright records request headers in traces and error messages, and has no option to hide them. Several layers keep the token out:

- `src/reporters/redact-reporter.ts` must stay the **first** reporter in `playwright.config.ts`. It is deliberately synchronous.
- `ApiError` and `RequestFailedError` redact messages and drop `cause`.
- The global setup redacts its own errors.
- CI runs `node scripts/check-no-token.mts` over `playwright-report/` and `test-results/` (zips included) before uploading any artifact. Run it locally after a failing run if you touch any of this.
- `no-console` is an ESLint error outside `scripts/`.

## Writing tests

- Name: `'TC-00X <name from the test case file>'`. Tags: `['@TC-00X', '@<suite>']`. The suites are `@smoke` (TC-001–005), `@regression` (TC-006–009, 012, 013), `@e2e` (TC-011) and `@negative` (TC-014, 015).
- Every step is a `test.step('<readable name>', ...)`. Keep a step synchronous when it only asserts, because `@typescript-eslint/require-await` rejects an `async` step with no `await`.
- One behavior per test. A multi-input case gets one test per input with a suffix: `TC-015a`, `TC-015b`, and so on.
- Assert against the value that was **sent**, not against the create response. The README example compares `task.content` with `created.content`, which passes even if the API mangles the text.
- Validate every successful response body with `toMatchSchema`.
- When the expected behavior is unclear (for example the status codes in TC-015), probe the real API first, assert what it actually does, and list it under "Assumptions" in the PR.
- If a feature isn't on the free plan, mark the test `test.fixme()` with the reason.
- Out of scope: sections, TC-010, and PRs from forks. Workflows must not use `pull_request_target`.
- Before committing a new test, break its key assertion once and confirm it fails, then check that no `autotest-` data is left behind.

## Git and GitHub workflow

- Every change goes issue → branch → PR. Branch names follow `<issue id>-<short-description>`.
- Commit messages must start with `#<issue id> ` (the `commit-msg` hook enforces it). `pre-commit` runs lint-staged (ESLint + Prettier). `pre-push` blocks pushes to `main`.
- This machine has no global git identity. Commit as `tlusto <93007555+tlusto@users.noreply.github.com>`, the noreply address used by the repo's history. Don't use a personal email, because the repo is public.
- Issues use the forms in `.github/ISSUE_TEMPLATE/`. `issue-priority.yml` turns the form's "Priority" answer into a `priority: P0–P3` label. `gh issue create --body-file` needs the form's `### Priority` heading followed by `P1 - ...` for that to work.
- The PR body follows `.github/pull_request_template.md`.
- Claude never merges PRs. After opening one, run a code review, fix the findings, then reply with the PR URL and a summary. Start the next issue only from the updated `main`.
- CI: `pr.yml` runs on every PR, and `smoke.yml` runs `@smoke` hourly on `main` and opens or comments on a `smoke-failure` issue. Both share the `todoist-account` concurrency group, since all runs use one account, and CI uses at most 2 workers and 1 retry.
