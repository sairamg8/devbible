---
title: "An action's boundary has two directions and both leak: what it accepts must never carry authority, and what it returns is serialized straight to the browser"
sidebar_label: "The trust boundary around an action"
sidebar_position: 126
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Data Security in Next.js](https://nextjs.org/docs/app/guides/data-security) (docs `lastUpdated: 2026-08-25`) and [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4 · React 19.2.8**. Prior page: [Authorization: ownership checks](03g-authorization-ownership-checks-and-every-entry-point.md).

**The previous page established that an action must authorize the caller against the specific row. This one is about the data crossing the same boundary in both directions: the arguments, which may name a resource but must never assert authority; the return value, which is serialized to the browser whether or not you meant it to be; the closure variables of an inline action, which travel to the client and back; and the extra handling destructive operations earn. Every item here is a place where correct authorization code still leaks. The CSRF half of the boundary — why actions are POST-only, the `Origin` check, and the audit checklist — is [03i](03i-csrf-the-origin-check-and-the-audit.md).**

## What must never come from the client

> *"You should always validate input from client, as they can be easily modified. For example, form data, URL parameters, headers, and `searchParams`."*

The docs' own bad example is worth reproducing because it looks harmless:

```tsx
// BAD: Trusting searchParams directly
export default async function Page({ searchParams }) {
  const isAdmin = (await searchParams).isAdmin
  if (isAdmin === 'true') {
    // Vulnerable: relies on untrusted client data
    return <AdminPanel />
  }
}
```

and their corrected version, which shows the shape rather than merely asserting it:

```tsx
// GOOD: Re-verify every time
import { cookies } from 'next/headers'
import { verifyAdmin } from './auth'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const isAdmin = await verifyAdmin(token)

  if (isAdmin) {
    return <AdminPanel />
  }
}
```

The general rule: **identity and authority are derived from the session, never received as parameters.** A `userId`, `teamId`, `orgId`, `role` or `isAdmin` arriving in `FormData`, `searchParams`, a header or a Server Action argument is a value the caller chose. The only trustworthy source is the verified session, and the only place to read it is the Data Access Layer — [03b](03b-the-data-access-layer-server-only-and-the-dto.md).

A useful heuristic when reviewing an action signature: **for every parameter, ask what happens if the caller sets it to any value they like.** For `itemId` the answer is "we look it up and check ownership" — fine. For `teamId` the answer is usually "we write into that team", which is the bug.

```ts
// Smells: the caller supplies the team.
export async function createTask(teamId: string, title: string) { /* … */ }

// Correct: the team comes from the session, and membership is re-checked.
export async function createTask(title: string) {
  const session = await requireSession()
  const membership = await db.membership.findFirst({
    where: { userId: session.userId, teamId: session.activeTeamId },
    select: { teamId: true },
  })
  if (!membership) throw new Error('Forbidden')
  await db.task.create({ data: { title, teamId: membership.teamId } })
}
```

There is one more input surface people forget: **`FormData` values are strings or `File`s, and a missing field is `null`, not `undefined`.** `formData.get('isAdmin')` on an absent field is `null`, and `String(null)` is `"null"` — which is truthy. Parse through a schema; do not compare raw.

## What must never go back to the client

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*

```ts
// BAD: Returns the full database record, which may include
// internal fields the client should not see.
export async function updateUser(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
}

// GOOD: Returns only what the client needs.
export async function updateUserSafe(data: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { name: data.get('name') as string },
  })
  return { success: true }
}
```

Returning the ORM's update result is the same defect as returning a row from a read, with a longer fuse: it works today, and it leaks whichever internal column someone adds next quarter. The difference between `return db.user.update(...)` and `await db.user.update(...); return { success: true }` is one `await` and one literal, and it is the difference between a response shape you control and one your schema controls.

The same applies to **errors**. A thrown `PrismaClientKnownRequestError` serialized to the client can carry table and column names. Catch at the action boundary and return a message you wrote.

The return-value surface has its own chunk in topic 01, covering DTO shaping by viewer, the class trick and React's tainting APIs: [01d · Return values, DTOs and tainting](01d-return-values-dtos-and-tainting.md). What follows here is only the part that interacts with authorization.

## Closures: variables you did not realise crossed the wire

> *"Defining a Server Action inside a component creates a closure where the action has access to the outer function's scope."*

```tsx
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

> *"However, for this to happen, the captured variables are sent to the client and back to the server when the action is invoked. To prevent sensitive data from being exposed to the client, Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build."*

🔴 And the sentence that matters most, which the docs place immediately after:

> *"**Good to know:** We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."*

So an inline action that closes over a database row, an API key or a full user object is sending that value to the browser — encrypted, but sent. Treat the closure scope of an inline action as a serialization boundary and capture only identifiers.

The full mechanics — what a `'use server'` module exports, `bind` versus a hidden input, and how the closure payload is assembled — are in [01c · What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md).

For multi-instance deployments the key has to be pinned:

> *"When **self-hosting** your Next.js application across multiple servers, each server instance may end up with a different encryption key, leading to potential inconsistencies."*

> *"To mitigate this, you can overwrite the encryption key using the `process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` environment variable. Specifying this variable ensures that your encryption keys are persistent across builds, and all server instances use the same key."*

> *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."*

## Destructive operations deserve more

> *"Destructive operations like deletes may warrant stronger handling, such as elevated session checks or re-authentication, and a loud failure when those checks miss."*

"A loud failure" is the part people skip. An action that silently returns on an authorization failure produces no signal; an action that throws produces a log line, an error rate and eventually an alert. If the experimental `authInterrupts` flag is enabled you can throw `unauthorized()` and `forbidden()` from `next/navigation` and Next.js will render the corresponding `unauthorized.tsx` / `forbidden.tsx` segment — a real UI for a real failure rather than a blank page.

Rate limiting belongs here too: *"For expensive operations (sending emails, writing to a database), consider adding rate limiting to prevent abuse."* An ownership check that runs correctly ten thousand times a second is still an enumeration oracle, and an action that sends email is a spam relay with your domain's reputation attached.

The framework also caps payload size — *"Action requests are capped at 1MB by default"*, configurable via `serverActions.bodySizeLimit`. That is a denial-of-service control, not an authorization one, and raising it for a file upload raises it for every action on the deployment.

## Gotchas

**★ Symptom: `isAdmin=true` in the query string grants the admin panel.** Cause: `searchParams` is client data, exactly as the docs' bad example shows. Fix: derive the role from the verified session.

```tsx
export default async function Page() {
  const session = await requireSession()
  if (session.role !== 'admin') redirect('/')
  return <AdminPanel />
}
```

**★ Symptom: a Server Action's return value contains `passwordHash` or `stripeCustomerId`.** Cause: the ORM's write result was returned directly, and returns are serialized to the client. Fix: return a literal.

```ts
await db.user.update({ where: { id: session.userId }, data: { name } })
return { success: true }
```

**★ Symptom: a client-side error toast displays a database table name.** Cause: the driver's error object was thrown out of the action and serialized. Fix: catch at the action boundary and return a message you wrote.

```ts
try {
  await archiveProject(projectId)
  return { ok: true as const }
} catch (error) {
  console.error(error)              // full detail stays on the server
  return { ok: false as const, message: 'Could not archive this project.' }
}
```

**★ Symptom: a caller creates records in another team by passing a different `teamId`.** Cause: authority arrived as a parameter. Fix: take only the resource id and the user's change; resolve the team from the session and re-check membership.

**★ Symptom: `formData.get('confirm')` is compared to a string and an absent field passes.** Cause: a missing `FormData` field is `null`, and stringifying it yields `"null"`, which is truthy. Fix: parse through a schema rather than reading raw values.

```ts
const Schema = z.object({ confirm: z.literal('DELETE') })
const parsed = Schema.safeParse(Object.fromEntries(formData))
if (!parsed.success) throw new Error('BadRequest')
```

**★ Symptom: inline actions fail intermittently after scaling to multiple instances.** Cause: closure variables are encrypted with a key generated per build, and each self-hosted instance generated its own. Fix: set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — base64, decoding to 16, 24 or 32 bytes — shared across instances.

**★ Symptom: an inline action closes over the full user row and a reviewer says it is "encrypted, so it's fine".** Cause: encryption is not confinement — the value still travels to the browser and back, and the docs say plainly they *"don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."* Fix: capture an id in the closure and re-read the row inside the action.

**★ Symptom: an authorization failure produces a blank page and no log entry.** Cause: the action returned early instead of throwing, so nothing recorded that a forbidden attempt happened. Fix: throw — the docs ask for *"a loud failure when those checks miss"* — and, with `authInterrupts` enabled, use `forbidden()` so there is a rendered segment for it.

**★ Symptom: an action that sends email is used to send thousands of them.** Cause: no rate limit. Authorization was correct — the caller was allowed to send *an* email. Fix: rate-limit per user and per resource on expensive actions, as the docs recommend for *"sending emails, writing to a database"*.

**★ Symptom: raising `bodySizeLimit` for one upload action makes every action accept large payloads.** Cause: it is a deployment-wide setting, not per-action. Fix: keep the limit low and handle large uploads out of band — a signed direct-to-storage upload — rather than widening the default for every entry point.

## Interview questions

**★ Why is a Server Action's return value a security surface?**
Because it is serialized and sent to the browser verbatim. The docs put it directly: *"Server Action return values are serialized and sent to the client."* Returning the ORM's result object works and looks clean, and it exports every column the model has — including ones added months later by someone with no idea the object crossed that boundary. The fix is a literal return shape, which means the response is defined by your code rather than by your schema.

**★ Variables captured by an inline Server Action are encrypted. Why is that not a reason to close over sensitive data?**
Because encryption addresses confidentiality in transit, not the fact that the value leaves the server at all. The docs explain that captured variables *"are sent to the client and back to the server when the action is invoked"*, and then add that they *"don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."* A key is a key: it can be misconfigured, pinned across instances for operational reasons, or exposed by a future defect. Capture an id, re-read the value inside the action, and the question does not arise.

**★ What is the review question you ask about each Server Action parameter?**
"What happens if the caller sets this to any value they choose?" A resource id is fine, because the action looks it up and checks ownership. A `teamId`, `role`, `userId`, `price` or `isAdmin` is not, because the action will act on the caller's assertion. That single question separates parameters that *name* something from parameters that *assert authority*, and only the first kind belongs in a signature.

**★ Why is rate limiting a security control and not just a cost control on an action that is correctly authorized?**
Because correct authorization still permits repetition. An action that is allowed to send an email once is allowed to send it ten thousand times; an action that correctly returns "not yours" for a bad id is an oracle you can run over the id space. Authorization decides *whether*; rate limiting decides *how often*, and several real attacks — credential stuffing, enumeration, mail-relay abuse — need only the second control to fail.

**★ What does the 1MB body-size limit protect, and what does it not?**
It bounds the memory and parsing cost of a single action invocation, which is a denial-of-service control. It does nothing about authorization, validation or repetition — a 900KB payload from an unauthorized caller is still an unauthorized call. It is also deployment-wide, so raising it to accommodate one upload path raises it for every action, which is a reason to move large uploads out of the action path entirely rather than to reconfigure the limit.

---

← [Authorization: ownership checks](03g-authorization-ownership-checks-and-every-entry-point.md) · [Chapter 10 overview](01-explanation.md) · Next → [CSRF, the origin check and the audit](03i-csrf-the-origin-check-and-the-audit.md)
