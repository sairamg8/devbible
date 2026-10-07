---
name: devbible-feedback-save-memory-and-read-locks
description: The user was angry (2026-10-07) that a whole long session left no memory entry — read LOCKS.md/INDEX at session start and write the project memory file + index line before reporting a big piece of work done
metadata:
  type: feedback
---

# 🔴 Write the memory as you go, not never

**Said 2026-10-07**: "this session not synced in claude desktop and you haven't saved any memories???" after the job-map work ran for hours
with no memory file. Rules that follow:
- A devbible session opens `LOCKS.md` and the matching `INDEX-*.md` shard first (CLAUDE.md says so) — the job-map session skipped both.
- When a piece of work ships (page, crawler, schema), write a `project_*.md` here and add ONE index line in the same turn, commit explicit paths.
- Cloud sessions started from claude.ai/code are not guaranteed to show in the Desktop app's local session list; the repo (this folder) is the source of truth, so put state here.

**Search on:** memory, session sync, desktop, forgot to save.
