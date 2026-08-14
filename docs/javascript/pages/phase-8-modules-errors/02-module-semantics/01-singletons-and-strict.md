---
title: "02.1 · Singletons and strict mode"
sidebar_label: "01 · Singletons and strict"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode). Documentation-validated.

**Two properties you get without asking, each of which surprises people the first time.**

## A module runs once

MDN:

> "Modules are only executed **once**, even if they have been referenced in multiple
> `<script>` tags."

The same holds for `import`: however many modules import a file, and however many times, its
top-level code runs exactly once. The second and every later import receives the **same**
module instance.

```js
// counter.js
console.log("counter.js evaluating");
export let count = 0;
export function increment() { count++; }
```

```js
// a.js
import { increment } from "./counter.js";
increment();

// b.js
import { count } from "./counter.js";
console.log(count);      // 1 — a.js and b.js share one module
```

`"counter.js evaluating"` is printed once, no matter how many importers there are.

🔴 **Every module with top-level state is a singleton, whether or not you meant it to be.**
That is the load-bearing consequence, and it cuts both ways.

### Where it helps

It is the simplest correct way to share one instance of something:

```js
// db.js
export const pool = createPool(config);     // one pool, process-wide
```

No registry, no dependency-injection container, no "has this been initialised yet" flag. The
module system already guarantees the thing you would have built those for.

### Where it hurts

**Module-level state is global state with a nicer name.**

```js
// cache.js
const cache = new Map();                    // never evicts, never resets
export function get(k) { … }
```

Three consequences worth stating separately:

- **Tests leak into each other.** State set by one test is still there in the next, because
  the module is not re-evaluated between them. Test runners that "reset modules" exist
  specifically to defeat this, and are needed only because of it.
- **A cache with no eviction is a memory leak** — one of the four named in
  [04 · Leaks you will actually cause](../README.md).
- **Two "instances" are impossible** without a factory. If you later need a second
  configured client, a module exporting a ready-made one has to be rewritten.

The defence is a habit rather than a rule: **export a factory when there could ever be two,
and a ready-made instance only when there genuinely cannot be.**

```js
export function createClient(config) { … }  // caller decides how many
export const defaultClient = createClient(defaults);   // convenience, still a singleton
```

### "Once" is per *resolved URL*

The identity of a module is its resolved specifier. Two paths that reach the same file by
different routes can produce **two instances** — a symlinked package, a case-insensitive
filesystem where `./Util.js` and `./util.js` both resolve, a package present at two levels of
`node_modules`. The symptom is bizarre: `instanceof` fails against a class you can see is the
same one, or two copies of a "singleton" disagree.

**When a singleton misbehaves, check whether it is actually two modules.**

## Modules are strict mode, always

MDN:

> "modules use **strict mode automatically**"

There is no `"use strict"` to write and **no way to opt out**. Everything from
[Phase 0 · 04 · Strict mode](../../phase-0-how-javascript-runs/04-strict-mode.md) applies to
every module, and the differences that actually surface are these:

| In a module | Because strict mode… |
|---|---|
| `x = 5` without declaration → `ReferenceError` | forbids implicit globals |
| `this` at the top level is **`undefined`**, not `globalThis` | changes `this` binding |
| assigning to a frozen or read-only property **throws** | makes silent failures loud |
| duplicate parameter names → `SyntaxError` | is stricter at parse time |
| `delete someVariable` → `SyntaxError` | forbids it |
| `with` → `SyntaxError` | forbids it |

🔴 **The `this` one is the practical trap.** Code copied from a classic script that used
top-level `this` as the global object gets `undefined` in a module:

```js
// classic script
this.myLib = {};        // works — `this` is globalThis

// module
this.myLib = {};        // ⚠️ TypeError: Cannot set properties of undefined
```

Use `globalThis` explicitly if that is what you meant — and it usually is not, because a
module has scope and does not need to attach anything to a global.

The implicit-global one is the other frequent surprise, and it is a genuine improvement:

```js
function tally() {
  total = 0;            // ⚠️ ReferenceError in a module; created a global in a classic script
}
```

That typo silently created a global before modules. Now it fails at the point of the mistake.

## Gotchas

**Symptom:** A module's top-level `console.log` prints once despite many importers
**Cause:** MDN: *"Modules are only executed once."* Every importer shares one instance.
**Fix:** Expected — it is what makes `export const pool = …` a working singleton.

**Symptom:** Tests pass individually and fail when run together
**Cause:** Module-level state persists across tests because the module is not re-evaluated.
**Fix:** Reset the state explicitly, or use the runner's module-reset facility. Better, export
a factory.

**Symptom:** A "singleton" appears to exist twice, or `instanceof` fails against the obvious
class
**Cause:** Module identity is the **resolved URL** — a symlink, a case difference, or a
duplicated dependency produced two instances.
**Fix:** Deduplicate the dependency; check for case-mismatched imports.

**Symptom:** `TypeError: Cannot set properties of undefined` for top-level `this`
**Cause:** Modules are strict, so top-level `this` is **`undefined`**, not `globalThis`.
**Fix:** Use `globalThis` if a global is genuinely intended — usually it is not.

**Symptom:** `ReferenceError` for a variable that used to work
**Cause:** Strict mode forbids implicit globals; the assignment was a typo that silently
created one.
**Fix:** Declare it. This is the mistake being caught, not a new one.

**Symptom:** An assignment that used to fail silently now throws
**Cause:** Strict mode makes writes to frozen or read-only properties throw.
**Fix:** Expected, and an improvement.

## Interview questions

**★ How many times does a module's top-level code run?**
Once. MDN: *"Modules are only executed once, even if they have been referenced in multiple
`<script>` tags"* — and the same applies across `import`s. Every importer gets the same
instance.

**★ What follows from that?**
**Every module with top-level state is a singleton.** Useful for a connection pool; dangerous
for a cache that never evicts, and the reason tests leak state into each other. Export a
factory when there could ever be two instances.

**★ Can the same file ever be two modules?**
Yes — module identity is the **resolved URL**. Symlinks, case-insensitive filesystems, and a
duplicated dependency in `node_modules` can all produce two instances, with `instanceof`
failing against a class that is visibly the same.

**★ Do you need `"use strict"` in a module?**
No, and you cannot opt out. MDN: *"modules use strict mode automatically."*

**★ What is `this` at the top level of a module?**
`undefined`, not `globalThis` — a consequence of strict mode, and the trap when porting code
from a classic script that used `this` to reach the global object.

**Name two strict-mode effects you will actually hit.**
Implicit globals become a `ReferenceError` (catching a typo that used to create a global),
and assignments to frozen or read-only properties throw instead of failing silently.

---

[Topic index](./README.md) · Next → [02 · Deferred and hoisted](./02-deferred-and-hoisted.md)
