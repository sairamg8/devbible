---
title: "Every export in a `'use server'` module is a public endpoint and every variable an inline action closes over is shipped to the browser and back — two surfaces most codebases never look at"
sidebar_label: "01c · What crosses the wire"
sidebar_position: 101
description: "Why an unimported exported action is still callable, why re-exporting a DAL function publishes it, what closure encryption does and explicitly does not promise, the AES key a multi-instance deployment needs, and bind versus a hidden input."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`), and the React [`<form>`](https://react.dev/reference/react-dom/components/form) reference.
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**An action has several data surfaces and developers routinely audit only one. The arguments are the surface everyone validates. This page is the two nobody does: the module boundary, which decides what is callable at all and does not care whether your UI ever calls it, and the variables an inline action closed over — data nobody typed, that travels to the browser and back on every invocation. Each comes with a documented guarantee and, more usefully, a documented limit on that guarantee. The outbound surface, what the action returns, is [01d](01d-return-values-dtos-and-tainting.md).**

## The module is the endpoint

The first surface is not data at all; it is the export list.

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*

Two framework features narrow that, and the guide names both:

> *"**Secure action IDs:** Next.js creates encrypted, non-deterministic IDs to allow the client to reference and call the Server Action. These IDs are periodically recalculated between builds for enhanced security."*
> *"**Dead code elimination:** Unused Server Actions (referenced by their IDs) are removed from client bundle to avoid public access."*

The documentation's own illustration of what "unused" means:

```jsx filename="app/actions.js"
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

**Read the elimination rule as a build optimisation, not a security control** — which is what the guide says, in the sentence directly under the ID note:

> *"This security improvement reduces the risk in cases where an authentication layer is missing. However, you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."*

And the ID lifetime, which chapter 07 covers in full at [03d · Action IDs rotate](../07-error-handling-loading-states-and-resilience/03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md):

> *"The IDs are created during compilation and are cached for a maximum of 14 days. They will be regenerated when a new build is initiated or when the build cache is invalidated."*

The practical consequence is a rule about file layout: **a `'use server'` module has no private members.** Anything you export there is API. A helper you exported "just for the test file", a function you re-exported for convenience, a debugging action left behind after a spike — each is an endpoint with your credentials behind it.

```ts filename="app/posts/actions.ts"
'use server'

import { db } from '@/lib/db'
import { requirePostOwner } from '@/data/posts'

// PUBLIC: an endpoint. It gets the full treatment.
export async function updatePostAction(postId: string, formData: FormData) {
  await requirePostOwner(postId)
  await db.post.update({ where: { id: postId }, data: { title: String(formData.get('title')) } })
}

// NOT public: unexported, so there is no ID and no dispatcher for it.
function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
```

The trap that follows from it is re-exporting:

```ts filename="app/posts/actions.ts"
'use server'

// 🔴 This publishes the DAL function as an endpoint taking an arbitrary id,
// with whatever signature it happens to have — including any admin variant.
export { deletePost, forceDeletePostAsAdmin } from '@/data/posts'
```

## Closures: the variables you never passed

Defining an action inside a component captures the enclosing scope. The guide's example:

```tsx filename="app/page.tsx"
export default async function Page() {
  const publishVersion = await getLatestVersion();

  async function publish() {
    "use server";
    if (publishVersion !== await getLatestVersion()) {
      throw new Error('The version has changed since pressing publish');
    }
  }

  return (
    <form>
      <button formAction={publish}>Publish</button>
    </form>
  );
}
```

> *"Closures are useful when you need to capture a *snapshot* of data (e.g. `publishVersion`) at the time of rendering so that it can be used later when the action is invoked."*

The mechanism that makes the snapshot possible is the part with security consequences:

> *"However, for this to happen, the captured variables are sent to the client and back to the server when the action is invoked. To prevent sensitive data from being exposed to the client, Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build."*

Three things follow, and only the first is obvious.

**One — the payload is real bytes.** Whatever you capture is serialized into the page's response and posted back on every invocation. Closing over a 200-row list to avoid re-querying does not save a query; it moves the list through the browser twice and pushes you toward the 1MB action body cap covered in [01e](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md).

**Two — encryption is not the same as authorization.** The guide's own caveat is unusually blunt:

> *"We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."*

⚠️ The documentation says the values are **encrypted**. It does not say they are authenticated against tampering, and I could not find a statement either way — so treat a closed-over value as *confidential but not trusted*, and re-derive anything a decision depends on from the session inside the action.

**Three — the key is per build, which is a deployment fact.** *"A new private key is generated for each action every time a Next.js application is built"*, so a fleet of instances built independently cannot decrypt each other's payloads. The fix is the environment variable, and the constraint on its value is exact:

> *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*

```bash
openssl rand -base64 32
```

Set it as `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in every instance's environment. Chapter 07 covers what happens when you do not: [03d · Action IDs rotate](../07-error-handling-loading-states-and-resilience/03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md).

## `bind` versus a hidden input

When the extra argument is not a form field, the forms guide gives two options and is explicit about the difference:

```tsx filename="app/client-component.tsx"
'use client'

import { updateUser } from './actions'

export function UserProfile({ userId }: { userId: string }) {
  const updateUserWithId = updateUser.bind(null, userId)

  return (
    <form action={updateUserWithId}>
      <input type="text" name="name" />
      <button type="submit">Update User Name</button>
    </form>
  )
}
```

> *"An alternative is to pass arguments as hidden input fields in the form (e.g. `<input type="hidden" name="userId" value={userId} />`). However, the value will be part of the rendered HTML and will not be encoded."*
> *"`bind` works in both Server and Client Components and supports progressive enhancement."*

**Neither makes the value trustworthy.** A hidden input is plainly editable in dev tools. A bound argument is encoded, which is better, but the guide has already told you not to rely on encryption alone. The safe reading of `updateUser.bind(null, userId)` is *"a hint about which record the user was looking at"* — the action still resolves the acting user from the session and still scopes the write by ownership, exactly as in [01](01-server-actions-for-mutations-with-useactionstate-and-useopti.md).

## Gotchas

**★ Symptom: a penetration test reports a callable endpoint for a function your UI never renders a button for.** Cause: it is exported from a `'use server'` module, and export is publication — *"even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."* Dead-code elimination only removes actions the build proves unused; anything reachable from any component survives. Fix: unexport helpers, and give every remaining export the full auth-plus-ownership treatment.

```ts
// Before — a convenience export becomes an endpoint
'use server'
export async function rawQuery(sql: string) { return db.$queryRawUnsafe(sql) }

// After — not exported, therefore not addressable
'use server'
async function rawQuery(sql: string) { return db.$queryRawUnsafe(sql) }
export async function searchPostsAction(term: string) {
  await requireSession()
  return db.post.findMany({ where: { title: { contains: term } }, take: 20 })
}
```

**★ Symptom: after a deploy, some users get `Failed to find Server Action` and others do not.** Cause: multiple instances each built their own closure encryption key, so a payload encrypted by instance A cannot be decrypted by instance B. Fix: one stable key in the environment of every instance.

```bash
# generate once, store as a secret, inject everywhere
openssl rand -base64 32
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<that value>
```

**★ Symptom: the form posts several hundred kilobytes even though the user typed twelve characters.** Cause: the inline action closed over a large render-time value — a list, a full record, a parsed config — and captured variables travel to the client and back on every invocation. Fix: capture an identifier and re-read inside the action.

```tsx
// Before
export default async function Page() {
  const project = await getProject(id) // whole object captured
  async function rename(formData: FormData) {
    'use server'
    await db.project.update({ where: { id: project.id }, data: { name: String(formData.get('name')) } })
  }
  return <form action={rename}><input name="name" /></form>
}

// After
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rename = renameProjectAction.bind(null, id)
  return <form action={rename}><input name="name" /></form>
}
```

**Symptom: a hidden `userId` input works perfectly in testing and lets one user edit another in production.** Cause: the hidden field is client-supplied data — *"the value will be part of the rendered HTML"* — and editing it is a two-second operation. Fix: never let identity arrive from the form; derive it from the session and use the posted id only as a scoped lookup key.

```ts
const session = await auth()
const target = await db.profile.findFirst({ where: { id: profileId, ownerId: session.user.id } })
if (!target) throw new Error('Forbidden')
```

## Interview questions

**★ You delete the only component that calls an action but leave the export in place. Is the endpoint gone?**
No. Dead-code elimination removes actions the build can prove are unused, but the guarantee you should design against is the opposite one the docs state explicitly: an exported Server Action is reachable by direct POST even if nothing in your code imports it. Relying on elimination means relying on a whole-program analysis staying conservative across every future refactor, including one that adds a dynamic import. The rule that survives is simpler — an export in a `'use server'` module is public API, so either delete it or defend it.

**★ What exactly happens to a variable an inline Server Action closes over?**
It is serialized into the response that renders the page, encrypted with a per-build private key, sent to the browser, and posted back to the server when the action is invoked, where it is decrypted and reinstated. That is what makes the render-time snapshot semantics possible. The consequences are that the value costs bandwidth twice, that it ties the action reference to that specific build, and that the encryption protects confidentiality only — the documentation explicitly recommends against relying on it alone.

**★ `bind` or a hidden input for the record id — which is safer, and by how much?**
`bind` is better: the value is encoded rather than sitting in the HTML as an editable attribute, and it survives progressive enhancement in both Server and Client Components. But the improvement is in disclosure, not in trust. Neither mechanism lets the server conclude that the id it received is one this user may act on, so both are followed by the same ownership-scoped query. If you find yourself arguing about which is safer, the answer is usually that the action is missing an authorization check that would make the question irrelevant.

**Two instances of the same app, two different closure encryption keys. What does the user see?**
Intermittent failures that look like a broken deploy: an action invoked against the instance that did not encrypt its payload cannot decrypt it, surfacing as `Failed to find Server Action`. It is intermittent because it depends on which instance the load balancer picked, which is why it survives testing. The fix is a single base64 key of 16, 24 or 32 decoded bytes in `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across every instance and every build.

---

← [01b · Mutation shape and failure posture](01b-mutation-shape-and-failure-posture.md) · [Chapter 10 overview](01-explanation.md) · Next → [01d · Return values, DTOs and tainting](01d-return-values-dtos-and-tainting.md)
