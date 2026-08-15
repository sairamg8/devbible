---
title: "18 · Linting and formatting"
sidebar_label: "18 · Linting and formatting"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the ESLint documentation — [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files), [Rules reference](https://eslint.org/docs/latest/rules/) — and [Prettier vs. Linters](https://prettier.io/docs/en/comparison). Documentation-validated; **no runs, no timings, no console blocks**.

## Two tools, and the line between them is not a matter of taste

Prettier's own documentation draws it, and it is the whole configuration debate settled in one
sentence: **"use Prettier for formatting and linters for catching bugs!"**

Its reasoning is worth reading rather than paraphrasing. On formatting rules, Prettier *"alleviates
the need for this whole category of rules"* — it reprints the program from scratch, so a
formatting mistake is no longer something a programmer can make. On code-quality rules: *"Prettier
does nothing to help with those kind of rules. They are also the most important ones provided by
linters as they are likely to catch real bugs with your code!"*

| | Owns | Argues about |
|---|---|---|
| **Prettier** | where the line breaks, quotes, semicolons, indentation | nothing — it reprints |
| **ESLint** | unused bindings, undefined names, dangerous async, real mistakes | what is a bug |

🔴 **The failure mode when you ignore the line is a lint run full of formatting noise**, in which
the one rule that found a genuine bug scrolls past unread. `eslint-config-prettier` exists for
exactly this: switch off the linter rules that overlap the formatter, and keep the ones that mean
something.

## Flat config: an array, read in order

ESLint's configuration file is `eslint.config.js` (with `.mjs`, `.cjs` and TypeScript variants),
placed in the project root and **exporting an array of configuration objects**.

```js
// eslint.config.js
import js from '@eslint/js';

export default [
  { ignores: ['dist/**', 'coverage/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { fetch: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
    },
  },

  {
    files: ['**/*.test.js'],
    rules: { 'no-unused-expressions': 'off' },
  },
];
```

**The four things worth knowing about that file:**

1. 🔴 **Order decides.** ESLint's documentation: *"When more than one configuration object matches a
   given filename, the configuration objects are merged with later objects overriding previous
   objects when there is a conflict."* Put shared configs first and your overrides last — this is
   why a rule "does not work" for about half the people who report it.
2. **`files` scopes an object; without `files` or `ignores` it applies to whatever the other objects
   match.** Test-only relaxations, Node-only globals and browser-only rules are all just extra
   objects with a `files` glob.
3. **`languageOptions` is how you say what the code *is*** — `ecmaVersion: 'latest'`, `sourceType`
   (`module`, `script` or `commonjs`), the `globals` your environment provides, and a `parser` when
   the syntax is not plain JavaScript.
4. **Severity is `"off"` / `"warn"` / `"error"`** (equivalently `0` / `1` / `2`), and a rule with
   options takes an array: `['error', { …options }]`.

By default, ESLint lints the patterns `**/*.js`, `**/*.cjs` and `**/*.mjs`. Anything else —
TypeScript, JSX — needs its own configuration object: a `files` glob plus the parser and plugin
that understand it.

⚠️ **`warn` is a decision, not a compromise.** A warning that never fails a build accumulates until
nobody reads the output. Use `warn` for things you are actively migrating, `error` for everything
you mean, and let CI fail on errors.

## The handful of rules that actually catch bugs

ESLint groups the ones that find genuine defects under **Possible Problems**, and a short list
earns its keep in any project:

| Rule | The bug it finds |
|---|---|
| **`no-unused-vars`** | the variable you renamed but did not delete, and the import nothing uses |
| **`no-undef`** | a typo'd identifier, or a global you never declared to the linter |
| **`no-dupe-keys`** | a duplicated object key — the second silently wins |
| **`no-fallthrough`** | a `switch` case missing its `break` |
| **`no-constant-condition`** | `if (x = 1)`, and conditions that can only go one way |
| **`no-unsafe-optional-chaining`** | `?.` in a position where `undefined` then explodes |
| **`no-async-promise-executor`** | 🔴 `new Promise(async …)` — the always-a-bug shape from [Phase 7 · 13](../phase-7-async/13-creating-promises/01-the-executor.md) |
| **`require-atomic-updates`** | an assignment that can be clobbered across an `await` or `yield` |
| **`eqeqeq`** | `==` and the coercion table you did not intend to invoke |

🔴 **The async pair is why a linter is worth configuring at all.** `no-async-promise-executor` and
`require-atomic-updates` find mistakes that are invisible in review, non-deterministic at run time,
and expensive to debug — exactly the class of bug this phase and
[Phase 7](../phase-7-async/README.md) spend pages on.

**`--fix` handles the mechanical subset.** ESLint marks which rules are fixable, and running it is
the cheapest way to clear a new rule's backlog. ⚠️ **A fix is a rewrite of your source** — run it on
a clean tree so the diff is reviewable, and re-read what it changed.

## The setup that survives a team

- **One config in the repository**, not in each person's editor. If it is not committed, it is not
  a rule.
- **The formatter runs on save and in a pre-commit hook**; the linter runs in CI on errors. That
  ordering keeps formatting out of code review entirely.
- **Type-aware linting is a separate decision.** Rules that need type information (a floating
  promise, an unnecessary condition) require the type checker to run, which is slower — worth it for
  the async rules, but a deliberate choice rather than a default.
- **A disable comment needs a reason.** `// eslint-disable-next-line no-undef -- injected by the
  build` is documentation; a bare disable is a rule quietly deleted for that line.
- ⛔ **Do not add a rule you are not prepared to fix everywhere.** A rule set to `warn` "for now",
  with two hundred existing violations, teaches everyone that the output is scenery.

## Gotchas

**Symptom: a rule in the config has no effect.**
Cause — a later configuration object overrides it; merging is last-one-wins per file.
Fix — move your overrides after the shared configs and check which objects match that file.

**Symptom: `no-undef` flags a global that genuinely exists.**
Cause — the linter does not know your environment.
Fix — declare it in `languageOptions.globals`, rather than disabling the rule.

**Symptom: ESLint ignores your TypeScript or JSX files.**
Cause — the default patterns are `.js`, `.cjs` and `.mjs`.
Fix — add a configuration object with a `files` glob, the right parser and its plugin.

**Symptom: half the lint output is quotes and semicolons.**
Cause — formatting rules left on alongside a formatter.
Fix — turn the conflicting rules off (`eslint-config-prettier`) and let the formatter own layout.

**Symptom: warnings have grown to the hundreds.**
Cause — `warn` used as a way to postpone a decision.
Fix — either promote the rule to `error` and fix the violations, or turn it off honestly.

**Symptom: `--fix` produced a confusing diff.**
Cause — it rewrote source across the tree in one pass.
Fix — run it on a clean working tree, in its own commit, and review the result.

**Symptom: everyone's editor formats differently.**
Cause — configuration living in editor settings instead of the repository.
Fix — commit the formatter config and run it in a hook; editors follow the repository.

## Interview questions

**★ What is the division of labour between a formatter and a linter?**
Prettier's own answer: formatting for Prettier, bugs for the linter. The formatter reprints the
program so layout is no longer something anyone can get wrong; the linter's valuable rules are the
ones that find real defects.

**★ How does ESLint's flat config resolve conflicts?**
It is an array, and later objects override earlier ones for a file they both match — so shared
configs go first and your overrides last.

**★ What does `languageOptions` do?**
Describes the code to the linter: ECMAScript version, `sourceType`, the globals the environment
provides, and a parser when the syntax is not plain JavaScript.

**★ Which rules would you turn on first in a new project?**
The Possible Problems set — `no-unused-vars`, `no-undef`, `no-dupe-keys`, `no-fallthrough`,
`no-unsafe-optional-chaining` — plus `no-async-promise-executor` and `require-atomic-updates` for
the async mistakes that review does not catch.

**★ Why is `warn` risky?**
Because a warning that never fails anything accumulates, and a noisy output is an unread output.
Use it for active migrations only.

**★ Why turn off formatting rules in the linter?**
They duplicate the formatter and drown the rules that matter. `eslint-config-prettier` exists to
switch exactly those off.

**★ What is the catch with `--fix`?**
It rewrites your source. Run it on a clean tree, in its own commit, and read the diff.

**Where should the config live?**
In the repository, committed. Configuration that lives in an editor is not a rule the team has.

---

← [Phase 8 index](./README.md) · Prev → [17 · Mark-and-sweep and generational GC](./17-gc-mark-sweep-generational.md)
