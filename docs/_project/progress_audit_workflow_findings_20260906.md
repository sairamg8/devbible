---
name: devbible-audit-workflow-findings-20260906
description: The findings that SURVIVED the two multi-agent audit workflows before the session usage limit killed both synthesis agents — TanStack Query (the pin flag is a false positive; two real v4/deprecated defects) and Next.js (missing `io()` from next/cache is a Master-tier gap; `connection()` is STALE across 50 files). Also records that workflow resume is same-session only and /tmp scratch is wiped between sessions.
metadata:
  type: project
---

# Deep-audit findings that survived — 2026-09-06

Companion to [progress_corpus_audit_20260905.md](progress_corpus_audit_20260905.md), which
holds the corpus-wide numbers. **This file holds the per-track findings** produced by two
multi-agent workflows run on the night of 2026-09-05.

---

## 0 · 🔴 Why this file exists at all — the lesson, before the findings

Two workflows were dispatched (31 agents total):

| Run | Purpose | Outcome |
|---|---|---|
| `wf_c234596c-588` | "what should we do next" — per-track audit → adversarial verify → **ranked plan** | 🔴 **synthesis agent errored** |
| `wf_94064f57-10e` | cross-track **syllabus-gap** synthesis | 🔴 **synthesis agent errored** |

**17 of 31 agents hit the session usage limit**, including *both* synthesis stages. So the two
things actually asked for — a ranked plan and a cross-track gap list — **were never produced**.

Two hard lessons, both worth more than the findings below:

1. 🔴 **`Workflow(resumeFromRunId:)` is SAME-SESSION ONLY.** A dead workflow cannot be
   resumed tomorrow. When the limit hits, the run is gone for good.
2. 🔴 **The scratch dir is wiped between sessions.** The journals
   (`…/subagents/workflows/<runId>/journal.jsonl`) and the task `.output` files that held all
   31 agents' raw output lived under `/tmp/claude-1000/…/<sessionId>/`. That directory was
   **empty by 05:34 on 2026-09-06**. Everything below survived only because it was still in a
   conversation context that was compacted rather than closed.

**The rule this produces:** *a multi-agent finding is not banked until it is in this store.*
Copy per-agent output into `/mnt/Storage/my-learning/claude/` **as each stage completes** —
never at the end, never "once synthesis lands". Related:
[[devbible-feedback-memory-update-cadence]].

**Corollary for scale:** a 31-agent fan-out is over the line for one session. Keep a workflow
to a size whose *synthesis* is reachable — the per-track agents are cheap and the synthesis is
the only part that cannot be reconstructed by hand.

---

## 1 · TanStack Query — the currency flag is a FALSE POSITIVE

`yarn currency --check` flags `tanstack-query`. **It is wrong, and the pin is right.**

- `pins.js` says **5.102.8** — registry-verified, published 2026-08-27. Correct.
- The **16 `docs/tanstack-query` pages contain zero semver strings.** Not one.
- All six "5.40.0" hits are in **`docs/nextjs`**, and they are **minimum-version floors** —
  *"Requires TanStack Query 5.40.0 or later"* — which is **factually correct**: v5.40.0 is the
  release that added promise dehydration.

🔴 **The mechanism, because it will fire again:** the pin declares
`tracks: ['tanstack-query', 'nextjs']`, so `scanPages()` **unions both directories** and then
compares every version string it finds against the pin. A legitimate *floor* sentence in a
neighbouring track is indistinguishable from a *stale pin* to that checker.
**Before acting on any currency flag, check whether the hits are floors and whether they are
even in the flagged track.** Do not "fix" `5.40.0` → `5.102.8`; that would make 6 correct
Next.js sentences wrong.

### The 16 pages are v5-correct but ~2 years behind on additions

Zero hits for every API removed in v5 — no `useQuery(key, fn, opts)` object-splat form, no
`cacheTime`, no `isLoading`-as-`isPending`, no `onSuccess`/`onError` callbacks on `useQuery`.
The v4→v5 migration was done properly.

**Two real defects, both small and both cheap:**

| File | Defect |
|---|---|
| `docs/tanstack-query/pages/09-prefetching-and-ssr/01-server-rendered-data-flow.md` | Headlines **`prefetchQuery`**, which is now `@deprecated`. Should teach **`queryClient.query()`**. |
| `docs/tanstack-query/pages/01-core-concepts/01-the-server-state-model.md:25` | Prose uses the **v4 positional form** `useQuery(['user', 1])`. v5 is object-only. |

Everything else is a *gap*, not an error: two years of additions (new hooks, new devtools
surface) are simply absent. Verdict: **accurate, incomplete**.

---

## 2 · Next.js — verdict **minor-gaps**, with one STALE item that spans 50 files

The track is **CLOSED** ([CURSOR-NEXTJS.md](CURSOR-NEXTJS.md)) and this does **not** reopen it
by itself. Recorded so the next reopen has a starting list.

**Missing, by tier:**

| Tier | Missing |
|---|---|
| 🔴 **Master** | **`io()` from `next/cache`** — absent from the corpus entirely. The upstream docs say *"Prefer `io()` over `connection()`"*. |
| Understand | Turbopack chunking configuration |
| Know | The **Videos** guide |
| Know | `experimental.inlineCss` |

🔴 **The one STALE item:**
`docs/nextjs/pages/05-caching-ppr-and-cache-components/01c-flipping-the-flag-on-an-existing-app.md`
**prescribes `connection()`**, which 16.3 no longer prefers. `connection()` is taught across
**~50 files**, so this is not a one-file edit — it is a decision about how to teach the pair.
**Recommended shape:** teach `io()` as the default in one new page, then add a one-line
"prefer `io()`" pointer to `01c`, and leave the other ~49 files alone until they are next
touched. A 50-file sweep for a preference change is not worth it.

**Bookkeeping drift (not a content gap):** **659 files on disk** vs the recorded count —
ch02 is **58 vs 51 recorded** and ch05 is **26 vs 21**. Twelve files that exist and are fine;
the board undercounts them. The chapter-16 renumber **verified clean against git**.

---

## 3 · 🔴 What was never measured — the 12 agents that produced nothing

These tracks were dispatched and **died before returning**. Nothing is known about them beyond
the corpus-wide numbers in the 2026-09-05 audit:

- **audits:** `git`, `docker`, `expressjs`, `jest-rtl`, `css`
- **every adversarial verify stage** in both runs

⚠️ **Absence of a finding here is not a clean bill of health.** If a future session needs a
per-track verdict for any of those five, it must still be measured. (Git is the exception —
its breach was found by direct measurement, not by an agent: see §6b of the corpus audit.)

Related: [[devbible-corpus-audit-20260905]] · [[cursor-nextjs]] · [[devbible-locks]]
