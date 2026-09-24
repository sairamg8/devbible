---
name: devbible-javascript-concepts
description: Index of the per-phase JavaScript concept records — what every written page already explains, so a session need not open the pages
metadata:
  type: reference
---

# devbible — JavaScript concept coverage, per phase

**What this is:** the *concepts* covered by every written JavaScript page, phase by
phase, so a session can tell what is already explained **without opening the pages**.
Written 2026-08-13 because several sessions run at once and re-deriving this from the
files costs more than reading it.

**Companion file:** [progress_javascript_phase3_worktree.md](progress_javascript_phase3_worktree.md)
carries the resume point, the commits and the traps. This file carries the *content*.

> **Claim:** JavaScript is claimed by session `01ECVvH5` as of 2026-08-13, recorded on
> both boards in `docs/README.md` and in `docs/javascript/pages/README.md`.
> **Check those before picking JavaScript up.**

---

## Provenance — two kinds, never mixed on one page

| Provenance | Which pages | Meaning |
|---|---|---|
| **Measured** | Phases 0–2, Phase 3 topics 01–07 | Console blocks produced by a script in `sandbox/js-*/` on Node 24.19.0 (V8 13.6). `.cjs` companions for sloppy-mode/CommonJS behaviour |
| **Documentation-validated** | **Phase 3 topic 08 onward** | Claims checked against MDN / the spec / V8's blog, cited by name and link in each `> Verified:` line. **No new sandboxes. No run means no console block** |

Where a documentation-validated page needs a fact an *existing* run already covers, it
**links to the page that owns that output** rather than reproducing it.

---

## Per-phase children — open only the one you need

**Split 2026-08-14** when this file hit 774 lines, well past the 300-line memory cap
([[devbible-memory-file-cap]]).

| Child | Open it when |
|---|---|
| [reference_javascript_concepts_phase3-4.md](reference_javascript_concepts_phase3-4.md) | working on **functions/scope/closures** or **objects/prototypes/classes** — `this`, `call`/`apply`/`bind`, the prototype chain, `class`, copying |
| [reference_javascript_concepts_phase5.md](reference_javascript_concepts_phase5.md) | working on **the built-in library** — arrays, `reduce`, `sort`, strings, `JSON`, `Map` |
| [reference_javascript_concepts_phase6.md](reference_javascript_concepts_phase6.md) | working on **iteration and destructuring** — destructuring, loop forms, spread with iterables |
| [reference_javascript_concepts_phase7.md](reference_javascript_concepts_phase7.md) | working on **async** — event loop, microtasks, callbacks, promises, chaining, async/await, error handling, parallelism, combinators, anti-patterns. **Master tier COMPLETE** |
| [reference_javascript_concepts_phase8.md](reference_javascript_concepts_phase8.md) | working on **modules, errors, memory, toolchain**. **Master tier COMPLETE** |
| [reference_javascript_concepts_phase9.md](reference_javascript_concepts_phase9.md) | working on **the DOM**. **Master tier COMPLETE** |
| [reference_javascript_concepts_phase10.md](reference_javascript_concepts_phase10.md) | working on **events and user input**. **Master tier COMPLETE** |
| [reference_javascript_concepts_phase11.md](reference_javascript_concepts_phase11.md) | working on **network, storage, data transfer**. **Master tier COMPLETE** (01–05) |
| [reference_javascript_concepts_phase12.md](reference_javascript_concepts_phase12.md) | working on **the browser platform** — DevTools, client-side security. **Master tier COMPLETE** (01–02) |
| [reference_javascript_concepts_phase13.md](reference_javascript_concepts_phase13.md) | working on **complexity and real costs**, or any DSA phase. **Master tier COMPLETE** (01–03). Carries the `Map`-is-sublinear-not-O(1) quote used everywhere |
| [reference_javascript_concepts_phase14.md](reference_javascript_concepts_phase14.md) | working on **core data structures**, or any DSA phase. **Master tier COMPLETE** (01–05). Carries the O(1)-queue lines everyone omits, the HashMap `Math.imul`/`>>> 0` details, and the monotonic-stack recognition rule |
| [reference_javascript_concepts_phase15.md](reference_javascript_concepts_phase15.md) | working on **algorithmic patterns**, or any DSA phase. **Master tier COMPLETE** (01–04, 06). Carries the recognition rules the phase gate asks for, and the **MDX nested-backtick build failure** |
| [reference_javascript_concepts_phase16.md](reference_javascript_concepts_phase16.md) | working on **dynamic programming**, or any interview-method question. **Master tier COMPLETE** (01–03). Carries the two-condition test, the `cache.has` trap, and the seven-step method with a full worked run |
| [reference_javascript_concepts_phase17.md](reference_javascript_concepts_phase17.md) | working on **machine coding / implement-it-yourself**. **Master tier COMPLETE** (01–04). Carries every MDN quote for the array-method contract, `bind` under `new`, and the four Promise combinators' empty-input behaviours |
| [reference_javascript_concepts_phase18.md](reference_javascript_concepts_phase18.md) | working on the **applied storefront**, or any applied front-end question. **Master tier COMPLETE** (01–07) — the last Master topics in the corpus. Carries the URL-as-state rule, the three search-box bugs, the API client's layer order, the money rules, and the five causes of a double order |

Phases 0–2 predate this record and are not covered here; they are measured, and the
pages themselves are the reference.

---

## 🔴 Honest self-audit of the 300-line rule (2026-08-13/14)

Two findings a later session should know, because a clean `wc -l` is not the whole story.

**1. Every file is under the cap, but the CHUNK lengths cluster.** 52 chunks written this
session: min 168, median 231, max 279. The histogram:

```
160-179: ##
180-199: #####
200-219: ############
220-239: ###############
240-259: ###############
260-279: #########
```

That is exactly the *"narrow band just under the cap"* signature the rule warns about.

**The defence, and its limit.** *Topic totals* do vary widely — hoisting/TDZ is 1360 lines
across 6 chunks, object literals 990 across 4, sync-vs-async 230 in 1 — so **coverage was
not cut**, which is what the rule actually protects. But **chunk sizes are more uniform
than concept boundaries alone would produce**: when splitting, I reached for 2–3 roughly
equal parts rather than letting a genuine boundary produce, say, a 90-line chunk beside a
280-line one. The near-absence of chunks under 160 is the tell.

**For the next session:** split where the concept ends, and **accept a short chunk**. A
120-line chunk that covers one idea completely is correct; padding it toward 230 for
symmetry is the failure mode this rule exists to prevent.

**2. Phase READMEs carry no `> Verified:` line, and that is correct.** 74 of 78 pages have
one; the four without are the phase indexes (phase-4/5/6/7 `README.md`), which describe a
phase rather than making claims. Topic READMEs *do* carry one. Do not "fix" this.

---

## Build note — a stale cache can fake a broken link

An **incremental** `yarn build` reported phase-5 topic 01's sibling links
(`./README.md`, `./02-holes-and-length.md`) as broken, immediately after topic 02's
files were added. A **full clean rebuild** —
`rm -rf .docusaurus build node_modules/.cache && yarn build` — was clean.

**So: never act on a link report from an incremental build.** Clean-rebuild first.
This is the same family as the duplicate-doc-id failure the docs README warns about in
a shared checkout: the failure is the build state, not the content.

---

## Phases 0–2 (pre-existing, measured) and 6–18

Phases 0–2 were written before this session (44 topics, measured). **Phases 6–18 are
untouched.** Phases 3, 4, 5 and 6 Master tiers are all **complete**; Phase 7 is in progress.

🔴 **Resume point: Phase 7 topic 04 (callbacks)**, then 05–11. Phase 7 has
**eleven** Master topics and is the syllabus's centre of gravity: *"If you only ever
finish one phase to Master depth, finish that one."* Deferred Understand/Know topics across phases 3, 4 and 5 stay deferred under
Master-first.

## 🔴 Syllabus audit — 2026-08-14, and two numbers it corrected

Parsed all five `docs/javascript/syllabus/*.md` part files for every topic row + tier badge,
then matched topic numbers against `docs/javascript/pages/phase-*/`. **Topic counts confirmed:
132 of 337 written, matching `progress.js` exactly. Master 99/99 · Understand 23/170 ·
Know 9/64 · When Needed 1/4.** 53,684 lines across 310 files, median topic 428 lines.
Full report published as an artifact.

Two figures in the boards and in this file were wrong and are **not** to be copied forward:

1. **"253 pages" is wrong — it is 231.** Carried in the Cursor table above *and* `docs/README.md`
   line 101. `docs/javascript/` holds **231** non-README `.md` files (336 counting every README).
   The tell was internal: this file claimed *311 files carrying `> Verified:`* against 253 pages,
   i.e. more verified files than pages. Actual verified count is **312**. Left unfixed in the
   docs — no language was named for writing this session.
2. **[[devbible-javascript-syllabus]]'s tier table sums to 340, not 337** — it says
   "100 Master · 170 Understand · 66 Know · 4 When Needed". Badge count gives
   **99 · 170 · 64 · 4 = 337**. So Master is **99**, and "all 99 Master topics written" is exact.

Thinnest phases by coverage: **12 · browser platform 2/21**, 16 · DP 3/16, 13 · complexity 3/10,
6 · iteration 3/13. Phases 0–2 are the only ones complete at every tier.
