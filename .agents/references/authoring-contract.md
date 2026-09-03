# Authoring contract — what a page must be

Read this **before writing or extending any page**, whether the trigger was a version
bump, a new topic from a major release, or a gap found while editing.

Ultimate source: `instructions.md` §4–§6 and §9–§10 (the standing brief). The Claude
subagent flavour of these same rules is `.claude/agents/devbible-author.md`. **When
this file and `instructions.md` disagree, `instructions.md` wins** — report the
disagreement rather than picking one.

---

## 🔴 Rule 1 — 300 lines is a FILE-SIZE cap, never a content budget

This is the rule most often broken, and breaking it silently destroys work.

**A file stops at 300 lines. The content does not.** A topic may run **1000+ lines in
total across chunks** — that is normal and expected, not an overrun. A topic running
to twice as many chunks as its plan listed is a correctly-exhausted topic.

**Exhaust the subject.** Every gotcha, pitfall, worked example and interview question
the topic genuinely has — never five because five looked like enough. Never write
"the fix is X" without showing X in code.

**Write it ALL first, then split.** Never size a page to the cap. Never trim, reword,
merge or drop anything to fit.

### 🔴 The tells that you got this wrong — and they are checked

- Pages clustering just under 300 lines.
- A run of near-identical gotcha or question counts across files. Real topics vary;
  a template does not.
- The page names the hard case and then demonstrates the easy one.

### 🔴 Prove a split is a split, not a trim

A trim passes the cap check, the MDX check and the link check, and is
**indistinguishable from a split in a file listing.** This has silently destroyed
content four times.

**Before:**

```bash
wc -l <topic dir>/*.md
grep -c '^\*\*★' <topic dir>/*.md
```

**After:** a new file must exist, and **both totals must have gone UP.** A split
redistributes content and adds per-chunk scaffolding; it never nets out lower. If
either total fell, you trimmed — restore and split again.

---

## Rule 2 — how to chunk

Split on a **concept boundary**, never on line count. The test for whether two things
belong on one page: *would you ever want to read one without the other?* If no, one
page. `map` vs `flatMap` share a page; **closures** and **the event loop** never do.

Grouping reduces noise, never coverage. A grouped page still explains every member,
with code for each.

### A single file outgrows the cap

`NN-slug.md` becomes a directory **`NN-slug/`** — the same slug and the same numeric
prefix, so sidebar order is unchanged and inbound links keep resolving:

```
NN-slug/
├── _category_.json     {"label":"NN · Label","position":N,"collapsed":true}
├── README.md           topic index: tier badge, > Verified:, one-liner,
│                       chunk table, phase gate, "Where this connects"
├── 01-first-concept.md
└── 02-second-concept.md
```

### A file already inside a chunked topic outgrows the cap

It gains a **lettered sibling** — `04-x.md` → `04-x.md` + `04b-y.md`. No renumbering;
renumbering breaks every inbound link in the corpus.

### Either way

- Every chunk carries its **own** frontmatter, tier badge, `> Verified:` line,
  Gotchas and Interview questions — a chunk opened directly still states its
  provenance.
- **Redistribute** the existing gotchas and questions to whichever half each is
  actually about. Do not leave them all in the first file.
- Chunks link `← Prev` / `Next →`; the first links back to the topic index, the last
  forward to the next topic.
- Update the phase `README.md` and the neighbouring pages' footers to the directory
  form when converting a file to a chunked topic.
- Past ~1000 lines, it is not one topic — promote it to its own section and report
  that rather than deciding it alone.

⚠️ **Routes drop the numeric prefix, for directories as well as files.** `01-ddl/`
serves at `…/phase-8-schema/ddl/`. Links in *markdown* keep the prefix and the `.md`;
only the built route drops them.

---

## Rule 3 — what every concept must contain

| Section | Bar |
|---|---|
| **Explanation** | Mechanism first — *why it exists*, then how it works. Reference handbook, not tutorial. Self-contained. |
| **Code** | Runnable, complete, realistic names. **No `...` elisions.** Anything not runnable is labelled `// pseudo-code`. |
| **Gotchas & pitfalls** | **Symptom → Cause → Fix**, leading with the symptom — that is what someone searches when stuck. The fix is **shown in code**, never just described. As many as the topic has; if it fails eleven ways, list eleven. |
| **Interview questions** | With answers. Prefer *"why"* and *"what happens if"* over *"what is"*. Mark frequently-asked ones `★`. As many as the topic carries. |

`instructions.md` §4 names 3–8 interview questions as typical — that is a floor for a
thin topic, **not a ceiling for a rich one**. Rule 1 governs: exhaust the topic.

---

## Rule 4 — evidence, never invention

- **No sandbox.** No new scripts, no containers, no measurement runs. A new script
  roughly **triples** the cost of a page; this is a standing user instruction.
- **Code examples yes; program output never.** No console blocks, timings, byte
  counts, query logs, or stack traces reconstructed from memory.
- Where a real error string matters, quote it **inline as a backticked phrase**
  sourced from the docs or the upstream source, and say where it came from.
- Validate against the **primary source** — official documentation, the spec, release
  notes — not a blog. Quote load-bearing sentences verbatim in `> *"…"*` form; a
  paraphrase of a rule is where errors enter.
- **A claim the documentation cannot settle is stated as uncertain or left out.**
  "I could not confirm this" is acceptable; a confident invention is not.
- Every page carries `> Verified: YYYY-MM` naming the real sources and the version
  spine. Name exact versions. Deprecated things get `⚠ Deprecated` and a pointer to
  the successor.

---

## Rule 5 — links

Every link ends in `.md` and **keeps its numeric prefix**. Never link a directory
slug — it resolves one level too high in README indexes and ships a 404.

```
[05b](05b-offset-pagination.md)             same topic
../08-n-plus-1/03-fetch-joins.md            another topic's file
../08-n-plus-1/README.md                    a topic index
```

🔴 **Link only to a file that exists on disk right now — `ls` it first.** A dangling
relative link breaks the production build for **every other session in this shared
checkout**. Anything you intend to write later is **bold text plus *(not written
yet)*** — and that includes your own later chunks, which is the single most common
thing a session gets wrong.

---

## Rule 6 — MDX breakers that abort the production build

Docusaurus v3 parses `.md` as MDX. These three broke every deploy for three days:

1. **A bare `<!-- ... -->` in prose** → use `{/* ... */}`.
2. **An inline code span left open at end of line whose next line starts with `{`** →
   reflow so the brace is not at line start.
3. **A bare `<Something` in prose** — `List<String>`, `<clinit>`, `<stdin>` → always
   backtick generics and angle-bracket tokens.

---

## Page skeleton

Copy this. Do not open an existing page to learn the shape.

```markdown
---
title: "A full sentence stating the page's claim, not a label"
sidebar_label: "NN · Short label"
sidebar_position: <unique, gap-free within the directory>
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against <real doc title and URL>, <second source>.
> Target: **<runtime and version>**.

**Bold thesis paragraph — three to six sentences saying what is true and why it
matters, not what the page will cover.**

## <Body sections — mechanism, then code, then verbatim quotes>

## Gotchas

### <Name of the gotcha>
**Symptom.** What the reader sees.
**Cause.** The mechanism, precisely.
**Fix.** Shown in code, not described.

## Interview questions

**★ The question?**
The answer in prose, as long as it needs to be.
```

Tier badge classes: `t-master`, `t-understand`, `t-know`, `t-when`. Keep `[MASTER]` to
roughly 25–30% of topics — if everything is MASTER the labels carry no information.

---

## Before reporting

```bash
wc -l <topic dir>/*.md                       # nothing over 300
grep -c '^\*\*★' <topic dir>/*.md            # compare against the BEFORE count
grep -rln '^{/\* FOOTER \*/}$' <topic dir>   # 🔴 MUST BE EMPTY AT TOPIC CLOSE
grep -h '^sidebar_position:' <topic dir>/*.md | sort -n | uniq -d   # must print nothing
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag <topic dir>
```

Plus: every link resolves to a file that exists, and `sidebar_position` is unique and
gap-free in the directory.

🔴 **Why those two greps are here.** Both defects are invisible to every other check:

- **`{/* FOOTER */}`** is a valid MDX comment with no link to resolve, so the cap check,
  `mdxcheck.py` and the link resolver all pass a page that has **no navigation at all**.
  It is *correct* while the topic is being written and a defect the moment it closes.
  Measured 2026-09-03: **1,241 pages across 48 topics** shipped this way.
- **A duplicate `sidebar_position`** is a silent reordering, not an error — every check
  passes it, and the sidebar quietly renders in the wrong order.

Report per file: path, line count, gotcha count, interview-question count; every claim
you could **not** confirm and what you wrote instead; and anything wrong outside your
directory — **found, not fixed**.
