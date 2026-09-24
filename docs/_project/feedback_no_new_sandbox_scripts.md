---
name: devbible-no-new-sandbox-scripts
description: Standing rule from 2026-08-13 — no sandbox scripts at all (usage cost). Write explanations and verify them against official documentation in repeated passes; never fabricate console output, and never state a performance number docs cannot support
metadata:
  type: feedback
---

# No sandbox. Verify against documentation instead.

**User instruction, 2026-08-13**, hardened twice in one session:

1. *"i do not want you to write sandbox scripts because it was consuming way tooo much
   usage"*
2. *"No sandbox that will drink soo much usage. Just write the proper explanation lets
   re review multiple times against internet or documentation etc to confirm
   authenticity"*

**The final rule: write the explanation, then verify it against official documentation
over repeated passes.** No new scripts, no containers, no measurement runs.

Measurement — not writing — is what made pages expensive. Evidence from session 12: a
page written from existing data took **20–35 min**; the same page needing a new script
took **60–90 min**, and one needing a new container **90–150 min**. A new script roughly
**triples** the cost of a page.

## What this does NOT license

**"Stop measuring" is not "make it up."** Inventing console output is what the
never-invent-output rule in `~/.claude/CLAUDE.md` forbids, and it is the reason this
corpus exists in its current form — **216 PostgreSQL pages shipped with fabricated
`Verified:` lines**. Documentation verification replaces measurement as the *source of
truth*; it does not remove the requirement to have one.

## The hard limit — read this before writing a performance claim

Documentation is authoritative for **facts**: syntax, semantics, feature availability
and version, error conditions, defaults, what a clause does.

Documentation is **useless** for **behaviour under load**: timings, ratios ("170×
slower"), plan shapes, buffer counts, and the exact error string a given driver
surfaces. Those only ever came from running things.

**So a doc-verified page must not state a performance number.** Write the mechanism and
the trade-off qualitatively — *"filtering on an aggregate result cannot push down, so
the view scans the whole table"* — and stop there. **Do not estimate, do not reuse a
number from a similar case, do not write "roughly N×".** If a number matters that much,
that is a reason to lift this constraint for that one page, not a reason to guess.

Numbers **already on pages** are safe: they were measured, and the scripts are committed.

## Page markers — follow rule 8's scheme, not a competing one

⚠️ An earlier draft of this file invented a separate `> Documented:` marker. **That was
wrong and is withdrawn** — `~/.claude/CLAUDE.md` rule 8 is authoritative and keeps a
single marker:

- **`> Verified:` stays on both kinds.** For a sandbox-proven page it names the script;
  for a cited page it names **the doc pages and the date** instead.
- Pages proven by a run that actually happened are additionally marked
  **sandbox-proven**, so a reader can tell measured evidence from cited evidence.

**No run means no output block.** Never reconstruct a plausible console block, error
string, timing or byte count from memory to fill the space. A claim documentation cannot
settle is either stated as uncertain or left out — *"I could not confirm this"* is
acceptable to write; a confident invention is not.

## The review loop the user asked for

Write → verify each factual claim against the primary source → **re-review in a second
pass, specifically hunting claims the first pass accepted without checking**. Prefer the
official manual for the exact major version; release notes for "when did this arrive";
treat blogs and StackOverflow as leads to confirm, never as the citation.

**Proven on the first try, 2026-08-13:** `postgresql.org/docs/17/sql-merge.html`
independently confirmed all three MERGE claims that had been measured earlier the same
day — `RETURNING` is supported, `merge_action()` exists and is legal in the `RETURNING`
list, and `WHEN NOT MATCHED BY SOURCE` is a PostgreSQL extension to the standard. Docs
and measurement agreed, which is what makes the method trustworthy.

## Companion hard rule: sandbox artifacts stay inside the project

Promoted to **`~/.claude/CLAUDE.md` rule 7** (mirrored to `shared/global-claude-md/`)
because it holds for every project. Scripts, scratch files and output live under the
project's own `sandbox/` tree — never the host's `/tmp`, which is invisible to git and
shared with every parallel session. Derive paths from the script's own location:
`"$(cd "$(dirname "$0")" && pwd)/tmp"` in bash, `new URL('./tmp/x', import.meta.url)` in
ESM.

Fixed 2026-08-13: `ex56-vs-sqlite.mjs`, `ex31-psql-basics.sh`, `ex32-psql-io.sh`,
`ex53-hba-tls.sh` → `sandbox/pg-api/tmp/`. Left deliberately: container-internal `/tmp`
paths, and `COPY FROM '/tmp/does-not-exist-on-server.csv'`, a *server-side* path that is
the point of its demo. Still unconverted: `sandbox/git-p0/ex2` (another session's area).

## Consequence for item 14

**Item 14 (the Master-tier re-split) cannot proceed under this rule.** Its definition is
"write each topic to the depth it deserves, with measured output behind every claim" —
that *is* new measurement. It is not cancelled; it is blocked until the constraint is
lifted for it specifically. See [[devbible-postgresql-review-remediation]].

## Related instruction, same conversation

Only **7 of 320** PG pages mention Prisma, Drizzle, Supabase or Neon. The tool layer is
deliberately Node Phase 6's ([[devbible-scope-boundaries]]), but a page with a
well-known tool-level gotcha should carry a short **"through your ORM or platform"**
note — the tool hides the behaviour, and knowing the behaviour is what lets you debug
the tool. Costs no measurement, so it fits this rule well.

Related: [[devbible-postgresql-sandbox]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-postgresql-rewrite-handoff]] · [[devbible-scope-boundaries]] ·
[[devbible-postgresql-review-remediation]]

## Do NOT mark pages individually — use one tracking file

**User correction, 2026-08-13:** *"you do not need to mark separately what are with
sandbox and what not — just from now onwards whatever you're writing those not validated
yet, so in separate file or somewhere mention it"*.

A per-page `🧪 Sandbox-proven` marker **was applied to 436 pages and then reverted the
same day.** Do not re-introduce it. The page's own `> Verified:` line already names its
script; a second badge on every page was noise.

**Instead: `docs/reviews/unvalidated.md`** is the single tracking list. Anything written
from here on that has not been validated goes in that table until it is, then comes out.
The file is excluded from the build (`docs/**/reviews/**`), so it never ships.

### The validation backlog this exposed

Counted off disk the same day. `cites sandbox/` = has real measured proof; the gap is
what now needs documentation validation:

| Technology | pages | `> Verified:` | cites `sandbox/` | needs validating |
|---|---:|---:|---:|---:|
| postgresql | 323 | 296 | **283** | 40 |
| nodejs | 248 | 229 | **10** | **238** |
| expressjs | 91 | 3 | **0** | **91** |
| javascript | 50 | 47 | 46 | 4 |
| typescript | 41 | 41 | 39 | 2 |
| css | 32 | 32 | 29 | 3 |
| react | 17 | 15 | 14 | 3 |
| git | 17 | 15 | 15 | 2 |
| **total** | **819** | **678** | **436** | **383** |

⚠️ **The number that matters: Node has 229 pages claiming `> Verified:` and only 10
naming a script.** Those 219 pages assert verification without citing what verified
them — the same shape as the original 216-page PostgreSQL failure, and they were never
audited. Express is worse in a different way: 91 pages, essentially no verification at
all, and already known to be outlines rather than explanations (avg 61 lines).

**So the doc-validation work is overwhelmingly Node and Express, not PostgreSQL.**
PostgreSQL is 283/323 genuinely proven and is the healthy corpus. Start where the
evidence is thinnest.
