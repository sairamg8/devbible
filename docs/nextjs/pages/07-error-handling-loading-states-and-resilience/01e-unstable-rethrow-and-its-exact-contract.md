---
title: "`unstable_rethrow` is a repair tool with a precise contract — top of the catch, cleanup in `finally`, and still not recommended for production at 16.3.4"
sidebar_label: "01e · `unstable_rethrow`"
sidebar_position: 103
description: "The escape hatch for a catch block that must handle both application errors and framework control-flow throws: the four rules from the reference, why cleanup after the call leaks, and the structural fix the docs prefer to the tool."
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-04 against the Next.js
> [`unstable_rethrow` reference](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-03-03`; its unstable banner, its example
> and all four "Good to know" rules are quoted verbatim below. Target: **Next.js 16.3.4**,
> App Router. Documentation-validated; **no sandbox run**.

**There is one supported way to keep a `try`/`catch` and still let `notFound()` and `redirect()`
through, and it comes with a warning label the documentation puts above the fold.** Reach for it
when you genuinely cannot restructure the call — a third-party helper wraps everything, a
shared retry utility owns the `catch` — and not as the default shape for error handling in a
route. The rules below are small in number and each one is a real bug when broken; the last of
them is the reason a page that "handles" errors can leak a timer on exactly the requests it was
protecting.


## `unstable_rethrow` — the escape hatch, and its exact contract

It is still marked unstable at **16.3.4**, and the reference says so in a banner rather than a
footnote:

> *"This feature is currently unstable and subject to change, it's not recommended for
> production."*

That is a real constraint on how you should use it: it is a repair tool for code you cannot
restructure, not a pattern to build on.

```tsx
// @/app/ui/component.tsx
import { notFound, unstable_rethrow } from 'next/navigation'

export default async function Page() {
  try {
    const post = await fetch('https://.../posts/1').then((res) => {
      if (res.status === 404) notFound()
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
  } catch (err) {
    unstable_rethrow(err)
    console.error(err)
  }
}
```

Four rules from the reference, each of which is a bug if you get it wrong:

- *"This method should be called at the top of the catch block, passing the error object as its
  only argument."* Anything above it in the `catch` runs for framework throws too.
- *"It can also be used within a `.catch` handler of a promise."*
- 🔴 *"Any resource cleanup (like clearing intervals, timers, etc) would have to either happen
  prior to the call to `unstable_rethrow` or within a `finally` block."* `unstable_rethrow`
  **throws**, so every line after it in the `catch` is skipped for framework errors — a
  `clearInterval` sitting below it leaks on exactly the paths you were trying to protect.
- *"Only use `unstable_rethrow` if your caught exceptions may include both application errors
  and framework-controlled exceptions."*

And the recommendation that is better than the tool:

> *"You may be able to avoid using `unstable_rethrow` if you encapsulate your API calls that
> throw and let the **caller** handle the exception."*

That is the structural fix. Keep the framework call out of the `try` entirely: let the data
layer return `null` or throw a plain error, and decide `notFound()` in the component, after the
`try` has closed.

## Gotchas

### Cleanup written after `unstable_rethrow`
**Symptom.** An interval or a database handle leaks, but only on the requests that 404 or
redirect.
**Cause.** `unstable_rethrow` throws. Every statement below it in the `catch` block is dead for
framework errors, which are precisely the paths it exists to handle.
**Fix.** Put cleanup in a `finally`, which runs on every path.

```ts
import { unstable_rethrow } from 'next/navigation'

export async function loadWithTimeout(id: string) {
  const timer = setInterval(heartbeat, 1_000)
  try {
    return await api.get(id)
  } catch (err) {
    unstable_rethrow(err)
    reportError(err)
    return null
  } finally {
    clearInterval(timer) // runs for framework throws too
  }
}
```

### Using it as the house pattern for every `catch`
**Symptom.** A codebase where every `catch` opens with `unstable_rethrow(err)`, and an upgrade
turns a compile-time import into a runtime failure.
**Cause.** The API is prefixed `unstable_` and the reference says it is *"subject to change,
it's not recommended for production."* Spreading an unstable API across every error path
maximises the surface that a rename or a signature change touches.
**Fix.** Confine it to the call sites that actually mix both kinds of error, and remove the
`try` everywhere else. If it must be widespread, put it behind one wrapper you own, so a future
rename is a single edit.

```ts
// lib/rethrow.ts — one import site for an unstable API
import { unstable_rethrow } from 'next/navigation'

export function rethrowFrameworkErrors(err: unknown): void {
  unstable_rethrow(err)
}
```

### Calling it on an error you constructed yourself
**Symptom.** Nothing — which is the problem. The call is noise, and it reads as protection that
is not needed.
**Cause.** `unstable_rethrow` only re-throws *framework-controlled* exceptions; for an ordinary
`Error` it returns and execution continues. A `catch` that can only ever see errors you threw
gains nothing from it.
**Fix.** Only use it where the reference says to: *"if your caught exceptions may include both
application errors and framework-controlled exceptions."* A `catch` around `JSON.parse` is not
one of those places.
## Interview questions

**★ What is the argument against reaching for `unstable_rethrow`?**
Two arguments. It is explicitly *"not recommended for production"* at 16.3.4 and subject to
change. And in most codebases it is treating the symptom: the reference itself says you can
often avoid it by encapsulating the calls that throw and letting the caller handle the
exception, which is a structural fix rather than a per-`catch` patch.

**★ Where exactly must `unstable_rethrow` go, and what breaks if it goes elsewhere?**
At the very top of the `catch`, with the error as its only argument. Anything above it runs for
framework throws as well as real errors — so a `console.error` above it logs every redirect as
a failure. Anything below it never runs for framework throws, because the call itself throws,
which is why cleanup belongs in a `finally` rather than after it.

**★ What does `unstable_rethrow` do when the error is an ordinary `Error`?**
Nothing observable — it returns, and the rest of the `catch` block runs as written. It only
re-throws the framework's own control-flow exceptions. That is what makes it safe to place at
the top of a mixed `catch`, and also what makes it pointless in a `catch` that can only ever
receive errors your own code threw.

**★ You inherit a shared `withRetry()` helper that wraps every data call in `try`/`catch`.
Pages that call `notFound()` inside it stopped working. What are the options?**
Three, in order of preference. Move the `notFound()` out of the wrapped call, so the helper only
ever sees data errors and the component decides on absence — this removes the class of bug.
Have the helper classify: re-throw anything it cannot identify as a retriable transport failure.
Or, if the helper cannot be changed, call `unstable_rethrow(err)` at the top of its `catch`,
accepting an unstable API in shared infrastructure.

**★ Why is the `finally` rule specific to this API rather than general `try`/`catch` advice?**
Because the call itself throws. In an ordinary `catch`, code after the last statement runs; here
the framework-error path exits at the `unstable_rethrow` line, so any cleanup written below it
is skipped for precisely the errors the block exists to pass through. `finally` is the only
placement that runs on both paths.
---

← [01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md) · **Next → [02 · Errors in streaming](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md)**
