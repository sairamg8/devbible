---
title: "'use server'"
sidebar_label: "04 · 'use server'"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use server'`](https://react.dev/reference/rsc/use-server) (definition, all caveats,
> both security sections, and the serializable arguments and return values lists) and
> [Server Functions](https://react.dev/reference/rsc/server-functions) (the naming note and
> both creation forms).
> No sandbox script backs this page; claims are cited, not measured.

**`'use server'` has nothing to do with Server Components.** It marks a **Server Function**
— an async function on the server that client code is allowed to call over the network.
Confusing the two directives is the single most common RSC mistake, and react.dev names it
explicitly in the Server Components reference:

> **A common misunderstanding is that Server Components are denoted by `"use server"`, but
> there is no directive for Server Components. The `"use server"` directive is used for
> Server Functions.**

## What it actually does

> **Add `'use server'` at the top of an async function body to mark the function as callable
> by the client.**
>
> **When calling a Server Function on the client, it will make a network request to the
> server that includes a serialized copy of any arguments passed. If the Server Function
> returns a value, that value will be serialized and returned to the client.**

Read that as the definition of **RPC**, because that is what it is. Not a shared function,
not an import that "runs on the server" — a network call, with everything a network call
implies: latency, failure, and an attacker who can send whatever they like
([topic 09](09-calling-server-functions.md), [topic 06](06-server-function-security/README.md)).

## The two forms, and why the difference matters

### Inline — one function

```js
// A Server Component file. No directive at the top of the FILE.
async function createNoteAction() {
  'use server';
  await db.notes.create();
}
```

The directive is the first statement **in the function body**. Exactly one function becomes
callable.

### Module level — every export

> **Instead of individually marking functions with `'use server'`, you can add the directive
> to the top of a file to mark all exports within that file as Server Functions that can be
> used anywhere, including imported in client code.**

```js
'use server';

export async function createNote(formData) { /* … */ }
export async function deleteNote(id)       { /* … */ }
```

🔴 **"All exports" is literal, and it is a security decision, not a convenience.** Every
export in that file becomes a **public HTTP endpoint**. A helper you exported only so a
sibling module could use it is now callable by anyone with the browser's network tab open.
Keep such files small and export nothing you did not intend to expose — this is the concrete
form of [topic 06](06-server-function-security/README.md).

It is also why the earlier mistake is worse than it looks: someone who adds `'use server'` to
the top of a **component file**, believing it marks a Server Component, has not merely failed
to do that. They have marked every export in the file as a callable endpoint.

> **To import a Server Function from client code, the directive must be used on a module
> level.**

So the module form is not stylistic — it is required when a Client Component imports the
function directly. The inline form is for a function defined inside a Server Component and
passed **down** as a prop.

## The caveats, each with its consequence

> **`'use server'` must be at the very beginning of their function or module; above any other
> code including imports (comments above directives are OK). They must be written with single
> or double quotes, not backticks.**

Same shape as `'use client'` ([topic 03](03-use-client.md)), same silent failure.

> **`'use server'` can only be used in server-side files. The resulting Server Functions can
> be passed to Client Components through props.**

That second sentence is the whole composition story: the *function* stays on the server; what
crosses the boundary is a **reference** to it. Server Function references are explicitly on
the serializable list ([topic 05](05-what-crosses-the-boundary.md)), which is what makes
"functions can't cross the boundary, except this one kind" true rather than contradictory.

> **Because the underlying network calls are always asynchronous, `'use server'` can only be
> used on async functions.**

A synchronous function is not a near-miss here — it is unrepresentable, because the call site
is a network round trip.

> **Server Functions should be called in a Transition. Server Functions passed to
> `<form action>` or `formAction` will automatically be called in a transition.**

Everything from [Phase 9](../phase-9-forms-actions/02-actions.md) therefore applies
unchanged when you use a form. Call one from a plain event handler and **the transition is
yours to provide** — otherwise you lose the non-blocking behaviour, the pending state and the
Suspense-fallback suppression that made Actions worth using
([topic 09](09-calling-server-functions.md)).

> **Server Functions are designed for mutations that update server-side state; they are not
> recommended for data fetching. Accordingly, frameworks implementing Server Functions
> typically process one action at a time and do not have a way to cache the return value.**

🔴 **This is the caveat people ignore and then blame RSC for.** Two documented reasons, both
fatal for reads:

- **Serialized execution.** One action at a time means parallel reads become a queue.
- **No return-value caching.** Every call pays full cost, every time.

Reads belong in Server Components, where `await` in render is the mechanism and
[topic 15](15-data-fetching-in-rsc.md) is the technique. Using a Server Function as a
`getUser()` is building a slow, uncacheable, serialized API by hand.

## What can be passed and returned

The argument list is **not** the same as the prop list from
[topic 05](05-what-crosses-the-boundary.md), and the two differences are load-bearing.

| | Server Function **arguments** | Client Component **props** |
|---|---|---|
| Primitives, `Date`, plain objects, `Map`/`Set`/`TypedArray`, Promises | ✅ | ✅ |
| Server Function references | ✅ | ✅ |
| **`FormData`** | ✅ | ✖ |
| **React elements / JSX** | ✖ | ✅ |
| **Events from event handlers** | ✖ | — |
| Ordinary functions, classes, class instances, non-global symbols | ✖ | ✖ |

`FormData` is on the argument list because a form action *is* the primary way these get
called. JSX is off it because sending a rendered tree *to* the server is meaningless — the
tree flows the other way.

> **Supported serializable return values are the same as serializable props for a boundary
> Client Component.**

So the return trip follows the prop rules: return plain data, not a class instance, and not
a function.

⚠️ **"Events from event handlers" is on the not-supported list for a practical reason.**
`onSubmit={(e) => createNote(e)}` fails — a DOM event is not serializable. Pass the fields
you need, or use the form action and take `FormData`.

## Naming: Server Function vs Server Action

> **Until September 2024, we referred to all Server Functions as "Server Actions". If a
> Server Function is passed to an action prop or called from inside an action then it is a
> Server Action, but not all Server Functions are Server Actions.**

The current distinction is precise and worth using correctly: **Server Function** is what the
directive creates; **Server Action** is a Server Function *in the role of* an Action. Most
material written before late 2024 — and a good deal written since — uses the old name for
everything.

## Gotchas

**Symptom:** `'use server'` was added to the top of a component file to make it a Server
Component.
**Cause:** the directive marks Server Functions; Server Components need no directive.
**Fix:** delete it — and check what that file exported, because every export was briefly a
public endpoint.

**Symptom:** "use server functions must be async".
**Cause:** the call is a network round trip, so a synchronous function cannot represent it.
**Fix:** make it `async`.

**Symptom:** a Client Component imports the function and the build fails.
**Cause:** importing from client code requires the **module-level** directive; the inline
form only supports passing the function down as a prop.
**Fix:** move the directive to the top of the file, and shrink the file to only what should
be public.

**Symptom:** no pending state and the UI blocks while a Server Function runs.
**Cause:** it was called from a plain event handler. Only `<form action>` and `formAction`
wrap it in a transition automatically.
**Fix:** wrap the call in `startTransition`, or use `useActionState`.

**Symptom:** a list of Server Function "queries" is slow and gets slower under load.
**Cause:** frameworks typically process one action at a time and cannot cache the return
value — documented, and the reason they are not recommended for data fetching.
**Fix:** fetch in Server Components with `await` in render.

**Symptom:** passing the event object to a Server Function throws.
**Cause:** events from event handlers are explicitly not serializable arguments.
**Fix:** pass the values you need, or use a form action and read `FormData`.

**Symptom:** a Server Function returns a class instance and the client receives something
else.
**Cause:** return values follow the same rules as props; class instances are not
serializable.
**Fix:** return a plain object.

## Interview questions

**★ What does `'use server'` mark?**
A **Server Function** — an async function on the server that client code may call. It has
nothing to do with Server Components, which have no directive at all. Calling one makes a
network request carrying a serialized copy of the arguments, and the return value is
serialized back. It is RPC.

**★ What is the difference between the inline form and the module-level form?**
Inline marks one function, as the first statement in its body, and that function is passed
down as a prop. Module level marks **all exports in the file** and is **required** if client
code imports the function directly. The module form is a security decision — every export
becomes a public endpoint — so those files should be small and deliberate.

**★ Why is `'use server'` on a component file worse than a no-op?**
Because it does not do nothing. It marks every export in that file as a Server Function —
a callable network endpoint — so a mistake made in pursuit of "making this a Server
Component" can expose functions that were never meant to be reachable.

**★ Why are Server Functions not recommended for data fetching?**
Two documented reasons: frameworks implementing them typically process **one action at a
time**, so parallel reads serialize into a queue, and there is **no way to cache the return
value**, so every call pays full cost. They are designed for mutations. Reads belong in
Server Components, where you `await` in render.

**How do the argument rules differ from the prop rules?**
Arguments **add `FormData`** and **exclude React elements/JSX** and events from event
handlers; props are the reverse on those two points. Everything else — primitives, `Date`,
plain objects, `Map`/`Set`, promises, Server Function references — is shared, and return
values follow the prop rules exactly.

**Server Function or Server Action — which is which?**
"Server Actions" was the name for all of them until September 2024. Now a Server Function is
what the directive creates, and it is a Server *Action* only when it is passed to an `action`
prop or called from inside an Action. Not all Server Functions are Server Actions.

**How does a Server Function reach a Client Component if functions cannot cross the
boundary?**
What crosses is a **reference**, not the function. Server Function references are explicitly
on the serializable list, and the framework creates the reference and passes it through. The
body never leaves the server — calling the reference is what performs the network request.

---

← Prev: [`'use client'`](03-use-client.md) ·
Index: [Phase 10](README.md) ·
Next → [What crosses the boundary](05-what-crosses-the-boundary.md)
