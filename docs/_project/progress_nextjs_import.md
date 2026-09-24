---
name: progress-nextjs-import
description: Next.js imported into devbible from the frontend-bible corpus 2026-09-03 (19 chapters, 140 pages) plus the upstream verification that found it version-stale at 16.2 vs 16.3.4. START HERE for any Next.js devbible session.
metadata:
  type: project
---

# Next.js — imported into devbible, 2026-09-03

## ⏹️ 2026-09-04 — WOUND DOWN AT 90% USAGE, session `4aa2d031` — 🔴 COLD START READS THIS FIRST

**User: *"We are at 90% of usage ask all agents to stop and report back commit everything and
push save session progress to memory for cold start"*.** All three ch9 agents were told to stop
mid-work; **everything on disk was QC'd and committed before they could finish.**

🔴 **THERE IS NO SALVAGE. Nothing is uncommitted.** Verified at wind-down:
`git status --porcelain docs/ src/` empty in the devbible checkout, both repos **pushed**.
A cold start does **not** need to hunt for half-written files.

### What this session did — THREE chapters

| | Result |
|---|---|
| **ch17 · Advanced ecosystem topics** | ✅ **CLOSED.** 6 files/707 L → **18 files/4,369 L**, 0 → **127 ★**, positions 0–17 |
| **ch6 · SSG, ISR and SSR strategy** | ✅ **CLOSED.** 7 files/408 L → **26 files/5,632 L**, 0 → **271 ★**, positions 0–25 |
| **ch9 · Styling and UI** | 🚧 **PART-WRITTEN, NOT CLOSED.** 7 files/455 L → **16 files/3,195 L**, 0 → **95 ★** |
| **Track** | 142/254 → **187/287 = 65%** at ch6 close (ch9 not yet counted on the board) |

### 🔴 ch9 — EXACT STATE ON DISK, and it is NOT closed

**13 authored pages + `01-explanation.md` (still the old 149-line generated overview) + 2
untouched stubs = 16 files.** Every one of the 13 is **structurally COMPLETE** — frontmatter,
tier badge, `> Verified:`, thesis, body, `## Gotchas`, `## Interview questions`, real footer.
0 over cap · 0 `{/* FOOTER */}` · 0 dangling links · 0 MDX hazards · no duplicate positions.
Commit `2ab98339`. ⚠️ **That commit message says "14 authored pages" — it is 13.** Recounted:
16 files minus the index minus the two stubs.

| Topic | On disk | State |
|---|---|---|
| 01 · CSS Modules / global / Tailwind | `01`(257) `01b`(275) `01c`(262) | ✅ looks complete |
| 02 · CSS-in-JS at the RSC boundary | `02`(177) `02b`(237) | ⚠️ **`02c` was named in prose and NEVER WRITTEN** — now bold *(not written yet)* |
| 03 · `next/font` | `03`(183) `03b`(200) `03c`(198) `03d`(184) | ✅ looks complete |
| 04 · `next/image` | `04`(283) `04b`(194) `04c`(234) `04d`(261) | ⚠️ `04f-when-not-to-use-next-image` was named and never written |
| **05 · `next/script`** | `05` **43-line STUB** | 🔴 **NEVER STARTED** |
| **06 · design-system milestone** | `06` **58-line STUB** | 🔴 **NEVER STARTED** |

🔴 **10 dangling links were converted to the contract's bold + `*(not written yet)*` form** at
wind-down, so the build is not broken for the other sessions in this shared checkout. **Two named
chunks remain unwritten and are already marked as such: `02c` and `04f`.**

🔴 **`sidebar_position` is deliberately NOT gap-free** — `0,1,2,3,5,6,8,9,15,16,17,18,29,30,31,32`.
The agents' ranges (G 1–14, H 15–28, I 29–42) are still reserved and **positions 5 and 6 are the
two untouched stubs**. **Renumbering is the coordinator's job at close — do not renumber until 05
and 06 are written**, or the ranges collapse under the next agent.

🔴 **`01-explanation.md` is STILL the old generated overview** and must be rewritten as a chapter
index (the ch6 and ch17 indexes are the model). **`src/data/progress.js` was NOT updated for ch9**
— its row still reads `topics: 7, pages: 0, part: 'Imported corpus'`.

### 🔴 START HERE (in this order)

1. **Write `05-next-script-loading-strategies-for-third-party-scripts.md`** — 🔴 **its research is
   ALREADY BANKED and unspent**: [[research-nextjs-ch9-font-and-script]] (340 lines). **Do not
   re-fetch.** ⚠️ **ch10's `11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md`
   already owns third-party scripts and SRI — read it first and complement it.** Two things still
   needed verification when the agent stopped: **the exact current set of `next/script`
   strategies**, and **whether `onLoad` requires a Client Component.**
2. **Write `06-project-milestone-sprintdesk-design-system-pass.md`** — depends on 01–05.
3. Optionally write `02c` and `04f` (both already marked *(not written yet)*, so neither is a
   defect).
4. **Then** rewrite `01-explanation.md` as the chapter index, **renumber 0–N gap-free**, and wire
   `progress.js` + the track README.

### 🔴 VERIFIED FINDINGS THE AGENTS BANKED BEFORE STOPPING — spend these, do not re-derive

**`next/script` — topic 05 was NEVER WRITTEN, but its research is DONE.** Verbatim from the API
reference (`version: 16.3.4`, `lastUpdated: 2026-08-25`) and the scripts guide:
> *"There are four different strategies that can be used: `beforeInteractive` … `afterInteractive`:
> (**default**) … `lazyOnload`: Load during browser idle time. `worker`: (experimental)"*

🔴 **`worker` is unusable in an App Router chapter** — *"not yet stable and does not yet work with
the App Router"*, and *"`worker` scripts can only currently be used in the `pages/` directory"*.
🔴 **`onLoad`, `onReady` AND `onError` all require a Client Component** — four separate verbatim
warnings, quoted in the bank. ⚠️ **Unresolved contradiction to write as uncertain:**
`beforeInteractive` *"must be placed inside a root layout"*, `onReady` requires a Client Component,
and the docs recommend `onReady` as the `beforeInteractive` substitute **without ever reconciling
the two**. Also banked: `beforeInteractive` *"does not block page hydration"*, always lands in
`head` regardless of placement, scripts *"run once per document load"* and a client-side navigation
does not re-run them, inline scripts need an `id`, and arbitrary attributes are forwarded to the
emitted tag (which is how a `nonce` reaches it).

🔴 **Tailwind — VERIFIED, not assumed. It is v4 CSS-first; there is NO `tailwind.config.js` on the
documented path.** Two independent primary sources agree (Next.js *Getting Started: CSS* self-
reporting 16.3.4, and tailwindcss.com's Next.js guide reporting **v4.3**): `@tailwindcss/postcss`
in `postcss.config.mjs` and `@import 'tailwindcss'` — **no `content` glob, no
`@tailwind base/components/utilities` triple**. The v3 path survives as a separate guide with one
stated trigger: *"If you need broader browser support for very old browsers."*

🔴 **`cssChunking`'s options are BUNDLER-SPLIT** — `'strict'` and `false` are **webpack only**,
`'graph'` is **Turbopack only**. Since **Turbopack is default from 16.0**, *the documented escape
hatch for CSS-ordering correctness does not exist under the default bundler* — the fix has to be in
source. High-value; quoted in `01b` and the CSS bank.

⚠️ **An unresolved conflict between two primary sources, banked and NOT written to any page** (it
belongs to the unwritten `04e`): the **August 2026 security release** says *"The patched releases
disable AVIF optimization until an upstream fix is propagated"*, while the **Image API reference,
`lastUpdated` the same day**, still documents `formats: ['image/avif']` with no mention of it.
Neither says whether the option now errors, warns, or silently falls through. **Do not resolve this
from memory.**

⚠️ **The famous `You're importing a component that needs …` error string is NOT on the error page** —
it carries only *"You are using a React client hook in a Server Component."* The agent declined to
reproduce the longer wording from memory. Likewise, the CSS-in-JS guide contains **no** sentence
saying CSS-in-JS is unsupported in Server Components and **no** symptom description; `02`'s symptoms
are labelled explicitly derived.

### ⚠️ ch9 defects found by the agents, NOT fixed — cheap wins for the next session

- **`_category_.json` is `"label": "9. Styling and UI"`** — not the house `"NN · Label"` middle-dot
  form, and its `generated-index` title still carries the `▲` the page bodies are losing.
- **`01-explanation.md` still carries the `# ▲` H1, the Priority Badges Legend, no tier badge and
  no `> Verified:`** — and its body is the same text that was byte-duplicated into the `02` stub.
- **Several `title:` values contain raw markdown** (`"**Project Milestone:** …"`), which renders
  literal asterisks in the sidebar. Also affects `12-…/06-project-milestone-…`.
- **An unverified cross-track link** appears in old ch9 bodies:
  `../../../web-vitals-performance/pages/06-cls-optimization/01-preventing-cls.md`. **Worth a
  corpus-wide check** — nobody has confirmed that path resolves.
- 🔴 **A defect I introduced and fixed**: my wind-down dangling-link sweep converted two links to
  `02b` into *(not written yet)* markers **seconds before the agent created `02b`**, leaving a real
  page referenced as unwritten. Restored in `7789413f`. **Lesson: when sweeping links during a
  wind-down while agents are still writing, re-check the sweep after they stop.**

### Banks — all three written and committed, DO NOT RE-FETCH

[[research-nextjs-ch9-css]] (324 L) · [[research-nextjs-ch9-font-and-script]] (340 L) ·
[[research-nextjs-ch9-image]] (250 L) — commit `de2fe77`. Plus this session's earlier banks:
[[research-nextjs-ch6-rendering-choice]], [[research-nextjs-ch6-isr-and-params]],
[[research-nextjs-ch6-export-and-walkthroughs]], [[research-nextjs-ch17-multizone]],
[[research-nextjs-ch17-migration]], [[research-nextjs-ch17-extension]].

### ⚠️ Other sessions live in this shared checkout at wind-down

- **ch5 is being written by a SEPARATE session** (the task this session spawned). 🔴 **Do not
  touch `05-caching-ppr-and-cache-components/`** and do not link into it — filenames are unstable.
- **The Java lane was writing uncommitted files in `docs/java/` throughout.** 🔴 **This is why the
  final push MERGED instead of rebasing** — `git pull --rebase` refuses on a dirty tree, and
  stashing another session's live work is not yours to do. **Merge, do not rebase, when a sibling
  session has uncommitted files.**



## ▶️ 2026-09-04 — CHAPTER 9 PICKED AND DISPATCHED, session `4aa2d031` (IN PROGRESS)

**User: *"keep going when they finish, same cadence"*.** Third chapter of the session.

🔴 **ch5 was NOT taken, deliberately** — the cursor pointed there, but the user started the
spawned ch5 task in a **separate live session**, so taking it would have collided. Picked the
next-best instead. **A cursor is a claim about what is next, not a licence to ignore who is
already on it.**

### Why ch9, from the body-hash triage of all four un-backfilled chapters

| Chapter | Files | Lines | Duplicate bodies |
|---|---:|---:|---|
| **09 · Styling and UI** ← picked | 7 | 455 | 3 identical (`75944ab4`) |
| 14 · Agent-driven development | 8 | 375 | 5 identical + **2 EMPTY** (`d41d8cd9`) |
| 18 · Capstone | 5 | 425 | 1 empty |
| 19 · Appendices | 6 | 182 | 🔴 **all six identical** (`addc682b`) |

ch9 wins on value density: styling in an RSC world is genuinely gotcha-rich (runtime CSS-in-JS
cannot work in a Server Component), and `next/image` connects to a security thread this corpus
already owns. ⚠️ **ch19 is the cheapest close on the whole track** — 6 identical stubs, 182 lines
— and ch14 has two empty-bodied pages.

### The dispatch — 3 `devbible-author` agents, disjoint BY FILENAME

| Agent | Owns | Range | Tier |
|---|---|---|---|
| G | `01` CSS Modules/global/Tailwind + `02` CSS-in-JS at the RSC boundary | **1–14** | `t-master` / `t-understand` |
| H | `03` `next/font` + `05` `next/script` | **15–28** | `t-understand` ×2 |
| I | `04` `next/image` + `06` design-system milestone | **29–42** | `t-master` / `t-know` |
| coordinator | `01-explanation.md` → chapter index; renumber gap-free at close | 0 | — |

### Scope boundaries handed out, all read off disk first

- 🔴 **ch10 `11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md` ALREADY owns
  third-party scripts and SRI.** Agent H was told to **read it before writing `05`** and to report
  what boundary it drew — otherwise `next/script` and that page duplicate each other.
- 🔴 **ch17 `03b-supply-chain-vigilance.md` already owns the AVIF decoder incident and the
  `remotePatterns`-as-security-control argument.** Agent I draws the operational conclusion and
  links; **ch10 owns the CVE record.** Told to report the boundary it drew.
- **ch11 `05-core-web-vitals-tuning…` owns CLS/LCP measurement** — ch9 owns the *mechanism*
  (font metric adjustment, image sizing), not the metrics.
- ch3 owns the `'use client'` boundary mechanics.

⚠️ **All three were told NOT to link anything under `05-caching-ppr-and-cache-components/`** —
another session is rewriting that chapter live, so its filenames are unstable.

### Banks: grepped before promising, third time

❌ **Nothing banked** on CSS Modules, Tailwind, CSS-in-JS, `next/font`, `next/script` or
`next/image`. All three agents were told so explicitly and given fetch budgets (5 each) rather
than a pointer to research that does not exist. ✅ The one exception: the AVIF/`sharp` material is
already **written into ch17's page**, so agent I reads that page rather than re-fetching.

### Version traps flagged in the dispatches

- 🔴 **Tailwind config style** — agent G must **verify** whether current guidance is v4's CSS-first
  config or v3's `tailwind.config.js` and **say which it confirmed**. Writing from habit here is
  exactly how this corpus has been wrong before.
- 🔴 **`next/script`'s strategy set and `onLoad`'s Client-Component requirement** — agent H must
  verify both rather than reciting.
- 🔴 **Under `output: 'export'`, image optimization is unsupported *with the default loader only*
  — a custom loader works.** Agent I was told not to write the cruder "images don't work in static
  export", which is the version of that claim most guides carry.

Also banned, per page: invented kilobytes (G), invented CLS/millisecond figures (H), invented
compression ratios (I). These three topics are the most tempting in the whole track to illustrate
with numbers nobody measured.



## ✅ 2026-09-04 — CHAPTER 6 CLOSED, session `4aa2d031` (second chapter this session)

**Track 158/265 → 187/287 = 65%. FIVE of nineteen chapters fully authored: 1, 3, 4, 6, 17.**
ch6: **7 files / 408 lines → 26 files / 5,632 lines**, 0 → **271 ★**. Positions **0–25 gap-free**.
QC at close: 0 over cap · 0 missing badge or `> Verified:` · 0 `{/* FOOTER */}` · 0 console
blocks · 0 admonitions · 0 duplicate positions · 0 dangling links · 0 MDX hazards.

| Concept | Files | Growth | Commit |
|---|---|---|---|
| 01 · choosing a rendering pattern | 5 | 45 → 971 L, 45 ★ | `51b64dc8` |
| 02 · generateStaticParams at scale + 03 · ISR tuning | 8 | 90 → 1,834 L, 71 ★ | `4a429ed8` |
| 04 · static export · 05 · walkthroughs · 06 · milestone | 12 | 141 → 2,758 L, 155 ★ | `04bfbfd8` |
| index + renumber + prev fix | 1 | 132 → 69 L index | (with ch6 dir) |
| deferral repoint | 3 | — | `f7a86e19` |
| boards | — | 60% → 65% | `3c16057d` |

Banks — **do not re-fetch**: [[research-nextjs-ch6-rendering-choice]] `b663f87` ·
[[research-nextjs-ch6-isr-and-params]] `dd3df20` · [[research-nextjs-ch6-export-and-walkthroughs]]
`ea9fcb9`. **14 doc pages fetched across the three agents, 13 resolved.**

### 🔴 Findings that outrank the pages they came from

- 🔴 **Crawlers are special-cased, which retires most "SSR for SEO" reasoning.** Verbatim:
  *"Bots and crawlers are detected by their user agent and handled differently: because they need
  a complete document, Next.js skips the shell and renders the entire page dynamically at request
  time."* Choosing request-time rendering for **all** traffic pays on 100% of requests to fix a
  path the framework already handles for the sub-1% that are bots.
- 🔴 **The static-export "unsupported" list is misread by almost everyone, in two ways.**
  **(a)** Route Handlers are **not** wholly unsupported — only those *"that rely on Request"*. A
  `GET` handler marked `force-static` **is prerendered into a real file** (the docs' own
  `app/data.json/route.ts` emits `data.json`), which is a usable build-time file-generator.
  **(b)** 🔴 The list entry *"Headers"* links to the **`next.config.js` headers OPTION**, not to
  `headers()`. **The `headers()` request function is not enumerated in that list at all.** Treat
  it as unavailable — no request exists at build time — but **do not claim the docs enumerate it**.
  Image optimization is likewise only unsupported *"with the default `loader`"*; a custom loader
  works. Four removals nobody lists: **rewrites, redirects, Draft Mode, intercepting routes.**
- ⚠️ **`next.config.js` `headers` under `output: 'export'` is accepted and silently never
  applied** — so CSP and HSTS vanish in production and **no part of the build fails**.
- 🔴 **The stampede question is OPEN and must stay open.** Whether N concurrent requests to one
  stale entry cause one background regeneration or N is **not stated** by the ISR guide,
  `cacheLife`, or *How revalidation works* — the last written *"for platform engineers … who need
  to … implement custom cache handlers"*, i.e. exactly the audience that would need it. The agent
  **declined to invent a lock**: nobody blocks either way so the symptom is **duplicated origin
  work, not latency**; the handler surface (`get`/`set`/`getExpiration`/`updateTags`/`refreshTags`)
  has **no in-flight primitive**; and regeneration is per-instance, so twenty instances is **at
  least twenty renders**. §4 of the ISR bank is devoted to it. **Do not re-litigate from memory.**
- **`/docs/app/guides/incremental-static-regeneration-cache-components`** — new path; App Shells
  and the Pages-Router `fallback: true` equivalence live there.
- **The `output` config reference does not document `output: 'export'` at all** — only tracing and
  `'standalone'`. And: *"To run Next.js, your platform needs a Node.js server. That's it."*
- 🔴 **`https://nextjs.org/docs/app/getting-started/partial-prerendering` 404s in 16.3.4.** PPR is
  documented inside the Caching page, and **there is no authored PPR page anywhere in this track.**

### 🔴🔴 CHAPTER 5 IS HOLLOW — the highest-value repair on this track

Found because ch6 defers its mechanics to ch5. **All six top-level concept pages are stubs**:
`374997fb` × 3 **byte-identical** (51 L each), `bd7083f7` = `04-revalidation` (38 L, opens on
*"## 4. Senior Engineer Edge Cases"* with no §1–§3), and 🔴 **`d41d8cd9` × 2 — that is the md5 of
the EMPTY STRING**, so `02-the-use-cache-directive…` and `06-project-milestone…` have **no body at
all**. None carries a `> Verified:` line. Meanwhile
`05-caching-ppr-and-cache-components/10-the-three-cache-directives/` holds **9 authored, verified
pages, 2,267 lines**. **The corpus was routing readers to empty pages for its cache model.**
Spawned as its own task, with body hashes and the open question of whether page `02` becomes a
pointer or the subdirectory is promoted. Added to the track README's known-defects list.

### 🔴 Process lessons

1. 🔴 **"Chapter X owns this, link don't restate" is a claim about DISK, and must be checked on
   disk.** I wrote that boundary into three dispatches from the chapter's **file names**. Two of
   the six files I pointed at were empty. Caught mid-flight only because an agent said ch5 looked
   thin.
2. **Correct a running agent rather than fixing its output afterwards.** Both live agents were
   messaged with corrected link targets and both applied them before finishing, so **nothing
   shipped citing a stub**. Agent D's three already-committed deferrals needed a follow-up commit
   — strictly more expensive.
3. **Leave the honest dangling pointer.** `01c`'s PPR deferral still points at ch5's stub,
   **deliberately and said so in the commit**, because no authored PPR page exists. Repointing it
   somewhere plausible would have hidden a real gap.
4. **Widen ranges, then renumber at close — it works.** After ch17's agent B needed 7 chunks
   against a range of 4, ranges here were 1–10 / 11–24 / 25–40. Agents used 5, 8 and 12 chunks,
   left a gap at 15–17, and the coordinator closed 0–25. No collisions, no trims.
5. ⚠️ **Run the link check on your own index.** Mine had a mistyped filename
   (`06d-acceptance-…` vs `06d-acceptance-criteria-…`) that only the resolver caught.

### Still owed on this track

**Four chapters wholly un-backfilled: 9, 14, 18, 19** (100 of 287 pages carry no `> Verified:`).
Nearest to done: **ch12 (28/35)**, **ch2 (11/20)**, **ch16 (9/16)**, **ch7 (9/17)**. 🔴 **ch5 is
the highest-value repair** — see above. Also owed: the ch12 **server-side idempotency contract**
page (drafted, unshipped), and a live **MDX raw-tag hazard** at
`02-routing-and-navigation/01-file-system-routing-pagetsx.md:7` (the generated `# ▲` H1 — the only
rawtag hit in the whole track).



## ▶️ 2026-09-04 — CHAPTER 6 PICKED AND DISPATCHED, session `4aa2d031` (IN PROGRESS)

### ▶️ Progress: concepts 01, 02 and 03 CLOSED (F still writing 04/05/06)

| Concept | Files | Growth | Commit |
|---|---|---|---|
| 01 · choosing a rendering pattern | `01`+`01b`+`01c`+`01d`+`01e` | 45 → **971 L**, 0 → **45 ★** | `51b64dc8` |
| 02 · generateStaticParams at scale | `02`+`02b`+`02c`+`02d` | 45 → 909 L | `4a429ed8` |
| 03 · ISR tuning | `03`+`03b`+`03c`+`03d` | 45 → 925 L | `4a429ed8` |

02+03 together: **90 → 1,834 L, 0 → 71 ★**. Banks: [[research-nextjs-ch6-rendering-choice]]
(`b663f87`), [[research-nextjs-ch6-isr-and-params]] (`dd3df20`).

🔴 **THE KEEPER FACT, verbatim from the Caching page — it retires most "SSR for SEO" reasoning
and was nowhere in this track:**
> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user
> agent and handled differently: because they need a complete document, Next.js skips the shell
> and renders the entire page dynamically at request time."*

So choosing request-time rendering for **all** traffic to satisfy crawlers pays on 100% of
requests to fix a path the framework already handles for the sub-1% that are bots. Also banked:
*"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the
previous rendering model did."*

🔴 **The stampede question is OPEN and must stay open.** Whether N concurrent requests to one
stale entry cause one background regeneration or N is **not stated** by the ISR guide,
`cacheLife`, or *How revalidation works* — the last of which is written *"for platform engineers
… who need to understand the system to implement custom cache handlers"*, i.e. exactly the
audience that would need it. The agent **declined to invent a lock** and reasoned from what is
documented instead: nobody blocks either way so the symptom is **duplicated origin work, not
latency**; the cache-handler surface (`get`/`set`/`getExpiration`/`updateTags`/`refreshTags`)
contains **no in-flight primitive**; and *"Background regeneration … runs on the instance that
receives the triggering request"*, so a fleet of twenty is **at least twenty renders** regardless.
**Do not re-litigate this from memory.** §4 of the ISR bank is devoted to it.

Other facts worth not re-deriving: *"When running multiple instances, the default file-system
cache is per-instance."* · **new doc path** `/docs/app/guides/incremental-static-regeneration-cache-components`
(App Shells, and the Pages-Router `fallback: true` equivalence) · 🔴 **`https://nextjs.org/docs/app/getting-started/partial-prerendering` 404s in 16.3.4** — PPR is documented *inside* the Caching page, and **there is no authored PPR page anywhere in this track**.

### 🔴🔴 CHAPTER 5 IS HOLLOW — found while authoring ch6, spawned as its own task

ch6 defers its cache mechanics to ch5. **All SIX of ch5's top-level concept pages are stubs**,
measured on disk:

| Body hash | Files |
|---|---|
| `374997fb` | `01-the-explicit-caching-model…` and `03-partial-pre-rendering…` and `05-turbopack-build-caches…` — **byte-identical**, 51 L each |
| `bd7083f7` | `04-revalidation-time-based-isr.md`, 38 L, opens on *"## 4. Senior Engineer Edge Cases"* with no §1–§3 |
| **`d41d8cd9`** | 🔴 `02-the-use-cache-directive…` and `06-project-milestone…` — **that hash is the md5 of the EMPTY STRING**; these pages have no body at all |

None carries a `> Verified:` line. **The real material is in
`05-caching-ppr-and-cache-components/10-the-three-cache-directives/` — 9 files, 2,267 lines, all
verified.** So the corpus was routing readers to empty pages for its cache model.

Acted on mid-flight rather than at close: **agents E and F were messaged with corrected link
targets while still writing** (E confirmed it re-pointed every ch5 deferral), and agent D's three
already-committed deferrals were repointed in `f7a86e19`. 🔴 **The PPR deferral was left pointing
at ch5's stub and said so in the commit — there was no authored PPR page to point at, and
papering over that would have hidden the gap.** ch5 is spawned as its own task, carrying the body
hashes and the open question of whether page `02` becomes a pointer or the subdirectory is
promoted.

🔴 **Lesson: "chapter X owns this, link don't restate" is a claim about disk, and must be checked
on disk.** I wrote that boundary into three dispatches from the chapter's file *names*. Two of
the six files I pointed at were empty.

**User: *"push it and please pick net do not stop and deploy max 3 more agents split the work
and you monitor"*.** Both repos **pushed** — devbible `ea27ad25`, store `4e291af`.

### The push needed a rebase, and the divergence is worth knowing

`git push` was rejected; `origin/main` had moved. **Net effect on ch17 was zero** and it was
checked before integrating: another session applied the `retry`/`reset` correction to ch17's
`01-explanation.md` (`224c0f73`) and then **reverted it** (`806981be`, *"that file is mid-write
by a live session"*) — so `git diff --name-only HEAD...@{u} -- 17-advanced-ecosystem-topics/`
came back **empty** and `git pull --rebase` replayed 5 commits clean. 🔴 **Check the overlap
set before rebasing a shared checkout, not after.**

That session also did the ch7 currency work I had spawned: `575a95e0` (split 10 → 08 + 09 + 10,
240 → 713 lines, 8 → 22 ★), `afa0497d` (**S1: page 10 claimed `reset` is `undefined` — the
primary source documents it as a live prop that simply does not refetch**), `224c0f73`
(propagated across ch2, ch4, ch7, ch17 — 15 files). **ch7 board is now 16 planned / 8 verified**,
so the 158/265 figure I wrote is already slightly behind.

### Why chapter 6, and what the body-hash found

Picked **ch6 · SSG, ISR and SSR strategy** over 9, 14, 18, 19: it is core rendering material,
wholly un-backfilled, and it is **exactly where this track's known version-stale caching claims
would hide**. Body-hashed before planning, per the standing rule — and it paid immediately:

| Hash | Files |
|---|---|
| **`ebe1fead`** | 🔴 **FIVE byte-identical stubs** — `01-choosing`, `02-generatestaticparams`, `03-isr`, `05-walkthroughs`, `06-milestone` |
| `a1e03ce7` | `01-explanation.md` (132 L) |
| `a810611b` | `04-full-static-export` (51 L) |

**408 lines across 7 files.** Same defect shape as ch1 (7-of-9) and ch4 (3 identical).

### 🔴 The scope boundary, read off disk rather than assumed

ch6 is a **strategy** chapter and the mechanics are already written. Confirmed by reading the
neighbours' headings:

- **`ch4/03b-the-segment-config-surface.md` already owns** `dynamic`, segment `revalidate`,
  `fetchCache`, `dynamicParams` **and `generateStaticParams`'s timing rules.** So ch6's `02` is
  about **scale**, not timing.
- **`ch5/04-revalidation-time-based-isr.md` owns** ISR mechanics, `revalidateTag`/`revalidatePath`
  and the cache layers. So ch6's `03` is about **tuning**, not mechanism.
- **ch16 owns** deployment topology and cost mechanics; ch6's `04` draws only the rendering
  consequence.

### The dispatch — 3 `devbible-author` agents, disjoint BY FILENAME

| Agent | Owns | Range | Tier |
|---|---|---|---|
| D | `01-choosing-a-rendering-pattern` + siblings | **1–10** | `t-master` |
| E | `02-generatestaticparams` + `03-isr` + siblings | **11–24** (02 from 11, 03 from 18) | `t-understand` / `t-master` |
| F | `04-static-export` + `05-walkthroughs` + `06-milestone` + siblings | **25–40** | `t-understand` ×2 / `t-know` |
| coordinator | `01-explanation.md` → chapter index; renumber gap-free at close | 0 | — |

**Ranges are deliberately far wider than last time** — ch17's agent B needed **seven** chunks
against a range of four. Renumbering at close is the coordinator's job, not a reason to cramp
an agent.

### Banks: grepped before promising, again

✅ **Real and on-topic:** `research_nextjs_multitenant_and_refresh.md` carries
`generateStaticParams`, `revalidate`, `dynamicParams`, stale-while-revalidate and Cache
Components — handed to D and E as *read it, do not re-fetch*.
❌ **NOT banked anywhere:** `static export`, `output: 'export'`, `cacheLife`. Agent F was told
so explicitly and given a fetch budget instead of a pointer to research that does not exist.

### 🔴 The briefing that matters most

Every agent was handed the corpus's already-paid-for corrections as **do not contradict, do not
re-derive**: `fetch()`'s default leaves a route **static and stale** (corrected here once
**backwards**); Route Handlers **not** cached by default since v15.0.0-RC; **`force-static`
BLANKS `cookies()`/`headers()`** so auth silently takes the logged-out branch;
`request.ip`/`request.geo` removed in v15.0.0; `next` **not installed** so no T1 probe exists.

🔴🔴 **The one that could invalidate the whole chapter: v16.0.0 REMOVES `dynamic`,
`dynamicParams`, `revalidate` and `fetchCache` under Cache Components.** Agent E's two pages are
*about* `dynamicParams` and `revalidate`. **A tuning page for an API a flag deletes, that does
not say so, is teaching a dead end** — E was told to address it head-on. Agent F got the same
warning for the milestone's segment config.

Also flagged to E: a cache-tuning page is *tempting* to illustrate with invented hit rates, and
to F: a cost comparison is tempting to illustrate with invented figures. **Both banned** —
reason about mechanism or quote the docs.



## ✅ 2026-09-04 — CHAPTER 17 CLOSED, session `4aa2d031`

**Track 142/254 → 158/265 = 60%. Four of nineteen chapters fully authored: 1, 3, 4, 17.**
ch17: **6 files / 707 lines → 18 files / 4,369 lines**, 0 → **127 ★**, 17 `## Gotchas` +
17 `## Interview questions`. Positions **0–17, gap-free**. QC track-wide at close: 0 over
cap · 0 missing badge or `> Verified:` · 0 `{/* FOOTER */}` · 0 console blocks · 0
admonitions · 0 duplicate positions · 0 dangling links · 0 MDX hazards.

| Concept | Files | Growth | Commit |
|---|---|---|---|
| 01 · micro-frontends / multi-zones | `01`+`01b`+`01c`+`01d` | 58 → 1,131 L, 0 → 24 ★ | `192710ce` |
| 02 · Pages → App migration | `02`+`02b`…`02g` (**seven**) | 32 → 1,710 L, 0 → 59 ★ | `5ec4a78f` |
| 03 · OWASP + supply chain | `03`+`03b` (prior session) | — | `2a82d1fe` |
| 04 · framework extension | `04`+`04b`+`04c`+`04d` | 58 → 1,053 L, 0 → 29 ★ | `42077dbb` |
| index + renumber + ch18 fix | `01-explanation.md` | 143 off-topic → 63 L index | `a0bf7947` |
| boards | `progress.js`, track README | 56% → 60% | `3560cc90` |

Banks (do **not** re-fetch): [[research-nextjs-ch17-multizone]] `41a0dae` ·
[[research-nextjs-ch17-migration]] `6572960` · [[research-nextjs-ch17-extension]] `ef20f37`.

### 🔴 Findings that outrank the pages they came from

- **`next` is NOT installed in this checkout.** `require('next/package.json')` throws
  `MODULE_NOT_FOUND`. **No session can T1-probe the Next.js package**; `react` probes fine at
  **19.2.8**. Every ch17 page says so rather than implying a probe happened.
- **Turbopack has been the DEFAULT bundler since 16.0**, so a `webpack()` function in
  `next.config.js` is **silently not read** — no error, the config is simply inert. Turbopack
  implements loaders and **does not support webpack plugins**.
- **There is no Next.js plugin API.** A "plugin" is a function from `NextConfig` to
  `NextConfig`. The **Adapters API** (16.2, `modifyConfig` + `onBuildComplete`) is the only
  typed, versioned extension point, and it targets hosting platforms, not app authors.
- 🔴 **The `app/`-wins precedence rule is NOT in the 16.3.4 docs.** Absent from the migration
  guide (which has a whole coexistence section) and from `project-structure`;
  `/docs/messages/conflicting-app-page-error`, `/docs/pages` and the v13 archive all **404**.
  It is a Next.js 13 sentence that survived in folklore. **ch18 asserted it and cited ch17 for
  it — corrected in `a0bf7947`.** What *is* documented and matters more: navigation between
  the two routers is a **hard navigation** and `next/link` **will not prefetch across them**.
- ⚠️ **The migration guide contradicts itself on the `fetch` default at one `lastUpdated`** — a
  Step 6 comment calls uncached *"the default fetch behavior"*, the `getStaticProps` section
  says it defaults to `cache: 'force-cache'`. Both quoted, contradiction flagged, unresolved.
  Its *Upgrading* preamble is also stale (says Node 18.17 against the real 20.9 floor).
- **`@next/codemod upgrade --yes` is auto-enabled when stdin is not a TTY** — CI *and any
  coding agent* get it implicitly. Relevant corpus-wide, not just to Next.js.
- **All 10 doc pages fetched this session self-report `version: 16.3.4`**, which settles
  affirmatively that the pin's docs still describe these surfaces this way.

### 🔴 Process lessons, all paid for this session

1. **Grep a bank before promising it to an agent.** The previous wind-down asserted the
   existing banks covered these three stubs. They did not — no `multiZone`, `assetPrefix`,
   `Module Federation`, `getServerSideProps` or plugin material anywhere. Each agent got a
   fetch budget and wrote its own bank instead.
2. **A position range is not enough if the topic is bigger than the range.** Agent B needed
   **seven** chunks against a range of four, and correctly parked `02e`/`02f`/`02g` at 20–22
   with an in-page note rather than trimming or colliding. **The coordinator renumbers at
   close** — that is the job, and it worked. Hand out ranges *and* expect to renumber.
3. **Rewriting a page is a deletion.** ch17's overview was off-topic, but it was the corpus's
   **only** statement of the `error.js` component-hierarchy rule. Checked ch3/ch7 before
   replacing it: two of its three subjects were covered elsewhere, one was not. That one was
   re-verified and carried into the new index **in better form than the original** — the old
   prose omitted `template.js` and never said `error.js` DOES wrap *nested* layouts.
4. ⚠️ **A memory can outrun its content.** The LOCKS entry for session `bf92d5b6` described
   the ch7 `10b` → `10c`+`10d` split as done. It **is** done — commit `47dba6a1` — but on
   branch **`claude/jolly-diffie-4abc33`, NOT merged to `main`** *(true when written;
   ✅ that branch was merged and DELETED 2026-09-05 — the work is on `main` now)*. A session
   reading only `main` saw neither the files nor the reason they were missing. **Check
   `git branch -a --contains` before trusting a memory that describes work you cannot find** —
   and note the follow-on: once the branch is deleted that command returns nothing either, so
   the lesson generalises to `git log --oneline --all -- <path>`.

### Still owed on this track

**Five chapters wholly un-backfilled: 6, 9, 14, 18, 19** (107 of 265 pages carry no
`> Verified:` line). Nearest to done: **ch12 (28/35)**, **ch2 (11/20)**, **ch16 (9/16)**.
⚠️ **`reset` is version-stale in 8 ch7 files** — `retry` became stable in **v16.3.0** and the
docs now prefer it (`retry()` re-fetches AND re-renders; `reset()` only re-renders). **That is
`devbible-currency` work, not `devbible-topic`** — it was deliberately not fixed inline, and a
separate session was started on it. Also still owed: the ch12 **server-side idempotency
contract** page (drafted, unshipped; every write-queue page assumes it).



## ▶️ 2026-09-04 — CHAPTER 17 RUN, session `4aa2d031` (IN PROGRESS)

**User named *"Continue where we left off with next js and deploy 3 more agents use devbible skill"*.**
Lane: **Next.js**, `main`, shared checkout, no worktree. Working tree was **clean at start** —
no salvage, exactly as the previous wind-down promised.

### The dispatch — 3 `devbible-author` agents, disjoint BY FILENAME

| Agent | Owns | `sidebar_position` range | Tier |
|---|---|---|---|
| A | `01-micro-frontends-…` + `01b/01c/01d` | **1–4** | `t-know` |
| B | `02-pages-router-…` + `02b/02c/02d` | **5–8** | `t-understand` |
| C | `04-framework-extension-…` + `04b/04c/04d` | **11–14** | `t-when` |
| coordinator | `01-explanation.md` (→ chapter index), `03`, `03b` | 0, 9, 10 | — |

🔴 **Every fork got its position RANGE at dispatch time**, per the lesson recorded on
2026-09-03 (a fork handed a spare position splits instead of trimming) and the Python lane's
six-collision incident. `03`/`03b` were renumbered **3→9** and **4→10** *before* dispatch,
because agent A's range would otherwise have collided with them while it wrote.

### 🔴 The previous session's bank promise was FALSE — grep a bank before promising it

The 2026-09-04 wind-down block below says *"the same banks cover the three remaining stubs"*.
**It does not.** Grepped before dispatching, per the process fault recorded for ch3:

| Keyword | In any nextjs bank? |
|---|---|
| `multiZone`, `assetPrefix`, `Module Federation` | **no** |
| `getServerSideProps`, migration-guide material | **no** |
| plugin / extension surface | **no** |

`basePath` appears only in the PWA bank, `codemod`/`turbopack` only in the ch1 bank. So each
agent was given a **fetch budget** (4, 5, 5) and its own bank file to write —
`research_nextjs_ch17_multizone.md`, `…_migration.md`, `…_extension.md` — rather than a
pointer to research that does not exist. **Do not re-promise these banks without grepping.**

### 🔴🔴 TWO FINDINGS OUTSIDE CHAPTER 17 — found, not fixed, both spawned as tasks

Both came out of ONE fetch of
[`file-conventions/error`](https://nextjs.org/docs/app/api-reference/file-conventions/error)
(page metadata: **version 16.3.4, lastUpdated 2026-07-10** — matches the pin exactly).

**1 · `reset` is version-stale across chapter 7.** The Version History says **`retry` became
stable in v16.3.0** (`unstable_retry` in v16.2.0), and the docs now say verbatim:
> *"In most cases, you should use [retry()](#retry) instead. However, if you have a specific
> reason to clear the error state and re-render the error boundary's children without
> re-fetching the contents, you can use the reset() function."*

The distinction is real — **`retry()` re-fetches AND re-renders; `reset()` only re-renders.**
The corpus is pinned at 16.3.4 and teaches `reset` as the primary prop in **8 ch7 files**
(`01-explanation`, `01-the-unified-error-model`, `02-errors-in-streaming`, `03-server-action-error-contracts`,
`05-loadingtsx-vs-inline-suspense`, `06-retry-fallback`, `07-project-milestone`, `10-custom-error-boundaries`).
⚠️ 6 ch2 files also match `reset()` but are probably **unrelated** (scroll/form reset) — check,
do not assume. 🔴 **This is `devbible-currency` work, not `devbible-topic` — the two passes
never merge**, which is why it was not fixed inline.

**2 · A rule that exists nowhere else was about to be deleted.** ch17's off-topic
`01-explanation.md` was the corpus's **only** statement of which errors an `error.tsx` does not
catch. Verified quote, which is **better than the corpus's old prose in two ways**:
> *"In the component hierarchy, error.js wraps loading.js, not-found.js, page.js, and nested
> layout.js files in a React error boundary. It does not wrap the layout.js or template.js
> above it in the same segment."*

The old wording **omitted `template.js`** and **never said error.js DOES wrap *nested*
layouts**. Confirmed absent from ch7: `grep -n -i layout` on
`10b-what-boundaries-do-not-catch.md` returns only an unrelated layout-shift line, and
`"same segment"`/`"own layout"` across all of ch7 returns nothing. Its proper home is that
`10b` page — **which is EXACTLY 300 lines, i.e. at the cap**, so relocating it requires a
split into `10c`, not a trim. Not attempted mid-flight with three agents live in the same
checkout; a one-line pointer was left in the new chapter index so **the fact is not
destroyed**, and the split is spawned as its own task.

Two more facts from the same fetch that **no page in the track states**: `global-error` and the
built-in 500 page **render their own document and do not include your global styles**, so an
app-level theme toggle never reaches them; and `global-error` was introduced in **v13.1.0**,
with **v15.2.0** making it display in development too.



## ⏹️ WOUND DOWN 2026-09-04, session `21a54205` — COLD START READS THIS FIRST

**User instruction: *"do not work on anything just save session progress for cold start"*.**

🔴 **THERE IS NO SALVAGE. Nothing was left uncommitted.** Verified at wind-down:
`git status --porcelain docs/ src/` empty, `git log @{u}..HEAD` empty in **both** the devbible
checkout and the memory store — everything committed **and pushed**. A cold start does **not**
need to hunt for half-written files in `docs/nextjs/`.

| | |
|---|---|
| **Resume at** | `docs/nextjs/pages/17-advanced-ecosystem-topics/01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md` — `sidebar_position: 1`, 58-line generated stub, `ls`-confirmed to exist 2026-09-04 |
| **Then** | `02-pages-router-…` (pos 2) and `04-framework-extension-…` (pos 5), both stubs; finally rewrite `01-explanation.md` as a real chapter index |
| **Chapter 17 is** | 2 of 6 authored — `03` and `03b` closed this session |
| **Track** | **142 / 254 verified**, ch17 row on `progress.js` now `topics: 6, pages: 2, pagesPlanned: 6`, `part: 'Refreshed for 16.3'` |
| **Commits** | `2a82d1fe` (the two pages) · `e01177a5` (the board row) · store `df184c5` |

🧩 **2026-09-04, LATER, session `bf92d5b6` — chapter 7, a separate piece of work that did NOT
move this cursor.** The `error.js` component-hierarchy rule was stated nowhere in ch7; `10b`
was split into `10c` + `10d` (300 → 776 lines, 10 → 21 ★) and an S1 was fixed on page 10.
ch7 is now **16 files / 8 verified**. Full record, including four facts banked from that one
fetch: [[progress-nextjs-ch7-boundary-hierarchy]]. 🔴 **It also found that ch17's
`01-explanation.md` was never actually rewritten into a chapter index — it is still the
143-line off-topic page**, contrary to what the ch17 block below implies.

**Read the 2026-09-04 chapter-17 block immediately below this one** — it carries the chapter's
per-file state table, the two recorded defects, the ch10/ch17 scope boundary, and the React
taint probe. Nothing in it needs re-deriving.

⚠️ **Do NOT re-fetch anything for chapter 17.** Both pages were written with **zero fetches**,
off the CVE section further down this file plus [[research-nextjs-ch1-foundations]] (the LTS
tiers and the bundled-canary rule) and one T1 probe. The same banks cover the three remaining
stubs.

---


## ▶️ 2026-09-04 — CHAPTER 17 STARTED: concept 03 authored and split (58 → 416 lines, 0 → 15 ★)

**Session at 92%+ usage — user's instruction: *"when you pick something update memory every
time"*. Per-file cadence, one concept per commit, memory written before moving on.**

🔴 **START HERE → `docs/nextjs/pages/17-advanced-ecosystem-topics/01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md`**
— a 58-line generated stub, `sidebar_position: 1`. Chapter 17 has **four** syllabus concepts;
**03 is done**, three remain (01 micro-frontends/multi-zones, 02 Pages→App migration,
04 framework extension). Then rewrite `01-explanation.md` as a real chapter index.

### Chapter 17 state on disk, measured 2026-09-04

| File | pos | lines | State |
|---|---|---|---|
| `01-explanation.md` | 0 | 143 | 🔴 **OFF-TOPIC** — it is about `'use client'` placement, Suspense granularity and `error.tsx` nesting. That is chapter 3 and chapter 7 material, not "Advanced Ecosystem Topics". Rewrite as a chapter index |
| `01-micro-frontends-…` | 1 | 58 | generated stub — **next** |
| `02-pages-router-…` | 2 | 32 | 🔴 stub whose body is a **verbatim fragment of `01-explanation.md`** ("adapted from existing chapter overview content"). Same duplicate-body defect ch1 had |
| `03-enterprise-compliance-…` | 3 | **243** | ✅ authored, 7 ★, 9 gotchas, 8 Q |
| `03b-supply-chain-vigilance.md` | 4 | **173** | ✅ authored, 8 ★, 9 gotchas, 7 Q |
| `04-framework-extension-…` | 5 | 58 | generated stub — position bumped 4 → 5 to make room for 03b |

Body-hashed before planning, per the standing rule: **no byte-identical duplicates in ch17**,
but `02` is a *fragment* duplicate, which the hash does not catch. ⚠️ **Hashing catches
identical bodies; it does not catch a stub built from a slice of the overview. Read the
overview, then skim each stub for its opening paragraph.**

### 🔴 The finding worth keeping — the taint APIs are not where every guide says they are

**T1 probe, pin-matched (`react` **19.2.8** installed = the corpus pin):**
`Object.keys(require('react'))` returns **no `experimental_taint*` entry at all** — not
`experimental_taintObjectReference`, not `experimental_taintUniqueValue`. Full stable surface
probed and quoted verbatim on the page.

Why it matters, and it is a genuine two-router trap:

- **App Router** reaches them through **Next's bundled React canary** (the ch1 banked rule:
  the App Router does *not* resolve your `package.json` React), behind `experimental.taint`.
- **Pages Router** resolves `package.json` React → the import is `undefined` → `TypeError`.
- A shared `lib/` module imported by both **behaves differently depending on which side
  pulled it in.**

**Conclusion written on the page:** tainting is a development backstop, never the control you
present to an auditor. The control is the **hand-written DTO projection** at the boundary,
because it holds on both routers, needs no flag, and cannot be turned off by a config change.
Deny-listing (`delete user.passwordHash`) is a finding, not a fix — it is correct only for the
columns that existed when it was written.

### Scope decisions made, so the next session does not redo them

- 🔴 **ch10 already owns the CVE record** (`14-the-2026-cve-record-…`, `15-the-patching-habit-…`).
  ch17's page deliberately **does not repeat it** — it draws the *dependency-graph* conclusion
  from GHSA-2xp9-vwfh-vxw4 (libheif → `sharp` → image optimizer; AVIF **disabled**; patched
  **16.3.3 / 15.5.24**) and CVE-2026-75604 (Windows hosts, Pages Router *and* App Router
  without Cache Components, **no workaround**) and links out. Keep that boundary.
- **OWASP identifiers mapped against Top 10:2021**, and the page **says so in a ⚠️ callout**:
  a newer edition may have superseded it and the primary source was **not re-fetched**. Written
  as explicitly uncertain rather than guessed — the seam table is the durable artifact, the
  numbering is not.
- The `experimental.taint` behaviour **under 16.3.4 specifically** was likewise not re-fetched
  and is flagged on the page as unconfirmed.

**No fetches were made this session.** Both pages were written from the banks already in this
file (the CVE section) and [[research-nextjs-ch1-foundations]] (the LTS/bundled-canary rules),
plus the one T1 probe. That is the research-once-per-topic rule paying out.

### Cheapest remaining closes on the track

**ch17 (3 stubs left)** and **ch18 (5 pages, 423 lines, no duplicates — body-hashed
2026-09-04)**. Nearest to done: **ch12 (28/35)**, **ch2 (11/20)**. Wholly untouched: 6, 9, 14,
18, 19.

---

## ✅ 2026-09-04 — CHAPTER 3 AUTHORED AND CLOSED (7 → 10 files, 353 → 1,918 lines, 0 → 86 ★)

**Track: 140/252 verified, 56%. Three of nineteen chapters fully authored — 1, 3, 4.**

Coordinator + one `devbible-author` agent, split **disjoint by filename** with
`sidebar_position` ranges handed out explicitly. **All three of the agent's pages outgrew the
cap and were split**, so 7 files became 10.

| File | Before | After | ★ | Owner |
|---|---|---|---|---|
| `01-explanation` (overview) | 127 | 55 | — | me |
| `01-default-architecture-…` | 39 | 122 | 8 | me |
| `02-use-client-…` | 40 | 131 | 8 | me |
| `03-composition-patterns-…` | 50 | 199 | 8 | me |
| `04-react-192-primitives-…` | 24 | 296 | 12 | agent |
| `04b-activity-and-offscreen-state` | — | 245 | 13 | agent |
| `05-enforcing-boundaries-…` | 50 | 226 | 8 | agent |
| `05b-what-server-only-does-not-protect` | — | 230 | 9 | agent |
| `06-bundle-size-…` | 23 | 138 | 11 | agent |
| `06b-measuring-the-boundary` | — | 275 | 9 | agent |

**Split proofs, both totals up:** `05` 327/10 → 456/17 · `06` 350/15 → 413/20 · `04` written as
two concept-separate pages rather than one 500-line file (541/25).

### 🔴 Verifying the one substantial page found THREE factual errors

The overview was the chapter's only "substantial" page (127 lines of real content), so it was
**verified rather than rewritten**. All three defects are now recorded *on* the page:

1. **"React context that a Server Component needs to read"** listed as a reason for
   `'use client'` — **Server Components cannot read context at all.**
2. **"importing a Server Component … isn't even allowed"** — nothing errors; the import
   **silently** moves it into the client graph, failing later somewhere confusing.
3. **`Date` listed among props needing conversion** — React serializes `Date`, `Map`, `Set`.

⚠️ **It got SHORTER on purpose, 127 → 55**, because it now defers to the ch1 pages written the
same session rather than duplicating them. **Do not "restore" its length.**

### 🔴 The agent's best contribution: the compiler source outranks the prose docs

It read `crates/next-custom-transforms/src/transforms/react_server_components.rs` and banked
the **actually enforced** import lists and verbatim error strings. That is far stronger evidence
than the documentation prose. All of it is in [[research-nextjs-ch3-boundaries]] — **and the
Pages-Router error variant is deliberately NOT banked**, because it was only captured
truncated and a fragment would be worse than nothing.

It also **corrected the old stub rather than inheriting it**: the stub claimed `Activity`
preserves scroll position; React documents state and DOM only, and `display: none` destroys the
layout box. Written as undocumented, with instructions to capture it yourself. React 19.2
stability was settled by **T1 probe of the installed `react` 19.2.8** (`Activity`,
`useEffectEvent`, `cacheSignal` present; `ViewTransition` absent), matching the pin.

### Two process faults, both mine

1. 🔴 **My dispatch told the agent the Server/Client Components quotes were banked in
   [[research-nextjs-ch1-foundations]]. They were not** — that doc was fetched *after* the bank
   was written. The agent caught it and sourced from the ch1 page's inline quotes instead.
   **Lesson: state what a bank holds by section, and `grep` it before promising an agent it is
   in there.** A note to that effect is now at the top of the ch1 bank.
2. **My `sidebar_position` spare ranges (7–9) produced a wrong sidebar order** — 04, 05, 06,
   05b, 04b. The agent followed the assignment literally and **flagged it rather than silently
   reordering**, which was the right call. Renumbered 0–9 to reading order at close.

⚠️ **The agent also reported ch1's `04-versioning` still stating LTS in minors. It does not** —
that page was rewritten earlier the same session and the claim was already corrected. It read a
stale copy. **Verified before acting; no change made.**

### QC

0 over cap · 0 MDX hazards · 0 `{/* FOOTER */}` markers · 0 duplicate `sidebar_position`
(0–9 gap-free) · all 15 link targets resolve · every page badged and carrying `> Verified:`.
⚠️ ch3 has **no `README.md`** — its `_category_.json` uses a `generated-index`, so the
topic-README house-style shape does not apply here.

---

## ▶️ 2026-09-04 — CHAPTER 3 IN FLIGHT: coordinator's 4 pages DONE, agent live on 3

**User: *"deploy 2 agents including you split the task"*, at 90%+ usage.** Split **disjoint by
filename**, per the recorded lesson, with `sidebar_position` ranges handed out explicitly:

| Owner | Files | positions | split spares |
|---|---|---|---|
| **Coordinator (me)** | `01-explanation`, `01-default-architecture`, `02-use-client`, `03-composition-patterns` | 0–3 | 10–12 |
| **`devbible-author` agent** | `04-react-192-primitives`, `05-enforcing-boundaries`, `06-bundle-size-cwv` | 4–6 | 7–9 |

### ✅ My four are written, committed and pushed individually

| File | Before | After | ★ |
|---|---|---|---|
| `01-explanation` (overview) | 127 | 55 | — |
| `01-default-architecture-…` | 39 | 122 | 8 |
| `02-use-client-…` | 40 | 131 | 8 |
| `03-composition-patterns-…` | 50 | 199 | 8 |

⚠️ **The overview got SHORTER on purpose (127 → 55) and that is the right outcome, not a
trim.** It was the chapter's one *substantial* page, so it was **verified rather than
rewritten** — and most of its content duplicated the chapter 1 pages written earlier the same
session. It is now a chapter index that defers to ch1 rather than restating it. **Do not
"restore" its length.**

### 🔴 Verification of that overview found THREE factual errors — this is the evidence that the 12 substantial pages are worth verifying

All three recorded **on the page**, since each is a common misconception:

1. **"React context that a Server Component needs to read"** was listed as a reason to use
   `'use client'`, implying a Server Component can read context if you supply a client
   provider. **It cannot — context is not supported in Server Components at all.**
2. **"importing a Server Component from inside a Client Component (which isn't even
   allowed)"** — nothing is disallowed and nothing errors. The import **silently** moves the
   component into the client graph; the failure appears later at whatever server-only code it
   touches. Calling it forbidden sends people hunting an error message that never comes.
3. **`Date` listed among props needing conversion before crossing the boundary.** Wrong —
   **React serializes `Date`, `Map` and `Set`** in the RSC payload. Converting is unnecessary
   and costs type fidelity.

⚠️ **Also spotted, NOT fixed (outside my files):** the old overview cited **"Time to
Interactive"** as a Core Web Vital. TTI is no longer one. That belongs to `06-bundle-size-cwv`,
which the agent owns.

### ⏳ Agent still running at wind-down

Owns `04`, `05`, `06`. At last check its `05-enforcing-boundaries` was **327 lines — over the
300 cap**, which is its own file to split into positions 7–9 as briefed. **Its three files were
NOT committed by me.** 🔴 **Next session: check `git status docs/nextjs/`, QC whatever landed
(`wc -l`, `mdxcheck`, links, split proof UP), and commit it before writing anything new.**
Anything untouched for 10+ minutes is salvage.

### Chapter 3 close-out still owed

- Commit the agent's three files after QC.
- **Renumber gap-free** if the agent used spares 7–9 — the chapter must end 0..N with no gaps.
- Footer chain: my `03` → agent's `04` → `05` → `06` → `../04-data-fetching-…/01-explanation.md`.
- `src/data/progress.js`: ch3 row from `pages: 0` / `Imported corpus` to `7` / `Refreshed for
  16.3` **only once all 7 are in**.

## 📋 2026-09-04 — CHAPTER 3 MEASURED, NOT WRITTEN (session wound down at 90% usage)

**Nothing was written to `docs/nextjs/pages/03-server-components-vs-client-components/` — it is
untouched on disk and free to claim.** This block is the survey so the next session does not
repeat it.

**Pending on the whole track: 119 pages of 249. 130 verified (52%).** Seven chapters wholly
untouched — **3, 6, 9, 14, 17, 18, 19 = 45 pages**; ten part-done — 2, 5, 7, 8, 10, 11, 12, 13,
15, 16 = **74 pages**. Closest to closing: ch12 (28/35) and ch2 (11/20). Smallest: ch17 and
ch18 at 5 pages each.

### Chapter 3 is in better shape than 1 and 4 — measure, do not assume

**7 files, 353 lines, ~50 lines a page.** Only **one** duplicate pair, not seven-of-nine:

🔴 **`03-composition-patterns-…` and `05-enforcing-boundaries-…` have byte-identical bodies**
(confirmed with `diff` over the `^## ` section onward). The other five pages are genuinely
distinct, if thin.

| File | Lines | pos |
|---|---|---|
| `01-explanation` — Overview | 127 | 0 |
| `01-default-architecture-everything-is-a-server-component-rsc` | 39 | 1 |
| `02-use-client-when-and-why-to-opt-in-interactivity-browser-apis` | 40 | 2 |
| `03-composition-patterns-server-to-client-boundaries` | 50 | 3 |
| `04-react-192-primitives-useeffectevent-for-non-reactive-side-ef` | 24 | 4 |
| `05-enforcing-boundaries-with-server-only-client-only-packages` | 50 | 5 |
| `06-bundle-size-implications-and-core-web-vitals-impact` | 23 | 6 |

**The pathology assumption still stands for the untouched chapters** (6, 9, 14, 17, 18, 19) —
ch1 was seven-of-nine duplicated and ch4 had three byte-identical stubs. **Always run the body
hash before planning a chapter:**

```bash
for f in *.md; do echo "$(sed -n '/^## /,$p' "$f" | md5sum | cut -c1-8)  $f"; done | sort
```

### 🔴🔴 SCOPE WARNING — chapter 3 now overlaps chapter 1

Chapter 1's newly authored `03-core-philosophy-server-first-rendering.md` and
`03b-hybrid-static-dynamic-and-the-cost-model.md` **already own**, to full depth: the
`'use client'` module-graph rule and its viral-downward behaviour, the imports-vs-children
exception and the slot pattern, RSC payload contents and prop serializability, `server-only` /
`client-only` and the empty-string env var trap, third-party component wrapping, context
provider placement, and the static/dynamic cost model.

**Chapter 3 must NOT restate those.** It should link back and go deeper where ch1 stopped:

- **`04-react-192-primitives`** — `useEffectEvent`, `Activity` for offscreen content. ch1 does
  not touch these at all. **The largest genuinely-new surface in the chapter, and the thinnest
  page at 24 lines.** ⚠️ Research NOT banked — needs react.dev primary sources.
- **`06-bundle-size-and-Core-Web-Vitals`** — ch1 argues the boundary qualitatively; this page
  should be the measurement side (what to look at, how the boundary shows up in LCP/INP).
  23 lines today. ⚠️ Research NOT banked.
- **`05-enforcing-boundaries`** — ch1 introduces `server-only`; this page owns the practice.
  Must be written fresh regardless, since its body is currently a copy of `03`.
- **`01`, `02`, `03`** — heavy overlap with ch1. Consider whether these become shorter pages
  that defer to ch1, rather than being expanded to the full depth bar. **Worth asking the user
  before spending a session expanding material that now lives in chapter 1.**

**Banked research covering ch3 partially:** [[research-nextjs-ch1-foundations]] carries the
Server/Client Components doc quotes (module graph rule, children exception, RSC payload,
serializable props, `server-only`, env var empty-string, third-party wrapping, provider depth).
**Do not re-fetch that doc.** React 19.2 primitives and Core Web Vitals are NOT banked.

## ✅ 2026-09-04 — CHAPTER 1 AUTHORED AND CLOSED (9 files, 643 → 1,621 lines, 0 → 78 ★)

**User: *"go ahead and author chapter 1 properly"*, after *"first wire it in UI"*.** Worktrees
checked first as instructed — one checkout, one branch, nothing to merge; the 2026-08-15
consolidation still holds.

**Track: 130/249 verified, 52%.** Two of nineteen chapters fully authored (1 and 4).

### What chapter 1 actually was

🔴 **Seven of the nine pages carried the SAME copy-pasted overview block below their
frontmatter.** `02` and `03` were byte-identical to each other; `01-evolution` was a truncated
30-line fragment of the same text; `04`, `05`, `06` and `07` each had it under their own
correction callout. **Pages 02 and 03 taught nothing whatsoever about their own titles.** The
only genuinely unique content in the chapter was the three 2026-09-03 correction callouts —
which were good, and were preserved and expanded rather than discarded.

### The pages, all committed individually

| File | Before | After | ★ |
|---|---|---|---|
| `01-explanation` (overview) | 109 | 158 | 7 |
| `01-evolution-…` | 30 | 169 | 9 |
| `02-nextjs-vs-alternatives-…` | 65 | 136 | 8 |
| `03-core-philosophy-…` | 65 | 245 | 11 |
| `03b-hybrid-static-dynamic-…` | — | 149 | 8 |
| `04-versioning-and-lts-…` | 84 | 198 | 8 |
| `05-project-setup-…` | 91 | 228 | 10 |
| `06-hello-world-…` | 65 | 165 | 8 |
| `07-key-framework-shifts-…` | 83 | 173 | 9 |

🔴 **Split proof for 03 → 03 + 03b, derived from `git show HEAD:` not taken on trust:
65 → 394 lines, 0 → 19 ★. Both UP.** Boundary = the `'use client'` module-graph rule vs the
hybrid static/dynamic cost model.

**Deleted `04-…-2.md`** — a pure pointer stub (*"this file is the sidebar entry for the concept
name itself"*) parked by the import at `sidebar_position: 4.5`, which also broke the gap-free
rule. 0 inbound links, verified before deleting; its only real content was a duplicate of the
correction callout. Positions renumbered gap-free **0–8**.

### 🔴 Findings that CORRECT this corpus's own earlier corrections

1. **The LTS callout was wrong, and it is repeated across the book.** It said *"Active LTS
   (currently 16.3) and Maintenance LTS (currently 15.5)"*. **The support policy is stated in
   MAJOR versions** — 16.x Active (Oct 21 2025), 15.x Maintenance (Oct 21 2024). Naming minors
   implies 16.2 is unsupported (it is not) and that 15.5 is a supported *version* rather than
   the newest minor on a line. ⚠️ **Grep the rest of the corpus for this phrasing.**
2. **Two policy facts that were on no page anywhere.** On a Maintenance line, updates land as
   **semver-MINOR releases "even if they are breaking changes"** — so `^15.5.0` is a live risk,
   and the same caret means different things on 16.x and 15.x. And maintenance runs **two years
   from the major's INITIAL release**, so 15.x closes ~Oct 21 2026 — weeks away. The page
   teaches the arithmetic rather than quoting an interval that rots.
3. **`create-next-app`'s two prompt lists disagree.** `Would you like to use React Compiler?`
   is in the *customize* prompts and **absent from the recommended-defaults line** — so the
   path most people take leaves the compiler off. Found by reading the two lists against each
   other, not from any single doc sentence.
4. **`--yes` uses SAVED PREFERENCES before defaults**, so two developers running the same
   documented command get different projects. That makes it unfit for team setup instructions.

### Written as explicitly uncertain, on purpose

- **Remix v3 being a separate non-React project**: credible secondary reporting that the
  **primary source does not mention at all**. Marked unconfirmed on the page.
- **TanStack Start's 1.0 status**: sources **actively contradict each other** (an RC "pending
  final feedback" vs 1.x already stable). Both readings named, reader sent to the vendor.
- **`experimental.useTypeScriptCli` being an opt-OUT**: inherited from the earlier pass and
  attributed as such rather than re-claimed as freshly derived.
- **Every Vercel benchmark** is labelled as theirs, measured on their apps, and the
  `> Verified:` lines record **no benchmarks run**.

### QC

0 over the 300-line cap · 0 MDX hazards · 0 `{/* FOOTER */}` markers · 0 duplicate
`sidebar_position` · every page badged and carrying `> Verified:` · every relative link
resolves, cross-chapter link to ch2 checked with `ls`.

### 🔴 The next chapter

**START HERE → `docs/nextjs/pages/03-server-components-vs-client-components/`** — 7 files, 0
verified. ⚠️ **Check it for the same copy-paste pathology before planning: run
`for f in *.md; do md5sum <(sed -n '/^## 1\./,$p' "$f"); done` and diff the bodies.** Chapters
1 and 4 both turned out to be mostly one duplicated block, so assume 3, 6, 9, 14, 17, 18, 19
are too until measured. ⚠️ **Chapter 3 overlaps heavily with ch1's `03`/`03b`**, which now own
the `'use client'` module-graph rule and the static/dynamic cost model — chapter 3 should go
deeper (the boundary in practice, `server-only`, third-party wrapping, context) and link back
rather than restate.

**Research is banked** in [[research-nextjs-ch1-foundations]] — the support policy, the full
`create-next-app` prompt set, the 16.3 feature list, the floors, and the React-canary rule.
**Do not re-fetch those for any chapter-1 page.**

## 🔴 2026-09-04 — CHAPTER 1 SURVEYED, AND IT RESHAPES THE BACKFILL ESTIMATE

**Read this before starting ch1, or any "backfill" chapter.** Surveyed but **not yet
written** — the session was asked to save progress at this point, so ch1 is untouched on
disk and free to claim.

🔴 **"Backfill the `> Verified:` line and tier badge" is the wrong description of this job,
and acting on it literally would ship a lie.** Chapter 1 is **9 files, 643 lines, averaging
71 lines a page** — thin imported stubs. A `> Verified:` line asserts the page was checked
against a primary source *and* meets the depth bar; stamping one on a 30-line stub makes the
homepage bar (which now counts exactly that line — see above) read as progress that did not
happen. **These chapters need authoring, not stamping.** Chapter 4 is the precedent and the
honest measure of cost: **6 imported stubs became 24 chunks**.

**Chapter 1's inventory, measured:**

| File | Lines | Note |
|---|---|---|
| `01-explanation.md` | 109 | chapter overview, `sidebar_position: 0` |
| `01-evolution-from-pages-router-to-app-router-…` | 30 | 🔴 the thinnest page in the chapter |
| `02-nextjs-vs-alternatives-…` | 65 | |
| `03-core-philosophy-server-first-rendering` | 65 | |
| `04-versioning-and-lts-model-…` | 84 | ⚠️ **duplicate pair, see below** |
| `04-versioning-and-lts-model-…-2` | 51 | ⚠️ at `sidebar_position: 4.5` |
| `05-project-setup-create-next-app-…` | 91 | |
| `06-hello-world-with-the-app-directory` | 65 | |
| `07-key-framework-shifts-…` | 83 | |

**Three concrete defects found in the survey, all fixable in the authoring pass:**

1. ⚠️ **The two `04-versioning-and-lts-model-…` files are a near-duplicate pair** — the
   import found them both at `sidebar_position: 4` and moved the shorter to **`4.5`** rather
   than resolving them. 🔴 **`4.5` also violates house style**, which requires
   `sidebar_position` unique **and gap-free** within a directory. Merge them into one page
   and renumber; do not simply delete the shorter without diffing it — they *differ*, which
   is why the import kept both.
2. 🔴 **Both versioning pages teach the stale claim verbatim** — their `description`
   frontmatter carries *"current stable is 16.2.x; 16.3 is in preview"*. Upstream: **16.3.4,
   GA 2026-08-03, 16.3 = Active LTS · 15.5 = Maintenance LTS.** This is the single most
   load-bearing correction in the chapter, and it is duplicated across two files.
3. **Every page carries import furniture, not house style** — an `# ▲ <title>` heading, a
   `> **Syllabus chapter:** … > **Exact concept:** … > **Source:** adapted from existing
   chapter overview content` block, and `[D]`/`[O]`/`[R]` priority badges with a legend
   block on `01-explanation.md`. All of it is replaced by the tier badge + `> Verified:`
   line. **No page has `## Gotchas` or `## Interview questions` at all.**

**`07-key-framework-shifts-…` names three claims that must each be re-verified, not assumed:**
stable React Compiler support (the corpus-wide finding is `reactCompiler` **stable** while the
**Rust port is experimental**), async `params`/`searchParams`, and the Node.js floor — which
the 2026-09-03 pass measured at **20.9**, not the "20+" the page says.

🔴 **Research is NOT yet banked for chapter 1.** Bank it once for the whole chapter before
writing, per the skill — a chapter that re-fetches per page pays the cost nine times.

## ▶️ 2026-09-04, session `cb25d15f` — wired into the UI

**User: *"continue with next js first wire it in UI"*.** Two defects, both in the site's own
progress surface rather than in the pages.

### 🔴 The track was invisible and the bar was lying

**Next.js had no card on the homepage at all** — 247 content pages, 37k lines, 19 chapters, and
no entry in `LAYERS` in `src/pages/index.js`. Added to the **Frontend** layer after React (it is
a React meta-framework), with `data: summarise('nextjs')` and no `done` flag, so `statusOf()`
renders it **In progress**.

**And `progress.js` was claiming the whole track finished.** All 19 chapters read
`topics: N, pages: N`, so `summarise()` returned 249/249 = 100 %. The truth measured off disk:
**121 of 247 content pages carry a `> Verified:` line.**

🔴 **The rule, and the precedent that settles it: an imported page nobody has vouched for scores
ZERO, however readable it is.** Storybook's phases 4–10 read `pages: 0` with 22 imported pages
sitting in them. So `pages` = the `> Verified:` count, `pagesPlanned` = the chapter total, which
makes `phaseStatus()` return `'writing'` and the phase count pro rata. Bar now reads
**121/249 = 49 %**, one chapter written (ch4), `inFlight` = ch2.

Per chapter, measured, not estimated — `topics / verified`: 1 · 9/0 · 2 · 20/11 · 3 · 7/0 ·
**4 · 39/39** · 5 · 16/9 · 6 · 7/0 · 7 · 14/6 · 8 · 10/2 · 9 · 7/0 · 10 · 13/6 · 11 · 10/2 ·
12 · 35/28 · 13 · 10/4 · 14 · 8/0 · 15 · 12/5 · 16 · 16/9 · 17 · 5/0 · 18 · 5/0 · 19 · 6/0.

**ch5 had drifted**: 9 authored pages while still flagged `part: 'Imported corpus'`, which
`recentlyUpdated()` filters out of the homepage freshness row. The 2026-09-03 pass listed ten
refreshed chapters and ch5 was not among them; it is now. Flipped to `'Refreshed for 16.3'`.

### The README had no Progress block

Every other track's README carries `<Progress lang="..." compact />`; Next.js never got one.
Added, with a note stating what the bar counts, so the 49 % cannot be misread as "half the pages
are missing" — they are all there, half are unvouched.

Corrected three stale claims on the same README while there: the page count (**135 → 247**), the
"one file over 300" known defect (**closed** — that 431-line ch4 file was split 2026-09-03, the
track is at **0 over cap**), and the "no `> Verified:` lines on the 135 imported pages" defect,
rescoped to the **126 still owed** and now naming the nine un-backfilled chapters.

### 🔴🔴 Two traps for the next session

1. **A local `yarn build` OOMs at the default heap.** `FATAL ERROR: Reached heap limit
   Allocation failed - JavaScript heap out of memory`, exit 129, **before a single page
   compiles**, on a 14 GB box. It is the corpus size, not your change.
   **`NODE_OPTIONS=--max-old-space-size=8192 yarn build` passes, exit 0.** Do not read a bare
   build failure as your own breakage, and do not start bisecting your diff.
2. ⚠️ **The java session's commit `705839d7` swept my uncommitted `progress.js` nextjs rows into
   itself** — it staged paths outside its own lane, so `git diff src/data/progress.js` showed
   only *its* java delta and my work looked clobbered. It was not: the content is correct in
   `main`. **Check `git show HEAD:<file>` before re-applying an edit that appears to have
   vanished** — in a shared checkout, "my change is gone" and "someone else committed my change"
   look identical from `git diff`.

**QC:** build exit 0 with the raised heap, **0 broken links under `docs/nextjs`** (the 19
warnings were java 17 / python 2, other sessions' lanes), 0 MDX hazards. Commit `9ca1ebcd`,
pushed; the java sweep carried the `progress.js` half in `705839d7`.

### 🔴 START HERE

**The `> Verified:` + tier-badge backfill on the imported pages.** Nine chapters are wholly
un-backfilled — **1, 3, 6, 9, 14, 17, 18, 19** — plus the two chapter READMEs (ch2, ch5).
**Chapter 4 is the only fully-authored chapter and is the model to copy.** Every page backfilled
moves the homepage bar, because the bar now counts exactly that line.

Then the ch12 **server-side idempotency contract** page — drafted by fork A on 2026-09-03 and
never shipped, and **every write-queue page in the chapter sends `Idempotency-Key` and asserts
the server enforces it, while nothing in the chapter shows that enforcement.** Spec is written
out below; do not re-derive it.


**Session `211cedce`.** Two pieces of work, in this order: a verification pass against
nextjs.org, then a verbatim import into devbible on the user's instruction.

## ▶️ 2026-09-03, session `5380787e` — the named open items, three forks

**User: *"Continue with next js"*, then *"you can deploy max 3 more agents ... split the work
and use devbible skill"*, then *"wire the boards and commit when the forks land"* and
*"Fix all please"*.** Resumed from the "Still open on this track" list below rather than
starting anything new. Loaded `devbible-topic` + its three references FIRST — the previous
session's own recorded lesson.

🔴 **Research banked BEFORE dispatch** so three forks did not each re-fetch:
[[research-nextjs-pwa-background-sync-and-testing]] — Background Sync API, `SyncManager.register`
exceptions, `SyncEvent.lastChance`, and the load-bearing find that **Lighthouse removed the PWA
category in 12.0.0** because Chrome dropped the service-worker-with-`fetch` install requirement
(108 mobile / 112 desktop).

### ✅ Closed this session

- **`webpush 3.6.7` pin proven end-to-end** — the open item said `currency.mjs --check` had never
  been re-run after adding it. Run: pin == latest, 3 pages, `claimedMatchesPin: true`, drift none.
  🔴 The run rewrites `static/currency.json`; **reverted it** rather than commit a site-wide
  artifact from a Next.js-only lane.
- **`part: 'Imported corpus'` was lying** (commit `b5bddea2`). `recentlyUpdated()` filters a track
  out of the homepage freshness row while *every* phase carries that flag. 76 pages have since
  been authored here, so it had started lying in the other direction. Flipped to
  `'Refreshed for 16.3'` for the **ten** chapters that actually carry authored pages — measured
  off disk by `> Verified:` presence per page, **not** off the git log: 02 (4/13), 04 (15/21),
  07 (6/14), 08 (2/10), 10 (6/13), 12 (23/30), 13 (4/10), 15 (5/12), 16 (9/16), 11 (2/10). The
  nine untouched chapters keep the old flag.
- 🔴 **The 431-line ch4 overview is SPLIT** (commit `fa13a2f5`) — the only file on the track over
  the cap. It was three concatenated write-ups; `## 1. Under-The-Hood Mechanics` appeared three
  times. Now `01-explanation` (292) + `01b` (165) + `01c` (275) + `01d` (238).
  **Split proof, checked against `git show HEAD:` myself rather than taken from the fork's
  report: 431 -> 970 lines (+539), 0 -> 43 ★ (+43).** Both up.
  **Eight 16.2-era claims corrected for 16.3.4**, each doc-verified: `fetch()` default is
  `auto no cache` (an upgraded route goes static and *stale*, not dynamic) · Route Handlers are
  **not** cached by default since v15.0.0-RC, so the imported "only logs at BUILD time" pitfall
  was exactly backwards · a `POST` sibling does not un-cache a `GET` · `updateTag` not
  `revalidateTag` is read-your-own-writes · `useFormStatus` is from **react-dom** (T1-probed on
  the installed react 19.2.8) · the `useActionState` dispatch returns `void` so it cannot be
  awaited · `useActionState` returns three elements · progressive enhancement is not free for an
  inline client-side arrow.

### ✅ Fork A — ch12 the offline WRITE side (commit `d341171d`, 4 chunks, 1,159 lines)

The PWA topic taught the read side across 17 chunks and stopped exactly where a user gets
hurt: they tap Save while offline. `10r` durable outbox (+ why `useOffline` does not solve
this) · `10s` outbox module and idempotent delivery · `10t` Background Sync register / the two
exceptions / drain in `waitUntil` / `lastChance` · `10t2` the foreground floor for the majority
of browsers that lack the API.

🔴 **`10t` drafted at 355 and SPLIT, proven up: 355 → 297+298 = 595 lines, 13 → 20 ★.**
Boundary = the native API vs the floor underneath it. Gotchas redistributed to the half each is
about; one near-duplicate merged rather than shipped twice.

🔴 **Seven claims written as explicitly uncertain, and this is the point of the chunk:**
**MDN documents NO retry count, interval or time budget for background sync — `lastChance` is
the entire documented surface.** Any number quoted for this is someone's measurement of one
browser version, not a contract. Also: **MDN and Workbox disagree** on whether a `sync` event
fires after the registering page closes (MDN's `sync` event page says "is running"; Workbox
describes needing an active page as its *non-native fallback's* limitation, unlike native) —
both readings named, conclusion is drain at next app start regardless.

**Banked from fork A's 5 fetches** (append to the bank if re-touched): MDN IndexedDB
(available in Web Workers, transactional, structured-clone, quota behaviour "differs between
browsers") · MDN `sync` event (the "is running" sentence — 🔴 bank it *with* the Workbox
conflict noted) · **Periodic Background Sync — fully researched and UNUSED, clean material for
a future chunk** (`minInterval`, `periodic-background-sync` permission, engagement-dependent
delivery) · Workbox `workbox-background-sync` (no default `maxRetentionTime` is documented —
do not quote one) · MDN `waitUntil` (rejection semantics documented for `install` ONLY).

🔴 **The highest-value page this chapter still owes, drafted by fork A and deliberately not
shipped because there was no legal slot: the SERVER-side idempotency contract** — the
`idempotency_keys` DDL, the Route Handler returning the stored response on replay and 422 on a
key/body mismatch, `hashRequest` via `crypto.subtle.digest`, and the two gotchas (insert+key
must share one DB transaction; the key table needs an expiry sweep). **All four shipped pages
SEND `Idempotency-Key` and assert the server must enforce it, and nothing in the chapter shows
that enforcement.** Also thin: the 409/conflict resolution path, and the pending/syncing/failed
UI contract.

### ✅ Fork B — ch12 PWA testing and auditing (commits `b7706ef3` + `ea4af127`, 7 chunks, 1,996 lines)

`10u` the Lighthouse PWA category is gone · `10v` the Application panel · `10w` a testable
environment · `10x` reproducing failures deliberately · `10y` testing offline and what the cache
holds · `10z` Playwright · `10z2` what no runner can reach + the manual checklist.

🔴 **The thesis is the value: Lighthouse removed the PWA category in 12.0.0 (Chrome 126)**,
because Chrome dropped the service-worker-with-`fetch` install requirement (108 mobile / 112
desktop). **"Run the Lighthouse PWA audit" is advice with no target**, and every checklist still
scoring that category is stale.

🔴 **`10z` drafted at 303 and SPLIT, proven up: 300 → 285+255 = 540 lines, 2 → 5 ★.** I refused
the 3-line shave explicitly — *three lines is exactly the size where a trim looks harmless* — and
handed it a spare slot instead. The split **added** a section, five gotchas and four questions.

**Committed in TWO parts on purpose.** The cadence hook fired while fork B was still live. Rather
than commit the directory, I diffed mtimes: `10u`/`10v`/`10w` were 14+ min settled, `10y`/`10z`
had been written to **90 seconds earlier**. Committed the three, held the four. 🔴 `10w`'s forward
link to the uncommitted `10x` was a *knowing* transient — `onBrokenLinks: 'warn'`, checked in
`docusaurus.config.js:41`, so a warning not a build break — and it was **stated in the commit
message** so history shows it was a decision.

🔴 **Fork A caught a build-breaker in fork B's file while B was still writing it** — an open
inline code span at `10y:222`. Cross-fork review found what neither the cap check nor the link
check can see. Fixed by B before its files were committed; nothing broken ever reached a commit.

**Banked from fork B's 5 fetches:** Chrome DevTools PWA reference (full Application-panel pane
list, the three Service Workers checkboxes, clear-storage wording) · Playwright `BrowserContext`
(*"Service workers are only supported on Chromium-based browsers"*; `setOffline` is a **context**
method, no page-level equivalent) · 🔴 **MDN Secure Contexts — `http://localhost` and
`http://127.0.0.1` are *potentially trustworthy*, which kills the "service workers need HTTPS on
localhost" myth** · `ServiceWorkerRegistration.update()` (*"bypasses any browser caches if the
previous fetch occurred over 24 hours ago"*) · 🔴 **`next start` has NO `--experimental-https`
— that flag is documented under `next dev` only.**

**✅ Fork B's flagged "live tension" in `10n` — CHECKED 2026-09-03 and CLEARED, do not re-open.**
Fork B noticed `10n` prunes on both 404 and 410 while the bank says RFC 8030 §7.3 makes **410 the
*receipt* path, not the application-server send path**, and flagged it rather than editing another
lane's page — correct behaviour. On inspection **the page is already right**: it attributes only
404 to the send path as normative, and words 410 as merely appearing *"in the same family of
'this endpoint is finished' responses"*, then justifies pruning on either because a subscription
deleted in error is recreated on the next subscribe. It never claims RFC normativity for 410.
Per the severity ladder this is **S5 at most — wording, ledger-only** — so it was deliberately
NOT edited. 🔴 A validation pass that rewrites prose stops being a validation pass.

### ✅ The wiring (commit `8bebdf51`)

Seams `10q → 10r` and `10t2 → 10u` wired, `10u`'s back-link repointed; chain unbroken
`10 → 10b..10q → 10r..10t2 → 10u..10z2`. Topic index rewritten (it still said "sixteen
siblings"). 🔴 **ch12 `sidebar_position` renumbered gap-free 0–34** — it ran `10..36` with the
old 7–9 hole plus the fractional `29.5` I allocated mid-flight; **held to last on purpose so it
could not collide with an in-flight fork's assigned position.** Boards: `progress.js` ch12
24→35 (19 chapters now sum to **231**, matching the filesystem exactly), `docs/README.md` rows
15 and 134, `docs/nextjs/README.md` 217→231 + steps 5–6.

### 🔴 The cap hook earned its keep — twice, on live forks

The repo's PostToolUse hook caught **two** fork files going over 300 mid-write (`10t` at 355,
`10x` at 350). Both forks were messaged **while still running** with the split-not-trim rule and
an *extra allocated `sidebar_position`*, so neither had any incentive to compress. Giving a fork
a spare slot at the moment you tell it to split is the cheap move that prevents the trim.

### Lane discipline that mattered

Forks were disjoint **by filename, not by directory** — A owned ch12 `10r`–`10t`, B owned
`10u`–`10y`, C owned ch4 `01`/`01b`/`01c`/`01d`. `docs/nextjs/pages/04-*` and `12-*` were left
untouched by the coordinator until each fork reported, and every commit staged **explicit file
paths** verified with `git diff --cached --name-only` first. That is the direct fix for this
track's recorded `c4a93105` error, where `git add docs/nextjs` swept in 13 files a fork was still
writing.

**Found, not fixed (other lanes):** 6 pages bold `**Next.js 16.3.1**`, all in `docs/react/`, all
honest historical citations dated 2026-08-14. React's lane.

✅ **Closed the same day** — see the chapter-4 block above. All six were rewritten; the
contradiction between `04`/`05` and the new `01b`–`01d` chunks no longer exists.

## ✅ DEPLOYED AND LIVE 2026-09-03 — run `33757328666` GREEN

**The first green deploy since 03:56 that day.** 11 commits pushed (`cf25dbde..f0c4fb9a`); the
store pushed too. Live sitemap: **6,153 URLs total, 254 Next.js**, ch4 **40**, ch12 **36**.

🔴 **The deploy had been RED for three runs and it was never Next.js.** Zero mentions of
`docs/nextjs` in the failing build log. Two Java files broke every build since 03:56:
`phase-12-jvm-production/09-distributed-tracing/06-sampling.md` and
`06b-the-trace-you-needed-was-not-sampled.md`, with
*"Could not parse expression with acorn"*.

**Cause: `$$...$$` LaTeX containing `\text{...}`.** MDX hands anything in `{ }` to acorn as a
JavaScript expression. **The site has no KaTeX/MathJax plugin**, so the math was never rendering
anyway — it was literal text that happened to contain braces. Fixed under explicit user
authorisation as a **cross-lane** edit (commit `f0c4fb9a`), prose untouched, `$$` blocks converted
to ` ```text ` fences with every number preserved.

🔴 **Four hazards, not the two the build named — acorn stops at the FIRST failure per file.**
`06-sampling:153` (`$2^{64}-1$` inline) and `06b:120` (`5{,}000`) would have become the next two
failures. **When you fix an acorn error, scan the whole file for every brace expression rather
than fixing the reported line.** Corpus-wide scan afterwards: **0 other files affected.**

🔴🔴 **THE TOOLING GAP THAT LET THIS SHIP — worth fixing.** `mdxcheck.py --no-rawtag` reports
**0 hazards on both files, before and after.** It knows three patterns — HTML comments, bare
`<Something`, open code spans — and a **brace expression is a fourth it does not check**. Three
deploys died while every local gate stayed green. `shared/scripts/mdxcheck.py` is shared tooling
across every lane and was deliberately NOT changed from a Next.js lock; **adding a brace-expression
rule to it is a standalone job worth doing.**

## 🔴 START HERE

Next.js in devbible is **imported, not authored**. The 140 pages are the frontend-bible
corpus moved across unchanged. **Nothing is owed on the import — it is complete and wired.**

✅ **CHAPTER 4 IS CLOSED, 2026-09-03 (session `5380787e`, 3 forks).** The six imported stubs — 37–52 lines each, and 🔴 **three of them byte-identical to one another**, the same "Under-The-Hood Mechanics" block copy-pasted under different titles — became **24 chunks**. `01`/`02` → 7 chunks (104→1,829, commit `004040f6`) · `03`/`06` → 6 chunks (97→1,592, `30df9575`) · `04`/`05` → 11 chunks (82→2,752, `e06f6ed7`) · wiring `3024623c`. **The `01d` vs `04` contradiction is gone.** ch4 is 39 files, renumbered gap-free 0–38; track at **249 pages / 37,315 lines**.

🔴 **Findings past the brief, all from version-history tables — do not re-derive:**
- **`request.ip` and `request.geo` were REMOVED in `v15.0.0`** and now read `undefined`. A rate limiter keyed on them silently collapses to a single bucket. (`04d`)
- **`v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` when Cache Components is enabled**, and their reference moved to a guide titled *Caching and Revalidating (Previous Model)*. "Just add `export const revalidate = 60`" is advice with a precondition. (`03`, `04f`)
- **`force-static` does not error, it BLANKS** — `cookies`, `headers()` and `useSearchParams()` return empty values, so an auth check silently takes the logged-out branch. `dynamic = 'error'` is the tool people actually wanted. (`03`)
- **The positional rule:** a `fetch` with no `cache` option runs once at build if reachable **before** any Request-time API, and per request if discovered **after** one — which is why one file can have a static half and a dynamic half. (`03`)
- **`runtime: 'edge'` and `preferredRegion` are marked deprecated in the current type.** (`04f`)
- Segment `revalidate` does **not** override a per-`fetch` `revalidate`; the **lowest** value anywhere on the route wins. (`03`)

⚠️ **A real documentation conflict, left visible rather than guessed:** the Route Segment Config options table still lists `dynamicParams` as available with default `true`, while the version history on the **same page** says it is removed under Cache Components. Both statements are named on the page and the reader is told to check their own build. **Do not "resolve" this without new evidence.**

**Method notes from this run:** fork A reported two of fork B's files as over cap — a **stale mid-flight observation**; both were 285/247 on disk and matched what was committed. 🔴 **Verify a cross-fork defect report against disk before acting on it.** Two forks needed one file beyond their reserved letter range (`01i`, `06c`) because the material would not divide three ways on concept boundaries — accepted, both slots checked free first.

🔴🔴 **START HERE next → the `> Verified:` / tier-badge backfill on the remaining imported pages.** Measured 2026-09-03: ch1 9/9 imported, ch3 7/7, ch5 7/7, ch6 7/7, ch9 7/7, ch14 8/8, ch17 5/5, ch18 5/5, ch19 6/6 are **wholly** imported; ch2 9, ch7 8, ch8 8, ch10 7, ch11 8, ch13 6, ch15 7, ch16 7, ch12 7 are partly. **Chapter 4 is now the only fully-authored chapter and is the model to copy.**

**Second-highest value, and already drafted once:** the **server-side idempotency contract** page
for ch12 (`idempotency_keys` DDL, the Route Handler replaying a stored response and rejecting a
key/body mismatch, `hashRequest` via `crypto.subtle.digest`). **All four write-queue pages SEND
`Idempotency-Key` and assert the server must enforce it, and no page shows that enforcement.**

**The version refresh** — the corpus was written for Next.js **16.2** and upstream is **16.3.4**.
The full corrected syllabus is already written and needs no re-derivation:

- `/mnt/Storage/Backup/Code/frontend/syllabus/nextjs_bible_syllabus_v2_16.3_PROPOSED.txt`
  — the refreshed 19-section syllabus, every change marked `[FIX]` / `[NEW]` / `[EXP]`
- `/mnt/Storage/Backup/Code/frontend/syllabus/NEXTJS_SYLLABUS_VERIFICATION_20260903.md`
  — the evidence behind it

⛔ **Do not re-fetch nextjs.org to redo this.** Six official sources were fetched on
2026-09-03 and their findings are recorded below and in those two files.

## ✅ CLOSED 2026-09-03 — wound down at 95% usage, everything pushed

**The Next.js track is complete and deployed: 140 imported pages → 217.** The PWA fork wound
up on request and delivered; nothing is owed on this track.

### Final state

| | |
|---|---|
| Pages | **217** across 19 chapters |
| `{/* FOOTER */}` markers | **0** |
| `:::` admonitions | **0** |
| Links | **381 / 381** resolving |
| MDX hazards | **0** |
| Over the 300-line cap | 1 — the inherited `04-data-fetching/01-explanation.md` at 431 |
| Pin | `16.3.4`, current, with the not-a-patch comment |

### 🔴 CI is RED, and it is NOT this track

Run `33713169702` failed on **MDX compilation in `docs/java/`** —
`phase-12-jvm-production/09-distributed-tracing/06-sampling.md` and `06b-the-trace-you-
needed-was-not-sampled.md`. That is the Java lane. The standing rule is to wait out a
failure you did not cause. **Next.js is clean**; the last green deploy carrying most of this
work was `33711374124`.

### Still open on this track, small and named

- The inherited **431-line** `04-data-fetching/01-explanation.md` needs a deliberate split.
- The 140 originally-imported pages still carry **no `> Verified:` lines** and their
  `[D]`/`[O]`/`[R]` badges are not re-tiered. The ~77 new pages do.
- **Chapter 12 is stylistically split** — its original pages 01–06 use the old imported shape
  (`## 1. Under-The-Hood Mechanics`, priority badges, no tier badge) while its 17 new pages
  use current house style. Same is true of other chapters' imported pages.
- `sidebar_position` 7–9 are empty in chapter 12: new pages were dispatched to start at 10.
  Unique and collision-free, but not gap-free.
- Two PWA chunks were planned and not written when the wind-up arrived: an offline-first
  **write queue / background sync** chunk, and a **PWA testing and audit checklist** chunk.
  Nothing links to either, so nothing dangles.
- `webpush 3.6.7` is pinned but the pin is **unproven end-to-end** — `node scripts/currency.mjs
  --check` was not re-run after adding it.

### 🔴 For the next session: start from the skills, not from a brief

This session wrote hand-made fork briefs from `AUTHOR-BRIEF.md` and never found
`.agents/references/`. The project's own skills carry the real contract and would have
prevented three separate rework passes:

- **`devbible-topic`** — depth bar, house style, the evidence ladder, the library-pin rule.
  The one fork run under it produced real footers, `★` markers and 2 quotes; the runs under my
  brief produced 394 blockquotes and 48 footer markers that all had to be fixed afterwards.
- **`devbible-currency`** — version drift. It caught that 16.3.1 → 16.3.4 is **not** a patch
  bump because it spans the security release that disabled AVIF.

## ✅ DONE 2026-09-03 — the de-quoting rewrite

**User instruction:** *"rewrite the quoted passages in our own voice and tighten the brief"*,
then *"Rewrite all"* — with the question *"how about content accuracy?"*, which is the right
question and drove the guard below.

### The problem

A two-fork run produced **11,654 quoted words in 348 blockquotes across 33 files — 16% of all
prose.** The quotes are **load-bearing, not decorative**: the shape is a one-line setup, a
quote carrying the actual facts, and a one-line insight. Delete the quotes and the pages lose
their substance. So this is **re-authoring, not editing** — comparable in size to the original
pass, though cheaper because the research is done and correct.

Worst files by quoted words: ch16 `17-choosing-a-deployment-target` (721) · ch10
`13-authentication-with-cache-components-sharing` (691) · ch04 `13-bff-security` (563) · ch16
`15-testing-adapters` (558) · ch10 `10-content-security-policy` (537).

### 🔴 The accuracy guard — the whole risk is paraphrase drift

**Pre-rewrite baseline commit: `fa32d94c`.** The guard is reproducible from git, so it does
not depend on any temp file surviving. Extract identifiers, numbers, version strings and cited
URLs from each file at that commit and from the rewritten file, then diff. **Anything that
disappears is a drift flag needing review.** The baseline held **752 distinct code
identifiers, 586 numeric facts and 172 cited URLs** across 34 files.

**Rules given to the rewriting agents:**

1. **Preserve verbatim** every number, threshold, flag name, config key, API name, file name,
   error string, version number and status word (experimental / deprecated / stable).
2. **Keep every citation.** The Verified line and inline doc links stay.
3. **Never introduce a claim the quote did not make.** Paraphrase, do not extrapolate.
4. **If the meaning is genuinely unclear, keep a short quote** — rule 9 allows one per page
   under 25 words where the exact wording is the point. Guessing is worse than quoting.
5. **Do not shorten.** The explanation the quote carried has to survive in our prose, so a
   rewritten page is usually the same length or longer — never shorter.

⚠️ **Rule 5 matters most.** The obvious failure mode is a fork "rewriting" by compressing a
70-word quote into a 15-word summary, which silently deletes content and passes every check
except a reader noticing the page no longer explains anything.

### Also done

**`AUTHOR-BRIEF.md` rule 9 added** — explain, do not quote. One quote per page, under 25
words, only where exact wording is the point, plus a blockquote count in the pre-report
checklist so a fork catches this itself. This is why the rewrite should not recur.


### ✅ Result — complete, all three lanes

**394 blockquotes / 12,926 quoted words → 8 quotes**, one per page, every one under 25 words
and kept because the exact wording is normative or a stability statement. **Zero facts lost**,
verified by diffing identifiers, numbers and cited URLs against baseline `45cf515c` **myself**,
not by trusting the forks' own reports. Two apparent losses were false positives in my regex
(`unsafe-eval` still present with its reasoning; the "third-party libraries still say
middleware" note survived and was expanded).

**Every file grew.** That was the point of rule 5 — the failure mode was compression, and it
did not happen. Chapter 2 went 236→262, 214→230, 223→240, 244→258 and so on.

🔴 **Two editorial catches the forks raised rather than letting pass, both correct:**

1. A fork had converted **direct quotations from two named individuals** into reported speech
   under their names. Paraphrasing a real person's words leaves a reader unable to tell what
   they actually said. Removed — the content was vendor sentiment, and every fact in it was
   already in the surrounding paragraphs.
2. A fork flagged writing *"the advisory frames the impact carefully"* — its characterisation,
   not the advisory's. Changed to "states the impact plainly".

**A fork that reports its own doubts is worth more than one that reports success.** Both of
these would have shipped silently otherwise.

### 🔴 My process error, recorded because it will recur otherwise

Commit `c4a93105` says "ch4 and ch10 (15 files)" and contains **28** — it swept in all 13 of
another fork's files **while that fork was still writing them**, capturing a partial state
under a message that did not describe it. Cause: I staged with `git add docs/nextjs`.

**`git add <directory>` is the same class of error as `git add -A` when another agent is
writing inside that directory.** "Stage explicit paths" has to mean *paths no live writer is
inside*. Corrected in the following commit rather than by rewriting pushed history.

## ✅ DONE 2026-09-03 — steps 3 and 4, THREE AGENTS

✅ **Steps 1 and 2 are DONE and pushed** (see the block below). The user then authorised
steps 3 and 4 at **devbible depth**, with a three-agent ceiling: *"devbible depth, both steps
3 and 4, go ahead."*

🔴 **Lanes are disjoint by CHAPTER DIRECTORY — no shared files. Only the coordinator commits.**
Forks were pointed at `AUTHOR-BRIEF.md` rather than having rules inlined. New pages start at
**`sidebar_position: 10`** in every chapter (existing pages occupy 0–8), so lanes cannot
collide on ordering.

| Lane | Owns | Writing |
|---|---|---|
| **Coordinator** (`211cedce`) | `05-caching…/`, `07-error-handling…/` | the three cache directives (`use cache` / `: private` / `: remote`) — **the largest single gap** · `catchError` + `retry()` — ch7's new centrepiece · `forbidden()`/`unauthorized()` + `authInterrupts` · `experimental.useOffline` |
| **Fork A** | `02-routing…/`, `13-testing…/` | Instant Navigations (all five parts) · root params · prefetch inlining + `useLinkStatus` · `instant()` Playwright helper · TypeScript 7 · linting after `next lint` |
| **Fork B** | `16-deployment…/`, `10-forms…/`, `04-data-fetching…/` | Adapters (13 upstream pages) + OpenNext · immutable static assets · CSP · Auth with Cache Components · the 2026 CVE record · Draft Mode · BFF · SWR/TanStack Query |

🔴 **NOT YET ASSIGNED — pick these up if capacity allows, they are real gaps:**
`11-performance…/` **glob imports (`import.meta.glob`)** and **native Node.js streams SSR**
(+22% requests under load) · `15-databases…/` **Multi-tenant** (which is what SprintDesk *is*,
unnamed for 18 chapters) · `12-seo…/` **PWAs** · `08-state…/` **`refresh()`**.

⚠️ `04-data-fetching…/01-explanation.md` is **431 lines**, already over the cap, inherited
from the import. Fork B was told to leave it alone. It still needs a deliberate split.

---

## ✅ DONE 2026-09-03 — steps 1 and 2 of the version refresh

**The import is closed and deployed** (run 33705429127 green, 146 live URLs). *"Apply steps 1
and 2"* **superseded the earlier "copy, do not rewrite"** for these corrections only.

**Step 1 · 13 pages gained an inline correction callout** stating what upstream actually says,
rather than silently rewriting the prose — so a reader who knows the old text sees what
changed, and the AVIF page opens with a `:::danger` before anyone reaches the recommendation.
**Step 2 · chapter 18's five byte-identical appendix pages deleted** (0 inbound links
verified first). **140 → 135 pages.** QC: 0 MDX hazards, 18/18 links, 0 position collisions.
Committed and pushed. Files corrected:

| # | Fix | File(s) |
|---|---|---|
| 1 | **AVIF — the dangerous one.** §9 teaches it; upstream disabled it for an unauthenticated RCE (GHSA-2xp9-vwfh-vxw4) | `09-styling-and-ui/04-next-image-…-avif-w.md` |
| 2 | Version callout 16.2→**16.3.4**, + Active/Maintenance LTS, Node **20.9** | `01-…/04-versioning-…md` and `…-2.md` |
| 3 | Appendix E: watchlist → shipped/withdrawn record | `18-…/09-appendix-e-…md`, `19-…/05-appendix-e-…md` |
| 4 | §14 Skills **reversed** — Vercel retiring them | `14-…/04-163-preview-first-party-skills-…md` |
| 5 | **CVE-2026-75604** (Windows-host RCE, no workaround) absent | `10-…/05-rsc-serialization-hardening-…md` |
| 6 | React Compiler: `reactCompiler` stable vs **Rust port experimental** | `01-…/07-key-framework-shifts-…md`, `11-…/01-turbopack-…md`, `11-…/02-react-compiler-…md` |
| 7 | `next lint` **removed in 16**; Biome; `AGENTS.md` scaffolded | `01-…/05-project-setup-…md`, `13-…/04-monorepos-…md` |
| 8 | **`preferredRegion` deprecated** | `11-…/04-nodejs-runtime-vs-edge-…md`, `16-…/03-multi-region-…md` |

**Step 2 · De-duplicate the appendices.** Chapter 18 holds Appendices A–E at `05`–`09`;
chapter 19 holds the same five at `01`–`05`. **Delete 18's `05`–`09`**, keeping 18's own
`01-explanation`, `01-sprintdesk-retrospective`, `02-case-study-2`,
`03-architecture-decision-trees`, `04-outlook`. 🔴 **Check inbound links before deleting** —
`onBrokenLinks` is `'warn'`, so a dangling link would ship silently as a live dead link.

⛔ **Steps 3 and 4 (absorb the ten shipped 16.3 features; extend to the ~15 uncovered
concepts) are NOT authorised** — they change the syllabus shape and need their own go-ahead.

## What the user asked

1. *"I would like to refresh next js course and fetch the latest next js syllabus verify the
   existing"* → the verification pass.
2. *"Rather rewriting next js i want you to copy next js from
   /mnt/Storage/Backup/Code/frontend here to in this dev bible please write it and record
   this session progress"* → **copy, do not rewrite.** This is the operative instruction and
   it is why the 140 pages are untouched despite being known-stale.

## Where Next.js lives now

`docs/nextjs/` in devbible — it did **not** exist before 2026-09-03. The 2026-08-14 bucket-A
frontend import deliberately excluded `nextjs` (see [[progress-frontend-import-bucket-a]]);
**this instruction overrides that exclusion.**

```
docs/nextjs/
  _category_.json        position 7.25 — deliberately between React (7) and Angular (7.5)
  README.md              track overview + the staleness warning
  syllabus/              5 part files, 01–05, 318 lines total, 0 over cap
  pages/                 19 chapter dirs, 140 .md files, 9,434 lines — VERBATIM
```

**Source:** `/mnt/Storage/Backup/Code/frontend/docs/nextjs/` (still there, unchanged).

## Boards wired (all four)

| Board | Change |
|---|---|
| `sidebars.js` | `nextjsSidebar` autogenerated, inserted after `reactSidebar` |
| `src/data/progress.js` | `nextjs` entry, 19 chapters, 140 topics = 140 pages |
| `docs/README.md` | claim row in the active-work table + inventory row after React |
| `docs/nextjs/README.md` | the track overview itself |

🔴 **`part: 'Imported corpus'` on every phase row is load-bearing, not cosmetic.**
`recentlyUpdated()` in `progress.js` filters those out on purpose — a wholly imported corpus
carries the stamp of the day it was moved, not of anyone writing it, and without the filter
Next.js would sit at the top of the homepage's freshness row claiming 100%. Storybook
survives that filter only because some of its phases were authored here.

## What was edited during the import — the complete list

The instruction was *copy*, so every edit is listed. **The 140 pages' prose is untouched.**

1. **One `sidebar_position` collision.** Chapter 1 shipped two *differing* files both at
   `sidebar_position: 4` — `04-versioning-and-lts-model-…md` (65 lines) and `…-2.md` (32).
   The shorter moved to `4.5`. Verified afterwards: **0 collisions in any chapter.**
2. **18 broken relative links repointed.** ⚠️ **Not because the build would fail** — this
   repo sets `onBrokenLinks: 'warn'`, so they would only have become warnings in the job
   summary and **live dead links on the deployed site**. That is the reason they were fixed.
   - **13 were already broken in the source** — they point at an older chapter scheme
     (`../04-data-fetching/`, `../06-caching-architecture/`, `../03-rendering-strategies/`,
     `../11-legacy-pages-router/`, `../08-middleware/`, `../01-routing-fundamentals/`) whose
     directories do not exist in the frontend repo either. Repointed to the real devbible
     chapters.
   - **5 were valid in the source and broke on the move**: `web-vitals-performance` links
     needed `../../` → `../../../…/pages/…`, because devbible nests imported corpora under
     `pages/` and the frontend repo does not.
   - Re-verified: **18 relative links, 0 broken.**

## Verification: the corpus is version-stale

Fetched 2026-09-03, all official: `/blog` · `/blog/next-16-3` · `/docs` ·
`/docs/app/getting-started/installation` · `/blog/august-2026-security-release` ·
`/docs/app/api-reference/directives/use-cache-private`.

**The structure holds; the version layer does not.** The 19-section spine matches how
upstream organises the material — chapters 7, 8 and 14 in particular anticipated where the
framework went. What decayed:

| | Corpus | Upstream 2026-09-03 |
|---|---|---|
| Stable | 16.2.x, "16.3 in preview" | **16.3.4** — 16.3 GA **2026-08-03** |
| LTS model | stable/canary/preview | **16.3 Active LTS · 15.5 Maintenance LTS** |
| Node floor | 20+ | **20.9** |
| React | 19.2+ | App Router **bundles React canary** |
| React Compiler | "stable … Rust" | `reactCompiler` stable; **Rust port experimental** |

### The three findings that change what a page tells you to do

1. 🔴 **Chapter 9 teaches AVIF, which upstream has DISABLED.** The August 2026 security
   release turned AVIF optimization off to mitigate **GHSA-2xp9-vwfh-vxw4** —
   unauthenticated **RCE** via `libheif` (under `sharp`) on an attacker-controlled AVIF
   image. Patched in 16.3.3 / 15.5.24. This is the one place the corpus actively recommends
   something dangerous.
2. 🔴 **Chapter 14's Skills bullet reversed.** It lists first-party Skills as a coming
   attraction; Vercel is **retiring** them, because `next dev` now maintains a
   version-matched `AGENTS.md` pointing at docs bundled in `node_modules/next/dist/docs/`.
3. 🔴 **Every `[16.3 Preview]` tag is stale, and Appendix E's premise has resolved** — it is
   a watchlist of features that all shipped on 2026-08-03.

Second critical CVE the corpus predates: **CVE-2026-75604** — unauthenticated RCE on
**Windows-hosted** servers running Pages Router *and* App Router without Cache Components.
Linux/macOS unaffected, **no workaround**. It turns chapter 17's Pages→App migration from a
modernization argument into a security one.

### ~25 documented concepts with no bullet anywhere

`catchError` + `retry()` (re-runs failed **Server Components** — chapter 7's new
centrepiece) · root params (`next/root-params`) · `use cache: private` / `use cache: remote`
· `forbidden()` / `unauthorized()` + `authInterrupts` · `experimental.useOffline` · glob
imports · `prefetchInlining` · immutable static assets · **TypeScript 7** · `instant()`
Playwright helper · `useLinkStatus` · `refresh()` · Draft Mode · CSP · Multi-tenant · PWAs ·
OpenNext · the 13-page Adapters section. Also: **`next lint` removed in 16**, **Biome** now
a `create-next-app` option, **`preferredRegion` deprecated**.

**How the staleness is surfaced without rewriting:** drift is flagged inline in
`docs/nextjs/syllabus/` (⚠️ = wrong, ➕ = missing, 🔴 = security/reversal) and summarised at
the top of `docs/nextjs/README.md`. The 140 imported pages carry no such marks.

## Defects carried over, recorded not fixed

- **Chapters 18 and 19 duplicate the appendices** — A–E appear in full in both, in the
  syllabus and on disk. Fix by deleting them from 18.
- **Every chapter has two files prefixed `01-`** (`01-explanation.md` +
  `01-<first-topic>.md`). Cosmetic only — `sidebar_position` values do not collide.
- **Depth is well below devbible's norm**: 9,434 / 140 = **~67 lines per page**, one file
  over 300. devbible runs 250–300 per chunk with exhaustive gotchas and interview questions.
  Reaching that bar is a **5–8× expansion**, not a patch.
- **No `> Verified:` lines** on the 140 pages; `[D]`/`[O]`/`[R]` badges not re-tiered to
  devbible's four tiers. Same conversion blockers the bucket-A import hit.

## QC

- 140 pages, 9,434 lines · syllabus 5 files, 318 lines, **0 over the 300-line cap**
- **0 MDX hazards** (fences/inline-code/frontmatter stripped, then scanned for bare JSX tags
  and brace expressions)
- **18 relative links, 0 broken**; no absolute `/docs/` links out of the track
- **0 `sidebar_position` collisions** across all 19 chapters
- `progress.js` parses; reports Next.js 19 chapters / 140 pages
- 🔴 **Verified in CI, not locally** — two local `yarn build` attempts were abandoned; see
  [[devbible-feedback-verify-in-ci-not-locally]]. Run
  **[33705429127](https://github.com/sairamg8/devbible/actions/runs/33705429127)**:
  **build success, deploy success.**
- **176 unresolved links site-wide — 156 Java, 18 Python, 0 Next.js.** All pre-existing and
  in other sessions' lanes; left alone deliberately. (`onBrokenLinks` is `'warn'`, so these
  do not fail the build — they are live dead links, and the count is worth someone's lane.)
- **Live and confirmed by sitemap: 146 Next.js URLs** = 140 pages + README + 5 syllabus
  files. 🔴 **Docusaurus strips a PURELY NUMERIC `NN-` prefix in routes — and ONLY a purely numeric one.**
  ⚠️ **Corrected 2026-09-03 against the live sitemap:** a lettered sibling keeps its prefix, so
  `10u-the-lighthouse-pwa-category-is-gone.md` serves at `.../10u-the-lighthouse-pwa-category-is-gone`,
  **not** `.../the-lighthouse-pwa-category-is-gone` (that returns 404 — measured). Same for `10r-`,
  `10t2-`, `10z2-`, `01b-`, `03c-`. The earlier wording here said "strips the `NN-` prefixes" full
  stop, which is what produced the wrong guess. For a plain numeric prefix the live path is
  `/devbible/docs/nextjs/pages/introduction-to-next-js/explanation`, **not**
  `.../01-introduction-to-next-js/01-explanation` — guessing the numbered form returns 404
  and looks like a failed deploy.

Related: [[progress-frontend-import-bucket-a]] · [[devbible-locks]]
