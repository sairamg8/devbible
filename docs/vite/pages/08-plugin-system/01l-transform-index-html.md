---
title: "`transformIndexHtml`: the `order` That Decides Whether Vite Processes Your Injection"
sidebar_label: "`transformIndexHtml`"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `transformIndexHtml`

* **Type:** `IndexHtmlTransformHook | { order?: 'pre' | 'post', handler: IndexHtmlTransformHook }`
* **Kind:** `async`, `sequential` · **Scope:** Per-environment

> *"Dedicated hook for transforming HTML entry point files such as `index.html`. The hook receives the current HTML string and a transform context. The context exposes the [`ViteDevServer`](https://vite.dev/guide/api-javascript#vitedevserver) instance during dev, and exposes the Rollup output bundle during build."* — [Plugin API](https://vite.dev/guide/api-plugin)

---

## 1. Under-The-Hood Mechanics

### 🔴 `order` decides whether Vite processes what you inject

> *"By default `order` is `undefined`, with this hook applied **after** the HTML has been transformed. In order to inject a script that should go through the Vite plugins pipeline, `order: 'pre'` will apply the hook **before** processing the HTML. `order: 'post'` applies the hook after all hooks with `order` undefined are applied."*

```
order: 'pre'      → BEFORE Vite processes the HTML.
                    An injected <script src="/src/x.ts"> IS resolved, transformed
                    and rewritten to a hashed asset. Use this to inject real modules.

order: undefined  → AFTER processing. (the default)
                    An injected <script src="/src/x.ts"> is NOT processed —
                    it stays a literal string in the output.

order: 'post'     → after every undefined-order hook.
```

**This is the single most common `transformIndexHtml` bug.** Injecting a module script with the
default order produces markup that references a path which exists in dev (the dev server resolves
it) and 404s in the build (nothing emitted it). The symptom is a white screen in production only.

### The context

```ts
ctx: {
  path: string
  filename: string
  server?: ViteDevServer                     // dev only
  bundle?: import('rolldown').OutputBundle   // build only
  chunk?: import('rolldown').OutputChunk     // build only
  originalUrl?: string
}
```

`server` and `bundle` are the same dev/build asymmetry as everywhere else: **exactly one of them is
present**, and a plugin reading `ctx.bundle` unconditionally throws in dev.

### ⚠️ The framework caveat

> *"This hook won't be called if you are using a framework that has custom handling of entry files (for example [SvelteKit](https://github.com/sveltejs/kit/discussions/8269#discussioncomment-4509145))."*

Not "behaves differently" — **not called at all**. A plugin that works in a plain Vite app can be
completely inert under a meta-framework, with no error.

---

## 2. Real-World Engineering Scenario

**A consent script that loaded in dev and 404'd in production.**

A team injected a consent-management module before the app booted:

```ts
transformIndexHtml(html) {
  return html.replace('</head>', `<script type="module" src="/src/consent.ts"></script></head>`);
}
```

In dev it worked perfectly: the dev server resolves `/src/consent.ts` on request, transforms the
TypeScript and serves it. The consent banner appeared, the flow was tested, the feature shipped.

In production the browser requested `/src/consent.ts` and got a 404 — because nothing had told the
build that file was an entry. The default `order` is `undefined`, which the docs define as *"applied
after the HTML has been transformed"*, so Vite never saw the script tag and never emitted the
module.

The failure was invisible to every check: the HTML was valid, the build succeeded, no console error
appeared in dev, and the production error was a network 404 on a `<script>` tag — which reports as a
silent no-op rather than an exception. Consent was simply not collected for four days.

Two things were wrong, and both matter:

- **`order: 'pre'`** was required, so the injection goes *through* the Vite pipeline and the module
  is resolved and emitted.
- **`html.replace`** should have been a tag descriptor — [chunk 1m](01m-html-tag-descriptors.md) —
  so there is no anchor string to be missing and no escaping to get wrong.

**The transferable point:** when a hook's default is "run after the tool has finished", anything you
add is outside the tool's processing — so ask, for every injection, whether it needs to be *seen* or
merely *present*.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Injecting a MODULE that Vite must resolve, transform and emit.
//    `order: 'pre'` is mandatory here — without it the path 404s in production.
import type { Plugin } from 'vite';

export function consentScript(): Plugin {
  return {
    name: 'consent-script',
    transformIndexHtml: {
      order: 'pre',                      // 🔴 before Vite processes the HTML
      handler() {
        return [{
          tag: 'script',
          attrs: { type: 'module', src: '/src/consent.ts' },
          injectTo: 'head',              // default would be 'head-prepend'
        }];
      },
    },
  };
}
```

```typescript
// The dev/build asymmetry in the context: exactly ONE of these is present.
export function reportEntry(): Plugin {
  return {
    name: 'report-entry',
    transformIndexHtml(html, ctx) {
      if (ctx.server) {
        // dev: no bundle exists
      } else if (ctx.bundle) {
        // build: inspect emitted chunks — e.g. to preload a specific asset
        const entry = Object.values(ctx.bundle).find(
          (f) => f.type === 'chunk' && f.isEntry,
        );
        if (entry) return [{ tag: 'link',
          attrs: { rel: 'modulepreload', href: `/${entry.fileName}` }, injectTo: 'head' }];
      }
      return html;
    },
  };
}
```

```typescript
// ⛔ The anti-pattern this page exists to prevent.
transformIndexHtml(html) {
  //  - default order → Vite never processes the injected module → 404 in prod
  //  - string replace → no escaping, breaks if '</head>' is absent or doubled
  return html.replace('</head>', `<script type="module" src="/src/consent.ts"></script></head>`);
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Injecting a module with the default `order`

The default is *after* HTML processing, so Vite never sees the tag and never emits the module. It
resolves in dev and 404s in the build — production-only, and silent.

### ⚠️ Pitfall 2 — Reading `ctx.bundle` unconditionally

It exists only in a build; `ctx.server` only in dev. The same dev/build asymmetry as
[`configureServer`](01j-storing-the-server.md), in a different hook.

### ⚠️ Pitfall 3 — Assuming the hook runs under a meta-framework

*"This hook won't be called if you are using a framework that has custom handling of entry files."*
Not called at all, with no error — a plugin can be entirely inert.

### ⚠️ Pitfall 4 — Forgetting it is per-environment

Unlike `configureServer`, this hook is **Per-environment** scope, so it runs for the client and SSR
graphs separately. An injection that should happen once can happen twice.

---

## Gotchas

**★ Symptom: an injected module script works in dev and 404s in production.** Cause: the default `order` is `undefined`, i.e. *after* the HTML is processed, so Vite never resolved or emitted the module. Fix: `order: 'pre'`.

```ts
transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', attrs: { type: 'module', src: '/src/x.ts' } }] }
```

**★ Symptom: a plugin reading `ctx.bundle` throws in dev.** Cause: the bundle exists only during a build; dev gets `ctx.server` instead. Fix: branch on which is present, and decide what dev should do rather than skipping silently.

**★ Symptom: a `transformIndexHtml` plugin does nothing under SvelteKit or a similar framework.** Cause: *"This hook won't be called if you are using a framework that has custom handling of entry files."* Fix: use the framework's own entry-transformation mechanism; there is nothing to configure on the Vite side.

**★ Symptom: an injected analytics tag appears twice.** Cause: the hook is **Per-environment**, so it runs for the client and SSR graphs. Fix: guard on `this.environment`, or inject only in the environment that actually emits the HTML the user receives.

**★ Symptom: a `modulepreload` link points at a file that does not exist.** Cause: a filename read from `ctx.bundle` was used without the base prefix, or was read in dev where no bundle exists. Fix: prefix with `import.meta.env.BASE_URL`'s configured `base`, and only emit the tag on the build path.

**★ Symptom: two plugins both transform the HTML and the second sees unexpected input.** Cause: the hook is `sequential`, so plugins run in order — and `order: 'pre' | undefined | 'post'` puts them in different phases entirely. Fix: this is deterministic but three-layered (plugin order, then `enforce`, then hook `order`); if two transforms depend on each other, put them in one plugin.

---

## Interview questions

**★ Why does an injected `<script type="module">` work in dev and 404 in production?**
Because the default `order` is `undefined`, which the docs define as the hook being *"applied after
the HTML has been transformed"*. So Vite never sees the tag, never resolves the module and never
emits it. In dev that is invisible: the dev server serves `/src/consent.ts` on request because it
serves any source path on request, so the script loads and the feature appears to work. In the build
there is nothing to serve. The fix is `order: 'pre'`, which *"will apply the hook before processing
the HTML"* so the injection goes through the plugin pipeline. The general question to ask for any
injection is whether the thing you are adding needs to be **seen** by the tool or merely **present**
in the output.

**★ What is in the hook's context, and what is the trap?**
`path`, `filename`, `originalUrl`, plus `server` in dev and `bundle`/`chunk` in a build. The trap is
that **exactly one** side is present: `ctx.server` is undefined during `vite build` and `ctx.bundle`
is undefined during `vite`. It is the same dev/build asymmetry as the stored dev server in
`configureServer`, and it produces the same failure — a plugin that reads the build-only field
unconditionally throws in dev, or vice versa. It is also genuinely useful: `ctx.bundle` lets you
inject `modulepreload` links for real emitted filenames, which is not possible from dev.

**★ When does `transformIndexHtml` not run at all?**
*"This hook won't be called if you are using a framework that has custom handling of entry files"* —
the docs name SvelteKit. That is a stronger statement than "behaves differently": a plugin can be
entirely inert with no error, no warning and a perfectly healthy build. It is worth knowing because
the debugging instinct is to check plugin order, `order`, `apply` and `enforce` — four mechanisms
that all look plausible — when the actual answer is that the framework owns the entry and Vite's
HTML pipeline is not in the picture at all.

**★ This hook is per-environment. What does that change?**
That it runs separately for the client and SSR graphs, unlike `configureServer` and `config`, which
are Global. So an injection that should appear once — an analytics tag, a consent script — can be
emitted twice in an SSR app, and the duplicate is easy to miss because the page still works. The fix
is to branch on `this.environment` or to inject only in the environment that produces the HTML a
user actually receives. It is a good illustration of why the **Scope** line on each hook is worth
reading rather than assuming: the Vite-specific hooks do not share one rule.

---

← [The Guard Is Not the Fix](01k-the-guard-is-not-the-fix.md) · [Vite overview](../../README.md) · Next → [HTML Tag Descriptors](01m-html-tag-descriptors.md)
