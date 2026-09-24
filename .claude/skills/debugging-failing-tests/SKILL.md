---
name: debugging-failing-tests
description: Use when a Todoist API test in this repo fails, locally, in a PR check or in the hourly smoke run (for example "TC-001 failed, review and fix it"), including ReferenceError, TypeError, assertion mismatches, schema failures and unexpected status codes.
---

# Debugging failing tests

## Overview

Find the cause before touching code. Most failures here are in the **test code**, not the API. Each test calls production with the one shared account, so use cheap local checks first and make API calls only on purpose.

**REQUIRED BACKGROUND:** superpowers:systematic-debugging. This skill adds the repo-specific steps.

## Steps

1. **Reproduce one test case.**
   `npx playwright test --grep @TC-00X --reporter=line`
2. **Classify the error.**

   | Symptom                                                           | Likely cause                                       | Next check                                                        |
   | ----------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
   | `ReferenceError` / `TypeError` at a spec line, before any request | Broken test code (missing import, renamed helper)  | `npm run typecheck && npm run lint`, no API call needed           |
   | `toBe`/`toEqual` mismatch                                         | Wrong expectation, or the API normalises the value | Compare with the value that was **sent**; probe the API if unsure |
   | `toMatchSchema` failure                                           | API changed or `openapi.json` is stale             | Read the Ajv path; don't loosen the schema to make it pass        |
   | 401/403                                                           | Token missing or expired in `.env`                 | Don't print the token                                             |
   | Date off by one day                                               | Runner clock used instead of account timezone      | `accountTimezone` + `src/utils/dates.ts`                          |

3. **Read the history of the spec.**
   `git log --format='%h %cn %s' -- <spec>`
   A committer of `GitHub` means a web-UI edit, which skipped the husky lint/typecheck hooks. It's the prime suspect. `git show <sha>:<spec>` shows the last good version. Sibling specs show the expected pattern.
4. **Fix it minimally in the spec.** Reuse what the file already imports. For example, `buildProject().name` is just `uniqueName('project')`. Keep the `autotest-` prefix at the **start** of every name, or cleanup never deletes the data.
5. **Verify.** Run `npm run typecheck && npm run lint && npm run format:check`, then run the test again.

## After the fix

- Follow the CLAUDE.md workflow: a bug-report issue (`.github/ISSUE_TEMPLATE/bug-report.yml`), branch `<id>-fix-…`, `#<id>` commit, PR.
- Run the pre-commit checks (break the key assertion once, look for leftover `autotest-` data) as **separate** commands, and tell the user before each one. They call production with the token, and the user may reject them. If one is rejected, say where things stand and ask. Don't retry it in a bundled form. If it was skipped, say so in the PR.
- `/code-review low` skips diffs that only touch tests. Review the diff yourself and say that you did.

## Common mistakes

- Fixing `src/` helpers to fit a broken spec, when the spec is what's wrong.
- Changing more lines than the cause needs.
- Asserting against the create response instead of the value that was sent. That hides the bug instead of fixing it.
- Bundling edits, test runs and API cleanup into one long command. If the user rejects it, nothing runs and they can't tell what changed.
