---
name: cursor-audit
description: 🔴 START HERE for a cold devbible session asked "what is pending / what do you suggest / is it accurate / is it up to date". Carries the 2026-09-06 state, the RANKED PLAN (rebuilt by hand after the synthesis agent died), the four decisions waiting on the user, and the exact next file for each option. Not an authoring lane — it takes no language lock.
metadata:
  type: project
---

# 🔴 START HERE — audit & "what next"

> **Read this instead of re-running an audit.** Everything below was measured on
> 2026-09-05/06 against a clean tree. Re-deriving it costs an evening and produced two wrong
> numbers the first time. If a number here disagrees with an older memory, **this file and
> [progress_corpus_audit_20260905.md](progress_corpus_audit_20260905.md) win.**

**This cursor takes NO language lock.** It answers *what should we do*, it does not author. If
the user names a language, stop reading here and go to that language's cursor in
[LOCKS.md](LOCKS.md).

---

## 1 · Where we are — 2026-09-06

**Corpus:** 5,816 leaf pages · 1,391,717 lines · 29 tracks · **74%** of 3,337 topics
(2,457 written after the dashboard fix).

**Repo state:** working tree clean, `main` level with `origin` at `a92c8ced`. The dashboard
fix `a1b89668` **is pushed and live**.

### The three goals, and where each stands

| # | Goal | State |
|---|---|---|
| 1 | **Complete pending tasks** | Measured and ranked — §2 below. Nothing started; no lock held. |
| 2 | **Verify accuracy / find missing topics / is it up to date** | ✅ Corpus-wide done. **Per-track: only Next.js and TanStack finished** — see [progress_audit_workflow_findings_20260906.md](progress_audit_workflow_findings_20260906.md). Five tracks were dispatched and died unmeasured. |
| 3 | **Anything being missed** | ✅ Four things found: the dashboard over-credit (FIXED), the linkchecker being unreliable, the stale homepage footer (FIXED), and **Git 63% out of contract in a track showing 100%**. |

### ✅ Disk vs dashboard reconciled AND all six gaps FIXED — 2026-09-06 (session `6d1f050c`, repo `d924ae26`)

**Read [progress_disk_vs_dashboard_validation_20260906.md](progress_disk_vs_dashboard_validation_20260906.md)
before re-measuring anything on this page.** Every track's page count, topic count,
validated count and freshness stamp was measured off disk against `progress.js` and
`page-counts.json`. **Page counts are exact on every track.** Six real gaps found —
Jest & RTL's 100% vs its 59-topic syllabus, JavaScript's "526/526 validated" against a
disk truth of 525, JS phase 18's undocumented 10-vs-18, two off-by-ones, Storybook's 22
unlisted pages, and 8 stale `updated` stamps. **All six are fixed and pushed** (`d924ae26`): the
validated count is now measured from disk rather than inferred, JavaScript is
97% not 100%, Jest & RTL 27% not 100%, Storybook 31% not 40%, two syllabi gained
the row their written page already had, and eight stamps were repointed. It also
confirms by measurement the three "do not fix" entries in §5 below, so they need
no re-checking.

🔴 **The dashboard percentages on this page are now STALE where they moved.**
JavaScript, Jest & RTL and Storybook all read lower and more honestly; re-read
the site's numbers rather than the ones quoted in §1.

### Fixed and shipped this pass

- 🔴 **Dashboard was crediting 7 unwritten topics.** `phaseStatus()` reads any phase with
  `pages > 0` and no `pagesPlanned` as **written**, and `summarise()` then credits it *all* its
  topics. Java phase 13 (6 phantom) and MongoDB phase 6 (1) both had it. Java 83%→80%,
  MongoDB 49%→48%. Commit `a1b89668`, with the trap documented in the header comment of
  `src/data/progress.js`.
- **Homepage footer was stale in both halves** ("August 2026", "Node 26.7.0 current"). Now
  derived from `lastUpdated()` and `PINS.node` — it cannot go stale again.

---

## 2 · 🔴 THE RANKED PLAN

> Rebuilt by hand on 2026-09-06. The workflow's synthesis agent died on the usage limit —
> see §0 of [progress_audit_workflow_findings_20260906.md](progress_audit_workflow_findings_20260906.md).

**Ranking principle: a live page that is WRONG outranks a topic that is MISSING.** A missing
page teaches nobody anything; a wrong page teaches the wrong thing to someone who trusts it.
Everything in tier A is already published.

### Tier A — published and defective (do these first)

> 🔴 **STATE AT 2026-09-06 EVENING SAVE — read before acting.**
> **A1 is CLOSED** (all 36 git pages, pushed). **A2's first round was IN FLIGHT** when the
> session saved: four agents on babel, vite, playwright and tanstack-query, bounded slices,
> none of them committing. **A3 is inside the tanstack agent.** At save time **0 of 164 A2
> pages were stamped** and one file was mid-write —
> `docs/vite/pages/01-core-architecture/01-dual-engine-model.md`. A cold session should
> `git status --porcelain docs/` first and treat anything stale as salvage: QC it
> (mdxcheck **without** `--no-rawtag`, linkcheck, cap, `yarn validate --guard`) and commit
> it before starting anything new.
> ⚠️ **The user's standing instruction at save time: deploy NO more agents.** The remaining
> A2 pages are a fresh decision, not an assumed continuation.
> Full record: [[devbible-session-20260906-angular-close-and-tier-a]].

| # | Work | Size | Why it is first |
|---|---|---:|---|
| ~~A1~~ | ✅ **DONE 2026-09-06 — all 36 written, 5–8 questions each, per-file commits, pushed.** Every git page now carries the section; cap, linkcheck and mdxcheck (raw-tag ON) all clean. Record: [[devbible-git-a1-interview-questions-20260906]] | 36 files | 🔴 It broke the build once: a bare `<sha>` in an italic quote is a JSX tag, and the project's own `mdxcheck --no-rawtag` cannot see it — [[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]] |
| **A2** | **Validate the 11 imported toolchain tracks** — ✅ now has a mechanism: `yarn validate --queue --scope imported` | 164 pages, **0 validated** | These are *live and unverified*. framer-motion's **13 wrong imports** were already proven on disk — so the category is known to contain real errors, not hypothetical ones. |
| ~~A3~~ | ✅ **CLOSED — verified on disk 2026-09-08.** Both defects were already fixed by session `4e8d4393`: `09-prefetching-and-ssr/01-…md` teaches `queryClient.query()` and frames `prefetchQuery` as deprecated throughout; `01-core-concepts/01-…md` uses `useQuery({ queryKey: ['user', 1] })`. A track-wide sweep for `useQuery([`, `cacheTime`, `ensureQueryData`, `isInitialLoading` and `keepPreviousData` found **every** remaining mention correctly framed as v4-was/deprecated. 🔴 **Do not re-open this row on the strength of a grep hit** — the hits are deliberate migration teaching. | 2 files | — |

### Tier B — correct today, expires on a date

| # | Work | Size | Deadline |
|---|---|---:|---|
| ~~B1~~ | ✅ **CLOSED 2026-09-08 — 140 pages de-expired, pushed.** 🔴 It was **not** a 24→26 bump: Node 26 is not Active LTS until 2026-10-28, so bumping would have published 140 *wrong* pages for seven weeks. Triage class 6 (`event`): the expiring **phrase** was rewritten, the version left alone. 120 files one line each, 20 read and rewritten. Record: [[devbible-currency-node-lts-b1-20260908]] | 140 files | — |
| **B2** | **Next.js `io()`** | 1 new page + 1 pointer | No date, but it is a **Master-tier** gap and upstream already says *"prefer `io()` over `connection()`"*. Do **not** sweep the ~50 files teaching `connection()`. |

### Tier C — decisions, not work (§3)

`TypeScript 7.0.2 vs 363 pages` · `Flyway 12→13.5.0` — both are one user answer away from
being either a large sweep or a no-op. **Ask before doing either.**

### Tier D — the actual unwritten backlog: 715 topics

Angular **211** · Nginx **164** · Python **143** · Redis **73** · Java **46** · MongoDB **43**
· Storybook **35**. This is the biggest number on the page and it is **deliberately last** —
it is the only tier where nothing is currently wrong. One language per session, user's choice.

### Tier E — opportunistic, never a session's goal

- **13 files over the 300-line cap** (7 storybook, 4 python, 2 reviews) — split when next in
  that file, on a concept boundary, both totals UP.
- **834 unattributed output blocks** (was 636). Not an emergency. Attribute as pages are
  touched; a dedicated sweep is not worth an evening.

---

## 3 · 🔴 Four decisions waiting on the user

Nothing below should be started without an answer — each one is either a large sweep or a
no-op depending on the reply.

1. **TypeScript: the pin says 7.0.2, 363 pages say 5.9.3.** Bump the pin and sweep, pin to 5.9
   as an LTS-style track, or leave the pages and change the policy? **363 pages ride on this.**
2. **Flyway 12 → 13.5.0 is a MAJOR** across ~50 pages. Sweep, or pin `frozen` at 12 and note
   13 exists?
3. ~~**Node 26 LTS (B1) — scriptable or hand-edited?**~~ ✅ **Answered by doing it, 2026-09-08.** Both: 120 files were a `sed` on an exact string, 20 needed eyes. The deadline no longer applies — the corpus no longer makes a claim that 2026-10-28 falsifies.
4. **The 834 unattributed output blocks** — is this an emergency or is Tier E right?

---

## 4 · The exact next file, per option

`ls`-verified 2026-09-06.

| If the user says… | Start at |
|---|---|
| "validate X" / "A2" / "what is unchecked" | 🔴 **`yarn validate --queue`** — the pipeline built 2026-09-06 answers this from disk. Loop: `.agents/references/validation-pipeline.md`; ledger: [VALIDATION-LEDGER.md](VALIDATION-LEDGER.md). |
| "do the git fix" / "A1" | `docs/git/pages/phase-1-everyday-loop/03-git-commit.md` — then the other 35 in the order the §5 command prints them. |
| "fix tanstack" / "A3" | ⛔ **A3 is closed** (see §2 tier A). The real tanstack backlog is validation: topics **11, 14, 15, 16**. Cursor: [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md) |
| "next.js io()" / "B2" | `docs/nextjs/pages/05-caching-ppr-and-cache-components/01c-flipping-the-flag-on-an-existing-app.md` — read it first; the new page sits beside it. |
| a **language** | Stop. Go to [LOCKS.md](LOCKS.md) §11, that language's START HERE. This cursor does not apply. |

---

## 5 · 🔴 Do NOT redo these

- ⛔ **Do not re-run `devbible-linkcheck.py` and act on it.** Its **138 "broken links" are ALL
  false positives** — it does not apply Docusaurus's `numberPrefixParser`, which strips the
  `NN-` prefix from routes. The authority is `onBrokenLinks: 'throw'` in a real CI build.
  Repairing what it flags **breaks working links**.
- ⛔ **Do not "fix" `pages < topics`** on Node phases 0–5 or React phase 0. Those are
  **documented syllabus-row merges** with a Coverage table in each phase README. Not gaps.
- ⛔ **Do not add `★` to the 146 TypeScript / 71 Python pages that lack it.** House style
  permits the `**Symptom:` / `**Cause:` / `**Fix:` bold lead-in, and that is what they use.
- ⛔ **Do not compute completion as `sum(pages)/sum(topics)`.** That gives Next.js 131% and
  PostgreSQL 128%. `summarise()` credits a *written phase* its **`topics`**, not its `pages`.
  Import the site's numbers; never re-derive them.
- ⚠️ `yarn currency --check` and `node scripts/status.mjs` **write** `static/currency.json`
  and `static/status.json`. Expect a dirty tree; `git checkout --` them after.

```bash
# the 36 Git files, regenerated:
find docs/git/pages -name '*.md' ! -name 'README.md' | sort | \
  while read f; do grep -q '^## Interview questions' "$f" || echo "$f"; done
```

Related: [[devbible-disk-vs-dashboard-validation-20260906]] · [[devbible-corpus-audit-20260905]] ·
[[devbible-audit-workflow-findings-20260906]] · [[devbible-locks]] ·
[[devbible-feedback-verify-in-ci-not-locally]]
