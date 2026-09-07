---
title: "Eliminating Cross-Plugin Coupling: the Preset Factory Beats Picking the Right Hook"
sidebar_label: "Eliminating Coupling"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Plugins Config](https://vite.dev/guide/api-plugin) (presets and flattening), the **Kind** lines on `config` and `configResolved`. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Eliminating Cross-Plugin Coupling

[Chunk 1g](01g-accidental-serialisation.md) diagnosed the race. This chunk is the fix — and the
argument is that *picking the right hook* is the second-best answer. The best one removes the
question.

---

## 1. Under-The-Hood Mechanics

### The fix hierarchy

```
BEST   compute the value ONCE in a preset factory, pass it to both plugins
       → no hook ordering involved at all. Nothing to get wrong.

GOOD   move the coordination to `config`, which is `sequential` by contract
       → ordered, but still a channel someone can misuse later

BAD    keep it in `configResolved` and "make sure both stay synchronous"
       → a constraint nobody can see, enforced by nothing
```

### Why the factory wins

A preset's factory body runs **before any hook**, when the plugins are constructed:

```
platform(opts) called in vite.config.ts
   │
   ├─ collectCapabilities(opts)     ← runs HERE. Once. Synchronously if you like.
   │
   └─ returns [writer(caps), reader(caps)]
                      ↑ both already hold the value

…then Vite resolves plugins, then hooks run.
```

There is no ordering to guarantee because there is no communication. The value existed before either
plugin did.

This works because of a documented behaviour:

> *"`plugins` also accepts presets including several plugins as a single element … The array will be flattened internally."*

So one entry in the user's `plugins` array can be several plugins that already share state by
construction.

### ⚠️ A preset is not automatically a fix

Grouping two plugins in an array changes **nothing** about their hooks' Kinds. If they still talk to
each other through a module-level `Map` written in `configResolved`, the race is intact:

```js
// ⛔ still a race — the preset only groups them
export function platform(o) { return [writer(), reader()]; }

// ✅ the value is computed in the factory and passed in
export function platform(o) { const v = compute(o); return [writer(v), reader(v)]; }
```

**The preset helps only when you use it to move the computation earlier.**

### When the value genuinely cannot be computed early

Sometimes the shared value depends on the resolved config, which does not exist at factory time.
Then the answer is `config` (sequential, ordered by contract) — or, better, to **stop sharing** and
let both plugins derive the value independently from the same input. Two pure derivations of one
input cannot race; one derivation plus a channel can.

---

## 2. Real-World Engineering Scenario

**A "do not make this async" comment, and the dependency upgrade that ignored it.**

After the registry race in [chunk 1g](01g-accidental-serialisation.md), the team shipped a fix and a
guard:

```ts
// ⚠️ DO NOT make this async — `reader` depends on it completing first.
configResolved() { registry.set('caps', collect()); }
```

Eleven months later the same failure returned. Nobody had touched the comment or the hook. The diff
that broke it was a version bump: `collect()` called a shared internal library, and that library's
new major had made one of its functions async, so `collect()` returned a promise. The hook was still
synchronous — it just now stored a promise in the registry, and the reader received a `Promise`
where it expected an array and fell through to defaults.

**The comment had no enforcement behind it, and the violating change came from outside the
repository.** A constraint that lives in a comment protects against exactly one thing: a developer
in that file, reading carefully, on a day they are not in a hurry.

The second fix removed the channel:

```ts
export function platform(opts: Options) {
  const caps = collect(opts);      // computed once, at construction
  return [writer(caps), reader(caps)];
}
```

There is now nothing to make async, nothing to order and nothing to comment. **The measure of a good
fix is not that it works — it is that the next plausible change cannot break it.**

---

## 3. Production-Grade Code Example

```typescript
// ✅ BEST. No cross-plugin channel at all. The value is computed ONCE in the
//    factory, before any hook runs, and handed to both plugins directly.
import type { Plugin } from 'vite';

export interface PlatformOptions { tier: 'basic' | 'pro' }

function writer(caps: Capabilities): Plugin {
  return { name: 'acme-writer', transform: { filter: { id: /\.acme$/ },
    handler: (code) => ({ code: emit(code, caps), map: null }) } };
}

function reader(caps: Capabilities): Plugin {
  return { name: 'acme-reader', config: () => ({ define: { __CAPS__: JSON.stringify(caps) } }) };
}

/** A preset. One entry in the user's array; Vite flattens it. */
export function platform(opts: PlatformOptions) {
  const caps = collectCapabilities(opts);   // ← before any hook exists
  return [writer(caps), reader(caps)];
}
```

```typescript
// ✅ GOOD, when the value depends on the resolved config and cannot be computed
//    early. `config` is `sequential`, so ordering is guaranteed by contract.
export function writer(): Plugin {
  return {
    name: 'writer',
    async config(userConfig) {
      (userConfig as any).__caps = await readManifest();   // later plugins WILL see this
      return null;
    },
  };
}
```

```typescript
// ✅ BETTER than a channel: two INDEPENDENT derivations of the same input.
//    Two pure functions of one value cannot race; one write plus one read can.
function writer(opts: PlatformOptions): Plugin {
  const caps = deriveCapabilities(opts);   // each plugin derives it itself
  return { name: 'acme-writer', /* … */ };
}
function reader(opts: PlatformOptions): Plugin {
  const caps = deriveCapabilities(opts);   // same input, same output, no channel
  return { name: 'acme-reader', /* … */ };
}
```

```typescript
// ⛔ A preset that does NOT move the computation earlier is not a fix.
export function platform(o: PlatformOptions) {
  return [writer(), reader()];   // still talking through a module-level Map
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Fixing it by "keeping both hooks synchronous"

A constraint nobody can see and nothing enforces — including the dependency upgrade that will
violate it without a local diff. It is a deferral, not a fix.

### ⚠️ Pitfall 2 — Assuming a preset removes the coupling

Grouping plugins changes nothing about their hooks. The preset helps only when you use it to compute
the shared value in the factory.

### ⚠️ Pitfall 3 — Storing a promise instead of a value

If the shared computation becomes async and the hook stays synchronous, the channel now carries a
`Promise`. Consumers get an object where they expected data and fall through to defaults silently.

### ⚠️ Pitfall 4 — Preferring a channel over duplication

Two plugins independently deriving the same value from the same input is often better than one
computing and one reading. It duplicates a function call and eliminates a category of bug.

### ⚠️ Pitfall 5 — Reviewing the diff instead of what the diff makes reachable

No reviewer catches this from three lines adding an `await`, or from a version bump. The defect is
in code the change merely *wakes*, which is why the defence is a standing audit.

### ⚠️ Pitfall 6 — Documenting the constraint instead of removing it

A comment protects against one developer, in that file, reading carefully, on an unhurried day. It
does not protect against a transitive dependency.

---

## Gotchas

**★ Symptom: a shared `Map` between two plugins is empty in one of them.** Cause: the writer suspended. Fix: compute the shared value **once in a preset factory** and pass it to both plugins — then no hook ordering is involved at all, which is strictly better than picking the right hook.

```ts
export function platform(o) { const v = compute(o); return [writer(v), reader(v)]; }
```

**★ Symptom: two plugins in a preset still race.** Cause: a preset guarantees they are registered and flattened together; it does not change either hook's Kind. Fix: use the preset to move the computation into the factory — merely grouping the plugins changes nothing.

**★ Symptom: the team's fix is a comment saying "do not make this async".** Cause: treating the symptom. Fix: a comment is not an enforcement mechanism, and the violating change may come from a dependency rather than your repository. Remove the dependency on ordering instead.

**★ Symptom: the race returns after a version bump that touched no plugin code.** Cause: a transitive library became async, so a synchronous-looking call now returns a promise. Fix: the channel is the problem, not the library. A value computed at construction cannot acquire a suspension point later.

**★ Symptom: a consumer receives a `Promise` where it expected data, and silently uses defaults.** Cause: `?? DEFAULTS` on a value that is now a pending promise — which is truthy, so the fallback does not even fire; the code proceeds with an object. Fix: remove the channel; failing that, assert the shape rather than falling back on nullish-coalescing.

**★ Symptom: a three-line pull request is blamed for a bug it did not contain.** Cause: it made a latent race reachable. Fix: it is genuinely not the author's bug, and saying so matters — otherwise the team's conclusion is "be careful with `await`", which is unactionable, instead of "audit our cross-plugin state", which is not.

**★ Symptom: duplicating a derivation in two plugins feels wrong in review.** Cause: DRY instinct applied to a coordination problem. Fix: two pure derivations of the same input are independent and cannot race; a shared computation plus a channel can. The duplication is buying a correctness property, and that should be said in the comment.

**★ Symptom: the shared value genuinely needs the resolved config, so factory computation is impossible.** Cause: a real constraint. Fix: `config` is `sequential` and is the correct hook — but prefer having both plugins derive it independently from the config they each receive, so there is still no channel.

**★ Symptom: a fix is declared complete because the flaky test passed ten times.** Cause: confusing absence of failure with a guarantee. Fix: ask what the *next plausible change* is — an `await`, a version bump, a plugin reordering — and whether it would break the fix. If it would, the fix is a deferral.

---

## Interview questions

**★ Your fix is "keep both hooks synchronous". Critique it.**
It is a deferral, not a fix. The constraint is invisible — nothing in the type system, the linter or
the test suite expresses it — and it can be violated by a dependency upgrade that produces no local
diff, so the person who breaks it will have no way to know. It also gets less true over time, since
plugins tend to grow I/O rather than shed it. The alternative costs about the same: move the
coordination to `config`, which is `sequential` by contract, or eliminate the channel by computing
the value in a preset factory. Both replace a promise nobody can check with a guarantee the
documentation makes.

**★ Why is a preset factory a better fix than choosing the right hook?**
Because it removes the category rather than answering the question correctly. A factory body runs
when the plugins are *constructed*, before any hook exists, so a value computed there is already in
both plugins' closures by the time ordering could matter. There is nothing to sequence, nothing to
document and nothing a later change can break — whereas "we moved it to `config` because `config` is
sequential" is a correct answer that still leaves a channel someone can misuse, and a fact someone
has to keep knowing. The general form is worth stating: **prefer fixes that make the failure
unrepresentable over fixes that make it unlikely.**

**★ When is duplicating a derivation across two plugins the right call?**
Whenever both plugins can compute the value from the same input. Two pure functions of one argument
are independent by construction — no channel, no ordering, no shared mutable state — and the cost is
one extra call of a function that is usually cheap. The DRY instinct says to compute once and share,
and in a coordination-sensitive context that instinct trades a trivial cost for a class of race. The
comment worth leaving is not "duplicated for performance" but "derived independently so the two
plugins cannot race", so the next person does not helpfully refactor it back.

**★ Why is this class of bug so resistant to code review?**
Because the defect is never in the diff. The `await` that reveals it is correct, small and
unrelated; the coupling it exposes was written months earlier by someone else and reviewed then, at
a time when it worked. No reviewer of either change had both halves in front of them — and in the
version-bump case, the breaking change is not even in the repository. That is what makes a
**standing audit** the right control rather than a review checklist: you can enumerate cross-plugin
shared state at any time, ask one question per item, and get a definite answer from the
documentation. Controls that work at rest beat controls that depend on someone noticing at the right
moment.

**★ How do you know a concurrency fix is actually done?**
By naming the next plausible change and checking whether it would break it. An `await` added to a
hook; a dependency that becomes internally async; a plugin moved earlier in the array; a preset
introduced between them. If any of those reintroduces the failure, the fix is a deferral wearing a
green test suite — and a flaky test passing ten times is evidence about the window, not about the
guarantee. The version that survives all four is usually the one where the value is computed before
any hook runs, which is why the factory sits at the top of the hierarchy.

---

← [Accidental Serialisation](01g-accidental-serialisation.md) · [Vite overview](../../README.md) · Next → [Server Hooks](01i-server-hooks.md)
