---
title: "Closure variables round-trip through the browser encrypted with a per-build key, and action IDs are build artefacts — which is why actions break at deploy boundaries and across self-hosted replicas"
sidebar_label: "02c · Closures, IDs and deploys"
sidebar_position: 201
description: "What closure capture actually sends over the wire, the per-build encryption key and NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, dead code elimination, the 14-day action-ID cache, and recovering from 'Failed to find Server Action' after a rolling deploy."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Built-in Server Actions Security features*, § *Closures and encryption*, § *Overwriting encryption keys*) and [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Deployment considerations*) — both `version: 16.3.4`.
> Documentation-verified; **no sandbox run**. No error transcript reproduced — the one error string quoted is quoted from the docs.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**An action ID and a closure payload are both *build artefacts*, not stable API. They are minted at compile time, encrypted with a key generated at compile time, and they expire when you ship. That is a deliberate security property — an action reference cannot be replayed against a different build — and it is also the mechanism behind two production failures that look like flakiness: a burst of "Failed to find Server Action" after every deploy, and intermittent action failures on multi-replica self-hosting that nobody can reproduce locally.**

## Closure capture is a wire format, not a scope

An action defined inside a Server Component sees the component's scope. That is genuinely useful:

> *"Closures are useful when you need to capture a *snapshot* of data (e.g. `publishVersion`) at the time of rendering so that it can be used later when the action is invoked."*

```tsx
// app/publish/page.tsx
export default async function Page() {
  const publishVersion = await getLatestVersion()

  async function publish() {
    'use server'
    if (publishVersion !== (await getLatestVersion())) {
      throw new Error('The version has changed since pressing publish')
    }
    await doPublish()
  }

  return (
    <form>
      <button formAction={publish}>Publish</button>
    </form>
  )
}
```

That is optimistic concurrency control implemented for free: the version at render time is compared to the version at invoke time, and a stale tab is rejected. But look at where `publishVersion` has to travel for the comparison to work:

> *"However, for this to happen, the captured variables are sent to the client and back to the server when the action is invoked. To prevent sensitive data from being exposed to the client, Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build."*

So the lifecycle is: **serialise on the server → encrypt → embed in the RSC payload → download to the browser → post back → decrypt → run.** Two consequences fall straight out of it.

**Size.** Whatever you capture is paid for twice, once in the page payload and once in the request body. The 1MB action body cap ([02d](02d-what-the-framework-gives-an-action.md)) is spent partly on closure data before your form fields get any of it.

**Secrecy is relative.** The values are opaque to the client, but they are *in* the client:

> *"**Good to know:** We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."*

The safe habit is to capture an identifier and re-read the object inside the action, exactly as you would with an action argument.

## The per-build key, and what breaks when instances disagree

> *"When **self-hosting** your Next.js application across multiple servers, each server instance may end up with a different encryption key, leading to potential inconsistencies."*

> *"To mitigate this, you can overwrite the encryption key using the `process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` environment variable. Specifying this variable ensures that your encryption keys are persistent across builds, and all server instances use the same key."*

> *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*

```bash
# generate one key, once, at the documented default size
openssl rand -base64 32
```

```bash
# every replica, every build, the same value — injected as a deployment secret
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<the base64 string>
```

The failure this prevents is asymmetric and therefore confusing: an action **with no captured variables** works on every replica regardless of key, because there is no ciphertext to decrypt. An action that captures anything fails only when the replica that renders the page differs from the replica that receives the POST. On a two-replica deploy that is roughly half of invocations of *some* actions and none of others — which reads as random flakiness rather than a configuration error.

⚠️ Notice the second effect of the variable: keys become *persistent across builds*. The docs pair that with standard advice — *"Follow standard security practices such as key rotation and signing."* A key you set and never rotate is a key you own the lifecycle of; the default per-build key rotated itself.

## Dead code elimination: what it does and what it does not promise

> *"**Secure action IDs:** Next.js creates encrypted, non-deterministic IDs to allow the client to reference and call the Server Action. These IDs are periodically recalculated between builds for enhanced security."*

> *"**Dead code elimination:** Unused Server Actions (referenced by their IDs) are removed from client bundle to avoid public access."*

```jsx
// app/actions.js
'use server'

// If this action **is** used in our application, Next.js
// will create a secure ID to allow the client to reference
// and call the Server Action.
export async function updateUserAction(formData) {}

// If this action **is not** used in our application, Next.js
// will automatically remove this code during `next build`
// and will not create a public endpoint.
export async function deleteUserAction(formData) {}
```

Read that precisely. Elimination applies to actions **nothing in the app references**. Having an ID *is* being publicly callable, and any action your UI uses has an ID. The docs put the caveat immediately beside the feature so it cannot be misread as a boundary:

> *"This security improvement reduces the risk in cases where an authentication layer is missing. However, you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."*

And the starting condition, which is the one people forget:

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*

## The 14-day cache and the deploy cliff

> *"The IDs are created during compilation and are cached for a maximum of 14 days. They will be regenerated when a new build is initiated or when the build cache is invalidated."*

> *"Each Server Action is identified by the action ID that is part of its build artifacts. New deployments typically generate new IDs (Next.js rotates them at most every 14 days, even when the source is unchanged), so a client still running the previous build may invoke an action ID that no longer exists. The error surfaces as \"Failed to find Server Action\"."*

Two numbers doing different jobs, and they are easy to conflate:

| | What it governs |
|---|---|
| **"regenerated when a new build is initiated"** | Every deploy is a potential cliff for tabs open on the old build |
| **"cached for a maximum of 14 days"** | The upper bound on how long an ID can persist *across* builds when the build cache survives — it is a ceiling on stability, not a guarantee of it |

You cannot engineer the cliff away, so engineer the recovery. The documented mitigations:

> *"Prefer rolling deployments over abrupt cutovers when active users are likely to be mid-mutation."*
> *"Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across instances so action references remain decryptable everywhere."*
> *"Surface the error as a retry path in the UI rather than a hard failure, so a refresh recovers the user."*

## Gotchas

**★ Symptom: a burst of "Failed to find Server Action" errors in the minutes after every deploy.** Cause: open tabs hold the previous build's action IDs, and the new build minted new ones. Fix: this is expected behaviour, so convert it into a reload prompt instead of an error boundary.

```tsx
'use client'

import { useActionState } from 'react'
import { createPostAction } from './actions'

type Result = { ok: true } | { stale: true }

export function Form() {
  const [state, formAction] = useActionState<Result | null, FormData>(
    async (_prev, fd) => {
      try {
        await createPostAction(fd)
        return { ok: true }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : ''
        if (message.includes('Failed to find Server Action')) return { stale: true }
        throw reason
      }
    },
    null
  )

  if (state && 'stale' in state) {
    return (
      <p role="alert">
        A new version of this page is available.{' '}
        <button onClick={() => location.reload()}>Reload and retry</button>
      </p>
    )
  }

  return (
    <form action={formAction}>
      <input name="title" />
      <button>Create</button>
    </form>
  )
}
```

**★ Symptom: on a multi-replica self-hosted deploy, some action invocations fail while identical ones succeed, and nothing reproduces locally.** Cause: per-build encryption keys differ per instance, so closure ciphertext minted by one replica is undecryptable on another; actions without captured variables succeed everywhere, which is what makes it look random. Fix: one shared, stable key.

```yaml
# deployment manifest — the same secret mounted into every replica
env:
  - name: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: nextjs-server-actions
        key: encryption-key
```

**★ Symptom: the page HTML is unexpectedly large and action invocations creep toward the 1MB body cap.** Cause: an inline action captured a whole record, which is serialised into the payload and posted back on every call. Fix: capture the identifier, re-read inside the action.

```tsx
export default async function Page({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params
  const order = await getOrder(id)      // large object

  async function shipBad() {
    'use server'
    await ship(order)                    // the whole order round-trips, encrypted
  }

  async function shipGood() {
    'use server'
    await ship(await getOrder(id))       // only `id` round-trips
  }

  return <form><button formAction={shipGood}>Ship {order.reference}</button></form>
}
```

**★ Symptom: a secret read at render time is "safe because Next.js encrypts closures".** Cause: encryption protects confidentiality on the wire and in the bundle; the docs explicitly decline to endorse it as the only control. Fix: never let a secret enter a component's scope — read it inside the action, from a module that only the Data Access Layer touches ([02m](02m-the-data-access-layer.md)).

```tsx
// BAD — the key is in render scope, so it is captured and shipped (encrypted, but shipped)
export default async function Page() {
  const apiKey = process.env.PAYMENTS_KEY!
  async function charge() {
    'use server'
    await fetch('https://payments.example/charge', { headers: { Authorization: apiKey } })
  }
  return <form><button formAction={charge}>Pay</button></form>
}
```

```ts
// GOOD — data/payments.ts, server-only, reads the secret at invoke time
import 'server-only'
export async function charge(orderId: string) {
  await fetch('https://payments.example/charge', {
    method: 'POST',
    headers: { Authorization: process.env.PAYMENTS_KEY! },
    body: JSON.stringify({ orderId }),
  })
}
```

**Symptom: passing a class instance, a `Map`, or a callback as an action argument loses data or throws.** Cause: arguments and return values are serialised across the RSC boundary. Fix: pass plain, explicit, serialisable payloads and reconstruct on the server.

```ts
'use server'
// not this — an instance carrying methods is not a wire contract
export async function saveBad(order: Order) { /* ... */ }

// this
export async function saveGood(input: { orderId: string; note: string }) { /* ... */ }
```

**Symptom: an action deleted from the UI months ago is still being hit by traffic.** Cause: a build in which it was still referenced handed out its ID, and the ID may persist across builds within the documented 14-day cache window. Fix: delete the action itself, not just its call site — an unreferenced export is eliminated, a referenced one is a live endpoint.

## Interview questions

**★ What crosses the wire when an inline action closes over a variable, and what does the encryption actually protect?**
The captured value is serialised on the server, encrypted with a key generated at build time for that action, embedded in the RSC payload sent to the browser, and posted back with the invocation, where it is decrypted and bound as an argument. The encryption gives you confidentiality against the client and against anyone reading the bundle — it does not give you server-side secrecy, because the ciphertext is sitting in the browser and its key is a build artefact you might be persisting via an environment variable. The docs state directly that they *"don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."* Treat closure capture as a wire format: capture identifiers, not records, and never secrets.

**★ Why does `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` only matter for self-hosted or multi-instance deployments, and why is the resulting bug so hard to reproduce?**
Because Next.js generates *"a new private key … for each action every time a Next.js application is built."* With one instance, whatever rendered the page also receives the invocation, so keys always match. With several instances built separately — or one image whose key is derived per process — a page rendered by replica A can be POSTed to replica B, which cannot decrypt the closure payload. It is hard to reproduce because it only affects actions that capture something: a `deletePost(id)` imported from an actions file has no closure data and works everywhere, while the inline `publish()` on the next page fails half the time. Locally there is one instance, so it never happens at all.

**★ Does dead-code elimination mean an unused action is safe to leave in the repository?**
It means an *unreferenced* action gets no ID and therefore no public endpoint in that build, which is a real reduction in exposure. It is a poor security control, though, because the property is one import away from flipping: a component behind a feature flag that renders for nobody still references the action, so the endpoint exists. The docs frame it as reducing risk *"in cases where an authentication layer is missing"* — a mitigation for a mistake, not a boundary. Delete dead actions because dead code is a liability, and authorise live ones because they are reachable.

**How would you make a deploy safe for a user who is mid-checkout?**
Accept that their tab holds action IDs from the outgoing build and that a new build mints new ones. Roll the deploy rather than cutting over, so old instances keep serving the old IDs while connections drain. Keep the encryption key stable so closure references stay decryptable across whichever instance answers. And in the UI, catch the "Failed to find Server Action" case explicitly and offer a reload rather than letting it hit an error boundary — a reload re-renders against the new build, which mints references that work. What you cannot do is pin the IDs; they are deliberately non-deterministic.

**Someone proposes storing an idempotency key by capturing it in a closure at render time. Good idea?**
Partly. Capture does give you a per-render value that is stable across retries of the same button, which is genuinely what an idempotency key wants, and the `publishVersion` pattern in the docs is the same shape used for optimistic concurrency. The problems are lifetime and trust: the value is bound to the build (a deploy invalidates it) and it is client-held, so it is a hint rather than an authority. A server-side idempotency record keyed by that value — insert-if-absent in the database inside the same transaction as the mutation — is what actually makes the mutation idempotent. The closure just carries the key.

---

← [02b · What an action compiles into](02b-what-a-server-action-compiles-into.md) · Next → [02d · What the framework gives you](02d-what-the-framework-gives-an-action.md)
