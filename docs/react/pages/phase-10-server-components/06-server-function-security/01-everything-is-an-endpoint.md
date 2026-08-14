---
title: "Everything you write is an endpoint"
sidebar_label: "01 · Everything is an endpoint"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8** and **Next.js 16.3.1**, from documentation —
> react.dev [`'use server'`](https://react.dev/reference/rsc/use-server) (both Security
> considerations paragraphs) and Next.js
> [How to think about data security](https://nextjs.org/docs/app/guides/data-security)
> (direct POST reachability, the authentication/authorization section, and controlling
> return values).
> No sandbox script backs this page; claims are cited, not measured.

**The mental model that keeps you safe:** writing `'use server'` is the same act as adding a
route to an Express app. The syntax hides it — it looks like a function call — but the wire
does not care what it looks like in your source.

## Reachable whether or not you call it

> **By default, when a Server Action is created and exported, it is reachable via a direct
> POST request, not just through your application's UI. This means, even if a Server Action
> or utility function is not imported elsewhere in your code, it can still be called
> externally.** — Next.js

Two consequences that people consistently get wrong:

- **"Only my button calls it" is not a security property.** The button is one client. `curl`
  is another.
- **An unused export is still an export.** A helper left in a `'use server'` file "for
  later" is live. This is the concrete danger behind topic 04's warning that the
  module-level directive marks *all* exports ([topic 04](../04-use-server.md)).

So the first control is not code at all — it is **what you put in `'use server'` files.**
Keep them thin, export only what is meant to be callable, and push the real work into
modules that are not exported across the boundary.

## Arguments are attacker-controlled

> **Arguments to Server Functions are fully client-controlled. For security, always treat
> them as untrusted input, and make sure to validate and escape arguments as appropriate.**
> — react.dev

The typed signature you wrote is a **development-time** convenience. TypeScript is erased,
and the caller is under no obligation to honour it.

```js
'use server';

// ✖ trusts shape, type and range
export async function updateQuantity(itemId, quantity) {
  await db.cart.update({ where: { id: itemId }, data: { quantity } });
}
```

`quantity` can be `-5`, `1e9`, `"3"`, an object, or absent. `itemId` can be any id in the
table, including one that belongs to someone else. **Validate at the top of the function**,
with a schema if the input has any structure — the same argument the Express side of this
bible makes about request bodies, for the same reason.

⚠️ **Client-side validation is UX, never enforcement.** A form that blocks negative numbers
is a good form. It is not a check, because the form is not what calls your function.

## 🔴 A page-level check does not protect the action inside it

> **A page-level authentication check does not extend to the Server Actions defined within
> it. Always re-verify inside the action.** — Next.js

This is the single most expensive misunderstanding in the topic, because the code *looks*
guarded:

```jsx
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');   // guards the UI only

  return (
    <form action={async () => {
      'use server';
      const session = await auth();                   // ← required, not redundant
      if (!session?.user?.isAdmin) throw new Error('Unauthorized');
      await db.record.deleteMany();
    }}>
      <button>Delete Records</button>
    </form>
  );
}
```

The redirect decides **which UI is rendered**. The action is a **separate entry point** and
is reached by a POST that never rendered the page. The inner `auth()` call is not
belt-and-braces; it is the only check there is.

The same reasoning kills every variant of the idea: a layout that checks a session, a
middleware that guards a path, a component that only renders the form for admins. None of
them are on the path a direct POST takes.

## Authentication is not authorization

Checking *who* is calling is half the job. The other half is whether that person may act on
**this specific resource** — the absence of which is
[IDOR](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html),
and it is trivially exploitable when the resource id is an argument.

```js
'use server';

export async function deletePost(postId) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');       // authentication

  const post = await db.post.findUnique({ where: { id: postId } });
  if (post.authorId !== session.user.id) throw new Error('Forbidden');  // authorization

  await db.post.delete({ where: { id: postId } });
}
```

Every logged-in user of your app can call `deletePost` with **any** `postId`. Without the
ownership check, "logged in" becomes "may delete anything".

**The ordering is a habit worth forming:** authenticate, load the resource, check ownership
or role against *that* resource, then act.

## Control what you send back

Return values are serialized to the client ([topic 05](../05-what-crosses-the-boundary.md)),
so a Server Function leaks in both directions if you let it.

```js
// ✖ returns the full record — internal fields included
return db.user.update({ where: { id }, data: { name } });

// ✅ returns what the UI needs
await db.user.update({ where: { id }, data: { name } });
return { success: true };
```

Returning the ORM result is the natural thing to write, and it ships every column: password
hashes, internal flags, soft-delete markers, other people's identifiers. The habit that
prevents it is the same one from topic 05 — **map at the boundary** — applied to the return
trip.

## Put the rules somewhere they cannot be skipped

Both react.dev and Next.js end up in the same place: the checks belong in a layer that every
path goes through, not copied into each action.

> A Data Access Layer *"should: Only run on the server. Perform authorization checks. Return
> safe, minimal **Data Transfer Objects (DTOs)**."* — Next.js

```js
// data/posts.js  — server-only, not exported across the boundary
import 'server-only';

export async function deletePost(postId) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  const post = await db.post.findUnique({ where: { id: postId } });
  if (post.authorId !== session.user.id) throw new Error('Forbidden');
  await db.post.delete({ where: { id: postId } });
}
```

```js
// app/actions.js — the thin public surface
'use server';
import { deletePost } from '@/data/posts';

export async function deletePostAction(postId) {
  await deletePost(postId);          // auth and authz happen inside the DAL
}
```

The `'use server'` file stays small enough to audit at a glance, and the security logic lives
in a module that **cannot** be imported into the client graph. `server-only` is an npm
package convention that turns a wrong import into a build error — a framework/ecosystem
tool, not part of React.

## Gotchas

**Symptom:** an action is "safe because the UI only shows the button to admins".
**Cause:** the UI is not the caller. A direct POST reaches the action without rendering
anything.
**Fix:** authenticate and authorize inside the function.

**Symptom:** a helper in a `'use server'` file is called by no one and assumed dead.
**Cause:** every export in such a file is reachable, even if nothing imports it.
**Fix:** move it out of the file, or accept that it is a public endpoint and guard it.

**Symptom:** TypeScript types "guarantee" the argument shape.
**Cause:** types are erased; arguments are fully client-controlled.
**Fix:** validate at runtime, with a schema for anything structured.

**Symptom:** any logged-in user can affect any record.
**Cause:** authentication without authorization — the resource id came from the caller.
**Fix:** load the resource and check ownership or role against it before acting.

**Symptom:** the network tab shows internal database fields the UI never displays.
**Cause:** the action returned the ORM result directly, and return values are serialized to
the client.
**Fix:** return only what the UI needs.

**Symptom:** the same three security lines are copy-pasted into fifteen actions and one is
missing them.
**Cause:** the checks live in the actions rather than in a layer everything goes through.
**Fix:** a `server-only` data access layer; keep the `'use server'` file thin.

## Interview questions

**★ Why is a Server Function a security concern at all — it looks like a function call.**
Because it is not one. It compiles to a public HTTP endpoint reachable by direct POST,
whether or not your UI calls it, and even if nothing in your code imports it. Arguments are
fully client-controlled. Everything you would do for an Express route — validate input,
authenticate, authorize, rate limit — applies unchanged.

**★ A page redirects unauthenticated users, and the action is defined inside that page. Is
the action protected?**
No. A page-level authentication check does not extend to the Server Actions defined within
it. The redirect decides which UI renders; the action is a separate entry point reached by a
POST that never rendered the page. The check inside the action is the only real one — and
the same goes for layouts, middleware and conditional rendering.

**★ What is the difference between the two checks every action needs?**
Authentication answers *who is calling*; authorization answers *may this caller act on this
specific resource*. Resource ids arrive as arguments, so an action with only an
authentication check lets any logged-in user act on anyone's data — that is IDOR. Load the
resource and compare it to the session before acting.

**★ How do return values become a security problem?**
They are serialized and sent to the client, so returning an ORM result ships every column —
internal flags, hashes, other people's identifiers — even if the UI renders none of it. The
fix is the same mapping discipline the prop boundary requires, applied to the return trip.

**Where should the security logic live?**
In a server-only data access layer that performs authorization and returns minimal DTOs,
with the `'use server'` file as a thin delegating surface. Two reasons: the public surface
stays small enough to audit, and the logic sits in a module that cannot be pulled into the
client graph. Copy-pasted checks are how one action ends up missing one.

**What is the first thing you would look at auditing an RSC codebase?**
The `'use server'` files — what they export, whether arguments are validated, whether the
user is re-authorized inside each action, whether ownership of the resource is checked rather
than just login, and whether return values are filtered. Then the `'use client'` files, for
props whose types are broader than the component needs.

---

← Index: [Server Function security](README.md) ·
Next → [What the framework does, and what it does not](02-what-the-framework-does.md)
