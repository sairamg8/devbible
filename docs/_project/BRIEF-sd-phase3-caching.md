---
name: brief-sd-phase3-caching
description: The dispatch brief handed to every devbible-author agent writing docs/system-design/pages/phase-3-caching/ — file shape, the 300-line SPLIT rule verbatim, the decimal sidebar_position convention and its .95 escape, the research bank, the evidence rules and the boundaries. Written to the STORE rather than a session scratchpad because the DSA phase-2 brief was deleted from the scratchpad mid-run on 2026-09-08.
metadata:
  type: project
---

# Dispatch brief — System Design phase 3, "Caching everywhere"

Repo root: `/mnt/Storage/Backup/Knowledge/devbible` (call it `$DB`).
Your directory: `$DB/docs/system-design/pages/phase-3-caching/`. You write **content pages only**.

## Read first, in this order
1. `/mnt/Storage/my-learning/claude/devbible/research_system-design_phase3.md` — the research bank.
   🔴 **Already fetched. Do NOT re-fetch those URLs.** Every protocol or product claim you make must
   be quoted verbatim from that bank, or written as mechanism with no number attached. If you need a
   fact the bank does not carry, you MAY WebFetch **one** primary source (an RFC, MDN, or a vendor's
   own documentation) — never a blog, never Medium, never StackOverflow — and quote it.
2. `$DB/docs/system-design/pages/phase-3-caching/README.md` — the 16 topic rows, their exact titles
   and tiers. Your topic's tier badge is the one in that table; do not re-tier it.
3. `$DB/docs/system-design/pages/phase-2-request-path/05-cdns.md` — **the page shape to copy.** Also
   skim `03-reverse-proxies-and-api-gateways.md` in that directory: phase 2 owns the *hops*, so your
   pages own what those hops store and for how long, and link back rather than re-teaching.
4. `$DB/.agents/references/house-style.md` and `$DB/.agents/references/authoring-contract.md`.

## File shape — copy it exactly

```
---
title: "A full declarative sentence stating the page's claim — long is normal here, 1-3 clauses, no colon-label style"
sidebar_label: "NN · Short label"
sidebar_position: <given in your assignment>
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Which claims are quoted and from which RFC or vendor doc, which are
> common practice stated as mechanism, and the literal words **No sandbox run.**

**Bold thesis sentence.** Then one or two paragraphs of framing: what the topic is, what breaks
without it, what the interviewer is really probing.

## <as many H2 sections as the subject has>

## Gotchas

**★ Symptom: <what the reader sees>.** Cause: <the mechanism, precisely>. Fix: <shown concretely>.

## Interview questions

**★ <The question>?**
The answer in prose, as long as it needs to be.

{/* FOOTER */}
```

- 🔴 **The last line of every file is exactly `{/* FOOTER */}`** — nothing after it. The coordinator
  writes the real prev/next footer chain in one pass; a file that writes its own footer breaks it.
- Tier badge string verbatim: `<span className="db-tier t-master">Master</span>` ·
  `<span className="db-tier t-understand">Understand</span>` ·
  `<span className="db-tier t-know">Know</span>`
- `★` marks the load-bearing entries, not every entry. It is also the split-proof counter.
- **Gotchas and Interview questions are MANDATORY on every page**, exhausted rather than sampled:
  every gotcha the topic genuinely has, every question it genuinely gets. Phase 2's pages run 5–10
  `★` per file.

## 🔴 Rule 7 — the cap
**300 lines is a FILE-SIZE cap, never a content budget. Write the whole subject first.**
If the file then exceeds 300 lines, **SPLIT it into a second file at a concept boundary** and report
the new filename. **Do NOT shrink, compact, reflow, de-duplicate or drop anything to fit.** Splitting
is the expected outcome — a "one page" brief here reliably produces 3–7 files. Each split file gets
its own complete frontmatter, tier badge, `> Verified:` line, its own `## Gotchas` and
`## Interview questions`, and its own `{/* FOOTER */}` last line. Distribute the existing gotchas and
questions to whichever half each belongs to; both files must be real content, never a trim.

⚠️ **Aim for roughly 250–285 lines per file, AND obey rule 7 when you overshoot.** Do not target
exactly 300: the coordinator appends a four-line footer at close, so a 300-line file breaks the cap
the moment the phase is wired. Three files had to be re-split for exactly this reason on 2026-09-08.

**Split naming:** parent `NN-<slug>.md` keeps `sidebar_position: NN`. Splits are `NNb-<slug>.md`,
`NNc-<slug>.md`, … with `sidebar_position: NN.1`, `NN.2`, …
🔴 **Past the ninth split, do NOT write `NN.10`** — Docusaurus reads the field as a *number*, and
`NN.10 == NN.1`, which silently collides with your own second chunk. Use `NN.95`, `NN.96`, `NN.97`
instead; they sort correctly after `NN.9`.
🔴 **Other agents are writing this same directory concurrently — never renumber a file you did not
create, and never use an integer position other than your own topic numbers.**

## Content rules
- Reader: senior/staff, backend in **Node.js and Java (Spring Boot)** — both first-class — frontend
  React/Next.js. Code examples should be Node/Express or Spring where a language is needed; Python
  is not this reader's target.
- **No sandwich answers.** Every page should answer "what does a senior get asked, and what breaks at
  scale" before "what is it".
- **No sandbox.** No hit-ratio figure, no latency number, no memory-per-key figure, no "caches
  typically…" statistic unless it is quoted verbatim from the bank. Where the bank forbids a number
  (Caffeine's hit-rate improvement, Redis's own simulation claim), say so on the page.
- The corpus's running example is the **PERN storefront** — catalogue listing, product detail,
  search, cart, checkout, orders, reviews, admin, and the flash-sale SKU. Reach for it whenever a
  topic needs a concrete case; the flash sale is the best stress test in the phase.
- **Do not re-teach Redis.** The [Redis track](../../../redis/README.md) owns the mechanics; you own
  the design decision and the trade-off. Link, don't restate.
- **Links:** relative, always ending in `.md`, numeric prefixes kept
  (`../phase-2-request-path/05-cdns.md`). The build runs `onBrokenLinks: 'throw'` — `ls` a target
  before linking it. 🔴 **Never link to a page in your own phase directory that you are not yourself
  writing.** Write such a reference as **bold text** plus `*(not written yet)*`.
- **MDX traps that abort the build:** no bare `<!-- -->` (use `{/* */}`); any bare `<Something` in
  prose must be backticked (`Cache-Control: max-age=<seconds>` → backtick it); `|` inside a table
  cell is `\|`; a bare `{` in prose must be backticked.

## Boundaries
- ⛔ Write **only** the files named in your assignment (plus your own splits), **only** inside
  `$DB/docs/system-design/pages/phase-3-caching/`.
- ⛔ Never edit `README.md`, `_category_.json`, another agent's file, anything under `src/`, or
  anything outside that directory.
- ⛔ Never run `git`, `yarn`, a build, a dev server, or any script under `scripts/`.

## What you return
For each file: exact filename, `wc -l`, `grep -c '^\*\*★'`, one line on what it covers, and anything
you could NOT verify and therefore left out or marked open.
