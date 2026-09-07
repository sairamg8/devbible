---
title: "`dispose` runs on every replacement and `prune` only when the module leaves the page, `data` is the object that survives between instances and must be mutated rather than reassigned, and `invalidate` without `accept` ends the module's updates for good"
sidebar_label: "HMR Module Lifecycle"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [HMR API](https://vite.dev/guide/api-hmr) (`hot.dispose`, `hot.prune`, `hot.data`, `hot.decline`, `hot.invalidate`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HMR Module Lifecycle

[Self-accepting Modules](01odc-self-accepting-modules.md) covered the boundary itself. This page is
the machinery around it: what runs when a module instance is discarded, what survives to the next
one, and the two methods for saying "I cannot handle this update" — only one of which does anything.

---

## 1. Under-The-Hood Mechanics

### `dispose` — every replacement

> *"A self-accepting module or a module that expects to be accepted by others can use `hot.dispose`
> to clean-up any persistent side effects created by its updated copy"*

```js
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    // cleanup side effect
  })
}
```

The callback receives the module's `data` object, so a dispose handler can both tear down and hand
something forward.

### `prune` — only when the module leaves the page

> *"Register a callback that will call when the module is no longer imported on the page. Compared to
> `hot.dispose`, this can be used if the source code cleans up side-effects by itself on updates and
> you only need to clean-up when it's removed from the page. Vite currently uses this for `.css`
> imports."*

| Callback | Fires | Use for |
|---|---|---|
| `dispose` | every time this instance is replaced | timers, observers, listeners created by *this* instance |
| `prune` | when the module is no longer imported on the page | page-level resources that survive replacements |

The `.css` note is the clearest illustration: a stylesheet should stay while the module keeps being
re-evaluated, and be removed when the module is gone. Putting that cleanup in `dispose` would strip
the styles on every keystroke.

### `data` — the object that crosses instances

> *"Vite creates one `import.meta.hot.data` object for each module path. The object is persisted
> across successive instances of the same module during HMR. Mutations made during module execution
> or through the `data` argument passed to `hot.dispose` are visible to the next instance of the
> module."*

> *"Note that re-assignment of `data` itself is not supported. Instead, you should mutate properties
> of the `data` object so information added from other handlers are preserved."*

```js
// ok
import.meta.hot.data.someValue = 'hello'

// not supported
import.meta.hot.data = { someValue: 'hello' }
```

⚠️ And its lifetime is bounded:

> *"When a module is pruned, its `hot.dispose` and `hot.prune` callbacks receive the current data
> object. Vite clears the data after those callbacks complete. If the module is imported again later,
> it receives a new empty data object."*

So `data` survives *replacement*, not *removal*. Code that treats it as session-scoped storage is
correct until a route stops importing the module.

### `invalidate` — the runtime escape hatch

> *"A self-accepting module may realize during runtime that it can't handle a HMR update, and so the
> update needs to be forcefully propagated to importers. By calling `import.meta.hot.invalidate()`,
> the HMR server will invalidate the importers of the caller, as if the caller wasn't
> self-accepting. This will log a message both in the browser console and in the terminal. You can
> pass a message to give some context on why the invalidation happened."*

🔴 And the sentence that costs people an afternoon:

> *"Note that you should always call `import.meta.hot.accept` even if you plan to call `invalidate`
> immediately afterwards, or else the HMR client won't listen for future changes to the
> self-accepting module. To communicate your intent clearly, we recommend calling `invalidate`
> within the `accept` callback"*

---

## 2. Real-World Engineering Scenario

**A cache that reset on every keystroke, then vanished on navigation.**

A plugin-generated client shim kept a memoisation cache for expensive token lookups. The first
version stored it in a module-level `const`, which meant a fresh empty cache on every hot
replacement — the developer experience was that the first interaction after each save was noticeably
slow.

Moving it to `import.meta.hot.data` fixed that, because the object *"is persisted across successive
instances of the same module during HMR"*. But the first attempt did it wholesale:

```js
import.meta.hot.data = { cache: new Map() };   // ⛔ "not supported"
```

That is explicitly unsupported, and it also discarded a `lastAppliedAt` timestamp another handler in
the same shim wrote into `data` — the docs say to mutate properties *"so information added from other
handlers are preserved"*, and this was precisely that case. The symptom was a second feature breaking
when an unrelated one was fixed.

**Then it vanished on navigation.** The team started treating `data` as session storage and cached
user preferences in it. On a route where the module stopped being imported, the module was pruned;
*"Vite clears the data after those callbacks complete"*, so returning to the route produced a new
empty object and the preferences were gone. The lifetime is per-replacement-chain, not
per-session.

**The third bug: cleanup in the wrong callback.** An injected `<style>` element was removed in
`dispose`, so every edit removed the styles and re-added them, producing a visible flash. Vite's own
guidance points the other way — `prune` exists for cleanup *"when it's removed from the page"*, and
the docs note Vite *"currently uses this for `.css` imports"*.

**The transferable point:** three callbacks, three different lifetimes, and choosing the wrong one is
never a crash — it is a flash, a reset, or a value that disappears at a route boundary.

---

## 3. Production-Grade Code Example

```javascript
// ✅ Each callback doing the job its lifetime matches.
const styleEl = document.createElement('style');
document.head.appendChild(styleEl);

const observer = new MutationObserver(onMutate);
observer.observe(document.body, { childList: true });

if (import.meta.hot) {
  // Survives replacement: mutate, never reassign.
  const state = (import.meta.hot.data.tokenCache ??= new Map());
  primeFrom(state);

  import.meta.hot.accept((next) => {
    if (!next) return;                 // undefined after a SyntaxError
    applyTokens(next.tokens);
  });

  // This instance created the observer, so this instance tears it down.
  import.meta.hot.dispose((data) => {
    observer.disconnect();
    // Hand something forward explicitly if it is not already on `data`.
    data.lastAppliedAt = Date.now();
  });

  // The style element belongs to the page, not to this instance.
  import.meta.hot.prune(() => {
    styleEl.remove();
  });
}
```

```javascript
// ✅ invalidate, called from inside accept, as the docs recommend.
import.meta.hot.accept((module) => {
  if (cannotHandleUpdate(module)) {
    // Propagates to importers as if this module were not self-accepting,
    // and logs in both the browser console and the terminal.
    import.meta.hot.invalidate('token shape changed');
  }
});
```

```javascript
// ⛔ Four lifetime mistakes.
import.meta.hot.data = { cache: new Map() };   // 1. reassignment is "not supported"
import.meta.hot.dispose(() => styleEl.remove());// 2. page resource torn down on every edit
import.meta.hot.invalidate();                   // 3. no accept: no future updates at all
import.meta.hot.decline();                      // 4. "currently a noop"
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Reassigning `hot.data`

*"re-assignment of `data` itself is not supported"* — mutate properties so *"information added from
other handlers [is] preserved"*. Wholesale assignment silently discards other handlers' values, so
fixing one feature breaks another.

### ⚠️ Pitfall 2 — Treating `data` as session storage

It survives replacement, not removal: when a module is pruned *"Vite clears the data after those
callbacks complete. If the module is imported again later, it receives a new empty data object."*

### ⚠️ Pitfall 3 — Using `dispose` where `prune` was meant

`dispose` runs on every replacement; `prune` runs *"when the module is no longer imported on the
page"*. Page-level cleanup in `dispose` produces a teardown-and-rebuild flash on every edit.

### ⚠️ Pitfall 4 — Using `prune` where `dispose` was meant

The mirror image, and quieter: a timer or observer created by each instance is never cleaned up
between replacements, so they accumulate for as long as the page stays open.

### ⚠️ Pitfall 5 — Invalidating without a message

`invalidate` accepts one, and it *"will log a message both in the browser console and in the
terminal"*. An unexplained invalidation in a terminal log is indistinguishable from a Vite internal
one; a message names the plugin that decided.

### ⚠️ Pitfall 6 — Assuming `dispose` implies the module is going away

It fires on replacement, which is the common case. Cleanup that must run exactly once on removal
belongs in `prune`, and the two can both be registered.

---

## Gotchas

**★ Symptom: values written to `hot.data` by one handler vanish.** Cause: another handler reassigned `import.meta.hot.data` wholesale, which is *"not supported"*. Fix: mutate properties only — `import.meta.hot.data.cache ??= new Map()`.

**★ Symptom: state does not survive a hot replacement even though it is on `hot.data`.** Cause: the module was pruned rather than replaced — *"Vite clears the data after those callbacks complete"* and a later import gets a new empty object. Fix: treat `data` as replacement-scoped; persist elsewhere if it must outlive removal.

**★ Symptom: injected styles flash on every save.** Cause: the cleanup lives in `dispose`, which runs per replacement. Fix: move it to `prune`, which fires *"when the module is no longer imported on the page"*.

**★ Symptom: observers or timers accumulate until the page slows down.** Cause: per-instance side effects cleaned up in `prune` instead of `dispose`. Fix: `dispose` for anything this instance created.

**★ Symptom: the terminal logs invalidations with no indication of which plugin caused them.** Cause: `invalidate()` was called with no message. Fix: `invalidate('token shape changed')` — the message is logged in both the browser console and the terminal.

**★ Symptom: a cache is empty on the first interaction after every save.** Cause: it lives in a module-scope binding, which is recreated on each replacement. Fix: `import.meta.hot.data`, which *"is persisted across successive instances of the same module"*.

---

## Interview questions

**★ What is the difference between `dispose`, `prune` and `data`?**
`dispose` runs when this instance of the module is about to be replaced and is for cleaning up
*"persistent side effects created by its updated copy"* — it fires on every hot update. `prune` runs
*"when the module is no longer imported on the page"*, which is the right place for cleanup that
should happen once, on removal; the docs note Vite *"currently uses this for `.css` imports"*. `data`
is the carrier between instances: *"one `import.meta.hot.data` object for each module path …
persisted across successive instances"*, mutated rather than reassigned, and cleared after the
dispose and prune callbacks when the module is pruned. Getting them mixed up is never a crash — it is
a style flash on every keystroke, or observers piling up, or state that resets at a route boundary.

**★ Why is reassigning `hot.data` unsupported rather than merely discouraged?**
Because the object is shared. Vite creates one per module path and hands the same reference to the
module body and to the `dispose` callback, so several handlers — including ones a plugin injected
that the module's author never sees — write into it. Reassignment replaces the object the rest of the
system is still holding a reference to, which is why the documentation frames the rule in terms of
preservation: mutate properties *"so information added from other handlers are preserved"*. The
failure is characteristically confusing, because fixing one feature silently deletes another
feature's state, and the two pieces of code never reference each other.

**★ When would you register both `dispose` and `prune` on the same module?**
Whenever the module owns two kinds of resource. A component module might create a `MutationObserver`
per instance — which must be disconnected on every replacement, or they accumulate — and also inject a
single `<style>` element that should live as long as the module is on the page. `dispose` handles the
first, `prune` the second, and registering both is normal rather than redundant. The question to ask
of each resource is "was this created by *this* instance, or does it belong to the page?", and the two
answers map exactly onto the two callbacks.

**★ How would you decide whether a piece of state belongs in `hot.data` or somewhere else entirely?**
By its required lifetime. `hot.data` survives replacement but is cleared when the module is pruned,
so it is right for anything whose loss is a performance problem rather than a correctness problem — a
warmed cache, a scroll position, an applied-count. Anything that must survive the module leaving the
page needs a different home, such as `sessionStorage` or a store module that nothing invalidates.
And anything that must survive a full reload was never HMR state to begin with. Stating the lifetime
first is what stops the common failure, which is discovering the boundary the day a route change
prunes the module.

---

← [Self-accepting Modules](01odc-self-accepting-modules.md) · [Vite overview](../../README.md) · Next → [Typing Custom Events](01oe-typing-custom-events.md)
