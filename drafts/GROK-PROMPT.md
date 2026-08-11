# Authoring prompt — devbible explanation pages

Paste **everything below the first `---` line** into the model, once per page, with the
two `<<...>>` placeholders filled in. Save the reply to
`drafts/phase-NN-slug/NN-topic.md`.

**Filling the placeholders.** Copy the `Topic:` row **verbatim** out of
`docs/nodejs/syllabus/` — tier included, never reconstructed from memory. Asked to
recall them, a model got a phase count wrong while getting a row word-perfect; both at
once is the dangerous shape. For `Context:`, one line naming what the pages either side
already own, so the draft cross-links instead of repeating. If you do not know yet,
write `first draft of this phase — flag any overlap you suspect` and let the review
catch it.

**Nothing in `drafts/` is part of the site.** A page reaches `docs/` only after review
and after every `<!-- VERIFY -->` marker has been measured.

## Operator workflow (not pasted into the model)

This block is for the person or agent running the pipeline — **not** for the per-page
author model. Match existing phases 7–8 under `docs/nodejs/pages/` for shape and tone.

### Per page

1. **Draft** — paste the body below the line once; save under
   `drafts/phase-NN-slug/NN-topic.md`.
2. **Review** — different model than the author; `docs/reviews/review-prompt.md`.
3. **Verify** — measure every `<!-- VERIFY -->` on Node 24 in `sandbox/`; replace markers
   with real figures. Only then insert the verified callout **immediately under the tier
   badge** (this is the one body blockquote pages are allowed):

   ```markdown
   <span className="db-tier t-master">Master</span>

   > Verified: 2026-08 on **Node 24.19.0** — optional package/server detail.

   **Thesis sentence…**
   ```

4. **Land in the site** — copy into `docs/nodejs/pages/phase-NN-slug/`. Keep
   frontmatter, tier badge, styling, and prev/next footer as written.
5. **Insert into the UI immediately** — edit `src/data/progress.js` for that phase:

   | Situation | What to set |
   |---|---|
   | First page of a phase | `pages: 1`, `pagesPlanned: <syllabus topic count or final page count>` |
   | Each further page | bump `pages` by 1 (keep `pagesPlanned`) |
   | Phase finished | `pages: <final>`, **remove** `pagesPlanned` |

   Example mid-flight: `{n: 8, slug: 'phase-8-security', …, topics: 27, pages: 8, pagesPlanned: 27}`.
   The homepage bar and docs `<Progress />` read only this file — nothing else is
   hand-maintained. **Do not wait for a green build** to bump the count.

### End of phase (this order, no shortcuts)

1. Finish every topic page **and** the phase `README.md`. README shape:

   ```markdown
   ---
   title: "Phase N — Name"
   sidebar_label: "Overview"
   sidebar_position: 0
   ---

   > **Target runtime: Node 24 — the Active LTS as of August 2026.**
   > Every example was executed on **Node 24.19.0** …

   **One-line what this phase is.**

   ## Section heading matching the syllabus grouping

   | # | Page | Tier | In one line |
   |---|---|---|---|
   | 01 | **[Title](./01-slug.md)** | <span className="db-tier t-master">Master</span> | Claim, not a description |
   ```

   Add `_category_.json` if the phase folder is new (copy a neighbour phase).
2. Update `docs/nodejs/pages/README.md` only if the phase moves from "still to write"
   into the written list (mirror how phases 0–7 appear).
3. Finalise `src/data/progress.js` (`pages` final, drop `pagesPlanned`).
4. Save progress to the memory store (`/mnt/Storage/my-learning/claude/devbible/`).
5. **`yarn build` once** from the repo root — not between pages. Package manager is
   **yarn**. Then:

   ```bash
   yarn build
   # require exit code 0
   # also grep the log: warning|broken|ERROR
   ```

   `onBrokenLinks` is not `throw` here — SUCCESS alone does not mean links are good.
6. **Fix every failure** (MDX parse, broken links, bad `className`/JSX, curly-brace
   traps) in one pass; rebuild until exit 0 and the grep is clean; then next phase.

If a build fails only because of stale cache after mass moves, clear
`.docusaurus`, `build`, and `node_modules/.cache`, then rebuild — but fix real content
errors first.

---

You are writing one page of **devbible**, a Node.js reference handbook for working
fullstack developers. Not a tutorial, not a blog post, not documentation. A reference
someone opens at 3 a.m. with a broken system.

**Topic:** `<<syllabus row verbatim, including its tier>>`
**Context:** `<<one line on what neighbouring pages cover, so you don't repeat them>>`

# 1. The five hard rules

Break any of these and the page is rejected regardless of how good the prose is.

**1.1 — Never invent a number, version, timing, error string, or console output.**
This is the most important rule in this document. The bible's entire value is that
every figure in it was executed on the target runtime. A plausible-looking invented
number is worse than no number, because nothing distinguishes it later.

Where a measurement would strengthen the page, write the prose so a figure can be
slotted in, and emit a marker:

```
<!-- VERIFY: scrypt cost at N=2^15 on Node 24, and md5 hashes/sec for contrast -->
```

Be specific in the marker about *what* to measure. "VERIFY: performance" is useless.

**1.2 — Never write a `> Verified:` line.** That line is a promise only a measured page
may make. It is added after verification, not by you.

**1.3 — Target Node 24 (Active LTS).** Never use an API Node 24 lacks. If unsure
whether an API, flag or default exists on 24, mark it `<!-- VERIFY -->` rather than
asserting. Facts *about* newer releases belong on the page, clearly labelled as not
being on the target.

**1.4 — Maximum 300 lines.** Hard cap. If the topic genuinely needs more, say so at the
top and stop — do not compress by deleting code or gotchas.

**1.5 — Do not repeat a neighbouring page.** Cross-link instead. Overlap is reported as
noise in review and costs the page its score.

# 2. Page structure

Exactly this skeleton, in this order.

```markdown
---
title: "Full sentence-case title"
sidebar_label: "NN · Short label"
sidebar_position: N
---

<span className="db-tier t-master">Master</span>

**One bold sentence stating the thing the reader must leave with.** Then two or three
sentences on why this topic exists and what specifically goes wrong without it.

## Concept sections — as many as the topic needs

## Gotchas

## Interview questions

---

← Prev: [Title](./NN-slug.md) · Next → [Title](./NN-slug.md)
```

Tier badge classes, exactly four — use the tier from the syllabus row, never re-decide
it. Label text is short: `Master`, `Understand`, `Know`, `When Needed`. Use
`className`, never `class` (pages are MDX).

```
<span className="db-tier t-master">Master</span>
<span className="db-tier t-understand">Understand</span>
<span className="db-tier t-know">Know</span>
<span className="db-tier t-when">When Needed</span>
```

On the phase's first page the footer is `Phase index: [Name](./README.md) · Next → …`;
on the last page it is `← Prev: … · Phase index: [Name](./README.md)`.

# 3. How to open a page

The opening bold sentence is the page's thesis. It should be arguable, specific, and
something a competent developer might currently have wrong.

Good:
- **The whole trade is revocation against a database lookup.**
- **A password hash must be slow on purpose.**
- **`Promise.all` over an array of unknown length is an outage waiting for a big enough array.**
- **Two different failures look identical from the queue's side: the job threw, and the worker vanished.**

Bad:
- **Logging is an important part of any production application.** (unarguable, says nothing)
- **In this page we will learn about caching.** (announces itself instead of asserting)

Then say what breaks without the concept. Concretely — a failure someone has had, not a
category of failure.

# 4. Markdown and site styling

The site's CSS (`src/css/custom.css`) styles markdown deliberately. **Wrong markdown
looks wrong in the UI even when the prose is fine.** Match existing pages under
`docs/nodejs/pages/` — especially phases 7–8.

## Blockquotes (`>`) — almost never in the body

Every `>` becomes an **accent callout** (pine left border + soft green background). That
treatment is reserved for:

| Allowed | Example |
|---|---|
| Verified line (post-measure only — not by you) | `> Verified: 2026-08 on **Node 24.19.0** …` |
| Phase README target banner | `> **Target runtime: Node 24 — the Active LTS…**` |
| Rare API stability notes | `> Added v20.6.0 · Stability: **2 – Stable**` |

**Do not** use blockquotes for tips, warnings, callouts, "note that…", good/bad
comparisons, or enumerating load-bearing lines. Those are plain paragraphs (or lists)
in every published page.

Wrong (renders as a green callout box):

```markdown
> Three things in there that are not decoration:
>
> **The salt is random and per-password.** It does not need to be secret …
```

Right (matches published pages):

```markdown
Five things in there that are not decoration:

**The salt is random and per-password**, 16 bytes from a CSPRNG. It does not need to be
secret — it needs to be *unique*. …

**The parameters are stored with the hash.** `scrypt$32768$8$1$…` means …
```

## Bold, italic, inline code

- **Bold** the claim or the load-bearing phrase — one or two per section, not random
  keywords. Opening thesis is a full bold sentence.
- *Italic* for light technical stress on a single word (*unique*, *host*, *setup*), not
  for whole sentences.
- `` `inline code` `` for APIs, flags, status codes, filenames, env vars.
- Nested backticks inside inline code break MDX. Prefer double-backtick spans
  (``` ``sql`…${x}` `` ```) over escaping a backtick with a backslash.
- Curly braces `{` `}` in prose can be parsed as JSX. Avoid raw `{foo}` outside code
  fences; put expressions in code spans or fences.

## Headings, lists, tables, rules

- `##` for major sections (serif + bottom rule in the UI). `###` sparingly for
  sub-structure. Do not use `#` in the body — the title comes from frontmatter.
- Numbered lists for ordered steps; bullets for unordered sets.
- **Tables** for comparisons (X vs Y, algorithm choice, level meanings). Bold cells only
  where the cell *is* the recommendation.
- One horizontal rule `---` immediately before the prev/next footer. No other decorative
  rules.

## Code fences

- Language tags that pages actually use: `js`, `console`, occasionally `bash` / `sql`.
- Runnable and complete. Realistic names — `orderId`, not `foo`.
- **No `...` elisions.** Anything not runnable is labelled `// pseudo-code`.
- Comments mark the load-bearing line: `// ← the crash window`.
- Show broken *and* fixed versions when the contrast is the lesson.
- Console output in a ` ```console ` block — **only real output**, otherwise a
  `<!-- VERIFY -->` marker. State the number in **prose** next to the block as well:
  `**p95 of 1246 ms against 19 ms.**`

## Do not invent chrome

- No Docusaurus admonitions (`:::note`, `:::warning`, …).
- No `<details>`, custom HTML, or extra `className` beyond the tier badge.
- No emoji. No exclamation marks.
- No images unless the syllabus row demands a diagram (it almost never does).

# 5. How to write the body

**Lead with the failure or the evidence, not the API.** The reader knows what a function
signature looks like. Show the problem, then the mechanism, then the fix.

**Put the measurement early.** If the page has a number, it belongs near the top as
evidence for the thesis — not buried in a "performance" section at the bottom.

**Explain why code lines exist.** After a non-trivial block, enumerate the parts that
are load-bearing as **plain paragraphs with bold leads** (see §4) — never as a
blockquote.

**Name the trade-off.** Every recommendation costs something; say what. A page that only
says what to do is half a page. Sections titled "When not to use this", "Where this
stops", or "What it cannot fix" are strongly encouraged and often the most valuable part.

**Use tables for comparisons**, prose for mechanisms. A table of "X vs Y" with a column
for the property that actually decides it beats three paragraphs.

**Be honest about weak evidence.** If a measurement is noisy or a claim is unproven, say
so in the page. "The prefix length is observable" is defensible; "each additional
matching character adds 0.3 ms" is not, unless it was measured cleanly.

**Cross-reference precisely** — `[Phase 6, page 04](../phase-6-data-access/04-postgresql-from-node.md)`
or `[page 12](./12-timeout-budgets.md)`. Always prefix relative links with `./` or `../`.

# 6. Gotchas

Five to eight, each exactly this shape, symptom first — because the symptom is what
someone types into a search box when they are stuck:

```markdown
**Symptom:** Duplicate emails, charges or webhooks after an incident
**Cause:** At-least-once redelivery of a non-idempotent handler.
**Fix:** Domain-derived key plus `on conflict do nothing`; check `rowCount` before
doing the rest.
```

- The symptom is what the developer **observes** — an error string, a wrong number, a
  behaviour — never the diagnosis restated.
- The cause is the **mechanism**, one line.
- The fix is a **change**, specific enough to act on.
- Prefer failures you are confident are real and common over exhaustive coverage. A
  missing "everyone gets bitten by this once" gotcha is a Major finding in review.

# 7. Interview questions

Three to eight, **with answers**. Mark frequently-asked ones with `★`.

- Prefer **"why"** and **"what happens if"** over **"what is"**.
- Answers are two to four sentences and must contain something the reader would not
  have guessed from the question — ideally a number from this page.
- The last two or three can drop the `★` and go deeper.

```markdown
**★ Why can't you use SHA-256 for passwords?**
Because it is fast, and speed is the attacker's advantage. Measured on one core:
~344,000 SHA-256 hashes per second against about 11 scrypt hashes at N=2¹⁵. A password
hash must be deliberately slow and, ideally, memory-hard so GPUs do not help.
```

# 8. Voice

- **Second person, present tense.** "You get", not "one gets" or "we will see".
- **Short paragraphs.** Two to four sentences.
- **No filler.** Cut: "it's important to note", "basically", "simply", "essentially",
  "in today's fast-paced world", "let's dive in", "as we all know".
- **No hedging on things that are true.** "This is wrong" beats "this may not be ideal".
- **Bold the claim**, not random keywords. One or two bolded phrases per section.
- **No emoji.** No exclamation marks.
- Contractions are fine. Sound like a senior engineer explaining to a peer, not like
  documentation and not like a conference talk.

The calibration, in one comparison (prose quality only — **do not** put good/bad
pairs in blockquotes on a real page):

**Good:** A cursor holds a checked-out connection for the whole pass, so a long export
on the request pool starves your HTTP handlers.

**Bad:** It's important to note that cursors can be very useful for handling large
datasets efficiently.

The first names a mechanism and a consequence. Every paragraph should.

# 9. How the page gets judged

Two passes. Failing the first means the second never happens.

**Pass 1 — quality.** The project's reviewer (`docs/reviews/review-prompt.md`) applies a
purpose test to every topic, twice:

- **Work-ready** — after reading only this page, could a fullstack developer use the
  concept at its tier **without opening the documentation**? That needs real fullstack
  context, the libraries it is used with, failure modes as symptom → cause → fix, when
  *not* to use it, and the trade-off.
- **Interview-ready** — could they survive a senior interviewer's follow-ups?

**A topic cannot score 4–5 unless both are yes.** A missing everyday gotcha caps it at 3.
A `Master` page the reader still needs the docs for is marked down. Scope is judged both
directions: missing-but-needed, and present-but-not-needed reported as noise with its
line count.

The reviewer must be a **different model than the author**. Self-review is worth nothing
here — this project has already had an external model claim it executed fourteen
snippets it had not, score nine of ten pages a flat 5, and propose a "fix" that would
have made the page worse. That review was discarded rather than merged.

**Pass 2 — verification.** Every `<!-- VERIFY -->` marker is measured on Node 24 in
`sandbox/`, and real figures replace the markers. Only then does the page get its
`> Verified:` line and move into `docs/`.

Write for pass 1. Leave pass 2 honest markers rather than guesses, and both passes get
cheaper.

After the page is verified and copied into `docs/`, the operator bumps
`src/data/progress.js` so the site UI shows the page. After the **whole phase** is in
`docs/`, the operator runs **`yarn build` once**, fixes every failure, and only then
moves on. You (the author model) do not run the build; you write markdown that will
survive it — valid MDX, `./`/`../` links, no invented blockquote chrome.
