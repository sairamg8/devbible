---
name: reference-nextjs-quote-sweep
description: The 2026-09-05 quote sweep of the devbible Next.js track — 77.5% proven mechanically, then 52 suspects READ BY HAND giving the real defect rate (17%, not 100%). Carries the adjudicated verdict ratio, the systematic false-positive classes, and the self-quotation class. Read before any validation or sweep work.
metadata:
  type: reference
---

# The quote sweep — proving `> *"…"*` against the real source

**Run 2026-09-05, session `d2e9b9fe`, on the user's instruction *"start with the quote sweep"*.**
Tool: `shared/scripts/quotesweep.py`. Worklist: `reference_nextjs_quote_suspects.json`.

## Why this exists

Five validation reviews scored **0–70%** against a 90% bar, and one defect class dominated:
**text formatted as a verbatim quote that the source does not contain.** Confirmed instances
before the sweep even ran:

- *"keeps lint rules about extraneous dependencies quiet"* — quoted **twice** in ch03 `05`. The
  sentence does not exist.
- A table column headed **"The error says"** over **three reconstructed error strings**.
- **Three** fabricated quotes on one ch05 page (`04-revalidation-time-based-isr`), all reworded to
  the real doc text by lane C.
- An invented figure — **"5.5× faster CI builds"** — presented inside quotation marks.

🔴 **`> *"…"*` makes a paraphrase look sourced.** It passes the tier-badge, `> Verified:`, link,
cap, MDX, footer and control-byte checks. **Nothing in the corpus detected it before this tool.**

## The result

| | Quotes | Share |
|---|---:|---:|
| **MATCHED** — found verbatim in a mirrored source | **2,541** | **77.5%** |
| UNVERIFIABLE — file cites a host not mirrored | 429 | 13.1% |
| MED confidence suspect | 212 | 6.5% |
| 🔴 **HIGH confidence suspect** | **98** | **3.0%** |

**3,280 quotes across the track.** Reference corpus: **10.5 M chars, 546 pages** — *all* 316
Next.js doc pages plus every cited page on react.dev, postgresql.org, MDN, rfc-editor.org,
vercel.com, prisma.io, neon.com, drizzle, vitest, playwright, nodejs.org, typescriptlang.org,
tailwindcss.com and authjs.dev.

## 🔴 What the tool can and cannot prove

**It can prove a quote RIGHT. It cannot prove one WRONG.** A miss means *"not in the sources I
mirrored"*, which has three innocent causes: the site was mirrored only at its cited pages and the
quote comes from another page; the source is a host nobody mirrored; or the quote is a legitimate
partial with elision the splitter mishandled. **Every SUSPECT needs a human read.**

**HIGH confidence = the file cites ONLY `nextjs.org`, and all 316 Next.js doc pages were
mirrored.** For those 98 there is no innocent "uncited page" explanation left, so they are the
worklist. **98 quotes across 60 files** — a day's work, not a programme.

Top files: `02/06-163-preview-instant-navigations` (8) · `02/07b-adopting-proxy` (5) ·
`02/01f-not-found-and-the-notfound-function` (4) · `02/02b-parallel-routes-and-named-slots` (3) ·
`06/03-isr-at-enterprise-level` (3) · `11/01-turbopack-in-dev-and-production` (3) ·
`15/05b-the-edge-runtime-is-deprecated` (3) · `19/02c-the-cart-checkout` (3).
⚠️ **ch02 dominates the list** — 25 of the top 98. Start there.

## How to reproduce

```bash
# 1 · mirror EVERY doc page of the primary source, not just cited ones —
#     that single change is what turned a weak signal into a strong one.
curl -s https://nextjs.org/docs/llms.txt | grep -oE 'https://nextjs\.org/docs/[^)\s]+' | sort -u
#     then fetch each with `.md` appended; nextjs.org serves raw markdown.
# 2 · sweep
QS_HOSTS=nextjs.org QS_MIRROR=qs-mirror python3 shared/scripts/quotesweep.py --sweep docs/nextjs/pages
```

🔴 **NEVER build the mirror with `WebFetch`.** Its summariser **paraphrases** — it rendered RFC
9110's *"its current functionality"* as *"its current representation"*. Using it here would
manufacture the exact defect the tool hunts. `curl` raw markdown, always.

## Normalisation, and the bug worth knowing about

Both sides are normalised: NFKC, smart quotes and dashes folded, `[label](url)` → `label`,
then `` ` ``, `*`, `_`, `[`, `]` stripped, whitespace collapsed, lowercased. Ellipsis (`…` or
`...`) splits a quote into parts, each required to appear.

⚠️ **The first run left `[` and `]` in place and produced ~20 false positives** — a quote written
`` [`not-found.js`] `` could not match a source that renders the same link as
`` [`not-found.js`](/docs/…) ``. Stripping brackets moved the match rate 76.1% → **77.5%** and cut
HIGH from 119 to 98. **If you extend this tool, re-check the false-positive rate on a sample
before trusting a number.**

## Where this connects

- [[project-nextjs-validation-sample]] — the decision rule and the prior evidence
- [[progress-nextjs-session-d2e9b9fe]] — the session
- [[cursor-nextjs]] — the position


---

# 🔴 ADJUDICATED — the 52 priority suspects were read by hand

Three lanes read the 52 lowest-scoring quotes. **This is the number that settles the sweep.**

| Verdict | n | Share |
|---|---:|---:|
| **A · tool false positive** — text is real, matcher mis-aligned | **43** | **82.7%** |
| **B · misquoted** — real sentence, altered wording | 3 | 5.8% |
| **C · author's own prose in quote marks** | 6 | 11.5% |
| **D · wrong source** | 0 | 0% |

**Only 9 of 52 (17.3%) were real defects.** Per lane: ch02 **21/21 clean** · ch11+13+15 12A/3B ·
ch06+08+09+10+19 10A/6C.

🔴 **So the corpus's QUOTE accuracy is far better than the chapter S1/S2 review scores implied.**
Those scores fail a whole page for one defect; this measures the quotes themselves. Extrapolating
17% onto the worst-scoring band — and the better bands carry fewer — puts genuine quote defects at
roughly **1–4% of 3,280**, i.e. **quote accuracy ~96–99%**. ⚠️ **Do not quote the 77.5% as a defect
rate.** It is a *mechanical match* rate, and 82.7% of what it flagged was fine.

## 🔴 The systematic false-positive classes — do not re-flag these

Every one of the 43 was structural, not textual:

1. **A source bullet list flattened into one quoted line** — the largest class. `* a / * b / * c`
   quoted as `• a • b • c` never matches running prose.
2. **A `###`/`####` heading merged into its own paragraph** — `error.digest` and `params (optional)`
   scored **0/21** and **0/23**, the two worst in the whole list, and both are exactly right.
3. **A multi-line code comment unwrapped** into one line.
4. **Curly quotes rendered as ASCII singles** — the source's `“middleware”` written `'middleware'`.
5. 🔴 **Backslash-escaped `\"` in the first words scores 0** — the two *"Edge Stitching"* quotes
   flagged as probable inventions are verbatim in `deploying-to-platforms`, **bold included**.
6. **A mirror gap.** `blog/next-16-3-instant-navigations` is a **separate post** from
   `blog/next-16-3`; 7 of ch02's 21 came from it. **Crawl blog posts, not only `/docs/`.**

## 🔴 THE SELF-QUOTATION CLASS — found by lane G, then swept

Three ch19 "inventions" turned out to be **verbatim from devbible's own pages** (`ch5/10/04`,
`ch15/04ea`) wearing the styling reserved for primary-source documentation. A reader following the
citation lands on the book's own argument presented as external authority.

**Sweep for it:** a `> *"…"*` block whose only attribution is an internal `../chNN/….md` link.
**41 such quotes across 35 files** (ch19 `01d` 3 · ch19 `04b` 3 · ch05 `01` 2 · ch19 `01ba` 2 …).
⚠️ **The mechanical sweep scores every one of these as a miss**, because the mirror holds only
external sources — so they inflate the suspect list *and* are a real styling defect.

## The other two sweeps run under "option B"

**Attribution sweep** — does a quote match *its own cited page* rather than the corpus at large?
Only **399** quotes carry a resolvable inline `nextjs.org` attribution; of those **350 (87.7%)
match their cited page** and **49 do not**, across 32 files. 🔴 That gap is real and unaddressed:
the 77.5% headline proves a sentence exists somewhere, **not** that the page cites it correctly.

**Stale-mechanism sweep** — Next-14-era facts taught as current. 115 candidate lines across
8 patterns, **but sampling showed the corpus is in good shape**: pages actively teach the
inversions (*"Next 15 made `fetch` uncached by default"*, *"Route Handlers have not been cached by
default since Next 15"*). `request.ip`/`request.geo`: **0 hits**. Not a live defect class.


---

# 🔴 FINAL RATIO — 86 suspects read by hand across six lanes

| Verdict | n | Share |
|---|---:|---:|
| **A · tool false positive** | **75** | **87.2%** |
| B · misquoted | 4 | 4.7% |
| C · author's prose in quote marks | 6 | 7.0% |
| D · wrong citation | 1 | 1.2% |
| E · missing citation (real doc text, only an internal link) | 3 | 3.5% |

**14 real defects in 86.** Per lane: ch02 **21/21 clean** · ch11+13+15 12A/3B · ch06+08+09+10+19
10A/6C · ch02+08+09 14A/1B/1D · **ch03+ch10 18/18 exact** · ch19 3E.

🔴 **The false-positive rate was 82–100% in EVERY lane, in every chapter, both for existence and
for attribution.** That stability is the finding: **the corpus's quotes are sound and the tool is
noisy**, not the other way round. Genuine quote defects are on the order of **1–3% of 3,280**.

## The three defect classes actually worth hunting, ranked

1. **C · author's own prose in quote marks** (6) — the worst, because a reader who checks finds
   nothing. Two flavours: pure invention (ch06 `03`'s three worked business scenarios) and
   **self-quotation** (ch19 `02c` quoting devbible's own `ch5/10/04` and `ch15/04ea`).
2. **B · misquoted** (4) — a bracketed substitution welding two paragraphs; an author-written
   lead-in inside the quote; a truncation that changed what a roadmap sentence commits to;
   `BaseButton` where the source writes `<BaseButton>`.
3. **D/E · citation defects** (4) — right text, wrong or missing page. ⚠️ **Only the attribution
   sweep finds these**; the corpus-wide matcher scores them as MATCHED.

## ⚠️ Two house-convention questions, raised twice, still undecided

- **Bold added inside quotes that the source does not have.** Words verbatim, emphasis authorial —
  technically an unmarked alteration inside quotation marks, but it is a corpus-wide convention.
- **Signatures elided inside quotes** — `router.replace(href, ...)` with the full form in the code
  block above. Signposted, not deceptive.

🔴 **Both were deliberately NOT mass-changed.** They need a policy decision, not a lane. Recommended
resolution: **write the convention into `.agents/references/house-style.md` and leave the quotes
alone** — touching hundreds of quotes for cosmetic consistency is a poor trade.

## Tool refinements the lanes earned — apply before the next run

- **Strip `\`** as well as `` ` `` `*` `_` `[` `]` — backslash-escaped `\"` in the opening words scores 0.
- **Trailing `:` → `.`** is systemic: the corpus ends a quote with a period where the source line
  ends with a colon. Normalise terminal punctuation.
- **Crawl blog posts, not only `/docs/`** — and note `blog/next-16-3-instant-navigations` is a
  **separate post** from `blog/next-16-3`.
- **A quote whose only attribution is internal** will always miss; classify it rather than flag it.
