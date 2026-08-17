---
title: "03 — The default `lib`, and the `.full` files"
sidebar_label: "03 · The default `lib` and the `.full` files"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by reading `getDefaultLibFileName` and `targetToLibMap` in the
> installed **TypeScript 5.9.3** build, and by reading the `/// <reference lib>`
> directives inside every `lib.*.full.d.ts` shipped with it. The source comment
> quoted below is verbatim from `targetToLibMap`. **No sandbox, no console
> blocks.**

This chunk is the reason the topic exists. Almost every "why does `document`
resolve here and not there?" question in TypeScript resolves to one fact, and the
fact is not documented anywhere near as loudly as it deserves.

## There are two families of lib file, and they differ by the DOM

For every ES version, TypeScript ships **two** files:

| File | Contains |
|---|---|
| `lib.es2020.d.ts` | ES2020 and everything below it. **JavaScript only.** |
| `lib.es2020.full.d.ts` | ES2020 **plus the DOM, plus workers, plus Script Host** |

Here is `lib.es2020.full.d.ts` in its entirety, minus the licence header:

```ts
/// <reference no-default-lib="true"/>

/// <reference lib="es2020" />
/// <reference lib="dom" />
/// <reference lib="webworker.importscripts" />
/// <reference lib="scripthost" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
```

Seven lines. One of them is the ES library; the other five are the browser.

## 🔴 The default is the `.full` one

`getDefaultLibFileName` maps `target` to a lib file, and it maps to the `.full`
variant every time:

```js
var targetToLibMap = new Map([
  [ESNext, "lib.esnext.full.d.ts"],
  [ES2024, "lib.es2024.full.d.ts"],
  [ES2023, "lib.es2023.full.d.ts"],
  [ES2022, "lib.es2022.full.d.ts"],
  [ES2021, "lib.es2021.full.d.ts"],
  [ES2020, "lib.es2020.full.d.ts"],
  [ES2019, "lib.es2019.full.d.ts"],
  [ES2018, "lib.es2018.full.d.ts"],
  [ES2017, "lib.es2017.full.d.ts"],
  [ES2016, "lib.es2016.full.d.ts"],
  [ES2015, "lib.es6.d.ts"]
  // We don't use lib.es2015.full.d.ts due to breaking change.
]);
```

Anything not in that map — ES5, and ES3 which is treated as unset — falls to
plain `lib.d.ts`, which is also a full-family file:

```ts
/// <reference lib="es5" />
/// <reference lib="dom" />
/// <reference lib="webworker.importscripts" />
/// <reference lib="scripthost" />
```

**So: if you do not write `lib`, you get the DOM. At every target. Including in a
Node service.** That is why `document.title` type-checks in a project that has
never seen a browser, and why nobody notices until they try to tighten the
config.

## 🔴 And therefore: writing `lib` *removes* things

This is the trap, and it catches people who are doing the right thing.

```jsonc
// before — no lib set. You have ES2022 + DOM + workers + scripthost.
{ "compilerOptions": { "target": "es2022" } }

// after — you wanted Array.prototype.at, so you were explicit.
// You now have ES2022 and NOTHING ELSE. document is gone.
{ "compilerOptions": { "target": "es2022", "lib": ["es2022"] } }
```

`lib` is a **replacement**, not an addition. The value you write is the complete
list. `"es2022"` selects `lib.es2022.d.ts` — the non-`.full` file — and there is
no way to spell "the default, plus this".

The correct spelling for a browser project that wants to be explicit is:

```jsonc
{ "compilerOptions": { "target": "es2022", "lib": ["es2022", "dom", "dom.iterable"] } }
```

⚠️ **Note that this is the same shape as `types` replacing the default `@types`
inclusion** (chunk 05). TypeScript has several options where writing the thing
down turns off a generous default, and both of them are in this topic.

## ES2015 is the odd one out, and the compiler says why

Every other row of `targetToLibMap` points at `lib.esNNNN.full.d.ts`. ES2015
points at **`lib.es6.d.ts`**, with a comment giving the reason:

```js
[ES2015, "lib.es6.d.ts"]
// We don't use lib.es2015.full.d.ts due to breaking change.
```

⚠️ **And `lib.es2015.full.d.ts` is not among the 100 files 5.9.3 ships** — the
comment is a historical note about a file that was withdrawn, not a pointer to
one you could select instead. The consequence is real: `lib.es6.d.ts` pulls in `dom.iterable` but
**not** `dom.asynciterable`, so `for await (const x of someReadableStream)` fails
at `target: "es2015"` in a way it does not at `es2018`.

## The DOM has been arriving in pieces

The `.full` files are not all the same shape. Reading their reference lists in
order shows the browser being added to the default over time:

| Default lib for `target` | `dom` | `dom.iterable` | `dom.asynciterable` |
|---|---|---|---|
| ES5 / unset (`lib.d.ts`) | ✅ | — | — |
| ES2015 (`lib.es6.d.ts`) | ✅ | ✅ | — |
| ES2016, ES2017 | ✅ | ✅ | — |
| **ES2018** and everything above | ✅ | ✅ | ✅ |

Two behaviours drop straight out of that table, and both get reported as
compiler bugs:

- **`for (const el of document.querySelectorAll(…))` fails at `target: "es5"`.**
  `NodeList` only becomes iterable in `lib.dom.iterable.d.ts`, which the ES5
  default does not include.
- **`for await (…)` over a DOM stream fails below `target: "es2018"`**, because
  `dom.asynciterable` joins the default exactly there — which is also where
  async iteration entered the language.

Neither is a bug. Both are the default lib being a different set at different
targets.

## What actually happens when you change `target`

Putting the pieces together, a single-token edit does three separate things:

```jsonc
{ "compilerOptions": { "target": "es2017" } }   →   { "target": "es2022" }
```

1. **Emit changes.** Class fields, `??`, `?.` and `async` stop being
   downlevelled.
2. **The implied `lib` changes** — `lib.es2017.full.d.ts` → `lib.es2022.full.d.ts`
   — so `Array.prototype.at`, `Object.hasOwn` and `Error.cause` start resolving.
3. **The implied `useDefineForClassFields` changes.** It defaults to `true` at
   ES2022 and above, which changes the *semantics* of class field
   initialisation, not just the syntax.

Only the first is what people think they are doing. The second is what they
usually wanted. The third is the one that occasionally breaks a decorator
library, and it is argued in phase 4.

**Set `lib` explicitly and item 2 stops happening.** That is the strongest
argument for writing it down, and the reason the trap above is worth walking
into deliberately rather than by accident.

## Gotchas

**Symptom:** you added `"lib"` and half the codebase lit up with
`Cannot find name 'document'`.
**Cause:** `lib` replaces the default, and the default contained the DOM.
**Fix:** add `"dom"` to the list. This is the single most common way to break a
working config in this topic.

**Symptom:** a Node service type-checks `window.localStorage`.
**Cause:** no `lib` set, so the default is a `.full` file, so the DOM is in
scope. The compiler has no idea the code runs in Node.
**Fix:** `"lib": ["es2023"]` with no `dom` entry. Doing this to an existing Node
project is a genuinely useful audit — everything that breaks was a browser API
in server code.

**Symptom:** `"lib": ["ES2022"]` in one project and `"lib": ["es2022"]` in
another, and you are unsure whether the case matters.
**Cause:** it does not — lib names are matched case-insensitively against
`libMap`. But the *file* it resolves to is `lib.es2022.d.ts` either way, so
neither spelling gets you the DOM.
**Fix:** nothing; but do not read the capitalised form as meaning anything
different.

**Symptom:** `target: "es2015"` behaves differently from every other target for
async iteration.
**Cause:** it alone maps to `lib.es6.d.ts`, which omits `dom.asynciterable`.
**Fix:** raise the target, or add `"dom.asynciterable"` explicitly.

**Symptom:** `ActiveXObject` resolves in your React app.
**Cause:** `scripthost` is in every `.full` file.
**Fix:** none needed, but it is a good demonstration that the default is not
"the sensible set".

**Symptom:** you removed `"lib"` expecting fewer globals and got more.
**Cause:** absence means "derive the `.full` default", not "no libs".
**Fix:** if you genuinely want a minimal environment, list it — and see chunk 04
for `noLib`, which is the real "nothing" and is almost never what you want.

**Symptom:** the same code checks in the editor and fails in CI, or vice versa.
**Cause:** two different `tsconfig.json` files with different `lib` — very
commonly a `tsconfig.json` that sets `lib` and a `tsconfig.build.json` that
extends it and overrides `target` without re-stating `lib`.
**Fix:** `lib` does not re-derive when an extending config changes `target`; the
explicit value wins. Check the resolved config rather than the file you are
looking at.

## Interview questions

**If `tsconfig.json` sets no `lib`, what do you get?**
The `.full` file for your `target` — ES library plus `dom`, `dom.iterable` (at
ES2015+), `dom.asynciterable` (at ES2018+), `webworker.importscripts` and
`scripthost`.

**What is the difference between `lib.es2020.d.ts` and `lib.es2020.full.d.ts`?**
The `.full` one adds the browser. The plain one is JavaScript only. `lib`
selects the plain one; the *default* is the `.full` one.

**Why does `"lib": ["es2022"]` break `document`?**
Because `lib` replaces the default rather than adding to it, and the default was
a `.full` file that included the DOM.

**How do you add to the default `lib` without replacing it?**
You cannot. There is no additive form — you restate the whole set. The nearest
thing is a `/// <reference lib="…" />` directive in a source file, which adds one
lib without touching the config.

**Which target maps to a non-`.full` default, and why?**
ES2015, to `lib.es6.d.ts`, with the source comment *"We don't use
lib.es2015.full.d.ts due to breaking change."* It is the only exception in the
map.

**Name three things that change when you bump `target`.**
The emitted syntax level; the implied `lib`; and the implied
`useDefineForClassFields` (true at ES2022 and above).

**Why does a Node project type-check `window`?**
Because nobody set `lib`, so it inherited the browser. It is one of the more
useful things to fix in an old Node `tsconfig.json`.

**How would you check what a project's resolved `lib` actually is?**
Read `target`, then read whether `lib` is set anywhere in the `extends` chain.
Absence of `lib` at the leaf does not mean absence overall — the value is
inherited, not re-derived.

---

← [02 · What a lib file actually is](./02-what-a-lib-file-is.md) · Next → [04 · Every value `lib` accepts](./04-every-lib-value.md)
