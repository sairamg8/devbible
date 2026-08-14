---
title: "01 — `git status` is the instrument panel"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-status` in full, plus the
> message strings shipped inside the `git` binary. **Documentation-validated, not
> sandbox-proven**, except the two recorded console blocks, which come from
> `sandbox/git-p0/ex2-object-model.sh`.

**`git status` is not a summary. It is three comparisons between the three trees,
printed in a fixed order — and once you read it that way, it answers "which of my
changes are where" rather than "here is some text about files".**

This topic is long because `status` is the command you will run more than any
other, and because almost every everyday Git confusion — *I committed and my
change isn't there*, *my file is listed twice*, *nothing to commit but the file is
right there* — is a `status` output that was read as a list instead of as three
comparisons.

## Chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The three sections](01-the-three-sections.md)** | The long format as HEAD↔index, index↔worktree and untracked; the hints Git prints and which one destroys work; the header line; the eleven "you are in the middle of…" states; `-v` and `-vv` |
| 02 | **[The short format](02-the-short-format.md)** | The two-column XY grammar, the character legend, every common code, the seven conflict codes, the submodule vocabulary, and `-sb` |
| 03 | **[Porcelain, for scripts](03-porcelain-for-scripts.md)** | What `--porcelain` guarantees, the three things `-z` changes, porcelain v2's headers, fields, modes and conflict stages, and which format to reach for |
| 04 | **[Untracked files, performance and config](04-untracked-and-performance.md)** | Why untracked files are the expensive part, `-u` and `--ignored` modes, the index write and `--no-optional-locks`, the four performance levers, and the full config table |

## The one thing to take away

The left column of `git status -s` is **the index against HEAD**. The right column
is **the working tree against the index**. The long format's first section is the
left column; its second section is the right column. `git commit` writes the left
column and ignores the right one.

Everything else on these four pages is a consequence of that sentence.

## Phase gate

You are ready to move on when you can look at `AM`, ` M` and `??` and say, without
checking, which of the three trees each file is in — and when your instinct before
`git commit` is to read the first section rather than to type faster.

## Where this connects

- **Back to Phase 0** — the sections *are*
  [the three trees](../../phase-0-how-git-stores-things/04-three-trees.md), and the
  `AM` code is a direct consequence of
  [the index holding a hash](../../phase-0-how-git-stores-things/05-the-index.md).
- **Forward to `git add` (topic 02)** — the command that moves a
  path from the second section to the first, one hunk at a time if you want.
- **Forward to `git diff` (topic 04)** — `status` names *which*
  files differ; `diff` shows *how*, and it answers the same three questions with
  the same three pairings.
- **Forward to `.gitignore` (topic 05)** — the reason a file is
  missing from the untracked section, and `check-ignore -v` for finding the rule.
- **Forward to Phase 9** — `core.untrackedCache` and `core.fsmonitor` are covered
  here as `status` levers and there as repository-wide performance work.

---

← Prev: [Phase 1 index](../README.md) · Start → [The three sections](01-the-three-sections.md)
