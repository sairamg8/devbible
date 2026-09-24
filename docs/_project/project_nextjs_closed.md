---
name: project-nextjs-closed
description: 🔴 THE NEXT.JS TRACK IS CLOSED — 2026-09-05. The user's 90% bar, applied to quote-level accuracy, and the measured numbers that cleared it. Read this before reopening the track or re-running any validation programme; it records what "done" was defined as and why.
metadata:
  type: project
---

# 🔴 Next.js — CLOSED, 2026-09-05, session `d2e9b9fe`

**User's decision, verbatim:** *"apply the 90% bar to quote-level and close it"*.

That resolved the open question the whole validation programme hung on. Two metrics disagreed
sharply about the same corpus, and the user chose which one "done" is measured against.

## The bar, and the numbers that cleared it

| Metric | Result | Bar |
|---|---:|---|
| **Quote existence** — does the quoted sentence exist in the real source? | **96.3%** | ✅ PASS |
| **Attribution** — does it match the page it cites? | **99.5%** | ✅ PASS |

**Quote existence, derived rather than asserted:** 3,280 quotes · 2,541 proven verbatim
mechanically (77.5%) · 739 unmatched · **86 of those read by hand → 72 clean, 14 real defects
(83.7% clean)** · projecting that rate over the unmatched gives **3,160/3,280 = 96.3%**.

🔴 **96.3% is a FLOOR, not an estimate.** The 86 were drawn from the *worst-scoring* band — the
quotes with the least real text behind them. Every better band carries proportionally fewer
defects, so the true figure is higher.

**Attribution:** 399 quotes carry a resolvable inline citation · 48 flagged · **34 read → 32 clean,
2 real** · **397/399 = 99.5%**.

## ⚠️ The metric that was REJECTED, and why that was right

Chapter-level S1/S2 review scored **0–70%** (ch01 67% · ch03 70% · ch05 lanes 40/50/**0**%), and on
that metric the same corpus fails badly. **It fails an entire page for a single defect**, so a
250-line page with one altered quote scores the same as one that is wrong throughout. It measures
*pages touched by a defect*, not *how much of the corpus is wrong*.

🔴 **Both numbers are true. They answer different questions.** Anyone reopening this should not
"discover" the 0–70% figure and conclude the corpus is broken — that comparison is already made,
and the decision is recorded here.

## What "closed" means, precisely

**Closed = written, shipping, and measured at ≥90% on the agreed metric.** It does **not** mean
every page is validated.

- ✅ **659 pages**, 20 chapters, every page badged and carrying a `> Verified:` line
- ✅ **CI green on build AND deploy**, `onBrokenLinks: 'throw'`, **0 broken links**
- ✅ **Quote accuracy ≥96.3%**, attribution 99.5%
- ⚠️ **`> Validated:` coverage is 47 of 659 files (~7%)** — deliberately not the closing criterion

## Still open, and explicitly accepted as not blocking

1. **~46 misattributed + ~39 self-quoted quotes.** Worklists were deleted at windup —
   **regenerate with `shared/scripts/quotesweep.py`**, do not hunt for the old JSON.
2. **Two house-convention questions, raised twice, never decided:** bold added inside quotes the
   source lacks; signatures elided inside quotes. 🔴 **Do not mass-change either** — write the
   convention into `.agents/references/house-style.md` instead.
3. `DATABASE_URL_DIRECT` vs `DIRECT_URL` (ch15 `01b`/`01c` are the outliers) · PostgreSQL **18.6**
   vs pinned **18.4** (currency lane's call) · ch03's four depth findings (**authoring, not
   validation**).

## 🔴 What should reopen this track

**Not a validation programme.** Reopen for:
- a **Next.js release** that moves the version spine → `devbible-currency`, not this
- a **reader-reported error** → fix the page, do not restart a sweep
- **`quotesweep.py` after an upstream doc rewrite** — one command, and the tool refinements it
  still needs are listed in [[reference-nextjs-quote-sweep]]

## Where this connects

- [[reference-nextjs-quote-sweep]] — the tool, the five defect classes, the false-positive classes
- [[project-nextjs-validation-sample]] — the rule, the prior evidence, the sample that was drawn and deliberately not run
- [[progress-nextjs-session-d2e9b9fe]] — the session that closed it
- [[cursor-nextjs]] — the position
