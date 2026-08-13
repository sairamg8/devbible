---
title: "The Playground and `// @ts-check`"
sidebar_label: "13 · Playground and @ts-check"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0**. Console output
> from `sandbox/ts-p0/ex5-init-and-flags.sh`.

**You can type-check JavaScript without converting it to TypeScript.** One
comment turns the checker on for a single `.js` file, with JSDoc supplying the
types. It is the cheapest possible adoption, and the right answer for scripts,
config files, and codebases nobody has budget to migrate.

## `// @ts-check` in one file

```js
// src-ex5/legacy.js
// @ts-check
/** @param {number} qty */
function total(qty) {
  return qty * 2;
}
console.log(total('three'));
```

```console
$ tsc --noEmit --allowJs --checkJs src-ex5/legacy.js
src-ex5/legacy.js(6,19): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
exit=1

$ node src-ex5/legacy.js
NaN
```

`TS2345` — the same error TypeScript would give — in a plain `.js` file that Node
runs unchanged. And the runtime confirms the bug it caught: `'three' * 2` is
`NaN`, printed happily.

Two ways to switch it on:

| | Scope | Use for |
|---|---|---|
| `// @ts-check` at the top of a file | that file | Adoption one file at a time |
| `"checkJs": true` in `tsconfig.json` | every `.js` in the project | Committed JavaScript checking |

With `checkJs` on project-wide, the inverse comment `// @ts-nocheck` opts a
single stubborn file back out.

## What JSDoc can express

```js
/**
 * @param {string} id
 * @param {{ retries?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ ok: boolean }>}
 */
async function fetchOrder(id, opts) { /* … */ }

/** @typedef {{ id: string, total: number }} Order */

/** @type {Order[]} */
const orders = [];

/** @type {import('./types.js').Cart} */
let cart;
```

`@param`, `@returns`, `@type`, `@typedef`, `@template` for generics, and
`import('./x.js').T` to reuse real types from a `.d.ts` or `.ts` file. Enough for
ordinary application code.

**What it cannot do comfortably:** conditional types, mapped types, complex
generic constraints, `satisfies`. Anything type-level gets unreadable fast — the
point where converting the file to `.ts` is cheaper than the comment block.

## Where this is the right tool

- **Config files** — `eslint.config.js`, `vite.config.js`. One `@ts-check` line
  and a `@type {import('vite').UserConfig}` gives full completion with no build.
- **Small scripts** where a `tsconfig.json` would outweigh the code.
- **A legacy codebase** where migration is not funded — turn on `checkJs` and fix
  what appears, without renaming a single file
  ([Phase 11](../../syllabus/04-rigour-and-tooling.md)).
- **A library published as JavaScript** — JSDoc plus `declaration: true` and
  `allowJs` emits real `.d.ts` files for consumers.

## The Playground

`typescriptlang.org/play` runs the compiler in the browser. Its value is not
learning syntax; it is **isolation**:

- Reproduce an error away from your `tsconfig.json`, your `@types`, and your
  editor's version.
- Toggle a compiler option and watch the same code change verdict.
- Switch TypeScript versions to find which release changed a behaviour — the
  fastest way to answer "did the upgrade do this?".
- Read the emitted JavaScript in the `.JS` tab — the concrete way to see erasure
  ([02](./02-erasure.md)).
- Share a link in a bug report or a code review, where a screenshot cannot be
  run.

**The reflex worth building:** when an error makes no sense, cut it down to ten
lines in the Playground. Either it reproduces — and you have a minimal case — or
it does not, and the cause is your configuration or your editor
([09](./09-language-server-vs-build.md)).

## Trade-off

**JSDoc checking** costs no build step, no rename, no toolchain change, and keeps
files runnable by anything. It costs verbosity, weaker expressiveness at the type
level, and worse ergonomics for anything generic.

**Converting to `.ts`** costs the toolchain and gives the full language.

The honest rule: **if the types are getting hard to write in JSDoc, that file
wants to be TypeScript.**

## Gotchas

**Symptom:** `// @ts-check` does nothing
**Cause:** It must be the first comment block at the top of the file, and the
file must be part of the project (`allowJs`).
**Fix:** Move it to the top; add `"allowJs": true`.

**Symptom:** `checkJs` produced hundreds of errors across the repo
**Cause:** It applies to every `.js` file at once.
**Fix:** Adopt per file with `// @ts-check` instead, or add `// @ts-nocheck` to
the worst offenders and work through them.

**Symptom:** JSDoc types are ignored
**Cause:** Malformed tags — a missing `{}` around the type, or the comment not
attached to the declaration.
**Fix:** `/** @type {string} */` with braces, immediately above the declaration.

**Symptom:** The Playground and your project disagree
**Cause:** Different compiler options and no `@types`.
**Fix:** That *is* the signal — the difference is your configuration. Match the
options one at a time until it reproduces.

**Symptom:** `@ts-ignore` in a `.js` file hides an error you wanted
**Cause:** It suppresses the next line unconditionally.
**Fix:** `@ts-expect-error`, which fails when the error stops occurring
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## Interview questions

**★ Can you type-check JavaScript without converting it to TypeScript?**
Yes — `// @ts-check` at the top of a `.js` file, or `"checkJs": true`
project-wide, with types supplied by JSDoc. It produces the same diagnostics; a
`@param {number}` called with a string reports `TS2345`, while Node still runs
the file unchanged.

**★ When is JSDoc checking preferable to converting the file?**
Config files, small scripts, and legacy code with no migration budget — anywhere
a build step would cost more than the types are worth. Once you need generics,
conditional or mapped types, converting is cheaper.

**Can a JavaScript library ship real type declarations?**
Yes. With `allowJs`, `checkJs` and `declaration: true`, `tsc` emits `.d.ts` files
from JSDoc, so consumers get types while the package stays JavaScript.

**What is the Playground actually useful for?**
Isolation — reproducing an error without your config, toggling one option at a
time, comparing compiler versions to find which release changed a behaviour, and
inspecting the emitted JavaScript. Also the only shareable, runnable form of a
bug report.

---

← Prev: [Release cadence](./12-release-cadence.md) · [Phase 0 index](./README.md) · Next phase → [Phase 1 — The type vocabulary](../../syllabus/01-type-system.md)
