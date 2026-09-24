---
name: devbible-feedback-express-supersedes-react-only
description: Express is a LOCKED standing order (2026-08-14, session b7f137c4) — how it started, what it superseded, and why locks are now per session
metadata:
  type: feedback
---

# Express — locked standing order (2026-08-14)

## 🔴 Locked in, and locks are now PER SESSION

**Instruction, verbatim, to session `b7f137c4`:** *"Lock it in express js"* — given while
the Master-tier depth pass sat mid-topic-24.

This is the fourth devbible standing order in one day (React → Express → JavaScript →
this), and the first three each **overwrote rule 11 of `~/.claude/CLAUDE.md` while the
session they belonged to was still working**. Express was written into rule 11, then the
JavaScript session replaced it wholesale a few hours later — so a fresh Express session
loading the global file would have read "JavaScript only".

**The fix, applied here:** rule 11 is no longer one language. It is a **table of live
locks, one row per session**, with per-language sections (`11a` Express, `11b`
JavaScript, `11c` React parked). Add or repoint your own row; **never delete another
session's**. Mirrored in the store's `MEMORY.md` rule 10.

**How to apply:**

- **Your language is the one the user named in THIS session.** Do not infer it from the
  table, the git log, or what looks idle. If none was named, **ask** — that is the one
  question worth blocking on, because guessing duplicates another session's work in the
  same shared checkout.
- Express's row names session `b7f137c4`, continuing `ffadd057`. The `docs/README.md`
  claim row was repointed the same way rather than opening a second Express claim.
- Cadence for Express is **per file**, matching the JavaScript lock.

## How the Express order started

**Instruction, verbatim, to session `ffadd057`:**

> *"I want you to pick up express js from memory you will get to know about the progress
> i am counting on you to finish it and do not wait for me and pick recomended action
> till the express js compelte again do not wait for me. Especially there was hard rule
> about file size and memory saved make sure you have to follow as it as"*

And mid-turn, once work had started:

> *"there were other sesssions running simulatenously on different lang so do not worry
> about build errors fix only what your working on"*

**Why:** [[devbible-feedback-react-only-worktree-20260814]] set "React and nothing else"
as a standing order *until the user revokes it*. That was its revocation — an explicit,
named instruction to work a different technology. A standing order that names one
technology does not survive the user naming another **in that session**; what it must not
do is silently cancel the order a *different* live session is working to, which is what
the rule-11 rewrites kept doing (see the lock table above).

**How to apply:**

- **Express is the work** until Express is finished. Do not switch back to React, and do
  not stop to ask — *"do not wait for me"* was said twice in one message.
- **The two rules the user attached are the same two as before**, and they are the point
  of the message: the **300-line cap is a file-size rule, never a content budget**
  ([[devbible-feedback-never-compress-to-fit-cap]]), and **memory gets written and
  committed every 2–3 files** ([[devbible-feedback-ui-progress-and-build-cadence]]).
  *"make sure you have to follow as it as"* — as-is, no interpretation.
- **Only touch Express.** Other languages have live sessions writing into the same
  checkout; their broken links and build warnings are theirs. Do not fix them, do not
  investigate them, do not count them. Grep the build log for `expressjs` only.
- **React is not abandoned** — Phase 7 is 2 of 12 on branch `react-phase-7` in the
  worktree `Backup/Knowledge/devbible-react`, and that worktree is **still unmerged**.
  The resume point is unchanged: [[devbible-react-phase7]].

**Not done in a worktree.** The React order's worktree half was tied to React. Express is
being written on `main` in the shared checkout, staging explicit paths only — which the
same instruction's "other sessions are running" warning makes safe enough, and which
avoids repeating the unmerged-worktree trap that order itself warns about.

Live Express state and the worklist: [[devbible-express-master-depth-pass]].
