---
title: "Vite finds HMR boundaries by looking for the literal text `import.meta.hot.accept(` — the call is whitespace-sensitive because it is static analysis, and `invalidate` without `accept` silently ends the module's updates"
sidebar_label: "Self-accepting Modules"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [HMR API](https://vite.dev/guide/api-hmr) (`hot.accept(cb)`, `hot.accept(deps, cb)`, `hot.dispose`, `hot.prune`, `hot.data`, `hot.decline`, `hot.invalidate`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Self-accepting Modules

A plugin that sends [custom events](01od-hmr-custom-events.md) usually also injects client code that
has to *accept* an update rather than trigger a reload. That machinery has three surprises: the call
is matched as text, the boundary does not propagate upward, and the two "I cannot handle this"
methods behave completely differently. The lifecycle callbacks around a boundary —
`dispose`, `prune`, `data` and `invalidate` — are
[HMR Module Lifecycle](01odd-hmr-module-lifecycle.md), and typing the event payloads is
[Typing Custom Events](01oe-typing-custom-events.md).

---

## 1. Under-The-Hood Mechanics

### 🔴 The `accept` call is matched as source text

> *"Vite requires that the call to this function appears as `import.meta.hot.accept(`
> (whitespace-sensitive) in the source code in order for the module to accept update. This is a
> requirement of the static analysis that Vite does to enable HMR support for a module."*

That rules out every indirection that looks harmless:

```js
const hot = import.meta.hot;
hot?.accept(cb);                       // ⛔ the literal text never appears
const accept = import.meta.hot.accept;
accept(cb);                            // ⛔ same
import.meta.hot . accept(cb);          // ⛔ whitespace-sensitive
import.meta.hot.accept(cb);            // ✅
```

For a plugin that *generates* client code this is a hard constraint on the template: the emitted
string must contain that exact sequence, so a minifier or formatter in the generation path can break
HMR without breaking anything else.

### What "self-accepting" means, and where it stops

> *"For a module to self-accept, use `import.meta.hot.accept` with a callback which receives the
> updated module"*

> *"A module that "accepts" hot updates is considered an **HMR boundary**."*

> *"Vite's HMR does not actually swap the originally imported module: if an HMR boundary module
> re-exports imports from a dep, then it is responsible for updating those re-exports (and these
> exports must be using `let`). In addition, importers up the chain from the boundary module will
> not be notified of the change. This simplified HMR implementation is sufficient for most dev use
> cases, while allowing us to skip the expensive work of generating proxy modules."*

Two consequences worth stating plainly. Re-exports are **your** responsibility inside a boundary, and
they must be `let` so you can reassign them. And importers above the boundary are not told anything,
so state derived from the module in a parent is stale until something else updates it.

The callback's argument can be absent:

> *"newModule is undefined when SyntaxError happened"*

### Accepting a dependency instead of yourself

> *"A module can also accept updates from direct dependencies without reloading itself"*

```js
import.meta.hot.accept('./foo.js', (newFoo) => {
  newFoo?.foo()
})

import.meta.hot.accept(
  ['./foo.js', './bar.js'],
  ([newFooModule, newBarModule]) => {
    // The callback receives an array where only the updated module is
    // non null. If the update was not successful (syntax error for ex.),
    // the array is empty
  },
)
```

⚠️ In the array form only the updated entry is non-null, **and on a failed update the array is
empty** — so destructuring positionally without a guard throws on exactly the case you added the
callback to handle.

### `decline` is not the way to opt out

> *"This is currently a noop and is there for backward compatibility. This could change in the future
> if there is a new usage for it. To indicate that the module is not hot-updatable, use
> `hot.invalidate()`."*

A call to `decline()` compiles, runs, and does nothing at all. `invalidate` is the documented way to
say a module cannot handle an update — and it has its own precondition, below.

⚠️ *"you should always call `import.meta.hot.accept` even if you plan to call `invalidate`
immediately afterwards, or else the HMR client won't listen for future changes to the self-accepting
module."* The full lifecycle around a boundary is
[HMR Module Lifecycle](01odd-hmr-module-lifecycle.md).

---

## 2. Real-World Engineering Scenario

**A plugin whose generated HMR code stopped working after a formatting change.**

A plugin emitted a client shim from `load()`, built with a template literal. Someone added a
prettier pass over the generated string to make the dev-tools output readable, and it reformatted the
long accept call across lines as `import.meta.hot\n  .accept(cb)`.

Every module the plugin owned silently stopped being an HMR boundary. Nothing errored: the shim still
ran, the callback still existed, and Vite simply never treated the module as accepting, so every edit
propagated upward and eventually triggered a full reload. It was reported as "HMR got slower".

The cause is one sentence: the call must appear as `import.meta.hot.accept(`, *"whitespace-sensitive"*,
because *"this is a requirement of the static analysis that Vite does"*. Vite is matching text before
the module ever runs.

**The transferable point:** two of the three rules here are about *how the code is written*, not what
it does — the literal text of the accept call, and mutating `data` rather than replacing it.

---

## 3. Production-Grade Code Example

```javascript
// ✅ A plugin-generated client shim that satisfies the static analysis.
export const tokens = { color: 'red' };

if (import.meta.hot) {
  // The literal text `import.meta.hot.accept(` must survive every step of the
  // generation pipeline — no formatter, no aliasing, no optional chaining.
  import.meta.hot.accept((newModule) => {
    // newModule is undefined when a SyntaxError happened.
    if (!newModule) return;
    applyTokens(newModule.tokens);
  });

  // dispose / prune / data belong to the module lifecycle — see the next page.
}
```

```javascript
// ✅ Accepting a dependency, with the two documented failure cases handled.
import.meta.hot.accept(['./tokens.js', './theme.js'], (mods) => {
  // "the array is empty" when the update failed (syntax error).
  if (mods.length === 0) return;
  const [newTokens, newTheme] = mods;
  // "only the updated module is non null".
  if (newTokens) applyTokens(newTokens.tokens);
  if (newTheme) applyTheme(newTheme.theme);
});
```

```javascript
// ⛔ Four ways to lose the boundary.
const hot = import.meta.hot;
hot?.accept(cb);                       // 1. the literal text never appears — not a boundary
import.meta.hot . accept(cb);          // 2. whitespace-sensitive — also not a boundary
const { accept } = import.meta.hot;    // 3. destructured — the text never appears
accept(cb);                            // 4. ...and this call is invisible to the analysis
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Aliasing or reformatting the `accept` call

The text `import.meta.hot.accept(` must appear literally and is *"whitespace-sensitive"*. Any
formatter, minifier or destructuring in a code-generation path can remove the boundary without
removing the behaviour that looks like it.

### ⚠️ Pitfall 2 — Expecting importers above the boundary to be notified

*"importers up the chain from the boundary module will not be notified of the change"*. Derived state
held by a parent stays stale until something else updates it.

### ⚠️ Pitfall 3 — Re-exports inside a boundary

*"if an HMR boundary module re-exports imports from a dep, then it is responsible for updating those
re-exports (and these exports must be using `let`)"*. A `const` re-export cannot be updated.

### ⚠️ Pitfall 4 — Destructuring the deps array without a guard

*"If the update was not successful (syntax error for ex.), the array is empty"*, and only the updated
entry is non-null. Check length, then check each entry.

### ⚠️ Pitfall 5 — `invalidate()` without `accept()`

*"you should always call `import.meta.hot.accept` even if you plan to call `invalidate` immediately
afterwards, or else the HMR client won't listen for future changes"*. Call it inside the accept
callback, which the docs recommend *"to communicate your intent clearly"*.

### ⚠️ Pitfall 6 — Reaching for `hot.decline()`

*"This is currently a noop and is there for backward compatibility."* To say a module is not
hot-updatable, use `invalidate`.

### ⚠️ Pitfall 7 — Assuming the callback always receives a module

*"newModule is undefined when SyntaxError happened"*. The callback runs on the failure path too.

---

## Gotchas

**★ Symptom: HMR "got slower" and every edit ends in a full reload.** Cause: the module stopped being an HMR boundary because the accept call no longer appears as the literal, whitespace-sensitive text `import.meta.hot.accept(`. Fix: restore the exact call; keep formatters out of generated client code.

**★ Symptom: a module stops receiving HMR updates entirely after one `invalidate()`.** Cause: `invalidate` was called without `accept`, so *"the HMR client won't listen for future changes"*. Fix: call `invalidate` inside the `accept` callback.

**★ Symptom: `hot.decline()` appears to do nothing.** Cause: it is *"currently a noop and is there for backward compatibility"*. Fix: `hot.invalidate()`.

**★ Symptom: `TypeError` reading a property of `undefined` inside an accept callback.** Cause: *"newModule is undefined when SyntaxError happened"* — the callback runs on the failure path. Fix: `if (!newModule) return;` first.

**★ Symptom: destructuring the deps callback array throws after a syntax error.** Cause: *"the array is empty"* on a failed update. Fix: check `mods.length` before destructuring, and null-check each entry.

**★ Symptom: a re-exported binding never updates inside a boundary.** Cause: the boundary is *"responsible for updating those re-exports"* and they must be declared with `let`. Fix: `let` plus explicit reassignment in the accept callback.

**★ Symptom: a parent component keeps stale data after a child module updates.** Cause: *"importers up the chain from the boundary module will not be notified"*. Fix: place the boundary where the state lives, or push the change with a custom event.

---

## Interview questions

**★ Why is `import.meta.hot.accept(` whitespace-sensitive?**
Because Vite finds HMR boundaries by static analysis of the source text, before the module runs —
the docs say the call *"[must appear] as `import.meta.hot.accept(` (whitespace-sensitive) in the
source code in order for the module to accept update"*, and that *"this is a requirement of the
static analysis that Vite does"*. A runtime-equivalent form such as `const hot = import.meta.hot;
hot.accept(cb)` never produces that text, so the module is simply not treated as a boundary. The
practical consequence is felt most by plugin authors generating client code: any formatter, minifier
or template refactor in the generation path can remove HMR support while leaving code that looks
completely correct, and the only symptom is that updates start propagating upward and ending in full
reloads.

**★ What is an HMR boundary, and what does it not do?**
A module that calls `accept` is a boundary: updates to it, or to the deps it accepts, are applied
there instead of propagating further. What it does not do is notify anything above it — *"importers
up the chain from the boundary module will not be notified of the change"* — and it does not swap
the originally imported module, which is why *"if an HMR boundary module re-exports imports from a
dep, then it is responsible for updating those re-exports (and these exports must be using `let`)"*.
The documentation is explicit that this is a deliberate simplification, *"sufficient for most dev
use cases, while allowing us to skip the expensive work of generating proxy modules"*. So the
practical rule is to place the boundary where the state that needs refreshing actually lives.

**★ Why must you call `accept` even when your plan is to `invalidate` immediately?**
Because the accept call is what registers the module with the HMR client at all. The docs are
explicit: *"you should always call `import.meta.hot.accept` even if you plan to call `invalidate`
immediately afterwards, or else the HMR client won't listen for future changes to the self-accepting
module"* — so an `invalidate` on its own propagates this one update to the importers and then leaves
the module deaf to every subsequent change, which presents as "HMR stopped working for this file"
long after the code that caused it was written. The recommended shape is to call `invalidate` inside
the accept callback, which also reads correctly: accept the update, inspect the new module, decide at
runtime that it cannot be handled.

**★ A generated client shim works in one project and silently stops being hot-updatable in another. Where do you look?**
At the emitted text, not the plugin logic. The three things that break a boundary are all textual or
structural: the accept call not appearing literally as `import.meta.hot.accept(`, a formatting or
minification step in the generation path rewriting it, and any aliasing of `import.meta.hot`. So the
first move is to read the served module in the browser's network tab, character for character,
rather than the template that produced it. If the text is intact, the next questions are whether the
boundary is in the right place — since importers above it are not notified — and whether an
`invalidate` without an `accept` has already switched the module off for the rest of the session.

---

← [HMR Client Listeners](01odb-hmr-client-listeners.md) · [Vite overview](../../README.md) · Next → [HMR Module Lifecycle](01odd-hmr-module-lifecycle.md)
