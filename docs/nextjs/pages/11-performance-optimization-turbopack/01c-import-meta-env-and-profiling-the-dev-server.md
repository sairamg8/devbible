---
title: "`import.meta.env` is not a way to read environment variables — it is five compile-time constants that let Turbopack delete code you never wanted to ship"
sidebar_label: "01c · Build-time constants and profiling"
sidebar_position: 101
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-08-03`). Documentation-verified;
> **no timings, no sandbox run**. Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**The name `import.meta.env` invites exactly the wrong mental model.** It looks like an environment-variable bag
borrowed from Vite, and people reach for `import.meta.env.VITE_API_URL` on that basis. It is not that. It is five
fixed properties, injected at compile time, whose entire value is that Turbopack can **prove** what they are and
delete the branches that cannot be reached. Used correctly it removes code from the client bundle; used as an env
bag it returns `undefined`. This page covers those five constants, the dead-branch elimination they enable, and the
one documented way to profile Turbopack itself when the dev server misbehaves.

## The five properties, and nothing else

```ts
// app/example.ts
if (import.meta.env.DEV) {
  console.log('development mode')
}
```

You can also read the whole object, destructure it, or use static bracket access:

```ts
// app/example.ts
const { MODE, SSR } = import.meta.env
const baseUrl = import.meta.env['BASE_URL']
```

| Property | Type | Value, verbatim |
|---|---|---|
| `DEV` | `boolean` | *"Whether `MODE` is not `\"production\"`"* |
| `PROD` | `boolean` | *"Whether `MODE` is `\"production\"`"* |
| `MODE` | `string` | *"The compile-time `NODE_ENV`, defaulting to `\"development\"`"* |
| `BASE_URL` | `string` | *"The Next.js `basePath`, with a trailing slash (`\"/\"` by default)"* |
| `SSR` | `boolean` | *"`true` in server bundles and `false` in browser and client bundles"* |

Three details in that table are easy to skim past and each one is load-bearing:

- **`DEV` is defined negatively.** It is *not-production*, not *is-development*. A custom `NODE_ENV` such as
  `staging` therefore makes `DEV` true and `PROD` false — both at once, in an environment that is neither.
- **`MODE` is the *compile-time* `NODE_ENV`**, baked in when the bundle was produced. Changing `NODE_ENV` at runtime
  cannot move it.
- **`BASE_URL` carries a trailing slash**, and defaults to `"/"`. Concatenating it with a path that also starts with
  a slash produces a double slash.

## Why this is a performance feature, not a convenience

> *"These values are statically analyzed, so Turbopack can remove unreachable branches"*

That single sentence is the whole point. A `if (import.meta.env.DEV)` block is **not** a runtime check costing a
branch — it is a compile-time constant, so the entire block is eliminated from the production bundle and the code
inside it never ships. Development-only assertions, verbose logging and debug panels can live directly in the source
without being paid for in production bytes.

`SSR` is the most valuable member for bundle size. It lets a server-only branch be dropped from the client bundle
without splitting the module into two files:

```ts
// lib/report.ts — the server branch never reaches the browser bundle
import { writeToServerLog } from './server-log'

export function report(event: string) {
  if (import.meta.env.SSR) {
    writeToServerLog(event)
  } else {
    navigator.sendBeacon('/analytics', event)
  }
}
```

**Compare that to the alternative.** Without a statically-analysable constant, keeping server-only code out of a
shared module means either two files and an import indirection, or shipping the server branch to every browser that
loads the page. Here the client bundle contains only the `sendBeacon` call, and `writeToServerLog` is never
referenced from it — so its import is dropped too.

🔴 **The elimination depends on the expression being statically analysable.** Reading a property directly, or via
static bracket access with a literal key, is what the docs demonstrate. Reaching the same value through a variable,
a function return or a computed key gives the analyser nothing to fold, and the branch stays in the bundle:

```ts
// ✅ Foldable — the branch is removed at build time
if (import.meta.env.SSR) { serverOnly() }

// ❌ Not foldable — the whole object is captured first, so both branches ship
const env = import.meta.env
if (env.SSR) { serverOnly() }
```

## It is Vite-shaped, not Vite

> *"`import.meta.env` requires Turbopack. Custom `VITE_*` variables, Vite custom modes, `envPrefix`, and `envDir` are not supported. `BASE_URL` reflects the Next.js `basePath` configuration and includes a trailing slash to match Vite's format."*

⚠️ **The resemblance is deliberate and partial, which is exactly why it misleads.** Four things a Vite user expects
are named as unsupported: custom `VITE_*` variables, custom modes, `envPrefix` and `envDir`. Next.js keeps its own
environment-variable mechanism, and that is what you use for application configuration:

```ts
// ❌ Not a thing in Next.js — returns undefined
const url = import.meta.env.VITE_API_URL

// ✅ NEXT_PUBLIC_ is inlined at build time for client bundles
const url = process.env.NEXT_PUBLIC_API_URL
```

Two further constraints worth stating plainly: **`import.meta.env` requires Turbopack**, so a build opted back to
webpack with `--webpack` does not have it; and it is a *Next.js/Turbopack* feature, so it does not exist in a plain
Node process running your code outside a build.

`import.meta.glob` is the sibling Vite-compatible API and is covered in full at
[10 · Glob imports with `import.meta.glob`](10-glob-imports-with-import-meta-glob.md).

## Profiling Turbopack itself

> *"If you encounter performance or memory issues and want to help the Next.js team diagnose them, you can generate a trace file by adding the `--internal-trace` flag to your dev command"*

```bash
next dev --internal-trace
```

> *"This will produce a `.next-profiles/trace-turbopack.bin` file. Include that file when creating a GitHub issue on the Next.js repo to help us investigate."*

This is the documented path for *"the dev server got slow and I cannot explain it"*. Two things to be clear about
before you plan a debugging session around it:

- **It is a bug-report artefact, not a tool you read.** The file is binary and the documentation describes no local
  reader for it. Attach it to a GitHub issue; do not expect to analyse it yourself.
- **It is not a substitute for local bisection.** Disabling an unnecessary Babel config, clearing a stale `.next`,
  or removing a suspect loader will identify most self-inflicted slowness faster than a maintainer round-trip.

## Gotchas

**★ Symptom: `import.meta.env.VITE_API_URL` is `undefined`.** Cause: the API is Vite-*compatible*, not Vite —
*"Custom `VITE_*` variables, Vite custom modes, `envPrefix`, and `envDir` are not supported."* Only `DEV`, `PROD`,
`MODE`, `BASE_URL` and `SSR` exist. Fix: use Next.js's own environment handling.

```ts
// ❌ undefined
const url = import.meta.env.VITE_API_URL

// ✅
const url = process.env.NEXT_PUBLIC_API_URL
```

**★ Symptom: a development-only debug block still appears in the production bundle.** Cause: the condition was not
statically analysable, so there was no constant to fold and no unreachable branch to remove. Capturing
`import.meta.env` into a variable first is the usual way this happens. Fix: reference the property directly at the
point of the check.

```ts
// ❌ Both branches ship
const env = import.meta.env
if (env.DEV) { mountDebugPanel() }

// ✅ The call is eliminated from the production bundle
if (import.meta.env.DEV) { mountDebugPanel() }
```

**★ Symptom: a URL built from `BASE_URL` contains a double slash.** Cause: *"`BASE_URL` — The Next.js `basePath`,
with a trailing slash"*, defaulting to `"/"`. Joining it to a path that also begins with `/` yields `//`. Fix: strip
one side, or join deliberately.

```ts
// ❌ "/app//dashboard"
const href = `${import.meta.env.BASE_URL}/dashboard`

// ✅ "/app/dashboard"
const href = `${import.meta.env.BASE_URL}dashboard`
```

**★ Symptom: `DEV` and `PROD` are both wrong in a staging build.** Cause: `DEV` is defined as *"Whether `MODE` is not
`\"production\"`"* — it is not-production rather than is-development. With `NODE_ENV=staging`, `DEV` is `true` and
`PROD` is `false`, so a staging build takes every development branch. Fix: never infer a deployment environment from
these; test `MODE` explicitly, or use your own variable.

```ts
// ❌ True in staging as well as development
if (import.meta.env.DEV) { useMockPayments() }

// ✅ Say what you actually mean
if (import.meta.env.MODE === 'development') { useMockPayments() }
```

**Symptom: `import.meta.env` is `undefined` in a build that used to work.** Cause: *"`import.meta.env` requires
Turbopack."* A build opted back to webpack — commonly to keep a webpack plugin alive — loses the API entirely. Fix:
either keep that build on Turbopack, or stop depending on the constants in code that must build under both.

**Symptom: changing `NODE_ENV` on the server does not change `MODE`.** Cause: it is *"The compile-time `NODE_ENV`"* —
inlined when the bundle was produced, not read at startup. Fix: treat it as a build input. Anything that must vary
per deployment of the same artefact needs a runtime mechanism instead, which for Next.js means a server-side
`process.env` read rather than a compile-time constant.

**Symptom: you generated a trace file and cannot open it.** Cause: `--internal-trace` writes
`.next-profiles/trace-turbopack.bin`, a binary artefact intended for the Next.js maintainers; the docs name no local
reader. Fix: attach it to a GitHub issue, and narrow the cause locally by bisection in the meantime.

## Interview questions

**★ Why can `import.meta.env.DEV` be cheaper than `process.env.NODE_ENV === 'development'`?**
Because it is documented as statically analysed: *"These values are statically analyzed, so Turbopack can remove
unreachable branches."* The condition is resolved at compile time and the dead branch is eliminated from the bundle
entirely, so the code inside never ships. The comparison is not about the speed of the check — both are effectively
free at runtime — but about whether the guarded code is present in the artefact at all.

**★ How would you keep server-only logic in a shared module without shipping it to the browser?**
Guard it with `import.meta.env.SSR`, which is documented as *"`true` in server bundles and `false` in browser and
client bundles"*. Because the value is a compile-time constant per bundle, the client build folds the condition to
`false` and removes the branch, and any import used only inside that branch goes with it. The alternative — two
files and an import indirection — achieves the same result with more structure; the constant lets one module serve
both environments honestly.

**★ A staging deployment is behaving as if it were a development build. What is the likely cause?**
`DEV` is defined negatively: *"Whether `MODE` is not `\"production\"`"*. Any `NODE_ENV` that is not exactly
`production` — `staging`, `test`, `qa` — makes `DEV` true and `PROD` false simultaneously, so every
development-guarded branch activates. The fix is to stop treating `DEV`/`PROD` as a three-way environment switch and
compare `MODE` explicitly, or carry a separate variable for deployment environment.

**Someone describes `import.meta.env` as "Next.js's version of Vite's env". What is wrong with that?**
It borrows the shape and almost none of the mechanism. The docs name four Vite features as unsupported — custom
`VITE_*` variables, custom modes, `envPrefix` and `envDir` — leaving five fixed properties with no user-extensible
surface. It is a set of build-time constants for dead-code elimination, not a configuration channel. Application
configuration still goes through Next.js's own environment handling, with `NEXT_PUBLIC_` for values that may reach
the client.

**Why does capturing `import.meta.env` into a variable defeat the optimisation?**
The elimination is a static analysis over the expression at the point of use: the compiler needs to see a property
access it can replace with a literal. Assigning the object to a variable turns the later check into an ordinary
runtime property read on a value the analyser must treat as opaque, so there is no constant to fold and no branch it
can prove unreachable. Both branches then survive into the bundle — which is silent, since the code still behaves
correctly and only the bundle size betrays it.

**What is `--internal-trace` for, and what is it not for?**
It is for handing the Next.js maintainers a profile when the dev server has performance or memory problems you
cannot explain; it writes `.next-profiles/trace-turbopack.bin` for attachment to a GitHub issue. It is not a local
profiling tool — the artefact is binary and the documentation describes no reader — so it does not replace ordinary
bisection. Check for an unnecessary Babel config, a stale `.next`, or a suspect loader first, because those account
for most self-inflicted slowness and cost nothing to test.

---

← [01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md) · [Chapter index](01-explanation.md) · Next → [02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md)
