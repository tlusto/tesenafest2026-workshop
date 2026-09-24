---
name: writing-api-test
description: Use when automating a TC-0xx test case from "Test Cases for automation.md", adding or changing a spec under tests/, or reviewing a Todoist API test before opening a PR in this repo.
---

# Writing an API test

## Overview

A test here proves the API **stored** what a user entered, not only that it echoed it back. The rules are in CLAUDE.md. This skill gives the order of work, the spec shape, and the mistakes that reviews in this repo have already caught.

## Workflow

1. Read the test case in `Test Cases for automation.md` and its spec file and tag in `docs/test-architecture-plan.md`. Work only on that test case. If other code is broken (lint, typecheck or another spec), report it in the PR and leave it alone.
2. Create an issue with the form, then a branch `<issue id>-<short-description>` from the updated `main`. For example `14-tc-003-task-due-date`, not `test/tc-004-labels`.
3. If the spec types a field loosely (`due` is just "object") or the behavior is unclear, probe the real API first. Assert what it actually returns and list it under "Assumptions" in the PR.
   - Write the probe script in the scratchpad, never in the repo. Give its data the `autotest-` prefix, delete it at the end, and print only response bodies, never request headers.
   - If the probe shows a feature is missing on the free plan, that part becomes `test.fixme(true, '<reason>')`.
4. Write the spec in the shape below. A test case that promises two behaviors (for example "required fields only" and "every optional field") becomes `TC-00Xa` and `TC-00Xb`. Both keep the `@TC-00X` tag.
5. Run `npm run lint`, `npm run format:check`, `npm run typecheck` and `npx playwright test --grep @TC-00X`.
6. Break the key assertion once, for example expect the entered date + 1 day, and confirm it fails **in the step you expect**. Restore it.
7. After that failing run, run `node scripts/check-no-token.mts`. Then list projects, labels and Inbox tasks, and confirm none start with this run's `autotest-` prefix. There is no script for this, so use a scratchpad script as in step 3.
8. Commit as yourself, with your GitHub noreply email (`git -c user.email=<id>+<login>@users.noreply.github.com commit ...`) if `.git/config` has a work address. The message starts with `#<issue id> `.
9. Push and open the PR with `.github/pull_request_template.md`. Write the body file with the Write tool, then run `git push` and `gh pr create --body-file ...` **as separate commands**. Chained with `cd` or `&&`, they no longer match the allow rules and get denied.
10. Run a code review of the PR, fix the findings, and reply with the PR URL. Never merge.

## Spec shape

```ts
import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    // Diacritics and symbols as a user would type them. The unique prefix comes first,
    // so the global setup can recognise and delete a leftover.
    const enteredText = `${uniqueName('task')} Koupit mléko, chléb a 2× máslo`;

    const created = await test.step('Create a task with the text', () =>
      testData.createTask({ content: enteredText }));

    await test.step('Check the text in the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.content).toBe(enteredText);
    });

    await test.step('Load the task and check its text', async () => {
      const loaded = await api.tasks.get(created.id);
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(enteredText);
    });
  },
);
```

What it shows:

- **Realistic input**: the `autotest-` prefix first, then text with Czech letters outside Latin-1 (ě, ř), `&` and `×`. A name of only `[a-z0-9-]` would still pass if the API mangled text.
- **Separate steps**: the create call has its own step, and the checks go in the next step. Otherwise a wrong response is reported as a failed create call. A step that only asserts stays synchronous (`require-await`).
- **Read back**: load the resource again (GET by id, and the parent's list where it exists, as in TC-005) and compare with the value that was **sent**.
- **Schema**: `toMatchSchema` on every successful body, list items included.

## Common mistakes

| Mistake                                                                                          | Fix                                                                                     |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A helper used without being imported (`ReferenceError: buildProject is not defined`)             | Run the test and `typecheck` before committing, even after a one-line edit              |
| `const { name } = buildLabel()`, then `testData.createLabel({ name })`                           | Builds a second unique name and throws it away. Use `uniqueName('label')`               |
| Importing `test`/`expect` from `@playwright/test`                                                | Import them from `src/fixtures`                                                         |
| `expect(id).not.toBe('')`                                                                        | Passes for `" "`. Use `expect(id).toMatch(/^\S+$/)`                                     |
| Asserting display or stale fields (`due.string`, `due.lang`, `updated_at` in an update response) | Assert only what the test case promises. Use `toMatchObject` for the fields that matter |
| Dates computed from the runner's clock                                                           | `todayIn(accountTimezone)` and `addDays` from `src/utils/dates.ts`                      |
| Resources created through `send` and never deleted                                               | `testData.track(kind, id)`                                                              |
| Fixing an unrelated broken spec in the same PR                                                   | Mention it in the PR. Someone else owns that fix                                        |
