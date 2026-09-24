---
name: feedback-never-run-local-build-or-check-ci
description: 🔴 STANDING ORDER 2026-09-08, sharpened 2026-09-24 — never run `yarn build` or test suites LOCALLY. To check a build or tests: commit everything, push, and verify via GitHub Actions. Per-file gates stay linkcheck + mdxcheck.
metadata:
  type: feedback
---

# 🔴 Never build or test locally — commit, push, verify in GitHub Actions

## ⬆️ Superseding update — 2026-09-24

> *"When you wish to check the build or run test cases never do it locally please. Just commit
> everything and verify via github actions"*

**This replaces the "do not go read CI" half below.** When a build or test check is
actually wanted, the route is: commit (explicit paths), push, then read the GitHub Actions
run (`gh run list` / `gh run view`). ⛔ Still never `yarn build`, `yarn test`, `vitest`,
`jest`, `pytest`, `mvn test` or any build/test locally. The per-file gates (linkcheck,
mdxcheck) are unchanged — they are not builds.

---

## The original order — 2026-09-08

**2026-09-08, said while a local `yarn build` was running:**

> *"You do not need to do yarn build and check CI that was out of scope please
> remember and continue next phase"*

The user killed the build mid-run (exit 137) to say it.

## What this bans

- ⛔ **`yarn build` / `yarn build:fast` locally.** It costs 13+ minutes and, on this
  machine, gets OOM-killed on a corpus of 6,400 pages. It is not a gate you owe anyone.
- ⛔ **Going and reading GitHub Actions runs** — `gh run list`, `gh run view`,
  downloading job logs — as a self-assigned check after a commit. On 2026-09-08 the user
  DID ask for that once, explicitly ("mainly there was build failure look once"). That was
  a scoped, one-off instruction. It did not make CI-watching part of the standing job.

## What is still required

The two per-file gates, unchanged — they are cheap and they catch the real breakers:

```bash
yarn linkcheck                 # or a topic directory
yarn mdxcheck                  # 🔴 WITHOUT --no-rawtag
```

`yarn linkcheck` is the reason `onBrokenLinks: 'throw'` never fires, and mdxcheck with
raw-tag detection ON is what catches a bare `<=22` in a quote — see
[[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]] and
[[devbible-feedback-verify-in-ci-not-locally]].

## Why the user is right

Both banned actions are *the same mistake in two costumes*: spending an evening
re-confirming a green signal instead of writing the next file. The per-file cadence —
write → boards → commit → memory — has no build step in it and never did. If a push
breaks CI, the owning session finds out on its next turn; that is what the shared-checkout
convention already assumes.

**How to apply:** finish a file with linkcheck + mdxcheck, commit, push, move to the next
phase. Do not narrate a build you are about to run, and do not open the Actions tab
unless the user names it in this session.

Related: [[devbible-feedback-answer-simply]] · [[devbible-feedback-verify-in-ci-not-locally]] ·
[[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]] · [[devbible-locks]]
