---
title: "A Server Function serializes more than its arguments — its closures travel to the browser and back, and the export list of a 'use server' file is a public unauthenticated HTTP API whether you meant it to be or not"
sidebar_label: "05c · The Server Function's serialization surface"
sidebar_position: 26
description: "Closed-over variables sent to the client and back, why the encryption exists and why the docs tell you not to lean on it, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY on multi-instance deployments and the durable secret it creates, and why exporting a helper from a 'use server' file publishes an endpoint."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`) — its *Closures and encryption*, *Overwriting encryption keys* and *Built-in Server Actions Security features* sections are quoted verbatim below — and [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**. Prior page: [05b · Projection at the boundary](05b-what-an-application-author-still-owns.md).

**[05b](05b-what-an-application-author-still-owns.md) covered the outward direction — what your render encodes and sends to a browser. A Server Function adds a second serialization surface, in both directions, and it is the one people do not know exists. Variables an inline action closes over are **sent to the client and back**; Next.js encrypts them and then tells you not to rely on that. The key doing the encrypting is regenerated per build, which is correct on one instance and an intermittent failure across many. And the `'use server'` directive applies to a whole file, so the export list of that file is a public, unauthenticated HTTP API — a helper exported for a unit test is an endpoint, and dead-code elimination will not remove it because its own sibling uses it.**

⚠️ **Where this is also covered.** [01c · What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md) reaches both of this page's surfaces from the Server Action's own point of view, and [03h · The trust boundary around an action](03h-the-trust-boundary-around-a-server-action.md) reaches them from the authentication side. This page arrives at them from the RSC serialization argument in [05](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md): a closure and an export list are *serialization surfaces*, which is why they belong in a chapter about what the payload carries. Read whichever entry point you arrived from; they agree.

## Closed-over variables are sent to the client and back

An inline Server Function defined inside a component captures its enclosing scope, and the guide is precise about where the captures go:

> *"Defining a Server Action inside a component creates a [closure](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) where the action has access to the outer function's scope."*

> *"However, for this to happen, the captured variables are sent to the client and back to the server when the action is invoked. To prevent sensitive data from being exposed to the client, Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build."*

> *"**Good to know:** We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."*

Read that sequence in order, because each clause changes the conclusion. The variable **does** travel to the browser — that is not an implementation detail you can design away, it is how a closure survives the round trip. It is encrypted. And the team that wrote the encryption declines to call it a control.

The reason the round trip exists at all is worth understanding rather than memorising. A Server Function invoked from the client is an HTTP request; the server that handles it may be a different process from the one that rendered the page, and it has no memory of that render. So the captured scope has to be carried by the client, because the client is the only participant present at both ends.

```tsx filename="app/settings/page.tsx"
// 🔴 The API key is captured, encrypted, and sent to the browser and back.
export default async function Page() {
  const apiKey = process.env.BILLING_API_KEY

  async function cancelSubscription() {
    'use server'
    await fetch('https://billing.example.com/cancel', {
      headers: { authorization: `Bearer ${apiKey}` },
    })
  }

  return (
    <form action={cancelSubscription}>
      <button type="submit">Cancel</button>
    </form>
  )
}
```

The fix is not to encrypt harder; it is that a credential has no reason to be in the closure at all. Read it on the server, at call time, from a module the client graph cannot reach:

```ts filename="app/lib/billing.ts"
import 'server-only'

const apiKey = process.env.BILLING_API_KEY
if (!apiKey) throw new Error('BILLING_API_KEY is not set')

export async function cancelSubscriptionFor(userId: string) {
  return fetch('https://billing.example.com/cancel', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ userId }),
  })
}
```

```ts filename="app/lib/actions.ts"
'use server'

import { verifySession } from '@/app/lib/session'
import { cancelSubscriptionFor } from '@/app/lib/billing'

// Nothing is captured. The secret is read on the server, at invocation.
export async function cancelSubscription() {
  const session = await verifySession()
  await cancelSubscriptionFor(session.userId)
}
```

Closures remain the right tool for the job they were designed for. The guide's own example captures a `publishVersion` so the action can detect that the document changed between render and click:

> *"Closures are useful when you need to capture a *snapshot* of data (e.g. `publishVersion`) at the time of rendering so that it can be used later when the action is invoked."*

The rule that falls out: **capture facts about the render; never capture credentials.** A version number, a row id, a rendered-at timestamp — all fine, all things the client could have learned anyway. A token, a key, an internal hostname — never, regardless of the encryption.

⚠️ There is a second, quieter cost. Anything captured is *payload*, and per the Server Actions guide (`lastUpdated: 2026-06-17`) *"Action requests are capped at 1MB by default."* An inline action that closes over a large object is spending that budget on data the server could have looked up itself. That is a performance argument, but it points the same way as the security one.

## `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on multi-instance deployments

The key is generated per build, which is fine on one instance and a problem across many:

> *"When **self-hosting** your Next.js application across multiple servers, each server instance may end up with a different encryption key, leading to potential inconsistencies."*

> *"To mitigate this, you can overwrite the encryption key using the `process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` environment variable. Specifying this variable ensures that your encryption keys are persistent across builds, and all server instances use the same key."*

> *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*

```bash
# The generator the documentation names. 32 bytes, base64-encoded.
openssl rand -base64 32
```

```bash filename=".env.production"
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<the base64 value from the command above>
```

> *"This is an advanced use case where consistent encryption behavior across multiple deployments is critical for your application. Follow standard security practices such as key rotation and signing."*

Hold two things at once about this variable.

**Operationally it fixes an intermittent failure.** Without it, a load-balanced self-hosted deployment encrypts an action's closure on one instance and tries to decrypt it on another, so a fraction of invocations fail — a fraction that varies with your instance count and looks exactly like a flaky bug in your own code. The related operational symptom, `Failed to find Server Action` after a deploy, and what it does to an already-open tab, is [ch07 · 03d](../07-error-handling-loading-states-and-resilience/03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md).

**Security-wise it is a downgrade you are choosing deliberately.** The default gives you a key that ceases to exist at the next build — a compromise of it has a lifetime measured in deploys. Pinning it gives you a long-lived secret whose compromise is durable until you rotate. That is exactly why the documentation attaches *"key rotation and signing"* to the paragraph, and why the answer to "should we set this?" is **"only if you run more than one instance"**, never "yes, for consistency."

Note also the third-order effect of the default: because *"actions can only be invoked for a specific build"*, an attacker who captured an encrypted closure payload cannot replay it against a later build. Pinning the key removes that property along with the flakiness. Both halves of the trade are real.

## Every export from a `'use server'` file is an endpoint

See also [01c · The module is the endpoint](01c-what-crosses-the-wire-modules-and-closures.md) for the same rule argued from the action's module boundary.

The directive reference states the scope, and the scope is the whole file:

> *"The `use server` directive designates a function or file to be executed on the **server side**. It can be used at the top of a file to indicate that all functions in the file are server-side, or inline at the top of a function to mark the function as a [Server Function](https://19.react.dev/reference/rsc/server-functions)."*

Combine that with the reachability rule:

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*

The consequence is concrete and routinely shipped: **a helper exported from an actions file so a unit test can reach it is a public, unauthenticated HTTP endpoint.**

```ts filename="app/lib/actions.ts"
'use server'

// 🔴 Exported "so the test can reach it". This is now a POST endpoint,
// and it is the one without the authorization check.
export async function rawRecalculateBilling(orgId: string) {
  await db.$executeRaw`CALL recalculate_billing(${orgId})`
}

export async function recalculateBilling() {
  const session = await verifySession()
  if (session.role !== 'admin') throw new Error('Forbidden')
  await rawRecalculateBilling(session.orgId)
}
```

Move the helper out of the directive's scope. The test gets a cleaner seam and the endpoint stops existing:

```ts filename="app/lib/billing-internal.ts"
import 'server-only'

// Not in a 'use server' file, so not an endpoint. Import it; test it directly.
export async function rawRecalculateBilling(orgId: string) {
  await db.$executeRaw`CALL recalculate_billing(${orgId})`
}
```

```ts filename="app/lib/actions.ts"
'use server'

import { verifySession } from '@/app/lib/session'
import { rawRecalculateBilling } from '@/app/lib/billing-internal'

export async function recalculateBilling() {
  const session = await verifySession()
  if (session.role !== 'admin') throw new Error('Forbidden')
  await rawRecalculateBilling(session.orgId)
}
```

🔴 **Dead-code elimination is not a rescue here.** The feature removes *unused* actions — *"Unused Server Actions (referenced by their IDs) are removed from client bundle to avoid public access"* — and `rawRecalculateBilling` is used, by its own sibling. It is precisely the exports that are wired into something that survive, which means the ones dead-code elimination removes are the ones that were least likely to matter.

The audit question in the data-security guide's checklist is worded to catch this shape directly:

> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

Every question there is asked of *each export*, not of the file. The delegate-to-a-DAL answer solves several at once, which is why the guide recommends it — the `'use server'` file then contains only thin wrappers and its export list is short enough to read.

## Gotchas

**★ Symptom: an inline Server Function works, and a secret it closes over turns up in the RSC Payload.**
Cause: *"the captured variables are sent to the client and back to the server when the action is invoked."* They are encrypted, and the guide explicitly declines to recommend relying on that.
Fix: capture render facts, never credentials. Read the secret inside the action from a `server-only` module.

```ts filename="app/lib/actions.ts"
'use server'
import { cancelSubscriptionFor } from '@/app/lib/billing' // reads process.env itself

export async function cancelSubscription() {
  const session = await verifySession()
  await cancelSubscriptionFor(session.userId) // nothing captured
}
```

**★ Symptom: an action fails intermittently across a load-balanced self-hosted deployment, and reproduces roughly one request in N.**
Cause: a per-build encryption key differs per instance, so a closure encrypted by one server cannot be decrypted by another. `N` tracks your instance count, which is why it looks like flakiness rather than a bug.
Fix: one key for every instance.

```bash
openssl rand -base64 32
```

```bash filename=".env.production"
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<the base64 value>
```

⚠️ You have just converted an ephemeral per-build key into a long-lived secret. Put it on a rotation schedule and treat it like any other production credential.

**★ Symptom: the encryption key is set on a single-instance deployment "for consistency."**
Cause: reading the variable as best practice rather than as a mitigation for a specific topology. The default's replay resistance — *"actions can only be invoked for a specific build"* — is a property you have now given up for nothing.
Fix: unset it unless you run more than one instance or need payloads to survive a rebuild.

**★ Symptom: a security scan reports an unauthenticated endpoint that maps to a function no component calls.**
Cause: it is exported from a file with `'use server'` at the top, which marks all functions in the file, and export alone makes it reachable by direct POST.
Fix: move non-action helpers into a `server-only` module and import them, as shown above. The export list of a `'use server'` file *is* its public API surface — review it like one.

**★ Symptom: an inline action closes over a large fetched object and submissions start failing on slow connections or at size.**
Cause: captured variables are payload, and *"Action requests are capped at 1MB by default"* — the closure is spending the budget on data the server could have re-read itself.
Fix: capture an id, not the object.

```tsx
async function publish() {
  'use server'
  // Capture the id; re-read the document server-side at invocation.
  const doc = await getDocumentDTO(docId)
  // ...
}
```

**★ Symptom: someone adds `'use server'` to a shared utility file so one function in it can be an action.**
Cause: the directive is file-scoped when placed at the top. Every other export in that utility file has just become an endpoint.
Fix: use the **inline** form on the single function, or better, move the action to its own file. The inline form exists precisely so that a directive at the top of a file is a deliberate choice about the whole file.

**★ Symptom: an action is trusted because "it is only called from an admin-only page."**
Cause: the action's reachability has nothing to do with which page renders it. It is a POST endpoint, and per the chapter's [CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md) the endpoint IDs themselves were disclosable in 2026 (CVE-2026-64643), so "an attacker would have to find it" is not a defence either.
Fix: authorize inside the action, delegating to the DAL. The per-action treatment is [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md); [ch07 · 03c](../07-error-handling-loading-states-and-resilience/03c-an-action-is-a-public-post-endpoint.md) covers the framework guarantees and their limits.

## Interview questions

**★ A Server Function defined inline in a page closes over a variable. Where does that variable go, and why does it have to?**
To the browser and back. The guide states that *"the captured variables are sent to the client and back to the server when the action is invoked."* It has to, because a Server Function call is an HTTP request that may be handled by a different process from the one that rendered the page — that process has no memory of the render, so the client is the only participant present at both ends and must carry the scope. Next.js encrypts the captures with a per-build private key, and the same section says *"we don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."* So capture render facts — the docs' own example captures a `publishVersion` to detect a concurrent edit — and never credentials.

**★ When should you set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and what exactly does setting it cost?**
When self-hosting across multiple servers, because each instance otherwise generates its own per-build key and a closure encrypted by one cannot be decrypted by another — an intermittent failure whose rate tracks your instance count. The key must be base64 whose decoded length is a valid AES size (16, 24 or 32 bytes; Next.js generates 32 by default), and `openssl rand -base64 32` is the generator the docs name. The cost is twofold: you have created a long-lived secret whose compromise is durable rather than one that expires at the next build, and you have given up the property that *"actions can only be invoked for a specific build"*, which was replay resistance you got for free. The docs attach "key rotation and signing" for exactly that reason.

**★ Why is exporting a helper from a `'use server'` file a security decision rather than a code-organisation one?**
Because the directive at the top of a file *"indicate[s] that all functions in the file are server-side"*, and an exported Server Action *"is reachable via a direct POST request … even if it is not imported elsewhere in your code."* So the export list of that file is its public, unauthenticated HTTP API. A helper exported "for the test" is an endpoint — and typically the one without the authorization check, since the check lives in the wrapper. Dead-code elimination does not save you, because it removes *unused* actions and the helper is used by its own sibling. Move it to a `server-only` module and import it: the test gets a better seam and the endpoint disappears.

**★ Someone adds `'use server'` to the top of a shared utility module so that one function in it can be used as an action. What have they done?**
Published every export in that module as an unauthenticated POST endpoint. The file-level directive is file-scoped by design; the inline per-function form exists precisely so that putting it at the top of a file is a deliberate statement about the whole file. The correct move is the inline directive on the one function, or — better, because it keeps the export surface reviewable — a dedicated actions file whose exports are thin wrappers that delegate to a `server-only` Data Access Layer.

**★ How does the 1MB action request cap interact with closures?**
Captured variables are part of the request payload, so an inline action that closes over a large fetched object is spending the documented 1MB default budget on data the server could have re-read itself. The failure appears as submissions that work in development with small fixtures and fail in production at real sizes. The fix — capture an id and re-read server-side — is the same shape as the security fix for credentials, which is a useful sign that the underlying rule is sound: a closure should carry the smallest fact that identifies what the action must do, not the data itself.

**★ What property does the default per-build encryption key give you that pinning the key takes away?**
Replay resistance across deploys. Because a new private key is generated for each action on every build, *"actions can only be invoked for a specific build"* — an encrypted closure payload captured today is useless against tomorrow's deployment. Pinning `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` makes payloads portable across builds and instances, which is the entire point when you are load-balanced, and simultaneously removes that expiry. It is a deliberate trade, and it is the reason to leave the variable unset on a single-instance deployment.

---

← [05b · Projection at the boundary](05b-what-an-application-author-still-owns.md) · [Chapter 10 overview](01-explanation.md) · Next → [06 · Milestone: SprintDesk auth](06-project-milestone-sprintdesk-auth-authjs.md)
