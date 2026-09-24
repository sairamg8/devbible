---
name: feedback-mdx-literal-braces
description: MDX evaluates every {…} in prose, quotes and tables as JS — {0} renders "0", {1,2} renders "2", the build does NOT flag it. Swept typescript/java/README 2026-09-10 (78 files, 270 braces). How to find and fix, and what to leave alone.
metadata:
  type: feedback
---

**Rule: a literal brace in devbible prose is written `\{ … \}`. Never a bare `{…}`.**

MDX treats `{…}` outside code spans and fences as a JavaScript expression. The ones that
crash SSG (ReferenceError) at least show up. **The silent ones never do:** `{0}` renders
`0`, `{1,2}` renders `2`, `{'a', 'b'}` renders `b`, `{}` renders nothing. The worst source
is **compiler and library message templates quoted verbatim**: TypeScript's
`'{0}' is not assignable to '{1}'`, JDBC's `Batch entry {0} {1}`, SLF4J's `{}`, Bean
Validation's `{min}`.

**Why:** the user ordered a sweep on 2026-09-10 after the python lane's two build fixes
(`6506d49bb`, `02d9a9cd9`) showed that the build only catches the crashing half. The sweep
found **270 silently mis-rendered braces in 78 files**: 76 typescript pages (nearly every
`TSnnnn` message table and quote in phases 3, 4, 6 and 10), 3 java pages and a row of
`docs/README.md`. All pushed in 78 per-file commits ending `8bf7a91ad`.

**How to apply:**

- **Find:** from the devbible root,
  `node /mnt/Storage/my-learning/claude/shared/scripts/mdx-compile-check.mjs docs/<track> 2>&1 | grep EXPRESSION | grep -v '{/\*'`.
  It takes files as well as directories since 2026-09-10 (it used to crash with ENOTDIR on
  `docs/README.md`, printing a 97 KB stack instead of a result).
- **Fix:** `node …/shared/scripts/mdx-escape-braces.mjs <file.md>` (one file; `--dry` to
  preview). It rewrites only `{}` / `{digits}` expressions at their exact AST positions to
  `\{…\}` and refuses to write unless the rendered text is identical apart from the braces.
  Anything else it leaves for a human decision.
- **Leave alone:** `{/* … */}` (the footer comments — ~1,150 of them in typescript+java,
  which is why the checker's "N failed" total looks alarming and means nothing), and
  `{'{'}` / `{'}'}` — a deliberate brace escape
  (`docs/java/pages/phase-12-jvm-production/08-metrics-with-micrometer/03c-counter-versus-gauge.md:185`).
- **Never** convert to a code span inside a `> *"…"*` quote: the quote must stay verbatim.
  `\{` renders as `{`, so the reader sees the source text exactly.
- Named placeholders (`{min}`, `{attr = …}`) are not handled by the script — they are the
  ReferenceError class and need the same `\{ … \}` by hand.

Related: [[devbible-feedback-verify-in-ci-not-locally]] — a green local check is not a deploy; confirm
the "Deploy to GitHub Pages" run with `shared/scripts/ci-log.sh`.
