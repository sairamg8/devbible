---
title: "02 — What a lib file actually is"
sidebar_label: "02 · What a lib file actually is"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **reading the declaration files shipped with TypeScript
> 5.9.3** in `sandbox/ts-p0/node_modules/typescript5/lib/` — file counts, line
> counts and every `/// <reference lib="…" />` directive quoted below come from
> those files, not from prose. **No sandbox, no console blocks.**

People picture `lib` as "the standard library", singular, and picture it as
something the compiler has built in. Neither is true, and the shape of the real
thing explains several behaviours that otherwise look arbitrary.

## There are a hundred of them, and they are ordinary `.d.ts` files

TypeScript 5.9.3 ships **100 files matching `lib.*.d.ts`** alongside the
compiler. They are not compiled into `tsc`; they sit on disk next to it, and the
compiler reads them like any other declaration file.

You can open them. That is worth doing once, because it settles arguments
permanently: if you want to know whether `Array.prototype.at` is in ES2022, do
not search a blog — look in `lib.es2022.array.d.ts`.

## Most of them contain nothing but references

Here is the entirety of `lib.es2015.d.ts`, minus the licence header — 28 lines,
and not one declaration:

```ts
/// <reference no-default-lib="true"/>

/// <reference lib="es5" />
/// <reference lib="es2015.core" />
/// <reference lib="es2015.collection" />
/// <reference lib="es2015.iterable" />
/// <reference lib="es2015.generator" />
/// <reference lib="es2015.promise" />
/// <reference lib="es2015.proxy" />
/// <reference lib="es2015.reflect" />
/// <reference lib="es2015.symbol" />
/// <reference lib="es2015.symbol.wellknown" />
```

`lib.es2015.d.ts` is an **index**. It declares nothing; it pulls in ten other
files, one of which is `lib.es5.d.ts`, which is where the actual declarations
start.

That is the shape of the whole system:

| File | Lines | What is in it |
|---|---|---|
| `lib.es5.d.ts` | **4,601** | the real thing — `Object`, `Array`, `String`, `Function`, `JSON`, `Math`, `RegExp`, and the utility types |
| `lib.dom.d.ts` | **39,429** | every DOM interface, and by a wide margin the biggest file |
| `lib.webworker.d.ts` | **13,150** | the worker global scope |
| `lib.scripthost.d.ts` | 322 | Windows Script Host. Yes, really, and it is in your default program |
| `lib.es2015.d.ts` | 28 | references only |
| `lib.es2020.d.ts` | 27 | references only |
| `lib.d.ts` | 22 | references only |

**The version files are cumulative by reference, not by copying.** `lib.es2020.d.ts`
references `lib.es2019.d.ts`, which references `lib.es2018.d.ts`, and so on down
to `lib.es5.d.ts`. Ask for ES2020 and you get everything from ES5 up.

## `/// <reference lib="…" />` is the mechanism

The lib graph is built out of a triple-slash directive, and it is a directive
**you can use too**. This is not a private compiler feature:

```ts
// in any .ts or .d.ts file of yours
/// <reference lib="es2018.asynciterable" />
```

That pulls exactly one lib file into the program. It is occasionally the right
tool — a `.d.ts` that declares an async iterator can guarantee its own
prerequisite instead of documenting a `tsconfig` requirement in a README.

⚠️ **It only ever adds.** There is no directive that removes a lib, so a
reference in a dependency's `.d.ts` can put the DOM into your Node program and
there is nothing local you can write to take it back out.

## `no-default-lib="true"` is the other half

Every lib file starts with:

```ts
/// <reference no-default-lib="true"/>
```

That marks the file as *being* a default library, which stops the compiler from
loading the default library into it — otherwise every lib file would recursively
pull in the whole default environment while trying to define it.

It is also the reason `lib.d.ts` and `lib.es2020.full.d.ts` can be 22 and 24
lines and still describe an entire runtime.

## `lib.es5.d.ts` quietly references the decorator types

One entry in the table above is worth its own line, because it explains a
question people ask about decorators:

```ts
// lib.es5.d.ts
/// <reference no-default-lib="true"/>
/// <reference lib="decorators" />
/// <reference lib="decorators.legacy" />
```

`ClassDecoratorContext`, `ClassMethodDecoratorContext` and the rest come in with
**ES5**. There is no ES version below which they disappear, and you never need to
add `"decorators"` to `lib` by hand. Phase 4 · 13 argues the two decorator
systems; this is why the *types* for both are always present regardless of
`target`.

## What this buys you, practically

Three things follow directly from the file layout, and all three are things you
can do today:

1. **Answer "which ES version added this?" by looking**, not by guessing.
   `grep -l 'toSorted' lib.*.d.ts` names the file, and the file name is the
   answer.
2. **Read the actual signature** when a type error about a built-in makes no
   sense. `Array.prototype.flat`'s recursive depth type is genuinely surprising,
   and reading it is faster than reasoning about it.
3. **Know that "the standard library" is a *choice your config made*.** Nothing
   about it is fixed by the language.

## Gotchas

**Symptom:** `lib.scripthost.d.ts` is in your program and you have never touched
Windows Script Host.
**Cause:** it is referenced by every `.full` default lib, including the one you
get by default. See chunk 03.
**Fix:** nothing to fix — it declares a handful of names like `ActiveXObject`.
It is noise, not a problem. But it does mean `ActiveXObject` resolves in your
React app.

**Symptom:** you added `/// <reference lib="dom" />` to a `.d.ts` to fix an
error, and now a colleague's Node service sees DOM globals.
**Cause:** lib references are program-wide and additive. A reference in a file
that ships affects every consumer.
**Fix:** put the reference in a file that is not part of the published surface,
or state the `lib` requirement in the package's documentation instead.

**Symptom:** `"lib": ["es2015"]` and `Array.prototype.includes` is missing.
**Cause:** `includes` is ES2016 (`lib.es2016.array.include.d.ts`). The
cumulative chain runs upward from what you asked for, never above it.
**Fix:** ask for the version that contains it, or add the by-feature lib alone.

**Symptom:** a type error mentions a name you cannot find in any of your files.
**Cause:** it is declared in a lib file. Every built-in type in the error message
has a definition on disk you can open.
**Fix:** search the lib directory before assuming the error is nonsense.

**Symptom:** deleting `"lib"` from `tsconfig.json` changed which APIs resolve.
**Cause:** absence is not "no libs" — it is the *derived* default, which is
usually larger than what you had written. Chunk 03.
**Fix:** `noLib` is the option for "no libs", and you almost certainly do not
want it. Chunk 04.

## Interview questions

**How many lib files ship with TypeScript?**
One hundred in 5.9.3. The number matters less than the fact that it is plural —
`lib` selects among files on disk, it does not toggle a built-in.

**What is in `lib.es2015.d.ts`?**
Twenty-eight lines of `/// <reference lib="…" />` and nothing else. The
declarations live in `lib.es5.d.ts` and the nine `es2015.*` by-feature files.

**Which lib file is the biggest?**
`lib.dom.d.ts`, at 39,429 lines — about eight and a half times `lib.es5.d.ts`.
That is worth knowing when you are wondering why a browser project's check is
slower than a Node one.

**What does `/// <reference no-default-lib="true"/>` do?**
Marks the file as a default library, so the compiler does not load the default
library into it. Every shipped lib file starts with it.

**Can you reference a lib from your own file?**
Yes — `/// <reference lib="es2018.asynciterable" />` works anywhere. It only
adds; there is no way to remove a lib with a directive.

**Where do the decorator context types come from?**
`lib.es5.d.ts` references `decorators` and `decorators.legacy`, so they are
present at every target. You never add them to `lib` yourself.

**How would you settle "does ES2023 have `toSorted`?"**
Look for the declaration: it is in `lib.es2023.array.d.ts`. The file name is the
answer, and it is stronger evidence than any documentation page.

---

← [01 · Two different jobs](./01-two-different-jobs.md) · Next → [03 · The default `lib`, and the `.full` files](./03-the-default-lib.md)
