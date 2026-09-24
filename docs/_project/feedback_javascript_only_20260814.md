---
name: devbible-javascript-only-20260814
description: Standing order 2026-08-14 — switch from React to JavaScript and run it to completion without pausing; supersedes the React-only worktree order
metadata:
  type: feedback
---

🔴🔴 **Narrowed to a TIER, 2026-08-14** — *"next can you lock in understand know tier"*, said
straight after reading the syllabus-coverage audit. **The work is the Understand and Know tiers
and nothing else.** Master closed at **99/99**; 132 of 337 topics written; the remaining **205
are Understand 147 · Know 55 · When Needed 3**.

- **Do not reopen a Master topic to deepen it.** Master is finished; what is left is breadth.
  This is the opposite of the Express order, which *was* a depth pass over written Master topics
  — do not carry that shape across.
- **Order: phase by phase; inside a phase, Understand → Know → When Needed.** Not
  Understand-across-all-phases-first. Chosen because phase 3 is already mid-flight that way
  (09–11 Understand written, 12–17 Understand and 18–20 Know open), so any other order strands
  it. Stated to the user as the assumption rather than asked, since the in-flight work already
  settled it.
- **The overlap rule still governs**: an Understand topic covering ground a Master topic already
  implemented gets the **CONCEPT and the CHOICE**, then links to the implementation. Phase 3
  topic 10 (debounce/throttle vs Phase 17) is the worked example.
- Written into `~/.claude/CLAUDE.md` **rule 11b** so it loads in every session.

🔴 **Locked in as the auto-loading standing order, 2026-08-14** — *"Please lock it in with
javascript"*. Until that moment this order lived **only here**, in a file that loads only if
someone chooses to open it, while `~/.claude/CLAUDE.md` rule 11 — the file that loads in every
session — still said **React only, in a worktree**. Any fresh session read the wrong language.
`~/.claude/CLAUDE.md` rule 11 and the MEMORY.md rule-10 mirror are now both **JavaScript only,
on `main`, no worktree**, carrying the per-file cadence and the cursor pointer.
**The lesson is rule-shaped:** a standing order that lives only in the store is not a standing
order. When the user names a new language, rewrite rule 11 in the same turn.

🔴 **Set 2026-08-14 by the user to session `c5329658`, verbatim:**

> *"I want you to pick up javascript from memory you will get to know about the progress i am
> counting on you to finish it and do not wait for me and pick recomended action till the
> express js compelte again do not wait for me. Especially there was hard rule about file size
> and memory saved make sure you have to follow as it as"*

and, minutes later:

> *"there were other sesssions running simulatenously on different lang so do not worry about
> build errors fix only what your working on"*

**Re-affirmed mid-session the same day**, unprompted, after a progress question:

> *"Ok finish it and remember you should care only about javascript in this session and rest such
> as express and react js are in different sessions"*

So the scope is now stated twice: **JavaScript only in this session; Express and React belong to
other sessions and are not this session's to touch — including their broken links.**

**Tightened again at ~90% usage the same day:**

> *"Hey we are at 90% of usage make sure to save each file progress the moment it completes"*

🔴 **So the cadence is now PER FILE, not per 2–3 files.** Write a file → update the boards →
commit → update the memory. The reason is explicit: usage is nearly exhausted and a session that
dies mid-topic must lose at most one file. This supersedes rule 9's "every 2–3 files" **for the
rest of this session and any session resuming it under the same constraint**.

## What it changes

**This supersedes [[devbible-react-only-worktree-20260814]] and `~/.claude/CLAUDE.md` rule 11.**
That order said *React and nothing else, in a worktree*. The user has now explicitly named
**JavaScript** as the language to pick up and finish. An explicit later instruction wins.

- **Language: JavaScript.** Not React. React Phase 7 stays where it is — 2 of 12 topics on the
  unmerged `react-phase-7` branch in `Backup/Knowledge/devbible-react` — and belongs to whoever
  picks it up next. Say so rather than quietly leaving it.
- **Working tree: the shared checkout** `/mnt/Storage/Backup/Knowledge/devbible` on `main`,
  because that is where the JavaScript corpus already lives (the JS phase-3 worktree was left
  locked and pre-merge; do not revive it).
- **Run to completion without pausing.** "Do not wait for me" was said twice. Pick the
  recommended next action each time and take it — the same autonomous mode Express was finished
  under. The earlier standing authorisation in [[devbible-javascript-build-progress]]
  (*"continue with topic 05 promises do not wait for confirm"*) is re-affirmed and widened to
  the whole corpus.
- **"till the express js complete"** = finish JavaScript the way Express was finished — all
  phases, board and UI current, memory committed — not a instruction to work on Express.

## The two rules the user attached to it

Both were named explicitly, and both are already global hard rules:

1. **The 300-line cap is a FILE-SIZE rule, never a content budget**
   ([[devbible-never-compress-to-fit-cap]], `~/.claude/CLAUDE.md` rule 1). Given a **fourth**
   time now. Write the explanation the topic deserves, then split on concept boundaries.
   🔴 It fired immediately: phase 11 topic 03 drafted at **301/319/300** lines — over the cap
   *and* clustered in the band that is itself the tell. Re-split into **six** chunks totalling
   **1,538** lines rather than trimming two files. Total went up by ~570 lines.
2. **Save memory every 2–3 FILES, 100%** (`~/.claude/CLAUDE.md` rule 9). Files, not topics.

## Build failures from other sessions

Explicitly out of scope. Several sessions write to this checkout at once, so a build reports
their broken links too. **Fix only `docs/javascript/`.** Tally by language before reacting:

```bash
yarn build 2>&1 | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
```

At the 2026-08-14 phase-11-topic-03 build that was 5 broken links, **all** in
`docs/typescript/` and `docs/expressjs/`, 0 in `docs/javascript/`. Left alone deliberately.

Related: [[devbible-javascript-build-progress]] · [[devbible-javascript-syllabus]] ·
[[devbible-parallel-sessions]] · [[devbible-react-only-worktree-20260814]]
