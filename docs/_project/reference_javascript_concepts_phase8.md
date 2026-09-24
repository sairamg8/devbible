---
name: devbible-javascript-concepts-phase8
description: Load-bearing claims and sources for JavaScript phase 8 — modules, errors, memory and the toolchain
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 8.*

Provenance: **documentation-validated** (rule 8) against MDN. No sandbox.

## Topic 01 · ES modules — 2 chunks (commit `d9329de`)

Source: MDN [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

- MDN: module features *"are imported into the scope of a single script — they aren't
  available in the global scope"*, so **a module's variables are not reachable from the
  devtools console**. Globals are still visible inside a module (one-way).
- 🔴 **Live bindings.** MDN: imports are *"read-only views… you cannot re-assign the variable
  that was imported, but you can still modify properties of object values. The value can only
  be re-assigned by the module exporting it."* **Main behavioural difference from CommonJS
  `require`, which copies at call time** — a require→import translation can change behaviour.
- Default import's **name has no contract** — the importer picks it. Comparison table
  favouring named exports; ⚠️ **MDN states no preference**, so the page marks this as
  judgement, not documentation.
- `export *` does **not** re-export the default.
- Specifier must be a **string literal**, top-level — that staticness is what enables linking
  and tree shaking.
- 🔴 Browser resolves a specifier as a **URL**: no extension guessing (bundlers/Node guess,
  which is why bundled code breaks when served directly), and **bare names need an import
  map**.
- Three load failures that don't look like JS errors: **CORS on `file://`**; **`.mjs` MIME
  type** (MDN: most servers still don't set it); missing extension.
- **Top-level await**: MDN — modules act as *"big asynchronous functions… without blocking
  sibling modules from loading"*. Importers wait **transitively**; siblings don't.
  🔴 **Importers cannot opt out** → initialisation only.

## Topic 02 · Module semantics — 2 chunks (commit `9a00f0f`)

- MDN: *"Modules are only executed once, even if they have been referenced in multiple
  `<script>` tags."* 🔴 **Therefore every module with top-level state is a singleton.**
  Good: a process-wide pool with no DI container. Bad: a never-evicting cache, and **tests
  leaking into each other** (the sole reason module-reset facilities exist).
- 🔴 **Module identity is the resolved URL** — symlinks, case-insensitive filesystems and
  duplicated `node_modules` copies produce **two instances**, with `instanceof` failing
  against a visibly identical class.
- MDN: *"modules use strict mode automatically"* — no opt-out. 🔴 **Top-level `this` is
  `undefined`, not `globalThis`** (the porting trap); implicit globals become `ReferenceError`.
- MDN: *"modules are deferred automatically"* — DOM ready at the top of the file, so the
  `DOMContentLoaded` wrapper is obsolete; and nothing can run during parsing
  (no `document.write`, no FOUC guard).
- 🔴 **Link before evaluate.** Imports are hoisted and evaluated before code written above
  them; a mistyped import is a **load-time SyntaxError**, where CommonJS gives `undefined`
  much later. **Strongest everyday argument for ESM.**
- Depth-first evaluation, dependencies first; a module's own body runs last in its subtree.
- Circular-import `ReferenceError: Cannot access … before initialization` is the ordinary
  two-phase model + TDZ, not a special case.

## Topic 03 · `Error` and its subclasses — 2 chunks (commit `4a4ee90`)

- MDN: **`stack` is "a non-standard property"** → 🔴 never parse it, never assert on it.
  `message`, `name`, `cause` are standard.
- 🔴 **Never branch on `message`** — it is human-facing copy. Note: MDN's own `cause` example
  switches on `err.message`; the page says explicitly that this illustrates the mechanism and
  is not a recommendation.
- Three tests in increasing robustness: `instanceof BuiltIn` → `instanceof YourClass` →
  **`e.code`**, which is the only one that survives a **realm** boundary (iframe/worker/vm),
  where the prototype chain comes from a different global.
- Built-ins tabulated. Worth knowing: **`JSON.parse` throws `SyntaxError` at runtime**;
  `AggregateError` carries `.errors`; `InternalError` is SpiderMonkey-only.
- `cause`: `throw new Error("context", { cause: e })` — the fix for re-throwing while
  discarding the evidence. Accepts any value; pass errors. Walk the chain when reporting.
- 🔴 **A subclass that calls `super(message)` without `options` silently drops every
  `cause`.** MDN: *"Need to pass `options` as the second parameter to install the 'cause'
  property."*
- Throwing a non-`Error` costs stack, name, cause and `instanceof`. Normalise:
  `e instanceof Error ? e : new Error(String(e))`. TS `useUnknownInCatchVariables` enforces it.
- Custom classes: set `name` **as a literal** (`this.constructor.name` minifies to one
  letter); `Error.captureStackTrace` is **V8-only**, hence MDN's `if` guard.
- 🔴 Design: **a few classes carrying a `code` beat a class per failure mode.**
- `Object.setPrototypeOf(this, X.prototype)` is an **ES5-target legacy artefact**, not advice.

## Topic 04 · Leaks you will actually cause — 2 chunks (commit `348018c`) — **PHASE 8 MASTER COMPLETE**

- 🔴 **Definition first:** MDN reduces *"an object is no longer needed"* to *"an object is
  unreachable"*. So a leak is **something still reachable that you stopped needing** — the
  engine never fails to free unreachable memory. One fix only: break the reference.
- MDN: *"Circular references are no longer a problem, since the algorithm only cares about
  reachability."* The folklore comes from reference-counting collectors.
- Closures *"retain their scope"* → a small callback can retain a large graph.
- 🔴 **`Map` keyed by objects holds keys strongly = leak; `WeakMap` keys "can be
  garbage-collected as long as nothing else… is referencing the key".** Weak collections are
  **not iterable and have no `.size`** because iteration would let you *observe garbage
  collection*.
- `WeakRef`/`FinalizationRegistry`: MDN — *"no guarantee of when the callback will be called,
  or if it will be called at all"*, *"solely for optimization"*. Never required cleanup.
- **The four leaks:** detached DOM nodes (retain the whole **subtree**); listeners on
  long-lived targets (🔴 `removeEventListener` needs the **same reference**; prefer
  `{ signal }` + one `abort()`); `setInterval` and **re-arming `setTimeout`** (in Node a
  pending timer keeps the process alive → `unref()`); module-level caches with **no eviction
  policy** (weak keys / bounded LRU / TTL / explicit invalidation).
- Confirming one: two snapshots → **retainer path** (last hop names the variable);
  🔴 **do the flow three times and look for three retained copies**, not a rising total.
