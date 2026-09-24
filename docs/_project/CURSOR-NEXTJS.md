---
name: cursor-nextjs
description: 🔴 THE NEXT.JS TRACK IS CLOSED (2026-09-05) — quote existence 96.3%, attribution 99.5%, both past the user's 90% bar. START HERE for any Next.js devbible session; it says what closed means, what is accepted as non-blocking, and the ONLY three things that should reopen the track. Do not start a validation programme.
metadata:
  type: project
---

# 🔴 START HERE — Next.js

> 🔴 **NO LOCAL `yarn build`. EVER.** Cheap checks → `git add <explicit paths>` → commit → push →
> watch GitHub Actions (`gh run list`). Standing user order, given twice, broken twice — most
> recently 2026-09-05 session `d2e9b9fe`, four builds, 7 GB of swap, zero information gained.
> Full reasoning: [[devbible-feedback-verify-in-ci-not-locally]]. ✅ **`onBrokenLinks` is `'throw'`
> since 2026-09-05** — a broken link now FAILS the build and blocks the deploy. Still run the local
> filesystem link check: it catches the problem before a red CI run, and it works mid-chapter.


## 🔴🔴 THE NEXT.JS TRACK IS CLOSED — 2026-09-05

> 🔴 **If a session is told "continue next js" / "finish next js" / "pick nextjs":** the honest
> answer is that **there is nothing to continue** — say so, give the numbers below, and offer the
> three reopen triggers. **Do not invent work**, do not start validating chapters, and do not
> restart a sweep. If the user then names something specific, do that one thing.
>
> **Cold-start checks that are still worth 30 seconds:** `git status --porcelain docs/` for salvage
> from an abrupt close, and the filesystem link check — CI catches broken links now, but only
> *after* a red run.

**User's decision: *"apply the 90% bar to quote-level and close it"*.** Full record and the
numbers: [[project-nextjs-closed]].

| Metric | Result | Bar |
|---|---:|---|
| **Quote existence** | **96.3%** (a FLOOR — the sample came from the worst band) | ✅ PASS |
| **Attribution** | **99.5%** | ✅ PASS |

✅ 659 pages · 20 chapters · CI green on **build and deploy** · `onBrokenLinks: 'throw'` ·
**0 broken links** · `origin/main` = `1caf0238`.

⚠️ **The chapter-level S1/S2 metric (0–70%) was considered and REJECTED** — it fails a whole page
for one defect, so it measures *pages touched by a defect*, not how much of the corpus is wrong.
🔴 **Do not "rediscover" that number and reopen the track on it.** The comparison is already made.

### 🔴 DO NOT START A VALIDATION PROGRAMME HERE. Reopen only for:
- a **Next.js release** that moves the version spine → that is `devbible-currency`, not this
- a **reader-reported error** → fix the page; do not restart a sweep
- **`quotesweep.py`** after an upstream doc rewrite — one command

### Accepted as not blocking (see [[project-nextjs-closed]] for all of it)
~46 misattributed + ~39 self-quoted quotes (**regenerate worklists with the tool**) · two
undecided house-convention questions — 🔴 **do not mass-change them** · `DATABASE_URL_DIRECT` vs
`DIRECT_URL` · PostgreSQL 18.6 vs pinned 18.4 · ch03's four depth findings (authoring).

---


---

> 🗄️ **1241 lines of superseded history moved to [CURSOR-NEXTJS-HISTORY.md](CURSOR-NEXTJS-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-NEXTJS-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
