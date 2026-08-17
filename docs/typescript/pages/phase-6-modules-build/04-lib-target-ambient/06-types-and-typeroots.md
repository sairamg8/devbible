---
title: "06 — `types`, `typeRoots`, and the four sources of a global"
sidebar_label: "06 · `types`, `typeRoots` and the four sources"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the `types` and `typeRoots` option records and the
> `TS2580`/`TS2591` message texts in the installed **TypeScript 5.9.3** build,
> and against the **TSConfig reference** for both options. **No sandbox, no
> console blocks.**

`lib` is one of two ways a global enters a program. The other is `@types`
packages, and it has its own pair of options with its own surprising default.

## The default is "include everything you can find"

**Every `@types/*` package the compiler can find is included in the program**,
whether or not any file imports it. `typeRoots` defaults to walking up from the
project directory, treating each `node_modules/@types` folder it meets as a root,
and adding everything inside.

That default explains a behaviour people find spooky:

```bash
npm i -D @types/jest
```

…and now `describe`, `it` and `expect` resolve **everywhere**, including in
`src/` files that are not tests and will be shipped to production. Nobody
imported anything. The package being on disk was enough.

It also means an unrelated dependency can add globals to your program. If
something in your tree depends on `@types/jquery`, `$` becomes a global name in
your application.

## The two options

`typeRoots` — *"Specify multiple folders that act like `./node_modules/@types`."*
Changes **where** the compiler looks.

`types` — *"Specify type package names to be included without being referenced in
a source file."* Changes **which** packages are included.

⚠️ **Their option records differ in a way that matches what they do.** `types`
carries `affectsProgramStructure: true` — it changes the *set of files in the
program*, like `lib` does. `typeRoots` carries `affectsModuleResolution: true`
instead — it changes *where the compiler looks*, which is a resolution concern.
Neither carries `affectsSemanticDiagnostics`, because nothing about how a file is
checked changes; only which declarations exist.

`typeRoots` also carries `allowConfigDirTemplateSubstitution: true`, so
`"typeRoots": ["${configDir}/typings"]` resolves against the directory of the
config that *declares* it rather than the one that extends it — which is what you
want in a monorepo, and the wrong answer without it.

## 🔴 `types` is a replacement, exactly like `lib`

Write it and the automatic inclusion **stops**; only the names you list are
added.

```jsonc
{ "compilerOptions": { "types": ["node"] } }   // @types/jest is now NOT included
```

This is the same shape as chunk 03's `lib` trap, and it catches people the same
way — by punishing the act of being explicit. It is also, in this case, usually
what you want:

- test globals stop leaking into production source
- the program's ambient surface becomes something you **declared**, not something
  `node_modules` happened to contain
- a new transitive `@types` dependency cannot silently add names

The idiomatic arrangement is a narrow root config and a wider test config:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["node"] } }

// tsconfig.test.json
{ "extends": "./tsconfig.json", "compilerOptions": { "types": ["node", "jest"] } }
```

⚠️ **`extends` does not merge arrays.** The child's `types` replaces the
parent's, so `"jest"` alone in the test config would lose `"node"`. Both names
have to be restated — an easy and very common omission.

## The compiler has a diagnostic for the cliff

TypeScript knows that setting `types` is how people lose their Node globals, and
it has a dedicated message for it. The checker picks between two:

| Code | Message |
|---|---|
| `TS2580` | *"Cannot find name '{0}'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node`."* |
| `TS2591` | *"Cannot find name '{0}'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` **and then add 'node' to the types field in your tsconfig**."* |

The condition is exactly `compilerOptions.types` being set. **`TS2591` is the
compiler telling you it noticed you have a `types` array**, and the extra clause
is the whole difference between "install a package" and "you already have the
package, you excluded it".

The same pair exists for jQuery, for test runners and for Bun. Lane D's
[topic 08 · Typing an untyped dependency](../08-typing-an-untyped-dependency/01-reading-the-symptom.md)
works the pattern through from the other direction; chunk 07 here lists the whole
table.

## ⚠️ `types` does not affect imports

```jsonc
{ "compilerOptions": { "types": [] } }
```

```ts
import { readFile } from "node:fs";   // ✅ still works
process.env.PORT;                     // ❌ Cannot find name 'process'
```

The import keeps working because that is **module resolution** finding a `.d.ts`
inside `@types/node`, which has nothing to do with ambient inclusion. `types`
governs only what arrives *without* an import.

This is a genuinely useful lever. `"types": []` plus explicit `node:` imports is
a defensible style for a library that wants no ambient dependencies at all — and
it is the only way to be sure a package does not accidentally rely on a global
its consumers may not have.

## The four sources of a global

| Source | Controlled by | Removable? |
|---|---|---|
| Bundled lib files | `lib`, or its `target`-derived default | yes — narrow `lib` |
| `@types/*` packages | `types` / `typeRoots` / what is installed | yes — set `types` |
| A non-module `.d.ts` in your own program | `include` / `files` | yes — exclude the file |
| `declare global` inside a module in the program | **nothing** | **no** |

The last row is the one with no configuration answer. A module that does
`declare global` contributes its globals because the module is in the program at
all — and it is in the program because you imported it, three files away, for an
unrelated reason. There is no `lib` or `types` setting that excludes it.

That is why a `declare global` in a published library is a genuine imposition on
its consumers, and why the pattern deserves more hesitation than it usually gets.
Phase 4 · 06 argues it from the authoring side, including the rule that `var` is
the only correct spelling inside one.

⚠️ **Row 3 is the one people forget exists.** A stray `types.d.ts` at the root of
your own `src/` with no top-level `import`/`export` is a **script**, not a
module, so everything in it is global. That is sometimes deliberate and often an
accident — the file was written to hold shared interfaces and quietly became part
of the ambient environment.

## A checklist for "where is this name coming from?"

1. **Go to definition.** The file path is the answer, and it is faster than any
   amount of reasoning.
2. A `lib.*.d.ts` next to the compiler → `lib`.
3. Something under `node_modules/@types/…` → `types` / auto-inclusion.
4. A `.d.ts` in your own source tree → check whether it is a module; if it has no
   top-level `import` or `export`, that is why its contents are global.
5. Anywhere else → a `declare global` in a module you import, directly or not.

## Gotchas

**Symptom:** `describe` and `it` resolve in `src/`, not just in tests.
**Cause:** `@types/jest` is auto-included because it is in `node_modules/@types`.
**Fix:** `"types": ["node"]` in the main config; let the test config add
`"jest"`.

**Symptom:** you set `"types": ["node"]` and a package's global augmentation
disappeared.
**Cause:** that package shipped its globals as an auto-included `@types` package,
and `types` is a replacement.
**Fix:** add it to the list. The point of `types` is that the list is
exhaustive.

**Symptom:** the test config sets `"types": ["jest"]` and `process` stopped
resolving.
**Cause:** `extends` replaces the array rather than merging it, so `"node"` was
dropped.
**Fix:** restate both names.

**Symptom:** `Cannot find name 'process'` even though `@types/node` is installed.
**Cause:** either `types` is set and does not list `"node"`, or the package sits
in a `node_modules` outside every `typeRoot` — which happens with pnpm and with
unusual monorepo layouts.
**Fix:** the compiler tells you which. `TS2591` names the `types` field;
`TS2580` does not.

**Symptom:** you set `"types": []` and `import fs from "node:fs"` still works.
**Cause:** correct — `types` governs ambient inclusion, not module resolution.
**Fix:** none; this is the distinction working as designed.

**Symptom:** setting `typeRoots` to a custom folder made *all* `@types` packages
disappear.
**Cause:** `typeRoots` is a replacement too. Listing `["./typings"]` stops
`node_modules/@types` from being a root.
**Fix:** list both: `["./node_modules/@types", "./typings"]`.

**Symptom:** a global appeared after adding a file that only contains interfaces.
**Cause:** the file has no top-level `import` or `export`, so it is a script and
its declarations are global.
**Fix:** add `export {}` if it was meant to be a module — or leave it, if global
was the intent, and say so in a comment.

**Symptom:** the editor sees a global and `tsc` does not.
**Cause:** they are resolving different `tsconfig.json` files, or the editor is
using a project-wide default while the build uses a narrow `types`.
**Fix:** check which config the editor picked before assuming a compiler bug.

## Interview questions

**What is the difference between `lib` and `types`?**
`lib` selects bundled declaration files describing the JavaScript and host
environment. `types` selects `@types/*` packages to include without an import.
Both are **replacements** for their defaults, and both add globals.

**What does `typeRoots` default to?**
Walking up from the project directory, treating each `node_modules/@types` it
finds as a root, and including everything in them.

**Why does installing `@types/jest` change what resolves in `src/`?**
Because auto-inclusion is not scoped to test files. Every `@types` package the
compiler finds becomes part of the program.

**Does `"types": []` break `import fs from "node:fs"`?**
No. That is module resolution, which `types` does not touch. Only globals are
affected.

**What is `TS2591` and what does it tell you that `TS2580` does not?**
Both say `@types/node` may be missing. `TS2591` adds *"and then add 'node' to
the types field in your tsconfig"*, and the checker picks it precisely when
`types` is set — so it is the compiler telling you the package may already be
installed and merely excluded.

**Does `extends` merge `types` arrays?**
No. The child's value replaces the parent's entirely, which is why a test config
that lists only `"jest"` loses `"node"`.

**Which kind of global cannot be removed by configuration?**
One declared with `declare global` inside a module that your program imports.
There is no `lib` or `types` setting that excludes it.

**How does a plain `.d.ts` in your own `src/` end up contributing globals?**
By having no top-level `import` or `export`, which makes it a script rather than
a module. Everything declared at its top level is then in the global scope.

---

← [05 · The ambient environment is not the language](./05-ambient-not-language.md) · Next → [07 · The diagnostics, and why only some of them help](./07-the-diagnostics.md)
