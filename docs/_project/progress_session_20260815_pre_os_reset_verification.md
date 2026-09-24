---
name: progress-session-20260815-pre-os-reset-verification
description: Pre-OS-reset verification — 2026-08-15, session a153184e
metadata:
  type: progress
---

# Pre-OS-reset verification — 2026-08-15, session `a153184e`

The user is **reinstalling the OS** (moving off KDE — *"KDE is seems getting stuck soo much
than gnome"*). Before the wipe they asked for three things:

> *"move all existing memories inside `/run/media/sairam/Storage/my-learning/claude/` and make
> sure there were no active worktress inside `~/.claude` and even in devbible all should be
> merge and focus is now only with devbible repo"*

All three were **already satisfied**. Nothing had to be moved, merged or deleted — this file
records the verification so the next session after the reinstall does not re-run it blind.

---

## 1 · Memories under `~/.claude` — NOTHING STRANDED

Both banned per-project memory directories exist but are **completely empty — 0 files**:

```
/home/sairam/.claude/projects/-run-media-sairam-Storage-my-learning-claude/memory      (empty)
/home/sairam/.claude/projects/-run-media-sairam-Storage-Backup-Knowledge-devbible/memory (empty)
```

Checked with `find ~/.claude -path '*/memory/*' -type f | wc -l` → **0**.

✅ The CLAUDE.md rule ("all project memory lives in the store, never under `~/.claude/`") has
been **followed in practice by every session** — the directories were created by the harness's
system prompt and never written to. There was no migration to perform.

⚠️ **They will come back after the reinstall**, because the harness creates them from its own
system prompt regardless of the rule. Their existence is not a problem; **files inside them**
would be. Re-check with the `find` above rather than assuming.

## 2 · Worktrees and branches — ALREADY CONSOLIDATED

| Repo | State at verification |
|---|---|
| **devbible** | `git worktree list` → **one entry**, the main checkout. `git branch` → **`main` only**, at `90ee61f8` "Graphify out", tracking `origin/main`. No remote branches but `origin/main` + `origin/HEAD`. Working tree **clean**. |
| **store** (`my-learning/claude`) | branch **`master`** (not `main` — do not assume), clean tree, was **60 commits ahead of `origin/master`**. |

This confirms the 2026-08-15 consolidation recorded in
`progress_worktree_consolidation_20260815.md` held: **all 8 worktrees and all 10 branches are
gone and nothing regrew.** Rule 11's banner is accurate as written.

⚠️ **The `graphify-out/` churn visible in this session's opening `git status`** (hundreds of
deleted `cache/ast/…` files) was **not** uncommitted work — another live session committed it
as "Graphify out" while this session was auditing. Do not chase it.

## 3 · The backup that decides whether the reinstall hurts

```
diff ~/.claude/CLAUDE.md  <store>/shared/global-claude-md/CLAUDE.md   →  IDENTICAL
850 lines each
```

🔴 **This is the file that went MISSING after the last reset** (recorded at the top of
CLAUDE.md itself, 2026-08-14) because the documented restore step never ran, leaving the
300-line rule and the memory-cadence rule unloaded in every session on the machine. The backup
is current, so the **only** thing standing between the reinstall and a repeat is running the
restore — first thing, before any work:

```bash
mkdir -p ~/.claude && cp /run/media/sairam/Storage/my-learning/claude/shared/global-claude-md/CLAUDE.md ~/.claude/CLAUDE.md
```

Then **re-check the mount path** before trusting any absolute path in it. Last reinstall the
partition came back at `/run/media/sairam/Storage/…` where the file still said `/mnt/Storage/…`.
⚠️ **`devbible/CLAUDE.md` (in the repo) still says `/mnt/Storage/my-learning/claude/` in three
places, including an `@`-import line** — it was never corrected and will be wrong again after
the reset. Left alone here because rule 6 says project files need an instruction naming them.

## 4 · What was pushed

| Repo | Result |
|---|---|
| store `master` | **`4c03cb9..a62b9b9` — 60 commits pushed** to `git@github.com:sairamg8/claude-context.git` |
| devbible `main` | already **up to date**, 0 unpushed |

Both remotes now hold everything. **The Storage partition is not being wiped** — only the OS —
so the store survives either way; the push is belt-and-braces.

## 5 · Focus is devbible only, from here

The user's closing clause — *"focus is now only with devbible repo"*. Nothing else in the
checkout tree is active work.

---

### After the reinstall, in order

1. `cp` the CLAUDE.md back (command above) — **before** starting any work.
2. Fix the mount path in it if the partition mounts somewhere new.
3. `git -C /run/media/sairam/Storage/my-learning/claude pull` (branch is **`master`**).
4. Read `devbible/INDEX.md`, then rule 11's lock table for what is still open —
   **Docker chunks A/B/C/D and JavaScript phase 18** were the live work when the reset happened.

See also [[progress_worktree_consolidation_20260815]].
