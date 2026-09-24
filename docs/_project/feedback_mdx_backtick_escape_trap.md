---
name: feedback-mdx-backtick-escape-trap
description: An escaped backtick inside a single-backtick code span does NOT escape — it closes the span, unbalances the line and hands the rest to the MDX parser as JSX. Broke the Actions build 2026-08-19.
metadata:
  type: feedback
---

# 🔴 `\`` inside a code span is not an escape — it ends the span

**Found 2026-08-19**, when the GitHub Actions build failed. The link warnings in the log
were a red herring (`onBrokenLinks: 'warn'` — they never fail a build). The single
`[ERROR]` was an SSG crash:

```
Can't render static file for pathname ".../jest-rtl/pages/jest-core-concepts/test-structure"
ReferenceError: amount is not defined
```

**The line that did it** (`docs/jest-rtl/pages/01-jest-core-concepts/01-test-structure.md`):

```markdown
Tagged template literals (`test.each\`amount | expected\``) inject an object
parameter (`({ amount, expected })`), improving readability.
```

**Why it breaks.** Inside a code span a backslash is an ordinary character with no
escaping power — CommonMark is explicit about this. So `` `test.each\` `` opens and
**closes** at the second backtick. Every backtick after it is re-paired against the wrong
partner, the rest of the line falls **outside** any code span, and MDX then reads
`{ amount, expected }` as a **JSX expression** — evaluating an undefined `amount` at
static-render time.

⚠️ **It builds and lints fine locally as Markdown.** Only MDX's JSX pass turns it into a
crash, and only at SSG — so it fails in CI, late, with a stack trace pointing at a bundled
`.js` file rather than the page.

## The fix — a double-backtick span holds literal backticks

```markdown
(``test.each`amount | expected` ``)
```

A span opened with ` `` ` runs to the next ` `` `. When the content starts or ends with a
backtick, pad it with one space — the padding is stripped on render. **Never reach for a
backslash.** The correct form was already in the corpus at
`docs/javascript/pages/phase-5-built-in-library/08-template-literals/01-interpolation-and-multiline.md:89`
— *"a backtick needs `` \` ``"* — written the right way.

## The family this belongs to

Same root cause as the pipe trap recorded in
`shared/session_build_devserver_registry.md` (2026-08-17): **anything that terminates a
code span early unbalances the backticks for the rest of the line, and the next `{`, `<`
or `|` is then parsed as syntax.** Two known members:

| Written | Ends the span early because | Write instead |
|---|---|---|
| `` `a \` b` `` | backslash does not escape in a span | ``` ``a `b` `` ``` |
| `` `x \|\| y` `` in a table | `\|` still splits a GFM cell | escape as `\|` |

**Grep that actually finds it** — plain `\\\`` is far too loose (it matches every benign
`` `\` `` span, 16 files in devbible, all fine). The hazard is a backslash-backtick with
**more backticks after it on the same line**:

```bash
grep -rn '`[^`]*\\`[^`]*`' docs --include=*.md
```

**Verify a suspect page without a build** — cheap, no registry claim needed (rule 12):

```bash
node -e 'const{compile}=require("@mdx-js/mdx");const fs=require("fs");
compile(fs.readFileSync(process.argv[1]),{format:"md"})
  .then(()=>console.log("clean")).catch(e=>{console.log("FAIL:",e.message);process.exit(1)})' <file>
```

That is the check that proved the fix. Related: [[feedback-never-compress-to-fit-cap]].
