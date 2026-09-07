---
title: "The transform context is the only honest dev-or-build discriminator this hook has — and four of its six fields carry a type and no description at all, which is exactly why people reach for `NODE_ENV` instead"
sidebar_label: "The `transformIndexHtml` Context"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the context description and the full `IndexHtmlTransformHook` signature) and the page's opening statement that Vite plugins extend Rolldown's plugin interface. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The `transformIndexHtml` Context

The last of five pages on `transformIndexHtml`, after [HTML `children` &
Composition](01n-html-children-and-composition.md), [Nested Descriptors & `{ html, tags
}`](01na-html-injection-composition.md), [HTML Plugin Composition](01nb-html-plugin-composition.md)
and [When `transformIndexHtml` Runs](01nc-html-hook-execution-contract.md). Every branch a plugin
takes inside this hook should be driven by the second argument, and most of the field-level
knowledge you need is not written in prose anywhere — it is in the type.

---

## 1. Under-The-Hood Mechanics

### What the documentation actually says about the context

> *"The hook receives the current HTML string and a transform context. The context exposes the
> [`ViteDevServer`](https://vite.dev/guide/api-javascript#vitedevserver) instance during dev, and
> exposes the Rollup output bundle during build."*

That is the whole prose description. Everything else is the signature:

```ts
type IndexHtmlTransformHook = (
  html: string,
  ctx: {
    path: string
    filename: string
    server?: ViteDevServer
    bundle?: import('rolldown').OutputBundle
    chunk?: import('rolldown').OutputChunk
    originalUrl?: string
  },
) =>
  IndexHtmlTransformResult | void | Promise<IndexHtmlTransformResult | void>
```

| Field | Optional | Documented in prose? |
|---|---|---|
| `path` | no | ⚠️ no — type only |
| `filename` | no | ⚠️ no — type only |
| `server` | yes | **yes** — *"during dev"* |
| `bundle` | yes | **yes** — *"during build"* |
| `chunk` | yes | ⚠️ no — type only |
| `originalUrl` | yes | ⚠️ no — type only |

⚠️ Four of the six fields have a type and no description. Names and types strongly suggest what they
are — `path` a URL path, `filename` a resolved file, `chunk` the entry chunk associated with this
HTML, `originalUrl` the request URL as received — but the documentation does not state any of it, so
treat those readings as inference and check the value before building behaviour on it. This page
does not assert meanings the docs do not give.

### The discriminator

`server` and `bundle` are both optional, and the one sentence of prose says which appears when. That
makes the context — not `process.env.NODE_ENV`, not a `command` value captured in `configResolved`
and closed over — the correct branch condition inside this hook:

```ts
if (ctx.server) {
  // dev
} else if (ctx.bundle) {
  // build, and the emitted filenames are right here
}
```

The second branch is the reason this matters beyond tidiness: in a build you usually want to inject
a reference to an emitted asset, and its final, content-hashed name only exists in `bundle`.

### 🔴 The prose says Rollup; the type says Rolldown

The context sentence calls it *"the Rollup output bundle"*, while the signature annotates the field
as `import('rolldown').OutputBundle`. The same page opens with:

> *"Vite plugins extends Rolldown's plugin interface with a few extra Vite-specific options."*

The type is the precise statement and the prose is wording that survived the migration. Code against
the type, and import bundle types from `rolldown` rather than `rollup` on Vite 8.

---

## 2. Real-World Engineering Scenario

**A preload tag that pointed at a file that had never existed.**

A performance plugin injected a `<link rel="preload">` for the main stylesheet:

```ts
{ tag: 'link', attrs: { rel: 'preload', as: 'style', href: '/assets/index.css' } }
```

In dev it was harmless — the dev server serves unhashed paths, and a missing preload target costs
nothing visible. In production the emitted file was `assets/index-B7c9Kz2f.css`, so the browser
preloaded a 404, warned about an unused preload, and the plugin's entire reason for existing —
starting the stylesheet fetch earlier — never happened. Lighthouse reported the *warning*, not the
missing optimisation, so the ticket that got filed was "remove the unused preload".

The correct version reads the name from the context instead of guessing it:

```ts
if (!ctx.bundle) return;
const css = Object.keys(ctx.bundle).filter((f) => f.endsWith('.css'));
```

**The second bug in the same plugin.** It also branched with `process.env.NODE_ENV === 'production'`
to decide whether to inject at all. The team built staging with `vite build --mode staging`, which
does not set `NODE_ENV` to `production`, so the plugin took the dev branch during a real build — and
`ctx.bundle` was present the whole time, sitting unused one identifier away.

**The transferable point:** the hook is handed everything it needs to know about its own execution.
Any branch that reaches outside the context for that information is guessing, and guessing wrong is
silent in exactly the environments you test least.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Build-only injection derived from the emitted bundle.
import type { Plugin } from 'vite';

export function preloadEntryCss(): Plugin {
  return {
    name: 'preload-entry-css',
    transformIndexHtml(html, ctx) {
      // No bundle means dev — there are no hashed filenames to point at yet.
      if (!ctx.bundle) return;

      return Object.keys(ctx.bundle)
        .filter((file) => file.endsWith('.css'))
        .map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'style', href: `/${file}` },
          injectTo: 'head-prepend' as const,
        }));
    },
  };
}
```

```typescript
// ✅ A mode-aware plugin that never mentions NODE_ENV.
export function devBanner(): Plugin {
  return {
    name: 'dev-banner',
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return;              // build: nothing to add
      return [
        { tag: 'div',
          attrs: { id: 'dev-banner', style: 'position:fixed;bottom:0;right:0' },
          children: 'DEV',
          injectTo: 'body' },
      ];
    },
  };
}
```

```typescript
// ✅ Optional fields handled as optional.
transformIndexHtml(html, ctx) {
  // `originalUrl` is optional and has no documented description; in a build there is
  // no request at all, so treat its absence as the normal case rather than an error.
  const requestPath = ctx.originalUrl ?? ctx.path;
  return [{ tag: 'meta', attrs: { name: 'served-for', content: requestPath } }];
}
```

```typescript
// ⛔ Three ways to get the context wrong.
transformIndexHtml(html, ctx) {
  // 1. NODE_ENV describes the process, not the Vite command — wrong under --mode staging
  const isBuild = process.env.NODE_ENV === 'production';
  // 2. ctx.bundle is optional; this throws the moment someone opens the dev server
  const files = Object.keys(ctx.bundle!);
  // 3. a non-null assertion on an optional, undocumented field
  const tenant = ctx.originalUrl!.split('/')[1];
  return [{ tag: 'meta', attrs: { name: 'tenant', content: tenant } }];
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Branching on `NODE_ENV` instead of the context

The context is the documented signal — `server` during dev, `bundle` during build. `NODE_ENV`
describes the process, which is a different question and is trivially wrong under `vite build --mode
staging`.

### ⚠️ Pitfall 2 — Reading `ctx.bundle` without a guard

It is optional and absent in dev, so `Object.keys(ctx.bundle)` throws the moment someone opens the
dev server. Guard with `if (!ctx.bundle) return;` and return nothing rather than injecting a
half-built tag.

### ⚠️ Pitfall 3 — Hard-coding an emitted filename

Content hashing means the name is only knowable from `bundle`. A hard-coded `href` produces a 404
that no build step checks and no test covers, because the file it names is plausible.

### ⚠️ Pitfall 4 — Non-null assertions on optional context fields

`server`, `bundle`, `chunk` and `originalUrl` are all optional in the signature. A `!` on any of
them is a claim about an execution mode you did not check, and TypeScript will not stop you.

### ⚠️ Pitfall 5 — Trusting the prose over the type

The page says *"the Rollup output bundle"*; the signature says `import('rolldown').OutputBundle`.
Vite 8 extends Rolldown's plugin interface, so the type is authoritative and the prose is legacy
wording that survived the migration.

### ⚠️ Pitfall 6 — Building behaviour on undocumented field semantics

`path`, `filename`, `chunk` and `originalUrl` have types and no prose descriptions. Using them is
fine; asserting in a code comment what they contain, and relying on that across a version bump, is
where a plugin acquires an undocumented dependency. Log the value once and write what you observed,
not what you assumed.

---

## Gotchas

**★ Symptom: `Cannot convert undefined or null to object` from a plugin that works in `vite build`.** Cause: `ctx.bundle` is optional and absent in dev. Fix: `if (!ctx.bundle) return;` at the top of the hook.

**★ Symptom: a preload or prefetch tag points at a 404 in production only.** Cause: the filename was hard-coded and the build added a content hash. Fix: derive hrefs from `Object.keys(ctx.bundle)` in the build branch.

**★ Symptom: a dev-only tag ships to production, or the reverse.** Cause: the branch was written on `process.env.NODE_ENV`. Fix: branch on `ctx.server` (dev) or `ctx.bundle` (build) — the discriminator the docs define for this hook.

**★ Symptom: the plugin takes the dev branch during a real build.** Cause: `vite build --mode staging` does not make `NODE_ENV` equal `production`. Fix: as above — the mode and the command are different things, and the context answers the command question directly.

**★ Symptom: a per-tenant value computed from `ctx.originalUrl` is `undefined`.** Cause: `originalUrl` is optional and there is no request during a build. Fix: `ctx.originalUrl ?? ctx.path`, or a separate build-time source for the value.

**★ Symptom: TypeScript accepts `ctx.bundle!` and production throws.** Cause: a non-null assertion on an optional field silences the one check that would have caught it. Fix: an `if` guard; the early return is also the correct behaviour, not just the safe one.

**★ Symptom: importing `OutputBundle` from `rollup` fails to resolve on Vite 8.** Cause: the prose in the docs still says "Rollup"; the type says `import('rolldown').OutputBundle`. Fix: import from `rolldown`.

**★ Symptom: a plugin's behaviour changes after a Vite upgrade and nothing in the changelog mentions it.** Cause: it relied on the contents of an undocumented context field. Fix: pin behaviour to `server`/`bundle`, the two fields the documentation actually describes.

---

## Interview questions

**★ How do you tell dev from build inside `transformIndexHtml`, and why not `NODE_ENV`?**
The context object is the documented discriminator: it *"exposes the `ViteDevServer` instance during
dev, and exposes the Rollup output bundle during build"*, and both fields are optional in the
signature precisely because exactly one of them is present. So `if (ctx.server)` is the dev branch
and `if (ctx.bundle)` is the build branch. `NODE_ENV` is a different question — it describes the
process, not the Vite command, and it is wrong under `vite build --mode staging` or any setup that
builds with a non-production mode. Using the context also hands you the thing you actually wanted in
the build branch, namely the emitted filenames, so the correct check and the useful data arrive
together.

**★ The docs say `bundle` is "the Rollup output bundle" but the type says `rolldown`. Which do you believe?**
The type. Vite 8 extends Rolldown's plugin interface rather than Rollup's — the Plugin API page
opens by saying so — and the signature annotates the field as `import('rolldown').OutputBundle`. The
prose is wording that survived the migration. It is worth recognising the pattern rather than the
single instance: in a project mid-migration the machine-checked artefacts track reality faster than
the sentences around them, so when a doc page contradicts its own type block, the type block wins.
Practically it changes nothing about how you read the object, but it does change which package you
import the type from.

**★ Four of the six context fields have no prose description. How does that change how you use them?**
It makes them safe to read and unsafe to build contracts on. `server` and `bundle` are described, so
branching on them is a documented behaviour that a future version would have to deprecate loudly.
`path`, `filename`, `chunk` and `originalUrl` carry types and nothing else, so any statement about
what they contain is inference — reasonable inference, but not something to encode as a comment
asserting a fact, and not something to build a public plugin option on. The practical rule is to use
them for best-effort behaviour with a fallback, never as the sole input to something that must be
correct, and to say in the code that the semantics are unverified.

**★ Why is a hard-coded asset filename a worse bug than it looks?**
Because every layer that could catch it is looking somewhere else. TypeScript sees a valid string.
The build succeeds, since nothing validates that an `href` resolves. The dev server serves unhashed
paths, so it works locally. In production the browser fetches a 404 and reports an *unused preload*
warning, which describes the symptom rather than the cause and points a reader at deleting the tag.
Meanwhile the optimisation the plugin exists to provide has silently not happened for however long.
Reading the name out of `ctx.bundle` removes the whole class, and it is three lines.

---

← [When `transformIndexHtml` Runs](01nc-html-hook-execution-contract.md) · [Vite overview](../../README.md) · Next → [`handleHotUpdate`](01o-handle-hot-update.md)
