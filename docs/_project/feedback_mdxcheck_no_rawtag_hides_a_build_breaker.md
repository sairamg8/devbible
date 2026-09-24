---
name: devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker
description: 🔴 The project's own documented check is `mdxcheck.py --no-rawtag`, and --no-rawtag is exactly the flag that suppresses the one MDX hazard that fails the deploy — a bare <word> outside backticks. Broke the build 2026-09-06 on a git page.
metadata:
  type: feedback
---

# `--no-rawtag` hides the hazard that actually breaks the build

**What happened, 2026-09-06.** Writing `## Interview questions` into the git track, a
sentence quoted `git status`'s output verbatim:

```markdown
*"You are currently cherry-picking commit <sha>"*
```

MDX parsed `<sha>` as a JSX tag and the Docusaurus build failed:

```text
Error: MDX compilation failed … Expected a closing tag for `<sha>` (197:1-197:6)
before the end of `emphasis`
```

**Why nothing caught it.** Every local gate passed. `yarn linkcheck` — clean. The cap,
tier-badge, `> Verified:` and footer checks — clean. And
`mdxcheck.py --no-rawtag` — **clean**, because `--no-rawtag` is precisely the flag that
turns off raw-tag detection.

🔴 **That flag is what the skill and the house-style checklist both tell you to run.**
`devbible-topic/SKILL.md` and `references/house-style.md` both print
`python3 …/mdxcheck.py --no-rawtag <dir>`. Followed literally, the documented check cannot
see this class.

## The rule

**Run mdxcheck WITHOUT `--no-rawtag` before reporting a file done.** It takes the same
time and it is the only local gate that sees the class:

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py docs/<track>
```

Use `--no-rawtag` only when a legitimate JSX tag in the page is producing a false positive
— and then read every remaining hit rather than the summary line.

## Where it bites

Any place you quote a tool's output verbatim, which is exactly what a good page does:
`<sha>`, `<hash>`, `<branch>`, `<commit>`, `<file>`, `<value>`, `<name>`. Inside a fenced
code block they are safe; inside prose, a table cell or an italic quote they are a tag.
**The fix is backticks, or rewording to drop the placeholder** — never deleting the quote.

⚠️ It is invisible in review too: the sentence reads correctly in the markdown source and
in most editors' preview. Only the MDX compiler objects, and by then it is a red deploy —
and per [[devbible-feedback-verify-in-ci-not-locally]] a failed build **skips** the deploy
rather than failing it, so the site quietly keeps serving the last good version.

Related: [[devbible-feedback-verify-in-ci-not-locally]] · [[devbible-feedback-mdx-backtick-escape-trap]]

## Recurrence 2026-09-10 (python, session 48474032) — `<=` and `<"` inside verbatim quotes

Three python chunks broke the CI build: `c[x] <= d[x]` (collections `03c`), `newitem <= both`
(heapq `01b`), `uses "<" to` (heapq `07`) — all inside `> *"…"*` quotes from the CPython docs/source.
**Neither `mdxcheck.py` nor `--no-rawtag` catches `<=`/`<"`** (the full run flagged only two
harmless `< ` cases). The coordinator's per-file gate had copied `--no-rawtag` from the phase-7
cursor's wiring pass. Fix: `&lt;` (corpus convention, 40 uses vs 2 for `\<`), commit `344258012`.

🔴 **The gate that actually matches CI is a real compile** — from the devbible root:
`node /mnt/Storage/my-learning/claude/shared/scripts/mdx-compile-check.mjs docs/<track>` (reproduced
all three CI errors on the old files, 0 after the fix, 823 python pages). Run it per file before
reporting done; mdxcheck is a fast pre-filter, not the gate.

**Same night, second failure class (fixed `0fb91098b`):** after the `<=` fix the build passed MDX
compile and died at **static generation** — `ReferenceError: name is not defined` — on bare
`{name}`, `{entry_point}`, `{local_bin_dir}`, `{value}`, `{0}`, `{}` inside quoted source error
strings (entry-points `01` `01b` `06` `08`). Fix `\{…\}`. `mdx-compile-check.mjs` **lists every
expression**; any line that is not `{/* … */}` is a bug. Its "N failed" count includes the harmless
`{/* FOOTER */}` comments, so read the lines, not the count. Quoting format strings from source code
(pip, uv, pipx messages) is exactly where both classes come from.
