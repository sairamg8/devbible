---
title: "02 — `git add` in full"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-add` and the *pathspec*
> entry in `man gitglossary`. **Documentation-validated, not sandbox-proven**,
> except one recorded console block from `sandbox/git-p0/ex2-object-model.sh`.

**`git add` copies content into the object store and records its hash in the
index. Which content — that is the whole topic: selecting files, selecting
patterns, and selecting individual hunks.**

## Chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[What `add` does](01-what-add-does.md)** | Staging as a content copy, `.` vs `-A` vs `-u`, deletions, ignored files, embedded repos, empty directories, `--dry-run` |
| 02 | **[Pathspecs, properly](02-pathspecs.md)** | Why `*` crosses `/`, quoting globs, the magic words — `exclude`, `top`, `glob`, `icase`, `literal` — and `--` |
| 03 | **[Patch mode](03-patch-mode.md)** | `-p` key by key, splitting hunks, editing a hunk by hand, and testing what you actually staged |

## The one thing to take away

`git add` records content **as of the moment it runs**. Everything else — `AM` in
`git status`, "I committed the wrong version", `git add -p` producing a file
version that exists nowhere on disk — is that sentence playing out.

## Phase gate

You are ready to move on when `git add -p` is your default for anything larger
than a one-line change, and when you can stage everything except one directory
without looking up the syntax.

## Where this connects

- **Back to [`git status`](../01-git-status/README.md)** — `add` moves a path from
  the second section to the first. The two commands describe the same three trees.
- **Back to Phase 0** — [the index is a real file](../../phase-0-how-git-stores-things/05-the-index.md)
  is why staging is a copy, and [object types](../../phase-0-how-git-stores-things/03-object-types.md)
  is why an empty directory cannot be staged.
- **Forward to `git commit` (topic 03)** — which writes a tree from the index and
  ignores the working tree entirely.
- **Forward to `.gitignore` (topic 05)** — the rules that make `add` skip a file,
  and `check-ignore -v` for finding out which rule did it.

---

← Prev: [Phase 1 index](../README.md) · Start → [What `add` does](01-what-add-does.md)
