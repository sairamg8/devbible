---
title: "server-only is a tripwire the compiler checks by name, not a library that does anything — it turns 'this secret quietly reached the browser' from a runtime mystery into a build failure, and understanding what it does not cover is the part that keeps you safe"
sidebar_label: "05 · server-only / client-only"
sidebar_position: 6
description: "The practice of poisoning modules: where to place the import, the exact build errors Next.js emits, and the seven-specifier list the compiler actually enforces."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25), quotes banked in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md); and against the enforcement itself in the Next.js compiler source — [`crates/next-custom-transforms/src/transforms/react_server_components.rs`](https://github.com/vercel/next.js/blob/canary/crates/next-custom-transforms/src/transforms/react_server_components.rs) (`canary`, read 2026-09-04), which is where the specifier lists and the error strings live.
> Target: **Next.js 16.3.4**, App Router. Documentation- and source-verified; **no sandbox run**; **no build run** — every error string below is quoted from the compiler source, never reconstructed.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**The `'use client'` rule from [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) tells you which modules end up in the browser. It does not tell you when you have made a mistake — a data-access module that drifts into the client graph produces no error, because JavaScript that reads `process.env.DATABASE_URL` is perfectly valid JavaScript in a browser. It just reads an empty string. `server-only` closes that gap by giving the compiler a name to look for: a specifier it refuses to resolve inside the client graph. That is the entire mechanism. It is not a runtime guard, it does not strip anything and it does not encrypt anything. This page is about using it as the tripwire it is; [05b](05b-what-server-only-does-not-protect.md) is about the five leaks it is structurally incapable of catching.**

## What the compiler actually enforces

Next.js does not run the `server-only` package. The documentation says so directly:

> *"the contents of these packages from NPM are not used by Next.js"*

The enforcement is a **name check inside the SWC transform that processes every module for the RSC graph.** Two lists, verbatim from `react_server_components.rs`:

```rust
invalid_client_imports: vec![
    atom!("server-only").into(),
    atom!("next/headers").into(),
    atom!("next/root-params").into(),
],
```

```rust
invalid_server_imports: vec![
    atom!("client-only").into(),
    atom!("react-dom/client").into(),
    atom!("react-dom/server").into(),
    atom!("next/router").into(),
],
```

Read those carefully, because three things fall straight out of them:

1. **`server-only` is not special software. It is a special string.** The compiler is matching a module specifier. That is why the npm package's contents are irrelevant, and why you cannot write your own equivalent — `import '@acme/server-only'` gets you nothing at all. Only these seven names are wired in.
2. **`next/headers` and `next/root-params` are enforced by the same machinery.** So `cookies()` in a Client Component is not a runtime `undefined`; it is the same build-time class of failure as a `server-only` violation, with the same error text. (`next/root-params` is the 16.3 addition — see [chapter 1 · 03b](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md).)
3. **The reverse direction is real and people forget it.** `react-dom/server` and `next/router` in a Server Component fail for the same reason `client-only` does. If you have ever wondered why a stray `next/router` import from a half-migrated Pages Router file produces a boundary error rather than "module not found", this is why.

## The two error messages, verbatim

**Server-side module pulled into the client graph** — this is what a `server-only` violation reads like, quoted from the compiler source with `{source}` being the offending specifier:

> *"You're importing a module that depends on `"{source}"` into a React Client Component module. This API is only available in Server Components but one of its parents is marked with "use client", so this module is also a Client Component."*
>
> *"Learn more: https://nextjs.org/docs/app/building-your-application/rendering"*

**Client-side module pulled into the server graph** — the `client-only` violation:

> *"You're importing a component that imports `{source}`. It only works in a Client Component but none of its parents are marked with "use client", so they're Server Components by default."*
>
> *"Learn more: https://nextjs.org/docs/app/building-your-application/rendering"*

🔴 **The phrase that matters is *"a module that depends on"*.** The error is not restricted to the file that wrote the import — it is reported for a module that reaches the poisoned specifier through the graph. That is the property that makes the technique worth using: you poison one module at the bottom, and every path into it from the client side fails, however many hops away.

⚠️ The transform emits a **different wording** for a file outside the `app/` directory (the source branches on `is_in_app_dir`). I read the branch but did not capture that string in full, so it is not quoted here — expect the Pages Router message to differ in phrasing while meaning the same thing.

## Where to put the import — one rule

**Poison the module that owns the dangerous thing, not the modules that use it.**

```ts
// lib/db.ts — the only module in the app that constructs a database client
import 'server-only'

import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
```

```ts
// lib/orders.ts — no directive, no poison pill needed
import { pool } from './db'

export async function getOrdersForUser(userId: string) {
  const { rows } = await pool.query(
    'select id, total_cents, placed_at from orders where user_id = $1 order by placed_at desc',
    [userId],
  )
  return rows
}
```

`lib/orders.ts` inherits the protection. A Client Component that imports `getOrdersForUser` fails the build with the message above naming `server-only`, even though `orders.ts` never mentions it. Repeating `import 'server-only'` in every file that touches the database is noise that adds no coverage.

**The mirror image for browser APIs:**

```ts
// lib/analytics-client.ts
import 'client-only'

let queue: Array<Record<string, unknown>> = []

export function track(event: string, props: Record<string, unknown> = {}) {
  queue.push({ event, ...props, url: window.location.href, ts: Date.now() })
  if (queue.length >= 10) flush()
}

export function flush() {
  const body = JSON.stringify(queue)
  queue = []
  navigator.sendBeacon('/api/analytics', body)
}
```

Without `client-only`, importing this into a layout gives you `window is not defined` at build or request time, from a stack that points at the bundler. With it, you get a boundary error naming the file.

### Placement inside the file

It is a **bare side-effect import** — `import 'server-only'`, no binding — and it goes with the other imports at the top. There is no ordering requirement between it and the rest of the import block; what matters is only that it is in the module's import list so the graph records the dependency.

The one placement rule that *is* enforced concerns directives, and it is worth knowing because it produces a confusing error in the same neighbourhood:

> *"The "use client" directive must be placed before other expressions. Move it to the top of the file to resolve this issue."*

A leading comment is fine. A `const` above the directive is not.

Two more from the same source, both about combinations that are simply illegal:

> *"It's not possible to have both "use client" and "use server" directives in the same file."*

> *"It's not possible to have both "use client" and "use cache" directives in the same file."*

## Installing the packages

The documentation calls the packages optional, since the compiler never reads them, and gives one concrete reason to install anyway: *"In Next.js, installing `server-only` or `client-only` is **optional**. However, if your linting rules flag extraneous dependencies, you may install them to avoid issues."* There is a second, sharper reason in a TypeScript project — `import 'server-only'` against a package that is not in `node_modules` is a `Cannot find module` type error, which will be flagged by your editor and by `tsc` even though the build would otherwise proceed. Install them:

```bash
npm install server-only client-only
```

⚠️ **What the documentation does not settle:** whether a *server*-graph build resolves `import 'server-only'` at bundle time or elides it, and therefore whether a missing package breaks a server build as opposed to only the type check. I did not find that stated. Install the packages and the question does not arise; that is the reason to treat "optional" as advice rather than as a plan.

## What this does not protect — read [05b](05b-what-server-only-does-not-protect.md)

The pill guards **one edge**: a module specifier entering the client graph. It does not guard values, and every leak that actually happens crosses a different edge — a secret passed as a prop and serialized into the RSC payload, a module nobody poisoned, a Server Action returning `select *`, an action invoked by someone who should not have been able to, and every tool in your pipeline that is not the Next.js compiler. That is [05b](05b-what-server-only-does-not-protect.md), and it is the half that keeps you out of an incident review.

## Gotchas

**★ Symptom: a build error names `server-only` in a file that does not import it.** Cause: the error is reported for *"a module that depends on"* the specifier, so it fires anywhere along a chain reaching your poisoned module — the file named in the error is the client-graph entry point, not the culprit. Fix: read the chain from the client file downward, and delete the one import that should not be there; do not remove the poison pill.

```ts
// ❌ app/ui/order-total.tsx
'use client'
import { getOrdersForUser } from '@/lib/orders'   // → lib/db.ts → 'server-only'

// ✅ fetch on the server, pass the result down as a serializable prop
```

**★ Symptom: a shared `index.ts` barrel starts failing every client import in the app.** Cause: barrels re-export everything, so one `export * from './db-helpers'` puts `server-only` on the dependency path of every consumer of that barrel — including client ones. Fix: never barrel across the boundary; keep server and client entry points in separate files and import them directly.

```ts
// ❌ lib/index.ts
export * from './format'        // client-safe
export * from './db-helpers'    // imports 'server-only' — poisons every consumer

// ✅ import { formatCents } from '@/lib/format'
```

**★ Symptom: `cookies()` returns nothing in a component and you add a null check.** Cause: it is not returning nothing — `next/headers` is in `invalid_client_imports`, so the import is a build error in a client module, and whatever you are looking at is a different problem. Fix: read request state on the server and pass what the client needs as a prop.

```tsx
// ❌ 'use client' + import { cookies } from 'next/headers'
// ✅ server parent reads it, client child receives it
const theme = (await cookies()).get('theme')?.value ?? 'light'
return <ThemeToggle initialTheme={theme} />
```

**★ Symptom: you add `import 'server-only'` and nothing changes — the client bundle is the same size.** Cause: it is a tripwire, not a stripper. It has no effect on a build that was already correct, and it never removes code. Fix: expect it to be silent until someone makes a mistake; if you wanted the module gone from the bundle, that is a `'use client'` placement question, not this.

**★ Symptom: a third-party package fails the build with a `server-only` error you never wrote.** Cause: the dependency poisons its own server entry point, and you imported it from a client module — the error is correct and the package is telling you it has a server-side entry. Fix: import the package's client entry point instead, or move the call to a server parent.

**Symptom: `client-only` errors on a file that only touches `window` inside an effect.** Cause: `client-only` is not conditional on when the browser API runs — it bars the module from the server graph outright, so a module that would have been safe on the server is now refused. Fix: this is usually correct and worth keeping, but if the module genuinely has a server-safe surface, split it — a `format.ts` with no poison pill and a `dom.ts` with one.

**Symptom: `The "use client" directive must be placed before other expressions.`** Cause: something executable sits above the directive — commonly an import that a formatter or an auto-import moved to the top of the file. Fix: the directive is the first thing in the file after comments; imports go beneath it.

```tsx
// ❌
import { useState } from 'react'
'use client'

// ✅
'use client'
import { useState } from 'react'
```

**Symptom: `It's not possible to have both "use client" and "use server" directives in the same file.`** Cause: a Client Component file that also tried to define a Server Action inline. Fix: the action goes in its own `'use server'` module and is imported by the client file — importing a Server Action across the boundary is a reference, not a module inclusion.

**Symptom: an old `next/router` import in a migrated file gives a boundary error rather than a deprecation notice.** Cause: `next/router` is in `invalid_server_imports`, so in the App Router it reads as a client-only API pulled into a server module. Fix: use `next/navigation` in the App Router; the Pages Router router is not a thing App Router server code can import at all.

**Symptom: you tried to build your own poison pill and it does nothing.** Cause: enforcement is a literal specifier match on seven names. A local module named `server-only.ts`, or a wrapper package that re-exports it, is not on the list and is not checked. Fix: import the real specifier — a wrapper defeats the entire mechanism.

## Interview questions

**★ What does `server-only` actually do?**
Almost nothing, and that is the point worth being able to say out loud. It is a module specifier that the Next.js compiler refuses to allow inside the client module graph — the SWC transform carries a literal list of disallowed client imports containing `server-only`, `next/headers` and `next/root-params`, and it errors when a module in the client graph depends on any of them. The npm package's contents are never executed by Next.js; the documentation states that explicitly. So it is a build-time tripwire keyed on a string, not a library that guards or strips or encrypts anything.

**★ Where do you put the import — every server module, or one?**
One, at the bottom: the module that owns the dangerous resource. The error text is *"a module that depends on"* the specifier, so the check propagates along the dependency graph rather than only firing on the direct importer. Poisoning `lib/db.ts` protects every module that reaches it, however indirectly. Repeating the import in each consumer adds no coverage and makes the eventual error harder to trace, because you can no longer tell which module is the actual owner.

**★ Do you need to install the packages?**
Next.js does not need them — the compiler is matching names and never resolves the module's contents. But you should install them anyway: the documentation's own reason is that *"if your linting rules flag extraneous dependencies, you may install them to avoid issues"*, and in TypeScript an unresolvable bare import is a `Cannot find module` error in your editor and in `tsc` regardless of what the bundler does. The documentation does not state whether a server-graph build would otherwise resolve or elide the import, so "optional" is best treated as trivia rather than as a decision.

**Why is `client-only` less commonly used, and when is it the right call?**
Because the failure it prevents is already loud — a module touching `window` on the server usually throws `window is not defined`, so people diagnose it without help. It earns its place on a module whose browser dependency is not obvious from the outside: an analytics client that reads `navigator` at module scope, a wrapper around a browser storage API, anything a colleague might reasonably import into a layout. The error you get then names the module and the boundary instead of pointing at a bundler frame.

**What happens if you import `next/headers` in a Client Component?**
It is a build error, not a runtime one, and it comes from the same list that enforces `server-only` — `next/headers` and `next/root-params` are both in the compiler's disallowed-client-imports array. The message is the "you're importing a module that depends on…" text, naming `next/headers`. People expect `cookies()` to return `undefined` on the client and write defensive code around it; the code never runs, because the module never compiles.

**Could you implement your own version of `server-only` for a different concern — say, `admin-only`?**
Not with this mechanism. The transform matches literal specifiers against a fixed array of seven names, so an invented package name is invisible to it, and even re-exporting the real `server-only` from your own module changes the specifier your code imports and loses the check. Enforcing a custom boundary means a different tool — an ESLint `no-restricted-imports` rule or a dependency-cruiser policy — which runs at lint time rather than in the compiler, and which you must then remember to run.

**A dependency you did not write fails your build with a `server-only` error. Whose bug is it?**
Usually nobody's — it is the package correctly telling you that you reached its server entry point from a client module. Well-built packages with both surfaces poison the server half deliberately, so the error is the feature working. Check the package's exports for a client entry and import that, or move the call up into a Server Component parent and pass the result down. The one case where it is the package's bug is a library that poisons a genuinely isomorphic module; then it is an upstream issue, and the workaround is a thin server-side wrapper you own.

---

← Prev [04b · `<Activity>` and offscreen state](04b-activity-and-offscreen-state.md) · [Index](01-explanation.md) · Next → [05b · What it does not protect](05b-what-server-only-does-not-protect.md)
