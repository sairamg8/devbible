---
title: "Global augmentation"
sidebar_label: "06 · Global augmentation"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 3.4 release notes** (*Type-checking
> for `globalThis`*) — the `abc`/`answer` examples, the `let`/`const` note, the
> error text and the downlevel caveat are **quoted verbatim** — and the
> **handbook** (*Declaration Merging → Global augmentation*). Error codes and
> their exact `{0}`-templated text are read out of the **compiler's own
> diagnostic table** (⚠️ install inspected: TypeScript **6.0.3**, not the 7.0.2
> this corpus targets). **No console block** — no sandbox run covers this phase.

Most of the mechanism is already behind you.
[Topic 01 chunk 02](./01-module-augmentation/02-augmenting-a-package.md) covered
`declare global` and the `Express.Request` case;
[chunk 03](./01-module-augmentation/03-why-it-did-not-load.md) covered `TS2669`,
`TS2670` and the script-versus-module rule;
[topic 05 chunk 02](./05-interface-declaration-merging/02-the-accidents.md)
covered how a non-module `.d.ts` merges globals across package boundaries.

**This topic is the global object itself** — `globalThis`, why declaring a global
*variable* has a rule nobody expects, and when reaching for a global is simply
the wrong answer.

## `globalThis` is the portable handle

Before it existed you wrote `window` in a browser, `global` in Node, `self` in a
worker, and something defensive in a library. TypeScript 3.4 added type-checking
for the standard replacement:

> TypeScript 3.4 introduces support for type-checking ECMAScript's new
> `globalThis` - a global variable that, well, refers to the global scope. Unlike
> the above solutions, `globalThis` provides a standard way for accessing the
> global scope which can be used across different environments.

```ts
// in a global file:
var abc = 100;

// Refers to 'abc' from above.
globalThis.abc = 200;
```

Note what makes that work: `abc` was declared in a **global file** — a script,
not a module — so it really is a global.

## 🔴 `var` becomes a global property. `let` and `const` do not

This is the rule that catches everyone, and it is JavaScript's, not TypeScript's:

> Note that global variables declared with `let` and `const` don't show up on
> `globalThis`.

```ts
let answer = 42;

// error! Property 'answer' does not exist on 'typeof globalThis'.
globalThis.answer = 333333;
```

`var` and `function` declarations at the top level of a script create properties
on the global object. `let` and `const` create bindings in a *declarative
environment* that sits alongside it — visible to code, absent from `globalThis`.

**The consequence for declaration files is direct:**

```ts
// src/types/global.d.ts
declare global {
  var __APP_VERSION__: string;    // ✅ var — appears on globalThis
}

export {};
```

```ts
declare global {
  const __APP_VERSION__: string;  // ❌ declares a binding, not a global property
}
```

⚠️ **`var` here is not a style regression, and your linter will disagree.**
`no-var` is a sensible default rule that is simply wrong in this one position —
a `declare global` variable declaration is the only correct spelling. Add an
eslint-disable comment with a note saying why, or the next person will "fix" it
and quietly break `globalThis.__APP_VERSION__`.

## Two ways to type a browser global

In a DOM environment the global object's type is `Window`, and the DOM library
declares it as an **interface** — so the merging rules from
[topic 05](./05-interface-declaration-merging/README.md) apply directly:

```ts
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: () => unknown;
  }
}

export {};
```

That types `window.__REDUX_DEVTOOLS_EXTENSION__`. Augmenting `Window` and
declaring a `var` are **not the same thing**, and picking the wrong one is a
common half-hour:

| You write | You get |
|---|---|
| `interface Window { x: T }` | `window.x` and `globalThis.x` — browser only |
| `var x: T` | a bare `x`, plus `globalThis.x` — works in any environment |

**Prefer the `var` form for anything that is not genuinely browser-specific.** A
`Window` augmentation is a compile error in a Node build that does not include
the DOM lib, and shared code pays for that.

Node's globals work the same way through `declare global { var … }`, which is why
the `var` form is the portable one — and it is also how `process.env` gets typed,
via the `NodeJS.ProcessEnv` interface discussed in
[topic 01 chunk 02](./01-module-augmentation/02-augmenting-a-package.md).

## The three requirements, restated

Because this is where the time goes, and all three are covered in topic 01:

1. **The file must be a module.** No top-level `import`/`export` means it is a
   script, `declare global` is invalid, and you get
   `TS2669: Augmentations for the global scope can only be directly nested in
   external modules or ambient module declarations.` Add `export {};`.
2. **The file must be in the program.** `npx tsc --listFiles | grep global.d.ts`
   — no line, no augmentation, and **no error either**.
3. **`declare` is required** outside an already-ambient context —
   `TS2670: Augmentations for the global scope should have 'declare' modifier
   unless they appear in already ambient context.`

## The downlevel caveat

> It's also important to note that TypeScript doesn't transform references to
> `globalThis` when compiling to older versions of ECMAScript. As such, unless
> you're targeting evergreen browsers (which already support `globalThis`), you
> may want to use an appropriate polyfill instead.

Worth knowing because it breaks the usual expectation. TypeScript downlevels a
great deal of syntax; `globalThis` is a **runtime identifier**, not syntax, so
there is nothing to rewrite. Type-checking it does not make it exist.

## When a global is the wrong answer

Typing a global is easy, which is why it gets used for things that should not be
global at all. The declaration is a *description*, and describing something does
not make it a good idea.

- **Configuration.** A global `__CONFIG__` types cleanly and cannot be
  substituted in a test, mocked per case, or tracked by "find all references".
  An exported module constant can.
- **A cache or a singleton.** Global state that survives module reloading is a
  common source of test pollution — the second test sees the first one's
  leftovers.
- **Anything whose absence should be an error.** Same trap as `process.env` in
  [topic 01](./01-module-augmentation/02-augmenting-a-package.md): you have told
  the compiler a value exists, not made it exist. If a build-time define is
  missing, the type says `string` and the runtime says `undefined`.

**The legitimate cases are narrow and real:** genuine platform globals the
environment provides, build-time defines injected by a bundler, a browser
extension hook you do not control, and test-harness globals. All of them share
one property — **something outside your module graph really does put the value
there.**

## Trade-off

**A global augmentation** describes what actually exists in the environment,
needs no import at any use site, and is the only option for values you do not
place yourself. It costs discoverability — nothing points at the declaration —
and it silently converts a missing value into an `undefined` the types deny.

**A module export** is traceable, mockable and impossible to get wrong: if it is
missing, the import fails. It costs an import line, and it is unavailable for
anything the platform or a bundler supplies.

The line worth holding: **augment a global only when something outside your code
genuinely puts the value there.** If your own code assigns it, export it instead.

## Gotchas

**Symptom:** `Property 'x' does not exist on type 'typeof globalThis'`
**Cause:** The declaration used `let` or `const`, which do not create global
object properties.
**Fix:** `declare global { var x: T }`. This is the one place `no-var` is wrong.

**Symptom:** A linter or a well-meaning colleague changed `var` to `const` in a
`.d.ts` and `globalThis.x` broke
**Cause:** The same rule, applied backwards.
**Fix:** Restore `var` and leave a comment saying why.

**Symptom:** `TS2669: Augmentations for the global scope can only be directly
nested in external modules…`
**Cause:** The file has no top-level import or export, so it is a script.
**Fix:** `export {};`.

**Symptom:** The augmentation compiles and the property still does not exist
**Cause:** The file is not in the program — and a missing augmentation is never
an error.
**Fix:** `npx tsc --listFiles | grep <file>`, then fix `include`.

**Symptom:** `window.x` types fine locally and fails in the Node build
**Cause:** A `Window` augmentation in code shared between browser and server; the
Node build has no DOM lib.
**Fix:** Declare a `var` instead — it is environment-independent.

**Symptom:** `globalThis` is `undefined` at runtime on an older target
**Cause:** TypeScript does not transform `globalThis` when downlevelling.
**Fix:** A polyfill. Type-checking it does not create it.

**Symptom:** A build-time define is typed `string` and is `undefined` in one
environment
**Cause:** The declaration asserted it exists; nothing verified the bundler
injected it.
**Fix:** Type it as possibly-absent, or assert its presence at startup where the
failure is loud.

## Interview questions

**★ How do you add a typed global variable?**
`declare global { var x: T }` in a file that is a module — so it needs
`export {};` if it has no other import or export — and that file has to be in the
compiler's `include`. It must be `var`: `let` and `const` do not create
properties on the global object, so `globalThis.x` would not type-check.

**★ Why `var` and not `const`?**
Because it is JavaScript's rule, not TypeScript's. `var` and `function`
declarations at the top level of a script become properties of the global object;
`let` and `const` create bindings in a separate declarative environment. The
release notes put it plainly — *"global variables declared with `let` and `const`
don't show up on `globalThis`"* — and the error is *"Property 'answer' does not
exist on 'typeof globalThis'."*

**★ `interface Window` or `declare global { var }`?**
`Window` types `window.x` and only exists where the DOM lib is loaded, so it
breaks a Node build of shared code. A `var` declaration works in any environment
and gives you both the bare name and `globalThis.x`. Prefer `var` unless the
thing really is browser-specific.

**Does typing a global make it exist?**
No — that is the trap. The declaration is a description. If a bundler define is
missing, the type says `string` and the runtime says `undefined`, exactly like an
over-confident `process.env` augmentation. And `globalThis` itself is not
downlevelled, so on an old target you need a polyfill regardless of the types.

**When should you not use a global?**
When your own code puts the value there. Globals cannot be mocked per test,
cannot be traced by "find all references", and leak state between tests. Export a
module constant instead. Reserve augmentation for platform globals, bundler
defines, extension hooks and test harnesses — things something outside your
module graph genuinely provides.

---

← Prev: [05 · Interface declaration merging](./05-interface-declaration-merging/README.md) · Next → **07 · Branded / nominal types** *(not written yet)*
