# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API test framework (no browser) for the Todoist API v1, run against production with a free account. `brief.md` holds the project requirements, `Test Cases for automation.md` the test cases, and `docs/test-architecture-plan.md` the architecture and delivery plan. Read `brief.md` before starting new work.

## Commands

Node 24 (`.nvmrc`). `npm ci` also installs the husky hooks. Tests need `TODOIST_API_TOKEN` in `.env` (copy `.env.example`).

```sh
npm run lint            # ESLint (strictTypeChecked + eslint-plugin-playwright), lint:fix to fix
npm run format:check    # Prettier, format to fix
npm run typecheck       # tsc --noEmit
npm test                # all tests
npm run test:smoke      # --grep @smoke
npx playwright test tests/labels/labels.spec.ts   # one file
npx playwright test --grep @TC-004                # one test case by tag
node scripts/check-no-token.mts                   # token leak check over playwright-report/ and test-results/
node scripts/update-openapi.mts                   # refresh the pinned spec by hand, review the diff
```

`TEST_ENV` selects `config/<env>.ts` (default `prod`, the only one). A new environment is a new file registered in `config/index.ts`.

## Architecture

- **Clients** (`src/clients/`): one class per resource on top of `BaseClient`. The `APIRequestContext` already carries the base URL and the Bearer token (`createApiContext`), so paths are relative (`tasks/123`). Typed methods throw `ApiError` on non-2xx; `send(method, path, options)` returns the raw `APIResponse` for status code assertions. `listAll` follows `next_cursor` pagination. `createTodoistApi(request)` bundles all clients into `TodoistApi`.
- **Fixtures** (`src/fixtures/`): specs import `test`, `expect` and `Schema` only from `src/fixtures`. Fixtures: `api`, `apiRequest`, `unauthenticatedApi`, `apiWithToken(token)`, `testData`, and worker-scoped `account` / `accountTimezone`. Request contexts are built from `playwright.request` so calls land in the trace.
- **Test data** (`src/data/`): builders produce names `autotest-<run id>-<kind>-<hex>`. The run id starts with a UTC timestamp and is fixed in `playwright.config.ts` via the `AUTOTEST_RUN_ID` env var so all workers share it. `testData.create*` tracks what it creates and deletes it in reverse order after the test (404 ignored); use `testData.track(kind, id)` for things created via `send`. `src/global-setup.ts` deletes `autotest-` projects, labels and Inbox tasks older than 1 hour, judged by the timestamp in the name.
- **Schemas** (`src/schemas/`): `openapi.json` is a pinned copy of the Todoist spec. `expect(body).toMatchSchema(Schema.task)` validates against a component schema with Ajv 2020. Use the `Schema` map instead of the generated component names; add entries there for new resources.
- **Dates**: assert dates in `accountTimezone` with `src/utils/dates.ts`, never the runner's clock.

## Security (public repo)

- The token must never reach logs or artifacts. `src/reporters/redact-reporter.ts` must stay the **first** reporter in `playwright.config.ts`; it redacts the token before the HTML report is built. Traces are kept only on failure.
- ESLint forbids `console` outside `scripts/`. `ApiError` messages never include headers. Do not print config, headers or the token.

## Writing tests

- Name `TC-XXX <name from the test case file>`, tags `['@TC-XXX', '@<suite>']`. Suites: `@smoke` TC-001 to 005, `@regression` TC-006 to 009 and TC-012/013, `@e2e` TC-011, `@negative` TC-014/015. TC-010 and sections are out of scope.
- Every step in `test.step()`. One behavior per test; multi-input cases get suffixes (`TC-015a`, `TC-015b`).
- Validate response bodies with `toMatchSchema`. When the spec does not define the expected result, probe the real API, assert what it does, and list it as an assumption in the PR description.
- Features not on the free plan: `test.fixme()` with the reason.
- Tests create their own data, share nothing and must not depend on run order (`fullyParallel`).

## Git workflow

- Issue, then branch `<issue id>-<short-description>`, then PR to `main` (uses `.github/pull_request_template.md`).
- Commit messages must start with `#<issue id> ` (enforced by `commit-msg`). `pre-commit` runs lint-staged; `pre-push` blocks pushes to `main`.
- Claude never merges PRs. Run a code review on your own PR and fix the findings; a human merges. Start the next issue from the updated `main`. When a PR is ready, reply with its URL and a short summary.
- CI: `pr.yml` runs lint, format check, typecheck, tests and the leak check on every PR; `smoke.yml` runs `@smoke` hourly on `main` and opens or comments on a `smoke-failure` issue. All runs share one Todoist account (concurrency group `todoist-account`, 2 workers, 1 retry in CI).
