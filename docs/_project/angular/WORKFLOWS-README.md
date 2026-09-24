---
name: angular-phase-0-workflow-scripts
description: The two Workflow-tool scripts that write Angular Phase 0, saved out of the session scratchpad so they survive. How to re-run either one, and what to do if a run dies half-written.
metadata:
  type: project
---

# Angular Phase 0 — the workflow scripts, and how to re-run them

> Written 2026-09-06 by session `11a770dc` during the **"ultra code complete angular"** run.
> The scratchpad does not survive a session; these copies do. 🔴 **The user's standing order
> that day: _one workflow at a time_, and _save progress to the store the moment one is
> dispatched_** — so that a usage-limit kill never loses the orientation.

## The three files next to this one

| File | What it is |
|---|---|
| `ng-bank.sh` | 🔴 **The per-file commit helper. Recreate it into the scratchpad before running either workflow** — the scripts reference it by scratchpad path. `flock`-serialised on `/tmp/claude-1000/ng-angular-commit.lock`, stages ONE topic directory by explicit pathspec, never `git add -A`. It is the only reason the 2026-09-06 runs banked their work instead of losing it |
| `WORKFLOW-p0-finish-master-topics.js` | Finishes the three **Master** topics 01/02/03 — the 33 chunks left after the 2026-09-06 wind-down. Hard-codes its chunk list; no `args` |
| `WORKFLOW-p0-new-topics.js` | Writes topics **04–12** from scratch — README + chunks + wire-up per topic. Takes `args` = an array of topic slugs, so it can be run a few topics at a time |

## Running them

```
Workflow({ scriptPath: "…/angular/WORKFLOW-p0-new-topics.js",
           args: ["04-ng-update-not-npm-install", "05-the-angular-build"] })
```

🔴 Copy the script to a writable path first if you intend to edit it — and copy `ng-bank.sh`
to the scratchpad path the script names, or every writer's commit step fails silently at the
end of an otherwise good page.

**Valid slugs**, with the chunk count each is planned at:
`04-ng-update-not-npm-install` (8) · `05-the-angular-build` (9) · `06-angular-json-anatomy` (11)
· `07-the-typescript-setup` (8) · `08-what-ng-new-produces` (9) · `09-the-release-train` (6) ·
`10-partial-compilation` (5) · `11-jit-vs-aot` (4) · `12-dev-mode-only-behaviour` (6).

## The shape both scripts share, and why

Three stages, run as a `pipeline` so topic B's chunks start while topic C is still researching:

1. **Plan / Research** — ONE agent per topic. Fetches the primary sources once and banks every
   verbatim quote with its URL to `research_angular_p0_<slug>.md` **in this store**. In the
   new-topics script it also writes the topic `README.md`, which is what creates the directory.
   🔴 This exists because a topic researched per-chunk pays the research cost 17 times; that is
   what exhausted the 2026-08-31 run before it wrote a single line.
2. **Write** — one agent per chunk, each writing exactly ONE file and committing it through
   `ng-bank.sh`. A kill therefore loses at most one file.
3. **Wire** — one agent per topic, after every chunk exists: rewrites the footer chain from what
   is **actually on disk**, relinks the README chunk table, drops the 🚧 line.

🔴 **Why every writer emits a placeholder footer** (`Next →` as bold text, `Prev` pointing at the
topic README): siblings are written in parallel, so a writer cannot know what is on disk, and a
link to a not-yet-written sibling is a dangling link — which breaks the production build for
**every other session in this shared checkout**. The Wire stage is what makes the chain real.

## 🔴 If a run dies half-written

The chunks that landed are committed and correct; only their **footers** are placeholders. Do
not re-run the writers — that rewrites good pages. Instead re-run **the Wire stage alone** for
each affected topic: the stage-3 prompt inside the script is self-contained, so paste it to a
single agent, or resume the run with `Workflow({scriptPath, resumeFromRunId})`, which replays
completed agents from cache and only re-runs what changed.
