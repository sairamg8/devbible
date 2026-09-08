---
title: "There is no resolve.builtins option because Vite deliberately does not polyfill Node — import fs from 'node:fs' in client code is a resolution failure to fix, not a config knob to reach for"
sidebar_label: "01j · Node built-ins in the browser"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options) (the full `resolve.*` option list), [Troubleshooting — Module externalized for browser compatibility](https://vite.dev/guide/troubleshooting#others). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Node Built-ins in Browser Code: No `resolve.builtins`, No Polyfill

**Webpack ships a `resolve.fallback`/`node` mechanism (and older versions auto-polyfilled
Node core modules); Vite has neither. There is no `resolve.builtins` option in the Vite
config surface — confirmed by its absence from the full, current `resolve.*` option list —
because Vite's answer to `import fs from 'node:fs'` in client code is not "here is a browser
shim," it is "this import should not exist in this bundle, and here is a warning telling you
so." Treating the resulting warning as a bug to polyfill around, instead of a resolution
failure to fix at the source, is the single most common Node-built-ins mistake.**

## Confirming the option does not exist, rather than assuming it

Vite's shared configuration reference documents every `resolve.*` option: `alias`,
`dedupe`, `conditions`, `mainFields`, `extensions`, `preserveSymlinks`, `tsconfigPaths`.
There is no `resolve.builtins` entry among them. This is worth stating as a checked fact,
not an assumption, because the shape of the missing option is exactly what a webpack
migrator expects to find and go looking for — webpack's own `resolve.fallback` exists
precisely to configure per-built-in polyfill or exclusion behaviour, and no equivalent knob
exists on the Vite side to configure.

## What actually happens when browser code imports a Node built-in

Vite does not error immediately at config time. It resolves the specifier — `fs`, `node:fs`,
`path`, `crypto`, and the rest of Node's built-in module list are all recognised specifiers —
and then externalises it, replacing the module with an empty stand-in and warning loudly:

> *"When you use a Node.js module in the browser, Vite will output the following warning."*

The warning text itself, quoted from the troubleshooting guide (`Module "fs" has been
externalized for browser compatibility. Cannot access "fs.readFile" in client code.`), names
both the module and the exact property access that will fail. The mechanism is stated
directly:

> *"This is because Vite does not automatically polyfill Node.js modules."*

And the guidance is not "configure a polyfill" — it is to remove the dependency on Node
entirely:

> *"We recommend avoiding Node.js modules for browser code to reduce the bundle size,
> although you can add polyfills manually. If the module is imported from a third-party
> library (that's meant to be used in the browser), it's advised to report the issue to the
> respective library."*

```js
// src/report-generator.ts — client-side code, imported by a component
import fs from 'node:fs'          // resolves, then gets externalized with a warning
import path from 'node:path'      // same

export function loadTemplate(name: string) {
  // fs.readFile is now `undefined` on the externalized stub — this throws at runtime,
  // not at build time, which is why it often ships before anyone notices.
  return fs.readFileSync(path.join('templates', name), 'utf-8')
}
```

The build does not fail. The dev server does not fail. The failure surfaces the first time
that code path actually runs in a browser, as a runtime `TypeError` on an `undefined`
method — which is precisely why this class of bug reaches production more often than a hard
resolution error would.

## Why "just add a polyfill" is usually the wrong instinct

A Node built-in in client code is almost always a *symptom* that server-only logic leaked
into a module the client bundle pulls in — a shared utility file that imports both a
browser-safe helper and a Node-only one, or a barrel `index.ts` that re-exports everything
from a package regardless of which half a given consumer needs. Polyfilling `fs` for the
browser does not give you a real filesystem; it gives you a shim that satisfies the import
but cannot do what the original code wanted, so the fix papers over a design problem rather
than solving it.

## The three fixes that are actually correct

**1 — Move the Node-only logic server-side, and call it over the network.**

```ts
// server/routes/templates.ts — an actual server, or a Vite SSR/API route
import fs from 'node:fs'
import path from 'node:path'

export function loadTemplate(name: string) {
  return fs.readFileSync(path.join('templates', name), 'utf-8')
}
```

```ts
// src/report-generator.ts — client code now fetches instead of reading a filesystem
export async function loadTemplate(name: string): Promise<string> {
  const response = await fetch(`/api/templates/${encodeURIComponent(name)}`)
  return response.text()
}
```

This is the correct fix whenever the Node built-in was doing something a browser
fundamentally cannot do — reading arbitrary files, spawning processes, opening sockets.
There is no client-side equivalent to reach for; the capability itself is server-only.

**2 — Stub the import with `resolve.alias` when a dependency imports a Node built-in on a code path the client never actually executes.**

```js
// vite.config.js — a dependency conditionally imports 'node:crypto' behind a runtime
// check that always evaluates false in the browser, but Vite still has to resolve
// the static import at build time
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      'node:crypto': new URL('./src/shims/empty-crypto.ts', import.meta.url).pathname,
    },
  },
})
```

```ts
// src/shims/empty-crypto.ts — the stub the alias points at
export default {}
```

This is only correct when the import is genuinely dead code on the client path — verify
that before aliasing it away, because a real runtime call into a stubbed-out module fails
exactly like the unaliased case, just with a different, more confusing error.

**3 — `optimizeDeps.exclude` when the built-in import is the pre-bundler's problem, not the browser's.**

A CJS dependency that Vite pre-bundles for dev can trip the built-in warning during the
pre-bundling scan itself, before your own code ever runs, if the dependency's package
entry point statically requires a Node module even though the code path using it is never
reached in your usage. Excluding it from pre-bundling stops Vite's own scanner from walking
into that file — the mechanics of `optimizeDeps.include`/`exclude` and when exclusion is
and is not correct are covered in
[../11-optimization-and-performance/01a-dependency-pre-bundling.md](../11-optimization-and-performance/01a-dependency-pre-bundling.md); the standing warning
there — *"CommonJS dependencies should not be excluded from optimization"* as a blanket rule
— still applies. This fix is narrow: it addresses the pre-bundler tripping over a Node
import during its dev-time scan, not a genuine runtime need for that module in the browser.

## The one case where nothing needs to be fixed: server-only code that never ships

If the Node-built-in import lives in code that only ever runs during SSR (a loader, a data
function, an API route bundled as part of the SSR entry) and never in a module the client
graph reaches, there is no bug — the warning only fires for code Vite is actually trying to
put in the **client** bundle. Confirm which environment's build graph pulled the file in
before treating the warning as something to fix; the externalisation mechanics that
determine what each build type actually bundles are covered in
[01k](01k-externalization-and-the-two-builds.md).

## Gotchas

**★ Symptom: `Module "fs" has been externalized for browser compatibility` appears in the console, but the app "still works" — until a specific button is clicked.** Cause: the
externalised stub is an empty object; any property access on it (`fs.readFile`,
`fs.readFileSync`) is `undefined`, so the failure is deferred to the first actual call, not
the import itself. Fix: trace which code path calls the stubbed method and apply one of the
three real fixes above — never treat "no error at import time" as "this is fine."

**★ Symptom: someone installs `vite-plugin-node-polyfills` (or hand-rolls a `Buffer`/`process` shim) to make the warning go away.** Cause: treating a design smell — Node logic
reachable from client code — as a missing feature to add. Fix: a polyfill for `Buffer` or
`process.env` can be legitimate for a narrow, well-understood case (a crypto library that
only touches `Buffer` for base64 encoding, say), but it should be a deliberate, scoped
decision after confirming the Node API is only used for something browser-implementable —
not a reflex applied to every warning. For anything that needs the real filesystem, real
processes, or real sockets, no polyfill can provide the actual capability; move the code
server-side instead.

**★ Symptom: `resolve.builtins` is set in a config file (copied from a webpack migration guide or an LLM-generated snippet) and produces no error, but also does nothing.** Cause:
the option does not exist in Vite's config schema — confirmed by its absence from the
documented `resolve.*` list — so Vite silently ignores an unknown key rather than throwing.
Fix: delete it; the equivalent decisions are made per-import via `resolve.alias`, per-package
via `optimizeDeps.exclude`, or architecturally by moving the code server-side.

**★ Symptom: a third-party UI library that markets itself as "works everywhere" imports a Node built-in and breaks the client bundle.** Cause: the library was authored primarily for
Node/SSR use, or has an internal code path (often a debug or telemetry hook) that imports a
built-in unconditionally at module scope instead of behind a runtime check. Fix: per the
docs' own guidance — *"it's advised to report the issue to the respective library"* — this is
frequently a genuine bug in the dependency; a `resolve.alias` stub is the short-term
workaround while a real fix or a patched version lands upstream.

## Interview questions

**★ Why doesn't Vite offer a `resolve.builtins` option the way webpack's `resolve.fallback` does?**
Because the two tools take opposite positions on the same problem. Webpack's fallback exists
so a Node-authored dependency graph can still ship to a browser by substituting community
polyfills for `fs`, `path`, `crypto`, and so on — treating "browser bundle contains
Node-shaped code" as a normal, supportable case. Vite's position, stated directly in its own
docs, is that it *"does not automatically polyfill Node.js modules"* and the recommended
response to finding one in client code is to avoid it, not shim it. Given that stance, a
config surface for choosing which polyfill to use for which built-in would contradict the
tool's own guidance, so it was never built.

**★ A Node built-in import in client code doesn't fail the build or the dev server. Where does it actually fail, and why does that matter for catching it early?**
It fails at runtime, the first time a stubbed-out method is actually called — the import
itself resolves to Vite's externalised, empty-object stand-in, so `import fs from 'node:fs'`
succeeds and `fs.readFileSync(...)` throws a `TypeError` on `undefined` later, possibly deep
in a rarely-exercised code path. This matters because the compile-time warning
(`Module "fs" has been externalized...`) is the only signal available before that runtime
failure, and it is easy to miss in noisy dev-server output or to see once and dismiss as
"probably fine." Treating that warning as build-breaking in local development — grepping for
it in CI output, say — catches the class of bug before a user does.

**★ When is stubbing a Node built-in with `resolve.alias` the correct fix, versus a sign something is architecturally wrong?**
It is correct exactly when the import is unreachable dead code on the client path — a
dependency that statically imports `node:crypto` behind a `typeof window === 'undefined'`
guard that always evaluates false in the browser, for instance, where the module is never
actually invoked but Vite still has to resolve the static `import` at build time to produce
a bundle. It is a design smell, not a fix, when the code genuinely needs the built-in's real
behaviour on the client — no alias supplies actual filesystem or process access, so aliasing
in that case only defers the failure from a clear resolution warning to a confusing runtime
one once the stub's missing methods get called.

---

← [01i · mainFields & browser field](01i-resolve-mainfields-and-the-browser-field.md) · [Vite overview](../../README.md) · Next → [01k · Externalisation & the two builds](01k-externalization-and-the-two-builds.md)
