---
title: "07 — The diagnostics, and why only some of them help"
sidebar_label: "07 · The diagnostics, and why only some help"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by reading `getCannotFindNameDiagnosticForName`,
> `onFailedToResolveSymbol`, `getSuggestedLibForNonExistentName`,
> `getScriptTargetFeatures` and `containerSeemsToBeEmptyDomElement` in the
> installed **TypeScript 5.9.3** build, and by quoting every message below
> verbatim from that build's diagnostic table. **No sandbox, no console blocks.**

There is something odd about environment errors, and once you notice it you
cannot stop noticing it:

```ts
document.title;        // Cannot find name 'document'. Do you need to change your
                       // target library? Try changing the 'lib' compiler option
                       // to include 'dom'.

structuredClone(o);    // Cannot find name 'structuredClone'.
```

Same cause. Same fix. One error tells you what to do and the other says nothing.

That is not a heuristic having a bad day. It is a **hardcoded list**, and knowing
it is on the list — or not — changes how much you should trust the message.

## 🔴 The advice comes from a `switch` on the identifier's text

`getCannotFindNameDiagnosticForName` takes the name you wrote and picks a
message from a literal switch. Here is every case it has:

| Name(s) | Message you get |
|---|---|
| `document`, `console` | **TS2584** — *"…Try changing the 'lib' compiler option to include 'dom'."* |
| `$` | **TS2581 / TS2592** — install `@types/jquery` |
| `describe`, `suite`, `it`, `test` | **TS2582 / TS2593** — install `@types/jest` or `@types/mocha` |
| `process`, `require`, `Buffer`, `module` | **TS2580 / TS2591** — install `@types/node` |
| `Bun` | install `@types/bun` |
| `Map`, `Set`, `Promise`, `Symbol`, `WeakMap`, `WeakSet`, `Iterator`, `AsyncIterator`, `SharedArrayBuffer`, `Atomics`, `AsyncIterable`, `AsyncIterableIterator`, `AsyncGenerator`, `AsyncGeneratorFunction`, `BigInt`, `Reflect`, `BigInt64Array`, `BigUint64Array` | **TS2583** — *"…Try changing the 'lib' compiler option to '{1}' or later."* |
| `await`, in call position | *"Did you mean to write this in an async function?"* |
| **everything else** | **TS2304** — *"Cannot find name '{0}'."* and nothing more |

**Twenty-seven names.** That is the complete set of identifiers TypeScript has an
opinion about.

`structuredClone` is not on it. Neither is `fetch`, `setTimeout`, `URL`,
`crypto`, `queueMicrotask`, `AbortController`, `TextEncoder`, `window` or
`localStorage`. All of them are fixed by exactly the same edit as `document`, and
none of them says so.

🔴 **The practical consequence is backwards from what you would expect: the
easiest environment problems produce the most helpful errors, and the ones that
actually confuse people produce the least.** Nobody is stuck on `document`. People
are stuck on `structuredClone` — and that is the one the compiler is silent
about.

Carry the list instead. When you see a bare `Cannot find name 'X'` and `X` looks
like a platform API, the question is always the same one: *which environment
declares this, and is that environment in my program?*

## Where `{1}` comes from

The switch chooses the message; a second function fills in the version:

```js
function getSuggestedLibForNonExistentName(name) {
  const typeFeatures = getScriptTargetFeatures().get(diagnosticName(name));
  return typeFeatures && firstIterator(typeFeatures.keys());
}
```

`getScriptTargetFeatures()` is a hand-written table with **48 top-level entries**,
each mapping a global's name to the ES versions that added things to it:

```js
Array: new Map(Object.entries({
  es2015: ["find", "findIndex", "fill", "copyWithin", "entries", "keys", "values"],
  es2016: ["includes"],
  es2019: ["flat", "flatMap"],
  es2022: ["at"],
  es2023: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"],
})),
```

`firstIterator(...keys())` takes the **first** key, which is the version that
introduced the type itself. All eighteen names in the TS2583 row of the table
above are present, and these are the versions they resolve to:

| Suggested lib | Names |
|---|---|
| `es2015` | `Map`, `Set`, `Promise`, `Symbol`, `WeakMap`, `WeakSet`, `Iterator`, `AsyncIterator`, `Reflect` |
| `es2017` | `SharedArrayBuffer`, `Atomics` |
| `es2018` | `AsyncIterable`, `AsyncIterableIterator`, `AsyncGenerator`, `AsyncGeneratorFunction` |
| `es2020` | `BigInt`, `BigInt64Array`, `BigUint64Array` |

⚠️ **Two hand-maintained lists have to agree** for any of this to work — the
switch and the feature table. They do agree in 5.9.3, which is worth knowing
mostly because it explains why the advice is narrow: every entry is somebody's
deliberate decision, so the set grows slowly and lags the platform badly.

## The same machinery, for properties

Missing *members* get the identical treatment through
`getSuggestedLibForNonExistentProperty`, and here the feature table earns its
keep, because the version differs per method:

**TS2550** — *"Property '{0}' does not exist on type '{1}'. Do you need to change
your target library? Try changing the 'lib' compiler option to '{2}' or later."*

```ts
[3, 1, 2].toSorted();
// Property 'toSorted' does not exist on type 'number[]'.
// Do you need to change your target library?
// Try changing the 'lib' compiler option to 'es2023' or later.
```

That `'es2023'` is read straight out of the `Array` entry above. When the property
is not in the table you get the bare **TS2339** instead — *"Property '{0}' does
not exist on type '{1}'."* — and you are back to working it out yourself.

## 🔴 The DOM has one heuristic that is not a list

`containerSeemsToBeEmptyDomElement` is the exception, and it is a nice piece of
inference:

```js
function containerSeemsToBeEmptyDomElement(containingType) {
  return compilerOptions.lib && !compilerOptions.lib.includes("lib.dom.d.ts")
    && everyContainedType(containingType, (type) =>
         type.symbol && /^(?:EventTarget|Node|(?:HTML[a-zA-Z]*)?Element)$/
           .test(unescapeLeadingUnderscores(type.symbol.escapedName)))
    && isEmptyObjectType(containingType);
}
```

Three conditions, and each is doing real work:

1. **`lib` was set explicitly** and does **not** contain `lib.dom.d.ts`.
2. The type you are reaching into is named `EventTarget`, `Node`, `Element`, or
   anything matching `HTML*Element`.
3. That type is **empty** — it has no members at all.

An `HTMLInputElement` with no members means somebody declared the name without
the DOM lib behind it. So instead of TS2339 you get:

**TS2812** — *"Property '{0}' does not exist on type '{1}'. Try changing the 'lib'
compiler option to include 'dom'."*

This is the one place the compiler reasons about your environment rather than
consulting a list, and it exists precisely because chunk 03's trap — writing
`lib` and losing the DOM — is common enough to deserve it.

## The rest of the environment diagnostics

Worth recognising on sight, because each names a *different* option as the fix:

| Code | Message | The fix is |
|---|---|---|
| **TS2585** | *"'{0}' only refers to a type, but is being used as a value here. Do you need to change your target library? Try changing the 'lib' compiler option to es2015 or later."* | `lib` — you have the *type* `Symbol` but not the *value* |
| **TS2705** | *"An async function or method in ES5 requires the 'Promise' constructor. Make sure you have a declaration for the 'Promise' constructor or include 'ES2015' in your '--lib' option."* | `lib` **or** a polyfill declaration |
| **TS2802** | *"Type '{0}' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher."* | `target` **or** `downlevelIteration` — a rare error naming two |
| **TS2791** | *"Exponentiation cannot be performed on 'bigint' values unless the 'target' option is set to 'es2016' or later."* | `target`, not `lib` |
| **TS1056** | *"Accessors are only available when targeting ECMAScript 5 and higher."* | `target` |
| **TS2318** | *"Cannot find global type '{0}'."* | your libs are **broken or absent** |
| **TS2468** | *"Cannot find global value '{0}'."* | same |

🔴 **TS2318 and TS2468 are in a different category from all the others.** Every
other code on this page means "your environment does not have this API". These
two mean **the compiler cannot find a type it needs to do its own job** — a type
like `Array`, `Object`, `Function` or `Promise` that the checker itself is built
on.

You get them from `noLib: true`, from a `lib` so narrow it is unusable, or from a
`libReplacement` package that resolved and turned out to be wrong. A wall of
TS2318 is not a code problem; it is a broken program.

## How to read any of these in one pass

Three questions, in order, and the answer to the third is the fix:

1. **Is the name JavaScript?** If it is specified by ECMAScript, `lib` can supply
   it. If it is a platform API — `fetch`, `process`, `document` — `lib` can only
   supply it when the platform is one TypeScript bundles (`dom`, `webworker`).
   Otherwise you need a `@types` package.
2. **Is it a syntax error or a name error?** `target` errors (TS1056, TS2791,
   TS2802) are about what the *emitter* can produce. `lib` errors (TS2583,
   TS2584, TS2550, TS2585) are about what the *checker* can see. Do not fix one
   with the other.
3. **Does the message name a version?** If it does, that number came from the
   feature table and is trustworthy. If it does not, the compiler has no opinion
   and neither should you until you have looked.

## Gotchas

**Symptom:** `Cannot find name 'structuredClone'` with no advice, while
`Cannot find name 'document'` on the next line tells you exactly what to do.
**Cause:** `document` is in the hardcoded switch; `structuredClone` is not.
**Fix:** treat the absence of advice as carrying no information. It does not mean
the name is more obscure or the fix more complicated.

**Symptom:** TS2583 suggested `'es2015'` and you set `"lib": ["es2015"]`, losing
the DOM.
**Cause:** the suggestion is about one name, not about your project. It has no
idea what else you depend on.
**Fix:** add the version to your existing list rather than replacing it.

**Symptom:** `Property 'toSorted' does not exist` with no version suggestion.
**Cause:** you are calling it on something that is not `Array` — a `ReadonlyArray`
alias, a branded type, a union — so the lookup keyed on the container's name
missed.
**Fix:** the version is still ES2023. The table is keyed by type name, so the
advice is fragile in a way the underlying fact is not.

**Symptom:** TS2812 — *"Try changing the 'lib' compiler option to include 'dom'"*
— on a type you declared yourself.
**Cause:** you named a type `Element` or `HTMLThingElement`, left it empty, and
set `lib` without `dom`. All three of the heuristic's conditions are met.
**Fix:** rename your type. The heuristic is right about the shape and wrong about
the cause.

**Symptom:** hundreds of `Cannot find global type 'Array'`.
**Cause:** `noLib`, or a `lib` value that resolved to nothing.
**Fix:** this is TS2318, not a normal environment error. Check `noLib` and check
for a stray `@typescript/lib-*` package before reading any of the other errors.

**Symptom:** `--downlevelIteration` fixed a spread over a `Map`, and you are not
sure why.
**Cause:** TS2802 names two fixes because there genuinely are two. Raising
`target` makes the syntax legal; `downlevelIteration` emits a correct-but-larger
iteration protocol at the old target.
**Fix:** raise `target` if the runtime allows it. `downlevelIteration` costs
output size on every iteration site in the program.

**Symptom:** TS2705 in a project that has `Promise` at runtime via a polyfill.
**Cause:** the polyfill is not declared. The message anticipates this — *"Make
sure you have a declaration for the 'Promise' constructor"* is the first half of
its advice, before `--lib`.
**Fix:** include the polyfill's types, or add `es2015.promise` to `lib`, which is
the honest statement that the API exists.

**Symptom:** the advice changed after you added a `types` array, with no other
edit.
**Cause:** four of the messages have a `types`-aware variant — `TS2580`→`TS2591`
for node, and the same pairing for jQuery, test runners and Bun.
**Fix:** none; read the longer message, which is the more useful one.

## Interview questions

**Why does `Cannot find name 'document'` include advice and
`Cannot find name 'structuredClone'` not?**
Because the advice comes from a hardcoded switch on the identifier text with 27
names in it. `document` is on it and `structuredClone` is not, despite having
the same fix.

**Where does the version in *"Try changing the 'lib' compiler option to 'es2023'
or later"* come from?**
From `getScriptTargetFeatures`, a 48-entry hand-written table mapping a global's
name to the ES versions that added members to it. The suggestion is the first
key of the entry.

**Is that suggestion reliable?**
The version is, when it appears. The *absence* of one is not evidence of
anything, and the suggestion is about a single name rather than about your
project — following it literally can drop the DOM.

**What is TS2812?**
*"Property '{0}' does not exist on type '{1}'. Try changing the 'lib' compiler
option to include 'dom'."* — issued when `lib` is set without `lib.dom.d.ts` and
you touch an **empty** type named `Element`, `Node`, `EventTarget` or `HTML*Element`.
It is the one genuine heuristic among the list-driven messages.

**How do TS2318 and TS2583 differ?**
TS2583 means your program lacks an API you asked for. TS2318 means the compiler
cannot find a type it needs to function — typically from `noLib` or a broken lib
resolution. One is a missing feature; the other is a broken program.

**Which errors are fixed by `target` rather than `lib`?**
TS1056 (accessors), TS2791 (bigint exponentiation) and TS2802 (iteration, which
also accepts `downlevelIteration`). These are about emit; the `lib` errors are
about checking.

**Why does TS2802 name two different flags?**
Because both work. `target: es2015` makes the iteration syntax legal directly;
`downlevelIteration` emits a full iteration protocol at an older target, at a
cost in output size everywhere it is used.

**What does the `types`-aware variant of an error tell you?**
That `compilerOptions.types` is set — the checker picks the longer message
precisely on that condition. So `TS2591` rather than `TS2580` hints the package
may already be installed and merely excluded from the program.

---

← [06 · `types`, `typeRoots` and the four sources](./06-types-and-typeroots.md) · Next → [08 · Choosing](./08-choosing.md)
