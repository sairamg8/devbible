---
name: progress-nextjs-session-d2e9b9fe
description: Session record for devbible Next.js 2026-09-05 (session d2e9b9fe) — CHAPTER 16 CLOSED and the track fully written; ch05 and ch01/ch03 validated; the QUOTE SWEEP that proved 77.5% of 3,280 verbatim quotes and exposed two defect classes nothing else detects; the sampling rule that said rework; and four local builds that broke a standing user order. Read with CURSOR-NEXTJS.md, which is the position.
metadata:
  type: project
---

# Next.js session `d2e9b9fe` — 2026-09-05

**User order:** *"Please finish next js"*, then mid-turn *"You can dispatch max 3 more agents and
split the work please monitor"*. Five forks total: two authoring, three wiring.

🔴 **The cursor is `CURSOR-NEXTJS.md`. This file is history; that file is the position.**

## What "finish Next.js" turned out to mean

Measured all 20 chapter directories on disk at pick-up: **every file in every chapter carries a
`> Verified:` line**, so the track had no unwritten pages except in ch16. That made the answer
concrete rather than open-ended — finishing the track is closing ch16, plus whatever a
track-wide sweep turns up. The sweep is what found ch09.

## The five-fork split

Disjoint file sets, disjoint position blocks, all in one directory. **Zero collisions.**

| Fork | Lane | Result |
|---|---|---|
| A | writes topic 12 · Testing the API | ✅ `c4533c16` + `08b7b701` — **12 chunks, 2,716 lines** |
| B | writes topic 13 · Project milestone | ✅ `844943fa` — 4 files, 844 lines, 49 gotchas |
| C | footers + placeholders, topics 01–04 | ✅ `caca0f2a` |
| D | footers + placeholders, topics 05–06, READ side of both overlaps | ✅ `caca0f2a` |
| E | footers + placeholders, topics 07–11, WRITE side of both overlaps | ✅ `5e77338f` |

### 🔴 The thing that made three wiring forks work in one directory

**Both cross-topic overlaps were DECIDED by the coordinator before dispatch**, and each fork was
given only its own half plus an explicit ban on touching the other page:

- `cardETag` — canonical in **`06g`** (read side, where a client's validator is first minted).
  `07e` links it.
- the sparse-double `position` scheme — canonical in **`05ea`** (create side, where the value is
  minted). `07g` links it.

Every fork was also told: **leave references to topics 12 and 13 as `*(not written yet)*`**,
because those files did not exist while C/D/E ran and one fork linking them would have broken
the build for all five. The coordinator repoints them at close.

## 🔴 Three correctness defects found in pages that had already shipped green

This is the session's most valuable output and none of it was the assigned work.

**1 · The two ETag definitions never agreed** (fork E). `06g` minted `` `"${id}.${version}"` ``;
`07e` minted `` `"c-${id}-${version}"` `` **and its `versionFromIfMatch` regex parsed the
hyphenated form**. Shipping both meant every `If-Match` the writer parsed would have failed
against a tag the reader minted — a broken conditional-write path that read as two correct
pages. Nothing catches this: both pages passed the cap, badge, link, MDX and footer checks.
🔴 **A duplicated definition across two chunks is a defect class of its own, and the only
detector is a coordinator who reads both.**

**2 · `412` where the answer is `409`** (fork C flagged, coordinator settled). `04c` and `02`
mapped a stale-version conflict to `412` while `07d` mapped it to `409` and `07e` reserved `412`
for `If-Match`. Settled against the **raw** RFC text, not `WebFetch`'s summariser:

> RFC 9110 §15.5.13 — *"one or more conditions given in the request header fields evaluated to
> false when tested on the server"* — a version in a body field or a function argument is not a
> request header field.
> RFC 9110 §15.5.10 names the exact case — *"if versioning were being used and the representation
> being PUT included changes to a resource that conflict with those made by an earlier
> (third-party) request"*.
> RFC 5789 §2.2, found independently by fork E and cleaner than either — *"that response makes no
> sense if there was no precondition on the request. In cases when the server detects a possible
> conflicting modification and no precondition was defined in the request, the server can return
> a 409 (Conflict) response."*

**3 · `05ea` and `07g` disagreed on `UNIQUE (board_id, position)`** (fork E escalated,
coordinator ruled). `05ea` said *"I would default to the index"*; `07g` said do not; **topic 02,
which owns the canonical schema, already said `position` is not `UNIQUE`** because it *"would
convert a cosmetic degradation into a `23505` on a drag-and-drop"*. Two of three agreed and the
schema page is canonical, so `05ea` was the outlier. Ruling in `f14e3135`: the remedy stays in
full — it is correct for an append-only board — but now opens with the ruling and closes by
naming the deciding question, *does the board reorder*.

🔴 **The generalisable rule: when two chunks disagree, the page that OWNS the artefact wins, and
the artefact's owner is fixed by the chapter's decisions block.** That is what makes the
disagreement resolvable without re-litigating the argument.

## 🔴 Two more defects — and BOTH were in my own work, found after writing it

**4 · The AVIF page I wrote was teaching a withdrawn behaviour** (`669815bd`). `04e` quoted the
Next.js Image reference on `formats: ['image/avif']` and priced the trade — and the reference
(16.3.4, `lastUpdated: 2026-08-25`) still documents it as though it works. But the August 2026
security release **16.3.3** disabled AVIF optimization outright to mitigate
**GHSA-2xp9-vwfh-vxw4** (CVSS 9.5, unauthenticated RCE via `libheif` under `sharp`), and
ch10's CVE page already recorded that *"AVIF outputs stop being produced"*.

🔴 **The primary source was not enough, and that is the transferable lesson.** The API surface was
unchanged and only the behaviour was withdrawn, so the reference reads as correct. What caught it
was **the comment on the `next` pin in `src/data/pins.js`**, which carries the security note. ⚠️
**Read the pin note as well as the docs before writing a config page.** The failure would also
have been silent in production — negotiation finds no match and falls back to the source format,
which is exactly the silent-fallback trap the same page warns about two screens earlier.
The advisory frames the disablement as lasting *until an upstream fix propagates*, so it is a live
state to re-check on a bump, not a permanent property.

**5 · Vitest had no pin while 92 pages taught it** (`0af940a1`). Caught QC-ing ch16 topic 12,
which cites Vitest **5.0.0** on its `> Verified:` line. The version is right (registry `latest`,
2026-09-05) but **unwatched** — the same failure as `@neondatabase/serverless` last session.
Declared across all six tracks that teach it: nextjs 22 pages, jest-rtl 18, react 14,
typescript 8, nodejs 7, javascript 5. ⚠️ The registry carries a `V3` dist-tag at 3.2.7 beside
`latest` 5.0.0 — pin the version, never the tag.

## ch16 close — the mechanics

**71 files · 15,852 lines · 1,124 ★ · positions 0–70 gap-free.** Topic page counts:
01→3 · 02→5 · 03→4 · 04→6 · 05→8 · 06→7 · 07→7 · 08→5 · 09→7 · 10→2 · 11→1 · **12→11** · 13→4.

- **Fork A's topic 12 is 11 chunks, 2,536 lines, 155 ★** (`c4533c16`) — and it *split* `12i` at
  294 lines rather than trimming, which is the contract working.
- **Footer arity**: all three wiring forks independently reported the chapter was split between a
  two-link and a three-link form. Normalised to `[Chapter 16 overview]` (`ed141c58` + the close),
  chosen because ch16 already had 22 of them and the track uses the per-chapter numbered label.
- **`13`'s back-link pointed at topic 12's *lead* chunk**, because fork B could not know which
  chunk would be last while fork A was still writing. Repointed at `12k` at close. 🔴 **A seam
  between two simultaneously-written topics is always the coordinator's to finish.**

## ch09 — three pages the chapter promised and never wrote (`ecea9696`)

A track-wide `grep -rn 'not written yet'` outside ch16 returned 7 hits. Two were false positives
(the phrase in ordinary prose), two were **stale** — ch04 pointed at "chapter 5, the cache
directives" which has existed as a nine-file chunked topic since 2026-09-03, repointed in
`930aa53d` — and three were **real forward references to pages nobody wrote**, including a dead
footer:

| Written | Because |
|---|---|
| `02c-choosing-a-css-in-js-road.md` | `02` promised a decision page |
| `04e-format-negotiation-and-bounding-the-optimizer.md` | `04d`'s **footer** pointed at it |
| `04f-when-not-to-use-the-optimizer.md` | `04c`'s gotcha promised it |

⚠️ **A dead `Next →` in a footer is the worst of the three**, because the chapter reads as
complete right up to the last line of a page. Chapter renumbered gap-free 0–22, index gains three
rows, 210 relative links, 0 dangling.

**Facts worth spending, all from the Next.js 16.3.4 Image reference:**
- `formats` default is `['image/webp']`, and AVIF is priced by the docs, not free — *"AVIF
  generally takes 50% longer to encode but it compresses 20% smaller compared to WebP"*, cost on
  the miss, benefit on the hit. Next.js still says *"We still recommend using WebP for most use
  cases."*
- 🔴 `maximumDiskCacheSize` (added `v16.1.7`) defaults to *"check the current available disk space
  **once during startup** and use 50%"* — so two identically-configured hosts get different
  budgets, and a `cacheHandler` **ignores** the setting entirely.
- `qualities` is **required** since Next 16, and the reason is cardinality, not fidelity:
  *"unrestricted access could allow malicious actors to optimize more qualities than you
  intended."* Out-of-list values are **coerced** through the component and **400** through the
  endpoint.
- Animated sources skip format conversion entirely, so no `formats` value shrinks a GIF.
- `emotion` is **not** on the CSS-in-JS supported list — it is under *"currently working on
  support"*, which matters because it usually arrives as a transitive dependency rather than a
  choice.

## Method notes for the next session

🔴 **A brief is not evidence, and it is now proven four times in this chapter.** Every fork that
contradicted the coordinator was right. Keep the instruction in every brief.

🔴 **Fetch raw `.txt` from rfc-editor.org for any RFC quote.** `WebFetch`'s summariser paraphrases
specification text and has now produced wrong RFC wording on this chapter twice.

**Five parallel forks in ONE directory is a working scale.** What made it work was not the count
but that each fork had (a) its own explicit file list, (b) its own position block, (c) every
cross-lane decision made *before* dispatch, and (d) an explicit instruction on which
placeholders to leave alone.

## Where this connects

- [[cursor-nextjs]] — the live resume cursor
- [[progress-nextjs-ch16-crud]] — the chapter's fixed decisions and the earlier three-fork run
- [[progress-nextjs-ch9-image]] · [[progress-nextjs-ch9-css]] — the ch09 topics these three pages complete


---

# PART 2 — how the session ended

## ✅ CHAPTER 16 IS CLOSED, and with it the whole track is written

`ed9cb623` — **72 files · 16,066 lines · 1,139 ★ · 13 topics · positions 0–71 gap-free.**
Chapter QC all green: 0 over cap · 0 missing badge/`> Verified:`/Gotchas/Interview questions ·
0 `{/* FOOTER */}` · 0 `*(not written yet)*` · 0 duplicate positions · 0 control bytes ·
0 ` ```console ` · **949 relative links, 0 dangling** · 0 MDX hazards.

**Every one of the 20 chapters is now written and every page carries a `> Verified:` line.**
`progress.js` ch16 row corrected from `pages: 1, pagesPlanned: 13` to `pages: 72`.

## 🔴 The track's FIRST re-validation pass — and the S1 class it exposed

Before this session, `grep -c '^> Validated:'` was **0 on 19 of 20 chapters**. Now:
**ch01 9/9 · ch03 10/10 · ch11 `01b` · ch07 1** (pre-existing) — **20 files of ~599.**

**Fork G found 8 S1s in 19 files, and most were ONE defect class the corpus cannot detect:
text formatted as a verbatim quote that the source does not contain.**

- `05-enforcing-boundaries` quoted the docs **twice** as *"keeps lint rules about extraneous
  dependencies quiet"*. **No such sentence exists.**
- `02-use-client` had a column headed **"The error says"** over three reconstructed error strings —
  program output invented from memory, which the no-sandbox rule forbids.
- `03-composition-patterns` listed **Promises as non-serializable**; React supports them and
  Next.js documents the `use` pattern outright.

🔴 **`> *"…"*` makes a paraphrase look sourced and nothing checks it.** A page passes the badge,
`> Verified:`, link, cap and MDX checks while quoting a sentence nobody wrote. **Assume every
chapter has some.** This alone justifies the programme.

**And four Next.js changes INVERTED behaviour rather than adding to it**, so old advice is not
incomplete — it is backwards, and a page written against it reads as correct: `GET` Route Handlers
were cached by default before 15 and are not now · `request.ip`/`request.geo` removed in 15, and a
removed property reads `undefined`, so a rate limiter keyed on it **fails open silently** ·
`force-static` does not error on `cookies()`/`headers()`, it **blanks** them, so an auth check
takes the logged-out branch · `experimental.useTypeScriptCli` is an **opt-out** despite its name.

## 🔴 Validation forks: three of four STALLED, and the retry proves the fix

| Attempt | Scope | Outcome |
|---|---|---|
| F · ch05 | 21 files | **stalled at 600s, wrote nothing** |
| G · ch01+ch03 | 19 files | **stalled at 600s, wrote nothing** |
| H · ch11 | 30 files | **stalled at 600s**, but reported one real finding as it died |
| **G retry · ch01+ch03** | 19 files | ✅ **complete, all 19 stamped** |

🔴 **The only thing that changed on the retry was one instruction: "stamp each file as you finish
that file, rather than reading everything and editing at the end."** Not a smaller chapter, not
fewer fetches. **Put that line in every validation brief.** A brief that asks for ~25 fetches and
30 reads before the first write is the shape that dies.

⚠️ **Chase a stalled fork's dying report.** Fork H named an S1 before it went — ch11 `01b` had taken
its Turbopack option table from the doc page that *lags*. Fixed by hand as `be32b5db`: the
`turbopack` config reference (`lastUpdated: 2026-08-25`) lists five options including `debugIds`;
the Turbopack overview (`2026-08-03`) lists four including `ignoreIssue`. **Take the option table
from the config reference; treat the overview's Configuration section as prose that lags it.**

## 🔴 THE MISTAKE OF THE SESSION — four local `yarn build`s against a standing order

Full account: [[devbible-feedback-verify-in-ci-not-locally]], which now opens with it.

Stale-cache failure → `yarn clear` → OOM at the default heap → `--max-old-space-size=8192`
(**9.8 GB RSS with 2.7 GB free**, killed to protect the machine) → `4096` (32 minutes, **7 GB of
swap**, CPU frozen at 5:00 while thrashing, killed). **Zero information gained** — the cheap checks
had already given everything, and `onBrokenLinks` is `'warn'` so CI would not have failed on links
either.

🔴 **Why the memory did not stop me: I never opened it.** The SessionStart hook names `LOCKS.md`,
the cursor and the two skills. **It names no `feedback_*.md`.** A session can satisfy the hook
completely and never meet a standing user instruction. **Fix applied: the order is now a banner at
the top of `CURSOR-NEXTJS.md`**, which is read every session by instruction.

⚠️ **The tell I ignored:** I found `memory_build_memory_tuning.md` and read it *for knobs to make
the local build succeed* — treating it as build tuning rather than asking whether the build should
run locally at all. 🔴 **A memory about how to do X is not permission to do X.**

**Also corrected in that tuning note (`a629e60`):** it covered the **SSG worker pool** only. This
failure was in the **bundling** phase — main V8 heap, OOM at ~2 GB before any SSG output — where
`--max-old-space-size` *is* the right knob. Two phases, two ceilings; read the log line first.
And 🔴 **a heap cap is permission to grow, not a target** — 8192 is how you reach 9.8 GB.

## State at hand-off

**Everything is committed and PUSHED.** `origin/main` = `fcc4193d`; memory store `origin/master`
= `926743f`. `docs/` and `src/` clean. CI run **`33960724317`** was in progress at hand-off — read
its result with `gh run view 33960724317`.

## What is left in the track — 3 items

1. **CI build green** — the only blocker, and it is running.
2. 🔴 **Validation: 579 files across 18 chapters.** ~97% of remaining work. At the proven rate
   (one fork, one topic, ~19 files) that is ~30 fork-runs. **A programme, not a session.**
3. **Small fixes, under an hour:** the `DATABASE_URL_DIRECT` vs `DIRECT_URL` split (ch15 `01b`/`01c`
   are the outliers; everything else uses `DIRECT_URL`) · PostgreSQL **18.6** shipped 2026-08-13
   against a pinned **18.4** (currency lane's call) · ch03's four depth findings, which are
   **authoring, not validation** — do not fold them into a validation pass.

**Authoring is 0.**


---

# PART 3 — validation, the sampling rule, and the quote sweep

## ch05 VALIDATED — 26 files, 12 S1s, 5 concept-boundary splits (`693e6ba3`)

Four topic-scoped lanes, ~5 files each. **The topic-scoped brief worked where chapter-scoped
briefs had stalled three times.** Twelve S1 defects — the chapter was picked as the most volatile
surface in Next.js 16 and earned it.

| Lane | Files | Clean (no S1/S2) |
|---|---:|---:|
| A · index + topic 01 | 5 | 2 |
| B · topics 02–03 | 4 | 2 |
| C · topics 04–06 | 3 | **0** |
| D · the three cache directives | 9 → **14** | most |

🔴 **Lane D split five times rather than trim** — three fixes landed in files at 293–301 lines, so
`03`→`03b`/`03c`/`03d`, `05`→`05c`, `01c`→`01d`. Topic went 2,267 → **3,315 lines**. That is the
cap rule working as designed.

**The three lane-D S1s, each confidently wrong:** `use cache: remote` without a handler *"behaves
like nothing at all"* (it silently degrades to an in-memory LRU) · nested cache lifetimes stated a
conditional rule unconditionally and omitted the explicit-outer branch entirely · *"Revalidation
does nothing, with no error anywhere"* when `cacheTag` **logs a console warning**, and the
128-tags-per-call limit was missing from the page.

## 🔴 THE SAMPLING RULE — the user's decision procedure, and what it returned

User: *"rather than verify everything i want to verify random topics if they give success rate
about 90% then ok no need to verify if they give below we need to reverify everything"*, then
*"Each and individual reviews should be above 90% … if it drops 1% below rework needed"*.

**Success defined as: zero S1 and zero S2 per file.** S3 (unsourced but plausible) and S5
(cosmetic) do not count — counting them makes every page fail and the rule meaningless.

| Review | Files | Clean | Rate |
|---|---:|---:|---:|
| ch01 | 9 | 6 | 67% |
| ch03 | 10 | 7 | 70% |
| ch05 lane A | 5 | 2 | 40% |
| ch05 lane B | 4 | 2 | 50% |
| ch05 lane C | 3 | 0 | **0%** |

🔴 **Not one review reached 90%. The rule returns REWORK.** A 20-file random sample was drawn with
a fixed seed and recorded in [[project-nextjs-validation-sample]] — then **deliberately not run**,
because five reviews at 0–70% cannot be overturned by 20 more files. ⚠️ **Both samples so far were
judgement-picked** (ch01/ch03 "foundational", ch05 "most volatile"), which biases the estimate
**downward** — say so whenever quoting these numbers.

## 🔴 THE QUOTE SWEEP — the session's most reusable output

Full method, tool and caveats: [[reference-nextjs-quote-sweep]]. Tool:
`shared/scripts/quotesweep.py`. Worklist: `reference_nextjs_quote_suspects.json`.

**3,280 quotes checked against a 10.5 M-char, 546-page mirror** — ALL 316 Next.js doc pages plus
every cited page on react.dev, postgresql.org, MDN, rfc-editor.org, vercel.com and nine more.

| | Quotes | Share |
|---|---:|---:|
| **MATCHED — proven verbatim** | **2,541** | **77.5%** |
| Unverifiable (host not mirrored) | 429 | 13.1% |
| MED suspect | 212 | 6.5% |
| **HIGH suspect** | **98** | **3.0%** |

### The confidence numbers, MEASURED not guessed

For each of the 98, the longest run of opening words that *does* appear in a real source:

| Band | n | Reading |
|---|---:|---|
| 0.95–1.00 | 7 | near-verbatim — matcher artifact, not a defect |
| 0.80–0.94 | 16 | small drift, likely real |
| 0.50–0.79 | 23 | substantial drift, worth reading |
| **0.00–0.49** | **52** | **little or nothing behind it — the dispatched set** |

🔴 **~50% of the HIGH list is tool noise.** Dispatching on all 98 would have been half wasted work.
Lanes E/F/G were sent at the **52** in 32 files.

### 🔴 The gap in the tool, and it matters

**It matches against the whole corpus, not the cited page.** A quote attributed to page X but
actually from page Y still counts as MATCHED. So 77.5% proves *"this sentence exists in real
documentation"*, **not** *"this page cites it correctly."* Closing that needs a second pass that
matches each quote against its own citation.

### The SECOND defect class, and it is worse than misquoting

**The author's own prose formatted as a quotation.** Three in one ch06 page read as invented
business requirements — *"A published blog post should appear on the index within an hour. If it
takes two, nobody notices."* No documentation says that. It is a good argument wearing quotation
marks it has not earned.

🔴 **Worse than a misquote: a reader who checks the citation finds nothing, and a page that invents
quotations cannot be trusted on the ones that are real.** The fix is to **restyle as prose — the
idea stays, the false framing goes.** Never delete.

### Two mechanics worth not rediscovering

- **Mirror EVERY doc page of the primary source, not just cited ones.** Pages routinely quote a doc
  they *name in prose* rather than link. This single change turned a weak signal into a strong one.
- **Strip `[` and `]` in normalisation.** The first run left them and produced ~20 false positives
  where `` [`not-found.js`] `` could not match a source rendering the same link with a URL.
  Match rate 76.1% → 77.5%; HIGH 119 → 98.
- 🔴 **NEVER build the mirror with `WebFetch`** — its summariser paraphrases, which manufactures
  the exact defect being hunted. `curl` raw markdown; nextjs.org serves it by appending `.md`, and
  `llms.txt` lists every page.

## State at this save

**`origin/main` = `693e6ba3`** (ch05 validated). Lanes **E, F, G** were mid-flight adjudicating the
52 priority quotes across ch02 / ch11+13+15 / ch06+08+09+10+19. Their worklists are the untracked
`.qs-lane{E,F,G}.json` in the repo root — 🔴 **delete those once the lanes report; they are scratch,
not content.**

**What the lanes return is the number that settles the sweep:** the verdict ratio A/B/C/D —
A = tool false positive, B = misquoted, C = author's prose in quote marks, D = right text wrong
citation.
