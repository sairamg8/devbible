---
name: devbible-progress-20260830
description: Session 460b1fa8, 2026-08-30 — OS reset recovery, Java phase 11 topic 06 MockMvc CLOSED at 34 chunks, and the three standing orders given that day. Read with CURSOR-JAVA.md, which is the actual resume point.
metadata:
  type: project
---

# 2026-08-30 · session `460b1fa8` — reset recovery + Java P11 T06 closed

> 🔴 **This file is history. The resume point is [[cursor-java]] (`CURSOR-JAVA.md`).** Read that
> to start working; read this only to understand how today got here.

## What the session started as

An OS reinstall had wiped `$HOME`. `~/.claude/` had **no** `CLAUDE.md`, no `settings.json`, no
hooks, no `lanes/`, no `skills/`, no `plugins/`. Surviving: `~/.claude.json`, `.credentials.json`,
`~/.ssh/`, `~/.gitconfig`, `~/.bashrc`.

✅ **Nothing in either memory store was lost** — both are on `/dev/sda1`, which the reinstall did
not touch. Everything missing was recoverable from `shared/claude-home-backup/` and
`shared/global-claude-md/`. **The design held.** Restored on the user's instruction:
`CLAUDE.md` (byte-identical) and the **current** `settings.json` — the one with the five hooks
and `CLAUDE_MEM_DATA_DIR`.

Defects the restore exposed, all fixed at source — see
[[shared-feedback-global-claude-md-lost-its-rules]] for the full write-up.

## Java — phase 11 topic 06 · MockMvc CLOSED

**34 chunks + index, ~8,000 lines, 406 ★.** Phase 11 is now **6/11**; Java is **159/232 topics**.

Built by **three agents inside the one topic** on disjoint files (2 `devbible-author` forks +
the coordinator authoring), per the order given that day. Two stubs became the bulk of it:

| Was | Became |
|---|---|
| `08-security-in-a-slice.md`, a 15-line stub | **9 chunks**, 2,360 lines, 134 ★ |
| `07-exception-handlers.md`, a 14-line stub | **6 chunks**, 1,490 lines, 78 ★ |

Both split under a before/after line-and-★ audit; both totals rose (465→2,360 / 22→134, and
475→1,490 / 20→78). Coordinator wrote `09`, `09b`, `10-the-checklist` and the `README.md` index.

### 🔴 A 314-line cap violation had survived a commit

`06-validation-errors.md` was left over cap by the fork that died on 2026-08-28 — **the only
over-cap file in all 1,355 Java pages**. Split on the mechanism/practice seam into 204 + 143,
**16 ★ preserved, 0 source lines lost**. Later the same day the restored hook caught the
coordinator's own 310-line `09` and it was split the same way (220 + 125, 20 ★ → 20 ★).

**Both were verified as splits, not trims**, by the audit the cursor mandates: combined lines and
combined ★ must both rise, and every source line must be found in one half.

### Both forks contradicted the coordinator's brief, and both were right

Eleven corrections in total, all source-verified and banked in
[[research-java-p11-t06-mockmvc]]. The three that matter most:

1. **`ResponseStatusException` EXTENDS `ErrorResponseException`** — so it *is* caught by any
   `ResponseEntityExceptionHandler`, inverting what the brief said.
2. **`@ResponseStatus` shares `@Valid`'s `sendError` empty-body problem** — the same call, not a
   different behaviour.
3. 🔴 **The brief told the 08 author to hedge "your `SecurityConfig` is not in the slice" as
   undocumented. It is documented outright** in Boot's how-to, with a `SecurityFilterChain`
   worked example prescribing `@Import`. The under-claiming hedge in `02-webmvctest.md` was
   upgraded to that citation.

**This is the third phase running in which a coordinator brief was wrong and a fork caught it.**
Every brief must keep saying *verify against the docs, not against me*.

## The three standing orders given 2026-08-30

1. **Per-file memory cadence** → now hard rule 7, and rule 11 in `~/.claude/CLAUDE.md`.
2. **One topic at a time; parallelise inside it** → [[devbible-feedback-one-topic-at-a-time]].
3. **Java to completion, THEN Python** → now hard rule 12.

## Mistakes made, for the record

- 🔴 **Rewrote a shared table cell.** `docs/README.md`'s claim row holds Java *and* Python history
  in one cell; replacing it deleted Python's. Caught, reverted, redone as an append; verified
  intact. **Append to that cell, never rewrite it.**
- ⚠️ **The repair used `git checkout docs/README.md`**, which in a shared checkout discards any
  session's pending edits to that file. Safe only because the tree was verified clean at session
  start. Reconstruct from `git show HEAD:<file>` instead.

## claude-mem, measured

Its DB was last written **2026-08-29 09:18** — **nothing from this session reached it**. Worker
down, plugin mid-reinstall, because all of that lives in the wiped `$HOME`. It is a recall index,
not a resume mechanism. Rule 11 now says so explicitly.

## What is next — 73 topics

**Phase 11, 5 topics open:** 07 · Testcontainers (3 real chunks + **3 draft stubs**, no index —
research already banked in [[research-java-p11-t07-testcontainers]]), then 08 · Test data,
09 · JaCoCo, 10 · jqwik, 11 · PIT. All five have `_plan.md` files.

**Phases 12–16: 68 topics, nothing written** — each is a bare `README.md` + `_category_.json`.

**Recorded defect, not fixed:** `phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md`
is written against Testcontainers 1.x and does not compile on the pinned 2.0.5. Phase 10 is
closed; a correction pass is the user's call.
