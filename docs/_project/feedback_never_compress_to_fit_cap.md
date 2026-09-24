---
name: devbible-never-compress-to-fit-cap
description: The 300-line per-file cap is hard — a bigger topic is SPLIT across multiple files, never condensed to fit; the chunked-topic layout and the route-prefix trap
metadata:
  type: feedback
---

# Chunk means split. It never means condense.

**The cap is a hard 300 lines per file. A topic that needs 1000 lines becomes four
files of ≤300, tied together so it still reads as one explanation.** Never cut
explanation, examples, gotchas or interview questions to make a page fit.

Stated by the user repeatedly on 2026-08-12, with rising frustration, after I:

1. trimmed a page from 309 → 298 lines by deleting a section, and
2. then "fixed" the rule by **softening `instructions.md` to "roughly 300 lines…
   a few lines over is fine"** — bending the limit instead of splitting the file.

Both were wrong. The user's words: *"if the topic can be explained more than 300
lines just chunk them and import, use multiple files to make up so each file is
clean and well maintained"* and *"you can go way over but just chunk them"* — go
way over **in total**, across files; never in one file.

**Why:** the cap keeps every file clean, diffable and loadable in one screen or one
context window. It says nothing about how much a topic deserves. Trading depth for
line count defeats the whole reason the PostgreSQL corpus is being rewritten — it
was too thin ([[devbible-postgresql-pages-validation]]).

**How to apply:** count lines before finishing a page. At 301, split — do not trim,
do not reword to save four lines, do not relax the rule. Coverage is fixed; file
count is the variable. [[devbible-brief]] already carried this correctly as "Hard
cap: 300 lines per file. Beyond that, chunk on concept boundaries" — the rule was
never ambiguous, I just failed to apply it.

## The chunked-topic layout (established 2026-08-12, builds clean)

The topic becomes a **directory replacing its file**, keeping the numeric prefix so
sidebar order is unchanged:

```
phase-9-api-crud/04-allowlists/
├── _category_.json   {"label":"04 · Allowlists","position":4,"collapsed":true}
├── README.md         topic index — tier badge, Verified line, bold one-liner,
│                     chunk table, phase gate, "Where this connects"
├── 01-two-failure-modes.md
└── 02-building-the-allowlist.md
```

- **Split on a concept boundary, never on line count.** The allowlist topic split
  at the problem/solution seam; the DDL topic split at single-process mechanics vs
  concurrency.
- **Every chunk repeats the tier badge and `> Verified:` line**, so a chunk opened
  directly still states its provenance.
- **Each chunk carries its own Gotchas and Interview questions** for what it covers
  — do not leave one chunk without them.
- Chunks link `← Prev` / `Next →`; first links back to the topic index, last
  forward to the next topic.

**The trap that cost a build:** routes drop the numeric prefix for *directories*
too, not just files. `04-allowlists/` serves at `…/phase-9-api-crud/allowlists/`.
Cross-language absolute links likewise:
`/docs/nodejs/pages/phase-6-data-access/parameterized-queries`, not
`…/02-parameterized-queries`.

## ⛔ CORRECTED 2026-08-13 (session 11) — the `./allowlists/` advice above is WRONG in READMEs

**Write links as explicit `.md` file paths — `./04-allowlists/README.md` — never as
directory slugs.** The slug form `./allowlists/` silently breaks in every
`README.md`, and it broke **114 links across 35 PostgreSQL READMEs**.

**Why.** `docusaurus.config.js` sets **`trailingSlash: false`**, so a directory
index serves at `…/phase-6-aggregation` with *no* trailing slash. Relative links
resolve against that, one level **above** where the author meant:

| Source page | Link written | Resolves to | Wanted |
|---|---|---|---|
| `phase-6-aggregation/README.md` | `group-by/` | `…/pages/group-by` ❌ | `…/phase-6-aggregation/group-by` |
| `…/02-count-variants/README.md` | `../group-by` | `…/pages/group-by` ❌ | `…/phase-6-aggregation/group-by` |

**Only `README.md` files are affected** — an index page's *file* path carries one
more level than its *URL*. Leaf pages (`02-nulls.md`) have file and URL depth in
agreement, so the same slug link works there. That asymmetry is why this survived
so long: the form looked proven because it worked everywhere except indexes.

**A `.md` link is immune to all of it** — Docusaurus resolves it file-relative, so
it is independent of `trailingSlash`, `slug:`, and `baseUrl`. It also fails loudly
at build time if the target is missing, instead of silently pointing at a 404.

**`trailingSlash: true` is not the fix — it is worse.** Measured: broken links went
**188 → 198**. Reverted. Do not try it again.

**Same bug, same fix, in `docs/README.md`** — it carries `slug: /`, so its
relative links resolved against `/devbible/` instead of `/devbible/docs/`. All 16
were broken, including two that predated this session.

**Fixed site-wide 2026-08-13 (session 11): 188 → 7 broken links, 201 links rewritten
across 93 files.** PostgreSQL, Node, Express, CSS, React and Git are all at **0**.

**The 7 that remain are not this bug and must not be "fixed"** — they are JS phase-3
and TS phase-2 links to pages the parallel session has not written yet
(`02-parameters.md`, `04-arrow-functions-and-this.md`, `08-hoisting-and-tdz.md`,
`08-as-assertions.md`, `12-unknown-in-catch.md`, plus 2 missing chunk READMEs).
Verified absent on disk. They self-resolve when those pages land
([[devbible-parallel-sessions]]).

The fixer is reusable: **`shared/scripts/fixlinks.py <docs/tech>`** — dry-runs by
default, `--apply` to write. It only touches `README.md` files (the only ones
affected), resolves every target against the filesystem, and refuses to guess:
it reported **0 unresolved on all seven technologies**, which is the check that
makes it safe to run unattended.

Update the phase `README.md` and neighbouring footers when converting a file.

## Applied 2026-08-12 — corpus is now compliant

**Zero files over 300 lines across all three corpora.** Four chunked topics exist,
and they are the reference examples:

- `nodejs/…/phase-3-buffers-streams/13-transform-streams/` (was 327 — the only
  pre-existing violation in 245 Node pages)
- `postgresql/…/phase-8-schema-from-node/01-ddl-from-node/` (3 chunks)
- `postgresql/…/phase-9-api-crud/03-safe-dynamic-where/` (2 chunks)
- `postgresql/…/phase-9-api-crud/04-allowlists/` (2 chunks)

**The Node corpus was NOT systematically compressed** — median 205 lines, p90 262,
one file over cap out of 245. The fear that it had all been jammed against the
limit was unfounded; measure before rewriting anything there.

**Link-fixing checklist when converting a file to a chunk directory** — each of
these broke a build in turn:

1. 🔴 **Inbound links elsewhere** — the single most repeated mistake in this corpus
   (sessions 8 and the 2026-08-13 merge session, 6 links). **Grep for the old flat
   path in the same commit as the conversion:**
   ```bash
   grep -rn "13-transform-streams\.md" docs/
   ```
   Retarget each hit to `](./13-transform-streams/README.md)` — **keep the numeric
   prefix, end in `README.md`**. Include **cross-phase** hits
   (`../phase-3-buffers-streams/13-transform-streams.md`).
   ⛔ **This step previously read `→ ](./transform-streams/)` — that was the
   superseded slug form, contradicting this same file's rule above, and it is what
   broke 188 links.** Corrected 2026-08-13.
2. Links *inside* the moved content now sit one level deeper: `](14-object-mode.md)`
   → `](../14-object-mode.md)`, `](../phase-2-async/…)` → `](../../phase-2-async/…)`.
3. But the chunks' own prev/next links to each other stay **un-prefixed** — they are
   siblings. A blanket regex breaks these; fix them back.
4. Verify with a clean build (`rm -rf .docusaurus build node_modules/.cache`) and
   grep for `warning|broken` — `onBrokenLinks` is not `throw` here, so `[SUCCESS]`
   alone proves nothing. **Strip ANSI codes before any `grep -c`**, or an anchored
   pattern returns a false `0` on a colourised log.

**`fixlinks.py` does not cover step 1** — it skips any target already containing
`.md` and only walks `README.md` files, so it cannot see a straggler and reports
success having changed nothing. Step 1 is a hand fix, one `Edit` per hit.
Distinguishing it from a harmless forward reference: a straggler's target
**exists on disk as a directory**; a forward reference has nothing on disk and is
expected until that topic is written. Detail: [[devbible-postgresql-repo-and-build]].

## It recurred on 2026-08-13 — and why

Phase 5 (joins) was written as 13 single files of **171–210 lines**. Nothing was over the
cap, so no rule *appeared* broken — but the pages had been sized to the budget instead of
written out and chunked. Three of them are Master-tier topics that deserve 400–600 lines.
The user's correction: *"you should't limit explanation under 300 lines"* and *"You have
to chunk into multiple parts and import them in .md"*.

**Root cause, and it is not "forgot".** This file does not auto-load. Only the root
`MEMORY.md` (imported by `devbible/CLAUDE.md` by absolute path) and `CLAUDE.md` itself
load without being opened. The rule was one hop away behind `devbible/INDEX.md`, and the
hop never happened, because writing a 200-line page raises no flag that would prompt it.

**Fix applied:** the rule is now stated *in full* in the root `MEMORY.md` under
"Non-negotiables", not as a pointer to here. A rule that only works if someone chooses to
open it is not in force. This file keeps the detail — layout, link checklist, examples.

**The tell to watch for:** a set of pages that all land in a narrow band just under the
cap is evidence of budgeting, not of topics that happened to be that size. Real topic
lengths vary widely.

## Third recurrence, same day — and it is corpus-wide, not one phase

A correctness review measured all five rewritten phases and found **81 of 81 pages inside
169–269 lines. Not one over 270, not one under 169.** Phase 5 had been fixed by then, so this
is not the same instance: phases 1, 2, 10 and 11 were *also* written to the band, and
**20 pages tagged Master tier are still single files** inside it.

So the fix after the second recurrence — promoting the rule into the root `MEMORY.md` — stops
it going forward but **does not repair what was already written that way**. The two are
separate jobs, and only the first was done.

**The measurement that makes this checkable in one command** — run it per phase before
declaring the phase complete, and expect a wide spread:

```bash
cd docs/postgresql/pages && for f in phase-*/*.md; do
  [ "$(basename "$f")" = README.md ] && continue
  printf "%s %4d %s\n" "$(grep -oiE 'Master|Deep|Working|Aware' "$f" | head -1)" \
    "$(wc -l < "$f")" "$f"
done | grep -i '^master' | sort -k2 -rn
```

Any **Master**-tier row that is a single file under ~300 lines is a defect. The queue of 20
and the remediation state: [[devbible-postgresql-review-remediation]].

**And the trap inside the fix:** splitting a 199-line page produces two 100-line pages and
repairs nothing. The cap was never the constraint. Write the topic to the depth it deserves
first — then the split is forced by length rather than chosen.

Related: [[devbible-brief]] · [[devbible-incremental-scope]] · [[devbible-progress]] ·
[[devbible-postgresql-review-remediation]]
