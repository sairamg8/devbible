---
title: "05 · What \"JavaScript\" means today"
sidebar_label: "05 · ECMAScript and TC39"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6.233.17).
> Script: `sandbox/js-p0/ex9-feature-era.mjs`.

**"Is this ES6?" is the wrong question.** It has been the wrong question since
about 2016. The right one is *"does the runtime I ship to have this feature?"* —
and those are not the same, because a runtime ships individual features as they
are finished, not editions.

## The names

| Name | What it means |
|---|---|
| **ECMAScript** | The standard. The actual specification document, **ECMA-262**. |
| **JavaScript** | The language everyone means when they say it. Historically a Netscape trademark, now Oracle's — which is why the standard has a different name. |
| **ES6 / ES2015** | The same edition. ES6 was its name during development; the committee switched to year-based naming with it. |
| **TC39** | The committee inside Ecma International that maintains the spec. |

The 2015 edition was so large (classes, `let`/`const`, arrow functions, modules,
promises, `Map`/`Set`, template literals, destructuring) that "ES6" became
shorthand for "modern JavaScript". That shorthand is now nine editions out of
date and actively misleading — `async`/`await` is ES2017, optional chaining is
ES2020, and neither is "ES6".

## Why editions stopped mattering

Since ES2016 the committee has shipped **one small edition every June**,
containing whatever reached Stage 4 by roughly the previous March. An edition is
a snapshot of what was already finished — not a coordinated release.

Engines do not implement editions. They implement **individual proposals**, and
ship each one when it is ready. By the time an edition is published, its
contents have usually been in Chrome, Firefox and Safari for a year.

So "supported in ES2022" tells you nothing useful about whether you can ship it.
"Supported in Safari 16.4+" does.

## The stage process

| Stage | Name | What it means for you |
|---|---|---|
| **0** | Strawperson | An idea. Ignore. |
| **1** | Proposal | Worth solving. Shape will change. Ignore. |
| **2** | Draft | Syntax roughly settled. Still ignore. |
| **2.7** | — | Spec text complete, awaiting implementation feedback. |
| **3** | Candidate | **Engines start shipping it.** Usable behind a flag or a transpiler; can still change. |
| **4** | Finished | Two shipping implementations, tests pass. **In the next edition.** Safe. |

The line that matters is **Stage 3**. That is where a feature becomes real, where
Babel plugins appear, and where the risk lives — Stage 3 proposals have changed
after engines shipped them, and decorators changed so drastically that early
adopters had to rewrite.

**Rule:** ship Stage 4 freely. Ship Stage 3 only with a transpiler and an
awareness that you may have to migrate. Never build on Stage 2 or below.

## Measured: what Node 24 actually has

```js
// sandbox/js-p0/ex9-feature-era.mjs (abridged)
const feats = {
  'ES2020 optional chaining': () => ({a:{b:1}})?.a?.b === 1,
  'ES2022 #private + static block': () => {
    class A { #p = 1; static { this.s = 2; } get() { return this.#p; } }
    return new A().get() === 1 && A.s === 2;
  },
  'ES2024 Promise.withResolvers': () => typeof Promise.withResolvers === 'function',
  'ES2025 Set methods (union)': () => typeof new Set().union === 'function',
  'Stage-3 Temporal': () => typeof Temporal !== 'undefined',
};
for (const [name, test] of Object.entries(feats)) {
  let ok; try { ok = !!test(); } catch { ok = false; }
  console.log((ok ? '  yes ' : '  NO  ') + name);
}
```

```
  yes ES2015 class/let/Map
  yes ES2017 async/await
  yes ES2019 flat/flatMap
  yes ES2020 optional chaining
  yes ES2020 ??
  yes ES2020 BigInt
  yes ES2020 globalThis
  yes ES2021 replaceAll
  yes ES2021 ||= &&= ??=
  yes ES2022 at()
  yes ES2022 Object.hasOwn
  yes ES2022 #private + static block
  yes ES2022 Error cause
  yes ES2022 top-level await
  yes ES2023 toSorted/toReversed/with
  yes ES2023 findLast
  yes ES2024 groupBy
  yes ES2024 Promise.withResolvers
  yes ES2025 Set methods (union)
  yes ES2025 Iterator helpers
  yes ES2025 RegExp.escape
  NO  Stage-3 Temporal
  NO  Stage-3 decorators
```

**Everything through ES2025 is present; both Stage-3 proposals are absent.** That
is the stage line drawn in a single run — and it is why `Temporal` is tiered
<span className="db-tier t-know">Know</span> in this syllabus rather than being
taught as the replacement for `Date`. It is coming, and you cannot ship it on
this runtime today.

## The features worth knowing by edition

Not to memorise the years — to recognise how new something is when you read it
in a codebase.

| Edition | The ones you actually use |
|---|---|
| **ES2015** | `let`/`const`, arrow functions, classes, modules, promises, `Map`/`Set`, template literals, destructuring, spread, default params |
| **ES2016** | `**`, `Array.includes` |
| **ES2017** | **`async`/`await`**, `Object.entries`/`values`, `padStart`/`padEnd` |
| **ES2018** | object spread/rest, async iteration, `Promise.finally`, regex named groups and lookbehind |
| **ES2019** | `flat`, `flatMap`, `Object.fromEntries`, `trimStart`/`trimEnd`, optional `catch` binding |
| **ES2020** | **optional chaining `?.`**, **`??`**, `BigInt`, `Promise.allSettled`, `globalThis`, dynamic `import()`, `matchAll` |
| **ES2021** | `replaceAll`, `Promise.any`, `&&=`/`\|\|=`/`??=`, `WeakRef` |
| **ES2022** | `#private` fields, class static blocks, `at()`, `Object.hasOwn`, **top-level `await`**, `Error` `cause` |
| **ES2023** | `findLast`, `toSorted`/`toReversed`/`toSpliced`/`with`, hashbang |
| **ES2024** | `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, `Array.fromAsync`, `/v` regex flag |
| **ES2025** | **Set methods** (`union`, `intersection`, `difference`), **iterator helpers**, `RegExp.escape`, `Promise.try`, import attributes |

The ES2023 non-mutating array methods and the ES2025 set methods are the two
groups most likely to remove a utility dependency from your project.

## What to actually check before using a feature

1. **Your runtime floor**, not the edition. For a Node service: the Node version
   in your Dockerfile. For a browser app: your `browserslist`, which comes from
   your real analytics, not a guess.
2. **caniuse.com / MDN's browser-compat table** for browser APIs, and
   **node.green** for Node.
3. **Whether your build step covers it.** Syntax can be transpiled; *methods*
   need a polyfill. `?.` compiles down fine. `Object.groupBy` does not — it
   either exists or it does not. [09 · Transpilation and
   polyfills](./09-transpilation-polyfills.md) is the whole distinction.

## Gotchas

**Symptom:** a feature works locally and throws `SyntaxError` in CI or on an
older device.
**Cause:** your local runtime is newer than the deploy target. Syntax errors
happen at parse time, so the file fails entirely.
**Fix:** set `engines` in `package.json`, pin the runtime in CI, and make
`browserslist` reflect production. Never test compatibility against your laptop.

**Symptom:** `X is not a function` only on iOS.
**Cause:** JavaScriptCore ships proposals on its own schedule; a method landed
in V8 first.
**Fix:** check the compat table for the *method*, and polyfill that one method.
Do not disable the whole feature for everyone.

**Symptom:** a Stage-3 feature broke after a tooling upgrade.
**Cause:** Stage 3 can still change. Decorators are the canonical case — the
proposal was redesigned and early syntax stopped working.
**Fix:** treat Stage 3 as provisional. If you must use it, isolate it so a
migration touches few files.

**Symptom:** someone calls modern code "ES6" and the conversation goes nowhere.
**Cause:** "ES6" is being used to mean "not ES5", which is nine editions of
imprecision.
**Fix:** name the feature and the runtime floor. "Optional chaining, which needs
Safari 13.4+" is a statement someone can act on.

## Interview questions

**★ What is the difference between JavaScript and ECMAScript?**
ECMAScript is the specification (ECMA-262), maintained by TC39; JavaScript is
the language that implements it. The names differ mostly for trademark reasons.
In practice, "JavaScript" also implies the host APIs around the language, which
ECMAScript does not define at all.

**★ Is ES6 still a useful term?**
Not really. It means ES2015, which is nine editions old. Since ES2016 the
committee ships a small edition every June and engines implement individual
proposals as they finish, so an edition number tells you almost nothing about
whether you can ship a feature. The runtime floor is the useful question.

**★ What are the TC39 stages, and which one matters?**
Stage 0 through 4: idea, proposal, draft, candidate, finished. **Stage 3** is the
one to watch — engines begin shipping it and it becomes usable, but it can still
change. Stage 4 means two shipping implementations and passing tests, so it is
safe. Anything below Stage 3 should not be in production code.

**How do you decide whether you can use a language feature?**
Check the *runtime floor* — the oldest Node version or the `browserslist` derived
from real traffic — against a compat table for that specific feature. Then check
whether your build handles it: syntax can be transpiled, but new methods need a
polyfill, and some things (like `Proxy`) can be neither.

**Why is `Temporal` not the recommended date API yet?**
Because it is Stage 3 and not present in the runtime — measured absent on Node
24.19.0. It is the right long-term answer and the wrong thing to ship today.

---

← [04 · Strict mode](./04-strict-mode.md) · [Phase index](./) · Next: [06 · The hosts you write for](./06-hosts-and-globals.md) →
