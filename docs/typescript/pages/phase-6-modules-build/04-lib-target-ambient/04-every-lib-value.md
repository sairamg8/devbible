---
title: "04 — Every value `lib` accepts"
sidebar_label: "04 · Every value `lib` accepts"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the `libEntries` table, the `lib`, `noLib` and
> `libReplacement` option records, `getLibraryNameFromLibFileName` and
> `convertJsonOptionOfCustomType` — all read out of the installed **TypeScript
> 5.9.3** build. File existence checked against the 100 `lib.*.d.ts` files
> shipped with it. The `libReplacement` timeline is from the **4.5, 5.8 and 6.0
> release notes**. **No sandbox, no console blocks.**

`lib` takes a list of strings, and the set of legal strings is a hardcoded table
called `libEntries` mapping a name to a file. It is worth having seen the whole
thing once, because the groups in it are the shape of the option.

## Group 1 — the ES versions

```
es5 es6 es2015 es7 es2016 es2017 es2018 es2019
es2020 es2021 es2022 es2023 es2024 esnext
```

`es6` and `es2015` are the same file; so are `es7` and `es2016`. Each of these
selects the **non-`.full`** file, so **none of them includes the DOM** — the
point chunk 03 is built on.

⚠️ **`esnext` is a moving target by design.** `lib.esnext.d.ts` gains entries in
every TypeScript release, so upgrading the compiler can make new APIs resolve
without any config change. That is fine in an app and a liability in a published
library, whose consumers may be on an older runtime.

## Group 2 — the host environments

| Value | What it describes |
|---|---|
| `dom` | the browser — 39,429 lines, the largest lib file |
| `dom.iterable` | makes `NodeList`, `FormData`, `Headers` and friends iterable |
| `dom.asynciterable` | async iteration over DOM streams |
| `webworker` | the worker global scope, **instead of** `dom` |
| `webworker.importscripts` | just `importScripts()` — this one is in every default |
| `webworker.iterable` | worker equivalents of `dom.iterable` |
| `webworker.asynciterable` | worker equivalents of `dom.asynciterable` |
| `scripthost` | Windows Script Host. Also in every default |

🔴 **`webworker` is a replacement for `dom`, not a companion.** Both declare
`self`, `console`, `fetch`, `origin`, `setTimeout` and a long list of other
global names — and for some of them with *different* types. The clearest case is
`self`, which each file declares once:

```ts
// lib.dom.d.ts
declare var self: Window & typeof globalThis;

// lib.webworker.d.ts
declare var self: WorkerGlobalScope & typeof globalThis;
```

Two `declare var` statements for one name with two different types is a
duplicate-identifier error, not a merge. Listing both libs produces a large pile
of them, and the correct spelling for a worker is `"lib": ["es2023", "webworker"]`
with no `dom` at all.

⚠️ There is no `node` value, and there never will be. Node's globals are not
bundled with the compiler — they come from `@types/node`, which is `types`, not
`lib`. Chunk 05.

## Group 3 — the by-feature libs

The long tail: `es2015.core`, `es2015.collection`, `es2015.iterable`,
`es2015.generator`, `es2015.promise`, `es2015.proxy`, `es2015.reflect`,
`es2015.symbol`, `es2015.symbol.wellknown`, `es2016.array.include`,
`es2016.intl`, `es2017.arraybuffer`, `es2017.date`, `es2017.object`,
`es2017.sharedmemory`, `es2017.string`, `es2017.intl`, `es2017.typedarrays`,
`es2018.asyncgenerator`, `es2018.asynciterable`, `es2018.intl`,
`es2018.promise`, `es2018.regexp`, `es2019.array`, `es2019.object`,
`es2019.string`, `es2019.symbol`, `es2019.intl`, `es2020.bigint`, `es2020.date`,
`es2020.promise`, `es2020.sharedmemory`, `es2020.string`,
`es2020.symbol.wellknown`, `es2020.intl`, `es2020.number`, `es2021.promise`,
`es2021.string`, `es2021.weakref`, `es2021.intl`, `es2022.array`,
`es2022.error`, `es2022.intl`, `es2022.object`, `es2022.string`,
`es2022.regexp`, `es2023.array`, `es2023.collection`, `es2023.intl`,
`es2024.arraybuffer`, `es2024.collection`, `es2024.object`, `es2024.promise`,
`es2024.regexp`, `es2024.sharedmemory`, `es2024.string`, and an `esnext.*` set.

**These are how you say "ES2020, plus this one thing from ES2022".** That is the
honest way to model a runtime with a polyfill for exactly one API:

```jsonc
{
  "compilerOptions": {
    "target": "es2019",
    "lib": ["es2019", "es2022.error", "dom"]   // we polyfill Error.cause and nothing else
  }
}
```

Group 4 is two entries — `decorators` and `decorators.legacy` — and you never
need to write either, because `lib.es5.d.ts` already references both.

## 🔴 Three `esnext.*` names appear twice in the table

`libEntries` is a plain array of pairs, and three names are listed in it twice:

| Name | First entry | Later entry | **Wins** |
|---|---|---|---|
| `esnext.array` | `lib.es2023.array.d.ts` | `lib.esnext.array.d.ts` | the later |
| `esnext.string` | `lib.es2022.string.d.ts` | `lib.es2024.string.d.ts` | the later |
| `esnext.promise` | `lib.es2024.promise.d.ts` | `lib.esnext.promise.d.ts` | the later |

The lookup table is built with `new Map(libEntries)`, and a JavaScript `Map`
takes the **last** value for a duplicate key — so the second entry is the live
one in each case. All six files exist on disk, so both entries were valid when
they were written; the earlier rows are stale aliases nobody removed as `esnext`
content graduated into numbered versions.

The visible consequence is small but real: the list of legal names is built with
`libEntries.map(entry => entry[0])`, which keeps duplicates, so those three names
appear **twice** in `tsc`'s own help output and in editor completion for `lib`.

## Values are matched case-insensitively

`convertJsonOptionOfCustomType` lowercases the value before the lookup:

```js
const key = value.toLowerCase();
const val = opt.type.get(key);
```

So `"ES2022"`, `"es2022"` and `"Es2022"` are the same option. Do not read a
capitalised entry in someone's config as meaning anything different — and do not
expect `"ES2022"` to get you the DOM either.

## `libReplacement` — overriding a lib file with a package

Before falling back to the bundled file, the compiler looks for an **npm package**
that replaces it. The naming is derived mechanically:

```js
function getLibraryNameFromLibFileName(libFileName) {
  const components = libFileName.split(".");
  let path = components[1];
  let i = 2;
  while (components[i] && components[i] !== "d") {
    path += (i === 2 ? "/" : "-") + components[i];
    i++;
  }
  return "@typescript/lib-" + path;
}
```

The first separator is a `/` and every one after it is a `-`, which produces a
package plus subpath:

| Lib file | Package specifier looked up |
|---|---|
| `lib.dom.d.ts` | `@typescript/lib-dom` |
| `lib.dom.iterable.d.ts` | `@typescript/lib-dom/iterable` |
| `lib.es2015.symbol.wellknown.d.ts` | `@typescript/lib-es2015/symbol-wellknown` |

This is the mechanism behind `@types/web` — install it and alias it to
`@typescript/lib-dom`, and you get DOM types on a release cadence independent of
your TypeScript version.

🔴 **The mechanism and the flag arrived seven releases apart, and the default has
since flipped.** This is one to check against your own compiler version rather
than remember:

| Version | State |
|---|---|
| **4.5** | the `@typescript/lib-*` lookup is introduced, always on, with no way to disable it |
| **5.8** | `--libReplacement` is added so it can be turned off; the release notes warn *"In the future `--libReplacement false` may become the default"* |
| **5.9.3** | the option record still reads `defaultValueDescription: true` — the lookup runs in every project |
| **6.0** | the default flips to **`false`**, on the reasoning that it does nothing until you configure something and costs a lookup regardless |

⚠️ So on 5.9.3 the lookup happens whether or not anyone asked for it, and on 6.0
and later it does not. Setting `"libReplacement": false` short-circuits it —
the compiler goes straight to `combinePaths(defaultLibraryPath, libFileName)` and
does no module resolution for libs at all. The cost it saves is not only the
lookup: the compiler also has to **watch `node_modules`** in case a replacement
package appears.

It is also the thing to turn *on* explicitly if you depend on the behaviour and
are moving to 6.0 or later, and the thing to turn *off* if a stray
`@typescript/lib-*` package in the tree is silently replacing your DOM types.

## `noLib` — the real "nothing", and why you do not want it

```jsonc
{ "compilerOptions": { "noLib": true } }
```

*"Disable including any library files, including the default lib.d.ts."*

This is not "a smaller `lib`". It removes the declarations for `Object`,
`Array`, `Function`, `String` and `Boolean` — types the checker itself depends
on — so you get a wall of `Cannot find global type` errors before it reaches any
of your code.

It exists for people building a non-JavaScript-target environment who supply
their own complete set of global declarations. If you are reading this to decide
whether to use it, the answer is no; you want a narrower `lib`.

## Gotchas

**Symptom:** `"lib": ["es2023", "dom", "webworker"]` produces hundreds of
duplicate-identifier errors.
**Cause:** `dom` and `webworker` both declare the shared global surface, with
differing types.
**Fix:** pick one. A worker gets `webworker`; a page gets `dom`. A codebase with
both needs two `tsconfig.json` files over two file sets.

**Symptom:** `"lib": ["node"]` is rejected.
**Cause:** there is no such lib value. Node's globals are a `@types` package.
**Fix:** `"types": ["node"]`, or just have `@types/node` installed. Chunk 05.

**Symptom:** you added `"esnext.array"` and got fewer methods than expected, or
more.
**Cause:** it is one of the three duplicated keys — the live mapping is
`lib.esnext.array.d.ts`, not the `lib.es2023.array.d.ts` that appears first in
the table.
**Fix:** name the version explicitly (`"es2023.array"`) when you mean a
particular one. `esnext.*` names move.

**Symptom:** `"lib": ["esnext"]` and a colleague on the same branch sees
different APIs.
**Cause:** different TypeScript versions. `lib.esnext.d.ts` grows every release.
**Fix:** pin the compiler version, and prefer a numbered lib in anything you
publish.

**Symptom:** DOM types changed after an unrelated `npm install`.
**Cause:** something pulled in an `@typescript/lib-dom` (or an alias to
`@types/web`), and `libReplacement` is on by default.
**Fix:** find the package; if it was not deliberate, remove it or set
`"libReplacement": false`.

**Symptom:** `noLib` produced `Cannot find global type 'Array'`.
**Cause:** working as designed — you removed the file that declares it.
**Fix:** do not use `noLib`. Narrow `lib` instead.

**Symptom:** adding a single by-feature lib did not bring its dependencies.
**Cause:** by-feature files are leaves; they reference nothing. `es2018.asynciterable`
gives you `AsyncIterable` and assumes `Symbol.asyncIterator` is already declared.
**Fix:** keep a version lib as the base and add by-feature libs on top of it,
never instead of it.

## Interview questions

**What does `lib` accept?**
Names from a fixed table: ES versions, host environments (`dom`, `webworker`
and their sub-libs, `scripthost`), and a long list of by-feature entries.
Case-insensitive.

**Is `dom` plus `webworker` valid?**
No. They are alternatives — both declare the shared globals, so listing both
produces duplicate-identifier errors.

**Why is there no `"node"` lib?**
Node's globals are not part of the language and are not bundled with the
compiler. They ship as `@types/node`, which is a `types` concern.

**When would you use a by-feature lib?**
When the runtime genuinely has one API from a later version — usually a
polyfill. `["es2019", "es2022.error"]` says exactly that and nothing more.

**What is `libReplacement`?**
The flag controlling a lookup for an npm package named `@typescript/lib-<name>`
that overrides a bundled lib file — the mechanism behind `@types/web` supplying
DOM types independently of the compiler version. The lookup dates from 4.5, the
flag from 5.8 (default `true`), and 6.0 flips the default to `false`.

**What does `noLib` do, and when is it right?**
Removes every lib file including `lib.d.ts`, so even `Array` and `Object` are
undeclared. It is right only when you supply a complete replacement set
yourself. It is not a way to get a smaller environment.

**Why does `esnext.array` appear twice in `tsc --help`?**
Because `libEntries` contains it twice and the name list is built by mapping over
that array. The *lookup* map is built with `new Map`, so the later entry wins;
the help list just never deduplicates.

---

← [03 · The default `lib` and the `.full` files](./03-the-default-lib.md) · Next → [05 · The ambient environment is not the language](./05-ambient-not-language.md)
