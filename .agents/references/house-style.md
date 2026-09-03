# House style — measured off the corpus

**Every count below was produced by a command run against `docs/` on 2026-09-03**
(6,079 markdown files). These are not preferences; they are what the corpus does. A new
or edited page that does not match these is the odd one out.

Reproduce any of them:

```bash
grep -rho '<span className="db-tier t-[a-z]*">[^<]*</span>' docs --include=*.md | sort | uniq -c | sort -rn
grep -rho '^## [A-Z][A-Za-z ’&/-]*$' docs --include=*.md | sort | uniq -c | sort -rn | head -18
```

---

## Tier badge — the first line after frontmatter

Raw JSX in markdown, on its own line, immediately after the frontmatter block and
**before** the `> Verified:` line.

```markdown
<span className="db-tier t-master">Master</span>
```

**Exact class → label pairs.** Measured distribution across the corpus:

| Class | Label text | Count | Bar to clear |
|---|---|---:|---|
| `t-master` | `Master` | 4,129 | Use it confidently **without opening documentation**. If you look it up mid-task, you're not done. |
| `t-understand` | `Understand` | 5,343 | Know **how it works**, use it correctly. Looking up exact signatures is fine. |
| `t-know` | `Know` | 1,603 | Know **what it is, why it exists, when it's the right tool**. Details when needed. |
| `t-when` | `When Needed` | 390 | **Don't study upfront.** Learn it the day a project demands it. |

⚠️ **Two deviations exist and are not models to copy:** `Learn When Needed` (13 files)
and `Should Know` (10 files). The four labels above are canonical. The legend that
readers see is `docs/README.md` — the badge is styled in `src/css/custom.css`.

Tiers are assigned **for fullstack application development specifically**. Where a tier
would differ in another context, say so in one line — the corpus does this with
`worker_threads` (Know for a CRUD API, Master at a media-processing company). Keep
`t-master` to roughly 25–30% of a track's topics; if everything is Master the labels
carry no information.

---

## Title and frontmatter

```markdown
---
title: "A full sentence stating the page's claim, not a label"
sidebar_label: "NN · Short label"
sidebar_position: <unique, gap-free within the directory>
---
```

- **`title`** is the argument of the page, and it is often long. Real example:
  *"Before you draw anything, read your own code out loud — qualifier creep,
  translation methods and a glossary that needs footnotes are boundaries the codebase
  has already discovered for you"*. A bare label (`"CROSS JOIN"`) is used only where the
  topic name **is** the claim.
- **`sidebar_label`** is the short form and carries the number: `"07 · CROSS JOIN"`.
  🔴 **The separator is a middle dot `·` with spaces**, never a hyphen or a colon.
- **`sidebar_position`** is unique and gap-free within its directory. A topic
  `README.md` always takes `sidebar_position: 0` and `sidebar_label: "Overview"`.

---

## The `> Verified:` line

A blockquote directly under the tier badge. It names **what was checked, where, and
when** — and it is the page's provenance, not decoration.

```markdown
> Verified: 2026-08 against MDN — [`Map`](https://developer.mozilla.org/…),
> [`Array.prototype.sort()`](https://developer.mozilla.org/…). Documentation-validated;
> **no timings**.
```

Observed shapes, all valid:

- **Documentation-verified** — `> Verified: 2026-09-01 against Martin Fowler, *BoundedContext* ([martinfowler.com](url)); …` then `> Version spine: **JDK 25 · Spring Boot 4.1.0 …**`.
- **Runtime-verified** — `> Verified: 2026-08 on **PostgreSQL 18.4** (\`postgres:18-alpine\`, \`127.0.0.1:55432\`), **Node 24.19.0**, \`pg\` 8.23.0.`
- **Explicitly not run** — `> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.`

Rules:

- Bold the **version being pinned** — `**PostgreSQL 18.4**`. The currency scanner reads
  bold as the page's own pin and plain text as a historical citation, so **bolding the
  wrong number changes what the tooling thinks the page claims.**
- Link the real source. A bare product name with no URL is weaker than the corpus norm.
- Say when nothing was run. `**no timings**` / `**no sandbox run**` is honest and
  common; silence implies measurement that did not happen.
- Date is `YYYY-MM` or `YYYY-MM-DD`. Both are in wide use.

---

## Section headings — the canonical set

Measured `##` headings, by frequency:

| Heading | Count | Where |
|---|---:|---|
| `## Gotchas` | 4,746 | every content page |
| `## Interview questions` | 4,726 | every content page |
| `## Where this connects` | 886 | topic `README.md`, some chunks |
| `## Trade-off` / `## The trade-off` | 598 / 195 | where a recommendation has a cost |
| `## Phase gate` | 466 | topic `README.md` |
| `## Chunks` | 237 | topic `README.md` only |

**`## Gotchas` and `## Interview questions` are not optional and their names are
exact** — plural, sentence case. Body sections between the thesis and Gotchas are named
freely after what they argue (`## Scar 1 — qualifier creep`, `## Deliberate`,
`## Accidental`, `## The problem`).

---

## Entry markers — `★` and the bold lead-in

**31,620 entries** open with `**★ `. This is the dominant unit of both Gotchas and
Interview questions.

```markdown
## Gotchas

**★ Symptom: the exercise produces thirty candidate contexts.** Cause: you counted every
naming inconsistency as a polysemy. Fix: keep only the nouns where the two definitions
have *different rules or different cardinality*, not merely different fields.

## Interview questions

**★ Why is a mapper between two domain models a stronger signal than one between a
domain model and a DTO?**
The answer in prose, as long as it needs to be.
```

The alternative gotcha form — **18,066 uses** — breaks the triple onto its own lines:

```markdown
### The name of the gotcha
**Symptom.** What the reader sees.
**Cause.** The mechanism, precisely.
**Fix.** Shown in code, not described.
```

Both are house style. Pick one **per page** and stay consistent within it.

🔴 `★` marks the **frequently-asked / load-bearing** entries, not every entry. It is
also the split-proof counter — `grep -c '^\*\*★'` before and after a chunking must go
**up**, never down.

---

## Emphasis: how the corpus highlights

- **Bold** carries the claim. Gotchas, questions and thesis paragraphs lead with a bold
  sentence so the page is skimmable at a glance.
- **🔴** marks the load-bearing warning — the thing that silently destroys work or
  breaks a build. Used inline, mid-sentence, sparingly.
- **⚠️** marks a caveat that is serious but not destructive.
- *Italics* for a quoted term of art or a verbatim doc phrase inside prose.
- `> *"…"*` for a **verbatim quote** from documentation. Paraphrasing a rule is where
  errors enter — quote the load-bearing sentence.

⚠️ **Docusaurus admonitions are NOT house style.** Only 110 `:::` blocks exist across
6,079 files (`:::note` 37, `:::caution` 27, `:::tip` 20, `:::info` 14, `:::warning` 9,
`:::danger` 3). The corpus highlights with **bold lead-ins, 🔴/⚠️ and blockquotes**.
Adding `:::note` to a page makes it look imported, not authored here.

---

## Code and tables

- Fenced blocks are always language-tagged — ` ```sql `, ` ```java `, ` ```bash `,
  ` ```console ` for transcripts.
- 🔴 **` ```console ` blocks are program output and require an actual run.** Under the
  standing no-sandbox rule you do not create one. Existing pages have them because a
  sandbox existed at the time; **a new or edited page must not gain one.**
- Code is runnable and complete — realistic names, **no `...` elisions**. Anything not
  runnable is labelled `// pseudo-code`.
- Tables use `|---|---|` with `---:` for numeric columns, and carry a real header row.

---

## Topic `README.md` — the chunk index

A chunked topic's index. Measured shape:

```markdown
---
title: "02 · The complexity classes you actually meet"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](…), [`Set`](…).

**Bold thesis paragraph.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[O(1) to O(n log n)](./01-constant-to-linearithmic.md)** | one dense line naming the real findings, 🔴 marking the load-bearing one |

## Phase gate

You are done with this topic when you can <the concrete capability, not "understand X">.

## Where this connects

- [01 · Big-O notation](../01-big-o/README.md) — what it gives you
```

Sibling `_category_.json`, single line, no trailing newline fuss:

```json
{"label":"02 · Service boundaries","position":2,"collapsed":true}
```

---

## Footers

A `---` rule, a blank line, then one line. **Dominant form, 2,692 uses:**

```markdown
---

← [Topic index](README.md) · Next → [GRANT and REVOKE](02-grant-and-revoke.md)
```

Variants in use: `· Next:` (151), `· Next topic →` (38), `· Next phase →` (12), and
`Start →` on a topic README pointing at its first chunk. A middle chunk often carries
three links — `← [prev] · [Topic index](./README.md) · Next → [next]`.

🔴 **Every link ends in `.md` and keeps its numeric prefix.** Never link a directory
slug — it resolves one level too high from a README and ships a 404. Link only files
that exist **right now** (`ls` first); anything not yet written is bold text plus
`*(not written yet)*`, never a link:

```markdown
· Next → **`None` and the "no result" contract** *(not written yet)*
```

---

## Checklist before reporting

```bash
wc -l <dir>/*.md                              # nothing over 300
grep -c '^\*\*★' <dir>/*.md                   # compare against the BEFORE count
grep -L '^<span className="db-tier' <dir>/*.md   # every page has a tier badge
grep -L '^> Verified:' <dir>/*.md                # every page has provenance
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag <dir>
```

Plus: `sidebar_position` unique and gap-free, every link resolving to a real file, and
`## Gotchas` + `## Interview questions` present and exhausted on every content page.
