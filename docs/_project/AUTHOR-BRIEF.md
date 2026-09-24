---
name: devbible-author-brief
description: The compact standing brief handed to every devbible-author fork — hard rules and page skeleton in one short read, so a fork never opens a 274-line template to learn the shape. Point forks here; do not inline the rules in a prompt.
metadata:
  type: project
---

# devbible author brief — read this, then write

Repo root `/mnt/Storage/Backup/Knowledge/devbible`. This file is the whole briefing.
**Do not open a template page to learn the shape — the skeleton is below.**

## 🔴 Hard rules

1. **300 lines is a FILE-SIZE cap, NEVER a content budget.** A topic may total 1000+
   lines across chunks. **Exhaust the topic** — every gotcha, pitfall, worked example and
   interview question it actually has. Never two, never three, never "five because five
   looked like enough". Never write "the fix is X" without showing X in code.
2. **Write it all FIRST, then split on a concept boundary.** Never size a page to the cap,
   never trim or drop a section to fit. Over 300: a single file `NN-slug.md` becomes a
   directory `NN-slug/` (same slug — inbound links keep resolving) with `_category_.json`,
   a `README.md` carrying a chunk table, and numbered chunks. A file already inside a
   chunked topic just gains a `NNb-`, `NNc-` sibling. Every chunk gets its own
   frontmatter, tier badge, `> Verified:` line, Gotchas and Interview questions, and the
   existing ones are **redistributed** to whichever half each belongs to.
3. **The tell you got this wrong:** pages clustering just under 300, or near-identical
   section counts across pages. Real topics vary in length.
4. **Never invent output, and never build a sandbox.** No scratch directory of runnable
   files anywhere in the repo, no console blocks, no fabricated command output, `dis`
   listings, timings, byte counts, version strings or error text. *Code examples in the
   page* yes — that is the whole point; *program output* never. Validate against the
   official docs and name the real URLs on the `> Verified:` line. What the docs cannot
   settle is stated as uncertain or left out.
   🔴 **The specific leak, seen 2026-08-28:** a fork created a `_scratch/` of `.py` files
   inside its topic directory to "check" import behaviour. Both halves are violations —
   the sandbox itself, and any output it would have produced. Where a real error string
   genuinely matters, quote it **inline as a backticked phrase** sourced from the docs or
   the CPython source, and say where it came from. Never reconstruct a traceback from
   memory and present it as a fenced block with a file path, line number and frame stack.
5. **Links** end in `.md` and keep their numeric prefix — `../09-name-main.md`,
   `README.md`. Never a directory slug.
   🔴 **Link only to a file that exists on disk RIGHT NOW — `ls` it first.** A
   dangling relative link breaks the production build for every other session in
   this shared checkout, so a topic carrying one cannot be committed. Anything you
   intend to write later is **bold text with `*(not written yet)*`**, never a link
   — and that includes **your own later chunks and your own later topics**, not
   just other people's. Write the chunk first, then link it; or leave the marker
   and let the coordinator repoint it at close.
   *Seen 2026-09-02: both forks of a two-fork run independently wrote hard links
   to files they had not written yet — 15 in one topic, 12 in the other. It is the
   single most common thing a fork gets wrong.*
6. **MDX breakers that abort the production build:** no bare `<!-- -->` (use `{/* */}`);
   never leave an inline code span open at end of line when the next line starts with `{`;
   backtick every bare `<Something` in prose (`<module>`, `<stdin>`, `List<String>`).
7. **Scope: your assigned topic directory only.** Never touch a phase `README.md`,
   `src/data/progress.js`, another topic, or anything outside your directory. Never
   commit, never build, never start a dev server.
8. **Never spawn a subagent of your own.** The coordinator holds a hard ceiling of
   **three agents including itself** — two forks at a time. A fork that forks breaks it
   silently.

9. 🔴 **Explain in your own words. Quote almost never.** Validating against the docs means
   **reading them and then writing the explanation yourself**, not reproducing them with a
   citation attached. A page that is 15% blockquote is an annotated excerpt, not a devbible
   page, and it defeats the entire point of the corpus — the reader could have read the docs.
   **Hard limits:** at most **one quote per page**, under **25 words**, and only when the
   exact wording is itself the point — a normative "must", a precise threshold, an error
   string, a stability statement. Everything else gets restated in your own sentence with a
   link. **Never** quote a whole paragraph, a bulleted list, a table, or consecutive
   sentences. **Never** open a section with a quote and then gloss it.
   *Seen 2026-09-03: a two-fork run produced 201 blockquotes totalling ~7,500 words across
   23 files — 15% of all prose — and the pages read as commentary on Vercel's docs rather
   than as explanation. It had to be rewritten afterwards, which cost more than writing it
   properly would have.*
   **The test:** if you deleted every blockquote, would the page still teach the topic? If
   not, you transcribed instead of writing.

## Page skeleton — copy this, do not go read one

```markdown
---
title: "Full sentence that states the page's claim"
sidebar_label: "1 · Short label"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against <real doc title and URL>, <second source>.
> Target: **<runtime and version>**.

**Bold thesis paragraph — three to six sentences saying what is true and why it
matters, not what the page will cover.**

## Body sections
Prose plus code. As many sections as the topic has.

## Gotchas

### <Name of the gotcha>
**Symptom.** What the reader sees.
**Cause.** The mechanism, precisely.
**Fix.** Shown in code, not described.

## Interview questions
Exhaustive — as many as the topic carries, each with its answer.

---

← Prev: [Title](path.md) · Index: [Title](README.md) · Next → [Title](path.md)
```

Tier badge is one of `t-master` / `t-understand` / `t-know` / `t-when`, with the matching
word as the span's text.

## Before you report back

- `wc -l` every file you wrote — nothing over 300.
- `grep -h '^sidebar_position:' <your dir>/*.md | sort -n | uniq -d` — must print nothing;
  a duplicate position is a SILENT reordering that every other check passes
- `python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag <your dir>`

🔴 **Keep ending every page with `{/* FOOTER */}` — that is your contract, not a defect.**
But **report how many files carry one**, because replacing them is the coordinator's job at
topic close and it is the step that gets skipped: **1,241 pages across 48 topics** shipped
with the marker still in place and therefore **no navigation at all**, and no check catches
it — it is a valid MDX comment with no link to resolve. Name the count so it cannot be lost.
  from the repo root.
- **Count your blockquotes.** `grep -c '^> \*"' <each file>` — more than one per page,
  or any quote over 25 words, means rule 9 was broken and the page needs rewriting
  before you report it, not after.
- Report: files written with line counts, and anything you could not verify in the docs.

See also [[devbible-locks]] for the per-language locks, and the language's own progress
file for its version target and standing decisions.
