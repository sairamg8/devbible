---
name: devbible-gap-mdxcheck-compiles-but-does-not-render
description: 🔴 The four ways prose becomes JSX and kills a devbible build — bare `<`, bare `{ident}`, nested backticks, and a backslash-escaped backtick inside a code span (markdown does NOT process escapes there). Fix idiom for all of them is ``double backticks``. Found 2026-09-08 after the Pages deploy had been red 20 hours with mdxcheck AND linkcheck both green, because `compile()` never evaluates. ✅ The specific hole is CLOSED — mdxcheck gained the EXPR class in `aead97785` — but green gates still do not mean a green build.
metadata:
  type: project
---

# 🔴 `mdxcheck` passing is NOT the build passing — it parses, it does not render

**2026-09-08.** The Pages deploy had been RED since **2026-09-07 16:12 UTC** — six consecutive
failed runs, ~20 hours — while `yarn mdxcheck` reported **0 problems** and `yarn linkcheck`
reported **0 problems** on the same tree.

Four defects, in four files, across two lanes (vite and tanstack-query). **Only one of the four
was caught by `mdxcheck`.** The other three compiled cleanly and died later, during SSG.

## The mechanism, which is the whole point

`scripts/mdxcheck.mjs` calls `compile()` from `@mdx-js/mdx`. **`compile()` turns MDX into JSX
source. It never evaluates it.** A `{something}` in prose is *valid MDX* — it is a JSX
expression — so it compiles without complaint. It only fails when Docusaurus's SSG actually
**renders** the component, at which point `something` is a free identifier that resolves to
nothing:

```
Error: Can't render static file for pathname "/devbible/docs/…"
  [cause]: ReferenceError: string is not defined
      at _createMdxContent (build/__server/assets/js/1aad7f2c….js:159:21)
```

The gate's own docstring already says *"It is a fast gate, not a substitute for a release
build."* That sentence is load-bearing and was being read as boilerplate.

## The four shapes, and which gate sees them

| # | Shape | Example that shipped | mdxcheck? |
|---|---|---|---|
| 1 | Bare `<` in prose | `In Node.js <=22, ESM files…` | ✅ **caught** — parse error, `Unexpected character =` |
| 2 | Bare `{ident}` in prose | `` `import.meta.env.BASE_URL`: {string} the base url `` | ⛔ **missed** → `ReferenceError: string` |
| 3 | **Nested** backticks — span closes early | ``(`scope: { id: `todo-${todo.id}` }`)`` | ⛔ **missed** → `ReferenceError: todo` |
| 4 | **Backslash-escaped backtick inside a code span** | ``(`key={\`pending-${i}\`}`)`` | ⛔ **missed** → `ReferenceError: i` |

### Shape 4 is the nastiest and deserves its own sentence

🔴 **Markdown does NOT process backslash escapes inside a code span.** Writing
``` `key={\`pending-${i}\`}` ``` does not produce a code span containing backticks — the span
opens at the first backtick and **closes at the `` \` ``**, because the backslash is a literal
character there, not an escape. Everything after it (`pending-${i}`) lands in prose, and `${i}`
becomes a JSX expression. The author's *intent* was to escape; markdown's answer is that the
escape does not exist in that context.

Shape 3 is the same failure from the other direction, and `mdxcheck`'s docstring **already
documents it** (the ACORN class, run 34034019419). It documents it as a *parse* failure — but
when the leaked content happens to be a valid *expression* rather than a statement, it parses
fine and becomes a render failure instead. **The same typo lands in either gate depending on
what follows it.**

## ✅ The one fix idiom for all of 2, 3 and 4

**Wrap the whole span in DOUBLE backticks. Never backslash-escape a backtick. Never leave a bare
`{` or `<` in prose.**

```
⛔ (`key={\`pending-${i}\`}`)          →  ✅ (``key={`pending-${i}`}``)
⛔ (`scope: { id: `todo-${x}` }`)      →  ✅ (``scope: { id: `todo-${x}` }``)
⛔ BASE_URL: {string} the base url     →  ✅ BASE_URL: `{string}` the base url
⛔ In Node.js <=22, ESM files…         →  ✅ In Node.js `<=22`, ESM files…
```

⛔ **NOT `\{` and NOT `\<`** — those render as a literal backslash. Backticks are also the
established corpus convention: before this incident, the offending `<=` was the **only** raw
`<=` in prose anywhere in `docs/`; every other one already sat in backticks.

## 🔴 Why it stayed invisible for 20 hours

Everything in [[devbible-feedback-verify-in-ci-not-locally]] applies unchanged — `build` fails,
`deploy` is **skipped not failed**, the workflow shows **one X not two**, and the live site keeps
serving the last good version. What this incident adds:

- ⚠️ **The failing runs did not all look alike.** Four of the six exited **1** (a real, reported
  build error). The last two exited **143** — SIGTERM, *no error text at all*, killed ~3m50s in.
  A 143 with an empty log reads as infrastructure/OOM and sends you hunting the wrong thing.
  Measured afterwards: one `docusaurus build` process reaches **9.2 GB RSS** at 6,321 pages, so
  the runner really is near its ceiling — but the *content* defects were the actual blocker.
- ⚠️ **The cheap gates were green, which is worse than them being red.** A red gate stops you.
  A green gate that does not cover the failure class sends you looking at CI infrastructure.

## 🔴 What a session must actually do

1. **A green `mdxcheck` + `linkcheck` is necessary, not sufficient.** Say "the gates pass",
   never "the build passes", unless a build actually ran.
2. **After pushing, LOOK AT THE RUN.** Unchanged from
   [[devbible-feedback-verify-in-ci-not-locally]] — and note that on a shared checkout the run
   you must look at may be *someone else's* commit that included your file.
3. **`gh run view <id> --log` expires.** By the time this was investigated, only the two most
   recent runs still had logs; the four older ones returned nothing and only
   `gh api …/jobs --jq '.jobs[0].steps[]'` still gave the exit codes. **Read the log while the
   run is fresh.**
4. When a build dies with **exit 143 and no output**, do not assume OOM. Reproduce locally —
   a local build prints the MDX/SSG error that CI swallowed. That is the one case where the
   standing "verify in CI, not locally" preference is worth overriding, because a local build
   surfaces **all** failing pages at once where CI surfaces them one round trip at a time.

## ✅ The structural fix — BUILT 2026-09-08, commit `aead97785`

`scripts/mdxcheck.mjs` now goes past `compile()`: it parses to mdast and walks the **estree
already attached** to every `mdxTextExpression` / `mdxFlowExpression` node (no extra dependency —
`createProcessor({format:'mdx'})` attaches it), reporting identifiers the expression **reads but
never defines**. That set is exactly what becomes the `ReferenceError`. Member properties
(`a.b`), object keys and inline-arrow params are excluded, as are the usual globals.

🔴 **The false-positive load was measured BEFORE it was allowed to exit 1** — the bar any gate
here has to clear, after the 122 false positives that got the old linkcheck ignored. Corpus-wide:
**1,717 expression nodes, 1,339 of them `{/* comments */}`, and every one of the remaining 378 a
bare numeric literal (`{0}` ×230, `{1}` ×109, `{2}` ×35) or `{}`. Not one page legitimately
referenced an identifier**, so the check reports 0 on a clean corpus.

Verified both directions: **7,349 files / 0 problems**, and a fixture carrying all four original
shapes reports all four with the right line, column and identifier name, while `{0}`, `{1}`,
`{2}`, `{}` and `{/* comment */}` are correctly ignored.

⚠️ It still does not RENDER, so it remains a fast gate rather than a substitute for a build — it
closes this specific hole, not the general principle in the section above.

See also [[devbible-gap-gates-do-not-validate-frontmatter]] — same family: a gate that passes a
file the build rejects.
