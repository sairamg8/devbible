---
title: "Before you debug what `transformIndexHtml` injected, establish whether it ran — a framework can own the entry file entirely, and the hook is per-environment, so every guard flag you add breaks the environment that runs second"
sidebar_label: "When `transformIndexHtml` Runs"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the **Scope** line and the framework warning) and [Environment API § Per-environment Hooks](https://vite.dev/guide/api-environment-plugins). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ When `transformIndexHtml` Runs

The fourth of five pages on `transformIndexHtml`, after
[HTML `children` & Composition](01n-html-children-and-composition.md),
[Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md) and
[HTML Plugin Composition](01nb-html-plugin-composition.md). Those pages assume the hook fires. This
one is about the cases where it fires a different number of times than you think, or not at all —
which is the first thing to establish when a plugin "injects nothing" and throws no error. The
context object it receives is [The `transformIndexHtml` Context](01nd-html-transform-context.md).

---

## 1. Under-The-Hood Mechanics

### 🔴 The hook may not run at all

> *"This hook won't be called if you are using a framework that has custom handling of entry files
> (for example [SvelteKit](https://github.com/sveltejs/kit/discussions/8269#discussioncomment-4509145))."*

The framework owns the entry file, so `transformIndexHtml` never fires. Nothing in the plugin
misbehaves; it simply never executes, and every debugging instinct that starts inside the plugin is
wasted. There is no plugin-side workaround — the framework's own document or head API is the answer,
and a plugin that depends on this hook should say so in its README.

### Scope: per-environment

> *"**Scope:** [Per-environment](https://vite.dev/guide/api-environment-plugins#per-environment-hooks-and-global-hooks)"*

The hook is scoped to an environment, not to the server as a whole, so a client-plus-SSR setup can
call it more than once for the same file. Any cross-invocation state the plugin keeps — the classic
`let injected = false` guard — is shared across environments and will suppress the later run.

⚠️ The Plugin API page states the scope and links to the Environment API page for what
per-environment means; it does not enumerate which environments produce an HTML transform in a given
build. Treat "it runs exactly once" as an assumption you have not verified rather than a documented
guarantee, and write the hook so the number does not matter.

### `originalUrl` is evidence about the execution model

The context object carries an optional `originalUrl: string`. ⚠️ The documentation gives it a type
and no description, and it does not state the invocation frequency in dev in so many words — so do
not claim a number. But a field holding the URL as originally requested only makes sense if the hook
is being invoked while a request is being served, which means the dev path is not a one-shot build
step and anything you accumulate between calls keeps accumulating. Reading the shape of a signature
is often faster than finding the sentence that says it, and here it is the only evidence available.

**The rule that survives every invocation count:** compute the tags from the hook's arguments on
every call and keep nothing between calls. A hook written that way is correct whether it runs once,
twice, or once per request.

---

## 2. Real-World Engineering Scenario

**A plugin that was correct in CI and inert in every developer's browser.**

The plugin injected a build-stamp `<meta>` tag, and it read the stamp like this:

```ts
export function buildStamp(): Plugin {
  const stamp = readStampFile();               // ⛔ read once, when the plugin is constructed
  return {
    name: 'build-stamp',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'build', content: stamp } }];
    },
  };
}
```

In CI that is fine: the config is loaded, the plugin is constructed, the build runs, one stamp. In
dev the plugin object is constructed once when the server starts and the hook runs as HTML is
served, so every developer saw the stamp from whenever they had last restarted Vite. Two of them
spent an afternoon convinced the deploy pipeline was publishing stale artefacts.

**Then the same plugin lost its tag in SSR output.** Someone added `if (injected) return;` at module
scope to "stop it running twice" after seeing the hook fire more than once. It was firing more than
once because the hook is **Per-environment** and the project had added an SSR environment. The guard
made the client build correct and the SSR HTML wrong — a missing meta tag in the one output nobody
opens in a browser.

**The transferable point:** both bugs come from treating the hook as a build-time event that happens
once. It is a per-environment, per-invocation callback, and the fix for both is the same shape —
compute from the arguments every time and keep nothing between calls.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Stateless: correct under any number of invocations, in dev and in build.
import type { Plugin } from 'vite';

export function buildStamp(readStamp: () => string): Plugin {
  return {
    name: 'build-stamp',
    transformIndexHtml() {
      // Read at call time, not at construction time.
      const stamp = readStamp();
      return [{ tag: 'meta', attrs: { name: 'build', content: stamp }, injectTo: 'head' }];
    },
  };
}
```

```typescript
// ✅ If state is genuinely required, key it by environment rather than storing one value.
export function onceInEachEnvironment(): Plugin {
  const seen = new WeakSet<object>();
  return {
    name: 'once-per-environment',
    transformIndexHtml(html, ctx) {
      const env = ctx.server ?? ({} as object);   // dev: the server; build: a fresh key
      if (seen.has(env)) return;
      seen.add(env);
      return [{ tag: 'meta', attrs: { name: 'env-marker', content: 'set' } }];
    },
  };
}
```

```typescript
// ⛔ The guard that looks defensive and is destructive.
let injected = false;
const stamp = readStampFile();                 // captured at construction — stale for the dev server's life

export const bad: Plugin = {
  name: 'build-stamp-broken',
  transformIndexHtml() {
    if (injected) return;                      // suppresses the SECOND environment, not a duplicate
    injected = true;
    return [{ tag: 'meta', attrs: { name: 'build', content: stamp } }];
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Assuming the hook runs

Under a framework with custom entry-file handling it *"won't be called"* at all. Verify the tag is
present in the served HTML before concluding anything about the plugin's logic.

### ⚠️ Pitfall 2 — Module-level state across a per-environment hook

An `injected` flag at module scope suppresses the injection for the second environment, and the
symptom is a missing tag in SSR output — the last place anyone looks. Keep no state; if state is
genuinely required, key it by environment.

### ⚠️ Pitfall 3 — Building tag content in the plugin factory instead of the hook

A value captured when the plugin object was constructed never changes for the lifetime of the dev
server. Read it inside the hook, where it is re-evaluated on every invocation.

### ⚠️ Pitfall 4 — Treating "it ran twice" as a bug report

It is the documented scope. The correct response is to make the hook pure in its arguments, not to
count invocations — a plugin that is only correct when called once is a plugin with a latent SSR
failure.

### ⚠️ Pitfall 5 — Closing over `command` from `configResolved` instead of reading the context

It works, and it is one more thing to keep in sync. The context already answers the question at the
point where the question is asked, which is also the only point at which the answer can differ per
invocation.

### ⚠️ Pitfall 6 — Documenting the dependency nowhere

A plugin whose entire function depends on a hook a meta-framework may never call should say so in
its README. The cost of not doing this is paid by a stranger, in an afternoon, with no error message
to search for.

---

## Gotchas

**★ Symptom: the plugin injects nothing at all under a meta-framework.** Cause: *"This hook won't be called if you are using a framework that has custom handling of entry files"*. Fix: use that framework's own document or head API; there is no plugin-side workaround.

**★ Symptom: a tag is present in the client build and missing from SSR output.** Cause: the hook is per-environment and a module-scope `injected` flag suppressed the second run. Fix: hold no cross-invocation state, or key it by environment.

**★ Symptom: the injected value is correct in the production build and stale in dev.** Cause: it was read once when the plugin object was constructed, not inside the hook. Fix: move the read into the hook body, which is re-evaluated on every invocation.

**★ Symptom: the hook fires more times than expected and the reflex is to add a guard.** Cause: it is per-environment. Fix: do not guard — make the hook pure in its arguments so extra invocations are harmless, because the guard breaks whichever environment runs second.

**★ Symptom: a plugin works in one repo and silently does nothing in another with the same config.** Cause: the second repo uses a framework that owns the entry file. Fix: confirm the hook fires before comparing configs — the two repos differ in something the plugin cannot see.

---

## Interview questions

**★ Your plugin injects nothing and throws no error. What do you check, in order?**
First, whether the hook ran at all: the docs warn that *"this hook won't be called if you are using
a framework that has custom handling of entry files"*, and under that kind of entry ownership there
is no plugin-side fix. Second, whether `apply` or `enforce` excluded the plugin from this command.
Third, if the plugin uses the string return form, whether the anchor is still present — an earlier
plugin may have consumed or reformatted it, and a failed `String.replace` is indistinguishable from
a successful one. Fourth, whether a module-scope guard suppressed a later invocation, since the hook
is **Per-environment**. That order matters because the first two are answered by the resolved config
and the last two by reading the served HTML — cheapest evidence first.

**★ What does "Per-environment" on this hook change about how you write it?**
It means the hook is not a once-per-build event: it is called for each environment, so anything the
plugin remembers between calls is shared across environments rather than scoped to one. The concrete
consequence is that idempotence guards written as module-scope booleans are wrong — they suppress
the injection for whichever environment runs second, and the symptom is a tag present in the client
build and absent from SSR output. The correct shape is a hook that computes its tags from its
arguments every time and keeps no state at all; if state is genuinely required, key it by
environment. It also means "I saw it run twice" is not evidence of a bug.

**★ A colleague adds a guard flag because the hook ran twice. What do you say in review?**
That the second invocation is the documented behaviour of a per-environment hook, and the flag has
converted a harmless duplicate into a missing tag in whichever environment runs second — a strictly
worse failure, because a duplicate meta tag is visible and a missing one in SSR output is not. Then
ask what problem the duplicate actually caused: if the answer is "none, it just looked wrong", the
fix is to delete the flag. If a duplicate genuinely breaks something, the state has to be keyed by
environment rather than held as one module-scope boolean, and that is a different piece of code with
a different review.

**★ A plugin closes over `command` from `configResolved` to decide what to inject. What is wrong with that?**
Nothing that will fail today, and two things that will. It duplicates a fact the hook is already
given, so the two can drift — the closed-over value is captured once while the context is supplied
per invocation, and only one of those is guaranteed to describe *this* call. And it makes the plugin
harder to read, because the reason for a branch is now in a different hook from the branch itself.
The context is the local, per-call answer to a per-call question; reaching outside it is how a plugin
ends up with behaviour that depends on the order its own hooks ran in.

**★ Why is `originalUrl` interesting even if you never use it?**
Because its presence tells you what kind of callback this is. A field holding the URL as originally
requested only makes sense if the hook runs while serving a request, which means the dev path is not
a one-shot build step and any state kept between calls accumulates. The documentation does not spell
out an invocation count — so do not claim one — but the shape of the context is itself evidence
about the execution model. It is also the correct source for per-request behaviour such as
per-tenant markup, with the caveat that it is optional, undescribed in prose, and absent in a build.

**★ Why is "compute from the arguments, keep no state" a stronger rule than counting invocations?**
Because the invocation count is not something the documentation pins down — it states the scope and
links out for what per-environment means, without enumerating which environments produce an HTML
transform in a given build. Any code whose correctness depends on a number you inferred is code that
breaks when someone adds an SSR environment or a second client entry. A hook that derives its output
purely from `html` and `ctx` is correct for every count including one, so the uncertainty stops
being a risk and becomes irrelevant. That is generally the better move when documentation is
silent: write the version that does not need the answer.

---

← [HTML Plugin Composition](01nb-html-plugin-composition.md) · [Vite overview](../../README.md) · Next → [The `transformIndexHtml` Context](01nd-html-transform-context.md)
