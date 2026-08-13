# Not yet validated

**The tracking list for pages written without verification.** Set up 2026-08-13 on the
user's instruction: pages are **not** marked individually — instead, anything written
from here on that has not been validated is recorded here until it is.

Excluded from the Docusaurus build (`docs/**/reviews/**`), so this file never ships.

## The rule this serves

`~/.claude/CLAUDE.md` **rule 8** — no new sandboxes. Concepts already proven by a run
keep their proof (their `> Verified:` line names the script). Everything written from
now on is validated against official documentation, and **anything not yet validated is
listed below** rather than flagged on the page itself.

**No run means no output block.** A page listed here should contain no console block,
no timing, no error string and no byte count invented to fill the gap.

## Written but not yet validated

*(nothing yet — every page written in session 12 is backed by a script)*

| Page | Written | What still needs checking against docs |
|---|---|---|
| — | — | — |

## The pre-existing backlog

Counted off disk 2026-08-13. `cites sandbox/` means a `> Verified:` line names a real,
committed script. The gap is what has no traceable evidence:

| Technology | pages | `> Verified:` | cites `sandbox/` | no traceable proof |
|---|---:|---:|---:|---:|
| postgresql | 323 | 296 | 283 | 40 |
| **nodejs** | 248 | 229 | **10** | **238** |
| **expressjs** | 91 | 3 | **0** | **91** |
| javascript | 50 | 47 | 46 | 4 |
| typescript | 41 | 41 | 39 | 2 |
| css | 32 | 32 | 29 | 3 |
| react | 17 | 15 | 14 | 3 |
| git | 17 | 15 | 15 | 2 |
| **total** | **819** | **678** | **436** | **383** |

⚠️ **Node is the one to look at.** 229 pages carry a `> Verified:` line and only **10**
name a script — so 219 pages assert verification without citing what verified them.
That is the same shape as the original 216-page PostgreSQL failure that started this
rewrite, and it has never been audited.

**Express** is thin rather than false: 91 pages, almost no verification, and already
known to be outlines rather than explanations (avg 61 lines/page).

**PostgreSQL is the healthy corpus** — 283 of 323 pages genuinely proven.

So the documentation-validation work ahead is overwhelmingly **Node and Express**.
