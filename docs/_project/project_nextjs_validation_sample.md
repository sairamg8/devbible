---
name: project-nextjs-validation-sample
description: The 20-file random sample drawn 2026-09-05 to decide whether the Next.js corpus needs full re-validation — the seed, the frame, the exact file list, the decision rule, and the prior evidence it is being tested against. Read before validating anything in the nextjs track.
metadata:
  type: project
---

# Next.js — the random validation sample, and the decision rule it settles

**User's rule, 2026-09-05:** *"rather than verify everything i want to verify random topics if they
give success rate about 90% then ok no need to verify if they give below we need to reverify
everything"*.

## The decision rule, stated precisely

**Success = a file with ZERO S1 and ZERO S2 defects.** S1 is flatly wrong; S2 is wrong for the
version we pin. Those are what burn a reader.

⚠️ **S3 and S5 do NOT count against the rate.** S3 is load-bearing-but-unsourced — a page saying
something plausible the docs do not settle is a documentation gap, not an error. S5 is cosmetic and
is ledger-only by rule. Counting them would make every page fail and the rule meaningless.

- **≥ 90% clean** → stop. Spot-check on version bumps instead of re-validating.
- **< 90%** → full re-verification of the track.

## 🔴 The sample is RANDOM and REPRODUCIBLE — that is the point

Earlier passes chose chapters by judgement (ch01/ch03 = "foundational", ch05 = "most volatile"),
which **biases the estimate downward**. This sample removes that.

```python
# frame: every .md in docs/nextjs/pages/ with no '> Validated:' stamp, excluding ch05 (in flight)
random.seed(20260905)
sample = sorted(random.sample(frame, 20))
```

**Frame: 612 unvalidated files across 17 chapters.** Simple random sampling over the frame is
automatically size-weighted — a 59-file chapter contributes proportionally more than a 10-file one,
which is what you want.

## The 20 files

| Chapter | n | Files |
|---|---:|---|
| ch02 routing | 3 | `01f-not-found-and-the-notfound-function` · `07b-adopting-proxy-the-rename-the-limits-and-where-it-runs` · `07e-inside-the-proxy-function` |
| ch04 data fetching | 2 | `01-explanation` · `06c-acceptance-criteria-and-the-cache-components-variant` |
| ch06 SSG/ISR/SSR | 1 | `03-isr-at-enterprise-level-stale-while-revalidate-tuning` |
| ch07 error handling | 1 | `02b-notfound-and-redirect-after-the-first-chunk` |
| ch08 state | 1 | `10-refresh` |
| ch09 styling | 3 | `03c-applying-the-font-classname-style-css-variables-and-tailwind` · `04e-format-negotiation-and-bounding-the-optimizer` · `05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs` |
| ch10 auth | 1 | `06m-milestone-what-it-costs-and-generalises` |
| ch11 perf | 1 | `06-instrumentationts-for-opentelemetry-and-application-monitori` |
| ch12 SEO | 1 | `02c-json-ld-and-structured-data` |
| ch16 CRUD | 2 | `04e-function-per-use-case` · `12-testing-the-api` |
| ch18 ecosystem | 1 | `04c-the-seams-that-are-files` |
| ch19 capstone | 1 | `03d-the-state-placement-tree` |
| ch20 appendices | 2 | `01c-appendix-a-glossary-the-a-to-z` · `02c-appendix-b-the-changes-nothing-catches` |

⚠️ **`09/04e` and `16/12` were written THIS SESSION** (the AVIF page and topic 12). Leaving them in
is correct — removing files because they are new is exactly the judgement the seed exists to
exclude — but note it when reading the result: fresh pages should pass, so they bias the rate
*upward*, partly offsetting the downward bias of the judgement-picked chapters.

## 🔴 The prior evidence this is being tested against

**Every judgement-picked sample so far has come in far below 90%.**

| Sample | Files | Clean (no S1/S2) | Rate |
|---|---:|---:|---:|
| ch01 + ch03 (fork G) | 19 | 14 S1-free; **8 with no defect at all** | **74% / 42%** |
| ch05 lane C | 3 | **0** — 6 S1s across 3 files | **0%** |

**The dominant defect is one class, and nothing in the corpus detects it: text formatted as a
verbatim `> *"…"*` quote that the source does not contain.** Examples already found:
- *"keeps lint rules about extraneous dependencies quiet"* — quoted twice; **the sentence does not exist**.
- A table column headed **"The error says"** over three reconstructed error strings.
- Three paraphrases on one ch05 page, all reworded to the real doc text.
- An invented figure, **"5.5× faster CI builds"**, presented in quotation marks.

🔴 **`> *"…"*` makes a paraphrase look sourced.** It passes the badge, `> Verified:`, link, cap, MDX
and control-byte checks. Put "check every quote against its source" in every validation brief.

## Method for whoever runs it

Four lanes of five files. Each brief carries:
1. The S1–S5 ladder, 🔴 **S5 is ledger-only**.
2. 🔴 **"SAVE PROGRESS FIRST, THEN WORK"** — validate one file, write its `> Validated:` stamp to
   disk immediately, only then move on. Three forks died holding unwritten work; a stamp on disk is
   the progress bar.
3. 🔴 **Check every `> *"…"*` against its source** — the highest-yield instruction there is.
4. 🔴 **Cross-check `src/data/pins.js`** — the AVIF defect was invisible in the docs and only the
   pin comment carried it.
5. Prefer the doc page with the newer `lastUpdated:` when two disagree; that trap produced a real
   defect in ch11 `01b`.

**Report per file: S1/S2 count only for the rate**, S3/S5 to the ledger.

## Where this connects

- [[cursor-nextjs]] — the position
- [[progress-nextjs-session-d2e9b9fe]] — the session that drew this
- [[devbible-feedback-verify-in-ci-not-locally]] — no local `yarn build`, ever
