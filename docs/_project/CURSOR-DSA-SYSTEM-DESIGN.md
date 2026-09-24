---
name: cursor-dsa-system-design
description: 🔴 START HERE for the two devbible tracks docs/dsa/ and docs/system-design/. Syllabi complete 2026-09-07; EXPLANATION PAGES IN PROGRESS since 2026-09-07 (session 9602e64d, user said "Continue DSA and System Design"). Standing order, position, the NEXT FILE by exact name, the page-naming plan per phase.
metadata:
  type: project
---

# 🔴 START HERE — DSA + System Design (syllabus + card)

## ⏹️ WOUND DOWN FOR THE DAY — 2026-09-08 19:31, session `0e733592`

**Everything below is committed and PUSHED in both repos. Nothing is half-written. No agent is
running.** devbible last commit is the phase-3 scaffold; the store carries this cursor, LOCKS §0k,
the phase-3 research bank and the phase-3 dispatch brief.

**What a cold session should do first:** read this file top to bottom. DSA phase 2 is **closed**;
System Design phase 3 is **scaffolded, banked, briefed and un-started** — the next action is to
re-dispatch the four-agent wave described below. Nothing needs re-measuring or re-fetching.

---

## ✅ SAVE POINT — 2026-09-08, session `0e733592` — **DSA PHASE 2 IS CLOSED AND PUSHED**

**The user's words:** *"Continue on DSA and System design deploy the agents you need … pick per
chapter once and deploy agents to complete that chapter max 4 would be fine each time you deploy
please save session progress and once they return back update session progress … i am stepping
outside do not wait for me"*, then *"continue with the next chapter once F lands and before that
commit everything and deploy"*, then *"Please save session progress"*.

🔓 **Lock RELEASED on DSA phase 2. Tree clean. All committed and PUSHED** (`a2cf8e5a`).

### The chapter, closed

**13 / 13 topics · 111 files · ~27,300 lines · ~1,090 ★.** Seven `devbible-author` agents in three
overlapping waves, never more than four at once, each returning to a gate → commit → save cycle.

| Topic | Files | Commit |
|---|---:|---|
| 01 recursion and the call stack · 02 divide and conquer | 8 · 9 | `1fdb85d3` |
| 03 mathematical foundations · 07 fast exponentiation | 12 · 6 | `4dda98d6` + close |
| 04 bit manipulation · 05 integer limits and overflow | 7 · 6 | `e9533ad6` |
| 06 backtracking skeleton · 08 combinatorics | 11 · 7 | `05440cf0` + close |
| 09 bitmask enumeration · 12 matrix exponentiation | 9 · 5 | `2a817c40` |
| 10 randomisation · 11 number problems | 10 · 10 | `693fa168` + close |
| 13 geometry basics | 11 | `091dc6d1` |

🔴 **13 dispatches, 13 splits, 0 trims.** Rule 7 verbatim in the dispatch brief did it again —
see [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md) §7. Peak mid-write drafts: 477, 408, 391.
✅ **Fresh-write dispatches: 7 of 7 returned. None stalled.** The lane's rule holds — dispatch
agents for fresh writes, do splits and extends in-session by hand.

### 🔴🔴 THE FINDING WORTH CARRYING TO EVERY OTHER TRACK

**`sidebar_position` is read by Docusaurus as a NUMBER, and the documented duplicate check cannot
see a decimal collision.** Topic 03 reached twelve chunks, so its splits were numbered `3.10` and
`3.11` — but `3.10 == 3.1`, which collided with `03b`, and `3.11` sorts *before* `3.2`. Three pages
were in the wrong order.

```bash
grep -h '^sidebar_position:' <dir>/*.md | sort -n | uniq -d   # ⛔ PRINTS NOTHING — uniq compares STRINGS
python3 -c "import glob,re,collections; c=collections.Counter(float(re.search(r'^sidebar_position:\s*([\d.]+)',open(f).read(),re.M).group(1)) for f in glob.glob('*.md')); print([k for k,v in c.items() if v>1])"
```
🔴 **The float check is the real one.** Fixed here as `3.95` / `3.96`, matching the `13.95` that
agent G had already invented independently when topic 13 hit eleven chunks.
**Convention from now on: a topic past nine chunks numbers its tenth and later `.95`, `.96`, …**
⚠️ **Any other track with a topic past nine chunks has this bug right now and does not know it.**

### The other thing that bit, and will again

🔴 **Three files had been reflowed by their agents to sit at exactly 300 lines — and the footer
chain then pushed them over.** The cap counts the footer; a page written to exactly 300 is not
finished, it is one boilerplate block away from breaking the rule. They were **split, not trimmed**
(`06`→`06k` shared state · `07`→`07f` any monoid · `10e`→`10j` the secure APIs), each proven up on
both totals.
✅ **Tell the next wave: aim under ~285 AND carry rule 7** — the two together, never "≤285" alone,
which is what forces the violation.

### Also worth banking
- **The shared dispatch brief was written to the session scratchpad and something deleted it
  mid-run.** Agents dispatched later fell back to their own prompt and lost nothing, because each
  prompt was self-contained. 🔴 **Next time the shared brief goes in this store, not the scratchpad.**
- **Six extra primary sources were spent** and should be folded into
  [research_dsa_phase2.md](research_dsa_phase2.md) if it is reused: JDK 25 `String.hashCode`,
  `BigInteger`, `Random`/`SecureRandom`/`ThreadLocalRandom`, `Comparator`, `Integer.parseInt` /
  `toBinaryString`, and MDN `Operator precedence`, `Crypto.getRandomValues`, `parseInt`, remainder.
- ⛔ `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md` has `sidebar_label: "03 · …"` with
  `sidebar_position: 4`. **That is CORRECT** — phase 1 inserted `02b`, so every later position is one
  ahead of its label. Do not "fix" it.
- **Three out-of-lane MDX-hardening edits** (two tanstack-query, one vite) were found idle 12+
  minutes in this shared checkout and committed as salvage (`22af134e`) rather than left to rot.

---

## 🔴 NEXT CHAPTER — **System Design phase 3, "Caching everywhere"** (16 topics)

**Alternation says System Design is next, and phase 3 is the one.** Nothing is written; the
directory is **not yet scaffolded**.

✅ **The research bank is already fetched — [research_system-design_phase3.md](research_system-design_phase3.md).**
Eight primary sources banked 2026-09-08: RFC 9111 (freshness, every response directive, `Vary`,
stale rules, invalidation by unsafe methods), RFC 9110 (validators, safe/idempotent), RFC 5861
(`stale-while-revalidate`, `stale-if-error`), RFC 8246 (`immutable`), MDN `Cache-Control` (the
`no-cache` ≠ "don't cache" sentence and the `private` leak sentence), the Redis key-eviction page
(approximated LRU, LFU/Morris counters, LRM, `maxmemory`, the hit-ratio formula), Caffeine
(W-TinyLFU, the full-scan sentence), and Cassandra's ring + vnode docs. 🔴 **Do not re-fetch.**
⚠️ The Dynamo PDF will not parse — the phase-0 bank already holds its quotes; use those.

✅ **Scaffolded and committed** — `docs/system-design/pages/phase-3-caching/` with `_category_.json`
and a README carrying all 16 ⬜ rows and the phase `> Verified:` line.
✅ `src/data/progress.js` already had `{n: 3, slug: 'phase-3-caching', … topics: 16, pages: 0}` —
the slug is **`phase-3-caching`**; do not invent a longer one.

🔴 **The shared dispatch brief lives in THIS STORE now, not a scratchpad:**
[BRIEF-sd-phase3-caching.md](BRIEF-sd-phase3-caching.md). It carries rule 7 verbatim, the
🔴 **`.95` escape past nine chunks**, the "aim 250–285, not 300, because the footer is appended at
close" warning, and the ban on linking an unwritten sibling.

### ⏹️ WAVE 1 WAS DISPATCHED AND THEN **SIGNALLED DOWN** — 2026-09-08 19:31

**The user's words:** *"Signal everything to winddown and save session progress enough for the day."*

🟢 **All four agents stopped cleanly, and NOT ONE had written a file.** Three were still reading the
brief; the fourth had just begun topic 02's parent file and had not saved it.
✅ **`docs/system-design/pages/phase-3-caching/` contains exactly the committed scaffold — `README.md`
and `_category_.json`, nothing else. There is NO salvage to recover, and no half-written page.**
✅ Working tree clean for this lane. Everything committed and pushed in both repos.

🔴 **THE NEXT SESSION RE-DISPATCHES THIS EXACT WAVE FROM SCRATCH.** The four assignments below are
still correct and nothing is owed against them:

| Agent | Topics | Positions |
|---|---|---|
| A | 01 where a cache can live · 07 HTTP caching semantics | 1 · 7 |
| B | 02 the four strategies · 03 invalidation | 2 · 3 |
| C | 04 stampede and thundering herd · 12 negative caching and penetration | 4 · 12 |
| D | 05 consistent hashing · 06 hot keys and skew | 5 · 6 |

Each agent's prompt is reconstructible from [BRIEF-sd-phase3-caching.md](BRIEF-sd-phase3-caching.md)
plus that topic's syllabus row in
`docs/system-design/syllabus/02-the-network-path-and-caching.md` (§ *Phase 3 — Caching everywhere*).
🔴 **Point every agent at the brief in this store — the previous chapter's brief was written to a
session scratchpad and something deleted it mid-run.**

**Wave 2, queued:** 08 what not to cache · 09 eviction policies · 10 distributed caches ·
11 caching computed results · 13 measuring a cache · 14 in-process caches · 15 the storefront ·
16 cross-region coherence. (15 should go **last** — it is the phase's synthesis page and wants the
others on disk. 08 pairs naturally with whatever frees first; 09 and 14 share the Redis/Caffeine
half of the bank.)

🔴 **Salvage rule if this session died mid-wave:** agents write straight into the phase directory.
Anything there untouched for 10+ minutes is salvage — QC it (`wc -l`, `bash gate.sh <dir>`, footer
markers, **float** duplicate check on `sidebar_position`) and commit it before writing anything new.
Expect 3–7 files per topic.

**Owed by the session at close (never by an agent):** the footer chain in one pass
(`scratchpad/chain.py` pattern — rewrite every `{/* FOOTER */}` in `sidebar_position` order), the
re-link sweep (`grep -rn '(not written yet)'` must end empty), the phase README table, the pages
board, `progress.js` pages+updated, `docs/README.md`, `page-counts.mjs`, `status.mjs`, then the
gate and explicit-path commits.

---


---

> 🗄️ **268 lines of superseded history moved to [CURSOR-DSA-SYSTEM-DESIGN-HISTORY.md](CURSOR-DSA-SYSTEM-DESIGN-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-DSA-SYSTEM-DESIGN-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
