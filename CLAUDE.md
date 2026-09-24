# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API tests (no browser) for the Todoist API v1, run against production with a free account. `brief.md` holds the project requirements, `Test Cases for automation.md` the test cases, and `docs/test-architecture-plan.md` the architecture and the file each test case belongs in.

## Commands

Node 24 (`.nvmrc`). Run `npm ci` first; it also installs the git hooks. The tests need `TODOIST_API_TOKEN` in `.env` (copy `.env.example`).

```sh
npm run lint            # ESLint, type-checked rules
npm run format:check    # Prettier (npm run format to fix)
npm run typecheck       # tsc --noEmit, strict
npm test                # all tests
npm run test:smoke      # only @smoke
npx playwright test --grep @TC-001                  # one test case by tag
npx playwright test tests/projects/projects.spec.ts # one file
```

`TEST_ENV` selects `config/<env>.ts` (default `prod`, the only environment). A new environment is a new file registered in `config/index.ts`.

## Architecture

- **Auth is only the API token.** `createApiContext` builds an `APIRequestContext` with the base URL and `Authorization: Bearer <token>`. There is no login. `GET /user` is used only to read the account timezone.
- **Clients** (`src/clients/`): `BaseClient` provides `getJson`, `postJson`, `postEmpty`, `deleteResource` and `listAll`. Typed methods throw `ApiError` on non-2xx responses, and `listAll` follows `next_cursor` pagination. `send(method, path, options)` returns the raw `APIResponse` for status code assertions. Each resource client is thin (one method per endpoint), and `createTodoistApi` bundles them into `api.projects / tasks / labels / comments / user`. Response types in `clients/types.ts` are written by hand, not generated.
- **Fixtures** (`src/fixtures/`): tests import `test`, `expect` and `Schema` from `src/fixtures` only. `test` merges:
  - `apiTest`: `apiRequest`, `api`, `unauthenticatedApi`, and `apiWithToken(token)` for negative auth tests. Contexts are created from `playwright.request`, so calls show up in the trace.
  - `dataTest`: `testData.create{Project,Task,Label,Comment}` build payloads with the builders in `src/data/` and delete everything in reverse order in teardown, also after a failure. A 404 during cleanup is ignored. Anything created another way (for example with `send`) must be registered with `testData.track(kind, id)`.
  - `userTest`: worker-scoped `account` and `accountTimezone`.
- **Test data names**: `uniqueName(kind)` gives `autotest-<run id>-<kind>-<hex>`. The run id starts with a UTC timestamp and is fixed once in `playwright.config.ts`, then passed to workers through `AUTOTEST_RUN_ID`. `src/global-setup.ts` uses that timestamp to delete `autotest-` projects, labels and Inbox tasks older than 1 hour. This keeps the free plan's project limit from blocking runs.
- **Schema validation**: `src/schemas/openapi.json` is a pinned copy of the spec. Assert with `expect(body).toMatchSchema(Schema.task)`, using the names in the `Schema` map in `validator.ts`, which point to the spec's component names (for example `ItemSyncView`, `AnyProjectSyncViewResponse`). To refresh the spec, run `node scripts/update-openapi.mts` and review the diff.
- **Dates**: assert them in the account timezone with `src/utils/dates.ts` (`todayIn`, `tomorrowIn`, `addDays`), never the runner's clock.
- **Token redaction**: Playwright records the Bearer header in traces and errors. `src/reporters/redact-reporter.ts` must stay the first reporter; it rewrites attachments, trace zips, errors and stdout synchronously in `onTestEnd`. CI runs `scripts/check-no-token.mts` before uploading any artifact. `console` is an ESLint error outside `scripts/`.
- **CI**: `pr.yml` runs lint, format check, typecheck and all tests on PRs (never `pull_request_target`). `smoke.yml` runs `@smoke` every hour on `main` and opens or comments on a `smoke-failure` issue. Both share the `todoist-account` concurrency group. CI uses 2 workers and 1 retry, and flaky tests are posted as a PR comment.

## Writing tests

- Put each test in the spec file listed in the table in `docs/test-architecture-plan.md`. Name it `TC-00X <name from the test case file>` and tag it `['@TC-00X', '@<suite>']`. Suites: wave 1 `@smoke`, waves 2 and 4 `@regression`, wave 3 `@e2e`, wave 5 `@negative`.
- Wrap each step in `test.step('<readable name>', ...)`. Test one behavior per test. A test case with several inputs is split into several tests with suffixes (`TC-015a`, `TC-015b`, ...) under the same `@TC-015` tag.
- After creating something, load it again (`api.<resource>.get`) to prove it was stored, not only echoed in the create response. Validate the schema of every successful response body.
- The OpenAPI spec defines expected behavior; there are no acceptance criteria. When the expected result is unclear (for example status codes in TC-015), call the real API first, assert what it actually does, and list that as an assumption in the PR description.
- If a feature is not on the free plan, mark the test `test.fixme(true, '<reason>')`.
- Sections and TC-010 are out of scope.

## Git workflow

- Every change follows this order: GitHub issue, then a branch named `<issue id>-<short-description>`, then a PR to `main`. For test cases, format the issue body as `### <Field>` sections like `.github/ISSUE_TEMPLATE/test-case.yml`. The `issue-priority` workflow reads `### Priority` (`P0` to `P3`) from the body and adds the `priority:` label.
- Hooks: `commit-msg` requires `#<issue id> <summary>`, `pre-commit` runs lint-staged (ESLint and Prettier), and `pre-push` blocks pushes to `main`.
- Fill in `.github/pull_request_template.md` in the PR, including assumptions (or "None").
- Never merge PRs. Code-review your own PR and fix the findings. A human reviews and merges. Start the next issue from the updated `main`.
- When a PR is ready, reply with its URL and a short summary.
