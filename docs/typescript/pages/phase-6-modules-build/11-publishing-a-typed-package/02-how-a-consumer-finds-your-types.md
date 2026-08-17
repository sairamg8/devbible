---
title: "How a consumer actually finds your types"
sidebar_label: "02 · How a consumer finds your types"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Modules → Reference*
> (the resolution order, extension substitution, and the npm-icon note, quoted
> verbatim) and *Declaration Files → Publishing* (the `types` field and the
> `typings` synonym). The `TS6280`/`TS6278` message text is read from the
> compiler's own diagnostic table in the installed **TypeScript 5.9.3** build.
> **No sandbox, no console blocks.**

Before you can publish types correctly you need to know what the consumer's
compiler actually does when it sees `import x from 'your-package'`. It is a
short, ordered algorithm, and knowing the order explains most of the "it works
for me" reports.

## The order

When resolving a package, TypeScript looks for types in this sequence:

1. 🔴 **`exports`, if present** — and if it is present it is *authoritative*.
   [Chunk 03](./03-exports-and-the-types-condition.md) is entirely about this
   step.
2. **`types`**
3. **`typings`** — the legacy synonym. The handbook: *"The `"typings"` field is
   synonymous with `types`, and could be used as well."*
4. **`main`** — with **extension substitution** applied to find a matching
   declaration file.

The handbook states steps 2–4 as the fallback when *"`exports` are not present
or don't apply"*.

## Extension substitution — the step people forget exists

When TypeScript ends up at a JavaScript path (via `main`, or via a resolved
`exports` target that is not already a TypeScript extension), it does not give
up. It substitutes extensions to look for the declaration file next to it.

So a package with **only** this:

```json
{ "main": "./lib/index.js" }
```

…will still find `./lib/index.d.ts` if it is there. **Which is why a package can
be correctly typed with no `types` field at all**, and why removing the field
sometimes changes nothing and sometimes breaks everything.

📌 **But publish the field anyway**, and the handbook gives a reason that has
nothing to do with resolution:

> *"When publishing to npm, include a `"types"` field even if extension
> substitution or `"exports"` make it unnecessary, because npm displays a
> TypeScript icon only when `"types"` is present in package.json."*

That is a discovery argument, not a correctness one — but it costs one line.

⚠️ **When a `types` condition inside `exports` matches, there is no substitution
at all.** The handbook is explicit: TypeScript *"returns that path directly"*.
So a `types` condition pointing at a file that does not exist is a hard failure,
where a `main` pointing at a `.js` with a sibling `.d.ts` quietly succeeds.

## 🔴 The rule that breaks the most packages

> *"The mere presence of an `"exports"` field prevents resolving any subpaths not
> explicitly listed or matched by patterns in `"exports"`, even if those subpaths
> would have resolved through `"main"` in older configurations."*

Read that as: **adding `exports` to an existing package is a breaking change**
unless you enumerate every subpath consumers were already using.

The failure is silent for you and loud for them. `import helper from
'pkg/lib/helper'` worked for years by walking the directory; the day `exports`
lands, it stops resolving — and it stops resolving *at the type level and the
runtime level together*, which at least makes it consistent.

The mitigation, if you have a wide legacy surface:

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./package.json": "./package.json",
    "./*": { "types": "./dist/*.d.ts", "default": "./dist/*.js" }
  }
}
```

📌 **`"./package.json": "./package.json"` is worth including deliberately.** A
surprising number of tools read a dependency's `package.json` directly, and
`exports` blocks that too.

## What the consumer sees when it goes wrong

Two diagnostics, and they are a diagnosis pair — the difference is **whose
configuration is at fault**:

```text
TS6280: There are types at '{0}', but this result could not be resolved under
        your current 'moduleResolution' setting. Consider updating to 'node16',
        'nodenext', or 'bundler'.
```

> **`TS6280` is the consumer's problem.** Your types exist and are findable; the
> consumer's `moduleResolution` is `node10`, which does not read `exports` at
> all.

```text
TS6278: There are types at '{0}', but this result could not be resolved when
        respecting package.json "exports". The '{1}' library may need to update
        its package.json or typings.
```

> 🔴 **`TS6278` is *your* problem** — and it names you. The consumer is reading
> `exports` correctly and your `exports` map does not lead to the types that are
> sitting right there on disk.

⚠️ **Neither message says which of you should act**, which is why they are worth
recognising by number. If you are a package author and a user sends you a
screenshot, `TS6278` means fix your `exports`; `TS6280` means tell them to update
`moduleResolution`. Phase 7 already meets `TS6278` in the applied setting —
[phase 7 · `target`, `lib` and types](../../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md).

## The `node10` consumer you cannot ignore

`moduleResolution: node10` (the old `node`) ignores `exports` entirely and uses
only `main`/`types`. Plenty of projects are still on it.

So a package that is *only* configured through `exports` is untyped — sometimes
unresolvable — for those consumers. The belt-and-braces shape:

```json
{
  "main": "./dist/index.cjs",
  "types": "./dist/index.d.cts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

The top-level `main`/`types` are **only** read by `node10` consumers; everyone
else uses `exports`. Point them at the CommonJS side, because a `node10` consumer
is by definition on an old configuration that is far more likely to be
`require`-based.

## Gotchas

**Symptom:** Removing the `types` field changed nothing.
**Cause:** Extension substitution found the `.d.ts` next to `main` anyway.
**Fix:** Nothing broken — but keep the field for the npm icon, and know it is not
what was doing the work.

**Symptom:** Adding `exports` broke `import 'pkg/lib/thing'` for every consumer.
**Cause:** The mere presence of `exports` blocks unlisted subpaths.
**Fix:** Enumerate them or add a `"./*"` pattern. Treat adding `exports` as a
major version.

**Symptom:** A tool that reads `require('pkg/package.json')` broke.
**Cause:** Same rule — `exports` blocks it too.
**Fix:** `"./package.json": "./package.json"`.

**Symptom:** `TS6278` from a consumer.
**Cause:** Your `exports` does not lead to your types.
**Fix:** Yours to fix. The types are on disk; the map does not reach them.

**Symptom:** `TS6280` from a consumer.
**Cause:** They are on `node10`, which does not read `exports`.
**Fix:** Theirs to fix — or ship top-level `main`/`types` so they work anyway.

**Symptom:** A `types` condition points at a path that does not exist and the
build fails hard, where a bad `main` used to degrade gracefully.
**Cause:** A matched `types` condition returns directly, with no extension
substitution.
**Fix:** Correct behaviour, and an argument for validating the published tree
rather than trusting the map.

**Symptom:** `typings` is set and `types` is not, and a tool cannot find the
declarations.
**Cause:** They are synonyms to TypeScript, but third-party tooling often only
looks for `types`.
**Fix:** Use `types`. `typings` is legacy.

**Symptom:** The package resolves types in the editor and not in `tsc`.
**Cause:** Different effective `moduleResolution` — the editor may be using a
different project.
**Fix:** `tsc --showConfig` on the consumer side, and `--traceResolution` to see
which field was read.

## Interview questions

**★ In what order does TypeScript look for a package's types?**
`exports` first, if present and applicable; then `types`, then the legacy
`typings`, then `main` with extension substitution to find a sibling declaration
file.

**★ A package has no `types` field and is still typed. How?**
Extension substitution. TypeScript resolves `main` to a `.js` and then looks for
the matching `.d.ts` beside it. The field is still worth publishing — npm only
shows the TypeScript icon when `types` is present.

**★ Why is adding an `exports` field a breaking change?**
Because the mere presence of `exports` blocks every subpath not explicitly listed
or pattern-matched, even ones that previously resolved through `main`. Consumers
importing `pkg/lib/thing` break on the day you add it.

**★ What is the difference between `TS6278` and `TS6280`?**
Both say "there are types at X but they could not be resolved". `TS6280` means
the *consumer's* `moduleResolution` is too old to read `exports`. `TS6278` means
the consumer read `exports` correctly and the *package's* map does not lead to
its types. One is their fix, one is yours, and neither message says so.

**Does a matched `types` condition get extension substitution?**
No — it returns that path directly. So a `types` condition pointing at a
nonexistent file fails outright, unlike a `main` fallback.

**Why ship top-level `main` and `types` when you have a complete `exports` map?**
For `moduleResolution: node10` consumers, who ignore `exports` entirely. Without
them, your package is untyped for that audience.

**Which side should the top-level `types` point at in a dual package?**
The CommonJS declarations. A `node10` consumer is on an old configuration and is
far more likely to be `require`-based.

**What else should almost always be in an `exports` map?**
`"./package.json": "./package.json"` — plenty of tooling reads a dependency's
manifest directly, and `exports` blocks that like any other subpath.

---

← Prev: [01 · The one rule](./01-the-one-rule.md) · Next → [03 · `exports` and the `types` condition](./03-exports-and-the-types-condition.md)
